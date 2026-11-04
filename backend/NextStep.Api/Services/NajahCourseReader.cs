using System.Net;
using System.Text.RegularExpressions;

namespace NextStep.Api;

// Public catalog links use onclick instead of anchors. Only the registered university host is supported.
public static class NajahCourseReader {
    public static bool IsTechTitle(string title) => Regex.IsMatch(title, @"\bAI\b|Python|programming|digital|الذكاء الاصطناعي|ذكاء اصطناعي|الرقمي|الرقمية|برمجة|بايثون|سيبراني", RegexOptions.IgnoreCase);
    private static Match Match(string text, string pattern) => Regex.Match(text, pattern, RegexOptions.Singleline | RegexOptions.IgnoreCase, TimeSpan.FromSeconds(1));
    public static List<(string Url, string Title)> Links(string html, Uri page) {
        if (page.Host != "www.najah.ai" || page.AbsolutePath != "/Courses") return [];
        var result = new List<(string, string)>();
        foreach (Match card in Regex.Matches(html, "onclick=\"window.location.href='(?<url>/Courses/Details/\\d+\\?EnrollTeacherCourseId=\\d+)'\"(?<body>.*?)(?=onclick=\"window.location.href=|$)", RegexOptions.Singleline, TimeSpan.FromSeconds(1))) {
            var title = AnnouncementIntake.PageText(Match(card.Groups["body"].Value, @"<h5\b[^>]*>(.*?)</h5>").Groups[1].Value);
            var url = StructuredOpportunityReader.CanonicalUrl(card.Groups["url"].Value, page);
            if (url is not null && title.Length is >= 4 and <= 300 && IsTechTitle(title)) result.Add((url, title));
        }
        return result.DistinctBy(p => p.Item2).Take(40).ToList();
    }
    public static ListingSummary[] Read(string html, Uri page, SourceRegistration source) {
        if (page.Host != "www.najah.ai" || source.Id != "najah-academy-live" || !Regex.IsMatch(page.AbsolutePath, @"^/Courses/Details/\d+$")) return [];
        var title = AnnouncementIntake.PageText(Match(html, @"<h1\b[^>]*>(.*?)</h1>").Groups[1].Value);
        var description = AnnouncementIntake.PageText(Match(html, @"<h3[^>]*>\s*Description\s*</h3>\s*<div[^>]*>(.*?)</div>").Groups[1].Value);
        var controls = Match(html, "<div class=\"enrollment-controls\">(.*?)(?:<div class=\"modal|</main>)").Groups[1].Value;
        var closed = Match(controls, @"<button\b[^>]*\bdisabled[^>]*>\s*The Course is Completed\s*</button>").Success;
        var enroll = Match(controls, @"<a\b[^>]*href=""/Authentication/Login\?returnUrl=[^""]+""[^>]*>\s*Enroll now\s*</a>").Success;
        if (title.Length is < 4 or > 300 || !IsTechTitle(title) || description.Length < 20 || (!closed && !enroll)) return [];
        var now = DateTimeOffset.UtcNow.ToString("O");
        var topics = Regex.IsMatch(title + " " + description, @"\bAI\b|artificial intelligence|الذكاء الاصطناعي|ذكاء اصطناعي", RegexOptions.IgnoreCase) ? new[] { "AI" } : new[] { "Digital skills" };
        return [new("najah-course-" + MySqlStateStore.Hash(page.AbsoluteUri)[..20], "course", title, "أكاديمية النجاح — جامعة النجاح الوطنية", "unknown", page.AbsoluteUri, description.Length > 650 ? description[..650] : description, topics, "palestine", null, closed ? "closed" : "open", "unknown", now, "needs_verification", closed ? "The Course is Completed" : "Enroll now", "Enrollment control read on the official platform. An enrollment link does not establish admission, prerequisites, schedule, or personal eligibility. No deadline inferred.") { UniversityId = "najah", UniversityIds = ["najah"], OrganizationId = "university-najah", AvailabilityState = closed ? "ended" : "unknown", DiscoveryState = closed ? "archived" : "current", AvailabilityCheckedAt = now, SourcePageUrl = page.AbsoluteUri, SourceFreshness = "current", LastCheckedAt = now, FirstSeenAt = now, ExtractionMethod = "najah_course_page" }];
    }
}
