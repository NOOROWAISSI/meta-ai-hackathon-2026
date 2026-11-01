using System.IO.Compression;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using MySqlConnector;
using NextStep.Api;
using NextStep.Api.Controllers;

public sealed class FakeEvidenceIntelligence : IEvidenceIntelligence {
    public bool Invalid; public bool Fail; public int Calls;
    public JsonObject? LastContext;
    public TaskCompletionSource? Entered; public TaskCompletionSource? Resume;
    public async Task<ExtractionOutput> Extract(ProfessionalSource[] sources, string language, CancellationToken ct) {
        Calls++; Entered?.TrySetResult(); if (Resume is not null) await Resume.Task.WaitAsync(ct);
        if (Fail) throw new ApiFault("provider_unavailable", "Synthetic extraction failure", true);
        var source = sources[0]; var chunk = source.Chunks[0];
        return new([new("skill", "React", "source_statement", "Synthetic local adapter: the student described React work.", [new(source.Id, chunk.Id, Invalid ? "A fabricated source passage absent from the document" : chunk.Text)]), new("project", "Student scheduling application with a React interface", "source_statement", "The student's contribution requires confirmation.", [new(source.Id, chunk.Id, chunk.Text)])], ["Which parts of the scheduling application did you personally implement?"]);
    }
    public Task<OpportunityInsight> Compare(JsonObject context, string language, CancellationToken ct) {
        Calls++;
        LastContext = (JsonObject)context.DeepClone();
        var id = context["confirmed"]!.AsArray().FirstOrDefault()?["id"]?.GetValue<string>();
        return Task.FromResult(new OpportunityInsight("LOCAL TEST ADAPTER ONLY: the scheduling interface provides a concrete interaction to adapt, but it does not establish experience with the opportunity's model integration or fulfillment of its submission rules.", id is null ? [] : [new("An interface you can adapt", "Use your confirmed scheduling application contribution as an existing interface, then identify the new integration needed for the selected challenge.", [Invalid ? "another-owner-fact" : id])], [new("Model integration is unreported", "The provided evidence does not describe model integration; clarify that experience before choosing the scope.", [])], ["Have you implemented a model API call in a project?"], ["Build one demonstrable model interaction in the existing interface and document the inputs, output and failure state."], new("needs_clarification", "Model integration experience is not documented in this local fixture.", "The challenge may add an integration task rather than repeat interface work.", "Confirm whether you have already built a model-backed interaction.", id is null ? [] : [id])));
    }
}

public static class ProfileEvidenceChecks {
    private static void Check(bool value) { if (!value) throw new Exception("Professional evidence assertion failed"); }
    private static async Task<long> Revision(string owner) {
        await using var connection = new MySqlConnection(Environment.GetEnvironmentVariable("NEXTSTEP_CHECKS_CONNECTION") ?? throw new InvalidOperationException("Set NEXTSTEP_CHECKS_CONNECTION to the dedicated local MySQL instance."));
        await connection.OpenAsync();
        await using var command = new MySqlCommand("SELECT revision FROM user_state WHERE owner_id=@owner", connection);
        command.Parameters.AddWithValue("@owner", owner);
        return Convert.ToInt64(await command.ExecuteScalarAsync());
    }

