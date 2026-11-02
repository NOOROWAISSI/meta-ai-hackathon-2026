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
        test("fresh source collection never makes an undated old announcement current", () => {
            var now = DateTimeOffset.Parse("2026-11-02T12:00:00Z");
            var post = new CampusActivity("synthetic", ["najah"], [], "A training", "Synthetic activity", "https://example.invalid", "https://example.invalid", "official_website", "training", "1 April 2026", null, "unknown", "Source", "primary_source", now.ToString("O"));
            Check(CampusFreshness.Classify(post, now) == "needs_recheck");
            Check(CampusFreshness.Classify(post with { EventDateText = "17 November 2026 · zone unknown" }, now) == "current");
            Check(CampusFreshness.Classify(post with { EventDateText = "17 February — year unknown" }, now) == "needs_recheck");
            Check(CampusFreshness.Classify(post with { EventDateText = "2026-11-10T00:00:00Z" }, now) == "current");
            Check(CampusFreshness.Classify(post with { RegistrationState = "closed", EventDateText = "17 November 2026" }, now) == "archived");
            Check(CampusFreshness.Classify(post with { RegistrationState = "open", AvailabilityCheckedAt = now.AddDays(-8).ToString("O") }, now) == "needs_recheck");
            return Task.CompletedTask;
        });
        test("Najah session controls distinguish open enrollment from completed courses and hidden modal text", () => {
            var source = new SourceRegistration("najah-academy-live", "Academy", "https://www.najah.ai/Courses", "palestine", "official_website", "public_html", null, "Synthetic") { UniversityId = "najah" };
            var page = new Uri("https://www.najah.ai/Courses/Details/100?EnrollTeacherCourseId=200");
            const string start = "<h1>Synthetic AI course</h1><h3>Description</h3><div>A synthetic introduction to artificial intelligence.</div><div class=\"enrollment-controls\">";
            const string end = "</div><div class=\"modal\">Congratulations on completing the course! Thank you for registering!</div>";
            var open = NajahCourseReader.Read(start + "<a href=\"/Authentication/Login?returnUrl=%2FCourses%2FDetails%2F100\">Enroll now</a>" + end, page, source).Single();
            Check(open.RegistrationState == "open" && open.DiscoveryState == "current" && open.RegistrationDeadline is null);
            var closed = NajahCourseReader.Read(start + "<button disabled>The Course is Completed</button>" + end, page, source).Single();
            Check(closed.RegistrationState == "closed" && closed.DiscoveryState == "archived");
            Check(NajahCourseReader.Read(start + end, page, source).Length == 0);
            Check(NajahCourseReader.Read(start + end, new Uri("https://different.example.invalid/Courses/Details/100"), source).Length == 0);
            var links = NajahCourseReader.Links("<div onclick=\"window.location.href='/Courses/Details/100?EnrollTeacherCourseId=200'\"><h5>AI foundations</h5></div>", new Uri(source.Url));
            Check(links.Count == 1 && links[0].Url.Contains("EnrollTeacherCourseId=200"));
            Check(OfficialPageReader.IsMissingUniversityRobots(new Uri(source.Url), System.Net.HttpStatusCode.Found, new Uri("/Home/HandleError/404", UriKind.Relative)));
            Check(!OfficialPageReader.IsMissingUniversityRobots(new Uri(source.Url), System.Net.HttpStatusCode.Found, new Uri("/Authentication/Login", UriKind.Relative)));
            Check(!OfficialPageReader.IsMissingUniversityRobots(new Uri(source.Url), System.Net.HttpStatusCode.Found, new Uri("https://different.example.invalid/Home/HandleError/404")));
            return Task.CompletedTask;
        });
        test("IEEE published-event moderation is not student approval or proof of current enrollment", () => {
            var source = new SourceRegistration("ieee-najah-public-events", "IEEE", "https://ieeennu.com/api/events/approved", "palestine", "official_website", "public_html", null, "Synthetic") { UniversityId = "najah", OrganizationId = "ieee-najah" };
            const string json = "[{\"id\":7,\"status\":\"APPROVED\",\"title\":\"Synthetic AI workshop\",\"description\":\"A synthetic hands-on workshop description.\",\"event_date\":\"2026-04-01T00:00:00Z\",\"report_text\":null}]";
            var post = IeeeNajahReader.Read(json, new Uri(source.Url), source).Single();
            Check(post.RegistrationState == "not_specified" && CampusFreshness.Classify(post, DateTimeOffset.Parse("2026-11-02T12:00:00Z")) == "needs_recheck");
            Check(post.OriginalUrl == "https://ieeennu.com/activity-details?id=7");
            Check(IeeeNajahReader.Read(json, new Uri("https://other.example.invalid/api/events/approved"), source).Length == 0);
            Check(IeeeNajahReader.Read("{\"events\":" + json + "}", new Uri(source.Url), source).Length == 1);
            return Task.CompletedTask;
        });
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
            Check(rag.UniversityIds.Contains("najah") && rag.UniversityIds.Contains("birzeit") && rag.UniversityIds.Contains("bethlehem"));
            Check(listings.All(l => l.Id != "campus-najah-python-data-course"));
            Check(posts.Single(p => p.Id == "campus-najah-python-data-course").DiscoveryState == "archived");
            Check(listings.Any(l => l.Id == "campus-bethlehem-opportunity-lab-2026" && l.UniversityIds.Contains("bethlehem")));
            Check(posts.Any(p => p.Id == "campus-qou-innovation-hub-launch-2026" && p.UniversityIds.Contains("qou")));
            Check(posts.Single(p => p.Id == "campus-ieee-najah-xtreme20-report").Availability == "ended");
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
