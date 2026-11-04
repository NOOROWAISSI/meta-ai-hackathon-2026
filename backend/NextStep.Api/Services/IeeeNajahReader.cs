using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace NextStep.Api;

public static class IeeeNajahReader {
    public static CampusActivity[] Read(string json, Uri page, SourceRegistration source) {
        if (page.Host != "ieeennu.com" || page.AbsolutePath != "/api/events/approved" || source.OrganizationId != "ieee-najah" || source.UniversityId != "najah") return [];
        try {
            using var document = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 16 });
            var entries = document.RootElement;
            if (entries.ValueKind == JsonValueKind.Object && entries.TryGetProperty("events", out var events)) entries = events;
            if (entries.ValueKind != JsonValueKind.Array) return [];
            var result = new List<CampusActivity>();
            foreach (var item in entries.EnumerateArray().Take(100)) {
                if (item.GetProperty("status").GetString() != "APPROVED" || !item.GetProperty("id").TryGetInt32(out var id) || id <= 0) continue;
                var title = item.GetProperty("title").GetString() ?? "";
                var description = AnnouncementIntake.PageText(item.GetProperty("description").GetString() ?? "");
                if (title.Length is < 4 or > 300 || description.Length < 20) continue;
                var date = item.TryGetProperty("event_date", out var value) && value.ValueKind == JsonValueKind.String && DateTimeOffset.TryParse(value.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.None, out var when) ? when.ToString("yyyy-MM-dd") : null;
                var report = item.TryGetProperty("report_text", out var text) && text.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(text.GetString());
                var kind = Regex.IsMatch(title, "course|bootcamp|training", RegexOptions.IgnoreCase) ? "training" : Regex.IsMatch(title, "contest|competition|challenge|jam", RegexOptions.IgnoreCase) ? "competition" : Regex.IsMatch(title, "workshop|session", RegexOptions.IgnoreCase) ? "workshop" : "community_update";
                var now = DateTimeOffset.UtcNow.ToString("O");
                result.Add(new("ieee-najah-event-" + id, ["najah"], ["ieee-najah"], title, description.Length > 650 ? description[..650] : description, "https://ieeennu.com/activity-details?id=" + id, page.AbsoluteUri, "official_website", kind, null, date, report ? "ended" : "unknown", title, "primary_source", now) { OrganizerName = "IEEE An-Najah Student Branch", PostType = report ? "recap" : "announcement" });
            }
            return result.ToArray();
        } catch (Exception e) when (e is JsonException or KeyNotFoundException or InvalidOperationException or FormatException) { return []; }
    }
}
