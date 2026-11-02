using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using NextStep.MetaAi;
using NextStep.MetaAi.Application;
using NextStep.MetaAi.Evaluation;

// No sockets: every client below uses an in-memory HttpMessageHandler.
Environment.SetEnvironmentVariable("MODEL_API_KEY", "fake-test-only"); // Child process only; never consume a real ambient key.
var cases = new List<(string Name, Func<Task> Run)>();
void Test(string name, Func<Task> run) => cases.Add((name, run));
void Sync(string name, Action run) => Test(name, () => { run(); return Task.CompletedTask; });
void Reject(string name, string json, string code = "invalid_model_output", PlanGenerationContext? context = null)
    => Test(name, async () => { using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(json)));
        using var http = new HttpClient(h); await Error(code, () => Client(http).GenerateCandidateAsync(context ?? Context())); Assert(h.Count == 1); });

Test("candidate wire contract matches v0.2 field names", async () =>
{
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(TaskJson())));
    using var http = new HttpClient(h);
    var c = await Client(http).GenerateCandidateAsync(Context());
    using var json = JsonDocument.Parse(JsonSerializer.Serialize(c, ContractJson.CreateOptions()));
    Keys(json.RootElement, "tasks", "explanation");
    var task = json.RootElement.GetProperty("tasks")[0];
    Keys(task, "title", "target", "priority", "deliverable", "completionCriteria", "estimatedHours", "resourceIds");
    Keys(task.GetProperty("target"), "kind", "goalId");
    Assert(task.GetProperty("estimatedHours").GetDouble() == 2);
    Assert(h.Count == 1);
});
Test("requirement target serialization omits goalId", async () =>
{
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(TaskJson(target: new("requirement", RequirementId: "req"), priority: "must"))));
    using var http = new HttpClient(h);
    var result = await Client(http).GenerateCandidateAsync(Context() with { ReviewedRequirements = [new("req", "Submit a demo", "submission", true, true)] });
    using var json = JsonDocument.Parse(JsonSerializer.Serialize(result, ContractJson.CreateOptions()));
    Keys(json.RootElement.GetProperty("tasks")[0].GetProperty("target"), "kind", "requirementId");
});
foreach (var lane in new[] { "participation", "prize", "logistics", "unknown" })
    Test("input rejects requirement lane " + lane, async () =>
    {
        using var h = new FakeHandler((_, _, _) => throw new Exception("Unexpected call")); using var http = new HttpClient(h);
        await Error("invalid_input", () => Client(http).GenerateCandidateAsync(Context() with { ReviewedRequirements = [new("req", "Rule", lane, true, true)] }));
        Assert(h.Count == 0);
    });
foreach (bool? applies in new bool?[] { false, null })
    Test("input rejects applicability " + (applies?.ToString() ?? "unknown"), async () =>
    {
        using var h = new FakeHandler((_, _, _) => throw new Exception("Unexpected call")); using var http = new HttpClient(h);
        await Error("invalid_input", () => Client(http).GenerateCandidateAsync(Context() with { ReviewedRequirements = [new("req", "Rule", "submission", applies, true)] }));
        Assert(h.Count == 0);
    });
Test("preparation advice is allowed", async () =>
{
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(TaskJson(target: new("requirement", RequirementId: "req"), action: "prepare_requirement"))));
    using var http = new HttpClient(h);
    await Client(http).GenerateCandidateAsync(Context() with { ReviewedRequirements = [new("req", "Practice", "preparation", true, false)] });
});
Reject("goal must rejected", TaskJson(priority: "must"));
Reject("unknown goal rejected", TaskJson(target: new("goal", "other")));
Reject("unknown requirement rejected", TaskJson(target: new("requirement", RequirementId: "unknown")));
Reject("both target IDs rejected", TaskJson(target: new("goal", "goal-demo", "req")));
Reject("missing target ID rejected", TaskJson(target: new("goal")));
Reject("unknown resource rejected", TaskJson(resources: ["unknown"]));
Reject("duplicate resources rejected", TaskJson(resources: ["r", "r"]), context: Context() with { ReviewedResourceIds = ["r"], ReviewedResources = [new("r", "Reviewed", "Relevant to demo")] });
Test("ten described and allowlisted resources accepted", async () =>
{
    var ids = Enumerable.Range(0, 10).Select(i => "r" + i).ToArray();
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(TaskJson(resources: ids)))); using var http = new HttpClient(h);
    var candidate = await Client(http).GenerateCandidateAsync(Context() with {
        ReviewedResourceIds = ids,
        ReviewedResources = ids.Select(id => new ReviewedResourceInfo(id, "Reviewed resource " + id, "Relevant to the task demo")).ToArray()
    });
    Assert(candidate.Tasks.Single().ResourceIds.SequenceEqual(ids) && h.Count == 1);
});
Reject("legacy bare resource ID cannot be used without metadata", TaskJson(resources: ["r"]),
    context: Context() with { ReviewedResourceIds = ["r"] });
Reject("allowlisted but undescribed resource cannot be used", TaskJson(resources: ["r2"]),
    context: Context() with {
        ReviewedResourceIds = ["r1", "r2"],
        ReviewedResources = [new("r1", "Reviewed resource", "Useful for this demo")]
    });
Test("resource descriptors sent to model without raw IDs or URLs", async () =>
{
    using var h = new FakeHandler(async (_, request, ct) => {
        var body = await request.Content!.ReadAsStringAsync(ct);
        using var outer = JsonDocument.Parse(body);
        using var context = JsonDocument.Parse(outer.RootElement.GetProperty("messages")[1].GetProperty("content").GetString()!);
        var r = context.RootElement.GetProperty("reviewedResources")[0];
        Assert(r.GetProperty("id").GetString() == "r");
        Assert(r.GetProperty("title").GetString() == "Review handbook");
        Assert(r.GetProperty("relevanceNote").GetString() == "Demo scripting guidance");
        Assert(!context.RootElement.TryGetProperty("reviewedResourceIds", out var unusedResourceIds));
        Assert(!r.TryGetProperty("url", out var unusedUrl));
        return Reply(TaskJson(resources: ["r"]));
    });
    using var http = new HttpClient(h);
    await Client(http).GenerateCandidateAsync(Context() with {
        ReviewedResourceIds = ["r"], ReviewedResources = [new("r", "Review handbook", "Demo scripting guidance")]
    });
});
Test("descriptor not in trusted allowlist rejected before provider call", async () =>
{
    using var h = new FakeHandler((_, _, _) => throw new Exception("Unexpected call")); using var http = new HttpClient(h);
    await Error("invalid_input", () => Client(http).GenerateCandidateAsync(Context() with {
        ReviewedResourceIds = ["r"], ReviewedResources = [new("other", "Unknown", "Not reviewed")]
    })); Assert(h.Count == 0);
});
Test("duplicate resource descriptors rejected before provider call", async () =>
{
    using var h = new FakeHandler((_, _, _) => throw new Exception("Unexpected call")); using var http = new HttpClient(h);
    await Error("invalid_input", () => Client(http).GenerateCandidateAsync(Context() with {
        ReviewedResourceIds = ["r"], ReviewedResources = [new("r", "Title", "Note"), new("r", "Title", "Note")]
    })); Assert(h.Count == 0);
});
Test("blank resource descriptor rejected before provider call", async () =>
{
    using var h = new FakeHandler((_, _, _) => throw new Exception("Unexpected call")); using var http = new HttpClient(h);
    await Error("invalid_input", () => Client(http).GenerateCandidateAsync(Context() with {
        ReviewedResourceIds = ["r"], ReviewedResources = [new("r", "", "Note")]
    })); Assert(h.Count == 0);
});
var eleven = Enumerable.Range(0, 11).Select(i => "r" + i).ToArray();
Reject("eleven approved resources rejected", TaskJson(resources: eleven), context: Context() with {
    ReviewedResourceIds = eleven,
    ReviewedResources = eleven.Select(id => new ReviewedResourceInfo(id, "Reviewed resource " + id, "Relevant to the task demo")).ToArray()
});
foreach (var count in new[] { 10, 11 })
    Test("direct policy resource limit " + count, async () =>
    {
        var ids = eleven.Take(count).ToArray();
        var context = Context() with {
            ReviewedResourceIds = eleven,
            ReviewedResources = eleven.Select(id => new ReviewedResourceInfo(id, "Reviewed resource " + id, "Relevant to the task demo")).ToArray()
        };
        GenerationPolicy.ValidateInput(context);
        var candidate = new PlanCandidateOutput([TaskValue(resources: ids)], "Goal advice");
        if (count == 10) GenerationPolicy.ValidateCandidate(candidate, context);
        else await Error("invalid_model_output", () => { GenerationPolicy.ValidateCandidate(candidate, context); return Task.CompletedTask; });
    });
