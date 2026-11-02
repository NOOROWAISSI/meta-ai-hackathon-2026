using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using MySqlConnector;
using NextStep.Api;
using NextStep.Api.Controllers;

public static class PalestineNetworkChecks {
    private static void Check(bool value) { if (!value) throw new Exception("Palestine network assertion failed"); }
    private const string Text = "Synthetic University invites you. Python training bootcamp. Learn Python programming through practical functions, tests and a project. Register now for this Python training bootcamp.";
    private static readonly AnnouncementDraft Draft = new("announcement", "training", "Python training bootcamp", "Synthetic University", "Learn Python programming through practical functions, tests and a project.", "Register now for this Python training bootcamp.", ["Python", "Programming", "Robotics"]);
    public static void Register(Action<string, Func<Task>> test) {
        test("Palestine network exposes 21 ministry institutions without inventing student branches", async () => {
            await using var host = new Factory(); using var client = host.CreateClient();
            var network = (await client.GetFromJsonAsync<PalestineNetworkView>("/api/sources/network", Wire.Json))!;
            Check(network.Institutions.Length == 21 && network.Institutions.DistinctBy(u => u.Id).Count() == 21);
            Check(network.Organizations.All(o => network.Institutions.Any(u => u.Id == o.UniversityId) && new Uri(o.ReferenceUrl).Scheme == "https"));
            Check(network.Organizations.Any(o => o.Id == "ewb-najah" && o.Channel == "instagram"));
            Check(!network.Organizations.Any(o => o.UniversityId == "alazhar"));
            var sources = (await client.GetFromJsonAsync<SourceRegistration[]>("/api/sources", Wire.Json))!;
            Check(sources.Single(s => s.Id == "campus-ewb-najah").Collection == "manual_review");
        });
        test("announcement output requires literal organizer, invitation and subject evidence and rejects recaps", () => {
            var source = new SourceRegistration("synthetic", "Listing host", "https://source.example.invalid", "palestine", "official_website", "public_html", null, "Synthetic") { UniversityId = "najah" };
            var uri = new Uri("https://source.example.invalid/training"); var listing = AnnouncementIntake.Validate(Draft, Text, uri, source)!;
            Check(listing is not null && listing.Kind == "training" && listing.UniversityId == "najah" && listing.OrganizationId is null && listing.Organizer == "Synthetic University");
            Check(listing!.RegistrationState == "not_specified" && listing.RegistrationDeadline is null && listing.LastReviewedAt is null && listing.Format == "unknown" && listing.Topics.SequenceEqual(new[] { "Python", "Programming" }));
            Check(AnnouncementIntake.Validate(Draft with { Classification = "recap" }, Text, uri, source) is null);
            Check(AnnouncementIntake.Validate(Draft with { Organizer = "Invented organizer" }, Text, uri, source) is null);
            Check(AnnouncementIntake.Validate(Draft with { InvitationPassage = "Learn Python programming" }, Text, uri, source) is null);
            Check(!AnnouncementIntake.PageText("<main><script>Invented registration</script><p>Actual source</p></main>").Contains("Invented"));
            return Task.CompletedTask;
        });
        test("unchanged announcement extraction is persisted once including failure, and old news spends no call", async () => {
            await using var host = new Factory(); host.Announcements.Draft = Draft;
            var store = host.Services.GetRequiredService<MySqlStateStore>();
            IConfiguration Configuration(int limit) => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["SourceCollection:MetaExtraction:Enabled"] = "true", ["SourceCollection:MetaExtraction:MaxDailyRequests"] = limit.ToString() }).Build();
            var intake = new AnnouncementIntake(store, host.Announcements, Configuration(30), NullLogger<AnnouncementIntake>.Instance);
            var source = new SourceRegistration("check-" + Guid.NewGuid().ToString("N"), "Synthetic", "https://source.example.invalid/", "palestine", "official_website", "public_html", null, "Synthetic") { UniversityId = "najah" };
            var page = new Uri(source.Url + source.Id); var html = "<main>" + Text + "</main>";
            try {
                var first = await intake.Read(source, page, html, CancellationToken.None); Check(first.Length == 1 && host.Announcements.Calls == 1);
                var second = await intake.Read(source, page, html, CancellationToken.None); Check(second.Length == 1 && host.Announcements.Calls == 1 && second[0].Id == first[0].Id);
                host.Announcements.Fail = true;
                var changed = html.Replace("</main>", " changed</main>");
                Check((await intake.Read(source, page, changed, CancellationToken.None)).Length == 0);
                Check((await intake.Read(source, page, changed, CancellationToken.None)).Length == 0 && host.Announcements.Calls == 2);
                var noBudget = new AnnouncementIntake(store, host.Announcements, Configuration(0), NullLogger<AnnouncementIntake>.Instance);
                Check((await noBudget.Read(source, page, html.Replace("</main>", " beyond budget</main>"), CancellationToken.None)).Length == 0 && host.Announcements.Calls == 2);
                var old = "<meta property='article:published_time' content='2020-01-01T00:00:00Z'>" + html;
                Check((await intake.Read(source, page, old, CancellationToken.None)).Length == 0 && host.Announcements.Calls == 2);
            } finally {
                await using var db = await store.Open(CancellationToken.None); await using var cleanup = new MySqlCommand("DELETE FROM announcement_extractions WHERE page_url=@url", db); cleanup.Parameters.AddWithValue("@url", page.AbsoluteUri); await cleanup.ExecuteNonQueryAsync();
            }
        });
        test("university follows are owner scoped, idempotent and do not create preparation plans", async () => {
            await using var host = new Factory(); using var client = host.CreateClient(); client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
            (await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest("campus-" + Guid.NewGuid().ToString("N") + "@example.test", "Synthetic-password-42!", "Campus check"), Wire.Json)).EnsureSuccessStatusCode();
            var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!; var owner = profile.Id["profile-".Length..];
            var sourceId = "check-campus-" + Guid.NewGuid().ToString("N");
            try {
                var account = (await (await client.GetAsync("/api/auth/me")).Content.ReadAsStringAsync());
                using var json = JsonDocument.Parse(account); var accountId = json.RootElement.GetProperty("user").GetProperty("id").GetString()!;
                var request = new CampusFollowChange(true, accountId);
                (await client.PutAsJsonAsync("/api/campus-follows/najah", request, Wire.Json)).EnsureSuccessStatusCode();
                var first = (await client.GetFromJsonAsync<CampusFollow[]>("/api/campus-follows", Wire.Json))!.Single();
                (await client.PutAsJsonAsync("/api/campus-follows/najah", request, Wire.Json)).EnsureSuccessStatusCode();
                Check((await client.GetFromJsonAsync<CampusFollow[]>("/api/campus-follows", Wire.Json))!.Single().FollowedAt == first.FollowedAt);
                Check(!(await client.PutAsJsonAsync("/api/campus-follows/najah", request with { ExpectedAccountId = "wrong-owner" }, Wire.Json)).IsSuccessStatusCode);
                Check(!(await client.PutAsJsonAsync("/api/campus-follows/invented", request, Wire.Json)).IsSuccessStatusCode);
                var source = new SourceRegistration(sourceId, "Synthetic University", "https://source.example.invalid/", "palestine", "official_website", "public_html", null, "Synthetic") { UniversityId = "najah" };
                var page = new Uri(source.Url + sourceId); var listing = AnnouncementIntake.Validate(Draft, Text, page, source)!;
                await host.Services.GetRequiredService<DiscoveryFeed>().StorePage(source, page, new("checked", "<main>" + Text + "</main>"), [listing], CancellationToken.None);
                Check((await client.GetFromJsonAsync<CampusFollow[]>("/api/campus-follows", Wire.Json))!.Single().NewOpportunityIds.Contains(listing.Id));
                (await client.PutAsJsonAsync("/api/campus-follows/najah/seen", new CampusSeenChange(accountId), Wire.Json)).EnsureSuccessStatusCode();
                Check((await client.GetFromJsonAsync<CampusFollow[]>("/api/campus-follows", Wire.Json))!.Single().NewOpportunityIds.Length == 0);
                (await client.PutAsJsonAsync("/api/campus-follows/najah", request with { Following = false }, Wire.Json)).EnsureSuccessStatusCode();
                Check((await client.GetFromJsonAsync<CampusFollow[]>("/api/campus-follows", Wire.Json))!.Length == 0);
                Check((await host.Services.GetRequiredService<IStateStore>().Read(owner, state => state.Plans.Count, CancellationToken.None)) == 0);
            } finally {
                await host.Services.GetRequiredService<IStateStore>().Delete(owner, CancellationToken.None);
                await using var db = await host.Services.GetRequiredService<MySqlStateStore>().Open(CancellationToken.None);
                foreach (var table in new[] { "discovered_listings", "source_pages" }) { await using var cleanup = new MySqlCommand($"DELETE FROM {table} WHERE source_id=@source", db); cleanup.Parameters.AddWithValue("@source", sourceId); await cleanup.ExecuteNonQueryAsync(); }
            }
        });
    }
}
