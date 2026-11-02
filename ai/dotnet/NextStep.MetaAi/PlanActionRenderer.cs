namespace NextStep.MetaAi;

public sealed record PlanActionSelection(string Action, TaskTarget Target, string Priority, double EstimatedHours, IReadOnlyList<string> ResourceIds);
public sealed record RenderedPlanProof(IReadOnlyList<PlanActionSelection> Selections, string Reason, PlanGenerationContext Context);

public static class PlanActionRenderer
{
    private static readonly System.Runtime.CompilerServices.ConditionalWeakTable<PlanCandidateOutput, RenderedPlanProof> Issued = new();
    private static readonly System.Text.Json.JsonSerializerOptions Json = ContractJson.CreateOptions();
    private static T Copy<T>(T value) => System.Text.Json.JsonSerializer.Deserialize<T>(System.Text.Json.JsonSerializer.Serialize(value, Json), Json)!;

    public static RenderedPlanProof? ProofFor(PlanCandidateOutput output, PlanGenerationContext context)
    {
        if (!Issued.TryGetValue(output, out var proof) || !Same(proof.Context, context) || !Matches(output, proof)) return null;
        return Copy(proof with { Context = proof.Context with { SelfReport = new([], [], []) } });
    }

    public static bool Matches(PlanCandidateOutput output, RenderedPlanProof? proof)
    {
        if (output is null || proof is null || proof.Context is null || proof.Selections is null || proof.Reason is null) return false;
        try {
            GenerationPolicy.ValidateInput(proof.Context);
            var rendered = Render(proof.Selections, proof.Reason, proof.Context);
            GenerationPolicy.ValidateCandidate(rendered, proof.Context);
            return Same(output, rendered);
        } catch (Exception e) when (e is MetaAiException or ArgumentException or NullReferenceException) { return false; }
    }

    public static bool MatchesForDisplay(PlanCandidateOutput output, RenderedPlanProof? proof)
    {
        if (output is null || proof is null || proof.Context is null || proof.Selections is null || proof.Reason is null) return false;
        try {
            var rendered = Render(proof.Selections, proof.Reason, proof.Context);
            GenerationPolicy.ValidateCandidate(rendered, proof.Context);
            return Same(output, rendered);
        } catch (Exception e) when (e is MetaAiException or ArgumentException or NullReferenceException) { return false; }
    }

    private static bool Same<T>(T left, T right) => System.Text.Json.JsonSerializer.Serialize(left, Json) == System.Text.Json.JsonSerializer.Serialize(right, Json);
    public static PlanCandidateOutput WithCapacityGuidance(PlanCandidateOutput output, PlanGenerationContext context)
    {
        if (context.AvailableCapacityHours is not { } available) return output;
        if (available > 0 && output.Tasks.Sum(t => t.EstimatedHours) + (context.RetainedEffortHours ?? 0) <= available + 1d / 60d) return output;
        var proof = ProofFor(output, context);
        if (proof is null || proof.Reason == "capacity_path") return output;
        return Render(proof.Selections, "capacity_path", context);
    }
    private static readonly IReadOnlyDictionary<string, (string Title, string Deliverable, string Criteria)> Templates =
        new Dictionary<string, (string, string, string)>(StringComparer.Ordinal) {
            ["clarify"] = ("Clarify open questions", "List the information that needs confirmation.", "Record the questions and leave unconfirmed answers unresolved."),
            ["explore"] = ("Explore preparation approaches", "Outline possible approaches for the selected goal.", "Record options and what remains unknown about each."),
            ["prototype"] = ("Prototype a small component", "Prepare a small prototype for the selected goal.", "Review the prototype and note remaining limitations."),
            ["adapt"] = ("Adapt existing work", "Identify a change to work you have already described.", "Review the proposed change and record uncertainties."),
            ["define_outcome"] = ("Define one demonstrable outcome", "If relevant to your goal, outline one user journey with a starting point, action, and expected result.", "Record a small journey to demonstrate and any unresolved questions."),
            ["build_component"] = ("Build a small component", "If relevant to your goal, build or try one small component for the journey.", "Run the component or experiment and record its limitations."),
            ["integrate_flow"] = ("Connect the demonstration flow", "Where the components exist, connect them into the user journey you chose.", "Run the journey from start to finish and note what remains unfinished."),
            ["test_flow"] = ("Test the demonstration flow", "If you have a flow, check the journey against the expected result you defined.", "Record the outcome and any defects or unfinished work."),
            ["prepare_requirement"] = ("Work on reviewed preparation guidance", "Review the linked preparation guidance and plan a relevant next step.", "Record the planned step and any remaining questions about the guidance."),
            ["prepare_artifact"] = ("Prepare the required artifact", "Prepare an artifact against the linked reviewed requirement.", "Check the artifact against the reviewed instructions; readiness does not establish delivery."),
            ["record_video"] = ("Record or prepare the demonstration video", "Record or prepare the video described by the linked reviewed requirement.", "Review the video against the confirmed instructions; preparation does not establish delivery."),
            ["verify_channel"] = ("Verify submission instructions", "Check the organizer's current delivery channel and instructions.", "Record what is confirmed and leave unknown instructions unresolved."),
            ["deliver"] = ("Deliver after verifying the channel", "When ready, use the organizer-confirmed channel if delivery is required.", "Review delivery separately; marking this task Done does not establish submission."),
            ["confirm_receipt"] = ("Check external confirmation", "Check for an organizer receipt or confirmation if available.", "Keep any actual confirmation separately from task progress; missing confirmation remains unknown.")
        };

