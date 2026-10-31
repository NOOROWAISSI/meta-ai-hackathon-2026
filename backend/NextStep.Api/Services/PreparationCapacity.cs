using NextStep.MetaAi;
using NextStep.MetaAi.Application;

namespace NextStep.Api;

// Shared application policy for acceptance and progress; provider DTOs stay unchanged.
public static class PreparationCapacity
{
    public static BudgetAssessment Evaluate(Opportunity opportunity, double? hours, PreparationTask[] tasks, DateTimeOffset now, bool currentContext = true)
    {
        var start = Catalog.Instant(opportunity, "build_start");
        var uncertainStart = opportunity.TimelineEvents.Any(e => e.Kind == "build_start") && start is null;
        var deadline = currentContext && !uncertainStart ? Catalog.Instant(opportunity, "submission_close") : null;
        var effective = currentContext && start is { } begins && begins > now ? begins : now;
        var assessment = PreparationBudget.Evaluate(hours, deadline, effective, new([], "Confirmed preparation work"), tasks.Select(t => new RetainedWork(t.Id, t.Status, t.RemainingEstimatedHours)).ToArray());
        return assessment with { EvaluatedAt = now };
    }
}
