using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using NextStep.Api;
using NextStep.MetaAi;

// Real MySQL + in-process ASP.NET host; only the provider is replaced in tests.
// Each case owns a fresh anonymous session. No database-wide reset/delete occurs.
var cases = new List<(string Name, Func<Task> Run)>();
void Test(string name, Func<Task> run) => cases.Add((name, run));
static void Assert(bool value, string message = "Assertion failed") { if (!value) throw new Exception(message); }
await using var factory = new Factory();
var store = factory.Services.GetRequiredService<IStateStore>();
var owners = new List<string>();
async Task<(HttpClient Client, StudentProfile Profile)> Session(Factory? host = null)
{
    var client = (host ?? factory).CreateClient(); client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
    (await client.PostAsync("/api/session", null)).EnsureSuccessStatusCode();
    var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
    owners.Add(profile.Id["profile-".Length..]);
    return (client, profile);
}
static JsonObject Known(double value) => new() { ["state"] = "known", ["value"] = value, ["reportedAt"] = "2026-10-28T00:00:00Z" };
static JsonObject KnownText(string value) => new() { ["state"] = "known", ["value"] = value, ["reportedAt"] = "2026-10-28T00:00:00Z" };
async Task<(HttpClient Client, StudentProfile Profile, SubmissionState Submission, Opportunity Opportunity)> Ready(Factory? host = null)
{
    var (client, original) = await Session(host);
    var profile = original with { AvailableHoursPerWeek = Known(5), Goals = [new("goal-test", "Prepare a prototype walkthrough")], EntrantType = KnownText("individual"), Enrollment = KnownText("higher_education"), Background = "Synthetic check profile" };
    var saved = await client.PutAsJsonAsync("/api/profile", new ProfileUpdate(original.Version, profile), Wire.Json); saved.EnsureSuccessStatusCode();
    profile = (await saved.Content.ReadFromJsonAsync<StudentProfile>(Wire.Json))!;
    var opportunity = (await client.GetFromJsonAsync<Opportunity>("/api/opportunities/E01", Wire.Json))!;
    var submission = (await client.GetFromJsonAsync<SubmissionState>("/api/submissions/E01", Wire.Json))!;
    return (client, profile, submission, opportunity);
}
static AnalysisRequest Request(StudentProfile profile, SubmissionState submission, Opportunity opportunity, Plan? previous = null) => new(opportunity.SourceRevision, profile, submission, previous);
async Task<(Plan Plan, string CandidateId)> Accepted(HttpClient client, StudentProfile profile, SubmissionState submission, Opportunity opportunity)
{
    var generated = await client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(profile, submission, opportunity), Wire.Json);
    Assert(generated.IsSuccessStatusCode, await generated.Content.ReadAsStringAsync());
    var id = generated.Headers.GetValues("X-Candidate-Id").Single();
    var accepted = await client.PostAsJsonAsync("/api/plans/E01/accept", new AcceptPlan(id, null, Guid.NewGuid().ToString("N")), Wire.Json);
    Assert(accepted.IsSuccessStatusCode, await accepted.Content.ReadAsStringAsync());
    return ((await accepted.Content.ReadFromJsonAsync<Plan>(Wire.Json))!, id);
}

Test("public catalog contains five canonical source fixtures and no synthetic legacy event IDs", async () => {
    var client = factory.CreateClient(); var events = (await client.GetFromJsonAsync<Opportunity[]>("/api/opportunities", Wire.Json))!;
    Assert(events.Where(o => o.SourceRevision.StartsWith("source-fixtures-v0.2", StringComparison.Ordinal)).Select(o => o.Id).SequenceEqual(new[] { "E01", "E02", "E03", "E04", "E05" }));
    Assert(events.Count(o => o.Id == "meta-global-ai-2026") == 1);
    Assert(events.All(o => o.SourceCoverage.Participation.State == "incomplete" && o.Format == "online"));
    Assert(events.All(o => o.SourceEvidence.All(e => !string.IsNullOrWhiteSpace(e.Passage))));
    Assert((await client.GetAsync("/api/opportunities/aurora-ai")).StatusCode == HttpStatusCode.NotFound);
});
Test("private endpoints require a session and write requests require the custom same-origin header", async () => {
    var client = factory.CreateClient();
    Assert((await client.GetAsync("/api/profile")).StatusCode == HttpStatusCode.Unauthorized);
    Assert((await client.PostAsync("/api/session", null)).StatusCode == HttpStatusCode.Forbidden);
    client.DefaultRequestHeaders.Add("X-NextStep-Request", "1"); client.DefaultRequestHeaders.Add("Origin", "https://untrusted.invalid");
    Assert((await client.PostAsync("/api/session", null)).StatusCode == HttpStatusCode.Forbidden);
});
Test("blank facts remain unknown; profile writes persist in MySQL and reject stale saves", async () => {
    var (client, original) = await Session(); Assert(original.AvailableHoursPerWeek["state"]!.GetValue<string>() == "unknown");
    var body = new ProfileUpdate(original.Version, original with { AvailableHoursPerWeek = Known(0) });
    Assert((await client.PutAsJsonAsync("/api/profile", body, Wire.Json)).IsSuccessStatusCode);
    Assert((await client.PutAsJsonAsync("/api/profile", body, Wire.Json)).StatusCode == HttpStatusCode.Conflict);
    var restored = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
    Assert(restored.Version == 1 && Input.Fact<double>(restored.AvailableHoursPerWeek) == 0);
});
Test("profile and accepted plan data is isolated between anonymous sessions", async () => {
    var first = await Ready(); await Accepted(first.Client, first.Profile, first.Submission, first.Opportunity);
    var second = await Session(); Assert(second.Profile.Id != first.Profile.Id && second.Profile.Goals.Length == 0);
    Assert((await second.Client.GetFromJsonAsync<Plan[]>("/api/plans", Wire.Json))!.Length == 0);
    Assert((await second.Client.PutAsJsonAsync("/api/profile", new ProfileUpdate(0, first.Profile), Wire.Json)).StatusCode == HttpStatusCode.Conflict);
});
Test("analysis separates lanes, keeps incomplete coverage unknown, and exposes source conflicts", async () => {
    var data = await Ready();
    var response = await data.Client.PostAsJsonAsync("/api/opportunities/E01/analysis", Request(data.Profile, data.Submission, data.Opportunity), Wire.Json);
    var result = (await response.Content.ReadFromJsonAsync<AnalysisResult>(Wire.Json))!;
    Assert(result.ParticipationSummary == "needs_verification" && result.SubmissionSummary == "needs_verification");
    Assert(result.Matches.Single(m => m.RequirementId == "E01-p-enrollment").Status == "supported");
    Assert(result.Phases.All(p => p.Status == "unknown"));
    var hetic = new Catalog().Get("E03"); var team = data.Profile with { EntrantType = KnownText("individual") };
    var conflict = Matching.Analyze(hetic, team, Catalog.EmptySubmission(hetic), DateTimeOffset.UtcNow);
    Assert(conflict.ParticipationSummary == "does_not_meet_confirmed_requirement");
    Assert(conflict.Matches.Single(m => m.RequirementId == "E03-p-team-max").Status == "source_conflict");
});
Test("candidate preview does not commit a plan; acceptance is explicit and idempotent", async () => {
    var data = await Ready();
    var generated = await data.Client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(data.Profile, data.Submission, data.Opportunity), Wire.Json);
    generated.EnsureSuccessStatusCode();
    Assert((await data.Client.GetFromJsonAsync<Plan[]>("/api/plans", Wire.Json))!.Length == 0);
    var candidateId = generated.Headers.GetValues("X-Candidate-Id").Single();
    var accept = new AcceptPlan(candidateId, null, Guid.NewGuid().ToString("N"));
    var first = await data.Client.PostAsJsonAsync("/api/plans/E01/accept", accept, Wire.Json);
    var retry = await data.Client.PostAsJsonAsync("/api/plans/E01/accept", accept, Wire.Json);
    var plan = (await first.Content.ReadFromJsonAsync<Plan>(Wire.Json))!;
    Assert((await retry.Content.ReadFromJsonAsync<Plan>(Wire.Json))!.Version == plan.Version && plan.Tasks.Length == 2 && plan.Feasibility == "untimed");
    Assert(plan.TaskOrder.SequenceEqual(plan.Tasks.Select(t => t.Id)) && plan.Budget.DeadlineInstant is null);
});
Test("Done keeps original effort and submission facts; confirmed progress reads back", async () => {
    var data = await Ready(); var (plan, _) = await Accepted(data.Client, data.Profile, data.Submission, data.Opportunity);
    var task = plan.Tasks[0]; var update = new TaskUpdate(plan.Version, "done", Guid.NewGuid().ToString("N"), ["https://example.org/self-reported-artifact"]);
    var response = await data.Client.PatchAsJsonAsync($"/api/plans/E01/tasks/{task.Id}", update, Wire.Json); response.EnsureSuccessStatusCode();
    var saved = (await data.Client.GetFromJsonAsync<Plan>("/api/plans/E01", Wire.Json))!;
    Assert(saved.Tasks[0].Status == "done" && saved.Tasks[0].RemainingEstimatedHours == 0 && saved.Tasks[0].EstimatedHours == task.EstimatedHours);
    Assert(saved.Budget.RemainingEffortHours == saved.Tasks.Sum(t => t.RemainingEstimatedHours));
    Assert(JsonSerializer.Serialize(await data.Client.GetFromJsonAsync<SubmissionState>("/api/submissions/E01", Wire.Json), Wire.Json) == JsonSerializer.Serialize(data.Submission, Wire.Json));
    Assert((await data.Client.PatchAsJsonAsync($"/api/plans/E01/tasks/{task.Id}", update, Wire.Json)).IsSuccessStatusCode);
    Assert((await data.Client.GetFromJsonAsync<Plan>("/api/plans/E01", Wire.Json))!.Version == saved.Version);
});

