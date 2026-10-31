using System.Text.Json;
using NextStep.MetaAi.Application;

namespace NextStep.MetaAi.Checks;

internal static class SubmissionCoverageChecks
{
    public static void Register(Action<string, Action> test)
    {
        test("coverage reports every omitted action without rejecting a valid candidate", () => {
            var requirements = new[] { Requirement("req-video"), Requirement("req-submit") };
            var candidate = Validated(requirements, []);
            var report = SubmissionCoverage.Reconcile(requirements, candidate.Tasks, []);
            Ids(report.ReviewedOutstandingMandatoryRequirementIds, "req-submit", "req-video");
            Ids(report.CandidateRequirementIds);
            Ids(report.RetainedRequirementIds);
            Ids(report.UnrepresentedRequirementIds, "req-submit", "req-video");
        });
        test("coverage reports covered actions and omissions separately", () => {
            var requirements = new[] { Requirement("req-video"), Requirement("req-submit") };
            var candidate = Validated(requirements, [Task("req-video")]);
            var report = SubmissionCoverage.Reconcile(requirements, candidate.Tasks, []);
            Ids(report.CandidateRequirementIds, "req-video");
            Ids(report.UnrepresentedRequirementIds, "req-submit");
        });
        foreach (var status in new[] { "not_started", "in_progress", "done" })
        {
            test("coverage explicitly retained task represents an outstanding ID: " + status, () => {
                var report = SubmissionCoverage.Reconcile([Requirement("req")], [], [Retained("req", status)]);
                Ids(report.ReviewedOutstandingMandatoryRequirementIds, "req");
                Ids(report.CandidateRequirementIds);
                Ids(report.RetainedRequirementIds, "req");
                Ids(report.UnrepresentedRequirementIds);
                Assert(report.SourceCoverage == SubmissionSourceCoverage.Unknown);
            });
            test("coverage existing task is not implicitly retained: " + status, () => {
                var requirements = new[] { Requirement("req") };
                // Presence in generation context (including done) cannot choose retention.
                var candidate = Validated(requirements, [], [Retained("req", status)]);
                var report = SubmissionCoverage.Reconcile(requirements, candidate.Tasks, []);
                Ids(report.RetainedRequirementIds);
                Ids(report.UnrepresentedRequirementIds, "req");
            });
        }
        test("coverage deduplicates requirement IDs and task targets with overlap", () => {
            var requirements = new[] { Requirement("req") };
            var candidate = Validated(requirements, [Task("req"), Task("req") with { Title = "Another action" }]);
            var report = SubmissionCoverage.Reconcile([requirements[0], requirements[0]], candidate.Tasks,
                [Retained("req"), Retained("req") with { Id = "another-retained-task" }]);
            Ids(report.ReviewedOutstandingMandatoryRequirementIds, "req");
            Ids(report.CandidateRequirementIds, "req");
            Ids(report.RetainedRequirementIds, "req");
            Ids(report.UnrepresentedRequirementIds);
        });
        test("coverage ignores goal tasks and submission prose even when goal and requirement IDs coincide", () => {
            var requirements = new[] { Requirement("goal-demo") };
            var goalTask = Task("goal-demo") with {
                Target = new("goal", "goal-demo"), Title = "Submit required demonstration",
                Deliverable = "Submit all required work", CompletionCriteria = "Submission checklist complete"
            };
            var candidate = Validated(requirements, [goalTask]);
            var report = SubmissionCoverage.Reconcile(requirements, candidate.Tasks,
                [new("retained-goal", "Submit required demonstration", "done", new("goal", "goal-demo"))]);
            Ids(report.CandidateRequirementIds);
            Ids(report.RetainedRequirementIds);
            Ids(report.UnrepresentedRequirementIds, "goal-demo");
        });
        test("coverage uses ordinal IDs without case folding or whitespace normalization", () => {
            var requirements = new[] { Requirement("Req"), Requirement("req"), Requirement("req ") };
            var report = SubmissionCoverage.Reconcile(requirements, Validated(requirements, [Task("Req")]).Tasks, []);
            Ids(report.CandidateRequirementIds, "Req");
            Ids(report.UnrepresentedRequirementIds, "req", "req ");
        });
        test("coverage ignores targets outside the supplied outstanding mandatory set", () => {
            var outstanding = Requirement("req");
            var allReviewed = new[] { outstanding,
                Requirement("optional") with { IsMandatory = false },
                Requirement("advice") with { Lane = "preparation", IsMandatory = false },
                Requirement("already-submitted") };
            var candidate = Validated(allReviewed, [Task("optional"), Task("advice"), Task("already-submitted")]);
            var report = SubmissionCoverage.Reconcile([outstanding], candidate.Tasks, [Retained("unrelated")]);
            Ids(report.ReviewedOutstandingMandatoryRequirementIds, "req");
            Ids(report.CandidateRequirementIds);
            Ids(report.RetainedRequirementIds);
            Ids(report.UnrepresentedRequirementIds, "req");
        });
        test("coverage can represent eight mandatory requirements with a six-task candidate", () => {
            var requirements = Enumerable.Range(1, 8).Select(i => Requirement("req-" + i)).ToArray();
            var candidate = Validated(requirements, requirements.Take(6).Select(r => Task(r.Id)).ToArray());
            var report = SubmissionCoverage.Reconcile(requirements, candidate.Tasks, [Retained("req-7")]);
            Ids(report.ReviewedOutstandingMandatoryRequirementIds, "req-1", "req-2", "req-3", "req-4", "req-5", "req-6", "req-7", "req-8");
            Ids(report.CandidateRequirementIds, "req-1", "req-2", "req-3", "req-4", "req-5", "req-6");
            Ids(report.RetainedRequirementIds, "req-7");
            Ids(report.UnrepresentedRequirementIds, "req-8");
        });
        test("coverage does not truncate more than six omissions", () => {
            var requirements = Enumerable.Range(1, 8).Select(i => Requirement("req-" + i)).ToArray();
            var report = SubmissionCoverage.Reconcile(requirements, Validated(requirements, []).Tasks, []);
            Ids(report.UnrepresentedRequirementIds, "req-1", "req-2", "req-3", "req-4", "req-5", "req-6", "req-7", "req-8");
        });
        foreach (var coverage in Enum.GetValues<SubmissionSourceCoverage>())
        {
            test("coverage preserves source boundary with no reviewed requirements: " + coverage, () => {
                var report = SubmissionCoverage.Reconcile([], [], [], coverage);
                Assert(report.SourceCoverage == coverage);
                Ids(report.ReviewedOutstandingMandatoryRequirementIds);
                Ids(report.CandidateRequirementIds);
                Ids(report.RetainedRequirementIds);
                Ids(report.UnrepresentedRequirementIds);
            });
            test("coverage preserves source boundary when all reviewed IDs are represented: " + coverage, () => {
                var requirements = new[] { Requirement("req") };
                var report = SubmissionCoverage.Reconcile(requirements, Validated(requirements, [Task("req")]).Tasks, [], coverage);
                Assert(report.SourceCoverage == coverage);
                Ids(report.ReviewedOutstandingMandatoryRequirementIds, "req");
                Ids(report.CandidateRequirementIds, "req");
                Ids(report.UnrepresentedRequirementIds);
            });
        }
        test("coverage snapshots inputs without mutation and orders every list deterministically", () => {
            var requirements = new[] { Requirement("z"), Requirement("b"), Requirement("a"), Requirement("c") };
            var tasks = new[] { Task("z"), Task("a") };
            var retained = new[] { Retained("b"), Retained("a") };
            var before = JsonSerializer.Serialize(new { requirements, tasks, retained });
            var report = SubmissionCoverage.Reconcile(requirements, tasks, retained);
            var reversed = SubmissionCoverage.Reconcile(requirements.Reverse().ToArray(), tasks.Reverse().ToArray(), retained.Reverse().ToArray());
            Assert(JsonSerializer.Serialize(report) == JsonSerializer.Serialize(reversed));
            Assert(before == JsonSerializer.Serialize(new { requirements, tasks, retained }));
            requirements[0] = Requirement("replacement");
            tasks[0] = Task("replacement");
            retained[0] = Retained("replacement");
            Ids(report.ReviewedOutstandingMandatoryRequirementIds, "a", "b", "c", "z");
            Ids(report.CandidateRequirementIds, "a", "z");
            Ids(report.RetainedRequirementIds, "a", "b");
            Ids(report.UnrepresentedRequirementIds, "c");
            Assert(((ICollection<string>)report.UnrepresentedRequirementIds).IsReadOnly);
        });
        foreach (var invalid in new[] {
            Requirement("req") with { Lane = "preparation" },
            Requirement("req") with { IsMandatory = false },
            Requirement("req") with { Applies = false },
            Requirement("req") with { Applies = null },
            Requirement(" ") })
            test("coverage rejects an invalid reviewed outstanding projection: " + JsonSerializer.Serialize(invalid), () =>
                Invalid(() => SubmissionCoverage.Reconcile([invalid], [], [])));
        foreach (var target in new[] {
            new TaskTarget("requirement"), new TaskTarget("requirement", "goal-demo", "req"),
            new TaskTarget("goal", "goal-demo", "req"), new TaskTarget("unknown", RequirementId: "req") })
            test("coverage rejects ambiguous retained targets: " + JsonSerializer.Serialize(target), () =>
                Invalid(() => SubmissionCoverage.Reconcile([Requirement("req")], [], [Retained("req") with { Target = target }])));
        test("coverage rejects undefined source boundary", () =>
            Invalid(() => SubmissionCoverage.Reconcile([], [], [], (SubmissionSourceCoverage)99)));
        test("coverage rejects missing input collections", () => {
            Invalid(() => SubmissionCoverage.Reconcile(null!, [], []));
            Invalid(() => SubmissionCoverage.Reconcile([], null!, []));
            Invalid(() => SubmissionCoverage.Reconcile([], [], null!));
        });
        test("coverage rejects null records and missing retained identity", () => {
            Invalid(() => SubmissionCoverage.Reconcile([null!], [], []));
            Invalid(() => SubmissionCoverage.Reconcile([], [null!], []));
            Invalid(() => SubmissionCoverage.Reconcile([], [], [null!]));
            Invalid(() => SubmissionCoverage.Reconcile([Requirement("req")], [], [Retained("req") with { Id = "" }]));
        });
    }

