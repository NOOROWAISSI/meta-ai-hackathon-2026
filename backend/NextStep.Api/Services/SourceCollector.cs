using System.Net;
using System.Text.RegularExpressions;
using MySqlConnector;

namespace NextStep.Api;

/// <summary>Bounded official-source discovery, shared by the scheduler and explicit CLI runs.</summary>
public sealed class SourceCollector(DiscoveryCatalog catalog, MySqlStateStore store, IOfficialPageReader pages, DiscoveryFeed feed, IConfiguration configuration, ILogger<SourceCollector> logger, AnnouncementIntake announcements)
{
    private static readonly Regex Links = new("<a\\b[^>]*href\\s*=\\s*[\"'](?<url>[^\"']+)[\"'][^>]*>(?<text>.*?)</a>", RegexOptions.IgnoreCase | RegexOptions.Singleline, TimeSpan.FromSeconds(1));
    private static readonly Regex Tags = new("<[^>]+>", RegexOptions.Singleline, TimeSpan.FromSeconds(1));
    private static readonly Regex Interesting = new("course|training|workshop|hackathon|competition|event|دورة|تدريب|ورشة|مسابقة|هاكاثون", RegexOptions.IgnoreCase, TimeSpan.FromSeconds(1));
    public Task Collect(CancellationToken ct) => CollectDue(true, ct);
    public Task CollectDue(bool force, CancellationToken ct) => CollectSources(catalog.Sources(), force, ct);
    internal async Task<bool> CollectSources(SourceRegistration[] sources, bool force, CancellationToken ct)
    {
        await using var gate = await store.Open(ct);
        await using var acquire = new MySqlCommand("SELECT GET_LOCK('nextstep:source-collection:v1',0)", gate);
        if (Convert.ToInt32(await acquire.ExecuteScalarAsync(ct)) != 1) return false;
        try {
            var ordered = await OldestFirst(sources, ct);
            var processed = 0;
            foreach (var source in ordered) {
                ct.ThrowIfCancellationRequested();
                if (!force && !await IsDue(source.Id, ct)) continue;
                if (processed++ >= Math.Clamp(configuration.GetValue("SourceCollection:MaxSourcesPerSweep", 12), 1, 100)) break;
                if (source.Collection != "public_html") { await Save(source.Id, [], "manual_review_required", null, ct); continue; }
                var root = new Uri(source.Url); var result = await pages.Read(root, ct);
                List<(string Url, string Title)> links = result.Html is null ? [] : CandidateLinks(result.Html, root);
                await Save(source.Id, links, result.State, result.Html is null ? null : MySqlStateStore.Hash(result.Html), ct);
                await Capture(source, root, result, ct);
                var known = await KnownPages(source.Id, ct);
                var maximum = Math.Clamp(configuration.GetValue("SourceCollection:MaxPagesPerSource", 4), 1, 10);
                var existing = known.Where(url => url != root.AbsoluteUri).ToArray();
                foreach (var url in existing.Take((maximum - 1) / 2).Concat(links.Select(link => link.Url).Where(url => !known.Contains(url))).Concat(existing.Skip((maximum - 1) / 2)).Distinct(StringComparer.Ordinal).Where(url => url != root.AbsoluteUri).Take(maximum - 1)) {
                    await Task.Delay(500, ct);
                    var page = new Uri(url);
                    if (StructuredOpportunityReader.CanonicalUrl(url, root) is null) continue;
                    await Capture(source, page, await pages.Read(page, ct), ct);
                }
                logger.LogInformation("Source {Source}: {State}; {Count} candidate links", source.Id, result.State, links.Count);
            }
        } finally {
            await using var release = new MySqlCommand("SELECT RELEASE_LOCK('nextstep:source-collection:v1')", gate);
            await release.ExecuteScalarAsync(CancellationToken.None);
        }
        return true;
    }
    private async Task Capture(SourceRegistration source, Uri page, SourcePage result, CancellationToken ct)
    {
        ListingSummary[] listings = [];
        if (result.Html is not null) try {
                listings = StructuredOpportunityReader.Read(result.Html, page, source).Concat(GoogleCourseCatalogReader.Read(result.Html, page, source)).DistinctBy(item => item.OfficialUrl).ToArray();
                if (listings.Length == 0 && page.AbsoluteUri != new Uri(source.Url).AbsoluteUri) listings = await announcements.Read(source, page, result.Html, ct);
                listings = listings.Select(item => item with { UniversityId = source.UniversityId }).ToArray();
            }
            catch (RegexMatchTimeoutException) { result = new("parse_limit", null); }
        await feed.StorePage(source, page, result, listings, ct);
    }
    private async Task<SourceRegistration[]> OldestFirst(SourceRegistration[] sources, CancellationToken ct) {
        var checkedAt = new Dictionary<string, DateTime>(StringComparer.Ordinal);
        await using var db = await store.Open(ct);
        await using var query = new MySqlCommand("SELECT source_id,checked_at FROM source_runs", db);
        await using var rows = await query.ExecuteReaderAsync(ct);
        while (await rows.ReadAsync(ct)) checkedAt[rows.GetString(0)] = rows.GetDateTime(1);
        return sources.OrderBy(s => checkedAt.GetValueOrDefault(s.Id, DateTime.MinValue)).ThenBy(s => s.Id, StringComparer.Ordinal).ToArray();
    }
    public static List<(string Url, string Title)> CandidateLinks(string html, Uri address)
    {
        var links = new List<(string Url, string Title)>();
        try {
            foreach (Match match in Links.Matches(html)) {
                var label = WebUtility.HtmlDecode(Tags.Replace(match.Groups["text"].Value, " ")).Trim();
                var url = StructuredOpportunityReader.CanonicalUrl(match.Groups["url"].Value, address);
                if (url is null || label.Length < 4 || !Interesting.IsMatch(label + " " + url) || links.Any(link => link.Url == url)) continue;
                links.Add((url, label.Length <= 300 ? label : label[..300])); if (links.Count == 100) break;
            }
        } catch (RegexMatchTimeoutException) { }
        return links;
    }
    private async Task<bool> IsDue(string source, CancellationToken ct)
    {
        await using var db = await store.Open(ct);
        await using var query = new MySqlCommand("SELECT checked_at,result FROM source_runs WHERE source_id=@id", db); query.Parameters.AddWithValue("@id", source);
        await using var row = await query.ExecuteReaderAsync(ct); if (!await row.ReadAsync(ct)) return true;
        var hours = row.GetString(1) is "checked" or "manual_review_required" ? Math.Clamp(configuration.GetValue("SourceCollection:IntervalHours", 12), 1, 168) : 1;
        return DateTime.UtcNow - row.GetDateTime(0) >= TimeSpan.FromHours(hours);
    }
    private async Task<string[]> KnownPages(string source, CancellationToken ct)
    {
        await using var db = await store.Open(ct);
        await using var query = new MySqlCommand("SELECT url FROM source_pages WHERE source_id=@id ORDER BY attempted_at,url_hash LIMIT 20", db); query.Parameters.AddWithValue("@id", source);
        var urls = new List<string>(); await using var rows = await query.ExecuteReaderAsync(ct); while (await rows.ReadAsync(ct)) urls.Add(rows.GetString(0)); return urls.ToArray();
    }
    internal async Task Save(string id, List<(string Url, string Title)> links, string state, string? hash, CancellationToken ct)
    {
        await using var db = await store.Open(ct); await using var tx = await db.BeginTransactionAsync(ct); var now = DateTime.UtcNow;
        await using var run = new MySqlCommand("INSERT INTO source_runs(source_id,checked_at,result,candidate_count,content_hash) VALUES(@id,@now,@state,@count,@hash) ON DUPLICATE KEY UPDATE checked_at=@now,result=@state,candidate_count=@count,content_hash=@hash", db, tx);
        run.Parameters.AddWithValue("@id", id); run.Parameters.AddWithValue("@now", now); run.Parameters.AddWithValue("@state", state); run.Parameters.AddWithValue("@count", links.Count); run.Parameters.AddWithValue("@hash", (object?)hash ?? DBNull.Value); await run.ExecuteNonQueryAsync(ct);
        foreach (var link in links) {
            await using var insert = new MySqlCommand("INSERT INTO intake_candidates(id,source_id,url,title_hint,first_seen_at,last_seen_at) VALUES(@id,@source,@url,@title,@now,@now) ON DUPLICATE KEY UPDATE last_seen_at=@now,title_hint=@title", db, tx);
            insert.Parameters.AddWithValue("@id", MySqlStateStore.Hash(link.Url)); insert.Parameters.AddWithValue("@source", id); insert.Parameters.AddWithValue("@url", link.Url); insert.Parameters.AddWithValue("@title", link.Title); insert.Parameters.AddWithValue("@now", now); await insert.ExecuteNonQueryAsync(ct);
        }
        await tx.CommitAsync(ct);
    }
}
