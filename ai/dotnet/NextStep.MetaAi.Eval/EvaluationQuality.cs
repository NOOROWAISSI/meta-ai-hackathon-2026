using NextStep.MetaAi.Application;

namespace NextStep.MetaAi.Evaluation;

internal static class EvaluationQuality
{
    internal static string[] Flags(string scenarioId, PlanGenerationContext context,
        PlanCandidateOutput candidate, BudgetAssessment budget)
    {
        var flags = new List<string>();
        if (candidate.Tasks.Count == 0)
            flags.Add("Zero tasks: manually check whether the explanation justifies no remaining preparation work.");
        foreach (var requirement in context.ReviewedRequirements.Where(r => r.Lane == "submission" && r.IsMandatory && r.Applies == true))
        {
            if (!candidate.Tasks.Any(t => t.Target.Kind == "requirement" &&
                    t.Target.RequirementId == requirement.Id && t.Priority == "must"))
                flags.Add($"No must task linked to mandatory requirement {requirement.Id}; inspect candidate and retained work.");
            // Representation cannot prove semantic coverage. Always request a full-action review,
            // even for positive wording, paraphrases and a represented requirement ID.
            flags.Add($"Action coverage review required for {requirement.Id}: compare every action in the full reviewed statement with deliverables and completion criteria. Where delivery is required, check conditional sending and receipt/confirmation steps; ready-to-submit is preparation only. Done is not submission evidence. Full reviewed requirement: {requirement.Statement}");
        }
        if (scenarioId == "experienced" && candidate.Tasks.Any(t =>
                t.Title.Contains("learn basic", StringComparison.OrdinalIgnoreCase) ||
                t.Title.Contains("intro to", StringComparison.OrdinalIgnoreCase)))
            flags.Add("Possibly generic beginner work despite accepted experience; inspect relevance.");
        if (scenarioId == "existing-progress" && candidate.Tasks.Any(t =>
                t.Title.Contains("create initial wireframes", StringComparison.OrdinalIgnoreCase) ||
                t.Title.Contains("set up react repository", StringComparison.OrdinalIgnoreCase)))
            flags.Add("Possible semantic duplication of retained work; inspect manually.");
        if (budget.Feasibility == "infeasible")
            flags.Add("Estimated workload exceeds reported capacity. Review a minimum demo scope, dependency-ordered critical path, optional deferrals and a concrete scope/availability decision. Include learning time; do not shrink real effort, omit mandatory work or claim the fallback fits.");
        if (scenarioId == "unknown-facts")
            flags.Add("Manually verify no definite dates, deadlines, eligibility verdicts or experience claims were invented.");
        if (scenarioId == "approved-resources")
        {
            if (candidate.Tasks.Any(t => t.ResourceIds.Contains("reviewed-resource-002", StringComparer.Ordinal)))
                flags.Add("IRRELEVANT RESOURCE: model selected the reviewed interview guide for a visualization task.");
            flags.Add("Resource IDs are allowlisted and described, but semantic fit still needs manual review.");
        }
        return flags.ToArray();
    }
}
