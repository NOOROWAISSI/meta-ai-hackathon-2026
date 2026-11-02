using System.Text.Json;
using MySqlConnector;

namespace NextStep.Api;

/// <summary>Public organization posts, independent of eligibility, enrollment and accepted preparation plans.</summary>
public sealed record CampusActivity(string Id, string[] UniversityIds, string[] OrganizationIds, string Title, string Summary, string OriginalUrl, string ContentUrl, string Channel, string Kind, string? PublishedDateText, string? EventDateText, string Availability, string SourcePassage, string VerificationLevel, string CollectedAt) {
    public string? FirstSeenAt { get; init; }
    public string PostType { get; init; } = "announcement";
    public string? OrganizerName { get; init; }
}
public sealed class CampusActivityFeed(MySqlStateStore store, PalestineNetwork network) {
    public async Task<CampusActivity[]> Read(CancellationToken ct) {
        var records = JsonSerializer.Deserialize<CampusActivity[]>(await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "Data", "campus-activities.json"), ct), Wire.Json)!.ToDictionary(p => p.Id, StringComparer.Ordinal);
        await using var db = await store.Open(ct); await using var query = new MySqlCommand("SELECT payload,first_seen_at FROM campus_activities ORDER BY checked_at DESC,id LIMIT 500", db);
        await using var rows = await query.ExecuteReaderAsync(ct);
        while (await rows.ReadAsync(ct)) { var item = JsonSerializer.Deserialize<CampusActivity>(rows.GetString(0), Wire.Json)!; records[item.Id] = item with { FirstSeenAt = DateTime.SpecifyKind(rows.GetDateTime(1), DateTimeKind.Utc).ToString("O") }; }
        return records.Values.GroupBy(p => p.Channel == "official_website" && new Uri(p.OriginalUrl).AbsolutePath.StartsWith("/events/details/", StringComparison.Ordinal) ? p.OriginalUrl.TrimEnd('/') : p.Id, StringComparer.Ordinal)
            .Select(group => group.OrderByDescending(p => p.CollectedAt, StringComparer.Ordinal).First()).OrderByDescending(p => p.CollectedAt, StringComparer.Ordinal).ThenBy(p => p.Id, StringComparer.Ordinal).ToArray();
    }
    internal async Task Store(SourceRegistration source, CampusActivity[] activities, CancellationToken ct) {
        if (activities.Length == 0) return;
        var group = network.Read().Organizations.SingleOrDefault(o => o.Id == source.OrganizationId);
        if (group is null || group.UniversityId != source.UniversityId) return;
        await using var db = await store.Open(ct); await using var tx = await db.BeginTransactionAsync(ct);
        foreach (var item in activities) {
            Input.Require(item.OrganizationIds.SequenceEqual(new[] { group.Id }) && item.UniversityIds.SequenceEqual(new[] { group.UniversityId }), "Activity attribution does not match its registered source.");
            await using var command = new MySqlCommand("INSERT INTO campus_activities(id,source_id,payload,first_seen_at,checked_at) VALUES(@id,@source,@payload,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE payload=@payload,checked_at=UTC_TIMESTAMP(6)", db, tx);
            command.Parameters.AddWithValue("@id", item.Id); command.Parameters.AddWithValue("@source", source.Id); command.Parameters.AddWithValue("@payload", JsonSerializer.Serialize(item, Wire.Json)); await command.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
    }
    public async Task<ListingSummary[]> Opportunities(CancellationToken ct) => (await Read(ct)).Where(p => p.PostType == "announcement" && p.Availability != "ended" && (p.Kind is "hackathon" or "training" or "course" or "competition" or "workshop") && p.VerificationLevel == "primary_source")
        .Select(p => new ListingSummary(p.Id, p.Kind, p.Title, p.OrganizerName ?? string.Join(" × ", network.Read().Organizations.Where(o => p.OrganizationIds.Contains(o.Id)).Select(o => o.Name)), "unknown", p.OriginalUrl, p.Summary, p.Title.Contains(" AI", StringComparison.Ordinal) ? ["AI"] : [], "palestine", null, "not_specified", "unknown", null, "needs_verification", p.SourcePassage,
            "Public organization announcement. Event timing, entry conditions, fees and submission requirements must be checked separately. No registration deadline inferred.") { UniversityId = p.UniversityIds.FirstOrDefault(), OrganizationId = p.OrganizationIds.FirstOrDefault(), SourcePageUrl = p.ContentUrl, FirstSeenAt = p.FirstSeenAt ?? p.CollectedAt, ExtractionMethod = "organization_post" }).ToArray();
}