foreach (double? hours in new double?[] { null, 5 })
    Test("useful effort exceeds weekly value " + (hours?.ToString() ?? "unknown"), async () =>
    {
        using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(TaskJson(hours: 20)))); using var http = new HttpClient(h);
        var c = await Client(http).GenerateCandidateAsync(Context() with { AvailableHoursPerWeek = hours });
        Assert(c.Tasks[0].EstimatedHours == 20);
    });
foreach (var hours in new[] { 0d, -1d, 169d, double.NaN, double.PositiveInfinity })
    Test("invalid or zero availability " + hours, async () =>
    {
        using var h = new FakeHandler((_, _, _) => throw new Exception("Unexpected call")); using var http = new HttpClient(h);
        await Error("invalid_input", () => Client(http).GenerateCandidateAsync(Context() with { AvailableHoursPerWeek = hours })); Assert(h.Count == 0);
    });
Test("stale source rejected before send", async () =>
{
    using var h = new FakeHandler((_, _, _) => throw new Exception("Unexpected call")); using var http = new HttpClient(h);
    await Error("version_conflict", () => Client(http).GenerateCandidateAsync(Context() with { ExpectedSourceRevision = "old" })); Assert(h.Count == 0);
});
Test("closed deadline rejected before send", async () =>
{
    using var h = new FakeHandler((_, _, _) => throw new Exception("Unexpected call")); using var http = new HttpClient(h);
    await Error("invalid_input", () => Client(http).GenerateCandidateAsync(Context() with { ReviewedSubmissionDeadline = DateTimeOffset.UtcNow.AddDays(-1) })); Assert(h.Count == 0);
});
foreach (var status in new[] { "done", "in_progress" })
    Reject("exact-title guard for " + status, TaskJson(), context: Context() with { ExistingTasks = [new("old", " step 1: clarify open questions ", status, new("goal", "goal-demo"))] });
Test("existing records remain unchanged", async () =>
{
    var old = new ExistingPlanTask("old", "Other completed work", "done", new("goal", "goal-demo"));
    var context = Context() with { ExistingTasks = [old] };
    var before = JsonSerializer.Serialize(context);
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(TaskJson()))); using var http = new HttpClient(h);
    await Client(http).GenerateCandidateAsync(context);
    Assert(before == JsonSerializer.Serialize(context));
});
Test("verified future deadline does not shrink or reject useful work", async () =>
{
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(TaskJson(hours: 8)))); using var http = new HttpClient(h);
    var result = await Client(http).GenerateCandidateAsync(Context() with { ReviewedSubmissionDeadline = DateTimeOffset.UtcNow.AddDays(1) });
    Assert(result.Tasks[0].EstimatedHours == 8);
});
Reject("zero effort rejected", TaskJson(hours: 0));
Reject("negative effort rejected", TaskJson(hours: -1));
Reject("effort above per-task bound rejected", TaskJson(hours: 169));
Reject("nonfinite effort rejected", TaskJson().Replace("\"estimatedHours\":2", "\"estimatedHours\":1e999"));
Reject("duplicate task actions and target rejected", "{\"tasks\":[" + TaskObject() + "," + TaskObject() + "],\"reason\":\"prepare\"}");
Reject("malformed JSON rejected", "{bad");
Reject("truncated JSON rejected", "{\"tasks\":[");
Reject("missing field rejected", TaskJson().Replace("\"priority\":\"should\",", ""));
Reject("unexpected field rejected", TaskJson().Replace("\"action\":", "\"id\":\"model-id\",\"action\":"));
Reject("null target rejected", TaskJson().Replace("{\"kind\":\"goal\",\"goalId\":\"goal-demo\"}", "null"));
Reject("duplicate root property rejected", TaskJson().Replace("\"reason\":", "\"reason\":\"prepare\",\"reason\":"));
Reject("escaped duplicate nested property rejected", TaskJson().Replace("\"action\":", "\"act\\u0069on\":\"explore\",\"action\":"));
Reject("URL rejected", TaskJson(deliverable: "Read https://unapproved.invalid"));
Reject("unsupported eligibility claim rejected", TaskJson(deliverable: "You are eligible"));
Reject("unsupported achievement claim rejected", TaskJson(deliverable: "You have won a prize"));
Reject("generated date rejected", TaskJson(deliverable: "Submit on 2027-03-02"));
Test("unknown deadline language remains allowed", async () =>
{
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(TaskJson(reason: "unknown"))));
    using var http = new HttpClient(h); var result = await Client(http).GenerateCandidateAsync(Context());
    Assert(result.Explanation.Contains("unknown") && !result.Explanation.Contains("deadline is"));
});
Test("empty candidate rejected without a supported no-work reason", async () =>
{
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply("{\"tasks\":[],\"reason\":\"unknown\"}"))); using var http = new HttpClient(h);
    await Error("invalid_model_output", () => Client(http).GenerateCandidateAsync(Context()));
});
foreach (var finish in new[] { "length", "tool_calls", "content_filter" })
    Test("reject finish_reason " + finish, async () =>
    {
        using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(TaskJson(), finish))); using var http = new HttpClient(h);
        await Error("invalid_model_output", () => Client(http).GenerateCandidateAsync(Context()));
    });
foreach (var raw in new[] {
    "not-json", "{\"choices\":[]}", "{\"choices\":null}",
    "{\"choices\":[{\"finish_reason\":\"stop\",\"message\":{\"content\":null}}]}",
    "{\"choices\":[],\"choices\":[]}" })
    Test("unexpected envelope " + raw, async () =>
    {
        using var h = new FakeHandler((_, _, _) => Task.FromResult(Raw(raw))); using var http = new HttpClient(h);
        await Error("invalid_model_output", () => Client(http).GenerateCandidateAsync(Context()));
    });
