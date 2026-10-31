using System.Text.Json;
using NextStep.MetaAi.Application;
using NextStep.MetaAi.Evaluation;

namespace NextStep.MetaAi.Checks;

internal static class QualityRegressionChecks
{
    private static void Check(bool condition) { if (!condition) throw new Exception("Quality regression assertion failed"); }
    internal static void Register(Action<string, Action> test)
    {
        var ids = new[] { "beginner-limited", "mandatory-missing", "experienced", "unknown-facts", "existing-progress", "approved-resources" };
        test("evaluation defaults to all six without live opt-in", () => {
            var options = EvaluationOptions.Parse([], ids);
            Check(!options.Live && !options.List && options.ScenarioIds.Count == 6);
        });
        test("evaluation selects one or several scenarios and deduplicates calls", () => {
            var options = EvaluationOptions.Parse(["--live", "--scenario", ids[0], "--scenario", ids[1], "--scenario", ids[0]], ids);
            Check(options.Live && options.ScenarioIds.SetEquals(ids.Take(2)));
            Check(EvaluationOptions.Parse(["--scenario", ids[1]], ids).ScenarioIds.SetEquals([ids[1]]));
        });
        test("evaluation list suppresses live selection before credentials are read", () => {
            var options = EvaluationOptions.Parse(["--live", "--list", "--scenario", ids[0]], ids);
            Check(options.List && options.ScenarioIds.Count == 1);
        });
        foreach (var args in new[] { new[] { "--scenario" }, new[] { "--scenario", "unknown" },
            new[] { "--live", "--scenario", ids[0], "--scenario", "bad" }, new[] { "--scenario", "--live" },
            new[] { "--scenario=" + ids[0] }, new[] { "--typo" } })
            test("evaluation rejects invalid selection " + string.Join(" ", args), () => {
                var rejected = false;
                try { EvaluationOptions.Parse(args, ids); } catch (ArgumentException) { rejected = true; }
                Check(rejected);
            });
        test("AI-01 exact live ready-to-submit output remains structural only and always needs action review", () => {
            var candidate = Frozen("mandatory-missing"); var context = Context(true);
            var before = JsonSerializer.Serialize(candidate);
            GenerationPolicy.ValidateCandidate(candidate, context);
            var coverage = SubmissionCoverage.Reconcile(context.ReviewedRequirements, candidate.Tasks, []);
            Check(coverage.UnrepresentedRequirementIds.Count == 0); // This was the false reassurance.
            var budget = PreparationBudget.Evaluate(6, Now.AddDays(21), Now, candidate, []);
            var flags = EvaluationQuality.Flags("mandatory-missing", context, candidate, budget);
            Check(flags.Any(f => f.StartsWith("Action coverage review required for req-demo-video:")));
            Check(before == JsonSerializer.Serialize(candidate) && candidate.Tasks.Sum(t => t.EstimatedHours) == 9.5);
        });
        foreach (var prose in new[] { "Ready to submit", "The file is prepared for delivery", "Submit is not required", "Upload and check the receipt", "Envoyer et conserver la confirmation" })
            test("AI-01 action review never infers semantic completion from prose: " + prose, () => {
                var context = Context(true);
                var candidate = Frozen("mandatory-missing");
                candidate = candidate with { Tasks = [candidate.Tasks[0] with { Title = prose, CompletionCriteria = prose }] };
                GenerationPolicy.ValidateCandidate(candidate, context);
                var budget = PreparationBudget.Evaluate(6, Now.AddDays(21), Now, candidate, []);
                Check(EvaluationQuality.Flags("mandatory-missing", context, candidate, budget)
                    .Any(f => f.StartsWith("Action coverage review required for req-demo-video:")));
            });
        test("AI-01 Done retained work still cannot establish submission evidence", () => {
            var context = Context(true); var candidate = new PlanCandidateOutput([], "No new work proposed");
            var retained = new ExistingPlanTask("done-video", "Video ready", "done", new("requirement", RequirementId: "req-demo-video"));
            var coverage = SubmissionCoverage.Reconcile(context.ReviewedRequirements, [], [retained]);
            Check(coverage.UnrepresentedRequirementIds.Count == 0 && coverage.SourceCoverage == SubmissionSourceCoverage.Unknown);
            var budget = PreparationBudget.Evaluate(6, Now.AddDays(21), Now, candidate, [new("done-video", "done", 0)]);
            Check(EvaluationQuality.Flags("mandatory-missing", context, candidate, budget).Any(f => f.Contains("Done is not submission evidence")));
        });
        test("AI-02 exact live 9h beginner plan stays infeasible at 4h with actionable review flag", () => {
            var context = Context(false); var candidate = Frozen("beginner-limited"); var before = JsonSerializer.Serialize(candidate);
            GenerationPolicy.ValidateCandidate(candidate, context);
            var budget = PreparationBudget.Evaluate(2, Now.AddDays(14), Now, candidate, []);
            Check(budget.AvailableHours == 4 && budget.RemainingEffortHours == 9 && budget.Feasibility == "infeasible");
            var flag = EvaluationQuality.Flags("beginner-limited", context, candidate, budget).Single();
            Check(flag.Contains("minimum demo scope") && flag.Contains("critical path") && flag.Contains("do not shrink real effort"));
            Check(before == JsonSerializer.Serialize(candidate));
        });
        test("AI-02 fallback review retains mandatory and existing effort even when they alone exceed capacity", () => {
            var candidate = Frozen("mandatory-missing");
            var budget = PreparationBudget.Evaluate(2, Now.AddDays(14), Now, candidate, [new("started", "in_progress", 5)]);
            Check(budget.RemainingEffortHours == 14.5 && budget.AvailableHours == 4 && budget.Feasibility == "infeasible");
            Check(candidate.Tasks.Any(t => t.Priority == "must" && t.EstimatedHours == 3.5));
        });
        test("AI-02 unknown timing remains unknown rather than promising a fallback fits", () => {
            var candidate = Frozen("beginner-limited");
            var budget = PreparationBudget.Evaluate(null, null, Now, candidate, []);
            Check(budget.AvailableHours is null && budget.Feasibility == "untimed");
            Check(EvaluationQuality.Flags("beginner-limited", Context(false), candidate, budget).Length == 0);
        });
    }
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2030-01-01T00:00:00Z");
    private static PlanGenerationContext Context(bool mandatory) => new("eval", "Synthetic prototype", "v1", "v1",
        [new(mandatory ? "g-mandatory" : "g-beginner", "Prepare a prototype")],
        mandatory ? [new("req-demo-video", "Record and submit a demonstration video", "submission", true, true)] : [],
        [], 2, Now.AddDays(14), false, [], new([], ["Basic HTML"], ["No backend experience"]));
    private static PlanCandidateOutput Frozen(string id)
    {
        using var stream = typeof(QualityRegressionChecks).Assembly.GetManifestResourceStream(
            "NextStep.MetaAi.Checks.Fixtures.live-quality-1084027.json")!;
        using var document = JsonDocument.Parse(stream);
        return document.RootElement.GetProperty("candidates").GetProperty(id).Deserialize<PlanCandidateOutput>(ContractJson.CreateOptions())!;
    }
}
