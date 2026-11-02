using System.Diagnostics;
using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Options;
using NextStep.MetaAi;
using NextStep.MetaAi.Application;
using NextStep.MetaAi.Evaluation;

// Explicit opt-in for paid external requests. All contexts below are synthetic.
var executedAtUtc = DateTimeOffset.UtcNow;
var scenarios = CreateScenarios(executedAtUtc);
EvaluationOptions selection;
try { selection = EvaluationOptions.Parse(args, scenarios.Select(s => s.Id)); }
catch (ArgumentException error)
{
    Console.Error.WriteLine(error.Message);
    return 2;
}
if (selection.Help)
{
    Console.WriteLine("Usage: dotnet run --project ai/dotnet/NextStep.MetaAi.Eval -- [--list | --live | --offline-fixtures] [--scenario ID ...]");
    Console.WriteLine("Repeat --scenario ID to select several; omitted selection means all six.");
    Console.WriteLine("Without --live, no network calls are made. --list always suppresses live calls.");
    return 0;
}
scenarios = scenarios.Where(s => selection.ScenarioIds.Contains(s.Id)).ToArray();
if ((!selection.Live && !selection.OfflineFixtures) || selection.List)
{
    Console.WriteLine("NextStep Meta quality evaluation - dry run (NO provider calls)");
    foreach (var s in scenarios)
        Console.WriteLine($"  {s.Id}: {s.Focus}");
    Console.WriteLine($"Run with --live and MODEL_API_KEY set for {scenarios.Count} logical call(s), plus configured retries.");
    return 0;
}
var key = selection.OfflineFixtures ? "synthetic-offline-only" : Environment.GetEnvironmentVariable("MODEL_API_KEY");
if (string.IsNullOrWhiteSpace(key))
{
    Console.Error.WriteLine("MODEL_API_KEY is missing. Nothing was sent.");
    return 2;
}

var settings = new MetaAiOptions { ApiKey = key };
var provenance = EvaluationProvenance.Capture(executedAtUtc, settings,
    EvaluationProvenance.ReadEmbeddedSources(), EvaluationProvenance.FindRepositoryRoot());
using var fixtureHandler = selection.OfflineFixtures ? new OfflineFixtureHandler() : null;
using var http = fixtureHandler is null ? new HttpClient() : new HttpClient(fixtureHandler);
var client = new MetaModelClient(http, Options.Create(settings));
var results = new List<EvaluationResult>();
foreach (var scenario in scenarios)
{
    if (fixtureHandler is not null) fixtureHandler.ScenarioId = scenario.Id;
    Console.Write(selection.OfflineFixtures ? $"{scenario.Id}: replaying offline fixture ... " : $"{scenario.Id}: calling Muse Spark 1.3 ... ");
    var sw = Stopwatch.StartNew();
    try
    {
        // The client validates the structured provider response before it returns.
        var candidate = await client.GenerateCandidateAsync(scenario.Context);
        var renderingProof = PlanActionRenderer.ProofFor(candidate, scenario.Context) ?? throw new InvalidOperationException("Missing renderer provenance.");
        var budget = PreparationBudget.Evaluate(
            scenario.Context.AvailableHoursPerWeek,
            scenario.Context.ReviewedSubmissionDeadline,
            DateTimeOffset.UtcNow,
            candidate,
            Array.Empty<RetainedWork>()); // Only a diagnostic: existing tasks do not expose remaining hours here.
        var flags = EvaluationQuality.Flags(scenario.Id, scenario.Context, candidate, budget);
        results.Add(new EvaluationResult(scenario.Id, scenario.Focus, "ok", sw.ElapsedMilliseconds,
            candidate.Tasks.Count, candidate, budget.Feasibility,
            budget.AvailableHours, budget.RemainingEffortHours, flags, null, renderingProof.Selections, renderingProof.Reason));
        Console.WriteLine($"ok ({candidate.Tasks.Count} tasks; {sw.ElapsedMilliseconds} ms; {flags.Length} review flags)");
    }
    catch (MetaAiException error)
    {
        results.Add(new EvaluationResult(scenario.Id, scenario.Focus, "provider_or_validation_error",
            sw.ElapsedMilliseconds, null, null, null, null, null, Array.Empty<string>(), error.Error.Code));
        Console.WriteLine($"{error.Error.Code} ({sw.ElapsedMilliseconds} ms)");
    }
    catch (Exception ex)
    {
        // Never write exception text or HTTP payloads to the report.
        results.Add(new EvaluationResult(scenario.Id, scenario.Focus, "runner_error",
            sw.ElapsedMilliseconds, null, null, null, null, null, Array.Empty<string>(), ex.GetType().Name));
        Console.WriteLine($"runner error: {ex.GetType().Name}");
    }
}