Test("refusal rejected", async () =>
{
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Raw("{\"choices\":[{\"finish_reason\":\"stop\",\"message\":{\"refusal\":\"refused\",\"content\":\"{}\"}}]}")));
    using var http = new HttpClient(h); await Error("invalid_model_output", () => Client(http).GenerateCandidateAsync(Context()));
});
Test("oversize Content-Length rejected", async () =>
{
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Raw(new string('x', 2048)))); using var http = new HttpClient(h);
    await Error("invalid_model_output", () => Client(http, Small()).GenerateCandidateAsync(Context()));
});
Test("oversize chunked stream stopped after limit plus one", async () =>
{
    var stream = new TestStream(Encoding.UTF8.GetBytes(new string('x', 5000)));
    using var h = new FakeHandler((_, _, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StreamContent(stream) }));
    using var http = new HttpClient(h);
    await Error("invalid_model_output", () => Client(http, Small()).GenerateCandidateAsync(Context())); Assert(stream.BytesRead <= 1025);
});
Test("response exactly byte limit accepted", async () =>
{
    using var sample = Reply(TaskJson()); var raw = await sample.Content.ReadAsStringAsync();
    raw += new string(' ', 1024 - Encoding.UTF8.GetByteCount(raw));
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Raw(raw))); using var http = new HttpClient(h);
    await Client(http, Small()).GenerateCandidateAsync(Context());
});
foreach (var status in new[] { 408, 429, 500, 502, 503, 504 })
    Test("transient retry " + status, async () =>
    {
        using var h = new FakeHandler((i, _, _) => Task.FromResult(i == 1 ? new HttpResponseMessage((HttpStatusCode)status) : Reply(TaskJson())));
        using var http = new HttpClient(h); await Client(http).GenerateCandidateAsync(Context()); Assert(h.Count == 2);
    });
Test("401 no retry and no provider body disclosure", async () =>
{
    using var h = new FakeHandler((_, _, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.Unauthorized) { Content = new StringContent("private-provider-details") }));
    using var http = new HttpClient(h); var e = await Error("provider_unavailable", () => Client(http).GenerateCandidateAsync(Context()));
    Assert(!e.Error.Retryable && !e.Message.Contains("private-provider-details") && h.Count == 1);
});
Test("retry exhaustion bounded", async () =>
{
    using var h = new FakeHandler((_, _, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable))); using var http = new HttpClient(h);
    var e = await Error("provider_unavailable", () => Client(http).GenerateCandidateAsync(Context())); Assert(h.Count == 2 && e.Error.Retryable);
});
Test("network error retried without disclosure", async () =>
{
    using var h = new FakeHandler((_, _, _) => throw new HttpRequestException("private-request-details")); using var http = new HttpClient(h);
    var e = await Error("provider_unavailable", () => Client(http).GenerateCandidateAsync(Context())); Assert(h.Count == 2 && !e.Message.Contains("private-request-details"));
});
Test("Retry-After delta honored", async () =>
{
    var elapsed = Stopwatch.StartNew();
    using var h = new FakeHandler((i, _, _) => {
        if (i == 2) { Assert(elapsed.Elapsed >= TimeSpan.FromMilliseconds(900)); return Task.FromResult(Reply(TaskJson())); }
        var r = new HttpResponseMessage(HttpStatusCode.TooManyRequests); r.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(1)); return Task.FromResult(r);
    }); using var http = new HttpClient(h); await Client(http).GenerateCandidateAsync(Context()); Assert(h.Count == 2);
});
Test("Retry-After date honored", async () =>
{
    var resume = DateTimeOffset.UtcNow.AddSeconds(2);
    using var h = new FakeHandler((i, _, _) => {
        if (i == 2) { Assert(DateTimeOffset.UtcNow >= resume.AddMilliseconds(-100)); return Task.FromResult(Reply(TaskJson())); }
        var r = new HttpResponseMessage(HttpStatusCode.ServiceUnavailable); r.Headers.RetryAfter = new RetryConditionHeaderValue(resume); return Task.FromResult(r);
    }); using var http = new HttpClient(h); await Client(http).GenerateCandidateAsync(Context());
});
Test("long Retry-After returns rate limit without early retry", async () =>
{
    using var h = new FakeHandler((_, _, _) => { var r = new HttpResponseMessage(HttpStatusCode.TooManyRequests);
        r.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromHours(1)); return Task.FromResult(r); });
    using var http = new HttpClient(h); await Error("rate_limited", () => Client(http).GenerateCandidateAsync(Context())); Assert(h.Count == 1);
});
Test("caller cancellation before send", async () =>
{
    using var h = new FakeHandler((_, _, _) => throw new Exception("Unexpected call")); using var http = new HttpClient(h);
    using var ct = new CancellationTokenSource(); ct.Cancel(); await Cancelled(() => Client(http).GenerateCandidateAsync(Context(), ct.Token)); Assert(h.Count == 0);
});
Test("caller cancellation during send", async () =>
{
    using var h = new FakeHandler(async (_, _, ct) => { await Task.Delay(Timeout.InfiniteTimeSpan, ct); return Reply(TaskJson()); }); using var http = new HttpClient(h);
    using var ct = new CancellationTokenSource(); var running = Client(http).GenerateCandidateAsync(Context(), ct.Token);
    await h.Entered.Task; ct.Cancel(); await Cancelled(() => running); Assert(h.Count == 1);
});
Test("caller cancellation during read", async () =>
{
    var stream = new TestStream(block: true);
    using var h = new FakeHandler((_, _, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StreamContent(stream) })); using var http = new HttpClient(h);
    using var ct = new CancellationTokenSource(); var running = Client(http).GenerateCandidateAsync(Context(), ct.Token);
    await stream.Entered.Task; ct.Cancel(); await Cancelled(() => running);
});
Test("caller cancellation during retry delay", async () =>
{
    using var h = new FakeHandler((_, _, _) => { var r = new HttpResponseMessage(HttpStatusCode.TooManyRequests); r.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(5)); return Task.FromResult(r); });
    using var http = new HttpClient(h); using var ct = new CancellationTokenSource(); var running = Client(http).GenerateCandidateAsync(Context(), ct.Token);
    await h.Entered.Task; await Task.Delay(50); ct.Cancel(); await Cancelled(() => running); Assert(h.Count == 1);
});
Test("overall timeout cuts across retry delay", async () =>
{
    using var h = new FakeHandler((_, _, _) => { var r = new HttpResponseMessage(HttpStatusCode.TooManyRequests); r.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(5)); return Task.FromResult(r); });
    using var http = new HttpClient(h); var o = Settings(); o.OverallTimeoutSeconds = 1;
    await Error("timeout", () => Client(http, o).GenerateCandidateAsync(Context())); Assert(h.Count == 1);
});
Test("attempt timeout retries within overall deadline", async () =>
{
    using var h = new FakeHandler(async (i, _, ct) => { if (i == 1) await Task.Delay(Timeout.InfiniteTimeSpan, ct); return Reply(TaskJson()); });
    using var http = new HttpClient(h); var o = Settings(); o.AttemptTimeoutSeconds = 1;
    await Client(http, o).GenerateCandidateAsync(Context()); Assert(h.Count == 2);
});
Test("minimal self-report reaches prompt with correct labels", async () =>
{
    using var h = new FakeHandler(async (_, request, ct) => {
        var body = await request.Content!.ReadAsStringAsync(ct); using var doc = JsonDocument.Parse(body);
        Assert(doc.RootElement.GetProperty("response_format").GetProperty("type").GetString() == "json_schema");
        using var context = JsonDocument.Parse(doc.RootElement.GetProperty("messages")[1].GetProperty("content").GetString()!);
        var report = context.RootElement.GetProperty("selfReport");
        Assert(report.GetProperty("acceptedExperience")[0].GetString() == "Built a small API");
        Assert(report.GetProperty("reportedSkills")[0].GetString() == "C#");
        Assert(report.GetProperty("constraints")[0].GetString() == "Limited internet");
        Assert(context.RootElement.GetProperty("reviewedSubmissionDeadline").ValueKind == JsonValueKind.Null);
        return Reply(TaskJson()); }); using var http = new HttpClient(h); await Client(http).GenerateCandidateAsync(Context());
});
Test("unapproved endpoint rejected before credentials sent", async () =>
{
    using var h = new FakeHandler((_, _, _) => throw new Exception("Unexpected call")); using var http = new HttpClient(h);
    var o = Settings(); o.ChatCompletionsUrl = "https://unapproved.invalid/v1/chat/completions";
    await Error("provider_unavailable", () => Client(http, o).GenerateCandidateAsync(Context())); Assert(h.Count == 0);
});
Sync("DI registration resolves without network", () =>
{
    var services = new ServiceCollection(); services.AddMetaAiClient(new ConfigurationBuilder().Build());
    using var provider = services.BuildServiceProvider(); Assert(provider.GetRequiredService<IMetaModelClient>() is MetaModelClient);
});
foreach (var pair in new[] { ("invalid_input",400), ("not_found",404), ("version_conflict",409), ("rate_limited",429), ("timeout",504), ("provider_unavailable",503), ("invalid_model_output",503) })
    Sync("ApiError wire shape and status " + pair.Item1, () => {
        var e = new MetaAiException(pair.Item1, "Safe message").Error;
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(e, ContractJson.CreateOptions()));
        Keys(doc.RootElement, "code", "message", "requestId", "retryable"); Assert(ApiErrorMapping.StatusCode(e) == pair.Item2 && e.RequestId.Length > 0);
    });

