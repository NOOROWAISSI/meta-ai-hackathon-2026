using System.Text.Json;

namespace NextStep.Api;

public sealed class Catalog
{
    private readonly Opportunity[] _events;
    public Catalog()
    {
        var json = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Data", "catalog.json"));
        _events = JsonSerializer.Deserialize<Opportunity[]>(json, Wire.Json) ?? [];
        Input.Require(_events.All(o => Input.Id(o.Id)) && _events.Select(o => o.Id).Distinct().Count() == _events.Length, "Planning opportunity IDs must be unique and valid.");
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
    public static bool Reviewed(Opportunity o, Rule rule) => o.InformationFreshness != "stale" && rule.SourceStatus == "reviewed" && rule.SourceEvidenceIds.Length > 0 && rule.SourceEvidenceIds.All(id => o.SourceEvidence.Any(e => e.Id == id && e.Status == "reviewed" && !string.IsNullOrWhiteSpace(e.Passage) && Input.Url(e.SourceUrl) && ContractTime.IsInstant(e.CheckedAt)));
    public static NextStep.MetaAi.ReviewedDeliverable? ReviewedDeliverable(Opportunity o, Rule rule)
    {
        if (o.Id != "E02" || o.SourceRevision != "source-fixtures-v0.2-reviewed-2026-10-31-E02-a52835aa9759" ||
            rule.Id != "E02-s-video" || rule.Lane != "submission" || !rule.IsMandatory || !Reviewed(o, rule) ||
            !rule.SourceEvidenceIds.SequenceEqual(["ev-gai-video"]) ||
            !rule.Claims.Any(c => c.EvidenceIds.Contains("ev-gai-video", StringComparer.Ordinal))) return null;
        return new("video", ["record", "deliver"], o.SourceRevision, ["ev-gai-video"]);
    }
    public static DateTimeOffset? Instant(Opportunity opportunity, string kind)
    {
        var events = opportunity.TimelineEvents.Where(t => t.Kind == kind).ToArray();
        if (events.Length != 1 || events[0].SourceStatus != "reviewed" || events[0].Claims.Length != 1 || opportunity.InformationFreshness == "stale") return null;
        var claim = events[0].Claims[0];
        if (!ContractTime.TryInstant(claim.DateTime, out var instant) || claim.EvidenceIds.Length == 0 || !claim.EvidenceIds.All(id => opportunity.SourceEvidence.Any(e => e.Id == id && e.Status == "reviewed" && !string.IsNullOrWhiteSpace(e.Passage) && ContractTime.IsInstant(e.CheckedAt)))) return null;
        return instant;
    }
    public static SubmissionState EmptySubmission(Opportunity opportunity) => new(opportunity.Id, 1, opportunity.Requirements.Where(r => r.Lane == "submission" && r.IsMandatory).Select(r => new SubmissionItem(r.Id, "unknown", [], "self_report")).ToArray());
}