Test("zero hours and stale sources stop generation before the provider is called", async () => {
    var data = await Ready(); var count = factory.Model.Calls;
    var stale = await data.Client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(data.Profile, data.Submission, data.Opportunity) with { ExpectedSourceRevision = "older-source" }, Wire.Json);
    Assert(stale.StatusCode == HttpStatusCode.Conflict && factory.Model.Calls == count);
    var saved = await data.Client.PutAsJsonAsync("/api/profile", new ProfileUpdate(data.Profile.Version, data.Profile with { AvailableHoursPerWeek = Known(0) }), Wire.Json);
    var profile = (await saved.Content.ReadFromJsonAsync<StudentProfile>(Wire.Json))!;
    Assert((await data.Client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(profile, data.Submission, data.Opportunity), Wire.Json)).StatusCode == HttpStatusCode.BadRequest);
    Assert(factory.Model.Calls == count);
});
Test("invalid model output and provider failure preserve the last accepted plan", async () => {
    var data = await Ready(); var (plan, _) = await Accepted(data.Client, data.Profile, data.Submission, data.Opportunity);
    factory.Model.Invalid = true;
    try { Assert((await data.Client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(data.Profile, data.Submission, data.Opportunity, plan), Wire.Json)).StatusCode == HttpStatusCode.ServiceUnavailable); }
    finally { factory.Model.Invalid = false; }
    factory.Model.ErrorCode = "timeout";
    try { Assert((await data.Client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(data.Profile, data.Submission, data.Opportunity, plan), Wire.Json)).StatusCode == HttpStatusCode.GatewayTimeout); }
    finally { factory.Model.ErrorCode = null; }
    Assert((await data.Client.GetFromJsonAsync<Plan>("/api/plans/E01", Wire.Json))!.Version == plan.Version);
});
Test("late provider responses cannot overwrite a newer profile context", async () => {
    var data = await Ready(); factory.Model.Entered = new(TaskCreationOptions.RunContinuationsAsynchronously); factory.Model.Resume = new(TaskCreationOptions.RunContinuationsAsynchronously);
    try {
        var pending = data.Client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(data.Profile, data.Submission, data.Opportunity), Wire.Json);
        await factory.Model.Entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
        (await data.Client.PutAsJsonAsync("/api/profile", new ProfileUpdate(data.Profile.Version, data.Profile with { Background = "Corrected synthetic project description" }), Wire.Json)).EnsureSuccessStatusCode();
        factory.Model.Resume.SetResult();
        Assert((await pending).StatusCode == HttpStatusCode.Conflict);
        Assert((await data.Client.GetFromJsonAsync<Plan[]>("/api/plans", Wire.Json))!.Length == 0);
    } finally { factory.Model.Resume?.TrySetResult(); factory.Model.Entered = null; factory.Model.Resume = null; }
});
Test("acceptance rejects a draft after relevant accepted facts change", async () => {
    var data = await Ready(); var generated = await data.Client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(data.Profile, data.Submission, data.Opportunity), Wire.Json); generated.EnsureSuccessStatusCode();
    var id = generated.Headers.GetValues("X-Candidate-Id").Single();
    (await data.Client.PutAsJsonAsync("/api/profile", new ProfileUpdate(data.Profile.Version, data.Profile with { AvailableHoursPerWeek = Known(3) }), Wire.Json)).EnsureSuccessStatusCode();
    Assert((await data.Client.PostAsJsonAsync("/api/plans/E01/accept", new AcceptPlan(id, null, Guid.NewGuid().ToString("N")), Wire.Json)).StatusCode == HttpStatusCode.Conflict);
    Assert((await data.Client.GetFromJsonAsync<Plan[]>("/api/plans", Wire.Json))!.Length == 0);
});
Test("competing progress writers produce one confirmed change and one version conflict", async () => {
    var data = await Ready(); var (plan, _) = await Accepted(data.Client, data.Profile, data.Submission, data.Opportunity);
    var url = $"/api/plans/E01/tasks/{plan.Tasks[0].Id}";
    var responses = await Task.WhenAll(data.Client.PatchAsJsonAsync(url, new TaskUpdate(plan.Version, "done", Guid.NewGuid().ToString("N")), Wire.Json), data.Client.PatchAsJsonAsync(url, new TaskUpdate(plan.Version, "in_progress", Guid.NewGuid().ToString("N")), Wire.Json));
    Assert(responses.Count(r => r.IsSuccessStatusCode) == 1 && responses.Count(r => r.StatusCode == HttpStatusCode.Conflict) == 1);
    Assert((await data.Client.GetFromJsonAsync<Plan>("/api/plans/E01", Wire.Json))!.Version == plan.Version + 1);
});
Test("a failed transaction keeps the complete previously confirmed MySQL state", async () => {
    var data = await Ready(); var owner = data.Profile.Id["profile-".Length..];
    var before = await store.Read(owner, state => JsonSerializer.Serialize(state, Wire.Json), CancellationToken.None);
    try { await store.Change(owner, state => { state.Profile = state.Profile with { Background = new string('x', 1100000) }; return true; }, CancellationToken.None); throw new Exception("Expected failure"); }
    catch (ApiFault) { }
    Assert(await store.Read(owner, state => JsonSerializer.Serialize(state, Wire.Json), CancellationToken.None) == before);
});
Test("missing submission items change submission assessment only", async () => {
    var data = await Ready();
    var items = data.Submission.Items.Select(item => item.RequirementId == "E01-s-screens" ? item with { State = "missing" } : item).ToArray();
    var update = await data.Client.PutAsJsonAsync("/api/submissions/E01", new SubmissionUpdate(data.Submission.Version, data.Submission with { Items = items }), Wire.Json); update.EnsureSuccessStatusCode();
    var submission = (await update.Content.ReadFromJsonAsync<SubmissionState>(Wire.Json))!;
    var response = await data.Client.PostAsJsonAsync("/api/opportunities/E01/analysis", Request(data.Profile, submission, data.Opportunity), Wire.Json);
    var analysis = (await response.Content.ReadFromJsonAsync<AnalysisResult>(Wire.Json))!;
    Assert(analysis.SubmissionSummary == "incomplete" && analysis.ParticipationSummary == "needs_verification");
});
Test("unsaving never deletes an accepted plan and hide remains independent", async () => {
    var data = await Ready(); var (plan, _) = await Accepted(data.Client, data.Profile, data.Submission, data.Opportunity);
    (await data.Client.PutAsJsonAsync("/api/preferences/E01", new OpportunityPreference("E01", false, true), Wire.Json)).EnsureSuccessStatusCode();
    var preference = (await data.Client.GetFromJsonAsync<OpportunityPreference[]>("/api/preferences", Wire.Json))!.Single();
    Assert(!preference.Saved && preference.NotInterested);
    Assert((await data.Client.GetFromJsonAsync<Plan>("/api/plans/E01", Wire.Json))!.Id == plan.Id);
});
Test("the normal provider adapter reports a missing key without manufacturing a live plan", async () => {
    // Remove any inherited key in this checks process only; no live call is allowed.
    Environment.SetEnvironmentVariable("MODEL_API_KEY", null);
    await using var realHost = new Factory(false); var data = await Ready(realHost);
    var result = await data.Client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(data.Profile, data.Submission, data.Opportunity), Wire.Json);
    Assert(result.StatusCode == HttpStatusCode.ServiceUnavailable);
    Assert((await result.Content.ReadFromJsonAsync<ApiError>(Wire.Json))!.Code == "provider_unavailable");
});

Test("all eight failure/conflict/unknown combinations retain correct participation precedence", () => {
    var catalog = new Catalog(); var baseEvent = catalog.Get("E01"); var ageEvent = catalog.Get("E02"); var conflictEvent = catalog.Get("E03");
    var profile = Input.Blank("test-summary") with { Enrollment = KnownText("higher_education"), EntrantType = KnownText("individual"), ReportedAge = Known(12) };
    var supported = baseEvent.Requirements.Single(r => r.Id == "E01-p-enrollment");
    var failed = ageEvent.Requirements.Single(r => r.Id == "E02-p-age");
    var conflict = conflictEvent.Requirements.Single(r => r.Id == "E03-p-team-max");
    foreach (var failure in new[] { false, true }) foreach (var disputed in new[] { false, true }) foreach (var unknown in new[] { false, true }) {
        var rules = new List<Rule> { supported }; if (failure) rules.Add(failed); if (disputed) rules.Add(conflict);
        var review = new Coverage(unknown ? "incomplete" : "complete", rules.Select(r => r.Id).ToArray(), unknown ? ["Additional applicable conditions need review"] : [], "2026-10-27T11:20:05Z");
        var opportunity = baseEvent with { Requirements = rules.ToArray(), SourceEvidence = baseEvent.SourceEvidence.Concat(ageEvent.SourceEvidence).Concat(conflictEvent.SourceEvidence).ToArray(), SourceCoverage = baseEvent.SourceCoverage with { Participation = review } };
        var result = Matching.Analyze(opportunity, profile, Catalog.EmptySubmission(opportunity), DateTimeOffset.UtcNow);
        Assert(result.ParticipationSummary == (failure ? "does_not_meet_confirmed_requirement" : disputed || unknown ? "needs_verification" : "meets_checked_conditions"));
        if (disputed) Assert(result.Matches.Any(m => m.Status == "source_conflict"));
        if (unknown) Assert(result.Warnings.Any(w => w.Code == "incomplete_coverage"));
    }
    var empty = baseEvent with { Requirements = [], SourceCoverage = baseEvent.SourceCoverage with { Participation = new("complete", [], [], "2026-10-27T11:20:05Z") } };
    Assert(Matching.Analyze(empty, profile, Catalog.EmptySubmission(empty), DateTimeOffset.UtcNow).ParticipationSummary == "needs_verification");
    return Task.CompletedTask;
});

