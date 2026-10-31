using System.Net.Mail;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using MySqlConnector;

namespace NextStep.Api;

public sealed record AccountView(string Id, string Email, string DisplayName, bool HasPassword, bool HasGoogle)
{
    public bool EmailVerified => HasGoogle;
}
public sealed record RegisterRequest(string Email, string Password, string? DisplayName = null);
public sealed record LoginRequest(string Email, string Password);
public sealed class Accounts(MySqlStateStore store)
{
    private static readonly PasswordHasher<string> Hasher = new();
    private static readonly string DummyHash = Hasher.HashPassword("unregistered", "dummy-" + Guid.NewGuid());
    private static string Email(string value) {
        Input.Require(!string.IsNullOrWhiteSpace(value) && value.Length <= 254 && MailAddress.TryCreate(value, out var parsed) && parsed.Address == value, "Enter a valid email address.");
        return value.ToUpperInvariant();
    }
    public async Task<(AccountView Account, string Token)> Register(RegisterRequest input, CancellationToken ct)
    {
        Input.Require(input is not null); var email = input.Email?.Trim() ?? ""; var normalized = Email(email);
        Input.Require(input.Password is { Length: >= 12 and <= 128 }, "Use a password between 12 and 128 characters.");
        Input.Require(input.DisplayName is null || Input.Text(input.DisplayName, 100), "Display name is too long.");
        var account = new AccountView(Guid.NewGuid().ToString("N"), email, input.DisplayName?.Trim() ?? "", true, false);
        try {
            return await CreateAccount(account, normalized, Hasher.HashPassword(account.Id, input.Password), null, ct);
        } catch (MySqlException error) when (error.Number == 1062) { throw new ApiFault("invalid_input", "An account could not be created with these details. Try signing in."); }
    }
    public async Task<(AccountView Account, string Token)?> Login(LoginRequest input, CancellationToken ct)
    {
        Input.Require(input is not null && input.Password is { Length: > 0 and <= 128 });
        var normalized = Email(input.Email?.Trim() ?? "");
        await using var db = await store.Open(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        await using var command = new MySqlCommand("SELECT id,owner_id,email,display_name,password_hash,google_subject FROM accounts WHERE normalized_email=@email FOR UPDATE", db, tx);
        command.Parameters.AddWithValue("@email", normalized);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) { Hasher.VerifyHashedPassword("unregistered", DummyHash, input.Password); return null; }
        var id = reader.GetString(0); var owner = reader.GetString(1); var email = reader.GetString(2); var name = reader.GetString(3); var hash = reader.IsDBNull(4) ? null : reader.GetString(4); var google = !reader.IsDBNull(5);
        await reader.DisposeAsync();
        var result = Hasher.VerifyHashedPassword(id, hash ?? DummyHash, input.Password);
        if (hash is null || result == PasswordVerificationResult.Failed) return null;
        if (result == PasswordVerificationResult.SuccessRehashNeeded) {
            await using var upgrade = new MySqlCommand("UPDATE accounts SET password_hash=@hash WHERE id=@id", db, tx);
            upgrade.Parameters.AddWithValue("@hash", Hasher.HashPassword(id, input.Password)); upgrade.Parameters.AddWithValue("@id", id); await upgrade.ExecuteNonQueryAsync(ct);
        }
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        await using var session = new MySqlCommand("INSERT INTO account_sessions(token_hash,owner_id,expires_at) VALUES(@hash,@owner,@expiry)", db, tx);
        session.Parameters.AddWithValue("@hash", MySqlStateStore.Hash(token)); session.Parameters.AddWithValue("@owner", owner); session.Parameters.AddWithValue("@expiry", DateTime.UtcNow.AddDays(30));
        await session.ExecuteNonQueryAsync(ct); await tx.CommitAsync(ct);
        return (new(id, email, name, true, google), token);
    }
    public async Task<(AccountView Account, string Token)> Google(string subject, string email, string name, CancellationToken ct)
    {
        Input.Require(Input.Id(subject) && subject.Length <= 255); var normalized = Email(email); name = name.Length <= 100 ? name : name[..100];
        await using var db = await store.Open(ct);
        await using var find = new MySqlCommand("SELECT id,owner_id,email,display_name,password_hash FROM accounts WHERE google_subject=@subject", db); find.Parameters.AddWithValue("@subject", subject);
        await using var reader = await find.ExecuteReaderAsync(ct);
        if (await reader.ReadAsync(ct)) { var view = new AccountView(reader.GetString(0), reader.GetString(2), reader.GetString(3), !reader.IsDBNull(4), true); var owner = reader.GetString(1); await reader.DisposeAsync(); return (view, await Session(owner, ct)); }
        await reader.DisposeAsync();
        // Never auto-link a password account just because an OAuth email matches.
        var id = Guid.NewGuid().ToString("N");
        try {
            return await CreateAccount(new(id, email, name, false, true), normalized, null, subject, ct);
        } catch (MySqlException error) when (error.Number == 1062) { throw new ApiFault("invalid_input", "Sign in using your existing account method. Automatic account linking is unavailable."); }
    }
    private async Task<(AccountView Account, string Token)> CreateAccount(AccountView account, string normalizedEmail, string? passwordHash, string? googleSubject, CancellationToken ct)
    {
        var owner = Guid.NewGuid().ToString("N");
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        await using var db = await store.Open(ct); await using var tx = await db.BeginTransactionAsync(ct);
        async Task Execute(string sql, params (string Name, object Value)[] values) {
            await using var command = new MySqlCommand(sql, db, tx);
            foreach (var (name, value) in values) command.Parameters.AddWithValue(name, value);
            await command.ExecuteNonQueryAsync(ct);
        }
        var expiry = DateTime.UtcNow.AddDays(30);
        await Execute("INSERT INTO anonymous_sessions(owner_id,token_hash,expires_at) VALUES(@owner,@hash,@expiry)", ("@owner", owner), ("@hash", MySqlStateStore.Hash(Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"))), ("@expiry", expiry));
        await Execute("INSERT INTO user_state(owner_id,schema_version,payload) VALUES(@owner,1,@payload)", ("@owner", owner), ("@payload", JsonSerializer.Serialize(new UserState { Profile = Input.Blank("profile-" + owner) }, Wire.Json)));
        await Execute("INSERT INTO accounts(id,owner_id,email,normalized_email,password_hash,google_subject,display_name) VALUES(@id,@owner,@email,@normalized,@password,@google,@name)", ("@id", account.Id), ("@owner", owner), ("@email", account.Email), ("@normalized", normalizedEmail), ("@password", (object?)passwordHash ?? DBNull.Value), ("@google", (object?)googleSubject ?? DBNull.Value), ("@name", account.DisplayName));
        await Execute("INSERT INTO account_sessions(token_hash,owner_id,expires_at) VALUES(@hash,@owner,@expiry)", ("@hash", MySqlStateStore.Hash(token)), ("@owner", owner), ("@expiry", expiry));
        await tx.CommitAsync(ct);
        return (account, token);
    }
    private async Task<string> Session(string owner, CancellationToken ct)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        await using var db = await store.Open(ct);
        await using var command = new MySqlCommand("INSERT INTO account_sessions(token_hash,owner_id,expires_at) VALUES(@hash,@owner,@expires)", db);
        command.Parameters.AddWithValue("@hash", MySqlStateStore.Hash(token)); command.Parameters.AddWithValue("@owner", owner); command.Parameters.AddWithValue("@expires", DateTime.UtcNow.AddDays(30)); await command.ExecuteNonQueryAsync(ct); return token;
    }
    public async Task<AccountView?> Me(string? token, CancellationToken ct)
    {
        if (token is null || await store.ResolveSession(token, ct) is not { } owner) return null;
        await using var db = await store.Open(ct);
        await using var command = new MySqlCommand("SELECT id,email,display_name,password_hash,google_subject FROM accounts WHERE owner_id=@owner", db); command.Parameters.AddWithValue("@owner", owner);
        await using var reader = await command.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? new(reader.GetString(0), reader.GetString(1), reader.GetString(2), !reader.IsDBNull(3), !reader.IsDBNull(4)) : null;
    }
    public async Task Logout(string? token, CancellationToken ct)
    {
        if (token is null) return;
        await using var db = await store.Open(ct);
        await using var command = new MySqlCommand("DELETE FROM account_sessions WHERE token_hash=@hash", db); command.Parameters.AddWithValue("@hash", MySqlStateStore.Hash(token)); await command.ExecuteNonQueryAsync(ct);
    }
}
