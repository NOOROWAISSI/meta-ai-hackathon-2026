using Microsoft.AspNetCore.Mvc;
using MySqlConnector;

namespace NextStep.Api.Controllers;

public sealed record CampusFollowChange(bool Following, string ExpectedAccountId);
public sealed record CampusSeenChange(string ExpectedAccountId);
public sealed record CampusFollow(string UniversityId, string FollowedAt, string SeenAt, string[] NewOpportunityIds);
[ApiController]
public sealed class CampusFollowsController(MySqlStateStore store, PalestineNetwork network, DiscoveryFeed feed, Accounts accounts) : ControllerBase {
    private async Task<string> Owner(string? expected, CancellationToken ct) {
        var account = await accounts.Me(Request.Cookies["nextstep-session"], ct);
        Input.Require(account is not null && (expected is null || expected == account.Id), "Sign in to the same account before changing followed universities.");
        return (string)HttpContext.Items["owner"]!;
    }
    [HttpGet("/api/campus-follows")]
    public async Task<CampusFollow[]> Read(CancellationToken ct) {
        var owner = await Owner(null, ct); var listings = await feed.Listings(ct);
        await using var db = await store.Open(ct);
        await using var query = new MySqlCommand("SELECT university_id,followed_at,seen_at FROM campus_follows WHERE owner_id=@owner ORDER BY university_id", db); query.Parameters.AddWithValue("@owner", owner);
        var result = new List<CampusFollow>(); await using var rows = await query.ExecuteReaderAsync(ct);
        while (await rows.ReadAsync(ct)) {
            var id = rows.GetString(0); var followed = DateTime.SpecifyKind(rows.GetDateTime(1), DateTimeKind.Utc); var seen = DateTime.SpecifyKind(rows.GetDateTime(2), DateTimeKind.Utc);
            var ids = listings.Where(l => l.UniversityId == id && l.FirstSeenAt is not null && DateTimeOffset.Parse(l.FirstSeenAt) > new DateTimeOffset(seen) && l.AvailabilityState != "ended" && l.AvailabilityState != "cancelled").Select(l => l.Id).ToArray();
            result.Add(new(id, followed.ToString("O"), seen.ToString("O"), ids));
        }
        return result.ToArray();
    }
    [HttpPut("/api/campus-follows/{id}")]
    public async Task<IActionResult> Change(string id, CampusFollowChange change, CancellationToken ct) {
        var owner = await Owner(change.ExpectedAccountId, ct);
        Input.Require(network.Read().Institutions.Any(u => u.Id == id), "Choose a university from the source directory.");
        await using var db = await store.Open(ct);
        await using var command = new MySqlCommand(change.Following ? "INSERT IGNORE INTO campus_follows(owner_id,university_id,followed_at,seen_at) VALUES(@owner,@id,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6))" : "DELETE FROM campus_follows WHERE owner_id=@owner AND university_id=@id", db);
        command.Parameters.AddWithValue("@owner", owner); command.Parameters.AddWithValue("@id", id); await command.ExecuteNonQueryAsync(ct); return Ok(new { confirmed = true });
    }
    [HttpPut("/api/campus-follows/{id}/seen")]
    public async Task<IActionResult> Seen(string id, CampusSeenChange change, CancellationToken ct) {
        var owner = await Owner(change.ExpectedAccountId, ct); await using var db = await store.Open(ct);
        await using var command = new MySqlCommand("UPDATE campus_follows SET seen_at=UTC_TIMESTAMP(6) WHERE owner_id=@owner AND university_id=@id", db);
        command.Parameters.AddWithValue("@owner", owner); command.Parameters.AddWithValue("@id", id); await command.ExecuteNonQueryAsync(ct); return Ok(new { confirmed = true });
    }
}
