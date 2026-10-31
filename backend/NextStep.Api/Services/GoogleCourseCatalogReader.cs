using System.Net;
using System.Text.RegularExpressions;

namespace NextStep.Api;

// Adapter for one inspected official catalog, not a generic guess from arbitrary headings.
public static class GoogleCourseCatalogReader
{
    private static readonly Regex Sections = new("<h2\\b[^>]*id=[\"'](?<id>foundational-courses|advanced-courses)[\"'][^>]*>.*?</h2>(?<body>.*?)(?=<h2\\b|$)", RegexOptions.IgnoreCase | RegexOptions.Singleline, TimeSpan.FromSeconds(1));
    private static readonly Regex Cards = new("<h3\\b[^>]*>\\s*<a\\b[^>]*href=[\"'](?<url>[^\"']+)[\"'][^>]*>(?<title>.*?)</a>\\s*</h3>\\s*<div\\b[^>]*class=[\"']devsite-landing-row-item-description-content[\"'][^>]*>(?<description>.*?)</div>", RegexOptions.IgnoreCase | RegexOptions.Singleline, TimeSpan.FromSeconds(1));
    private static string Clean(string value) => Regex.Replace(WebUtility.HtmlDecode(Regex.Replace(value, "<[^>]+>", " ", RegexOptions.Singleline, TimeSpan.FromMilliseconds(100))), @"\s+", " ", RegexOptions.None, TimeSpan.FromMilliseconds(100)).Trim();
    public static ListingSummary[] Read(string html, Uri page, SourceRegistration source)
    {
        if (source.Id != "google-ml-catalog" || page.Scheme != "https" || page.Host != "developers.google.com" || page.AbsolutePath.TrimEnd('/') != "/machine-learning") return [];
        var items = new List<ListingSummary>();
        foreach (Match section in Sections.Matches(html)) foreach (Match card in Cards.Matches(section.Groups["body"].Value)) {
            var url = StructuredOpportunityReader.CanonicalUrl(card.Groups["url"].Value, page);
            var title = Clean(card.Groups["title"].Value); var description = Clean(card.Groups["description"].Value);
            if (url is null || !new Uri(url).AbsolutePath.StartsWith("/machine-learning/", StringComparison.Ordinal) || title.Length is < 4 or > 300 || description.Length is < 15 or > 1500 || items.Any(item => item.OfficialUrl == url)) continue;
            items.Add(new("auto-" + MySqlStateStore.Hash(url), "course", title, "Google", "unknown", url, description, ["AI", "Machine learning"], "global_online", null, "not_specified", "unknown", null, "needs_verification", title + ": " + description, "Automatically read from Google's official machine-learning course catalog. The catalog publishes this course title and description; registration, certificates, costs and participation format are not independently confirmed. This is not a human review.") { SourcePageUrl = page.AbsoluteUri });
            if (items.Count == 30) return items.ToArray();
        }
        return items.ToArray();
    }
}