    private static byte[] Docx(string text) {
        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, true)) {
            using var writer = new StreamWriter(archive.CreateEntry("word/document.xml").Open());
            writer.Write("<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:r><w:t>" + System.Security.SecurityElement.Escape(text) + "</w:t></w:r></w:p></w:body></w:document>");
        }
        return output.ToArray();
    }
    private static async Task Run(Func<Factory, HttpClient, EvidenceView, Task> check) {
        await using var host = new Factory(); using var client = host.CreateClient(); client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
        (await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest("evidence-" + Guid.NewGuid().ToString("N") + "@example.invalid", "Synthetic-Evidence-Check-2026!", "Temporary evidence check"), Wire.Json)).EnsureSuccessStatusCode();
        var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
        try { await check(host, client, (await client.GetFromJsonAsync<EvidenceView>("/api/profile/evidence", Wire.Json))!); }
        finally { await host.Services.GetRequiredService<IStateStore>().Delete(profile.Id["profile-".Length..], CancellationToken.None); }
    }
    private static async Task<EvidenceView> Add(HttpClient client, EvidenceView view) {
        var result = await client.PostAsJsonAsync("/api/profile/evidence/text", new TextSourceRequest("cv", "Synthetic CV", "I built a React scheduling interface for a student project.", null, view.ProfileVersion, view.Workspace.Version), Wire.Json);
        result.EnsureSuccessStatusCode(); return (await result.Content.ReadFromJsonAsync<EvidenceView>(Wire.Json))!;
    }
    private static async Task<EvidenceView> Analyze(HttpClient client, EvidenceView view) {
        var result = await client.PostAsJsonAsync("/api/profile/evidence/analyze", new EvidenceAnalysisRequest(view.ProfileVersion, view.Workspace.Version, [view.Workspace.Sources[0].Id], true, "en"), Wire.Json);
        result.EnsureSuccessStatusCode(); return (await result.Content.ReadFromJsonAsync<EvidenceView>(Wire.Json))!;
    }
    public static void Register(Action<string, Func<Task>> test) {
        test("decision rejects already-covered claims based only on skill tags and rejects invented evidence", () => {
            foreach (var recommendation in new[] {
                new OpportunityRecommendation("already_covered", "Known React", "No new value", "Skip", ["skill-react"]),
                new OpportunityRecommendation("prepare_first", "Python unreported", "Learn basics", "Prepare", []),
                new OpportunityRecommendation("recommended", "Reason", "Benefit", "Next", ["invented"])
            }) { var rejected = false; try { ProfileEvidenceService.ValidateRecommendation(recommendation, [], [], ["skill-react"]); } catch (ApiFault) { rejected = true; } Check(rejected); }
            ProfileEvidenceService.ValidateRecommendation(new("already_covered", "A demonstrated Python project covers this scope", "Review only the new material", "Compare the published topics", ["project-python"]), ["project-python"], [], ["project-python"]);
            ProfileEvidenceService.ValidateRecommendation(new("prepare_first", "An explicit gap is reported", "Build the foundation", "Try one foundational task", ["gap-python"]), [], ["gap-python"], ["gap-python"]);
            return Task.CompletedTask;
        });
        test("reviewed course outlines distinguish teaching foundations from requiring them", () => {
            var python = ReviewedLearningOutlines.Get("harvard-cs50-python")!;
            var web = ReviewedLearningOutlines.Get("harvard-cs50-web")!;
            Check(python.Topics.Any(t => t.Contains("Unit testing")) && python.StartingPoint.Contains("not a prerequisite") && web.StartingPoint.Contains("prior experience"));
            Check(ReviewedLearningOutlines.Get("unreviewed-course") is null);
            return Task.CompletedTask;
        });
        test("professional text PDF extraction preserves page references", () => {
            var builder = new UglyToad.PdfPig.Writer.PdfDocumentBuilder();
            var font = builder.AddStandard14Font(UglyToad.PdfPig.Fonts.Standard14Fonts.Standard14Font.Helvetica);
            builder.AddPage(600, 800).AddText("I implemented a React calendar interface and form validation.", 12, new UglyToad.PdfPig.Core.PdfPoint(40, 700), font);
            var source = ProfessionalDocuments.Parse("synthetic.pdf", builder.Build(), "cv");
            Check(source.Chunks[0].Locator == "Page 1" && source.Chunks[0].Text.Contains("React calendar")); return Task.CompletedTask;
        });
        test("reading professional sources does not mutate shared account state", () => Run(async (_, client, _) => {
            var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
            var owner = profile.Id["profile-".Length..];
            var before = await Revision(owner);
            for (var i = 0; i < 3; i++) (await client.GetAsync("/api/profile/evidence")).EnsureSuccessStatusCode();
            Check(await Revision(owner) == before);
        }));
        test("professional DOCX extraction retains stable paragraph locators and omits contacts", () => {
            var source = ProfessionalDocuments.Parse("student.docx", Docx("I built a React scheduling interface. Contact student@example.invalid"), "cv");
            Check(source.Chunks.Length == 1 && source.Chunks[0].Locator == "Paragraph 1" && !source.Chunks[0].Text.Contains("student@example.invalid")); return Task.CompletedTask;
        });
        test("professional upload rejects mismatched magic and unreadable PDFs", () => {
            foreach (var name in new[] { "student.pdf", "student.docm", "student.exe" }) {
                var rejected = false; try { ProfessionalDocuments.Parse(name, Docx("Professional project experience sufficient text"), "cv"); } catch (ApiFault) { rejected = true; } Check(rejected);
            }
            return Task.CompletedTask;
        });
        test("GitHub sample excludes secrets dependencies binaries and generated files", () => {
            foreach (var path in new[] { ".env", "src/credentials.ts", "node_modules/a/index.js", "vendor/a.py", "bin/a.cs", ".git/config", "package-lock.json", "a.min.js", "image.png" }) Check(!PublicGitHubSources.Suitable(path));
            Check(PublicGitHubSources.Suitable("src/App.tsx") && PublicGitHubSources.Suitable("README.md")); return Task.CompletedTask;
        });
        test("LinkedIn URL is provenance only and arbitrary external URLs are rejected", () => {
            var rejected = false; try { ProfessionalDocuments.Text("linkedin", "LinkedIn", "I built a scheduling application with React.", "http://127.0.0.1/private"); } catch (ApiFault) { rejected = true; } Check(rejected);
            Check(ProfessionalDocuments.Text("linkedin", "LinkedIn", "I built a scheduling application with React.", "https://www.linkedin.com/in/synthetic-student").Url is not null); return Task.CompletedTask;
        });
        test("selected GitHub import pins code to a commit and never requests excluded files", async () => {
            var handler = new GitHubEvidenceFixture();
            var importer = new PublicGitHubSources(new HttpClient(handler));
            var source = await importer.Import("https://github.com/student/scheduler", CancellationToken.None);
            Check(source.Revision == new string('a', 40) && source.Chunks.Length == 2 && source.Chunks.Any(c => c.Locator == "src/calendar.ts"));
            Check(handler.Paths.All(p => !p.Contains("secret") && !p.Contains("symlink")) && handler.Paths.Count == 5);
            var rejected = false; try { await importer.Import("http://127.0.0.1/private", CancellationToken.None); } catch (ApiFault) { rejected = true; }
            Check(rejected && handler.Paths.Count == 5);
        });
        test("professional source import does not call Meta or adopt inferred skills", () => Run(async (host, client, view) => {
            var updated = await Add(client, view); Check(updated.Workspace.Sources.Count == 1 && updated.ProfileVersion == view.ProfileVersion + 1 && host.Evidence.Calls == 0);
            var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!; Check(profile.Skills.Length == 0);
        }));
        test("extraction needs explicit consent and preserves sources on provider failure", () => Run(async (host, client, view) => {
            view = await Add(client, view);
            var denied = await client.PostAsJsonAsync("/api/profile/evidence/analyze", new EvidenceAnalysisRequest(view.ProfileVersion, view.Workspace.Version, [view.Workspace.Sources[0].Id], false, "en"), Wire.Json);
            Check(denied.StatusCode == HttpStatusCode.BadRequest && host.Evidence.Calls == 0);
            host.Evidence.Fail = true;
            var failed = await client.PostAsJsonAsync("/api/profile/evidence/analyze", new EvidenceAnalysisRequest(view.ProfileVersion, view.Workspace.Version, [view.Workspace.Sources[0].Id], true, "en"), Wire.Json);
            Check(failed.StatusCode == HttpStatusCode.ServiceUnavailable);
            var saved = (await client.GetFromJsonAsync<EvidenceView>("/api/profile/evidence", Wire.Json))!; Check(saved.Workspace.Draft is null && saved.Workspace.Sources.Count == 1);
        }));
        test("extraction rejects fabricated quotations without saving a draft", () => Run(async (host, client, view) => {
            view = await Add(client, view); host.Evidence.Invalid = true;
            var failed = await client.PostAsJsonAsync("/api/profile/evidence/analyze", new EvidenceAnalysisRequest(view.ProfileVersion, view.Workspace.Version, [view.Workspace.Sources[0].Id], true, "en"), Wire.Json);
            Check(!failed.IsSuccessStatusCode && (await client.GetFromJsonAsync<EvidenceView>("/api/profile/evidence", Wire.Json))!.Workspace.Draft is null);
        }));
        test("confirmed source facts update canonical profile and survive refresh; acceptance is idempotent", () => Run(async (host, client, view) => {
            view = await Analyze(client, await Add(client, view));
            var request = new EvidenceAcceptance(view.Workspace.Draft!.Id, view.ProfileVersion, view.Workspace.Version, [new(0, "React", ""), new(1, "Student scheduling interface", "I implemented the React calendar and form validation.")]);
            var accepted = await client.PostAsJsonAsync("/api/profile/evidence/accept", request, Wire.Json); accepted.EnsureSuccessStatusCode();
            (await client.PostAsJsonAsync("/api/profile/evidence/accept", request, Wire.Json)).EnsureSuccessStatusCode();
            var saved = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
            Check(saved.Skills.Count(x => x.Label == "React") == 1 && saved.ProjectExperience.Length == 1 && saved.ProjectExperience[0].Description.Contains("calendar"));
            var editor = (await client.GetFromJsonAsync<ProfileEditorView>("/api/profile/editor", Wire.Json))!;
            Check(editor.Editor["projects"] is JsonArray projects && projects.Count == 1 && projects[0]!["technologies"] is JsonArray);
            var changed = await client.PostAsJsonAsync("/api/profile/evidence/accept", request with { Facts = [new(0, "Invented skill", "")] }, Wire.Json); Check(changed.StatusCode == HttpStatusCode.Conflict);
            var reloaded = (await client.GetFromJsonAsync<EvidenceView>("/api/profile/evidence", Wire.Json))!; Check(reloaded.Workspace.Confirmed.Count == 2 && reloaded.Workspace.Draft is null);
        }));
        test("project adoption without contribution rolls back all selected facts", () => Run(async (host, client, view) => {
            view = await Analyze(client, await Add(client, view));
            var result = await client.PostAsJsonAsync("/api/profile/evidence/accept", new EvidenceAcceptance(view.Workspace.Draft!.Id, view.ProfileVersion, view.Workspace.Version, [new(0, "React", ""), new(1, "Student project", "")]), Wire.Json);
            Check(!result.IsSuccessStatusCode && (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!.Skills.Length == 0);
        }));
        test("explicit skill adoption updates an older reported-lacks fact rather than silently ignoring it", () => Run(async (host, client, view) => {
            var original = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
            (await client.PutAsJsonAsync("/api/profile", new ProfileUpdate(original.Version, original with { Skills = [new("old-react", "React", "reported_lacks")] }), Wire.Json)).EnsureSuccessStatusCode();
            view = (await client.GetFromJsonAsync<EvidenceView>("/api/profile/evidence", Wire.Json))!;
            view = await Analyze(client, await Add(client, view));
            (await client.PostAsJsonAsync("/api/profile/evidence/accept", new EvidenceAcceptance(view.Workspace.Draft!.Id, view.ProfileVersion, view.Workspace.Version, [new(0, "React", "")]), Wire.Json)).EnsureSuccessStatusCode();
            var saved = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
            Check(saved.Skills.Length == 1 && saved.Skills[0].Id == "old-react" && saved.Skills[0].State == "reported_has");
        }));
        test("late extraction cannot overwrite changed profile or newer sources", () => Run(async (host, client, view) => {
            view = await Add(client, view); host.Evidence.Entered = new(TaskCreationOptions.RunContinuationsAsynchronously); host.Evidence.Resume = new(TaskCreationOptions.RunContinuationsAsynchronously);
            var pending = client.PostAsJsonAsync("/api/profile/evidence/analyze", new EvidenceAnalysisRequest(view.ProfileVersion, view.Workspace.Version, [view.Workspace.Sources[0].Id], true, "en"), Wire.Json);
            await host.Evidence.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10)); await Add(client, view); host.Evidence.Resume.TrySetResult();
            Check((await pending).StatusCode == HttpStatusCode.Conflict && (await client.GetFromJsonAsync<EvidenceView>("/api/profile/evidence", Wire.Json))!.Workspace.Draft is null);
        }));
        test("private evidence cannot be referenced from a different student account", () => Run(async (host, client, view) => {
            view = await Add(client, view);
            using var other = host.CreateClient(); other.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
            (await other.PostAsJsonAsync("/api/auth/register", new RegisterRequest("other-evidence-" + Guid.NewGuid().ToString("N") + "@example.invalid", "Synthetic-Evidence-Check-2026!", "Temporary second account"), Wire.Json)).EnsureSuccessStatusCode();
            var profile = (await other.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
            try {
                var own = (await other.GetFromJsonAsync<EvidenceView>("/api/profile/evidence", Wire.Json))!;
                Check(own.Workspace.Sources.Count == 0);
                var result = await other.PostAsJsonAsync("/api/profile/evidence/analyze", new EvidenceAnalysisRequest(own.ProfileVersion, own.Workspace.Version, [view.Workspace.Sources[0].Id], true, "en"), Wire.Json);
                Check(result.StatusCode == HttpStatusCode.NotFound);
            } finally { await host.Services.GetRequiredService<IStateStore>().Delete(profile.Id["profile-".Length..], CancellationToken.None); }
        }));
        test("source deletion removes private quotations and preserves adopted profile facts and plans", () => Run(async (host, client, view) => {
            view = await Analyze(client, await Add(client, view));
            var accepted = await client.PostAsJsonAsync("/api/profile/evidence/accept", new EvidenceAcceptance(view.Workspace.Draft!.Id, view.ProfileVersion, view.Workspace.Version, [new(0, "React", "")]), Wire.Json); accepted.EnsureSuccessStatusCode();
            view = (await accepted.Content.ReadFromJsonAsync<EvidenceView>(Wire.Json))!;
            using var request = new HttpRequestMessage(HttpMethod.Delete, "/api/profile/evidence/" + view.Workspace.Sources[0].Id) { Content = JsonContent.Create(new DeleteSourceRequest(view.ProfileVersion, view.Workspace.Version), options: Wire.Json) };
            (await client.SendAsync(request)).EnsureSuccessStatusCode();
            var saved = (await client.GetFromJsonAsync<EvidenceView>("/api/profile/evidence", Wire.Json))!;
            Check(saved.Workspace.Sources.Count == 0 && saved.Workspace.Confirmed[0].References.Length == 0 && (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!.Skills.Any(s => s.Label == "React"));
        }));
        test("evidence comparison cites only current confirmed facts and cannot change participation", () => Run(async (host, client, view) => {
            view = await Analyze(client, await Add(client, view));
            var accepted = await client.PostAsJsonAsync("/api/profile/evidence/accept", new EvidenceAcceptance(view.Workspace.Draft!.Id, view.ProfileVersion, view.Workspace.Version, [new(0, "React", "")]), Wire.Json); accepted.EnsureSuccessStatusCode();
            view = (await accepted.Content.ReadFromJsonAsync<EvidenceView>(Wire.Json))!;
            var before = await client.GetStringAsync("/api/profile");
            var response = await client.PostAsJsonAsync("/api/listings/meta-global-ai-2026/evidence-comparison", new InsightRequest(view.ProfileVersion, view.Workspace.Version, true, "en"), Wire.Json); response.EnsureSuccessStatusCode();
            var insight = (await response.Content.ReadFromJsonAsync<InsightView>(Wire.Json))!;
            var modelContext = host.Evidence.LastContext ?? throw new Exception("The comparison model context was not captured.");
            Check(modelContext["profile"] is null && modelContext["confirmed"]!.AsArray().All(f => f?["value"] is not null && f?["contribution"] is not null));
            Check(modelContext["availability"]?["unit"]?.GetValue<string>() == "hours_per_week" && modelContext["sourceCoverage"] is not null && insight.Analysis.Recommendation is not null);
            Check(modelContext["confirmed"]!.AsArray().Any(f => f?["supportingPassages"]?.AsArray().Count > 0));
            Check(insight.Analysis.Connections[0].EvidenceIds[0] == view.Workspace.Confirmed[0].Id && await client.GetStringAsync("/api/profile") == before);
            var calls = host.Evidence.Calls;
            var restored = (await client.GetFromJsonAsync<InsightView>("/api/listings/meta-global-ai-2026/evidence-comparison?language=en", Wire.Json))!;
            Check(restored.GeneratedAt == insight.GeneratedAt && !restored.Outdated && host.Evidence.Calls == calls);
            await Add(client, view);
            var stale = (await client.GetFromJsonAsync<InsightView>("/api/listings/meta-global-ai-2026/evidence-comparison?language=en", Wire.Json))!;
            Check(stale.Outdated && host.Evidence.Calls == calls);
            view = (await client.GetFromJsonAsync<EvidenceView>("/api/profile/evidence", Wire.Json))!;
            host.Evidence.Invalid = true;
            Check(!(await client.PostAsJsonAsync("/api/listings/meta-global-ai-2026/evidence-comparison", new InsightRequest(view.ProfileVersion, view.Workspace.Version, true, "en"), Wire.Json)).IsSuccessStatusCode);
        }));
        test("source acceptance preserves an existing plan and confirmed Done progress", () => Run(async (host, client, view) => {
            var original = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
            var updated = original with { Goals = [new("goal-evidence", "Prepare an interaction walkthrough")], AvailableHoursPerWeek = new JsonObject { ["state"] = "known", ["value"] = 5, ["reportedAt"] = DateTimeOffset.UtcNow.ToString("O") } };
            (await client.PutAsJsonAsync("/api/profile", new ProfileUpdate(original.Version, updated), Wire.Json)).EnsureSuccessStatusCode();
            var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
            var opportunity = (await client.GetFromJsonAsync<Opportunity>("/api/opportunities/E01", Wire.Json))!;
            var submission = (await client.GetFromJsonAsync<SubmissionState>("/api/submissions/E01", Wire.Json))!;
            var candidate = await client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", new AnalysisRequest(opportunity.SourceRevision, profile, submission), Wire.Json); candidate.EnsureSuccessStatusCode();
            var acceptedPlan = await client.PostAsJsonAsync("/api/plans/E01/accept", new AcceptPlan(candidate.Headers.GetValues("X-Candidate-Id").Single(), null, Guid.NewGuid().ToString("N")), Wire.Json);
            // Route names are kept identical to the public preparation controller.
            acceptedPlan.EnsureSuccessStatusCode();
            var plan = (await acceptedPlan.Content.ReadFromJsonAsync<Plan>(Wire.Json))!;
            var done = await client.PatchAsJsonAsync($"/api/plans/E01/tasks/{plan.Tasks[0].Id}", new TaskUpdate(plan.Version, "done", Guid.NewGuid().ToString("N")), Wire.Json); done.EnsureSuccessStatusCode();
            var before = await client.GetStringAsync("/api/plans");
            view = (await client.GetFromJsonAsync<EvidenceView>("/api/profile/evidence", Wire.Json))!;
            view = await Analyze(client, await Add(client, view));
            (await client.PostAsJsonAsync("/api/profile/evidence/accept", new EvidenceAcceptance(view.Workspace.Draft!.Id, view.ProfileVersion, view.Workspace.Version, [new(0, "React", "")]), Wire.Json)).EnsureSuccessStatusCode();
            Check(await client.GetStringAsync("/api/plans") == before);
            profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
            host.Model.Prefix = "Adapt";
            var next = await client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", new AnalysisRequest(opportunity.SourceRevision, profile, submission, (await done.Content.ReadFromJsonAsync<Plan>(Wire.Json))!), Wire.Json); next.EnsureSuccessStatusCode();
            Check(host.Model.LastContext!.SelfReport.ReportedSkills.Any(s => s.Contains("React")));
        }));
        test("focused clarification preserves progress context and reaches the next comparison with weekly-hour units", () => Run(async (host, client, view) => {
            var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
            (await client.PutAsJsonAsync("/api/profile", new ProfileUpdate(profile.Version, profile with { AvailableHoursPerWeek = new JsonObject { ["state"] = "known", ["value"] = 8, ["reportedAt"] = DateTimeOffset.UtcNow.ToString("O") } }), Wire.Json)).EnsureSuccessStatusCode();
            view = (await client.GetFromJsonAsync<EvidenceView>("/api/profile/evidence", Wire.Json))!;
            var generated = await client.PostAsJsonAsync("/api/listings/meta-global-ai-2026/evidence-comparison", new InsightRequest(view.ProfileVersion, view.Workspace.Version, true, "en"), Wire.Json); generated.EnsureSuccessStatusCode();
            var analysis = (await generated.Content.ReadFromJsonAsync<InsightView>(Wire.Json))!;
            Check(host.Evidence.LastContext!["availability"]!["unit"]!.GetValue<string>() == "hours_per_week" && host.Evidence.LastContext!["availability"]!["fact"]!["value"]!.GetValue<int>() == 8);
            var calls = host.Evidence.Calls;
            const string answer = "I built a Python command-line project with functions, file storage and tests myself.";
            var response = await client.PostAsJsonAsync("/api/listings/meta-global-ai-2026/comparison-answer", new ComparisonAnswer(view.ProfileVersion, view.Workspace.Version, "en", analysis.Analysis.Questions[0], answer), Wire.Json); response.EnsureSuccessStatusCode();
            var updated = (await response.Content.ReadFromJsonAsync<EvidenceView>(Wire.Json))!;
            Check(updated.ProfileVersion == view.ProfileVersion + 1 && host.Evidence.Calls == calls);
            var repeated = await client.PostAsJsonAsync("/api/listings/meta-global-ai-2026/comparison-answer", new ComparisonAnswer(view.ProfileVersion, view.Workspace.Version, "en", analysis.Analysis.Questions[0], answer), Wire.Json); repeated.EnsureSuccessStatusCode();
            Check((await repeated.Content.ReadFromJsonAsync<EvidenceView>(Wire.Json))!.ProfileVersion == updated.ProfileVersion);
            Check((await client.GetFromJsonAsync<InsightView>("/api/listings/meta-global-ai-2026/evidence-comparison?language=en", Wire.Json))!.Outdated);
            var next = await client.PostAsJsonAsync("/api/listings/meta-global-ai-2026/evidence-comparison", new InsightRequest(updated.ProfileVersion, updated.Workspace.Version, true, "en"), Wire.Json); next.EnsureSuccessStatusCode();
            Check(host.Evidence.LastContext!["confirmed"]!.AsArray().Any(f => f!["value"]!.GetValue<string>().Contains(answer)));
            var stale = await client.PostAsJsonAsync("/api/listings/meta-global-ai-2026/comparison-answer", new ComparisonAnswer(view.ProfileVersion, view.Workspace.Version, "en", analysis.Analysis.Questions[0], "Different answer"), Wire.Json);
            Check(stale.StatusCode == HttpStatusCode.Conflict);
        }));
    }
}

