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
    // Object-level schema health (combined integration): a ledger row in
    // schema_migrations cannot prove a table exists, because independent
    // branches historically claimed the same version for different tables.
    // Health therefore verifies the actual objects the combined build needs:
    // every required table, the critical columns other code reads by name,
    // and every named foreign key. Any missing object reports unhealthy.
    private static readonly string[] RequiredTables = ["account_sessions", "accounts", "announcement_extractions", "anonymous_sessions", "campus_activities", "campus_follows", "disclosure_acks", "discovered_listings", "evidence_import_optins", "intake_candidates", "password_recovery", "profile_evidence", "schema_migrations", "source_pages", "source_runs", "user_state"];
    private static readonly (string Table, string Column)[] RequiredColumns = [("user_state", "payload"), ("user_state", "revision"), ("disclosure_acks", "version"), ("disclosure_acks", "acknowledged_at"), ("profile_evidence", "payload"), ("evidence_import_optins", "opted_in_at"), ("evidence_import_optins", "source_hash"), ("schema_migrations", "version")];
    private static readonly string[] RequiredForeignKeys = ["fk_account_owner", "fk_account_session", "fk_campus_follow_session", "fk_disclosure_owner", "fk_evidence_optin_session", "fk_profile_evidence_session", "fk_recovery_account", "fk_user_state_session"];
    public async Task<bool> Healthy(CancellationToken ct)
    {
        await using var connection = await Open(ct);
        await using var tables = new MySqlCommand("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (" + string.Join(",", RequiredTables.Select((_, i) => "@t" + i)) + ")", connection);
        for (var i = 0; i < RequiredTables.Length; i++) tables.Parameters.AddWithValue("@t" + i, RequiredTables[i]);
        if (Convert.ToInt32(await tables.ExecuteScalarAsync(ct)) != RequiredTables.Length) return false;
        await using var columns = new MySqlCommand("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND (table_name, column_name) IN (" + string.Join(",", RequiredColumns.Select((_, i) => $"(@ct{i}, @cc{i})")) + ")", connection);
        for (var i = 0; i < RequiredColumns.Length; i++) { columns.Parameters.AddWithValue("@ct" + i, RequiredColumns[i].Table); columns.Parameters.AddWithValue("@cc" + i, RequiredColumns[i].Column); }
        if (Convert.ToInt32(await columns.ExecuteScalarAsync(ct)) != RequiredColumns.Length) return false;
        await using var keys = new MySqlCommand("SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND constraint_type = 'FOREIGN KEY' AND constraint_name IN (" + string.Join(",", RequiredForeignKeys.Select((_, i) => "@k" + i)) + ")", connection);
        for (var i = 0; i < RequiredForeignKeys.Length; i++) keys.Parameters.AddWithValue("@k" + i, RequiredForeignKeys[i]);
        return Convert.ToInt32(await keys.ExecuteScalarAsync(ct)) == RequiredForeignKeys.Length;
    }
}
