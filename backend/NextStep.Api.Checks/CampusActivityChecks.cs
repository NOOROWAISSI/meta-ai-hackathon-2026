using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using MySqlConnector;
using NextStep.Api;

public static class CampusActivityChecks {
    private static void Check(bool value) { if (!value) throw new Exception("Campus activity assertion failed"); }
    private static string Chapter(string page, string eventUrl, bool past = true, int chapterId = 2664) {
        var entry = new { chapter_id = chapterId, title = "Synthetic Python bootcamp", description = "<p>Practice Python programming through a synthetic exercise.</p>", url = eventUrl, start_date = "2026-10-01T08:00:00Z" };
        var events = new Dictionary<string, object> { [past ? "pastEvents" : "upcomingEvents"] = new { results = new[] { entry } } };
        return "<script id='__NEXT_DATA__' type='application/json'>" + JsonSerializer.Serialize(new { props = new { pageProps = new { chapterData = new { id = 2664, url = page }, prerenderData = events } } }) + "</script>";
    }
    public static void Register(Action<string, Func<Task>> test) {
        test("public GDG adapter reads actual event descriptions and rejects mismatched chapter and external links", () => {
            var page = new Uri("https://gdg.community.dev/gdg-on-campus-birzeit-university-birzeit-palestine/");
            var source = new SourceRegistration("campus-gdg-birzeit", "GDG Birzeit", page.AbsoluteUri, "palestine", "official_website", "public_html", page.AbsoluteUri, "Synthetic fixture") { UniversityId = "birzeit", OrganizationId = "gdg-birzeit" };
            var url = "https://gdg.community.dev/events/details/synthetic-python-bootcamp/";
            var post = GdgCampusReader.Read(Chapter(page.AbsoluteUri, url), page, source).Single();
            Check(post.Availability == "ended" && post.Kind == "training" && post.Summary.Contains("Python programming") && post.UniversityIds.SequenceEqual(new[] { "birzeit" }));
            Check(GdgCampusReader.Read(Chapter(page.AbsoluteUri, "https://other.example.invalid/events/details/"), page, source).Length == 0);
            Check(GdgCampusReader.Read(Chapter(page.AbsoluteUri, url, chapterId: 123), page, source).Length == 0);
            Check(GdgCampusReader.Read(Chapter("https://gdg.community.dev/other-chapter/", url), page, source).Length == 0);
            Check(GdgCampusReader.Read("<script id='__NEXT_DATA__'>{broken}</script>", page, source).Length == 0);
            Check(GdgCampusReader.Read(Chapter(page.AbsoluteUri, url, past: false).Replace("Synthetic Python bootcamp", "Datathon Preparation Session"), page, source).Single().Kind == "community_update");
            return Task.CompletedTask;
        });
        test("social excerpts and completed activities never become reviewed or open opportunities", async () => {
            await using var host = new Factory(); using var client = host.CreateClient();
            var posts = (await client.GetFromJsonAsync<CampusActivity[]>("/api/sources/posts", Wire.Json))!;
            Check(posts.Length >= 14 && posts.Any(p => p.Channel == "instagram" && p.VerificationLevel == "secondary_excerpt"));
            Check(posts.Any(p => p.Channel == "facebook" && p.SourcePassage.Length > 20));
            var listings = await host.Services.GetRequiredService<DiscoveryFeed>().Listings(CancellationToken.None);
            Check(posts.Where(p => p.Availability == "ended" || p.VerificationLevel == "secondary_excerpt").All(p => listings.All(l => l.Id != p.Id)));
            var rag = listings.Single(l => l.Id == "campus-binxttech-rag-announcement");
            Check(rag.RegistrationState == "not_specified" && rag.SourceStatus == "needs_verification" && rag.RegistrationDeadline is null && rag.Format == "unknown");
            Check(host.Model.Calls == 0 && host.Announcements.Calls == 0 && host.Evidence.Calls == 0);
        });
        test("automatic campus post storage preserves first seen and deduplicates successive source checks", async () => {
            await using var host = new Factory(); var feed = host.Services.GetRequiredService<CampusActivityFeed>();
            var sourceId = "check-activity-" + Guid.NewGuid().ToString("N");
            var page = new Uri("https://gdg.community.dev/gdg-on-campus-birzeit-university-birzeit-palestine/");
            var source = new SourceRegistration(sourceId, "Synthetic GDG", page.AbsoluteUri, "palestine", "official_website", "public_html", null, "Synthetic") { UniversityId = "birzeit", OrganizationId = "gdg-birzeit" };
            var url = "https://gdg.community.dev/events/details/" + sourceId + "/";
            var post = GdgCampusReader.Read(Chapter(page.AbsoluteUri, url), page, source).Single();
            try {
                await feed.Store(source, [post], CancellationToken.None); var first = (await feed.Read(CancellationToken.None)).Single(p => p.Id == post.Id);
                await feed.Store(source, [post with { CollectedAt = DateTimeOffset.UtcNow.AddMinutes(1).ToString("O") }], CancellationToken.None);
                var second = (await feed.Read(CancellationToken.None)).Single(p => p.Id == post.Id); Check(first.FirstSeenAt == second.FirstSeenAt && first.FirstSeenAt is not null);
                Check(!(await feed.Opportunities(CancellationToken.None)).Any(l => l.Id == post.Id));
            } finally { await using var db = await host.Services.GetRequiredService<MySqlStateStore>().Open(CancellationToken.None); await using var delete = new MySqlCommand("DELETE FROM campus_activities WHERE source_id=@source", db); delete.Parameters.AddWithValue("@source", sourceId); await delete.ExecuteNonQueryAsync(); }
        });
    }
}