    private static ReviewedRequirement Requirement(string id) => new(id, "Reviewed submission action", "submission", true, true);
    private static CandidateTask Task(string id) => new("Prepare " + id, new("requirement", RequirementId: id),
        "should", "A draft artifact", "Draft artifact is ready", 1, []);
    private static ExistingPlanTask Retained(string id, string status = "not_started") =>
        new("task-" + id, "Existing work for " + id, status, new("requirement", RequirementId: id));

    private static PlanCandidateOutput Validated(ReviewedRequirement[] requirements, CandidateTask[] tasks,
        ExistingPlanTask[]? existing = null)
    {
        var context = new PlanGenerationContext("synthetic-opportunity", "Prototype", "rev", "rev",
            [new("goal-demo", "Prepare a demo")], requirements, [], null, null, false,
            existing ?? [], new([], [], []));
        var candidate = new PlanCandidateOutput(tasks, "Draft tasks for reviewed context");
        GenerationPolicy.ValidateInput(context);
        GenerationPolicy.ValidateCandidate(candidate, context);
        return candidate;
    }
    private static void Invalid(Action action)
    {
        try { action(); }
        catch (MetaAiException error) when (error.Error.Code == "invalid_input") { return; }
        throw new Exception("Expected invalid coverage input");
    }
    private static void Ids(IReadOnlyList<string> actual, params string[] expected) => Assert(actual.SequenceEqual(expected));
    private static void Assert(bool condition) { if (!condition) throw new Exception("Coverage assertion failed"); }
}
