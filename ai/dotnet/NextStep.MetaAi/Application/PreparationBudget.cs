namespace NextStep.MetaAi.Application;

// Optional orchestration helper; never called by the provider client.
public sealed record RetainedWork(string Id, string Status, double RemainingEstimatedHours);
public sealed record BudgetAssessment(DateTimeOffset EvaluatedAt, double? HoursPerWeek,
    DateTimeOffset? DeadlineInstant, double? AvailableHours, double RemainingEffortHours,
    string Assumption, string Feasibility);
public static class PreparationBudget
{
    // Pass only retained records that will actually survive acceptance. Never include
    // the same work again as a new candidate. Accepted task records remain untouched.
    public static BudgetAssessment Evaluate(double? hours, DateTimeOffset? deadline,
        DateTimeOffset now, PlanCandidateOutput candidate, IReadOnlyList<RetainedWork> retained)
    {
        if ((hours is { } h && (!double.IsFinite(h) || h < 0 || h > 168)) || candidate is null || candidate.Tasks is null ||
            retained is null || retained.Any(t => t is null || string.IsNullOrWhiteSpace(t.Id) ||
                t.Status is not ("done" or "in_progress" or "not_started") ||
                !double.IsFinite(t.RemainingEstimatedHours) || t.RemainingEstimatedHours < 0 || t.RemainingEstimatedHours > 168 ||
                (t.Status == "done" && t.RemainingEstimatedHours != 0)) ||
            retained.Select(t => t.Id).Distinct(StringComparer.Ordinal).Count() != retained.Count ||
            candidate.Tasks.Any(t => t is null || !double.IsFinite(t.EstimatedHours) || t.EstimatedHours <= 0 || t.EstimatedHours > 168))
            throw new MetaAiException("invalid_input", "Invalid preparation budget input.");
        var remaining = candidate.Tasks.Sum(t => t.EstimatedHours) + retained.Sum(t => t.RemainingEstimatedHours);
        double? available = hours is { } weekly && deadline is { } end
            ? Math.Max(0, (end - now).TotalDays / 7 * weekly) : null;
        var feasibility = remaining == 0 ? "no_remaining_gap" : hours == 0 || (available is { } capacity && remaining > capacity)
            ? "infeasible" : available is null ? "untimed" : "fits_reported_budget";
        return new(now, hours, deadline, available, remaining, available is null ? "untimed" : "even_weekly_distribution", feasibility);
    }
}
