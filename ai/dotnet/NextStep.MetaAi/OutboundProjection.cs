using System.Text.Json;
using System.Text.Json.Nodes;

namespace NextStep.MetaAi;

// Builds the exact JSON payload sent to the external model provider from a
// validated PlanGenerationContext. This is the single minimization boundary
// between the server-side context (which callers validate and prove against)
// and the wire:
// - ReviewedDeliverable EvidenceIds are internal identifiers the model never
//   references back, so they are dropped here and kept server-side only.
// - ExistingTasks titles are untrusted legacy text for tasks that predate the
//   renderer (no action code). Those titles are withheld; the task id, status
//   and target still go, so retained work is not repeated.
// - User-authored free text (goal statements, experience entries, constraints)
//   is capped at FreeTextBudget characters in total, reduced deterministically
//   in priority order: constraints are preserved in full first, then goal
//   statements, then experience entries. Constraints are never cut silently:
//   if they alone exceed the budget, the request is rejected instead. Goal
//   statements are never reduced to nothing either: every goal keeps a
//   GoalFloor-character floor before any experience text is considered, and
//   if the constraints plus the goal floors alone exceed the budget, the
//   request is rejected rather than sending unusable goals.
public static class OutboundProjection
{
    public const int FreeTextBudget = 8000;
    public const int GoalFloor = 120;
    private static readonly JsonSerializerOptions Json = ContractJson.CreateOptions();

    public static JsonObject Build(PlanGenerationContext input)
    {
        var constraintsTotal = input.SelfReport.Constraints.Sum(s => s.Length);
        if (constraintsTotal > FreeTextBudget)
            throw new MetaAiException("invalid_input",
                "Reported constraints exceed the outbound text budget. Shorten the constraints before generating.");
        var goalFloors = input.Goals.Sum(g => Math.Min(g.Statement.Length, GoalFloor));
        if (constraintsTotal + goalFloors > FreeTextBudget)
            throw new MetaAiException("invalid_input",
                "Reported goals and constraints exceed the outbound text budget. Shorten them before generating.");
        var remaining = FreeTextBudget - constraintsTotal;

        // Pass 1 reserves each goal's floor; pass 2 completes statements in
        // order with what remains. Experience text only sees the leftover.
        var statements = input.Goals.Select(g => g.Statement[..Math.Min(g.Statement.Length, GoalFloor)]).ToArray();
        remaining -= goalFloors;
        for (var i = 0; i < statements.Length && remaining > 0; i++)
        {
            var full = input.Goals[i].Statement;
            var extra = Math.Min(full.Length - statements[i].Length, remaining);
            if (extra > 0) { statements[i] += full[statements[i].Length..(statements[i].Length + extra)]; remaining -= extra; }
        }
        var goals = new JsonArray();
        for (var i = 0; i < statements.Length; i++)
            goals.Add(new JsonObject { ["id"] = input.Goals[i].Id, ["statement"] = statements[i] });

        var experience = new JsonArray();
        foreach (var entry in input.SelfReport.AcceptedExperience)
        {
            if (remaining <= 0) break;
            if (entry.Text.Length <= remaining)
            {
                experience.Add(new JsonObject { ["kind"] = entry.Kind, ["text"] = entry.Text });
                remaining -= entry.Text.Length;
            }
            else
            {
                // Keep a truncated final entry only when the remainder is
                // large enough to stay meaningful; later entries are dropped.
                if (remaining >= 200)
                    experience.Add(new JsonObject { ["kind"] = entry.Kind, ["text"] = entry.Text[..remaining] });
                remaining = 0;
                break;
            }
        }

        var requirements = new JsonArray();
        foreach (var rule in input.ReviewedRequirements)
        {
            var item = new JsonObject
            {
                ["id"] = rule.Id,
                ["statement"] = rule.Statement,
                ["lane"] = rule.Lane,
                ["applies"] = rule.Applies,
                ["isMandatory"] = rule.IsMandatory,
            };
            if (rule.Deliverable is { } deliverable)
                item["deliverable"] = new JsonObject
                {
                    ["type"] = deliverable.Type,
                    ["requiredActions"] = new JsonArray(deliverable.RequiredActions.Select(a => (JsonNode)a).ToArray()),
                    ["sourceRevision"] = deliverable.SourceRevision,
                };
            requirements.Add(item);
        }

        var tasks = new JsonArray();
        foreach (var task in input.ExistingTasks)
        {
            var item = new JsonObject { ["id"] = task.Id };
            // Only renderer-produced titles (tasks carrying an action code)
            // are trusted text. Legacy titles stay on the server.
            if (task.ActionCode is not null) item["title"] = task.Title;
            item["status"] = task.Status;
            item["target"] = JsonSerializer.SerializeToNode(task.Target, Json);
            if (task.ActionCode is not null) item["actionCode"] = task.ActionCode;
            tasks.Add(item);
        }

        return new JsonObject
        {
            ["opportunityId"] = input.OpportunityId,
            ["opportunityTheme"] = input.OpportunityTheme,
            ["sourceRevision"] = input.SourceRevision,
            ["goals"] = goals,
            ["reviewedRequirements"] = requirements,
            ["reviewedResources"] = new JsonArray(input.ReviewedResources.Select(r => JsonSerializer.SerializeToNode(r, Json)).ToArray()),
            ["availableHoursPerWeek"] = input.AvailableHoursPerWeek is { } hours ? JsonValue.Create(hours) : null,
            ["reviewedSubmissionDeadline"] = input.ReviewedSubmissionDeadline is { } deadline ? JsonValue.Create(deadline) : null,
            ["existingTasks"] = tasks,
            ["selfReport"] = new JsonObject
            {
                ["acceptedExperience"] = experience,
                ["reportedSkills"] = new JsonArray(input.SelfReport.ReportedSkills.Select(s => (JsonNode)s).ToArray()),
                ["constraints"] = new JsonArray(input.SelfReport.Constraints.Select(s => (JsonNode)s).ToArray()),
            },
        };
    }

}
