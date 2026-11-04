using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using NextStep.Api;
using NextStep.Api.Controllers;

public static class PreparationSelectionChecks {
    private static void Check(bool value) { if (!value) throw new Exception("Preparation selection assertion failed"); }
    public static void Register(Action<string, Func<Task>> test) {
        test("Birzeit preparation choice persists without inventing an accepted plan or participation report", async () => {
            await using var host = new Factory(); using var client = host.CreateClient(); client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
            var registration = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest("preparation-" + Guid.NewGuid().ToString("N") + "@example.test", "Synthetic-password-42!", "Preparation check"), Wire.Json); registration.EnsureSuccessStatusCode();
            var account = (await registration.Content.ReadFromJsonAsync<AccountView>(Wire.Json))!;
            var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!; var owner = profile.Id["profile-".Length..];
            const string id = "palestine-summit-birzeit-demo-2026";
            try {
                var request = new PreparationSelectionRequest(account.Id);
                var response = await client.PutAsJsonAsync("/api/preparation-selections/" + id, request, Wire.Json); response.EnsureSuccessStatusCode();
                var first = (await response.Content.ReadFromJsonAsync<PreparationSelectionView>(Wire.Json))!;
                Check(first.Title == "Mini Hackathon & Demo Day" && first.AccessState == "source_review_required");
                (await client.PutAsJsonAsync("/api/preparation-selections/" + id, request, Wire.Json)).EnsureSuccessStatusCode();
                var restored = (await client.GetFromJsonAsync<PreparationSelectionView[]>("/api/preparation-selections", Wire.Json))!.Single(); Check(restored.SelectedAt == first.SelectedAt && restored.OpportunityId == id);
                Check(await host.Services.GetRequiredService<IStateStore>().Read(owner, s => s.Plans.Count == 0 && s.Candidates.Count == 0 && s.Preferences.Count == 0 && s.Profile.Version == profile.Version && s.Profile.ClarificationAnswers.Length == profile.ClarificationAnswers.Length, CancellationToken.None));
                Check(host.Model.Calls == 0 && host.Evidence.Calls == 0);
                using var remove = new HttpRequestMessage(HttpMethod.Delete, "/api/preparation-selections/" + id) { Content = JsonContent.Create(request, options: Wire.Json) };
                (await client.SendAsync(remove)).EnsureSuccessStatusCode(); Check((await client.GetFromJsonAsync<PreparationSelectionView[]>("/api/preparation-selections", Wire.Json))!.Length == 0);
            } finally { await host.Services.GetRequiredService<IStateStore>().Delete(owner, CancellationToken.None); }
        });
        test("preparation selection rejects wrong accounts, non-hackathons and unavailable IDs", async () => {
            await using var host = new Factory(); using var client = host.CreateClient(); client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
            var registered = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest("selection-" + Guid.NewGuid().ToString("N") + "@example.test", "Synthetic-password-42!"), Wire.Json); registered.EnsureSuccessStatusCode();
            var account = (await registered.Content.ReadFromJsonAsync<AccountView>(Wire.Json))!; var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!; var owner = profile.Id["profile-".Length..];
            try {
                Check((await client.PutAsJsonAsync("/api/preparation-selections/palestine-summit-birzeit-demo-2026", new PreparationSelectionRequest("wrong-account"), Wire.Json)).StatusCode == HttpStatusCode.Conflict);
                Check((await client.PutAsJsonAsync("/api/preparation-selections/harvard-cs50x", new PreparationSelectionRequest(account.Id), Wire.Json)).StatusCode == HttpStatusCode.BadRequest);
                Check((await client.PutAsJsonAsync("/api/preparation-selections/missing-event", new PreparationSelectionRequest(account.Id), Wire.Json)).StatusCode == HttpStatusCode.NotFound);
                Check((await client.GetFromJsonAsync<PreparationSelectionView[]>("/api/preparation-selections", Wire.Json))!.Length == 0);
            } finally { await host.Services.GetRequiredService<IStateStore>().Delete(owner, CancellationToken.None); }
        });
    }
}