Test("email accounts persist, reject incorrect credentials, and revoke only the signed-out session", async () => {
    await using var host = new Factory();
    var client = host.CreateClient(); client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
    var email = $"check-{Guid.NewGuid():N}@example.invalid"; const string password = "Synthetic-check-password-42!";
    var registered = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, password, "Account check"), Wire.Json); registered.EnsureSuccessStatusCode();
    var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!; owners.Add(profile.Id["profile-".Length..]);
    var who = await client.GetFromJsonAsync<JsonObject>("/api/auth/me", Wire.Json);
    Assert(who!["user"]!["email"]!.GetValue<string>() == email && !who["user"]!["emailVerified"]!.GetValue<bool>());
    (await client.PostAsJsonAsync("/api/auth/logout", new { }, Wire.Json)).EnsureSuccessStatusCode();
    Assert((await client.GetAsync("/api/profile")).StatusCode == HttpStatusCode.Unauthorized);
    Assert((await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, "wrong-password"), Wire.Json)).StatusCode == HttpStatusCode.Unauthorized);
    (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password), Wire.Json)).EnsureSuccessStatusCode();
    Assert((await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!.Id == profile.Id);
    var anotherDevice = host.CreateClient(); anotherDevice.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
    (await anotherDevice.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password), Wire.Json)).EnsureSuccessStatusCode();
    (await client.PostAsJsonAsync("/api/auth/logout", new { }, Wire.Json)).EnsureSuccessStatusCode();
    Assert((await anotherDevice.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!.Id == profile.Id);
    Assert((await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, password), Wire.Json)).StatusCode == HttpStatusCode.BadRequest);
});
Test("Google stays explicitly unavailable without credentials; the real catalog keeps courses separate from hackathon rules", async () => {
    var client = factory.CreateClient();
    var config = (await client.GetFromJsonAsync<JsonObject>("/api/auth/config", Wire.Json))!;
    if (!config["googleEnabled"]!.GetValue<bool>()) Assert((await client.GetAsync("/api/auth/google")).StatusCode == HttpStatusCode.ServiceUnavailable);
    Assert(AuthEndpoints.SafeReturn("https://untrusted.invalid") == "/" && AuthEndpoints.SafeReturn("//untrusted.invalid") == "/");
    var listings = (await client.GetFromJsonAsync<ListingSummary[]>("/api/listings", Wire.Json))!;
    var baseline = new DiscoveryCatalog(new Catalog()).Listings().Where(item => item.Kind == "course").ToArray();
    Assert(baseline.Length == 7 && baseline.All(item => listings.Any(current => current.Id == item.Id)) && listings.All(item => item.OfficialUrl.StartsWith("https://")));
    Assert(baseline.All(item => item.RegistrationDeadline is null));
    var sources = (await client.GetFromJsonAsync<SourceRegistration[]>("/api/sources", Wire.Json))!;
    Assert(sources.Single(s => s.Id == "prime-academy-user").Url == "https://www.instagram.com/primeacademy12/");
    Assert(sources.Single(s => s.Id == "knowledge-academy-user").Url == "https://www.instagram.com/eknowledge.learn/");
});

