using MySqlConnector;

namespace NextStep.Api;

// Disclosure acknowledgments live in their own table, never inside the
// UserState JSON payload. Wire.Json rejects unmapped members, so a new
// payload field would make every earlier build unable to read the state of
// a student who had acknowledged: rolling back would break their account
// (verified against a disposable database during the P2 review). A separate
// table is invisible to earlier builds, survives their writes untouched,
// and disappears with the session through the same cascade as user_state.
public sealed class DisclosureStore(MySqlStateStore store)
{
    public async Task<DisclosureAck?> Get(string owner, CancellationToken ct)
    {
        await using var connection = await store.Open(ct);
        await using var command = new MySqlCommand("SELECT version, acknowledged_at FROM disclosure_acks WHERE owner_id=@owner", connection);
        command.Parameters.AddWithValue("@owner", owner);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return new DisclosureAck(reader.GetInt32(0), reader.GetString(1));
    }

    public async Task Set(string owner, DisclosureAck? acknowledgment, CancellationToken ct)
    {
        await using var connection = await store.Open(ct);
        if (acknowledgment is null)
        {
            await using var delete = new MySqlCommand("DELETE FROM disclosure_acks WHERE owner_id=@owner", connection);
            delete.Parameters.AddWithValue("@owner", owner);
            await delete.ExecuteNonQueryAsync(ct);
            return;
        }
        await using var upsert = new MySqlCommand(
            "INSERT INTO disclosure_acks(owner_id, version, acknowledged_at) VALUES(@owner, @version, @at) " +
            "ON DUPLICATE KEY UPDATE version=@version, acknowledged_at=@at", connection);
        upsert.Parameters.AddWithValue("@owner", owner);
        upsert.Parameters.AddWithValue("@version", acknowledgment.Version);
        upsert.Parameters.AddWithValue("@at", acknowledgment.AcknowledgedAt);
        await upsert.ExecuteNonQueryAsync(ct);
    }
}
