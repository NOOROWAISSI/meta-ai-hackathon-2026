namespace NextStep.MetaAi.Checks;

// Regression checks for the PR #31 review finding: rendered template titles
// are not task identity. Duplicate prevention must use the trusted action
// code plus the target identity, with conservative title handling only where
// no trusted structured identity exists (legacy tasks, unrendered output).
internal static class DuplicateIdentityChecks
{
    private const string PrototypeTitle = "Step 1: Prototype a small component";
    private const string GuidanceTitle = "Step 1: Work on reviewed preparation guidance";

    public static void Register(Action<string, Action> test)
    {
        test("rendered task for a different goal is allowed despite a retained title collision", () => {
            var context = Context(existing: [Existing(PrototypeTitle, "done", GoalTarget("goal-a"), "prototype")]);
            var output = PlanActionRenderer.Render([Selection("prototype", GoalTarget("goal-b"))], "prepare", context);
            // The collision is real: the new task renders the identical title.
            Assert(output.Tasks[0].Title == PrototypeTitle);
        });
        test("rendered task repeating a retained action and target is rejected", () => {
            var context = Context(existing: [Existing(PrototypeTitle, "done", GoalTarget("goal-a"), "prototype")]);
            Invalid(() => PlanActionRenderer.Render([Selection("prototype", GoalTarget("goal-a"))], "prepare", context));
        });
        test("same action on a different requirement is allowed, same requirement is rejected", () => {
            var context = Context(
                requirements: [Requirement("req-a"), Requirement("req-b")],
                existing: [Existing(GuidanceTitle, "done", RequirementTarget("req-a"), "prepare_requirement")]);
            var output = PlanActionRenderer.Render([Selection("prepare_requirement", RequirementTarget("req-b"))], "prepare", context);
            Assert(output.Tasks[0].Title == GuidanceTitle);
            Invalid(() => PlanActionRenderer.Render([Selection("prepare_requirement", RequirementTarget("req-a"))], "prepare", context));
        });
        test("legacy retained task without an action code still blocks a same-title candidate", () => {
            var context = Context(existing: [Existing(PrototypeTitle, "in_progress", GoalTarget("goal-b"), null)]);
            Invalid(() => PlanActionRenderer.Render([Selection("prototype", GoalTarget("goal-b"))], "prepare", context));
        });
        test("candidate validation separates same-title tasks by action and target", () => {
            var context = Context(existing: [Existing(PrototypeTitle, "done", GoalTarget("goal-a"), "prototype")]);
            // Same title and same action as the retained task, different goal: allowed.
            GenerationPolicy.ValidateCandidate(new([Candidate(PrototypeTitle, GoalTarget("goal-b"), "prototype")], "prepare"), context);
            // Same action and same target as the retained task: rejected.
            Invalid(() => GenerationPolicy.ValidateCandidate(new([Candidate(PrototypeTitle, GoalTarget("goal-a"), "prototype")], "prepare"), context));
            // Two same-title tasks inside one candidate, different targets: allowed.
            GenerationPolicy.ValidateCandidate(new([
                Candidate(PrototypeTitle, GoalTarget("goal-a"), "prototype"),
                Candidate(PrototypeTitle, GoalTarget("goal-b"), "prototype"),
            ], "prepare"), Context());
            // Two tasks with the same action and target inside one candidate: rejected.
            Invalid(() => GenerationPolicy.ValidateCandidate(new([
                Candidate(PrototypeTitle, GoalTarget("goal-a"), "prototype"),
                Candidate("Step 2: Prototype a small component", GoalTarget("goal-a"), "prototype"),
            ], "prepare"), Context()));
        });
        test("candidate without a trusted action keeps the exact-title guard", () => {
            var context = Context(existing: [Existing(PrototypeTitle, "done", GoalTarget("goal-a"), "prototype")]);
            Invalid(() => GenerationPolicy.ValidateCandidate(new([Candidate(PrototypeTitle, GoalTarget("goal-b"), null)], "prepare"), context));
            GenerationPolicy.ValidateCandidate(new([Candidate("A differently worded task", GoalTarget("goal-b"), null)], "prepare"), context);
        });
        test("renumbering does not change duplicate identity", () => {
            // The retained task was rendered second in its own plan; the new
            // selection renders first in its plan. Titles differ by step
            // number, but action plus target are identical, so it is a repeat.
            var context = Context(existing: [Existing("Step 2: Prototype a small component", "done", GoalTarget("goal-a"), "prototype")]);
            Invalid(() => PlanActionRenderer.Render([Selection("prototype", GoalTarget("goal-a"))], "prepare", context));
        });
    }

    private static CandidateTask Candidate(string title, TaskTarget target, string? action) =>
        new(title, target, "should", "A deliverable", "Completion is recorded", 2, []) { Action = action };
    private static TaskTarget GoalTarget(string goal) => new("goal", GoalId: goal);
    private static TaskTarget RequirementTarget(string requirement) => new("requirement", RequirementId: requirement);
    private static PlanActionSelection Selection(string action, TaskTarget target) => new(action, target, "should", 2, []);
    private static ExistingPlanTask Existing(string title, string status, TaskTarget target, string? action) =>
        new("task-existing", title, status, target, action);
    private static ReviewedRequirement Requirement(string id) => new(id, "Reviewed preparation guidance " + id, "preparation", true, false);

    private static PlanGenerationContext Context(ReviewedRequirement[]? requirements = null, ExistingPlanTask[]? existing = null) =>
        new("demo", "Prototype", "rev-1", "rev-1",
            [new("goal-a", "First goal"), new("goal-b", "Second goal")],
            requirements ?? [], [], 5, null, false,
            existing ?? [], new([], [], []));

    private static void Invalid(Action action)
    {
        try { action(); }
        catch (MetaAiException error) when (error.Error.Code == "invalid_model_output") { return; }
        throw new Exception("Expected invalid_model_output");
    }
    private static void Assert(bool condition) { if (!condition) throw new Exception("Duplicate identity assertion failed"); }
}
