using NextStep.MetaAi;
using NextStep.MetaAi.Application;

namespace NextStep.Api;

// Application-owned projection. The provider candidate and canonical Plan stay unchanged.
public sealed record CoverageReport(string[] ReviewedOutstandingMandatoryRequirementIds, string[] CandidateRequirementIds, string[] RetainedRequirementIds, string[] UnrepresentedRequirementIds, string SourceCoverage);
public sealed record SubmissionCoverageView(AssessmentContext Context, int? PlanVersion, string? CandidateId, bool PlanOutdated, CoverageReport Report, string[] UnresolvedRequirementIds);

public static class SubmissionReconciliation
{
    public static PreparationTask[] Retain(Plan? plan) => plan?.Tasks.Where(t => t.Status != "not_started" || t.ArtifactUrls.Length > 0).ToArray() ?? [];

    public static SubmissionCoverageView Assess(Opportunity opportunity, StudentProfile profile, SubmissionState submission, Plan? plan, IReadOnlyList<CandidateTask> candidateTasks, IReadOnlyList<PreparationTask> retained, string? candidateId = null)
    {
        var analysis = Matching.Analyze(opportunity, profile, submission, DateTimeOffset.UtcNow);
        var mandatory = opportunity.Requirements.Where(r => r.Lane == "submission" && r.IsMandatory).ToArray();
        bool Reviewed(Rule rule) => Catalog.Reviewed(opportunity, rule) && Matching.Applies(rule, profile) == true && rule.Evaluation["key"]?.GetValue<string>() != "unresolved" && analysis.Matches.Single(m => m.RequirementId == rule.Id).ReasonCode is not ("insufficient_source" or "stale_source" or "conflicting_claims");
        var outstanding = mandatory.Where(r => Reviewed(r) && analysis.Matches.Single(m => m.RequirementId == r.Id).Status is not ("supported" or "not_applicable")).Select(r => new ReviewedRequirement(r.Id, r.Statement, r.Lane, true, true)).ToArray();
        var unresolved = mandatory.Where(r => Matching.Applies(r, profile) != false && !Reviewed(r)).Select(r => r.Id).ToArray();
        var coverage = opportunity.SourceCoverage.Submission;
        var boundary = coverage.State == "incomplete" ? SubmissionSourceCoverage.Incomplete : SubmissionSourceCoverage.Unknown;
        // Source completeness is independent of whether the student's criteria are satisfied.
        if (coverage.State == "complete" && opportunity.InformationFreshness != "stale" && DateTimeOffset.TryParse(coverage.ReviewedAt, out var checkedAt) && checkedAt <= DateTimeOffset.UtcNow && coverage.MissingChecks.Length == 0 && mandatory.Length > 0 && mandatory.All(r => coverage.ReviewedRequirementIds.Contains(r.Id) && Catalog.Reviewed(opportunity, r))) boundary = SubmissionSourceCoverage.Complete;
        var report = SubmissionCoverage.Reconcile(outstanding, candidateTasks, retained.Select(t => new ExistingPlanTask(t.Id, t.Title, t.Status, t.Target)).ToArray(), boundary);
        var context = Matching.Context(opportunity, profile, submission);
        return new(context, plan?.Version, candidateId, plan is not null && plan.Context != context, new(report.ReviewedOutstandingMandatoryRequirementIds.ToArray(), report.CandidateRequirementIds.ToArray(), report.RetainedRequirementIds.ToArray(), report.UnrepresentedRequirementIds.ToArray(), report.SourceCoverage.ToString().ToLowerInvariant()), unresolved);
    }
}