var now = DateTimeOffset.Parse("2026-10-28T00:00:00Z");
BudgetAssessment Budget(double? h, double? days, double effort, params RetainedWork[] retained) =>
    PreparationBudget.Evaluate(h, days is { } d ? now.AddDays(d) : null, now,
        new(effort == 0 ? Array.Empty<CandidateTask>() : new[] { TaskValue(effort) }, "Advice"), retained);
Sync("one-day budget retains honest infeasibility", () => { var b = Budget(5, 1, 5); Assert(b.Feasibility == "infeasible" && Math.Abs(b.AvailableHours!.Value - 5d/7) < 1e-9 && b.RemainingEffortHours == 5); });
Sync("two-week budget permits more than one week", () => Assert(Budget(5, 14, 8).Feasibility == "fits_reported_budget"));
Sync("capacity boundary fits exactly", () => Assert(Budget(5, 7, 5).Feasibility == "fits_reported_budget"));
Sync("capacity boundary above one-minute tolerance is infeasible", () => Assert(Budget(5, 7, 5.02).Feasibility == "infeasible"));
Sync("two-second reporting drift does not flip exact capacity boundary", () => {
    var b = PreparationBudget.Evaluate(10, now.AddDays(28), now.AddSeconds(2),
        new([TaskValue(40)], "Advice"), []);
    Assert(b.AvailableHours is { } cap && cap < 40 && b.RemainingEffortHours == 40 && b.Feasibility == "fits_reported_budget");
});
Sync("material capacity gap still infeasible", () => {
    var b = PreparationBudget.Evaluate(10, now.AddDays(28), now.AddMinutes(30),
        new([TaskValue(40)], "Advice"), []);
    Assert(b.Feasibility == "infeasible");
});
Sync("expired cutoff cannot be rescued by tolerance", () => {
    var b = PreparationBudget.Evaluate(5, now, now.AddSeconds(2),
        new([TaskValue(0.001)], "Advice"), []);
    Assert(b.Feasibility == "infeasible");
});
Sync("retained in-progress effort counts", () => { var b = Budget(5, 7, 2, new RetainedWork("old", "in_progress", 4)); Assert(b.RemainingEffortHours == 6 && b.Feasibility == "infeasible"); });
Sync("completed work contributes zero", () => Assert(Budget(5, 7, 2, new RetainedWork("done", "done", 0)).RemainingEffortHours == 2));
Sync("unknown deadline stays untimed", () => Assert(Budget(5, null, 20).Feasibility == "untimed"));
Sync("unknown hours stay untimed", () => Assert(Budget(null, 7, 20).Feasibility == "untimed"));
Sync("zero capacity with work is infeasible", () => Assert(Budget(0, 7, 2).Feasibility == "infeasible"));
Sync("all done is no remaining gap", () => Assert(Budget(0, null, 0, new RetainedWork("done", "done", 0)).Feasibility == "no_remaining_gap"));
Sync("closed or exact cutoff leaves zero capacity", () => Assert(Budget(5, 0, 2).AvailableHours == 0 && Budget(5, -1, 2).Feasibility == "infeasible"));

// Synthetic source bytes and option sentinels only; these checks never open a socket.
Dictionary<string, byte[]> Sources() => new() {
    ["ai/dotnet/NextStep.MetaAi/MetaModelClient.cs"] = Encoding.UTF8.GetBytes("synthetic prompt source"),
    ["ai/dotnet/NextStep.MetaAi.Eval/Program.cs"] = Encoding.UTF8.GetBytes("synthetic scenarios")
};
EvaluationProvenance Provenance(MetaAiOptions? options = null, string? root = null) =>
    EvaluationProvenance.Capture(now.ToOffset(TimeSpan.FromHours(7)), options ?? Settings(), Sources(), root);