    public static PlanCandidateOutput Render(IReadOnlyList<PlanActionSelection> selections, string reason, PlanGenerationContext context)
    {
        if (selections is null || selections.Count is 0 or > 6 || reason is not ("prepare" or "scope" or "unknown" or "capacity_path")) Invalid();
        GenerationPolicy.ValidateReviewedMetadata(context);
        var result = new List<CandidateTask>();
        var seen = new HashSet<(string, string?, string?)>();
        var lastStage = new Dictionary<string, int>(StringComparer.Ordinal);
        var stages = new Dictionary<string, int>(StringComparer.Ordinal) { ["define_outcome"] = 0, ["build_component"] = 1, ["integrate_flow"] = 2, ["test_flow"] = 3 };
        var lastVideoStage = new Dictionary<string, int>(StringComparer.Ordinal);
        var videoStages = new Dictionary<string, int>(StringComparer.Ordinal) { ["record_video"] = 0, ["verify_channel"] = 1, ["deliver"] = 2, ["confirm_receipt"] = 3 };
        foreach (var s in selections)
        {
            if (s is null || !Templates.TryGetValue(s.Action, out var template) || s.Target is null || s.ResourceIds is null) { Invalid(); return null!; }
            if (!seen.Add((s.Action, s.Target.GoalId, s.Target.RequirementId))) Invalid();
            if (context.ExistingTasks.Any(t => t.Status is "done" or "in_progress" && t.ActionCode == s.Action && t.Target == s.Target)) Invalid();
            var deliveryAction = s.Action is "prepare_artifact" or "record_video" or "verify_channel" or "deliver" or "confirm_receipt";
            if (deliveryAction && (s.Target.Kind != "requirement" || !context.ReviewedRequirements.Any(r => r.Id == s.Target.RequirementId && r.Lane == "submission" && r.Applies == true))) Invalid();
            if (s.Action == "record_video" && !context.ReviewedRequirements.Any(r => r.Id == s.Target.RequirementId && r.Deliverable is { Type: "video" } d && d.SourceRevision == context.SourceRevision && d.EvidenceIds.Count > 0 && d.RequiredActions.Contains("record", StringComparer.Ordinal))) Invalid();
            if (s.Target.RequirementId is { } requirementId && videoStages.TryGetValue(s.Action, out var videoStage) && context.ReviewedRequirements.Any(r => r.Id == requirementId && r.Deliverable?.Type == "video")) {
                if (lastVideoStage.TryGetValue(requirementId, out var previousVideo) && videoStage <= previousVideo) Invalid();
                lastVideoStage[requirementId] = videoStage;
            }
            if (s.Action == "prepare_requirement" && (s.Target.Kind != "requirement" || !context.ReviewedRequirements.Any(r => r.Id == s.Target.RequirementId && r.Lane == "preparation" && r.Applies == true))) Invalid();
            if (!deliveryAction && s.Action != "prepare_requirement" && s.Target.Kind != "goal") Invalid();
            if (stages.TryGetValue(s.Action, out var stage) && s.Target.GoalId is { } goal) {
                if (lastStage.TryGetValue(goal, out var previous) && stage <= previous) Invalid();
                lastStage[goal] = stage;
            }
            result.Add(new($"Step {result.Count + 1}: {template.Title}", s.Target, s.Priority, template.Deliverable, template.Criteria, s.EstimatedHours, s.ResourceIds));
        }
        var explanation = reason switch {
            "scope" => "Review the smallest useful scope and dependency order. Defer optional work and reassess effort against your available time.",
            "capacity_path" => "The estimated work exceeds reported capacity. Review retained and mandatory work, defer optional extras, and compare the unchanged estimates with your time; this does not promise the work will fit.",
            "unknown" => "Some details remain unknown. Clarify them using the original sources before making commitments.",
            _ => "Review these proposed preparation steps and the original sources before accepting."
        };
        if (selections.Any(s => stages.ContainsKey(s.Action))) {
            var groups = selections.Select((s, i) => (s, i)).Where(x => stages.ContainsKey(x.s.Action)).GroupBy(x => x.s.Target.GoalId, StringComparer.Ordinal);
            var paths = groups.Select((group, index) => $"goal {index + 1}: " + string.Join("; then ", group.Select(x => $"step {x.i + 1}: {Templates[x.s.Action].Title}")));
            explanation += " Suggested critical path for selected stages (other retained or required work may also be necessary): " + string.Join(". ", paths) + ". This order does not establish that the work fits your available time.";
        } else if (reason == "capacity_path") {
            explanation += " Suggested fallback critical path, if relevant to your goal: define the smallest useful outcome; prepare only what it needs; connect any required parts; then test the result. These are review steps, not newly added tasks.";
        }
        if (context.ReviewedRequirements.Any(r => r.Lane == "submission" && r.IsMandatory))
            explanation += " Mandatory action coverage remains unresolved: review preparation, verified-channel delivery, and any external confirmation against each full requirement.";
        var output = new PlanCandidateOutput(result, explanation);
        GenerationPolicy.ValidateCandidate(output, context);
        Issued.Add(output, new(Copy(selections), reason, Copy(context)));
        return output;
    }
    [System.Diagnostics.CodeAnalysis.DoesNotReturn]
    private static void Invalid() => throw new MetaAiException("invalid_model_output", "Invalid preparation action selection.");
}
