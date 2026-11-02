using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using MySqlConnector;
using NextStep.Api;
using NextStep.Api.Controllers;

// Combined integration: the per-document extraction opt-in boundary. These
// checks prove that PR #29 extraction cannot reach the provider without a
// server-recorded opt-in for that specific source, that the plan-generation
// disclosure acknowledgment does not substitute for it (and it does not
// substitute for that), and that withdrawal re-blocks extraction.
public static class EvidenceOptInChecks
{
    private static async Task<string> ErrorCode(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<System.Text.Json.Nodes.JsonObject>(Wire.Json))!["code"]!.GetValue<string>();
    private static void Check(bool value) { if (!value) throw new Exception("Evidence opt-in assertion failed"); }

    private static async Task Run(Func<Factory, HttpClient, EvidenceView, Task> check)
    {
        await using var host = new Factory(); using var client = host.CreateClient(); client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
        (await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest("optin-" + Guid.NewGuid().ToString("N") + "@example.invalid", "Synthetic-OptIn-Check-2026!", "Temporary opt-in check"), Wire.Json)).EnsureSuccessStatusCode();
        var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
        try { await check(host, client, (await client.GetFromJsonAsync<EvidenceView>("/api/profile/evidence", Wire.Json))!); }
        finally { await host.Services.GetRequiredService<IStateStore>().Delete(profile.Id["profile-".Length..], CancellationToken.None); }
    }

    private static async Task<EvidenceView> AddSource(HttpClient client, EvidenceView view, string title)
    {
        var result = await client.PostAsJsonAsync("/api/profile/evidence/text", new TextSourceRequest("cv", title, "I built a React scheduling interface for a student project.", null, view.ProfileVersion, view.Workspace.Version), Wire.Json);
        result.EnsureSuccessStatusCode(); return (await result.Content.ReadFromJsonAsync<EvidenceView>(Wire.Json))!;
    }

    private static async Task<HttpResponseMessage> Analyze(HttpClient client, EvidenceView view, string sourceId) =>
        await client.PostAsJsonAsync("/api/profile/evidence/analyze", new EvidenceAnalysisRequest(view.ProfileVersion, view.Workspace.Version, [sourceId], true, "en"), Wire.Json);

    private static async Task Sql(string statement, params (string, object)[] parameters)
    {
        await using var connection = new MySqlConnection(Environment.GetEnvironmentVariable("NEXTSTEP_CHECKS_CONNECTION") ?? throw new InvalidOperationException("Set NEXTSTEP_CHECKS_CONNECTION."));
        await connection.OpenAsync();
        await using var command = new MySqlCommand(statement, connection);
        foreach (var (name, value) in parameters) command.Parameters.AddWithValue(name, value);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<string> OwnerOf(HttpClient client)
    {
        var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
        return profile.Id["profile-".Length..];
    }

    public static void Register(Action<string, Func<Task>> test)
    {
        test("extraction without a per-document opt-in is refused before any provider call", () => Run(async (host, client, view) =>
        {
            view = await AddSource(client, view, "Synthetic CV");
            var sourceId = view.Workspace.Sources[0].Id;
            var calls = host.Evidence.Calls;
            var refused = await Analyze(client, view, sourceId);
            Check(refused.StatusCode == HttpStatusCode.Forbidden);
            Check(await ErrorCode(refused) == "evidence_optin_required");
            Check(host.Evidence.Calls == calls);
            var after = (await client.GetFromJsonAsync<EvidenceView>("/api/profile/evidence", Wire.Json))!;
            Check(after.Workspace.Draft is null);
            var status = (await client.GetFromJsonAsync<EvidenceImportOptInStatus>("/api/profile/evidence/opt-in/" + sourceId, Wire.Json))!;
            Check(!status.OptedIn && status.OptedInAt is null && status.CurrentVersion == EvidenceOptIn.CurrentVersion);
        }));
        test("the plan-generation acknowledgment does not satisfy the extraction opt-in", () => Run(async (host, client, view) =>
        {
            (await client.PostAsync("/api/profile/disclosure/acknowledge", null)).EnsureSuccessStatusCode();
            view = await AddSource(client, view, "Synthetic CV");
            var calls = host.Evidence.Calls;
            var refused = await Analyze(client, view, view.Workspace.Sources[0].Id);
            Check(refused.StatusCode == HttpStatusCode.Forbidden);
            Check(await ErrorCode(refused) == "evidence_optin_required");
            Check(host.Evidence.Calls == calls);
        }));
        test("opt-in is per source, enables extraction, and withdrawal re-blocks it", () => Run(async (host, client, view) =>
        {
            view = await AddSource(client, view, "First CV");
            view = await AddSource(client, view, "Second CV");
            var first = view.Workspace.Sources[0].Id; var second = view.Workspace.Sources[1].Id;
            var opted = (await (await client.PostAsync("/api/profile/evidence/opt-in/" + first, null)).Content.ReadFromJsonAsync<EvidenceImportOptInStatus>(Wire.Json))!;
            Check(opted.OptedIn && opted.OptedInAt is not null);
            // The other source is still blocked.
            var calls = host.Evidence.Calls;
            var refused = await Analyze(client, view, second);
            Check(refused.StatusCode == HttpStatusCode.Forbidden && host.Evidence.Calls == calls);
            // The opted-in source extracts and stores a draft.
            var ok = await Analyze(client, view, first);
            ok.EnsureSuccessStatusCode();
            Check(host.Evidence.Calls == calls + 1);
            Check((await ok.Content.ReadFromJsonAsync<EvidenceView>(Wire.Json))!.Workspace.Draft is not null);
            // Withdrawal blocks it again.
            (await client.PostAsync("/api/profile/evidence/opt-in/" + first + "/withdraw", null)).EnsureSuccessStatusCode();
            var status = (await client.GetFromJsonAsync<EvidenceImportOptInStatus>("/api/profile/evidence/opt-in/" + first, Wire.Json))!;
            Check(!status.OptedIn);
            var viewNow = (await client.GetFromJsonAsync<EvidenceView>("/api/profile/evidence", Wire.Json))!;
            var blocked = await Analyze(client, viewNow, first);
            Check(blocked.StatusCode == HttpStatusCode.Forbidden);
            Check(host.Evidence.Calls == calls + 1);
        }));
        test("the opt-in is bound to the document content and dies with a stale version", () => Run(async (host, client, view) =>
        {
            view = await AddSource(client, view, "Bound CV");
            var sourceId = view.Workspace.Sources[0].Id;
            var owner = await OwnerOf(client);
            (await client.PostAsync("/api/profile/evidence/opt-in/" + sourceId, null)).EnsureSuccessStatusCode();
            // Simulate the document being materially updated after opt-in:
            // the recorded fingerprint no longer matches the content.
            await Sql("UPDATE evidence_import_optins SET source_hash = @h WHERE owner_id = @o AND source_id = @s", ("@h", new string('0', 64)), ("@o", owner), ("@s", sourceId));
            var status = (await client.GetFromJsonAsync<EvidenceImportOptInStatus>("/api/profile/evidence/opt-in/" + sourceId, Wire.Json))!;
            Check(!status.OptedIn);
            var calls = host.Evidence.Calls;
            var refused = await Analyze(client, view, sourceId);
            Check(refused.StatusCode == HttpStatusCode.Forbidden && host.Evidence.Calls == calls);
            // A stale policy version in the record is equally dead.
            await Sql("UPDATE evidence_import_optins SET version = 99 WHERE owner_id = @o AND source_id = @s", ("@o", owner), ("@s", sourceId));
            var refusedAgain = await Analyze(client, view, sourceId);
            Check(refusedAgain.StatusCode == HttpStatusCode.Forbidden && host.Evidence.Calls == calls);
            // A fresh opt-in against the current content works again.
            (await client.PostAsync("/api/profile/evidence/opt-in/" + sourceId, null)).EnsureSuccessStatusCode();
            (await Analyze(client, view, sourceId)).EnsureSuccessStatusCode();
        }));
        test("replacing a document requires a renewed opt-in", () => Run(async (host, client, view) =>
        {
            view = await AddSource(client, view, "Original CV");
            var originalId = view.Workspace.Sources[0].Id;
            (await client.PostAsync("/api/profile/evidence/opt-in/" + originalId, null)).EnsureSuccessStatusCode();
            using var delete = new HttpRequestMessage(HttpMethod.Delete, "/api/profile/evidence/" + originalId) { Content = JsonContent.Create(new DeleteSourceRequest(view.ProfileVersion, view.Workspace.Version), options: Wire.Json) };
            view = (await (await client.SendAsync(delete)).Content.ReadFromJsonAsync<EvidenceView>(Wire.Json))!;
            view = await AddSource(client, view, "Replacement CV");
            var replacementId = view.Workspace.Sources[0].Id;
            Check(replacementId != originalId);
            var calls = host.Evidence.Calls;
            var refused = await Analyze(client, view, replacementId);
            Check(refused.StatusCode == HttpStatusCode.Forbidden && host.Evidence.Calls == calls);
        }));
        test("opt-ins are isolated per account", () => Run(async (host, client, view) =>
        {
            view = await AddSource(client, view, "Private CV");
            var sourceId = view.Workspace.Sources[0].Id;
            (await client.PostAsync("/api/profile/evidence/opt-in/" + sourceId, null)).EnsureSuccessStatusCode();
            using var other = host.CreateClient(); other.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
            (await other.PostAsJsonAsync("/api/auth/register", new RegisterRequest("optin-other-" + Guid.NewGuid().ToString("N") + "@example.invalid", "Synthetic-OptIn-Check-2026!", "Other account"), Wire.Json)).EnsureSuccessStatusCode();
            var otherProfile = (await other.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
            try
            {
                // The other account cannot see the source, its opt-in, or use it.
                Check((await other.GetAsync("/api/profile/evidence/opt-in/" + sourceId)).StatusCode == HttpStatusCode.NotFound);
                var otherView = (await other.GetFromJsonAsync<EvidenceView>("/api/profile/evidence", Wire.Json))!;
                var calls = host.Evidence.Calls;
                var refused = await Analyze(other, otherView, sourceId);
                Check(refused.StatusCode == HttpStatusCode.NotFound && host.Evidence.Calls == calls);
                // Their own identical-looking document still needs their own opt-in.
                otherView = await AddSource(other, otherView, "Private CV");
                var ownRefused = await Analyze(other, otherView, otherView.Workspace.Sources[0].Id);
                Check(ownRefused.StatusCode == HttpStatusCode.Forbidden && host.Evidence.Calls == calls);
            }
            finally { await host.Services.GetRequiredService<IStateStore>().Delete(otherProfile.Id["profile-".Length..], CancellationToken.None); }
        }));
        test("withdrawal during an in-flight extraction blocks the next one, not the started transmission", () => Run(async (host, client, view) =>
        {
            view = await AddSource(client, view, "Flight CV");
            var sourceId = view.Workspace.Sources[0].Id;
            (await client.PostAsync("/api/profile/evidence/opt-in/" + sourceId, null)).EnsureSuccessStatusCode();
            host.Evidence.Entered = new(TaskCreationOptions.RunContinuationsAsynchronously);
            host.Evidence.Resume = new(TaskCreationOptions.RunContinuationsAsynchronously);
            var pending = Analyze(client, view, sourceId);
            await host.Evidence.Entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
            // The document text has already been transmitted at this point;
            // withdrawal prevents future transmissions, it cannot retract
            // this one (the same rule the disclosure states in the UI).
            (await client.PostAsync("/api/profile/evidence/opt-in/" + sourceId + "/withdraw", null)).EnsureSuccessStatusCode();
            host.Evidence.Resume.TrySetResult();
            (await pending).EnsureSuccessStatusCode();
            var viewNow = (await client.GetFromJsonAsync<EvidenceView>("/api/profile/evidence", Wire.Json))!;
            var calls = host.Evidence.Calls;
            var refused = await Analyze(client, viewNow, sourceId);
            Check(refused.StatusCode == HttpStatusCode.Forbidden && host.Evidence.Calls == calls);
        }));
        test("an extraction opt-in does not satisfy the plan-generation disclosure gate", () => Run(async (host, client, view) =>
        {
            view = await AddSource(client, view, "Synthetic CV");
            (await client.PostAsync("/api/profile/evidence/opt-in/" + view.Workspace.Sources[0].Id, null)).EnsureSuccessStatusCode();
            var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
            var opportunity = (await client.GetFromJsonAsync<Opportunity>("/api/opportunities/E01", Wire.Json))!;
            var submission = (await client.GetFromJsonAsync<SubmissionState>("/api/submissions/E01", Wire.Json))!;
            var calls = host.Model.Calls;
            var refused = await client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", new AnalysisRequest(opportunity.SourceRevision, profile, submission), Wire.Json);
            Check(refused.StatusCode == HttpStatusCode.Forbidden);
            Check(await ErrorCode(refused) == "disclosure_required");
            Check(host.Model.Calls == calls);
        }));
    }
}
