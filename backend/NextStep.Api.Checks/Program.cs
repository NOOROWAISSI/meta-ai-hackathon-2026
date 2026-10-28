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
    Assert(events.Select(o => o.Id).SequenceEqual(new[] { "E01", "E02", "E03", "E04", "E05" }));
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
    Assert(listings.Count(item => item.Kind == "course") == 7 && listings.All(item => item.OfficialUrl.StartsWith("https://")));
    Assert(listings.Where(item => item.Kind == "course").All(item => item.RegistrationDeadline is null));
    var sources = (await client.GetFromJsonAsync<SourceRegistration[]>("/api/sources", Wire.Json))!;
    Assert(sources.Single(s => s.Id == "prime-academy-user").Url == "https://www.instagram.com/primeacademy12/");
    Assert(sources.Single(s => s.Id == "knowledge-academy-user").Url == "https://www.instagram.com/eknowledge.learn/");
});

Test("source intake rejects prose-only answers and accepts only bounded HTTPS search results", () => {
    using var prose = JsonDocument.Parse("""{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"Invented opportunity https://example.org"}]}]}""");
    try { MetaSourceSearch.Extract(prose.RootElement); throw new Exception("Expected search rejection"); }
    catch (MetaAiException error) { Assert(error.Error.Code == "search_not_performed"); }
    using var grounded = JsonDocument.Parse("""{"status":"completed","output":[{"type":"web_search_call","status":"completed","results":[{"url":"https://www.instagram.com/p/fixture/#fragment","title":"Synthetic result"},{"url":"https://www.instagram.com/p/fixture/","title":"Duplicate"},{"url":"javascript:alert(1)","title":"Unsafe"},{"url":"http://example.org","title":"Insecure"},{"url":"https://127.0.0.1/private","title":"Local"},{"url":"https://user:pass@example.org","title":"Credentials"}]}]}""");
    var links = MetaSourceSearch.Extract(grounded.RootElement);
    Assert(links.Count == 1 && links[0].Url == "https://www.instagram.com/p/fixture/");
    using var empty = JsonDocument.Parse("""{"status":"completed","output":[{"type":"web_search_call","status":"completed","results":[]}]}""");
    Assert(MetaSourceSearch.Extract(empty.RootElement).Count == 0);
    using var partial = JsonDocument.Parse("""{"status":"incomplete","output":[]}""");
    try { MetaSourceSearch.Extract(partial.RootElement); throw new Exception("Expected incomplete rejection"); }
    catch (MetaAiException error) { Assert(error.Error.Code == "invalid_model_output"); }
    return Task.CompletedTask;
});
Test("Meta source search requires server configuration before any network request", async () => {
    using var client = new HttpClient();
    var search = new MetaSourceSearch(client, Microsoft.Extensions.Options.Options.Create(new MetaAiOptions()));
    try { await search.Search(new("test", "Synthetic", "https://example.org", "palestine", "website", "public_html", null, "fixture"), CancellationToken.None); throw new Exception("Expected missing configuration"); }
    catch (MetaAiException error) { Assert(error.Error.Code == "provider_unavailable"); }
});

Test("search adapter sends grounded Responses requests while keeping provider access server-side", async () => {
    using var handler = new SearchHandler(); using var client = new HttpClient(handler);
    var search = new MetaSourceSearch(client, Microsoft.Extensions.Options.Options.Create(new MetaAiOptions { ApiKey = "synthetic-test-key" }));
    var links = await search.Search(new("ewb-najah", "EWB", "https://www.instagram.com/ewb.nnu/", "palestine", "instagram", "manual_review", null, "fixture"), CancellationToken.None);
    Assert(handler.Verified && links.Count == 1);
});

Test("translation caches validated display text and leaves canonical source data unchanged", async () => {
    using var handler = new TranslationHandler();
    var catalog = new DiscoveryCatalog(new Catalog()); var original = JsonSerializer.Serialize(catalog.Listings(), Wire.Json);
    using var service = new CatalogTranslationService(handler, Microsoft.Extensions.Options.Options.Create(new MetaAiOptions { ApiKey = "synthetic-test-key" }), catalog);
    var first = await service.Translate("ar", CancellationToken.None); var second = await service.Translate("ar", CancellationToken.None);
    Assert(handler.Verified && handler.Calls == 1 && first.SourceRevision == second.SourceRevision && first.Items.Length == catalog.Listings().Length);
    Assert(first.TranslationKind == "ai_translation" && JsonSerializer.Serialize(catalog.Listings(), Wire.Json) == original);
    var english = await service.Translate("en", CancellationToken.None); Assert(english.TranslationKind == "original" && handler.Calls == 1);
    var invalid = first.Items.ToArray(); invalid[0] = invalid[0] with { Id = "invented-id" };
    try { CatalogTranslationService.Validate(first.Items, invalid); throw new Exception("Expected ID rejection"); }
    catch (MetaAiException error) { Assert(error.Error.Code == "invalid_model_output"); }
});
Test("translation route keeps the original available without a key and rejects unsupported languages", async () => {
    var (client, _) = await Session();
    (await client.PostAsJsonAsync("/api/localization/catalog", new CatalogTranslationRequest("en"), Wire.Json)).EnsureSuccessStatusCode();
    Assert((await client.PostAsJsonAsync("/api/localization/catalog", new CatalogTranslationRequest("fr"), Wire.Json)).StatusCode == HttpStatusCode.BadRequest);
    using var handler = new TranslationHandler();
    using var service = new CatalogTranslationService(handler, Microsoft.Extensions.Options.Options.Create(new MetaAiOptions()), new DiscoveryCatalog(new Catalog()));
    try { await service.Translate("ar", CancellationToken.None); throw new Exception("Expected missing key"); }
    catch (MetaAiException error) { Assert(error.Error.Code == "provider_unavailable" && handler.Calls == 0); }
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

var passed = 0;
try {
    foreach (var test in cases) {
        try { await test.Run(); passed++; Console.WriteLine("PASS " + test.Name); }
        catch (Exception error) { Console.WriteLine("FAIL " + test.Name + " :: " + error.Message); }
    }
} finally { foreach (var owner in owners) await store.Delete(owner, CancellationToken.None); }
Console.WriteLine($"RESULT passed={passed} failed={cases.Count - passed} total={cases.Count}");
Environment.ExitCode = passed == cases.Count ? 0 : 1;
