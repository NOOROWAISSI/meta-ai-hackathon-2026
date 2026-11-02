using System.Text.Json;
using MySqlConnector;

namespace NextStep.Api;

public sealed record SourceCheck(string SourceId, string LastAttemptAt, string Outcome, int CandidateCount);
public sealed record AnnouncementCollectionStatus(bool Enabled, int DailyRequestLimit, int RequestsToday, int ExtractedCount, int FailedCount);
public sealed record CollectionStatus(bool Enabled, int IntervalHours, string? LastAttemptAt, int PendingReviewCount, int AutomaticallyDiscoveredCount)
{
    public SourceCheck[] Sources { get; init; } = [];
    public AnnouncementCollectionStatus? MetaExtraction { get; init; }
}
public sealed class DiscoveryFeed(DiscoveryCatalog catalog, MySqlStateStore store, IConfiguration configuration)
{
    private static string Instant(DateTime value) => new DateTimeOffset(DateTime.SpecifyKind(value, DateTimeKind.Utc)).ToString("O");
    public async Task<ListingSummary[]> Listings(CancellationToken ct)
    {
        var items = catalog.Listings().ToList();
        await using var db = await store.Open(ct);
        await using var query = new MySqlCommand("SELECT d.payload,d.first_seen_at,d.checked_at,p.result,p.checked_at FROM discovered_listings d LEFT JOIN source_pages p ON p.url_hash=d.page_hash ORDER BY d.first_seen_at DESC,d.id", db);
        await using var rows = await query.ExecuteReaderAsync(ct);
        while (await rows.ReadAsync(ct)) {
            var item = JsonSerializer.Deserialize<ListingSummary>(rows.GetString(0), Wire.Json)!;
            var checkedAt = rows.GetDateTime(2);
            var fresh = !rows.IsDBNull(3) && rows.GetString(3) == "checked" && !rows.IsDBNull(4) && rows.GetDateTime(4) == checkedAt && DateTime.UtcNow - checkedAt <= TimeSpan.FromDays(7);
            var current = item with { FirstSeenAt = Instant(rows.GetDateTime(1)), LastCheckedAt = Instant(checkedAt), SourceFreshness = fresh ? "current" : "stale", AvailabilityState = item.AvailabilityState == "cancelled" ? "cancelled" : ContractTime.IsInstant(item.EventEndAt) && DateTimeOffset.Parse(item.EventEndAt!) < DateTimeOffset.UtcNow ? "ended" : "unknown" };
            var existing = items.FindIndex(old => SameUrl(old.OfficialUrl, item.OfficialUrl));
            if (existing >= 0) {
                // Curated content remains authoritative; automatic observations only describe freshness.
                items[existing] = items[existing] with {
                    LastCheckedAt = current.LastCheckedAt,
                    SourceFreshness = current.SourceFreshness
                };
            } else items.Add(current);
        }
        return items.ToArray();
    }
    private static bool SameUrl(string a, string b) => new Uri(a).GetLeftPart(UriPartial.Path).TrimEnd('/') == new Uri(b).GetLeftPart(UriPartial.Path).TrimEnd('/') && new Uri(a).Query == new Uri(b).Query;
    public async Task<CollectionStatus> Status(CancellationToken ct)
    {
        await using var db = await store.Open(ct);
        var checks = new List<SourceCheck>();
        await using (var runs = new MySqlCommand("SELECT source_id,checked_at,result,candidate_count FROM source_runs ORDER BY source_id", db)) {
            await using var rows = await runs.ExecuteReaderAsync(ct);
            var ids = catalog.Sources().Select(s => s.Id).ToHashSet(StringComparer.Ordinal);
            while (await rows.ReadAsync(ct)) if (ids.Contains(rows.GetString(0))) checks.Add(new(rows.GetString(0), Instant(rows.GetDateTime(1)), rows.GetString(2), rows.GetInt32(3)));
        }
        await using var query = new MySqlCommand("SELECT (SELECT COUNT(*) FROM intake_candidates WHERE state='pending_review'),(SELECT COUNT(*) FROM discovered_listings)", db);
        await using var row = await query.ExecuteReaderAsync(ct); await row.ReadAsync(ct);
        var pending = row.GetInt32(0); var discovered = row.GetInt32(1); await row.DisposeAsync();
        await using var stats = new MySqlCommand("SELECT COALESCE(SUM(created_at>=UTC_DATE()),0),COALESCE(SUM(outcome='extracted_unreviewed'),0),COALESCE(SUM(outcome IN ('timeout','provider_unavailable','invalid_model_output')),0) FROM announcement_extractions", db);
        await using var counts = await stats.ExecuteReaderAsync(ct); await counts.ReadAsync(ct);
        var meta = new AnnouncementCollectionStatus(configuration.GetValue<bool>("SourceCollection:MetaExtraction:Enabled"), Math.Clamp(configuration.GetValue("SourceCollection:MetaExtraction:MaxDailyRequests", 3), 0, 30), counts.GetInt32(0), counts.GetInt32(1), counts.GetInt32(2));
        return new(configuration.GetValue<bool>("SourceCollection:Enabled"), Math.Clamp(configuration.GetValue("SourceCollection:IntervalHours", 12), 1, 168), checks.Select(c => c.LastAttemptAt).OrderDescending(StringComparer.Ordinal).FirstOrDefault(), pending, discovered) { Sources = checks.ToArray(), MetaExtraction = meta };
    }
    internal async Task StorePage(SourceRegistration source, Uri page, SourcePage result, ListingSummary[] listings, CancellationToken ct)
    {
        await using var db = await store.Open(ct); await using var tx = await db.BeginTransactionAsync(ct); var now = DateTime.UtcNow;
        var pageHash = MySqlStateStore.Hash(page.AbsoluteUri);
        await using var observation = new MySqlCommand("INSERT INTO source_pages(url_hash,source_id,url,attempted_at,checked_at,result,content_hash) VALUES(@id,@source,@url,@now,@checked,@result,@hash) ON DUPLICATE KEY UPDATE attempted_at=@now,checked_at=COALESCE(@checked,checked_at),result=@result,content_hash=COALESCE(@hash,content_hash)", db, tx);
        observation.Parameters.AddWithValue("@id", pageHash); observation.Parameters.AddWithValue("@source", source.Id); observation.Parameters.AddWithValue("@url", page.AbsoluteUri); observation.Parameters.AddWithValue("@now", now); observation.Parameters.AddWithValue("@checked", result.Html is null ? DBNull.Value : now); observation.Parameters.AddWithValue("@result", result.State); observation.Parameters.AddWithValue("@hash", result.Html is null ? DBNull.Value : MySqlStateStore.Hash(result.Html)); await observation.ExecuteNonQueryAsync(ct);
        foreach (var listing in listings) {
            await using var insert = new MySqlCommand("INSERT INTO discovered_listings(id,url_hash,source_id,page_hash,payload,first_seen_at,checked_at) VALUES(@id,@url,@source,@page,@payload,@now,@now) ON DUPLICATE KEY UPDATE payload=@payload,page_hash=@page,checked_at=@now", db, tx);
            insert.Parameters.AddWithValue("@id", listing.Id); insert.Parameters.AddWithValue("@url", MySqlStateStore.Hash(listing.OfficialUrl)); insert.Parameters.AddWithValue("@source", source.Id); insert.Parameters.AddWithValue("@page", pageHash); insert.Parameters.AddWithValue("@payload", JsonSerializer.Serialize(listing, Wire.Json)); insert.Parameters.AddWithValue("@now", now); await insert.ExecuteNonQueryAsync(ct);
            await using var candidate = new MySqlCommand("UPDATE intake_candidates SET state='structured_source' WHERE id=@id AND source_id=@source", db, tx); candidate.Parameters.AddWithValue("@id", MySqlStateStore.Hash(listing.OfficialUrl)); candidate.Parameters.AddWithValue("@source", source.Id); await candidate.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
    }
}
