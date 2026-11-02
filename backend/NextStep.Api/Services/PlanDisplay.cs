using System.Text.Json;
using NextStep.MetaAi;

namespace NextStep.Api;

public static class PlanDisplay
{
    public const string HistoricalNotice = "Historical plan: earlier task descriptions have not been verified. Regenerate the plan and review the draft before accepting it.";

    public static Plan? Project(UserState state, string opportunityId, Plan? plan)
    {
        if (plan is null) return null;
        var rendering = state.PlanRenderings.GetValueOrDefault(opportunityId);
        if (rendering?.PlanId != plan.Id) rendering = null;
        var trusted = new Dictionary<string, CandidateTask>(StringComparer.Ordinal);
        var validBatches = new List<PlanRenderingBatch>();
        foreach (var batch in rendering?.Batches ?? []) {
            if (batch?.Output is null || batch.TaskIds is null || batch.TaskIds.Length != batch.Output.Tasks.Count ||
                batch.TaskIds.Distinct(StringComparer.Ordinal).Count() != batch.TaskIds.Length || !PlanActionRenderer.MatchesForDisplay(batch.Output, batch.Proof)) continue;
            validBatches.Add(batch);
            for (var i = 0; i < batch.TaskIds.Length; i++) trusted[batch.TaskIds[i]] = batch.Output.Tasks[i];
        }
        var unverified = rendering is null || plan.Tasks.Any(task => !trusted.TryGetValue(task.Id, out var approved) || !Matches(task, approved));
        var tasks = plan.Tasks.Select((task, index) => trusted.TryGetValue(task.Id, out var approved) && Matches(task, approved)
            ? task
            : task with { Title = $"Historical task {index + 1}", Deliverable = "The earlier description has not been verified.", CompletionCriteria = "Review this task before relying on its description." }).ToArray();
        var warnings = new List<string>();
        if (unverified) warnings.Add(HistoricalNotice);
        var latest = validBatches.LastOrDefault();
        if (latest is not null) warnings.Add(latest.Output.Explanation);
        warnings.Add("Progress is self-reported and does not change eligibility or submission facts.");
        if (rendering?.Untimed == true) warnings.Add("Submission timing is unconfirmed; this is untimed guidance.");
        if (rendering?.HasUnrepresentedRequirements == true) warnings.Add("Submission action not represented by plan tasks: review the organizer's requirements.");
        if (rendering?.SourceCoverageIncomplete == true) warnings.Add("Submission source coverage remains incomplete or unknown; task coverage does not establish submission completeness.");
        return plan with { Tasks = tasks, Warnings = warnings.ToArray() };
    }

    private static bool Matches(PreparationTask task, CandidateTask approved) =>
        task.Title == approved.Title && task.Deliverable == approved.Deliverable && task.CompletionCriteria == approved.CompletionCriteria &&
        task.Priority == approved.Priority && task.EstimatedHours == approved.EstimatedHours &&
        JsonSerializer.Serialize(task.Target, Wire.Json) == JsonSerializer.Serialize(approved.Target, Wire.Json) &&
        task.ResourceIds.SequenceEqual(approved.ResourceIds);

    public static Dictionary<string, string> TrustedActions(UserState state, string opportunityId, Plan? plan)
    {
        var actions = new Dictionary<string, string>(StringComparer.Ordinal);
        var rendering = state.PlanRenderings.GetValueOrDefault(opportunityId);
        if (plan is null || rendering?.PlanId != plan.Id) return actions;
        foreach (var batch in rendering.Batches) {
            if (batch?.Output is null || batch.TaskIds is null || batch.Proof?.Selections is null ||
                batch.TaskIds.Length != batch.Output.Tasks.Count || batch.TaskIds.Length != batch.Proof.Selections.Count ||
                batch.TaskIds.Distinct(StringComparer.Ordinal).Count() != batch.TaskIds.Length ||
                !PlanActionRenderer.MatchesForDisplay(batch.Output, batch.Proof)) continue;
            for (var i = 0; i < batch.TaskIds.Length; i++) {
                var task = plan.Tasks.FirstOrDefault(t => t.Id == batch.TaskIds[i]);
                if (task is not null && Matches(task, batch.Output.Tasks[i])) actions[task.Id] = batch.Proof.Selections[i].Action;
            }
        }
        return actions;
    }
}
