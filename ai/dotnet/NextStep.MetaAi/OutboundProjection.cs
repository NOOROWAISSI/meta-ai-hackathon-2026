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
            // IDs may be student-controlled; their derived lookup belongs
            // beside the other untrusted user data, never in system text.
            ["selectionGuide"] = BuildSelectionGuide(input),
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

    // The valid action and target combinations for this exact context, stated
    // explicitly so the model's allowed output space matches the application
    // rules the renderer and policy enforce. Built only from the already
    // validated input; carries IDs and rule shapes, never profile prose.
    private static string BuildSelectionGuide(PlanGenerationContext input)
    {
        var guide = new System.Text.StringBuilder(" Valid selections for this request (the only allowed action and target combinations):");
        foreach (var goal in input.Goals)
            guide.Append($" Goal {goal.Id}: actions clarify, explore, prototype, adapt, define_outcome, build_component, integrate_flow, test_flow; priorities should or could, never must; staged actions in the order define_outcome, then build_component, then integrate_flow, then test_flow; each action at most once for this goal.");
        foreach (var requirement in input.ReviewedRequirements)
        {
            if (requirement.Lane == "preparation")
            {
                guide.Append($" Requirement {requirement.Id} (preparation): action prepare_requirement only; priorities should or could, never must; at most once.");
                continue;
            }
            var video = requirement.Deliverable is { Type: "video" } deliverable &&
                deliverable.SourceRevision == input.SourceRevision && deliverable.EvidenceIds.Count > 0 &&
                deliverable.RequiredActions.Contains("record", StringComparer.Ordinal);
            guide.Append($" Requirement {requirement.Id} (submission{(requirement.IsMandatory ? ", mandatory" : "")}): actions prepare_artifact, verify_channel, deliver, confirm_receipt{(video ? ", record_video" : "")}; priorities {(requirement.IsMandatory ? "must only for the actions this requirement explicitly requires, otherwise should or could" : "should or could, never must")}; each action at most once for this requirement{(video ? "; video steps in the order record_video, then verify_channel, then deliver, then confirm_receipt" : "")}.");
        }
        foreach (var task in input.ExistingTasks.Where(t => (t.Status is "done" or "in_progress") && t.ActionCode is not null))
            guide.Append($" Already covered by existing work, do not select again: {task.ActionCode} for {(task.Target.Kind == "goal" ? "goal " + task.Target.GoalId : "requirement " + task.Target.RequirementId)}.");
        guide.Append(" Copy every goal and requirement ID exactly as written. Each task object has exactly the fields action, target, priority, estimatedHours, resourceIds; each target has kind plus goalId for a goal or requirementId for a requirement, never both.");
        return guide.ToString();
    }


}
