using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MySqlConnector;

namespace NextStep.Api;

/// <summary>One MySQL authority. The per-owner row lock makes state/version/receipt
/// commits atomic across tabs, processes, and application instances.</summary>
public sealed class MySqlStateStore(IConfiguration configuration) : IStateStore
{
    private string ConnectionString => configuration.GetConnectionString("NextStep") ?? throw new ApiFault("provider_unavailable", "MySQL is not configured. Set ConnectionStrings__NextStep on the server.", true);
    internal async Task<MySqlConnection> Open(CancellationToken ct)
    {
        var connection = new MySqlConnection(ConnectionString);
        try { await connection.OpenAsync(ct); return connection; }
        catch { await connection.DisposeAsync(); throw; }
    }
    public async Task Migrate(CancellationToken ct)
    {
        await using var connection = await Open(ct);
        var sql = await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "Data", "schema.sql"), ct);
        await using var command = new MySqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync(ct);
    }
    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
    public async Task<string> CreateSession(CancellationToken ct)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var owner = Guid.NewGuid().ToString("N");
        await using var connection = await Open(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        await using var session = new MySqlCommand("INSERT INTO anonymous_sessions(owner_id,token_hash,expires_at) VALUES(@owner,@token,@expires)", connection, tx);
        session.Parameters.AddWithValue("@owner", owner); session.Parameters.AddWithValue("@token", Hash(token)); session.Parameters.AddWithValue("@expires", DateTime.UtcNow.AddDays(30));
        await session.ExecuteNonQueryAsync(ct);
        var state = new UserState { Profile = Input.Blank("profile-" + owner) };
        await using var data = new MySqlCommand("INSERT INTO user_state(owner_id,schema_version,payload) VALUES(@owner,1,@payload)", connection, tx);
        data.Parameters.AddWithValue("@owner", owner); data.Parameters.AddWithValue("@payload", JsonSerializer.Serialize(state, Wire.Json));
        await data.ExecuteNonQueryAsync(ct); await tx.CommitAsync(ct);
        return token;
    }
    public async Task<string?> ResolveSession(string token, CancellationToken ct)
    {
        if (token.Length != 64 || token.Any(c => !Uri.IsHexDigit(c))) return null;
        await using var connection = await Open(ct);
        await using var command = new MySqlCommand("SELECT owner_id FROM anonymous_sessions WHERE token_hash=@token AND expires_at>UTC_TIMESTAMP(6) UNION ALL SELECT owner_id FROM account_sessions WHERE token_hash=@token AND expires_at>UTC_TIMESTAMP(6) LIMIT 1", connection);
        command.Parameters.AddWithValue("@token", Hash(token));
        return await command.ExecuteScalarAsync(ct) as string;
    }
    public async Task<T> Read<T>(string owner, Func<UserState, T> read, CancellationToken ct)
    {
        await using var connection = await Open(ct);
        await using var command = new MySqlCommand("SELECT payload FROM user_state WHERE owner_id=@owner", connection);
        command.Parameters.AddWithValue("@owner", owner);
        var payload = await command.ExecuteScalarAsync(ct) as string ?? throw new ApiFault("not_found", "Saved state is unavailable. Start a new anonymous session.");
        return read(Parse(payload));
    }
    public async Task<T> Change<T>(string owner, Func<UserState, T> change, CancellationToken ct)
    {
        await using var connection = await Open(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        await using var select = new MySqlCommand("SELECT payload FROM user_state WHERE owner_id=@owner FOR UPDATE", connection, tx);
        select.Parameters.AddWithValue("@owner", owner);
        var payload = await select.ExecuteScalarAsync(ct) as string ?? throw new ApiFault("not_found", "Saved state is unavailable.");
        var state = Parse(payload);
        var result = change(state);
        var json = JsonSerializer.Serialize(state, Wire.Json);
        Input.Require(Encoding.UTF8.GetByteCount(json) <= 1048576, "Stored state is too large. Export or remove old plans before adding more.");
        await using var update = new MySqlCommand("UPDATE user_state SET payload=@payload,revision=revision+1 WHERE owner_id=@owner", connection, tx);
        update.Parameters.AddWithValue("@payload", json); update.Parameters.AddWithValue("@owner", owner);
        await update.ExecuteNonQueryAsync(ct); await tx.CommitAsync(ct);
        return result; // A success is observable only after COMMIT.
    }
    private static UserState Parse(string json)
    {
        var state = JsonSerializer.Deserialize<UserState>(json, Wire.Json);
        if (state is null || state.SchemaVersion != 1) throw new ApiFault("provider_unavailable", "Stored schema requires recovery. No data was changed.");
        return state;
    }
    public async Task Delete(string owner, CancellationToken ct)
    {
        await using var connection = await Open(ct);
        await using var command = new MySqlCommand("DELETE FROM anonymous_sessions WHERE owner_id=@owner", connection);
        command.Parameters.AddWithValue("@owner", owner); await command.ExecuteNonQueryAsync(ct);
    }
    public async Task<bool> Healthy(CancellationToken ct)
    {
        await using var connection = await Open(ct);
        await using var command = new MySqlCommand("SELECT COUNT(*) FROM schema_migrations WHERE version=5", connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync(ct)) == 1;
    }
}
