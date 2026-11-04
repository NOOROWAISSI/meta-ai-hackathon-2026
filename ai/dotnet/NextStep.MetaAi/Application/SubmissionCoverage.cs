namespace NextStep.MetaAi.Application;

// Caller-owned assessment of submission requirement sources, never inferred from tasks.
public enum SubmissionSourceCoverage { Unknown, Incomplete, Complete }

// Representation of the supplied reviewed outstanding set only. Even an empty
// UnrepresentedRequirementIds list is not a submission or compliance verdict.
public sealed record SubmissionCoverageReport(
    IReadOnlyList<string> ReviewedOutstandingMandatoryRequirementIds,
    IReadOnlyList<string> CandidateRequirementIds,
    IReadOnlyList<string> RetainedRequirementIds,
    IReadOnlyList<string> UnrepresentedRequirementIds,
    SubmissionSourceCoverage SourceCoverage);

public static class SubmissionCoverage
{
    // Optional, pure orchestration helper. The application determines outstanding
    // requirements from evidence and passes ONLY tasks that will survive acceptance.
    // Candidate tasks must already have passed GenerationPolicy.ValidateCandidate.
    // Task status and all prose are deliberately irrelevant to representation.
    public static SubmissionCoverageReport Reconcile(
        IReadOnlyList<ReviewedRequirement> reviewedOutstandingMandatoryRequirements,
        IReadOnlyList<CandidateTask> validatedCandidateTasks,
        IReadOnlyList<ExistingPlanTask> explicitlyRetainedTasks,
        SubmissionSourceCoverage sourceCoverage = SubmissionSourceCoverage.Unknown)
    {
        if (reviewedOutstandingMandatoryRequirements is null || validatedCandidateTasks is null ||
            explicitlyRetainedTasks is null || !Enum.IsDefined(sourceCoverage) ||
            reviewedOutstandingMandatoryRequirements.Any(r => r is null || !Id(r.Id) ||
                r.Lane != "submission" || r.Applies != true || !r.IsMandatory) ||
            validatedCandidateTasks.Any(t => t is null || !ValidTarget(t.Target)) ||
            explicitlyRetainedTasks.Any(t => t is null || !Id(t.Id) || !ValidTarget(t.Target)))
            throw new MetaAiException("invalid_input", "Invalid submission coverage input.");

        var reviewed = reviewedOutstandingMandatoryRequirements.Select(r => r.Id).ToHashSet(StringComparer.Ordinal);
        var candidate = Represented(reviewed, validatedCandidateTasks.Select(t => t.Target));
        var retained = Represented(reviewed, explicitlyRetainedTasks.Select(t => t.Target));
        var unrepresented = reviewed.Except(candidate, StringComparer.Ordinal).Except(retained, StringComparer.Ordinal);
        return new(Snapshot(reviewed), Snapshot(candidate), Snapshot(retained), Snapshot(unrepresented), sourceCoverage);
    }

    private static HashSet<string> Represented(HashSet<string> reviewed, IEnumerable<TaskTarget> targets) =>
        targets.Where(t => t.Kind == "requirement" && reviewed.Contains(t.RequirementId!))
            .Select(t => t.RequirementId!).ToHashSet(StringComparer.Ordinal);

    private static IReadOnlyList<string> Snapshot(IEnumerable<string> ids) =>
        Array.AsReadOnly(ids.OrderBy(id => id, StringComparer.Ordinal).ToArray());

    private static bool Id(string? id) => !string.IsNullOrWhiteSpace(id) && id.Length <= 200;
    private static bool ValidTarget(TaskTarget? target) => target is not null && target.Kind switch
    {
        "goal" => Id(target.GoalId) && target.RequirementId is null,
        "requirement" => Id(target.RequirementId) && target.GoalId is null,
        _ => false
    };
}
