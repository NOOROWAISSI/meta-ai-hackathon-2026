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
            input.ReviewedResources is null || input.ExistingTasks is null || input.SelfReport is null) InvalidInput();
        if (input.SourceRevision != input.ExpectedSourceRevision)
            throw new MetaAiException("version_conflict", "Source context changed; reload and retry.");
        if (input.HasConfirmedParticipationBlocker)
            throw new MetaAiException("invalid_input", "Preparation cannot bypass a confirmed participation blocker.");
        if (input.ReviewedSubmissionDeadline is { } deadline && deadline <= DateTimeOffset.UtcNow)
            throw new MetaAiException("invalid_input", "The reviewed submission deadline has passed.");
        if (input.AvailableHoursPerWeek is { } hours && (!double.IsFinite(hours) || hours < 0 || hours > 168)) InvalidInput();
        if (input.AvailableHoursPerWeek == 0)
            throw new MetaAiException("invalid_input", "No preparation capacity is reported.");
        if (input.RetainedEffortHours is { } retained && (!double.IsFinite(retained) || retained < 0 || retained > 16800)) InvalidInput();
        if (input.AvailableCapacityHours is { } capacity && (!double.IsFinite(capacity) || capacity < 0 || input.AvailableHoursPerWeek is null || input.ReviewedSubmissionDeadline is null)) InvalidInput();
        if (input.Goals.Count + input.ReviewedRequirements.Count == 0 || input.Goals.Count > 30 ||
            input.ReviewedRequirements.Count > 50 || input.ReviewedResourceIds.Count > 200 ||
            input.ReviewedResources.Count > 50 || input.ExistingTasks.Count > 100) InvalidInput();
        if (input.Goals.Any(g => g is null || !Id(g.Id) || !Text(g.Statement, 1000)) ||
            input.ReviewedRequirements.Any(r => r is null || !Id(r.Id) || !Text(r.Statement, 1000) ||
                r.Lane is not ("submission" or "preparation") || r.Applies != true || (r.Lane == "preparation" && r.IsMandatory)) ||
            input.ReviewedResourceIds.Any(r => !Id(r)) ||
            input.ReviewedResourceIds.Distinct(StringComparer.Ordinal).Count() != input.ReviewedResourceIds.Count ||
            input.ReviewedResources.Any(r => r is null || !Id(r.Id) || !Text(r.Title, 200) ||
                !Text(r.RelevanceNote, 1000) || !input.ReviewedResourceIds.Contains(r.Id, StringComparer.Ordinal)) ||
            input.ReviewedResources.Select(r => r.Id).Distinct(StringComparer.Ordinal).Count() != input.ReviewedResources.Count ||
            input.ExistingTasks.Any(t => t is null || !Id(t.Id) || !Text(t.Title, 2000) || t.Target is null ||
                t.Status is not ("not_started" or "in_progress" or "done")) ||
            input.ExistingTasks.Select(t => t.Id).Distinct(StringComparer.Ordinal).Count() != input.ExistingTasks.Count) InvalidInput();
        if (input.Goals.Select(g => g.Id).Distinct(StringComparer.Ordinal).Count() != input.Goals.Count ||
            input.ReviewedRequirements.Select(r => r.Id).Distinct(StringComparer.Ordinal).Count() != input.ReviewedRequirements.Count) InvalidInput();
        ValidateReviewedMetadata(input);
        if (input.SelfReport.AcceptedExperience is null || input.SelfReport.AcceptedExperience.Count > 30 ||
            input.SelfReport.AcceptedExperience.Any(e => e is null || !ExperienceKinds.Valid(e.Kind) || !Text(e.Text, 1000))) InvalidInput();
        foreach (var facts in new[] { input.SelfReport.ReportedSkills, input.SelfReport.Constraints })
            if (facts is null || facts.Count > 30 || facts.Any(s => !Text(s, 1000))) InvalidInput();
    }

    public static void ValidateReviewedMetadata(PlanGenerationContext input)
    {
        foreach (var rule in input.ReviewedRequirements.Where(r => r.Deliverable is not null)) {
            var d = rule.Deliverable!;
            if (rule.Lane != "submission" || d.Type != "video" || d.SourceRevision != input.SourceRevision ||
                d.RequiredActions is null || d.RequiredActions.Count == 0 || d.RequiredActions.Any(a => a is not ("record" or "deliver" or "confirm_receipt")) ||
                d.RequiredActions.Distinct(StringComparer.Ordinal).Count() != d.RequiredActions.Count ||
                d.EvidenceIds is null || d.EvidenceIds.Count == 0 || d.EvidenceIds.Any(e => !Id(e)) ||
                d.EvidenceIds.Distinct(StringComparer.Ordinal).Count() != d.EvidenceIds.Count) InvalidInput();
        }
    }

    public static void ValidateCandidate(PlanCandidateOutput candidate, PlanGenerationContext input)
    {
        if (candidate is null || candidate.Tasks is null || candidate.Tasks.Count > 6 || !Guidance(candidate.Explanation, 4000)) InvalidOutput("policy.candidate_shape");
        var goals = input.Goals.Select(g => g.Id).ToHashSet(StringComparer.Ordinal);
        var rules = input.ReviewedRequirements.ToDictionary(r => r.Id, StringComparer.Ordinal);
        // IDs alone convey no relevance. Only entries with reviewed metadata may be selected.
        var resources = input.ReviewedResources.Select(r => r.Id).ToHashSet(StringComparer.Ordinal);
        // Duplicate identity is the trusted action code plus the target.
        // Rendered titles are templates with step numbers, so a title is
        // never identity for a structured task: the same action on a
        // different goal or requirement is new work, and renumbering must
        // not rescue a repeat. Titles remain the conservative fallback only
        // where either side has no trusted action (legacy retained tasks,
        // unrendered candidate output).
        var retained = input.ExistingTasks.Where(t => t.Status is "done" or "in_progress").ToArray();
        var identities = new HashSet<(string, string?, string?)>();
        var trustedTitles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var untrustedTitles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var task in candidate.Tasks)
        {
            if (task is null || !Guidance(task.Title, 200) || !Guidance(task.Deliverable, 1000) ||
                !Guidance(task.CompletionCriteria, 1000) || task.Target is null ||
                task.Priority is not ("must" or "should" or "could") ||
                !double.IsFinite(task.EstimatedHours) || task.EstimatedHours <= 0 || task.EstimatedHours > 168 ||
                task.ResourceIds is null || task.ResourceIds.Count > 10 ||
                task.ResourceIds.Distinct(StringComparer.Ordinal).Count() != task.ResourceIds.Count ||
                task.ResourceIds.Any(r => !Id(r) || !resources.Contains(r))) InvalidOutput("policy.task_shape");
            var title = task.Title.Trim();
            if (task.Action is { } action)
            {
                if (!identities.Add((action, task.Target.GoalId, task.Target.RequirementId))) InvalidOutput("policy.duplicate_identity");
                if (untrustedTitles.Contains(title)) InvalidOutput("policy.duplicate_title");
                trustedTitles.Add(title);
            }
            else
            {
                if (untrustedTitles.Contains(title) || trustedTitles.Contains(title)) InvalidOutput("policy.duplicate_title");
                untrustedTitles.Add(title);
            }
            foreach (var old in retained)
            {
                if (task.Action is { } newAction && old.ActionCode is { } oldAction)
                { if (oldAction == newAction && old.Target == task.Target) InvalidOutput("policy.existing_conflict"); }
                else if (string.Equals(old.Title.Trim(), title, StringComparison.OrdinalIgnoreCase)) InvalidOutput("policy.existing_conflict");
            }
            var target = task.Target;
            string? targetError = null;
            if (target.Kind == "goal")
            {
                if (target.RequirementId is not null || target.GoalId is null) targetError = "policy.target_shape";
                else if (!goals.Contains(target.GoalId)) targetError = "policy.unknown_goal";
                else if (task.Priority == "must") targetError = "policy.must_on_goal";
            }
            else if (target.Kind == "requirement")
            {
                if (target.GoalId is not null || target.RequirementId is null) targetError = "policy.target_shape";
                else if (!rules.TryGetValue(target.RequirementId, out var rule)) targetError = "policy.unknown_requirement";
                else if (rule.Applies != true || rule.Lane is not ("submission" or "preparation")) targetError = "policy.target_shape";
                else if (task.Priority == "must" && !rule.IsMandatory) targetError = "policy.must_on_nonmandatory";
            }
            else targetError = "policy.target_shape";
            if (targetError is not null) InvalidOutput(targetError);
        }
        // No capacity cap: orchestration assesses new AND retained effort without shrinking estimates.
    }
    [System.Diagnostics.CodeAnalysis.DoesNotReturn]
    private static void InvalidInput() => throw new MetaAiException("invalid_input", "Invalid preparation context.");
    [System.Diagnostics.CodeAnalysis.DoesNotReturn]
    private static void InvalidOutput(string category = "policy.unclassified")
    {
        AiRejectionDiagnostics.Record("policy", category, null);
        throw new MetaAiException("invalid_model_output", "Invalid preparation candidate.");
    }
}