// A random suffix and create-new writes protect earlier reports, including same-second runs.
var reportDir = Path.Combine(Path.GetTempPath(), "nextstep-meta-eval-" +
    executedAtUtc.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture) + "-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(reportDir);
var report = new EvaluationReport(2, provenance, results, selection.OfflineFixtures ? "offline-fixtures" : "live");
var jsonPath = Path.Combine(reportDir, "results.json");
await using (var output = new FileStream(jsonPath, FileMode.CreateNew))
await using (var writer = new StreamWriter(output))
    await writer.WriteAsync(report.ToJson());
var markdownPath = Path.Combine(reportDir, "REVIEW.md");
await using (var output = new FileStream(markdownPath, FileMode.CreateNew))
await using (var writer = new StreamWriter(output))
    await writer.WriteAsync(report.ToMarkdown());
Console.WriteLine();
Console.WriteLine($"Validated responses: {results.Count(r => r.Status == "ok")}/{results.Count}. This is NOT a quality score.");
Console.WriteLine("Reports (synthetic context only):");
Console.WriteLine(markdownPath);
Console.WriteLine(jsonPath);
Console.WriteLine("Complete the manual rubric in REVIEW.md before claiming quality is acceptable.");
return results.All(r => r.Status == "ok") ? 0 : 1;

