using System.Text.Json;
using System.Text.RegularExpressions;

namespace NextStep.Api;

/// <summary>Reads event descriptions embedded in the publicly served chapter page, not private Bevy APIs.</summary>
public static class GdgCampusReader {
    public static CampusActivity[] Read(string html, Uri page, SourceRegistration source) {
        if (page.Host != "gdg.community.dev" || source.UniversityId is null || source.OrganizationId is null) return [];
        var match = Regex.Match(html, "<script[^>]*id=[\"']__NEXT_DATA__[\"'][^>]*>(?<json>.*?)</script>", RegexOptions.Singleline | RegexOptions.IgnoreCase, TimeSpan.FromSeconds(1));
        if (!match.Success) return [];
        try {
            using var data = JsonDocument.Parse(match.Groups["json"].Value, new JsonDocumentOptions { MaxDepth = 64 });
            var props = data.RootElement.GetProperty("props").GetProperty("pageProps");
            var chapter = props.GetProperty("chapterData");
            if (!Uri.TryCreate(chapter.GetProperty("url").GetString(), UriKind.Absolute, out var registered) || registered.Host != page.Host || registered.AbsolutePath.TrimEnd('/') != page.AbsolutePath.TrimEnd('/')) return [];
            var chapterId = chapter.GetProperty("id").GetInt32(); var prerender = props.GetProperty("prerenderData"); var result = new List<CampusActivity>();
            foreach (var (key, ended) in new[] { ("upcomingEvents", false), ("pastEvents", true) }) {
                if (!prerender.TryGetProperty(key, out var events) || !events.TryGetProperty("results", out var values) || values.ValueKind != JsonValueKind.Array) continue;
                foreach (var entry in values.EnumerateArray().Take(12)) {
                    if (!entry.TryGetProperty("chapter_id", out var owner) || owner.GetInt32() != chapterId) continue;
                    var url = StructuredOpportunityReader.CanonicalUrl(entry.GetProperty("url").GetString(), page); if (url is null || !new Uri(url).AbsolutePath.StartsWith("/events/details/", StringComparison.Ordinal)) continue;
                    var title = entry.GetProperty("title").GetString() ?? ""; var description = AnnouncementIntake.PageText(entry.GetProperty("description").GetString() ?? "");
                    if (title.Length is < 4 or > 300 || description.Length < 20) continue;
                    var kind = Regex.IsMatch(title, "info session|preparation session|جلسة تعريفية|جلسة تحضير", RegexOptions.IgnoreCase) ? "community_update" : Regex.IsMatch(title, "hackathon|هاكاثون", RegexOptions.IgnoreCase) ? "hackathon" : Regex.IsMatch(title, "bootcamp|training|تدريب", RegexOptions.IgnoreCase) ? "training" : Regex.IsMatch(title, "contest|competition|datathon|مسابقة", RegexOptions.IgnoreCase) ? "competition" : Regex.IsMatch(title, "workshop|ورشة", RegexOptions.IgnoreCase) ? "workshop" : "community_update";
                    var start = entry.TryGetProperty("start_date", out var date) && ContractTime.IsInstant(date.GetString()) ? date.GetString() : null;
                    var summary = description.Length > 500 ? description[..500] + "…" : description;
                    result.Add(new("campus-" + MySqlStateStore.Hash(url), [source.UniversityId], [source.OrganizationId], title, summary, url, page.AbsoluteUri, "official_website", kind, null, start, ended ? "ended" : "unknown", description.Length > 250 ? description[..250] : description, "primary_source", DateTimeOffset.UtcNow.ToString("O")));
                }
            }
            return result.DistinctBy(p => p.Id).ToArray();
        } catch (Exception error) when (error is JsonException or KeyNotFoundException or InvalidOperationException or FormatException) { return []; }
    }
}
