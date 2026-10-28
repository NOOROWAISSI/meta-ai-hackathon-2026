using System.Globalization;
using System.Text.Json;

namespace NextStep.Api;

public sealed class Catalog
{
    private readonly Opportunity[] _events;
    public Catalog()
    {
        var json = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Data", "catalog.json"));
        _events = JsonSerializer.Deserialize<Opportunity[]>(json, Wire.Json) ?? [];
        Input.Require(_events.Length == 5 && _events.Select(o => o.Id).Distinct().Count() == 5, "Five canonical event records are required.");
        foreach (var opportunity in _events)
        {
            Input.Require(opportunity.Requirements.Select(r => r.Id).Distinct().Count() == opportunity.Requirements.Length);
            Input.Require(opportunity.SourceEvidence.Select(e => e.Id).Distinct().Count() == opportunity.SourceEvidence.Length);
            foreach (var rule in opportunity.Requirements)
                Input.Require(rule.SourceEvidenceIds.Concat(rule.Claims.SelectMany(c => c.EvidenceIds)).All(id => opportunity.SourceEvidence.Any(e => e.Id == id)), "Dangling source evidence reference.");
        }
    }
    public Opportunity Get(string id) => Wire.Copy(_events.FirstOrDefault(o => o.Id == id) ?? throw new ApiFault("not_found", "This opportunity is unavailable."));
    public Opportunity[] All() => Wire.Copy(_events);
    public static bool Reviewed(Opportunity o, Rule rule) => o.InformationFreshness != "stale" && rule.SourceStatus == "reviewed" && rule.SourceEvidenceIds.Length > 0 && rule.SourceEvidenceIds.All(id => o.SourceEvidence.Any(e => e.Id == id && e.Status == "reviewed" && !string.IsNullOrWhiteSpace(e.Passage) && Input.Url(e.SourceUrl) && DateTimeOffset.TryParse(e.CheckedAt, out _)));
    public static DateTimeOffset? Instant(Opportunity opportunity, string kind)
    {
        var events = opportunity.TimelineEvents.Where(t => t.Kind == kind).ToArray();
        if (events.Length != 1 || events[0].SourceStatus != "reviewed" || events[0].Claims.Length != 1 || opportunity.InformationFreshness == "stale") return null;
        var claim = events[0].Claims[0];
        if (claim.DateTime is null || !System.Text.RegularExpressions.Regex.IsMatch(claim.DateTime, @"(?:Z|[+-]\d{2}:\d{2})$") || claim.EvidenceIds.Length == 0 || !claim.EvidenceIds.All(id => opportunity.SourceEvidence.Any(e => e.Id == id && e.Status == "reviewed" && !string.IsNullOrWhiteSpace(e.Passage) && DateTimeOffset.TryParse(e.CheckedAt, out _)))) return null;
        return DateTimeOffset.TryParse(claim.DateTime, CultureInfo.InvariantCulture, DateTimeStyles.None, out var result) ? result : null;
    }
    public static SubmissionState EmptySubmission(Opportunity opportunity) => new(opportunity.Id, 1, opportunity.Requirements.Where(r => r.Lane == "submission" && r.IsMandatory).Select(r => new SubmissionItem(r.Id, "unknown", [], "self_report")).ToArray());
}