static IReadOnlyList<EvaluationScenario> CreateScenarios(DateTimeOffset now)
{
    static PlanningProfile Profile(string[] experience, string[] skills, string[] constraints) => new(experience, skills, constraints);
    PlanGenerationContext Context(string id, string theme, PlanGoal goal, PlanningProfile profile,
        double? hours, DateTimeOffset? deadline, IReadOnlyList<ReviewedRequirement>? requirements = null,
        IReadOnlyList<string>? resources = null, IReadOnlyList<ExistingPlanTask>? existing = null) =>
        new PlanGenerationContext(id, theme, EvaluationProvenance.ScenarioSetVersion, EvaluationProvenance.ScenarioSetVersion, new[] { goal },
            requirements ?? Array.Empty<ReviewedRequirement>(), resources ?? Array.Empty<string>(),
            hours, deadline, false, existing ?? Array.Empty<ExistingPlanTask>(), profile) {
                AvailableCapacityHours = hours is { } weekly && deadline is { } end ? Math.Max(0, (end - now).TotalDays / 7 * weekly) : null
            };

    var beginner = Context("eval-beginner", "Student prototype hackathon: simple task management web application",
        new("g-beginner", "Build and demonstrate a simple task tracker with a clear user journey"),
        Profile(Array.Empty<string>(), new[] { "Basic HTML" },
            new[] { "First hackathon", "Only two hours each week", "No backend experience" }),
        2, now.AddDays(14));
    var experienced = Context("eval-experienced", "University tech innovation hackathon: application prototype",
        new("g-experienced", "Demonstrate a working full-stack product prototype"),
        Profile(new[] { "Previously shipped three small web applications" },
            new[] { "React", "TypeScript", "C#", "REST APIs" },
            new[] { "Prefer incremental development", "Avoid introductory tutorials" }),
        10, now.AddDays(28));
    var unknown = Context("eval-unknown", "Student innovation opportunity; dates and participation conditions unverified",
        new("g-unknown", "Explore preparation options without assuming eligibility or a schedule"),
        Profile(Array.Empty<string>(), Array.Empty<string>(),
            new[] { "Submission deadline unknown", "Organizer criteria not yet verified" }),
        null, null);
    var mandatory = Context("eval-mandatory", "Student software demo competition with reviewed mandatory submission item",
        new("g-mandatory", "Prepare a demonstrable software prototype"),
        Profile(new[] { "Built one prototype" }, new[] { "React" },
            new[] { "The required demo video has not been created" }),
        6, now.AddDays(21),
        new[] { new ReviewedRequirement("req-demo-video", "Mandatory submission: record and submit a demonstration video of the working prototype; this item is currently missing.", "submission", true, true, new("video", ["record", "deliver"], EvaluationProvenance.ScenarioSetVersion, ["synthetic-reviewed-video-evidence"])) });
    var progress = Context("eval-progress", "Hackathon web application preparation with existing accepted work",
        new("g-progress", "Complete a prototype and a clear presentation"),
        Profile(new[] { "Completed initial design" }, new[] { "React", "CSS" },
            new[] { "Reuse existing wireframes and repository; do not restart finished work" }),
        7, now.AddDays(21), null, null,
        new[] {
            new ExistingPlanTask("done-wires", "Create initial wireframes", "done", new TaskTarget("goal", "g-progress")),
            new ExistingPlanTask("started-repo", "Set up React repository", "in_progress", new TaskTarget("goal", "g-progress"))
        });
    var resources = Context("eval-resources", "Student data visualization hackathon",
        new("g-resources", "Build a useful interactive visualization prototype"),
        Profile(new[] { "Has worked with CSV datasets" }, new[] { "JavaScript", "Charting" },
            new[] { "Use only reviewed resources; do not invent links" }),
        5, null, null, new[] { "reviewed-resource-001", "reviewed-resource-002" }) with {
            ReviewedResources = [
                new("reviewed-resource-001", "CSV Data Preparation Notes", "Reviewed notes on CSV parsing, inspecting columns and preparing clean datasets for JavaScript charts"),
                new("reviewed-resource-002", "Interview Preparation Guide", "Reviewed notes for general job interview practice; not relevant to visualization or CSV data")
            ]
        };
    return new[] {
        new EvaluationScenario("beginner-limited", "Beginner with 2 h/week and a verified 14-day deadline", beginner),
        new EvaluationScenario("experienced", "Experienced student; avoid generic beginner advice", experienced),
        new EvaluationScenario("unknown-facts", "Unknown availability and unverified deadline", unknown),
        new EvaluationScenario("mandatory-missing", "Reviewed mandatory submission requirement is missing", mandatory),
        new EvaluationScenario("existing-progress", "Preserve completed/in-progress work and avoid semantic duplicates", progress),
        new EvaluationScenario("approved-resources", "Do not hallucinate resource IDs or URLs", resources)
    };
}

sealed record EvaluationScenario(string Id, string Focus, PlanGenerationContext Context);

sealed class OfflineFixtureHandler : HttpMessageHandler
{
    private readonly JsonDocument fixtures = JsonDocument.Parse(typeof(OfflineFixtureHandler).Assembly.GetManifestResourceStream("evaluation-source/NextStep.MetaAi.Eval/Fixtures/structured-scenarios.json")!);
    internal string ScenarioId { get; set; } = "";
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var content = fixtures.RootElement.GetProperty(ScenarioId).GetRawText();
        var response = JsonSerializer.Serialize(new { choices = new[] { new { finish_reason = "stop", message = new { role = "assistant", content } } } });
        return Task.FromResult(new HttpResponseMessage(System.Net.HttpStatusCode.OK) { Content = new StringContent(response, System.Text.Encoding.UTF8, "application/json") });
    }
    protected override void Dispose(bool disposing) { if (disposing) fixtures.Dispose(); base.Dispose(disposing); }
}
