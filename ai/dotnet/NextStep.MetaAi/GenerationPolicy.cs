using System.Text.RegularExpressions;

namespace NextStep.MetaAi;

public static class GenerationPolicy
{
    private static readonly Regex Url = new(@"(?:://|\bwww\.|\b(?:javascript|data|mailto):)", RegexOptions.IgnoreCase);
    // Defense in depth, not a proof that arbitrary generated prose is grounded.
    private static readonly Regex Claim = new(
        @"\b\d{4}-\d{2}-\d{2}\b|\b(?:you|your team) (?:are|is) (?:not )?(?:eligible|ineligible|qualified|approved)\b|\byou have (?:won|earned|achieved)\b|\b(?:deadline|cutoff) (?:is|will be|has been) (?!unknown\b|unverified\b|not (?:known|verified)\b)", RegexOptions.IgnoreCase);
    private static bool Text(string? s, int max) => !string.IsNullOrWhiteSpace(s) && s.Length <= max;
    private static bool Id(string? s) => Text(s, 200);
    private static bool Guidance(string? s, int max) => Text(s, max) && !Url.IsMatch(s!) && !Claim.IsMatch(s!);

    public static void ValidateInput(PlanGenerationContext input)
    {
        if (input is null || !Id(input.OpportunityId) || !Text(input.SourceRevision, 500) ||
            !Text(input.ExpectedSourceRevision, 500) || !Text(input.OpportunityTheme, 1000) ||
            input.Goals is null || input.ReviewedRequirements is null || input.ReviewedResourceIds is null ||
            input.ExistingTasks is null || input.SelfReport is null) InvalidInput();
        if (input.SourceRevision != input.ExpectedSourceRevision)
            throw new MetaAiException("version_conflict", "Source context changed; reload and retry.");
        if (input.HasConfirmedParticipationBlocker)
            throw new MetaAiException("invalid_input", "Preparation cannot bypass a confirmed participation blocker.");
        if (input.ReviewedSubmissionDeadline is { } deadline && deadline <= DateTimeOffset.UtcNow)
            throw new MetaAiException("invalid_input", "The reviewed submission deadline has passed.");
        if (input.AvailableHoursPerWeek is { } hours && (!double.IsFinite(hours) || hours < 0 || hours > 168)) InvalidInput();
        if (input.AvailableHoursPerWeek == 0)
            throw new MetaAiException("invalid_input", "No preparation capacity is reported.");
        if (input.Goals.Count + input.ReviewedRequirements.Count == 0 || input.Goals.Count > 30 ||
            input.ReviewedRequirements.Count > 50 || input.ReviewedResourceIds.Count > 200 || input.ExistingTasks.Count > 100) InvalidInput();
        if (input.Goals.Any(g => g is null || !Id(g.Id) || !Text(g.Statement, 1000)) ||
            input.ReviewedRequirements.Any(r => r is null || !Id(r.Id) || !Text(r.Statement, 1000) ||
                r.Lane is not ("submission" or "preparation") || r.Applies != true || (r.Lane == "preparation" && r.IsMandatory)) ||
            input.ReviewedResourceIds.Any(r => !Id(r)) ||
            input.ReviewedResourceIds.Distinct(StringComparer.Ordinal).Count() != input.ReviewedResourceIds.Count ||
            input.ExistingTasks.Any(t => t is null || !Id(t.Id) || !Text(t.Title, 2000) || t.Target is null ||
                t.Status is not ("not_started" or "in_progress" or "done")) ||
            input.ExistingTasks.Select(t => t.Id).Distinct(StringComparer.Ordinal).Count() != input.ExistingTasks.Count) InvalidInput();
        if (input.Goals.Select(g => g.Id).Distinct(StringComparer.Ordinal).Count() != input.Goals.Count ||
            input.ReviewedRequirements.Select(r => r.Id).Distinct(StringComparer.Ordinal).Count() != input.ReviewedRequirements.Count) InvalidInput();
        foreach (var facts in new[] { input.SelfReport.AcceptedExperience, input.SelfReport.ReportedSkills, input.SelfReport.Constraints })
            if (facts is null || facts.Count > 30 || facts.Any(s => !Text(s, 1000))) InvalidInput();
    }

    public static void ValidateCandidate(PlanCandidateOutput candidate, PlanGenerationContext input)
    {
        if (candidate is null || candidate.Tasks is null || candidate.Tasks.Count > 6 || !Guidance(candidate.Explanation, 4000)) InvalidOutput();
        var goals = input.Goals.Select(g => g.Id).ToHashSet(StringComparer.Ordinal);
        var rules = input.ReviewedRequirements.ToDictionary(r => r.Id, StringComparer.Ordinal);
        var resources = input.ReviewedResourceIds.ToHashSet(StringComparer.Ordinal);
        var seen = input.ExistingTasks.Where(t => t.Status is "done" or "in_progress")
            .Select(t => t.Title.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var task in candidate.Tasks)
        {
            if (task is null || !Guidance(task.Title, 200) || !Guidance(task.Deliverable, 1000) ||
                !Guidance(task.CompletionCriteria, 1000) || task.Target is null ||
                task.Priority is not ("must" or "should" or "could") ||
                !double.IsFinite(task.EstimatedHours) || task.EstimatedHours <= 0 || task.EstimatedHours > 168 ||
                task.ResourceIds is null || task.ResourceIds.Count > 10 ||
                task.ResourceIds.Distinct(StringComparer.Ordinal).Count() != task.ResourceIds.Count ||
                task.ResourceIds.Any(r => !Id(r) || !resources.Contains(r))) InvalidOutput();
            if (!seen.Add(task.Title.Trim())) InvalidOutput(); // Exact-title guard only.
            var target = task.Target;
            var valid = target.Kind switch
            {
                "goal" => target.RequirementId is null && target.GoalId is { } g && goals.Contains(g) && task.Priority != "must",
                "requirement" => target.GoalId is null && target.RequirementId is { } r && rules.TryGetValue(r, out var rule) &&
                    rule.Applies == true && (rule.Lane is "submission" or "preparation") && (task.Priority != "must" || rule.IsMandatory),
                _ => false
            };
            if (!valid) InvalidOutput();
        }
        // No capacity cap: orchestration assesses new AND retained effort without shrinking estimates.
    }
    [System.Diagnostics.CodeAnalysis.DoesNotReturn]
    private static void InvalidInput() => throw new MetaAiException("invalid_input", "Invalid preparation context.");
    [System.Diagnostics.CodeAnalysis.DoesNotReturn]
    private static void InvalidOutput() => throw new MetaAiException("invalid_model_output", "Invalid preparation candidate.");
}