Test("email code resets a password once, revokes old sessions, and keeps saved profile", async () => {
    await using var host = new Factory(recovery: true); var client = host.CreateClient(); client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
    var email = $"reset-{Guid.NewGuid():N}@example.invalid"; const string oldPassword = "Old-synthetic-password-42!"; const string newPassword = "New-synthetic-password-43!";
    (await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, oldPassword), Wire.Json)).EnsureSuccessStatusCode();
    var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!; owners.Add(profile.Id["profile-".Length..]);
    var result = await client.PostAsJsonAsync("/api/auth/request-password-reset", new RequestPasswordCode(email), Wire.Json); result.EnsureSuccessStatusCode();
    var challenge = (await result.Content.ReadFromJsonAsync<PasswordChallenge>(Wire.Json))!;
    var code = host.Email.Codes[email]; Assert(code.Length == 6 && !(await result.Content.ReadAsStringAsync()).Contains(code));
    var verified = await client.PostAsJsonAsync("/api/auth/verify-password-reset", new VerifyPasswordCode(challenge.ChallengeId, code), Wire.Json); verified.EnsureSuccessStatusCode();
    var grant = (await verified.Content.ReadFromJsonAsync<JsonObject>(Wire.Json))!["resetToken"]!.GetValue<string>();
    (await client.PostAsJsonAsync("/api/auth/reset-password", new ResetPassword(challenge.ChallengeId, grant, newPassword), Wire.Json)).EnsureSuccessStatusCode();
    Assert((await client.GetAsync("/api/profile")).StatusCode == HttpStatusCode.Unauthorized);
    Assert((await client.PostAsJsonAsync("/api/auth/reset-password", new ResetPassword(challenge.ChallengeId, grant, newPassword), Wire.Json)).StatusCode == HttpStatusCode.BadRequest);
    Assert((await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, oldPassword), Wire.Json)).StatusCode == HttpStatusCode.Unauthorized);
    (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, newPassword), Wire.Json)).EnsureSuccessStatusCode();
    Assert((await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!.Id == profile.Id);
});
Test("recovery limits code guesses and never sends to an unknown account", async () => {
    await using var host = new Factory(recovery: true); var client = host.CreateClient(); client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
    var email = $"guesses-{Guid.NewGuid():N}@example.invalid";
    (await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Synthetic-password-42!"), Wire.Json)).EnsureSuccessStatusCode();
    var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!; owners.Add(profile.Id["profile-".Length..]);
    var challenge = (await (await client.PostAsJsonAsync("/api/auth/request-password-reset", new RequestPasswordCode(email), Wire.Json)).Content.ReadFromJsonAsync<PasswordChallenge>(Wire.Json))!;
    for (var i = 0; i < 5; i++) Assert((await client.PostAsJsonAsync("/api/auth/verify-password-reset", new VerifyPasswordCode(challenge.ChallengeId, "000000"), Wire.Json)).StatusCode == HttpStatusCode.BadRequest);
    Assert((await client.PostAsJsonAsync("/api/auth/verify-password-reset", new VerifyPasswordCode(challenge.ChallengeId, host.Email.Codes[email]), Wire.Json)).StatusCode == HttpStatusCode.BadRequest);
});
Test("unknown accounts keep the same recovery response and mail failures cannot report success", async () => {
    await using var host = new Factory(recovery: true); var client = host.CreateClient(); client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
    var unknown = await client.PostAsJsonAsync("/api/auth/request-password-reset", new RequestPasswordCode($"unknown-{Guid.NewGuid():N}@example.invalid"), Wire.Json); unknown.EnsureSuccessStatusCode();
    var unknownChallenge = (await unknown.Content.ReadFromJsonAsync<PasswordChallenge>(Wire.Json))!; Assert(host.Email.Codes.Count == 0);
    await host.Services.GetRequiredService<PasswordRecoveryRepository>().Delivery(unknownChallenge.ChallengeId, false, CancellationToken.None);
    var email = $"mail-failure-{Guid.NewGuid():N}@example.invalid";
    (await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Synthetic-password-42!"), Wire.Json)).EnsureSuccessStatusCode();
    var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!; owners.Add(profile.Id["profile-".Length..]);
    host.Email.Fail = true;
    Assert((await client.PostAsJsonAsync("/api/auth/request-password-reset", new RequestPasswordCode(email), Wire.Json)).StatusCode == HttpStatusCode.ServiceUnavailable);
    Assert(!host.Email.Codes.ContainsKey(email));
    host.Email.Fail = false;
    (await client.PostAsJsonAsync("/api/auth/request-password-reset", new RequestPasswordCode(email), Wire.Json)).EnsureSuccessStatusCode();
    Assert(host.Email.Codes.ContainsKey(email));
    Assert((await client.PostAsJsonAsync("/api/auth/request-password-reset", new RequestPasswordCode(email), Wire.Json)).StatusCode == HttpStatusCode.TooManyRequests);
});

Test("resending invalidates the previous code and expired codes cannot authorize a reset", async () => {
    await using var host = new Factory(recovery: true); var client = host.CreateClient(); client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
    var email = $"expiry-{Guid.NewGuid():N}@example.invalid";
    (await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Synthetic-password-42!"), Wire.Json)).EnsureSuccessStatusCode();
    var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!; owners.Add(profile.Id["profile-".Length..]);
    var first = (await (await client.PostAsJsonAsync("/api/auth/request-password-reset", new RequestPasswordCode(email), Wire.Json)).Content.ReadFromJsonAsync<PasswordChallenge>(Wire.Json))!;
    var firstCode = host.Email.Codes[email];
    await using var db = new MySqlConnector.MySqlConnection(Environment.GetEnvironmentVariable("NEXTSTEP_CHECKS_CONNECTION")); await db.OpenAsync();
    await using (var command = new MySqlConnector.MySqlCommand("UPDATE password_recovery SET requested_at=UTC_TIMESTAMP()-INTERVAL 61 SECOND WHERE request_id=@id", db)) { command.Parameters.AddWithValue("@id", first.ChallengeId); await command.ExecuteNonQueryAsync(); }
    var second = (await (await client.PostAsJsonAsync("/api/auth/request-password-reset", new RequestPasswordCode(email), Wire.Json)).Content.ReadFromJsonAsync<PasswordChallenge>(Wire.Json))!;
    Assert(second.ChallengeId != first.ChallengeId);
    Assert((await client.PostAsJsonAsync("/api/auth/verify-password-reset", new VerifyPasswordCode(first.ChallengeId, firstCode), Wire.Json)).StatusCode == HttpStatusCode.BadRequest);
    await using (var command = new MySqlConnector.MySqlCommand("UPDATE password_recovery SET expires_at=UTC_TIMESTAMP()-INTERVAL 1 MINUTE WHERE request_id=@id", db)) { command.Parameters.AddWithValue("@id", second.ChallengeId); await command.ExecuteNonQueryAsync(); }
    Assert((await client.PostAsJsonAsync("/api/auth/verify-password-reset", new VerifyPasswordCode(second.ChallengeId, host.Email.Codes[email]), Wire.Json)).StatusCode == HttpStatusCode.BadRequest);
});

Test("student seed creates a real login once and preserves subsequent profile edits", async () => {
    await using var host = new Factory();
    var seed = host.Services.GetRequiredService<DemoStudentSeed>();
    var student = new DemoStudent($"seed-{Guid.NewGuid():N}@example.invalid", "طالب تجريبي", "Synthetic seed profile", ["AI"], ["Python"], 6);
    var first = await seed.Run([student], CancellationToken.None); Assert(first.Created == 1 && first.Skipped == 0);
    var client = host.CreateClient(); client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
    (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(student.Email, DemoStudentSeed.Password), Wire.Json)).EnsureSuccessStatusCode();
    var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!; owners.Add(profile.Id["profile-".Length..]);
    Assert(profile.AvailableHoursPerWeek["value"]!.GetValue<double>() == 6 && profile.ReportedAge["state"]!.GetValue<string>() == "unknown");
    var update = profile with { Background = "Confirmed edit after seeding" };
    (await client.PutAsJsonAsync("/api/profile", new ProfileUpdate(profile.Version, update), Wire.Json)).EnsureSuccessStatusCode();
    var again = await seed.Run([student], CancellationToken.None); Assert(again.Created == 0 && again.Skipped == 1);
    Assert((await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!.Background == update.Background);
});

Test("account profile editor persists display fields with canonical facts and rejects stale writes", async () => {
    await using var host = new Factory();
    var (client, profile) = await Session(host);
    var editor = new JsonObject { ["displayName"] = "Synthetic account", ["fieldOfStudy"] = "Computer Science", ["weeklyHours"] = 5, ["skills"] = new JsonArray("Python"), ["projects"] = new JsonArray() };
    var updated = profile with { Background = "A confirmed self-report", AvailableHoursPerWeek = Known(5) };
    var response = await client.PutAsJsonAsync("/api/profile/editor", new ProfileEditorUpdate(profile.Version, updated, editor), Wire.Json); response.EnsureSuccessStatusCode();
    var saved = (await response.Content.ReadFromJsonAsync<ProfileEditorView>(Wire.Json))!;
    Assert(saved.Profile.Version == profile.Version + 1 && saved.Editor["fieldOfStudy"]!.GetValue<string>() == "Computer Science");
    var reload = (await client.GetFromJsonAsync<ProfileEditorView>("/api/profile/editor", Wire.Json))!;
    Assert(reload.Profile.Background == updated.Background && reload.Editor["savedAt"] is not null);
    Assert((await client.PutAsJsonAsync("/api/profile/editor", new ProfileEditorUpdate(profile.Version, updated, editor), Wire.Json)).StatusCode == HttpStatusCode.Conflict);
    var other = await Session(host);
    Assert((await other.Client.PutAsJsonAsync("/api/profile/editor", new ProfileEditorUpdate(0, updated, editor), Wire.Json)).StatusCode == HttpStatusCode.Conflict);
});
Test("real courses support atomic account preferences without overwriting the other selection", async () => {
    await using var host = new Factory();
    var (client, _) = await Session(host);
    var saved = await client.PatchAsJsonAsync("/api/preferences/harvard-cs50x", new PreferenceChange(Saved: true), Wire.Json); saved.EnsureSuccessStatusCode();
    var hidden = await client.PatchAsJsonAsync("/api/preferences/harvard-cs50x", new PreferenceChange(NotInterested: true), Wire.Json); hidden.EnsureSuccessStatusCode();
    var value = (await hidden.Content.ReadFromJsonAsync<PreferenceView>(Wire.Json))!;
    Assert(value.Saved && value.NotInterested && DateTimeOffset.TryParse(value.SavedAt, out _));
    Assert((await client.PatchAsJsonAsync("/api/preferences/harvard-cs50x", new PreferenceChange(Saved: false, ExpectedAccountId: "a-different-account"), Wire.Json)).StatusCode == HttpStatusCode.Conflict);
    var reloaded = (await client.GetFromJsonAsync<PreferenceView[]>("/api/preferences/snapshot", Wire.Json))!.Single();
    Assert(reloaded.Saved && reloaded.NotInterested);
    Assert((await client.PatchAsJsonAsync("/api/preferences/aurora-ai", new PreferenceChange(Saved: true), Wire.Json)).StatusCode == HttpStatusCode.NotFound);
});
Test("reviewed real resource descriptors reach the provider using the same IDs exposed by the API", async () => {
    await using var host = new Factory(); var (client, profile, _, _) = await Ready(host);
    var opportunity = (await client.GetFromJsonAsync<Opportunity>("/api/opportunities/E02", Wire.Json))!;
    var submission = (await client.GetFromJsonAsync<SubmissionState>("/api/submissions/E02", Wire.Json))!;
    var resources = (await client.GetFromJsonAsync<LearningResource[]>("/api/opportunities/E02/resources", Wire.Json))!;
    Assert(resources.Length > 0 && resources.All(resource => !resource.Url.Contains("example.org")));
    (await client.PostAsJsonAsync("/api/opportunities/E02/plan-candidates", new AnalysisRequest(opportunity.SourceRevision, profile, submission), Wire.Json)).EnsureSuccessStatusCode();
    var context = host.Model.LastContext!;
    Assert(context.ReviewedResourceIds.Count > 0 && context.ReviewedResources.Count == context.ReviewedResourceIds.Count);
    Assert(context.ReviewedResources.All(resource => resources.Any(record => record.Id == resource.Id && record.Title == resource.Title)));
});

Test("submission reconciliation keeps partial criteria outstanding without claiming failure or completeness", async () => {
    await using var host = new Factory(); var data = await Ready(host); var rule = data.Opportunity.Requirements.First(r => r.Lane == "submission" && r.IsMandatory);
    rule = rule with { Evaluation = new JsonObject { ["key"] = "submission_criterion", ["criterion"] = "duration", ["parameters"] = new JsonObject() } };
    var opportunity = data.Opportunity with { Requirements = [rule] };
    var submission = new SubmissionState(opportunity.Id, 1, [new(rule.Id, "reported_present", new() { ["presence"] = "reported_met", ["duration"] = "unknown" }, "self_report")]);
    var result = SubmissionReconciliation.Assess(opportunity, data.Profile, submission, null, [], []);
    Assert(result.Report.ReviewedOutstandingMandatoryRequirementIds.Contains(rule.Id) && result.Report.UnrepresentedRequirementIds.Contains(rule.Id));
    Assert(result.Report.SourceCoverage == "incomplete" && Matching.Analyze(opportunity, data.Profile, submission, DateTimeOffset.UtcNow).Matches.Single().Status == "unknown");
    submission = submission with { Version = 2, Items = [submission.Items[0] with { CriterionResults = new() { ["duration"] = "reported_met" } }] };
    Assert(SubmissionReconciliation.Assess(opportunity, data.Profile, submission, null, [], []).Report.ReviewedOutstandingMandatoryRequirementIds.Length == 0);
    Assert(SubmissionReconciliation.Assess(opportunity, data.Profile, submission, null, [], []).Report.SourceCoverage == "incomplete");
});
Test("unknown applicability and stale or conflicting rules stay outside reconciliation and visible", async () => {
    await using var host = new Factory(); var data = await Ready(host); var rule = data.Opportunity.Requirements.First(r => r.Lane == "submission" && r.IsMandatory);
    var rules = new[] { rule with { Id = "unknown-division", Applicability = new() { ["key"] = "division", ["division"] = "college_plus" } }, rule with { Id = "stale-rule", SourceStatus = "stale" }, rule with { Id = "conflicting-rule", SourceStatus = "conflicting" } };
    var opportunity = data.Opportunity with { Requirements = rules };
    var result = SubmissionReconciliation.Assess(opportunity, data.Profile, Catalog.EmptySubmission(opportunity), null, [], []);
    Assert(result.Report.ReviewedOutstandingMandatoryRequirementIds.Length == 0 && result.UnresolvedRequirementIds.Length == 3 && result.Report.SourceCoverage == "incomplete");
});
Test("retention includes Done and artifacts but does not turn representation into fulfillment", async () => {
    await using var host = new Factory(); var data = await Ready(host); var requirement = data.Opportunity.Requirements.First(r => r.Lane == "submission" && r.IsMandatory);
    PreparationTask Task(string id, string status, string[] urls) => new(id, "Retained " + id, new("requirement", RequirementId: requirement.Id), "must", "Artifact draft", "Review the artifact", 2, status == "done" ? 0 : 2, status, [], urls);
    var tasks = new[] { Task("done", "done", ["https://example.invalid/my-artifact"]), Task("started", "in_progress", []), Task("linked", "not_started", ["https://example.invalid/draft"]), Task("replaceable", "not_started", []) };
    var plan = new Plan("plan-test", 1, Matching.Context(data.Opportunity, data.Profile, data.Submission), data.Profile.Goals, tasks, tasks.Select(t => t.Id).ToArray(), new(DateTimeOffset.UtcNow.ToString("O"), 5, null, null, 6, "Test"), "untimed", []);
    var retained = SubmissionReconciliation.Retain(plan);
    Assert(retained.Select(t => t.Id).SequenceEqual(new[] { "done", "started", "linked" }));
    var result = SubmissionReconciliation.Assess(data.Opportunity, data.Profile, data.Submission, plan, [], retained);
    Assert(result.Report.ReviewedOutstandingMandatoryRequirementIds.Contains(requirement.Id) && result.Report.RetainedRequirementIds.Contains(requirement.Id) && !result.Report.UnrepresentedRequirementIds.Contains(requirement.Id));
    Assert(retained[0].ArtifactUrls.Single() == tasks[0].ArtifactUrls.Single() && retained[0].EstimatedHours == 2 && retained[0].RemainingEstimatedHours == 0 && result.Report.SourceCoverage == "incomplete");
});
Test("coverage endpoint is private, candidate scoped and reports omissions without rejecting acceptance", async () => {
    await using var host = new Factory(); var data = await Ready(host); var other = await Session(host);
    Assert((await host.CreateClient().GetAsync("/api/submissions/E01/coverage")).StatusCode == HttpStatusCode.Unauthorized);
    var response = await data.Client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(data.Profile, data.Submission, data.Opportunity), Wire.Json); response.EnsureSuccessStatusCode();
    var id = response.Headers.GetValues("X-Candidate-Id").Single();
    var candidateJson = await response.Content.ReadAsStringAsync(); Assert(!candidateJson.Contains("unrepresentedRequirementIds"));
    var coverage = (await data.Client.GetFromJsonAsync<SubmissionCoverageView>("/api/submissions/E01/coverage?candidateId=" + id, Wire.Json))!;
    Assert(coverage.CandidateId == id && coverage.Report.UnrepresentedRequirementIds.Length > 0 && coverage.Report.SourceCoverage == "incomplete");
    Assert((await other.Client.GetAsync("/api/submissions/E01/coverage?candidateId=" + id)).StatusCode == HttpStatusCode.NotFound);
    Assert((await other.Client.PostAsJsonAsync("/api/plans/E01/accept", new AcceptPlan(id, null, Guid.NewGuid().ToString("N")), Wire.Json)).StatusCode == HttpStatusCode.NotFound);
    var accepted = await data.Client.PostAsJsonAsync("/api/plans/E01/accept", new AcceptPlan(id, null, Guid.NewGuid().ToString("N")), Wire.Json); accepted.EnsureSuccessStatusCode();
    var plan = (await accepted.Content.ReadFromJsonAsync<Plan>(Wire.Json))!;
    Assert(plan.Warnings.Any(w => w.StartsWith("Submission action not represented")) && plan.Tasks.Length == 2);
    var after = (await data.Client.GetFromJsonAsync<SubmissionCoverageView>("/api/submissions/E01/coverage", Wire.Json))!;
    Assert(after.PlanVersion == 1 && after.Report.SourceCoverage == "incomplete");
});
Test("changed submission evidence invalidates both coverage preview and acceptance without touching the plan", async () => {
    await using var host = new Factory(); var data = await Ready(host); var original = await Accepted(data.Client, data.Profile, data.Submission, data.Opportunity);
    host.Model.Prefix = "Replacement";
    var generated = await data.Client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(data.Profile, data.Submission, data.Opportunity, original.Plan), Wire.Json); generated.EnsureSuccessStatusCode();
    var id = generated.Headers.GetValues("X-Candidate-Id").Single();
    var changed = data.Submission with { Items = data.Submission.Items.Select((item, i) => i == 0 ? item with { State = "reported_present", CriterionResults = new() { ["presence"] = "reported_met" } } : item).ToArray() };
    (await data.Client.PutAsJsonAsync("/api/submissions/E01", new SubmissionUpdate(changed.Version, changed), Wire.Json)).EnsureSuccessStatusCode();
    Assert((await data.Client.GetAsync("/api/submissions/E01/coverage?candidateId=" + id)).StatusCode == HttpStatusCode.Conflict);
    Assert((await data.Client.PostAsJsonAsync("/api/plans/E01/accept", new AcceptPlan(id, 1, Guid.NewGuid().ToString("N")), Wire.Json)).StatusCode == HttpStatusCode.Conflict);
    Assert((await data.Client.GetFromJsonAsync<Plan>("/api/plans/E01", Wire.Json))!.Version == 1);
    Assert((await data.Client.GetFromJsonAsync<SubmissionCoverageView>("/api/submissions/E01/coverage", Wire.Json))!.PlanOutdated);
});
Test("regeneration preserves completed identity and artifacts while replacing only unfinished unlinked work", async () => {
    await using var host = new Factory(); var data = await Ready(host); var first = await Accepted(data.Client, data.Profile, data.Submission, data.Opportunity);
    var task = first.Plan.Tasks[0]; var progress = await data.Client.PatchAsJsonAsync("/api/plans/E01/tasks/" + task.Id, new TaskUpdate(1, "done", Guid.NewGuid().ToString("N"), ["https://example.invalid/self-reported-artifact"]), Wire.Json); progress.EnsureSuccessStatusCode();
    var current = (await progress.Content.ReadFromJsonAsync<Plan>(Wire.Json))!; host.Model.Prefix = "Fresh";
    var generated = await data.Client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(data.Profile, data.Submission, data.Opportunity, current), Wire.Json); generated.EnsureSuccessStatusCode();
    var id = generated.Headers.GetValues("X-Candidate-Id").Single();
    var accepted = await data.Client.PostAsJsonAsync("/api/plans/E01/accept", new AcceptPlan(id, 2, Guid.NewGuid().ToString("N")), Wire.Json); accepted.EnsureSuccessStatusCode();
    var plan = (await accepted.Content.ReadFromJsonAsync<Plan>(Wire.Json))!;
    Assert(plan.Version == 3 && plan.Tasks.Length == 3 && !plan.Tasks.Any(t => t.Id == first.Plan.Tasks[1].Id));
    Assert(JsonSerializer.Serialize(plan.Tasks.Single(t => t.Id == task.Id), Wire.Json) == JsonSerializer.Serialize(current.Tasks.Single(t => t.Id == task.Id), Wire.Json));
    Assert(JsonSerializer.Serialize(await data.Client.GetFromJsonAsync<SubmissionState>("/api/submissions/E01", Wire.Json), Wire.Json) == JsonSerializer.Serialize(data.Submission, Wire.Json));
});
Test("competing candidate acceptances commit once and preserve the winning coverage warnings", async () => {
    await using var host = new Factory(); var data = await Ready(host);
    async Task<string> Draft() { var r = await data.Client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(data.Profile, data.Submission, data.Opportunity), Wire.Json); r.EnsureSuccessStatusCode(); return r.Headers.GetValues("X-Candidate-Id").Single(); }
    var first = await Draft(); var second = await Draft();
    var responses = await Task.WhenAll(new[] { first, second }.Select(id => data.Client.PostAsJsonAsync("/api/plans/E01/accept", new AcceptPlan(id, null, Guid.NewGuid().ToString("N")), Wire.Json)));
    Assert(responses.Count(r => r.IsSuccessStatusCode) == 1 && responses.Count(r => r.StatusCode == HttpStatusCode.Conflict) == 1);
    var plan = (await data.Client.GetFromJsonAsync<Plan>("/api/plans/E01", Wire.Json))!;
    Assert(plan.Version == 1 && plan.Warnings.Any(w => w.Contains("Submission action not represented")));
});