EvaluationReport Report(MetaAiOptions? options = null) => new(2, Provenance(options), [
    new("offline-example", "Synthetic serialization check", "ok", 12, 1,
        new([TaskValue()], "Synthetic advice"), "untimed", null, 2, ["Manual review required"], null)
]);
Sync("evaluation JSON envelope preserves scenario results and UTC provenance", () => {
    var report = Report();
    using var doc = JsonDocument.Parse(report.ToJson());
    Keys(doc.RootElement, "schemaVersion", "provenance", "results", "mode");
    Assert(doc.RootElement.GetProperty("mode").GetString() == "live");
    Assert(doc.RootElement.GetProperty("schemaVersion").GetInt32() == 2);
    var provenance = doc.RootElement.GetProperty("provenance");
    Keys(provenance, "executedAtUtc", "gitCommitSha", "relevantSourceHasUncommittedChanges",
        "sourceMatchesWorkingTree", "sourceFingerprint", "promptFingerprint", "scenarioVersion",
        "scenarioFingerprint", "configuration");
    Assert(provenance.GetProperty("executedAtUtc").GetDateTimeOffset() == now && report.Provenance.ExecutedAtUtc.Offset == TimeSpan.Zero);
    Assert(provenance.GetProperty("scenarioVersion").GetString() == "synthetic-v1");
    var restored = JsonSerializer.Deserialize<EvaluationReport>(report.ToJson(), ContractJson.CreateOptions())!;
    Assert(JsonSerializer.Serialize(restored.Results, ContractJson.CreateOptions()) ==
        JsonSerializer.Serialize(report.Results, ContractJson.CreateOptions()));
});
Sync("evaluation records effective model timeout and retry settings", () => {
    var options = new MetaAiOptions { Model = "synthetic-model", AttemptTimeoutSeconds = 7,
        OverallTimeoutSeconds = 19, MaxRetries = 2, MaxRetryDelaySeconds = 3, MaxResponseBytes = 2048 };
    using var doc = JsonDocument.Parse(Report(options).ToJson());
    var configuration = doc.RootElement.GetProperty("provenance").GetProperty("configuration");
    Keys(configuration, "model", "attemptTimeoutSeconds", "overallTimeoutSeconds", "maxRetries", "maxRetryDelaySeconds", "maxResponseBytes");
    Assert(configuration.GetProperty("model").GetString() == options.Model &&
        configuration.GetProperty("attemptTimeoutSeconds").GetInt32() == 7 &&
        configuration.GetProperty("overallTimeoutSeconds").GetInt32() == 19 &&
        configuration.GetProperty("maxRetries").GetInt32() == 2 &&
        configuration.GetProperty("maxRetryDelaySeconds").GetInt32() == 3 &&
        configuration.GetProperty("maxResponseBytes").GetInt32() == 2048);
});
Sync("evaluation Markdown contains the same provenance and separate manual verdict", () => {
    var report = Report(); var markdown = report.ToMarkdown();
    var provenanceJson = markdown.Split("```json" + Environment.NewLine, StringSplitOptions.None)[1].Split("```", StringSplitOptions.None)[0];
    var restored = JsonSerializer.Deserialize<EvaluationProvenance>(provenanceJson, ContractJson.CreateOptions());
    Assert(restored == report.Provenance && markdown.Contains("offline-example") &&
        markdown.Contains("Structural success is not a quality score") && markdown.Contains("Verdict / notes: ______"));
});
foreach (var format in new[] { "JSON", "Markdown" })
    Sync("evaluation " + format + " excludes credentials and environment", () => {
        var options = Settings(); options.ApiKey = "synthetic-key-DO-NOT-RECORD";
        options.ChatCompletionsUrl = "https://synthetic.invalid/?secret=DO-NOT-RECORD";
        Environment.SetEnvironmentVariable("NEXTSTEP_PROVENANCE_TEST_SECRET", "synthetic-env-DO-NOT-RECORD");
        try {
            var report = Report(options); var text = format == "JSON" ? report.ToJson() : report.ToMarkdown();
            Assert(!text.Contains("DO-NOT-RECORD") && !text.Contains("apiKey", StringComparison.OrdinalIgnoreCase) &&
                !text.Contains("MODEL_API_KEY") && !text.Contains("NEXTSTEP_PROVENANCE_TEST_SECRET") && !text.Contains("fake-test-only"));
        } finally { Environment.SetEnvironmentVariable("NEXTSTEP_PROVENANCE_TEST_SECRET", null); }
    });
Sync("evaluation fingerprint is deterministic regardless of source enumeration order", () => {
    var sources = Sources(); var reversed = sources.Reverse().ToDictionary(s => s.Key, s => s.Value);
    Assert(EvaluationProvenance.Fingerprint(sources) == EvaluationProvenance.Fingerprint(reversed));
});
Sync("evaluation fingerprint changes for uncommitted source bytes", () => {
    var sources = Sources(); var before = EvaluationProvenance.Fingerprint(sources);
    sources[sources.Keys.First()] = Encoding.UTF8.GetBytes("edited prompt source");
    Assert(before != EvaluationProvenance.Fingerprint(sources));
});
Sync("evaluation fingerprint includes file identity and additions", () => {
    var sources = Sources(); var before = EvaluationProvenance.Fingerprint(sources);
    sources["ai/dotnet/NextStep.MetaAi/Added.cs"] = sources.Values.First();
    Assert(before != EvaluationProvenance.Fingerprint(sources));
    sources.Remove(sources.Keys.First());
    Assert(before != EvaluationProvenance.Fingerprint(sources));
});
Sync("evaluation provenance survives unavailable Git and source paths", () => {
    var p = Provenance();
    Assert(p.GitCommitSha is null && p.RelevantSourceHasUncommittedChanges is null && p.SourceMatchesWorkingTree is null &&
        p.SourceFingerprint.StartsWith("sha256:") && p.SourceFingerprint.Length == 71);
});
Sync("evaluation provenance survives nonrepository Git failure", () => {
    var p = Provenance(root: Path.GetTempPath());
    Assert(p.GitCommitSha is null && p.RelevantSourceHasUncommittedChanges is null && p.SourceMatchesWorkingTree == false &&
        p.SourceFingerprint == Provenance().SourceFingerprint);
});
Sync("evaluation prompt identity changes independently of scenarios", () => {
    var sources = Sources(); sources["ai/dotnet/NextStep.MetaAi/MetaModelClient.cs"] = Encoding.UTF8.GetBytes("changed prompt");
    var changed = EvaluationProvenance.Capture(now, Settings(), sources, null); var original = Provenance();
    Assert(changed.PromptFingerprint != original.PromptFingerprint && changed.ScenarioFingerprint == original.ScenarioFingerprint);
});
Sync("evaluation scenario identity changes independently of prompt", () => {
    var sources = Sources(); sources["ai/dotnet/NextStep.MetaAi.Eval/Program.cs"] = Encoding.UTF8.GetBytes("changed scenario");
    var changed = EvaluationProvenance.Capture(now, Settings(), sources, null); var original = Provenance();
    Assert(changed.ScenarioFingerprint != original.ScenarioFingerprint && changed.PromptFingerprint == original.PromptFingerprint);
});

