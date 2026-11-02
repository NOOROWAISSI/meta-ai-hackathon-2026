using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using NextStep.Api;
using NextStep.MetaAi;

// PR #31 review regression: a regenerated draft whose rendered template
// title collides with a retained task must be judged by trusted action plus
// target, not by the title. A different goal is new work and is allowed; the
// same action on the same target remains a repeat and is rejected. Accepted
// plan state and submission evidence stay byte-identical either way.
public static class RetainedDuplicateChecks
{
    private static void Check(bool condition) { if (!condition) throw new Exception("Retained duplicate assertion failed"); }

    public static void Register(Action<string, Func<Task>> test)
    {
        test("regeneration is judged by action and target, not by rendered title", async () => {
            await using var host = new Factory();
            var client = host.CreateClient(); client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
            (await client.PostAsync("/api/session", null)).EnsureSuccessStatusCode();
            var original = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
            var profile = await SaveProfile(client, original, [new("goal-a", "First goal"), new("goal-b", "Second goal")]);
            var opportunity = (await client.GetFromJsonAsync<Opportunity>("/api/opportunities/E01", Wire.Json))!;
            var submission = (await client.GetFromJsonAsync<SubmissionState>("/api/submissions/E01", Wire.Json))!;

            // First plan targets goal-a (the fake model uses the first goal):
            // clarify plus prototype. Accept it and complete the prototype task
            // so it is retained work.
            var generated = await client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(profile, submission, opportunity), Wire.Json);
            generated.EnsureSuccessStatusCode();
            var candidateId = generated.Headers.GetValues("X-Candidate-Id").Single();
            var plan = (await (await client.PostAsJsonAsync("/api/plans/E01/accept", new AcceptPlan(candidateId, null, Guid.NewGuid().ToString("N")), Wire.Json)).Content.ReadFromJsonAsync<Plan>(Wire.Json))!;
            var prototype = plan.Tasks.Single(t => t.Title.Contains("Prototype"));
            Check(prototype.Title == "Step 2: Prototype a small component");
            var progressed = await client.PatchAsJsonAsync($"/api/plans/E01/tasks/{prototype.Id}", new TaskUpdate(plan.Version, "done", Guid.NewGuid().ToString("N"), []), Wire.Json);
            progressed.EnsureSuccessStatusCode();
            plan = (await progressed.Content.ReadFromJsonAsync<Plan>(Wire.Json))!;
            var planJson = JsonSerializer.Serialize(plan, Wire.Json);
            var submissionJson = JsonSerializer.Serialize(submission, Wire.Json);

            // Regenerate with goal-b first. The new prototype task renders the
            // identical title "Step 2: Prototype a small component" but targets
            // goal-b: new work, so generation must succeed.
            profile = await SaveProfile(client, profile, [new("goal-b", "Second goal"), new("goal-a", "First goal")]);
            var regenerated = await client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(profile, submission, opportunity, plan), Wire.Json);
            if (!regenerated.IsSuccessStatusCode) throw new Exception("Regeneration for a different goal was refused: " + await regenerated.Content.ReadAsStringAsync());
            Check(regenerated.Headers.Contains("X-Candidate-Id"));
            Check(JsonSerializer.Serialize((await client.GetFromJsonAsync<Plan>("/api/plans/E01", Wire.Json))!, Wire.Json) == planJson);
            Check(JsonSerializer.Serialize((await client.GetFromJsonAsync<SubmissionState>("/api/submissions/E01", Wire.Json))!, Wire.Json) == submissionJson);

            // Regenerate with goal-a first again: the prototype selection now
            // repeats the retained action on the same target and is rejected,
            // leaving the accepted plan and submission untouched.
            profile = await SaveProfile(client, profile, [new("goal-a", "First goal"), new("goal-b", "Second goal")]);
            var repeated = await client.PostAsJsonAsync("/api/opportunities/E01/plan-candidates", Request(profile, submission, opportunity, plan), Wire.Json);
            Check(repeated.StatusCode == HttpStatusCode.ServiceUnavailable);
            Check((await repeated.Content.ReadFromJsonAsync<ApiError>(Wire.Json))!.Code == "invalid_model_output");
            Check(JsonSerializer.Serialize((await client.GetFromJsonAsync<Plan>("/api/plans/E01", Wire.Json))!, Wire.Json) == planJson);
            Check(JsonSerializer.Serialize((await client.GetFromJsonAsync<SubmissionState>("/api/submissions/E01", Wire.Json))!, Wire.Json) == submissionJson);
        });
    }

    private static AnalysisRequest Request(StudentProfile profile, SubmissionState submission, Opportunity opportunity, Plan? previous = null) => new(opportunity.SourceRevision, profile, submission, previous);
    private static JsonObject Known(double value) => new() { ["state"] = "known", ["value"] = value, ["reportedAt"] = "2026-10-28T00:00:00Z" };
    private static JsonObject KnownText(string value) => new() { ["state"] = "known", ["value"] = value, ["reportedAt"] = "2026-10-28T00:00:00Z" };

    private static async Task<StudentProfile> SaveProfile(HttpClient client, StudentProfile current, PlanGoal[] goals)
    {
        var profile = current with { AvailableHoursPerWeek = Known(5), Goals = goals, EntrantType = KnownText("individual"), Enrollment = KnownText("higher_education"), Background = "Synthetic duplicate check profile" };
        var saved = await client.PutAsJsonAsync("/api/profile", new ProfileUpdate(current.Version, profile), Wire.Json);
        saved.EnsureSuccessStatusCode();
        return (await saved.Content.ReadFromJsonAsync<StudentProfile>(Wire.Json))!;
    }
}