Test("old source revision cannot authorize coverage or acceptance", async () => {
    await using var host = new Factory(); var data = await Ready(host);
    var generated = await data.Client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(data.Profile, data.Submission, data.Opportunity), Wire.Json); generated.EnsureSuccessStatusCode();
    var id = generated.Headers.GetValues("X-Candidate-Id").Single();
    var owner = data.Profile.Id["profile-".Length..];
    await host.Services.GetRequiredService<IStateStore>().Change(owner, state => { var candidate = state.Candidates[id]; state.Candidates[id] = candidate with { Context = candidate.Context with { SourceRevision = "previous-source-revision" } }; return true; }, CancellationToken.None);
    Assert((await data.Client.GetAsync("/api/submissions/E01/coverage?candidateId=" + id)).StatusCode == HttpStatusCode.Conflict);
    Assert((await data.Client.PostAsJsonAsync("/api/plans/E01/accept", new AcceptPlan(id, null, Guid.NewGuid().ToString("N")), Wire.Json)).StatusCode == HttpStatusCode.Conflict);
    Assert((await data.Client.GetFromJsonAsync<Plan[]>("/api/plans", Wire.Json))!.Length == 0);
});
Test("source completeness is never inferred from task coverage or an empty omission set", async () => {
    await using var host = new Factory(); var data = await Ready(host); var rule = data.Opportunity.Requirements.First(r => r.Lane == "submission" && r.IsMandatory);
    var opportunity = data.Opportunity with { Requirements = [rule] };
    var task = new CandidateTask("Prepare the artifact", new("requirement", RequirementId: rule.Id), "must", "Artifact draft", "Review the artifact", 1, []);
    foreach (var state in new[] { "unknown", "incomplete" }) {
        var record = opportunity with { SourceCoverage = opportunity.SourceCoverage with { Submission = new(state, [], [], null) } };
        var result = SubmissionReconciliation.Assess(record, data.Profile, Catalog.EmptySubmission(record), null, [task], []);
        Assert(result.Report.UnrepresentedRequirementIds.Length == 0 && result.Report.SourceCoverage == state);
    }
    var reviewed = opportunity with { SourceCoverage = opportunity.SourceCoverage with { Submission = new("complete", [rule.Id], [], DateTimeOffset.UtcNow.AddMinutes(-1).ToString("O")) } };
    var complete = SubmissionReconciliation.Assess(reviewed, data.Profile, Catalog.EmptySubmission(reviewed), null, [task], []);
    Assert(complete.Report.SourceCoverage == "complete" && complete.Report.ReviewedOutstandingMandatoryRequirementIds.Contains(rule.Id));
});