public sealed class GitHubEvidenceFixture : HttpMessageHandler {
    public List<string> Paths { get; } = [];
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) {
        var path = request.RequestUri!.AbsolutePath; Paths.Add(path);
        if (request.RequestUri.Host != "api.github.com") throw new Exception("Unexpected external host");
        var body = path switch {
            "/repos/student/scheduler" => "{\"private\":false,\"default_branch\":\"main\"}",
            "/repos/student/scheduler/commits/main" => "{\"sha\":\"" + new string('a', 40) + "\"}",
            var p when p.Contains("/git/trees/") => "{\"tree\":[{\"path\":\"README.md\",\"type\":\"blob\",\"mode\":\"100644\",\"size\":100,\"sha\":\"readme\"},{\"path\":\"src/calendar.ts\",\"type\":\"blob\",\"mode\":\"100644\",\"size\":100,\"sha\":\"code\"},{\"path\":\"src/secrets.ts\",\"type\":\"blob\",\"mode\":\"100644\",\"size\":100,\"sha\":\"secret\"},{\"path\":\"linked.py\",\"type\":\"blob\",\"mode\":\"120000\",\"size\":100,\"sha\":\"symlink\"}]}",
            var p when p.EndsWith("/readme") => "{\"encoding\":\"base64\",\"content\":\"" + Convert.ToBase64String(Encoding.UTF8.GetBytes("A student scheduling project with a React calendar interface.")) + "\"}",
            var p when p.EndsWith("/code") => "{\"encoding\":\"base64\",\"content\":\"" + Convert.ToBase64String(Encoding.UTF8.GetBytes("export function validateDate(value: string) { return value.length > 0; }")) + "\"}",
            _ => throw new Exception("Unexpected GitHub fixture path: " + path)
        };
        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") });
    }
}
