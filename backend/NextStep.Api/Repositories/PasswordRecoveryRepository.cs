using System.Security.Cryptography;
using System.Text;
using MySqlConnector;

namespace NextStep.Api;

public sealed class PasswordRecoveryRepository(MySqlStateStore store)
{
    private static MySqlCommand Command(MySqlConnection db, MySqlTransaction tx, string sql, params (string Key, object? Value)[] args) {
        var command = new MySqlCommand(sql, db, tx); foreach (var (key, value) in args) command.Parameters.AddWithValue(key, value ?? DBNull.Value); return command;
    }
    public async Task<(string Id, bool Send, bool Throttled)> Reserve(string emailHash, string normalizedEmail, string id, string codeHash, CancellationToken ct)
    {
        await using var db = await store.Open(ct);
        await using (var cleanup = new MySqlCommand("DELETE FROM password_recovery WHERE expires_at < UTC_TIMESTAMP() - INTERVAL 1 DAY LIMIT 1000", db)) await cleanup.ExecuteNonQueryAsync(ct);
        await using var tx = await db.BeginTransactionAsync(ct);
        await using (var seed = Command(db, tx, "INSERT IGNORE INTO password_recovery(email_hash,request_id,code_hash,requested_at,expires_at) VALUES(@email,@id,@hash,'2000-01-01','2000-01-01')", ("@email", emailHash), ("@id", id), ("@hash", codeHash))) await seed.ExecuteNonQueryAsync(ct);
        await using var find = Command(db, tx, "SELECT request_id,requested_at FROM password_recovery WHERE email_hash=@email FOR UPDATE", ("@email", emailHash));
        await using var reader = await find.ExecuteReaderAsync(ct); await reader.ReadAsync(ct);
        var previous = reader.GetString(0); var requested = DateTime.SpecifyKind(reader.GetDateTime(1), DateTimeKind.Utc); await reader.DisposeAsync();
        if (requested > DateTime.UtcNow.AddSeconds(-60)) { await tx.CommitAsync(ct); return (previous, false, true); }
        await using var account = Command(db, tx, "SELECT id FROM accounts WHERE normalized_email=@email AND password_hash IS NOT NULL", ("@email", normalizedEmail));
        var accountId = await account.ExecuteScalarAsync(ct) as string;
        await using var update = Command(db, tx, "UPDATE password_recovery SET account_id=@account,request_id=@id,code_hash=@hash,requested_at=@now,expires_at=@expiry,attempts=0,delivered=0,grant_hash=NULL,grant_expires_at=NULL WHERE email_hash=@email", ("@account", accountId), ("@id", id), ("@hash", codeHash), ("@now", DateTime.UtcNow), ("@expiry", DateTime.UtcNow.AddMinutes(10)), ("@email", emailHash));
        await update.ExecuteNonQueryAsync(ct); await tx.CommitAsync(ct); return (id, accountId is not null, false);
    }
    public async Task Delivery(string id, bool success, CancellationToken ct)
    {
        await using var db = await store.Open(ct);
        await using var command = new MySqlCommand(success ? "UPDATE password_recovery SET delivered=1 WHERE request_id=@id" : "DELETE FROM password_recovery WHERE request_id=@id", db);
        command.Parameters.AddWithValue("@id", id); await command.ExecuteNonQueryAsync(ct);
    }
    public async Task<bool> Verify(string id, string codeHash, string grantHash, CancellationToken ct)
    {
        await using var db = await store.Open(ct); await using var tx = await db.BeginTransactionAsync(ct);
        await using var select = Command(db, tx, "SELECT code_hash,attempts,expires_at,delivered,account_id,grant_hash FROM password_recovery WHERE request_id=@id FOR UPDATE", ("@id", id));
        await using var reader = await select.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return false;
        var valid = reader.GetInt32(1) < 5 && reader.GetDateTime(2) > DateTime.UtcNow && reader.GetBoolean(3) && !reader.IsDBNull(4) && reader.IsDBNull(5) && CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(reader.GetString(0)), Encoding.ASCII.GetBytes(codeHash));
        await reader.DisposeAsync();
        await using var update = Command(db, tx, valid ? "UPDATE password_recovery SET attempts=attempts+1,grant_hash=@grant,grant_expires_at=@expiry WHERE request_id=@id" : "UPDATE password_recovery SET attempts=attempts+1 WHERE request_id=@id", ("@id", id), ("@grant", grantHash), ("@expiry", DateTime.UtcNow.AddMinutes(5)));
        await update.ExecuteNonQueryAsync(ct); await tx.CommitAsync(ct); return valid;
    }
    public async Task<bool> Reset(string id, string grantHash, Func<string, string> passwordHash, CancellationToken ct)
    {
        await using var db = await store.Open(ct); await using var tx = await db.BeginTransactionAsync(ct);
        await using var select = Command(db, tx, "SELECT account_id,grant_hash,grant_expires_at FROM password_recovery WHERE request_id=@id FOR UPDATE", ("@id", id));
        await using var reader = await select.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct) || reader.IsDBNull(0) || reader.IsDBNull(1) || reader.IsDBNull(2) || reader.GetDateTime(2) <= DateTime.UtcNow || !CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(reader.GetString(1)), Encoding.ASCII.GetBytes(grantHash))) return false;
        var accountId = reader.GetString(0); await reader.DisposeAsync();
        await using (var update = Command(db, tx, "UPDATE accounts SET password_hash=@hash WHERE id=@id", ("@hash", passwordHash(accountId)), ("@id", accountId))) await update.ExecuteNonQueryAsync(ct);
        await using (var revoke = Command(db, tx, "DELETE s FROM account_sessions s JOIN accounts a ON a.owner_id=s.owner_id WHERE a.id=@id", ("@id", accountId))) await revoke.ExecuteNonQueryAsync(ct);
        await using (var consume = Command(db, tx, "DELETE FROM password_recovery WHERE request_id=@id", ("@id", id))) await consume.ExecuteNonQueryAsync(ct);
        await tx.CommitAsync(ct); return true;
    }
}