Test("signed-in accounts cannot read coverage, accept candidates or update tasks belonging to another account", async () => {
    await using var host = new Factory();
    async Task<(HttpClient Client, StudentProfile Profile)> Account() {
        var client = host.CreateClient(); client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
        (await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest("coverage-" + Guid.NewGuid().ToString("N") + "@example.invalid", "Synthetic-Coverage-2026!", "Coverage isolation check"), Wire.Json)).EnsureSuccessStatusCode();
        var original = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!; owners.Add(original.Id["profile-".Length..]);
        var profile = original with { AvailableHoursPerWeek = Known(5), Goals = [new("goal-isolation", "Prepare the prototype")], EntrantType = KnownText("individual"), Enrollment = KnownText("higher_education") };
        var saved = await client.PutAsJsonAsync("/api/profile", new ProfileUpdate(profile.Version, profile), Wire.Json); saved.EnsureSuccessStatusCode();
        return (client, (await saved.Content.ReadFromJsonAsync<StudentProfile>(Wire.Json))!);
    }
    var first = await Account(); var second = await Account(); var opportunity = new Catalog().Get("E01");
    var submission = (await first.Client.GetFromJsonAsync<SubmissionState>("/api/submissions/E01", Wire.Json))!;
    var generated = await first.Client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(first.Profile, submission, opportunity), Wire.Json); generated.EnsureSuccessStatusCode();
    var id = generated.Headers.GetValues("X-Candidate-Id").Single();
    Assert((await second.Client.GetAsync("/api/submissions/E01/coverage?candidateId=" + id)).StatusCode == HttpStatusCode.NotFound);
    Assert((await second.Client.PostAsJsonAsync("/api/plans/E01/accept", new AcceptPlan(id, null, Guid.NewGuid().ToString("N")), Wire.Json)).StatusCode == HttpStatusCode.NotFound);
    var accepted = await first.Client.PostAsJsonAsync("/api/plans/E01/accept", new AcceptPlan(id, null, Guid.NewGuid().ToString("N")), Wire.Json); accepted.EnsureSuccessStatusCode();
    var plan = (await accepted.Content.ReadFromJsonAsync<Plan>(Wire.Json))!;
    Assert((await second.Client.PatchAsJsonAsync("/api/plans/E01/tasks/" + plan.Tasks[0].Id, new TaskUpdate(1, "done", Guid.NewGuid().ToString("N")), Wire.Json)).StatusCode == HttpStatusCode.NotFound);
    Assert((await second.Client.GetFromJsonAsync<Plan[]>("/api/plans", Wire.Json))!.Length == 0);
    Assert((await first.Client.GetFromJsonAsync<Plan>("/api/plans/E01", Wire.Json))!.Version == 1);
});

