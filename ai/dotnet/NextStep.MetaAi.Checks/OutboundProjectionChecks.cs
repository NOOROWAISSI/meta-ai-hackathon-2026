using System.Text.Json;
using System.Text.Json.Nodes;

namespace NextStep.MetaAi.Checks;

// Regression checks for the P2 outbound minimization boundary: the exact JSON
// that leaves for the provider, its field allowlist, its exclusions, its
// deterministic free-text budget, and its provenance labels.
internal static class OutboundProjectionChecks
{
    public static void Register(Action<string, Action> test)
    {
        test("outbound payload excludes deliverable evidence ids", () => {
            var json = Json(OutboundProjection.Build(Context(
                requirements: [new("req-video", "Record a walkthrough video", "submission", true, true,
                    new ReviewedDeliverable("video", ["record"], "rev-1", ["ev-secret-1", "ev-secret-2"]))])));
            Assert(!json.Contains("evidenceIds") && !json.Contains("ev-secret-1") && !json.Contains("ev-secret-2"));
            Assert(json.Contains("\"type\":\"video\"") && json.Contains("\"requiredActions\"") && json.Contains("rev-1"));
        });
        test("outbound payload withholds legacy titles but keeps trusted titles", () => {
            var json = Json(OutboundProjection.Build(Context(existing: [
                new("task-legacy", "Legacy untrusted title text", "in_progress", new("goal", GoalId: "goal-demo")),
                new("task-trusted", "Trusted rendered title", "not_started", new("goal", GoalId: "goal-demo"), "build_component"),
            ])));
            Assert(!json.Contains("Legacy untrusted title text"));
            Assert(json.Contains("Trusted rendered title") && json.Contains("task-legacy") && json.Contains("build_component"));
        });
        test("outbound free text budget is deterministic and preserves constraints in full", () => {
            var context = Context(
                goals: [new("goal-demo", new string('g', 3000))],
                profile: new(
                    [new(ExperienceKinds.Experience, new string('e', 3000)), new(ExperienceKinds.SelfReport, new string('s', 3000))],
                    [], [new string('c', 1000), new string('d', 1000)]));
            var first = OutboundProjection.Build(context);
            var second = OutboundProjection.Build(context);
            Assert(Json(first) == Json(second));
            var total = FreeTextTotal(first);
            Assert(total == OutboundProjection.FreeTextBudget);
            var serialized = Json(first);
            Assert(serialized.Contains(new string('c', 1000)) && serialized.Contains(new string('d', 1000)));
            Assert(!serialized.Contains(new string('s', 3000)));
        });
        test("outbound truncation keeps a meaningful final experience entry", () => {
            var payload = OutboundProjection.Build(Context(goals: [],
                profile: new([new(ExperienceKinds.Experience, new string('e', 9000))], [], [])));
            var text = payload["selfReport"]!["acceptedExperience"]![0]!["text"]!.GetValue<string>();
            Assert(text.Length == OutboundProjection.FreeTextBudget);
        });
        test("goal statements keep a usable floor before experience text is considered", () => {
            var goals = Enumerable.Range(1, 5).Select(i => new PlanGoal("goal-" + i, new string('g', 2000))).ToArray();
            var payload = OutboundProjection.Build(Context(goals: goals,
                profile: new([new(ExperienceKinds.Experience, new string('e', 5000))], [], [])));
            var statements = payload["goals"]!.AsArray().Select(g => g!["statement"]!.GetValue<string>()).ToArray();
            Assert(statements.Length == 5 && statements.All(s => s.Length >= OutboundProjection.GoalFloor));
            Assert(FreeTextTotal(payload) == OutboundProjection.FreeTextBudget);
            Assert(payload["selfReport"]!["acceptedExperience"]!.AsArray().Count == 0);
        });
        test("goal floors plus constraints over budget are rejected instead of sending unusable goals", () => {
            var goals = Enumerable.Range(1, 100).Select(i => new PlanGoal("goal-" + i, new string('g', 200))).ToArray();
            var context = Context(goals: goals);
            try { OutboundProjection.Build(context); throw new Exception("Expected invalid_input"); }
            catch (MetaAiException error) { Assert(error.Error.Code == "invalid_input"); }
        });
        test("constraints over budget are rejected instead of silently cut", () => {
            var context = Context(profile: new([], [], [new string('c', 5000), new string('d', 4000)]));
            try { OutboundProjection.Build(context); throw new Exception("Expected invalid_input"); }
            catch (MetaAiException error) { Assert(error.Error.Code == "invalid_input"); }
        });
        test("outbound payload keeps provenance kinds distinguishable", () => {
            var payload = OutboundProjection.Build(Context(profile: new([
                new(ExperienceKinds.BriefingNote, "note"), new(ExperienceKinds.Experience, "built things"),
                new(ExperienceKinds.SelfReport, "my words"), new(ExperienceKinds.AcceptedInterpretation, "system reading"),
            ], [], [])));
            var entries = payload["selfReport"]!["acceptedExperience"]!.AsArray();
            Assert(entries.Count == 4);
            Assert(entries.Select(e => e!["kind"]!.GetValue<string>()).SequenceEqual(
                ["briefing_note", "experience", "self_report", "accepted_interpretation"]));
            Assert(entries[3]!["text"]!.GetValue<string>() == "system reading");
        });
        test("outbound payload field allowlist is exact", () => {
            var payload = OutboundProjection.Build(Context());
            var keys = payload.Select(p => p.Key).OrderBy(k => k).ToArray();
            Assert(keys.SequenceEqual(["availableHoursPerWeek", "existingTasks", "goals", "opportunityId",
                "opportunityTheme", "reviewedRequirements", "reviewedResources", "reviewedSubmissionDeadline",
                "selfReport", "sourceRevision"]));
            var reportKeys = payload["selfReport"]!.AsObject().Select(p => p.Key).OrderBy(k => k).ToArray();
            Assert(reportKeys.SequenceEqual(["acceptedExperience", "constraints", "reportedSkills"]));
        });
    }

    private static PlanGenerationContext Context(
        PlanGoal[]? goals = null, ReviewedRequirement[]? requirements = null,
        ExistingPlanTask[]? existing = null, PlanningProfile? profile = null) =>
        new("demo", "Prototype", "rev-1", "rev-1",
            goals ?? [new("goal-demo", "Prepare a demo")],
            requirements ?? [], [], 5, null, false,
            existing ?? [], profile ?? new([], [], []));

    private static int FreeTextTotal(JsonObject payload)
    {
        var goals = payload["goals"]!.AsArray().Sum(g => g!["statement"]!.GetValue<string>().Length);
        var experience = payload["selfReport"]!["acceptedExperience"]!.AsArray().Sum(e => e!["text"]!.GetValue<string>().Length);
        var constraints = payload["selfReport"]!["constraints"]!.AsArray().Sum(c => c!.GetValue<string>().Length);
        return goals + experience + constraints;
    }

    private static string Json(JsonObject payload) => JsonSerializer.Serialize(payload, ContractJson.CreateOptions());
    private static void Assert(bool condition) { if (!condition) throw new Exception("Outbound projection assertion failed"); }
}
