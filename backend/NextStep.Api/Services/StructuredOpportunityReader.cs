using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.WebUtilities;

namespace NextStep.Api;

// Discovery metadata only: never creates organizer rules, eligibility or reviewed planning resources.
public static class StructuredOpportunityReader
{
    private static readonly Regex Scripts = new("<script\\b(?<attrs>[^>]*)>(?<body>.*?)</script\\s*>", RegexOptions.IgnoreCase | RegexOptions.Singleline, TimeSpan.FromSeconds(1));
    private static readonly Regex JsonType = new("\\btype\\s*=\\s*[\"']application/ld\\+json[\"']", RegexOptions.IgnoreCase, TimeSpan.FromSeconds(1));
    private static readonly Regex Tags = new("<[^>]+>", RegexOptions.Singleline, TimeSpan.FromSeconds(1));
    private static readonly (string Topic, string Pattern)[] Topics = [("AI", @"\bAI\b|artificial intelligence|machine learning|ذكاء اصطناعي"), ("Data", @"\bdata\b|\bSQL\b|بيانات"), ("Programming", @"programming|coding|computer science|hackathon|برمجة|هاكاثون"), ("Web", @"\bweb\b|\bReact\b|ويب"), ("Python", @"\bpython\b|بايثون"), ("Cybersecurity", @"cybersecurity|cyber security|أمن سيبراني"), ("Robotics", @"robotics|روبوت")];
    public static string? CanonicalUrl(string? value, Uri page)
    {
        if (string.IsNullOrWhiteSpace(value) || !Uri.TryCreate(page, WebUtility.HtmlDecode(value), out var target) || target.Scheme != "https" || target.Host != page.Host || target.Port != page.Port || !string.IsNullOrEmpty(target.UserInfo)) return null;
        var query = QueryHelpers.ParseQuery(target.Query).Where(p => !p.Key.StartsWith("utm_", StringComparison.OrdinalIgnoreCase) && p.Key is not ("fbclid" or "gclid")).OrderBy(p => p.Key, StringComparer.Ordinal);
        var url = QueryHelpers.AddQueryString(target.GetLeftPart(UriPartial.Path), query);
        return url.Length <= 2000 ? url : null;
    }
    public static ListingSummary[] Read(string html, Uri page, SourceRegistration source)
    {
        var result = new List<ListingSummary>();
        var conflicts = new HashSet<string>(StringComparer.Ordinal);
        foreach (Match script in Scripts.Matches(html)) {
            if (!JsonType.IsMatch(script.Groups["attrs"].Value)) continue;
            try {
                using var document = JsonDocument.Parse(script.Groups["body"].Value, new JsonDocumentOptions { MaxDepth = 32 });
                foreach (var node in Walk(document.RootElement)) {
                    var listing = Convert(node, page, source);
                    if (listing is not null && !conflicts.Contains(listing.OfficialUrl)) {
                        var previous = result.SingleOrDefault(r => r.OfficialUrl == listing.OfficialUrl);
                        if (previous is not null && JsonSerializer.Serialize(previous, Wire.Json) != JsonSerializer.Serialize(listing, Wire.Json)) { result.Remove(previous); conflicts.Add(listing.OfficialUrl); }
                        else if (previous is null) result.Add(listing);
                    }
                    if (result.Count == 30) return result.ToArray();
                }
            } catch (JsonException) { /* A malformed block is not publishable; other valid blocks can still be read. */ }
        }
        return result.ToArray();
    }
    private static IEnumerable<JsonElement> Walk(JsonElement node)
    {
        if (node.ValueKind == JsonValueKind.Array) { foreach (var child in node.EnumerateArray()) foreach (var item in Walk(child)) yield return item; }
        if (node.ValueKind != JsonValueKind.Object) yield break;
        yield return node;
        foreach (var property in node.EnumerateObject()) if (property.Value.ValueKind is JsonValueKind.Object or JsonValueKind.Array) foreach (var item in Walk(property.Value)) yield return item;
    }
    private static string? Text(JsonElement node, string key) => node.ValueKind == JsonValueKind.Object && node.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
    private static JsonElement Child(JsonElement node, string key) => node.ValueKind == JsonValueKind.Object && node.TryGetProperty(key, out var value) ? value : default;
    private static string Clean(string value) => Regex.Replace(WebUtility.HtmlDecode(Tags.Replace(value, " ")), @"\s+", " ", RegexOptions.None, TimeSpan.FromMilliseconds(100)).Trim();
    private static string? Type(JsonElement node) => Text(node, "@type");
    private static ListingSummary? Convert(JsonElement node, Uri page, SourceRegistration source)
    {
        var type = Type(node); var title = Clean(Text(node, "name") ?? ""); var description = Clean(Text(node, "description") ?? "");
        if (type is not ("Course" or "Event" or "EducationEvent") || title.Length is < 4 or > 300 || description.Length is < 20 or > 12000) return null;
        var topics = Topics.Where(t => Regex.IsMatch(title + " " + description, t.Pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100))).Select(t => t.Topic).ToArray();
        if (topics.Length == 0) return null;
        var kind = type == "Course" ? "course" : Regex.IsMatch(title, "hackathon|هاكاثون", RegexOptions.IgnoreCase) ? "hackathon" : Regex.IsMatch(title, "workshop|ورشة", RegexOptions.IgnoreCase) ? "workshop" : Regex.IsMatch(title, "competition|مسابقة", RegexOptions.IgnoreCase) ? "competition" : null;
        if (kind is null) return null;
        var url = CanonicalUrl(Text(node, "url"), page); if (url is null) return null;
        var organizer = Clean(Text(Child(node, type == "Course" ? "provider" : "organizer"), "name") ?? "");
        if (organizer.Length is < 2 or > 200) return null; // Never substitute the listing host for the organizer.
        var mode = Text(node, "eventAttendanceMode"); var instance = Child(node, "hasCourseInstance");
        var courseMode = Text(instance, "courseMode") ?? Text(node, "courseMode");
        var format = mode?.EndsWith("MixedEventAttendanceMode", StringComparison.Ordinal) == true ? "hybrid" : mode?.EndsWith("OnlineEventAttendanceMode", StringComparison.Ordinal) == true || string.Equals(courseMode, "online", StringComparison.OrdinalIgnoreCase) ? "online" : mode?.EndsWith("OfflineEventAttendanceMode", StringComparison.Ordinal) == true ? "in_person" : "unknown";
        var address = Child(Child(node, "location"), "address"); var country = Text(address, "addressCountry") ?? Text(Child(address, "addressCountry"), "name");
        var palestine = country is "PS" or "PSE" or "Palestine" or "State of Palestine" or "فلسطين";
        if (format != "online" && !palestine) return null; // Geography must be explicit; a provider's address is not an event location.
        var status = Text(node, "eventStatus");
        var end = Text(node, "endDate"); var endAt = ContractTime.IsInstant(end) ? end : null;
        var start = Text(node, "startDate");
        var conflict = ContractTime.IsInstant(start) && endAt is not null && DateTimeOffset.Parse(start!) > DateTimeOffset.Parse(endAt);
        if (conflict) endAt = null;
        return new ListingSummary("auto-" + MySqlStateStore.Hash(url), kind, title, organizer, format, url, description.Length > 1500 ? description[..1500] : description, topics, format == "online" ? "global_online" : "palestine", null, "not_specified", "unknown", null, "needs_verification", description, "Automatically extracted from official-page structured data. Not a human review. Registration deadlines, costs and participation rules are not inferred." + (conflict ? $" Published event dates conflict: start {start}; end {end}. No timed event status inferred." : "")) {
            SourcePageUrl = page.AbsoluteUri, EventEndAt = endAt, AvailabilityState = status?.EndsWith("EventCancelled", StringComparison.Ordinal) == true ? "cancelled" : "unknown"
        };
    }
}