Test("contract instants accept explicit UTC or numeric offsets without host-culture inference", () => {
    var before = System.Globalization.CultureInfo.CurrentCulture;
    try {
        System.Globalization.CultureInfo.CurrentCulture = System.Globalization.CultureInfo.GetCultureInfo("ar-SA");
        Assert(ContractTime.TryInstant("2026-10-29T09:30:00Z", out var utc));
        Assert(ContractTime.TryInstant("2026-10-29T12:30:00+03:00", out var east));
        Assert(ContractTime.TryInstant("2026-10-29T04:30:00-05:00", out var west));
        Assert(utc == east && east == west && east.Offset == TimeSpan.FromHours(3));
        Assert(ContractTime.IsInstant("2024-02-29T23:59:59.1234567+14:00"));
        var zone = TimeZoneInfo.CreateCustomTimeZone("Display+03", TimeSpan.FromHours(3), "Display+03", "Display+03");
        Assert(TimeZoneInfo.ConvertTime(utc, zone).UtcTicks == utc.UtcTicks);
    } finally { System.Globalization.CultureInfo.CurrentCulture = before; }
    return Task.CompletedTask;
});
Test("contract instants reject missing offsets, unknown offsets and impossible dates", () => {
    foreach (var value in new string?[] { null, "", "2026-10-29", "2026-10-29T09:30:00", "2026-10-29 09:30:00Z", "2026-02-29T09:30:00Z", "2026-10-29T24:00:00Z", "2026-10-29T09:30:60Z", "2026-10-29T09:30:00-00:00", "2026-10-29T09:30:00+14:01", "2026-10-29T09:30:00+0300", "2026-10-29T09:30:00Z\n", "0000-01-01T00:00:00Z" }) Assert(!ContractTime.IsInstant(value), "Unexpected trusted instant: " + value);
    Assert(ContractTime.IsDate("2024-02-29") && !ContractTime.IsDate("2026-02-29") && !ContractTime.IsDate("2026-10-29T00:00:00Z"));
    return Task.CompletedTask;
});
Test("profile API rejects offset-less fact, interpretation and answer metadata without saving", async () => {
    await using var host = new Factory(); var (client, profile) = await Session(host);
    foreach (var value in new[] { "2026-10-29", "2026-10-29T09:30:00", "2026-02-29T09:30:00Z" }) {
        var fact = Known(0); fact["reportedAt"] = value;
        Assert((await client.PutAsJsonAsync("/api/profile", new ProfileUpdate(0, profile with { AvailableHoursPerWeek = fact }), Wire.Json)).StatusCode == HttpStatusCode.BadRequest);
    }
    var experience = profile with { ProjectExperience = [new("project-time", "Self-reported example")], AcceptedInterpretations = [new("project-time", "Confirmed wording", "2026-10-29T09:30:00")] };
    Assert((await client.PutAsJsonAsync("/api/profile", new ProfileUpdate(0, experience), Wire.Json)).StatusCode == HttpStatusCode.BadRequest);
    var answer = profile with { ClarificationAnswers = [new("question-time", "My answer", "2026-10-29T09:30:00")] };
    Assert((await client.PutAsJsonAsync("/api/profile", new ProfileUpdate(0, answer), Wire.Json)).StatusCode == HttpStatusCode.BadRequest);
    Assert((await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!.Version == 0);
    var valid = Known(0); valid["reportedAt"] = "2026-10-29T11:30:00+02:00";
    var saved = await client.PutAsJsonAsync("/api/profile", new ProfileUpdate(0, profile with { AvailableHoursPerWeek = valid }), Wire.Json); saved.EnsureSuccessStatusCode();
    var result = (await saved.Content.ReadFromJsonAsync<StudentProfile>(Wire.Json))!;
    Assert(result.AvailableHoursPerWeek["reportedAt"]!.GetValue<string>() == "2026-10-29T11:30:00+02:00" && Input.Fact<double>(result.AvailableHoursPerWeek) == 0);
});
Test("profile editor keeps calendar dates date-only and generates explicit-offset save timestamps", async () => {
    await using var host = new Factory(); var (client, profile) = await Session(host);
    foreach (var date in new[] { "2026-02-29", "2026-10-29T00:00:00Z" }) Assert((await client.PutAsJsonAsync("/api/profile/editor", new ProfileEditorUpdate(0, profile, new() { ["targetDate"] = date }), Wire.Json)).StatusCode == HttpStatusCode.BadRequest);
    Assert((await client.PutAsJsonAsync("/api/profile/editor", new ProfileEditorUpdate(0, profile, new() { ["savedAt"] = "2026-10-29T09:00:00" }), Wire.Json)).StatusCode == HttpStatusCode.BadRequest);
    var response = await client.PutAsJsonAsync("/api/profile/editor", new ProfileEditorUpdate(0, profile, new() { ["targetDate"] = "2026-10-29" }), Wire.Json); response.EnsureSuccessStatusCode();
    var value = (await response.Content.ReadFromJsonAsync<ProfileEditorView>(Wire.Json))!;
    Assert(value.Editor["targetDate"]!.GetValue<string>() == "2026-10-29" && ContractTime.IsInstant(value.Editor["savedAt"]!.GetValue<string>()));
    ProfileEditorValidation.Validate(new() { ["targetDate"] = "" });
});
Test("ambiguous or conflicting source deadlines stay unknown and original passages stay unchanged", () => {
    var original = new Catalog().Get("E01"); var source = original.SourceEvidence[0];
    var claim = new TimelineClaim("claim-time", "Published: 29 October; time not confirmed", "2026-10-29", [source.Id], "Asia/Hebron");
    var record = original with { TimelineEvents = [new("submission-time", "submission_close", [claim], "reviewed")] };
    var before = JsonSerializer.Serialize(record, Wire.Json);
    Assert(Catalog.Instant(record, "submission_close") is null && JsonSerializer.Serialize(record, Wire.Json) == before);
    var exact = record with { TimelineEvents = [record.TimelineEvents[0] with { Claims = [claim with { DateTime = "2026-10-29T12:30:00+03:00" }] }] };
    Assert(Catalog.Instant(exact, "submission_close") == DateTimeOffset.Parse("2026-10-29T09:30:00Z"));
    Assert(Catalog.Instant(exact with { TimelineEvents = [exact.TimelineEvents[0] with { SourceStatus = "conflicting" }] }, "submission_close") is null);
    Assert(Catalog.Instant(exact with { TimelineEvents = [exact.TimelineEvents[0] with { Claims = [claim with { DateTime = "2026-10-29T12:30:00+03:00" }, claim with { Id = "other", DateTime = "2026-10-29T14:00:00Z" }] }] }, "submission_close") is null);
    Assert(Catalog.Instant(exact with { SourceEvidence = exact.SourceEvidence.Select(e => e with { CheckedAt = "2026-10-28T09:00:00" }).ToArray() }, "submission_close") is null);
    return Task.CompletedTask;
});
Test("review metadata without an offset cannot establish reviewed rules or complete source coverage", () => {
    var opportunity = new Catalog().Get("E01"); var rule = opportunity.Requirements.First(r => r.Lane == "submission" && r.IsMandatory);
    var invalid = opportunity with { SourceEvidence = opportunity.SourceEvidence.Select(e => e with { CheckedAt = "2026-10-28T09:00:00" }).ToArray() };
    Assert(!Catalog.Reviewed(invalid, rule));
    var source = opportunity with { Requirements = [rule], SourceCoverage = opportunity.SourceCoverage with { Submission = new("complete", [rule.Id], [], "2026-10-28T09:00:00") } };
    var report = SubmissionReconciliation.Assess(source, Input.Blank("profile-time"), Catalog.EmptySubmission(source), null, [], []);
    Assert(report.Report.SourceCoverage == "unknown");
    return Task.CompletedTask;
});
Test("listing projections retain ambiguous date text without inventing a trusted deadline", () => {
    var item = new ListingSummary("time-listing", "course", "Synthetic clock example", "Synthetic organizer", "online", "https://example.invalid", "Test only", [], "global_online", "2026-10-29", "not_specified", "unknown", "2026-10-28T09:00:00", "reviewed", "Registration on 29 October", "Original note.");
    var projected = DiscoveryCatalog.WithTimeSemantics(item);
    Assert(projected.RegistrationDeadline is null && projected.LastReviewedAt is null && projected.SourceStatus == "needs_verification");
    Assert(projected.SourcePassage == item.SourcePassage && projected.VerificationNote.Contains("2026-10-29") && item.RegistrationDeadline == "2026-10-29");
    return Task.CompletedTask;
});

Test("configured Google challenge uses same-origin callback, profile-only scopes and PKCE", async () => {
    await using var host = new Factory(google: true);
    var client = host.CreateClient(new() { AllowAutoRedirect = false, BaseAddress = new Uri("https://localhost:8082") });
    var response = await client.GetAsync("/api/auth/google?returnTo=%2Fplans%3Fevent%3DE01");
    Assert(response.StatusCode == HttpStatusCode.Redirect && response.Headers.Location!.Host == "accounts.google.com", await response.Content.ReadAsStringAsync());
    var query = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(response.Headers.Location.Query);
    Assert(query["redirect_uri"] == "https://localhost:8082/api/auth/google/callback" && query["code_challenge_method"] == "S256" && !string.IsNullOrEmpty(query["state"]));
    Assert(!query["scope"].ToString().Contains("gmail", StringComparison.OrdinalIgnoreCase) && !query["scope"].ToString().Contains("drive", StringComparison.OrdinalIgnoreCase));
    Assert(host.Google.Calls == 0);
});
Test("Google OAuth callback creates a real MySQL session and preserves the selected event", async () => {
    await using var host = new Factory(google: true);
    var client = host.CreateClient(new() { AllowAutoRedirect = false, BaseAddress = new Uri("https://localhost:8082") });
    var start = await client.GetAsync("/api/auth/google?returnTo=%2Fplans%3Fevent%3DE01");
    var state = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(start.Headers.Location!.Query)["state"].ToString();
    var callback = await client.GetAsync("/api/auth/google/callback?code=synthetic-code&state=" + Uri.EscapeDataString(state));
    Assert(callback.StatusCode == HttpStatusCode.Redirect && callback.Headers.Location!.OriginalString.Contains("google=complete") && callback.Headers.Location.OriginalString.Contains("returnTo=%2Fplans%3Fevent%3DE01"));
    var me = await client.GetFromJsonAsync<JsonObject>("/api/auth/me"); Assert(me!["user"]?["hasGoogle"]?.GetValue<bool>() == true && me["user"]?["hasPassword"]?.GetValue<bool>() == false);
    var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!; owners.Add(profile.Id["profile-".Length..]);
    Assert(host.Google.Calls == 2 && host.Google.ExchangeHadVerifier);
    Assert(!string.Join(";", callback.Headers.GetValues("Set-Cookie")).Contains("synthetic-access-token"));
    client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
    (await client.PostAsync("/api/auth/logout", null)).EnsureSuccessStatusCode();
    Assert((await client.GetFromJsonAsync<JsonObject>("/api/auth/me"))!["user"] is null);
});
Test("cancelled Google consent and invalid OAuth state return safely without creating an account", async () => {
    await using var host = new Factory(google: true);
    var client = host.CreateClient(new() { AllowAutoRedirect = false, BaseAddress = new Uri("https://localhost:8082") });
    var start = await client.GetAsync("/api/auth/google?returnTo=%2Fprofile%3Fevent%3DE02");
    var state = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(start.Headers.Location!.Query)["state"].ToString();
    var cancelled = await client.GetAsync("/api/auth/google/callback?error=access_denied&state=" + Uri.EscapeDataString(state));
    Assert(cancelled.Headers.Location!.OriginalString == "/login?error=google_failed&returnTo=%2Fprofile%3Fevent%3DE02");
    var invalid = await client.GetAsync("/api/auth/google/callback?code=synthetic-code&state=invalid");
    Assert(invalid.Headers.Location!.OriginalString == "/login?error=google_failed&returnTo=%2F");
    Assert(host.Google.Calls == 0 && (await client.GetFromJsonAsync<JsonObject>("/api/auth/me"))!["user"] is null);
});
Test("Google callback rejects unverified email and never automatically links a password account", async () => {
    await using var host = new Factory(google: true); host.Google.Verified = false;
    async Task<HttpResponseMessage> SignIn(HttpClient client) {
        var start = await client.GetAsync("/api/auth/google?returnTo=%2Fsaved");
        var state = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(start.Headers.Location!.Query)["state"].ToString();
        return await client.GetAsync("/api/auth/google/callback?code=synthetic-code&state=" + Uri.EscapeDataString(state));
    }
    var client = host.CreateClient(new() { AllowAutoRedirect = false, BaseAddress = new Uri("https://localhost:8082") });
    Assert((await SignIn(client)).Headers.Location!.OriginalString.StartsWith("/login?error=google_failed"));
    Assert((await client.GetFromJsonAsync<JsonObject>("/api/auth/me"))!["user"] is null);
    client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
    (await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(host.Google.Email, "Synthetic-Password-2026!", "Existing password account"), Wire.Json)).EnsureSuccessStatusCode();
    var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!; owners.Add(profile.Id["profile-".Length..]);
    (await client.PostAsync("/api/auth/logout", null)).EnsureSuccessStatusCode(); host.Google.Verified = true;
    Assert((await SignIn(client)).Headers.Location!.OriginalString == "/login?error=existing_account&returnTo=%2Fsaved");
    Assert((await client.GetFromJsonAsync<JsonObject>("/api/auth/me"))!["user"] is null);
});