Test("provider candidate with omitted mandatory action still returns unchanged for reconciliation", async () =>
{
    var context = Context() with { ReviewedRequirements = [new("req-submit", "Submit the demo", "submission", true, true)] };
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(TaskJson())));
    using var http = new HttpClient(h);
    var candidate = await Client(http).GenerateCandidateAsync(context);
    var before = JsonSerializer.Serialize(candidate, ContractJson.CreateOptions());
    var coverage = SubmissionCoverage.Reconcile(context.ReviewedRequirements, candidate.Tasks, []);
    Assert(coverage.UnrepresentedRequirementIds.SequenceEqual(new[] { "req-submit" }) && h.Count == 1);
    Assert(before == JsonSerializer.Serialize(candidate, ContractJson.CreateOptions()));
});
Test("quality instructions require full mandatory actions and honest infeasible fallback without changing output", async () =>
{
    using var h = new FakeHandler(async (_, request, ct) => {
        using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct));
        var instructions = body.RootElement.GetProperty("messages")[0].GetProperty("content").GetString()!;
        Assert(instructions.Contains("preparation AND delivery") && instructions.Contains("receipt or confirmation") &&
            instructions.Contains("actual delivery/confirmation evidence must be recorded separately") &&
            instructions.Contains("minimum demo scope") && instructions.Contains("critical path") &&
            instructions.Contains("Do not claim that the fallback fits") && instructions.Contains("Account for learning unfamiliar skills"));
        return Reply(TaskJson(hours: 9));
    });
    using var http = new HttpClient(h);
    var result = await Client(http).GenerateCandidateAsync(Context() with { AvailableHoursPerWeek = 2, ReviewedSubmissionDeadline = DateTimeOffset.UtcNow.AddDays(14) });
    Assert(result.Tasks.Single().EstimatedHours == 9 && h.Count == 1);
});
NextStep.MetaAi.Checks.QualityRegressionChecks.Register(Sync);
NextStep.MetaAi.Checks.SubmissionCoverageChecks.Register(Sync);

// Structured response regression tests exercise the production decoder through an in-memory provider.
var validSelection = "{\"tasks\":[{\"action\":\"clarify\",\"target\":{\"kind\":\"goal\",\"goalId\":\"goal-demo\"},\"priority\":\"should\",\"estimatedHours\":1,\"resourceIds\":[]}],\"reason\":\"unknown\"}";
Test("structured provider output renders safe guidance and preserves public DTO", async () => {
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(validSelection))); using var http = new HttpClient(h);
    var result = await Client(http).GenerateCandidateAsync(Context());
    Assert(result.Tasks.Count == 1 && result.Tasks[0].Title.Contains("Clarify") && result.Tasks[0].EstimatedHours == 1);
    Assert(result.Explanation.Contains("unknown") && !result.Explanation.Contains("approved"));
});
foreach (var unsafeText in new[] { "You qualify to participate and are approved for entry.", "Your application has been accepted.", "The organizers have approved your submission.", "Participation is guaranteed.", "You're cleared to enter.", "تم قبول مشاركتك في المسابقة.", "تستوفي جميع شروط المشاركة." }) {
    foreach (var field in new[] { "title", "deliverable", "completionCriteria" }) {
        var root = System.Text.Json.Nodes.JsonNode.Parse(validSelection)!.AsObject(); root["tasks"]![0]![field] = unsafeText;
        Reject("structured decoder rejects unapproved " + field + " " + unsafeText, root.ToJsonString());
    }
    var asAction = System.Text.Json.Nodes.JsonNode.Parse(validSelection)!.AsObject(); asAction["tasks"]![0]!["action"] = unsafeText;
    Reject("structured decoder rejects verdict as action " + unsafeText, asAction.ToJsonString());
    var asReason = System.Text.Json.Nodes.JsonNode.Parse(validSelection)!.AsObject(); asReason["reason"] = unsafeText;
    Reject("structured decoder rejects verdict as reason " + unsafeText, asReason.ToJsonString());
    var withExplanation = System.Text.Json.Nodes.JsonNode.Parse(validSelection)!.AsObject(); withExplanation["explanation"] = unsafeText;
    Reject("structured decoder rejects free explanation " + unsafeText, withExplanation.ToJsonString());
    var oldEmpty = JsonSerializer.Serialize(new { tasks = Array.Empty<object>(), explanation = unsafeText });
    Reject("structured decoder rejects legacy empty verdict " + unsafeText, oldEmpty);
}
Reject("structured decoder rejects unknown action", validSelection.Replace("clarify", "invented"));
Reject("structured decoder rejects unknown reason", validSelection.Replace("unknown", "invented"));
Reject("structured decoder rejects application-only capacity reason", validSelection.Replace("unknown", "capacity_path"));
Reject("structured decoder rejects unknown goal", validSelection.Replace("goal-demo", "foreign-goal"));
Reject("structured decoder rejects delivery targeting goal", validSelection.Replace("clarify", "deliver"));
Reject("structured preparation guidance rejects goal target", validSelection.Replace("clarify", "prepare_requirement"));
Reject("structured preparation guidance rejects submission target", TaskJson(target: new("requirement", RequirementId: "req"), action: "prepare_requirement"), context: Context() with { ReviewedRequirements = [new("req", "Submit a video", "submission", true, true)] });
Reject("structured preparation guidance cannot be mandatory", TaskJson(target: new("requirement", RequirementId: "req"), action: "prepare_requirement", priority: "must"), context: Context() with { ReviewedRequirements = [new("req", "Review preparation guidance", "preparation", true, false)] });
Reject("structured decoder rejects unsupported resource", validSelection.Replace("\"resourceIds\":[]", "\"resourceIds\":[\"invented\"]"));
foreach (var action in new[] { "clarify", "explore", "prototype", "adapt", "prepare_artifact", "verify_channel", "deliver", "confirm_receipt" }) {
    Test("structured supported action " + action, async () => {
        var requirementAction = action is "prepare_artifact" or "verify_channel" or "deliver" or "confirm_receipt";
        var target = requirementAction ? new TaskTarget("requirement", RequirementId: "req") : new TaskTarget("goal", "goal-demo");
        var json = JsonSerializer.Serialize(new { tasks = new[] { new { action, target, priority = requirementAction ? "must" : "should", estimatedHours = 1, resourceIds = Array.Empty<string>() } }, reason = "prepare" }, ContractJson.CreateOptions());
        using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(json))); using var http = new HttpClient(h);
        var context = Context() with { ReviewedRequirements = [new("req", "Record and submit a video", "submission", true, true)] };
        var result = await Client(http).GenerateCandidateAsync(context);
        Assert(result.Tasks.Count == 1 && result.Tasks[0].EstimatedHours == 1 && !string.IsNullOrWhiteSpace(result.Tasks[0].CompletionCriteria));
    });
}
Reject("structured decoder rejects empty candidate without established no-work reason", "{\"tasks\":[],\"reason\":\"unknown\"}");
Test("structured delivery selections always show unresolved mandatory coverage", async () => {
    var json = "{\"tasks\":[{\"action\":\"deliver\",\"target\":{\"kind\":\"requirement\",\"requirementId\":\"req\"},\"priority\":\"must\",\"estimatedHours\":1,\"resourceIds\":[]}],\"reason\":\"prepare\"}";
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(json))); using var http = new HttpClient(h);
    var context = Context() with { ReviewedRequirements = [new("req", "Record and submit a video", "submission", true, true)] };
    var result = await Client(http).GenerateCandidateAsync(context);
    Assert(result.Explanation.Contains("coverage remains unresolved") && result.Tasks[0].CompletionCriteria.Contains("does not establish submission"));
});

