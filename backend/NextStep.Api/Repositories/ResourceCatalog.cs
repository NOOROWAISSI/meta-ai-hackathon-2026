using System.Text.RegularExpressions;
using System.Text.Json;

namespace NextStep.Api;

public sealed record LearningResource(string Id, string Title, string Url, string RelevanceNote, string Status, string CheckedAt);
public sealed record ReviewedResourceLink(string OpportunityId, string ListingId, string RelevanceNote, string ReviewedAt);
public sealed class ResourceCatalog(DiscoveryCatalog discovery)
{
    public LearningResource[] For(Opportunity opportunity) {
        var theme = opportunity.Theme + " " + string.Join(" ", opportunity.InterestTags.Select(tag => tag.Label));
        var path = Path.Combine(AppContext.BaseDirectory, "Data", "resource-links.json");
        var links = File.Exists(path) ? JsonSerializer.Deserialize<ReviewedResourceLink[]>(File.ReadAllText(path), Wire.Json) ?? [] : [];
        var reviewedLinks = links.Where(link => link.OpportunityId == opportunity.Id && ContractTime.IsInstant(link.ReviewedAt) && !string.IsNullOrWhiteSpace(link.RelevanceNote)).ToArray();
        return discovery.Listings().Where(item => item.Kind == "course" && item.SourceStatus == "reviewed" && Input.Url(item.OfficialUrl) && !string.IsNullOrWhiteSpace(item.SourcePassage) && ContractTime.IsInstant(item.LastReviewedAt) && (reviewedLinks.Any(link => link.ListingId == item.Id) || item.Topics.Any(topic => Regex.IsMatch(theme, "(?<![A-Za-z])" + Regex.Escape(topic) + "(?![A-Za-z])", RegexOptions.IgnoreCase))))
            .Select(item => {
                var link = reviewedLinks.FirstOrDefault(link => link.ListingId == item.Id);
                var checkedAt = link is not null && DateTimeOffset.Parse(link.ReviewedAt) < DateTimeOffset.Parse(item.LastReviewedAt!) ? link.ReviewedAt : item.LastReviewedAt!;
                return new LearningResource("resource-" + item.Id, item.Title, item.OfficialUrl, (link?.RelevanceNote ?? item.Summary) + " Optional learning resource; not an organizer requirement. Price, certificates and personal suitability are separate checks.", DateTimeOffset.Parse(checkedAt) >= DateTimeOffset.UtcNow.AddDays(-90) ? "reviewed" : "stale", checkedAt);
            }).ToArray();
    }
}
