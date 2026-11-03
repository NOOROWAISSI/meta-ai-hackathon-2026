using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using NextStep.Api;
using NextStep.MetaAi;

// P2 disclosure gate regression checks: generation is refused without a
// current acknowledgment (no provider call, no persisted candidate), works
// after acknowledgment, and is refused again after withdrawal or when the
// stored acknowledgment predates the current disclosure version.
public static class DisclosureChecks
{
    private static void Check(bool condition) { if (!condition) throw new Exception("Disclosure assertion failed"); }

    public static void Register(Action<string, Func<Task>> test)
    {
        test("generation without acknowledgment is refused with no provider call and no candidate", async () => {
            await using var host = new Factory();
            var (client, profile, submission, opportunity) = await Setup(host);
            var before = host.Model.Calls;
            var refused = await client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(profile, submission, opportunity), Wire.Json);
            Check(refused.StatusCode == HttpStatusCode.Forbidden);
            Check((await refused.Content.ReadFromJsonAsync<ApiError>(Wire.Json))!.Code == "disclosure_required");
            Check(host.Model.Calls == before);
            var store = host.Services.GetRequiredService<IStateStore>();
            Check(await store.Read(Owner(profile), state => state.Candidates.Count, CancellationToken.None) == 0);
            var status = (await client.GetFromJsonAsync<DisclosureStatus>("/api/profile/disclosure", Wire.Json))!;
            Check(status.Required && status.AcknowledgedVersion is null && status.CurrentVersion == Disclosure.CurrentVersion);
        });
        test("acknowledgment is server-timestamped and enables generation", async () => {
            await using var host = new Factory();
            var (client, profile, submission, opportunity) = await Setup(host);
            var before = DateTimeOffset.UtcNow.AddMinutes(-1);
            var status = (await (await client.PostAsync("/api/profile/disclosure/acknowledge", null)).Content.ReadFromJsonAsync<DisclosureStatus>(Wire.Json))!;
            Check(!status.Required && status.AcknowledgedVersion == Disclosure.CurrentVersion);
            Check(status.AcknowledgedAt is not null && DateTimeOffset.Parse(status.AcknowledgedAt) >= before);
            var generated = await client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(profile, submission, opportunity), Wire.Json);
            generated.EnsureSuccessStatusCode();
            Check(generated.Headers.Contains("X-Candidate-Id"));
        });
        test("withdrawing acknowledgment blocks generation again", async () => {
            await using var host = new Factory();
            var (client, profile, submission, opportunity) = await Setup(host);
            (await client.PostAsync("/api/profile/disclosure/acknowledge", null)).EnsureSuccessStatusCode();
            var generated = await client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(profile, submission, opportunity), Wire.Json);
            generated.EnsureSuccessStatusCode();
            var calls = host.Model.Calls;
            var status = (await (await client.PostAsync("/api/profile/disclosure/withdraw", null)).Content.ReadFromJsonAsync<DisclosureStatus>(Wire.Json))!;
            Check(status.Required && status.AcknowledgedVersion is null);
            var refused = await client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(profile, submission, opportunity), Wire.Json);
            Check(refused.StatusCode == HttpStatusCode.Forbidden && host.Model.Calls == calls);
        });
        test("withdrawal after acceptance blocks generation and preserves accepted progress", async () => {
            await using var host = new Factory();
            var (client, profile, submission, opportunity) = await Setup(host);
            (await client.PostAsync("/api/profile/disclosure/acknowledge", null)).EnsureSuccessStatusCode();
            var generated = await client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(profile, submission, opportunity), Wire.Json);
            generated.EnsureSuccessStatusCode();
            var acceptedPlan = await client.PostAsJsonAsync("/api/plans/E01/accept", new AcceptPlan(generated.Headers.GetValues("X-Candidate-Id").Single(), null, Guid.NewGuid().ToString("N")), Wire.Json);
            acceptedPlan.EnsureSuccessStatusCode();
            var plan = (await acceptedPlan.Content.ReadFromJsonAsync<Plan>(Wire.Json))!;
            var done = await client.PatchAsJsonAsync($"/api/plans/E01/tasks/{plan.Tasks[0].Id}", new TaskUpdate(plan.Version, "done", Guid.NewGuid().ToString("N")), Wire.Json);
            done.EnsureSuccessStatusCode();
            var plansBefore = await client.GetStringAsync("/api/plans");
            var calls = host.Model.Calls;
            var status = (await (await client.PostAsync("/api/profile/disclosure/withdraw", null)).Content.ReadFromJsonAsync<DisclosureStatus>(Wire.Json))!;
            Check(status.Required && status.AcknowledgedVersion is null);
            var refused = await client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(profile, submission, opportunity), Wire.Json);
            Check(refused.StatusCode == HttpStatusCode.Forbidden && host.Model.Calls == calls);
            Check((await refused.Content.ReadFromJsonAsync<ApiError>(Wire.Json))!.Code == "disclosure_required");
            Check(await client.GetStringAsync("/api/plans") == plansBefore);
        });
        test("an outdated acknowledgment version blocks generation until re-acknowledged", async () => {
            await using var host = new Factory();
            var (client, profile, submission, opportunity) = await Setup(host);
            var disclosureStore = host.Services.GetRequiredService<DisclosureStore>();
            await disclosureStore.Set(Owner(profile), new DisclosureAck(Disclosure.CurrentVersion - 1, DateTimeOffset.UtcNow.ToString("O")), CancellationToken.None);
            var refused = await client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(profile, submission, opportunity), Wire.Json);
            Check(refused.StatusCode == HttpStatusCode.Forbidden);
            Check((await refused.Content.ReadFromJsonAsync<ApiError>(Wire.Json))!.Code == "disclosure_required");
            (await client.PostAsync("/api/profile/disclosure/acknowledge", null)).EnsureSuccessStatusCode();
            var generated = await client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(profile, submission, opportunity), Wire.Json);
            generated.EnsureSuccessStatusCode();
        });
    }

    private static string Owner(StudentProfile profile) => profile.Id["profile-".Length..];
    private static AnalysisRequest Request(StudentProfile profile, SubmissionState submission, Opportunity opportunity) => new(opportunity.SourceRevision, profile, submission);
    private static JsonObject Known(double value) => new() { ["state"] = "known", ["value"] = value, ["reportedAt"] = "2026-10-28T00:00:00Z" };
    private static JsonObject KnownText(string value) => new() { ["state"] = "known", ["value"] = value, ["reportedAt"] = "2026-10-28T00:00:00Z" };

    private static async Task<(HttpClient Client, StudentProfile Profile, SubmissionState Submission, Opportunity Opportunity)> Setup(Factory host)
    {
        var client = host.CreateClient(); client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
        (await client.PostAsync("/api/session", null)).EnsureSuccessStatusCode();
        var original = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
        var profile = original with { AvailableHoursPerWeek = Known(5), Goals = [new("goal-disclosure", "Prepare a prototype walkthrough")], EntrantType = KnownText("individual"), Enrollment = KnownText("higher_education"), Background = "Synthetic disclosure check profile" };
        var saved = await client.PutAsJsonAsync("/api/profile", new ProfileUpdate(original.Version, profile), Wire.Json); saved.EnsureSuccessStatusCode();
        profile = (await saved.Content.ReadFromJsonAsync<StudentProfile>(Wire.Json))!;
        var opportunity = (await client.GetFromJsonAsync<Opportunity>("/api/opportunities/E01", Wire.Json))!;
        var submission = (await client.GetFromJsonAsync<SubmissionState>("/api/submissions/E01", Wire.Json))!;
        return (client, profile, submission, opportunity);
    }
}
