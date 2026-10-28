using System.Text.RegularExpressions;

namespace NextStep.Api;

public sealed record LearningResource(string Id, string Title, string Url, string RelevanceNote, string Status, string CheckedAt);
public sealed class ResourceCatalog(DiscoveryCatalog discovery)
{
    public LearningResource[] For(Opportunity opportunity) {
        var theme = opportunity.Theme + " " + string.Join(" ", opportunity.InterestTags.Select(tag => tag.Label));
        return discovery.Listings().Where(item => item.Kind == "course" && item.SourceStatus == "reviewed" && !string.IsNullOrWhiteSpace(item.SourcePassage) && DateTimeOffset.TryParse(item.LastReviewedAt, out _) && item.Topics.Any(topic => Regex.IsMatch(theme, "(?<![A-Za-z])" + Regex.Escape(topic) + "(?![A-Za-z])", RegexOptions.IgnoreCase)))
            .Select(item => new LearningResource("resource-" + item.Id, item.Title, item.OfficialUrl, item.Summary + " Source identity/content reviewed; price, certificates and personal suitability are not inferred.", DateTimeOffset.Parse(item.LastReviewedAt!) >= DateTimeOffset.UtcNow.AddDays(-90) ? "reviewed" : "stale", item.LastReviewedAt!)).ToArray();
    }
}