Test("staged beginner path preserves estimates and gives ordered critical path without a feasibility promise", async () => {
    var actions = new[] { "define_outcome", "build_component", "integrate_flow", "test_flow" };
    var hours = new[] { 1.5, 3d, 3d, 1.5 };
    var selections = actions.Select((action, i) => new PlanActionSelection(action, new("goal", "goal-demo"), "should", hours[i], [])).ToArray();
    var context = Context() with { AvailableHoursPerWeek = 2, ReviewedSubmissionDeadline = DateTimeOffset.UtcNow.AddDays(14), AvailableCapacityHours = 4 };
    var json = JsonSerializer.Serialize(new { tasks = selections, reason = "scope" }, ContractJson.CreateOptions());
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(json))); using var http = new HttpClient(h);
    var output = await Client(http).GenerateCandidateAsync(context);
    var budget = PreparationBudget.Evaluate(2, context.ReviewedSubmissionDeadline, DateTimeOffset.UtcNow, output, []);
    Assert(output.Tasks.Select(t => t.EstimatedHours).SequenceEqual(hours) && budget.RemainingEffortHours == 9 && budget.Feasibility == "infeasible");
    Assert(output.Explanation.Contains("exceeds reported capacity") && output.Explanation.Contains("critical path") && output.Explanation.Contains("step 1:") && output.Explanation.Contains("step 4:") && output.Explanation.Contains("does not establish"));
    Assert(output.Tasks[0].Title.Contains("outcome") && output.Tasks[1].Title.Contains("component") && output.Tasks[2].Title.Contains("flow") && output.Tasks[3].Title.Contains("Test"));
});
Test("overloaded unstaged candidate gets application fallback without changed work or model prose", async () => {
    var context = Context() with { AvailableHoursPerWeek = 2, ReviewedSubmissionDeadline = DateTimeOffset.UtcNow.AddDays(14), RetainedEffortHours = 3, AvailableCapacityHours = 4 };
    using var h = new FakeHandler(async (_, request, ct) => {
        using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct));
        using var prompt = JsonDocument.Parse(body.RootElement.GetProperty("messages")[1].GetProperty("content").GetString()!);
        Assert(!prompt.RootElement.TryGetProperty("availableCapacityHours", out var unusedCapacity) && !prompt.RootElement.TryGetProperty("retainedEffortHours", out var unusedRetained));
        return Reply(TaskJson(hours: 2));
    }); using var http = new HttpClient(h);
    var output = await Client(http).GenerateCandidateAsync(context);
    Assert(output.Tasks.Single().EstimatedHours == 2 && output.Explanation.Contains("exceeds reported capacity") && output.Explanation.Contains("fallback critical path") && output.Explanation.Contains("not newly added tasks"));
    Assert(PlanActionRenderer.ProofFor(output, context)?.Reason == "capacity_path");
});
Test("unknown capacity does not claim overload or produce capacity fallback", async () => {
    var context = Context() with { AvailableHoursPerWeek = null, ReviewedSubmissionDeadline = null, RetainedEffortHours = 3 };
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(TaskJson(hours: 9)))); using var http = new HttpClient(h);
    var output = await Client(http).GenerateCandidateAsync(context);
    Assert(!output.Explanation.Contains("exceeds reported capacity") && !output.Explanation.Contains("fallback critical path"));
});
Test("known deadline alone does not establish capacity when build timing is unknown", async () => {
    var context = Context() with { AvailableHoursPerWeek = 2, ReviewedSubmissionDeadline = DateTimeOffset.UtcNow.AddDays(14), AvailableCapacityHours = null };
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(TaskJson(hours: 9)))); using var http = new HttpClient(h);
    var output = await Client(http).GenerateCandidateAsync(context);
    Assert(!output.Explanation.Contains("exceeds reported capacity"));
});
Test("zero available capacity still receives fallback for a very small positive estimate", async () => {
    var context = Context() with { AvailableHoursPerWeek = 2, ReviewedSubmissionDeadline = DateTimeOffset.UtcNow.AddDays(14), AvailableCapacityHours = 0 };
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(TaskJson(hours: 0.01)))); using var http = new HttpClient(h);
    var output = await Client(http).GenerateCandidateAsync(context);
    Assert(output.Tasks.Single().EstimatedHours == 0.01 && output.Explanation.Contains("fallback critical path"));
});
Test("phase 3 scope rendering proof remains valid for legacy structured actions", () => {
    var selections = new[] { new PlanActionSelection("explore", new("goal", "goal-demo"), "should", 2, []), new PlanActionSelection("prototype", new("goal", "goal-demo"), "should", 7, []) };
    var old = new PlanCandidateOutput([
        new("Step 1: Explore preparation approaches", new("goal", "goal-demo"), "should", "Outline possible approaches for the selected goal.", "Record options and what remains unknown about each.", 2, []),
        new("Step 2: Prototype a small component", new("goal", "goal-demo"), "should", "Prepare a small prototype for the selected goal.", "Review the prototype and note remaining limitations.", 7, [])
    ], "Review the smallest useful scope and dependency order. Defer optional work and reassess effort against your available time.");
    Assert(PlanActionRenderer.MatchesForDisplay(old, new(selections, "scope", Context())));
    return Task.CompletedTask;
});
Test("recording action requires reviewed source-backed video metadata and keeps evidence separate", async () => {
    var metadata = new ReviewedDeliverable("video", ["record", "deliver"], "revision-1", ["reviewed-video"]);
    var context = Context() with { ReviewedRequirements = [new("req", "Record and submit a demonstration video", "submission", true, true, metadata)] };
    var selections = new[] { "record_video", "verify_channel", "deliver", "confirm_receipt" }.Select(action => new PlanActionSelection(action, new("requirement", RequirementId: "req"), "must", 1, [])).ToArray();
    var json = JsonSerializer.Serialize(new { tasks = selections, reason = "unknown" }, ContractJson.CreateOptions());
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(json))); using var http = new HttpClient(h);
    var output = await Client(http).GenerateCandidateAsync(context);
    Assert(output.Tasks[0].Title.Contains("video") && output.Tasks[0].Title.Contains("Record"));
    Assert(output.Tasks[1].Title.Contains("Verify") && output.Tasks[2].Title.Contains("verifying") && output.Tasks[3].Title.Contains("confirmation"));
    Assert(output.Tasks[2].CompletionCriteria.Contains("does not establish submission") && output.Explanation.Contains("coverage remains unresolved"));
    Assert(!JsonSerializer.Serialize(output).Contains("portal", StringComparison.OrdinalIgnoreCase));
});
foreach (var pair in new[] { ("integrate_flow", "define_outcome"), ("test_flow", "build_component"), ("build_component", "build_component") }) {
    var selections = new[] { pair.Item1, pair.Item2 }.Select(action => new PlanActionSelection(action, new("goal", "goal-demo"), "should", 1, [])).ToArray();
    Reject("structured rejects duplicate or out of order stage " + pair, JsonSerializer.Serialize(new { tasks = selections, reason = "scope" }, ContractJson.CreateOptions()));
}
Reject("structured video recording requires metadata", TaskJson(target: new("requirement", RequirementId: "req"), action: "record_video", priority: "must"), context: Context() with { ReviewedRequirements = [new("req", "Record video", "submission", true, true)] });
Reject("structured video recording requires reviewed record action", TaskJson(target: new("requirement", RequirementId: "req"), action: "record_video", priority: "must"), context: Context() with { ReviewedRequirements = [new("req", "Video", "submission", true, true, new("video", ["deliver"], "revision-1", ["ev"]))] });
Reject("structured goal stage cannot target a requirement", TaskJson(target: new("requirement", RequirementId: "req"), action: "build_component", priority: "should"), context: Context() with { ReviewedRequirements = [new("req", "Video", "submission", true, true, new("video", ["record", "deliver"], "revision-1", ["ev"]))] });
Test("reviewed video steps reject delivery before channel verification when both are selected", async () => {
    var context = Context() with { ReviewedRequirements = [new("req", "Record and submit video", "submission", true, true, new("video", ["record", "deliver"], "revision-1", ["ev"]))] };
    var selections = new[] { "record_video", "deliver", "verify_channel" }.Select(a => new PlanActionSelection(a, new("requirement", RequirementId: "req"), "must", 1, [])).ToArray();
    var json = JsonSerializer.Serialize(new { tasks = selections, reason = "unknown" }, ContractJson.CreateOptions());
    using var h = new FakeHandler((_, _, _) => Task.FromResult(Reply(json))); using var http = new HttpClient(h);
    await Error("invalid_model_output", () => Client(http).GenerateCandidateAsync(context));
});
Reject("structured rejects retained proven action even when title differs", TaskJson(action: "build_component"), context: Context() with { ExistingTasks = [new("retained", "Earlier component", "done", new("goal", "goal-demo"), "build_component")] });
foreach (var metadata in new[] {
    new ReviewedDeliverable("video", ["record"], "stale", ["ev"]),
    new ReviewedDeliverable("video", ["record"], "revision-1", []),
    new ReviewedDeliverable("video", ["unknown"], "revision-1", ["ev"]),
    new ReviewedDeliverable("video", ["record", "record"], "revision-1", ["ev"]),
    new ReviewedDeliverable("video", ["record"], "revision-1", ["ev", "ev"]),
    new ReviewedDeliverable("audio", ["record"], "revision-1", ["ev"])
}) {
    var context = Context() with { ReviewedRequirements = [new("req", "Record a video", "submission", true, true, metadata)] };
    Test("malformed reviewed metadata rejected " + JsonSerializer.Serialize(metadata), async () => {
        using var h = new FakeHandler((_, _, _) => throw new Exception("Provider must not be called")); using var http = new HttpClient(h);
        await Error("invalid_input", () => Client(http).GenerateCandidateAsync(context)); Assert(h.Count == 0);
    });
}