SourceCollectionChecks.Register(Test);
Test("preparation navigation uses a planning record rather than an event ID prefix", () => {
    var record = new Catalog().Get("E01") with { Id = "new-university-hackathon" };
    var listing = new DiscoveryCatalog(new Catalog()).Listings().Single(item => item.Id == "E01") with { Id = record.Id };
    var supported = PreparationAccess.For(listing, record);
    Assert(supported.State == "workspace_available" && supported.PlanningOpportunityId == record.Id && supported.ReviewNeeds.Length == 0);
    var missing = PreparationAccess.For(listing, null);
    Assert(missing.State == "source_review_required" && missing.PlanningOpportunityId is null && missing.ReviewNeeds.Length == 3);
    var course = PreparationAccess.For(listing with { Id = "E999", Kind = "course" }, record with { Id = "E999" });
    Assert(course.State == "unsupported_kind" && course.PlanningOpportunityId is null);
    return Task.CompletedTask;
});
Test("public preparation access distinguishes planning records, unreviewed discoveries and unsupported kinds", async () => {
    await using var host = new Factory();
    var client = host.CreateClient(); var calls = host.Model.Calls;
    foreach (var record in new Catalog().All()) {
        var access = (await client.GetFromJsonAsync<PreparationAccess>($"/api/opportunities/{record.Id}/preparation-access", Wire.Json))!;
        Assert(access.State == "workspace_available" && access.PlanningOpportunityId == record.Id);
    }
    await SourceCollectionChecks.WithUnreviewedListing(host, async listing => {
        var unreviewed = (await client.GetFromJsonAsync<PreparationAccess>($"/api/opportunities/{listing.Id}/preparation-access", Wire.Json))!;
        Assert(unreviewed.State == "source_review_required" && unreviewed.PlanningOpportunityId is null);
    });
    var course = new DiscoveryCatalog(new Catalog()).Listings().First(item => item.Kind == "course");
    var unsupported = (await client.GetFromJsonAsync<PreparationAccess>($"/api/opportunities/{course.Id}/preparation-access", Wire.Json))!;
    Assert(unsupported.State == "unsupported_kind");
    Assert((await client.GetAsync("/api/opportunities/not-a-real-listing/preparation-access")).StatusCode == HttpStatusCode.NotFound);
    Assert((await client.GetAsync("/api/profile")).StatusCode == HttpStatusCode.Unauthorized && host.Model.Calls == calls);
});
Test("opening unreviewed preparation preserves confirmed plans, artifacts and Done progress", async () => {
    await using var host = new Factory();
    var data = await Ready(host); var (plan, _) = await Accepted(data.Client, data.Profile, data.Submission, data.Opportunity);
    var progress = await data.Client.PatchAsJsonAsync("/api/plans/E01/tasks/" + plan.Tasks[0].Id, new TaskUpdate(plan.Version, "done", Guid.NewGuid().ToString("N"), ["https://example.invalid/student-artifact"]), Wire.Json);
    progress.EnsureSuccessStatusCode();
    var before = await data.Client.GetFromJsonAsync<Plan>("/api/plans/E01", Wire.Json); var calls = host.Model.Calls;
    await SourceCollectionChecks.WithUnreviewedListing(host, async listing => {
        (await data.Client.GetAsync($"/api/opportunities/{listing.Id}/preparation-access")).EnsureSuccessStatusCode();
    });
    var after = await data.Client.GetFromJsonAsync<Plan>("/api/plans/E01", Wire.Json);
    Assert(JsonSerializer.Serialize(before, Wire.Json) == JsonSerializer.Serialize(after, Wire.Json) && host.Model.Calls == calls);
    Assert((await data.Client.GetFromJsonAsync<SubmissionState>("/api/submissions/E01", Wire.Json))!.Version == data.Submission.Version);
});
Test("reviewed Meta data preserves source conflicts, incomplete coverage and advice versus mandatory submission", () => {
    var meta = new Catalog().Get("meta-global-ai-2026");
    Assert(meta.SourceCoverage.Participation.State == "incomplete" && meta.SourceCoverage.Submission.State == "incomplete" && meta.SourceCoverage.Prize.State == "incomplete");
    var close = meta.TimelineEvents.Single(e => e.Kind == "registration_close");
    Assert(close.SourceStatus == "conflicting" && close.Claims.Length == 2 && close.Claims.Select(c => c.TimeZone).ToHashSet().SetEquals(["ET", "EST"]));
    Assert(Catalog.Instant(meta, "registration_close") is null && Catalog.Instant(meta, "submission_close") is null);
    Assert(meta.Requirements.Single(r => r.Id.EndsWith("-p-age")).Evaluation["minimum"]!.GetValue<int>() == 18);
    Assert(meta.Requirements.Where(r => r.Id.Contains("-judging-")).Count() == 4 && meta.Requirements.Where(r => r.Id.Contains("-judging-")).All(r => !r.IsMandatory && r.Kind == "preparation_advice"));
    Assert(meta.Requirements.Where(r => r.Lane == "submission").All(r => !r.Statement.Contains("video", StringComparison.OrdinalIgnoreCase) && !r.Statement.Contains("repository", StringComparison.OrdinalIgnoreCase)));
    Assert(new DiscoveryCatalog(new Catalog()).Listings().Count(item => item.Id == meta.Id) == 1);
    return Task.CompletedTask;
});
Test("Meta selection self-report cannot bypass a published age blocker or satisfy submission evidence", async () => {
    await using var host = new Factory(); var (client, original) = await Session(host);
    var profile = original with { ReportedAge = Known(17), EntrantType = KnownText("individual"), Goals = [new("meta-goal", "Prepare my project")], ClarificationAnswers = [new("participation-selection:meta-global-ai-2026", "accepted", DateTimeOffset.UtcNow.ToString("O"))] };
    var save = await client.PutAsJsonAsync("/api/profile", new ProfileUpdate(original.Version, profile), Wire.Json); save.EnsureSuccessStatusCode(); profile = (await save.Content.ReadFromJsonAsync<StudentProfile>(Wire.Json))!;
    var opportunity = (await client.GetFromJsonAsync<Opportunity>("/api/opportunities/meta-global-ai-2026", Wire.Json))!;
    var submission = (await client.GetFromJsonAsync<SubmissionState>("/api/submissions/meta-global-ai-2026", Wire.Json))!;
    var analysis = (await (await client.PostAsJsonAsync("/api/opportunities/meta-global-ai-2026/analysis", Request(profile, submission, opportunity), Wire.Json)).Content.ReadFromJsonAsync<AnalysisResult>(Wire.Json))!;
    Assert(analysis.ParticipationSummary == "does_not_meet_confirmed_requirement" && analysis.Matches.Where(m => opportunity.Requirements.Single(r => r.Id == m.RequirementId).Lane == "submission").All(m => m.Status == "unknown"));
    Assert((await client.PostAsJsonAsync("/api/opportunities/meta-global-ai-2026/plan-candidates", Request(profile, submission, opportunity), Wire.Json)).StatusCode == HttpStatusCode.BadRequest && host.Model.Calls == 0);
});
CapacityAndNetworkChecks.Register(Test);
Test("stale-profile progress preserves accepted context and never adopts new capacity silently", async () => {
    await using var host = new Factory();
    var data = await Ready(host); var (plan, _) = await Accepted(data.Client, data.Profile, data.Submission, data.Opportunity);
    var change = await data.Client.PutAsJsonAsync("/api/profile", new ProfileUpdate(data.Profile.Version, data.Profile with { AvailableHoursPerWeek = Known(168) }), Wire.Json); change.EnsureSuccessStatusCode();
    var update = new TaskUpdate(plan.Version, "in_progress", Guid.NewGuid().ToString("N"));
    var response = await data.Client.PatchAsJsonAsync("/api/plans/E01/tasks/" + plan.Tasks[0].Id, update, Wire.Json); response.EnsureSuccessStatusCode();
    var saved = (await response.Content.ReadFromJsonAsync<Plan>(Wire.Json))!;
    Assert(saved.Context == plan.Context && saved.Budget.HoursPerWeek == plan.Budget.HoursPerWeek && saved.Budget.AvailableHours is null && saved.Feasibility == "untimed");
    Assert(saved.Tasks[0].Status == "in_progress" && saved.Tasks[0].EstimatedHours == plan.Tasks[0].EstimatedHours && saved.TaskOrder.SequenceEqual(plan.TaskOrder));
    Assert((await data.Client.GetFromJsonAsync<SubmissionState>("/api/submissions/E01", Wire.Json))!.Version == data.Submission.Version);
});
PersonalBriefingChecks.Register(Test);
var passed = 0;
try {
    foreach (var test in cases) {
        try { await test.Run(); passed++; Console.WriteLine("PASS " + test.Name); }
        catch (Exception error) { Console.WriteLine("FAIL " + test.Name + " :: " + error.Message); }
    }
} finally { foreach (var owner in owners) await store.Delete(owner, CancellationToken.None); }
Console.WriteLine($"RESULT passed={passed} failed={cases.Count - passed} total={cases.Count}");
Environment.ExitCode = passed == cases.Count ? 0 : 1;