var passed = 0; var failed = 0;
foreach (var item in cases)
{
    try { await item.Run().WaitAsync(TimeSpan.FromSeconds(10)); passed++; Console.WriteLine("PASS " + item.Name); }
    catch (Exception e) { failed++; Console.Error.WriteLine("FAIL " + item.Name + " (" + e.GetType().Name + ")"); }
}
Console.WriteLine($"RESULT passed={passed} failed={failed} total={cases.Count}");
Environment.ExitCode = failed == 0 ? 0 : 1;

static PlanGenerationContext Context() => new("demo", "Useful prototype", "revision-1", "revision-1",
    [new("goal-demo", "Prepare a walkthrough")], [], [], 5, null, false, [], new(["Built a small API"], ["C#"], ["Limited internet"]));
static MetaAiOptions Settings() => new() { ApiKey = "fake-test-only", OverallTimeoutSeconds = 8, AttemptTimeoutSeconds = 3, MaxRetries = 1 };
static MetaAiOptions Small() { var o = Settings(); o.MaxResponseBytes = 1024; return o; }
static MetaModelClient Client(HttpClient http, MetaAiOptions? o = null) { http.Timeout = Timeout.InfiniteTimeSpan; return new(http, Options.Create(o ?? Settings())); }
static CandidateTask TaskValue(double hours = 2, TaskTarget? target = null, string priority = "should", string[]? resources = null, string deliverable = "A walkthrough draft") =>
    new("Practice demo", target ?? new("goal", "goal-demo"), priority, deliverable, "Demonstrate the main flow", hours, resources ?? []);
static string TaskObject() => JsonSerializer.Serialize(new { action = "clarify", target = new TaskTarget("goal", "goal-demo"), priority = "should", estimatedHours = 2, resourceIds = Array.Empty<string>() }, ContractJson.CreateOptions());
static string TaskJson(double hours = 2, TaskTarget? target = null, string priority = "should", string[]? resources = null, string deliverable = "A walkthrough draft", string? action = null, string reason = "prepare")
{
    target ??= new("goal", "goal-demo");
    var task = new Dictionary<string, object> { ["action"] = action ?? (target.Kind == "requirement" ? "prepare_artifact" : "clarify"), ["target"] = target, ["priority"] = priority, ["estimatedHours"] = hours, ["resourceIds"] = resources ?? [] };
    if (deliverable != "A walkthrough draft") task["deliverable"] = deliverable;
    return JsonSerializer.Serialize(new { tasks = new[] { task }, reason }, ContractJson.CreateOptions());
}
static HttpResponseMessage Raw(string value) => new(HttpStatusCode.OK) { Content = new StringContent(value, Encoding.UTF8, "application/json") };
static HttpResponseMessage Reply(string json, string finish = "stop") => Raw(JsonSerializer.Serialize(new { choices = new[] { new { finish_reason = finish, message = new { role = "assistant", content = json } } } }));
static async Task<MetaAiException> Error(string code, Func<Task> run)
{
    try { await run(); } catch (MetaAiException e) { Assert(e.Error.Code == code && !string.IsNullOrWhiteSpace(e.Error.RequestId)); return e; }
    throw new Exception("Expected " + code);
}
static async Task Cancelled(Func<Task> run) { try { await run(); } catch (OperationCanceledException) { return; } throw new Exception("Expected caller cancellation"); }
static void Keys(JsonElement e, params string[] expected) => Assert(e.EnumerateObject().Select(p => p.Name).OrderBy(x => x).SequenceEqual(expected.OrderBy(x => x)));
static void Assert(bool ok) { if (!ok) throw new Exception("Assertion failed"); }

sealed class FakeHandler(Func<int, HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> action) : HttpMessageHandler
{
    public int Count { get; private set; }
    public TaskCompletionSource<bool> Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        Count++; Entered.TrySetResult(true);
        if (request.Headers.Authorization?.Scheme != "Bearer") throw new Exception("Missing mock authorization");
        return action(Count, request, ct);
    }
}
sealed class TestStream(byte[]? data = null, bool block = false) : Stream
{
    private readonly MemoryStream _inner = new(data ?? []);
    public int BytesRead { get; private set; }
    public TaskCompletionSource<bool> Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    public override bool CanRead => true; public override bool CanSeek => false; public override bool CanWrite => false;
    public override long Length => throw new NotSupportedException();
    public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
    public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken ct = default)
    {
        Entered.TrySetResult(true); if (block) await Task.Delay(Timeout.InfiniteTimeSpan, ct);
        var count = await _inner.ReadAsync(buffer, ct); BytesRead += count; return count;
    }
    public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    public override void Flush() => throw new NotSupportedException();
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    protected override void Dispose(bool disposing) { if (disposing) _inner.Dispose(); base.Dispose(disposing); }
}
