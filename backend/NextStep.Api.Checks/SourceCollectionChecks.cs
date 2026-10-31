using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MySqlConnector;
using NextStep.Api;

public static class SourceCollectionChecks
{
    private static void Check(bool condition) { if (!condition) throw new Exception("Source collection assertion failed"); }
    private static string Course(string url, string title = "Python programming course") => "<script type='application/ld+json'>" + JsonSerializer.Serialize(new Dictionary<string, object> {
        ["@type"] = "Course", ["name"] = title, ["description"] = "Learn Python programming through practical web development exercises.", ["url"] = url,
        ["provider"] = new { name = "Synthetic University" }, ["hasCourseInstance"] = new { courseMode = "online" }
    }) + "</script>";
    public static void Register(Action<string, Func<Task>> test)
    {
        test("official structured data keeps deadlines unknown and rejects incomplete or out-of-scope records", () => {
            var source = new SourceRegistration("fixture", "Hosting site is not organizer", "https://source.example.invalid/", "mixed", "official_website", "public_html", null, "Synthetic only"); var page = new Uri(source.Url);
            var valid = StructuredOpportunityReader.Read(Course("/course?cohort=one&utm_source=test#section"), page, source).Single();
            Check(valid.Organizer == "Synthetic University" && valid.OfficialUrl.EndsWith("?cohort=one") && valid.LastReviewedAt is null && valid.RegistrationDeadline is null && valid.RegistrationState == "not_specified" && valid.CostStatus == "unknown" && valid.SourceStatus == "needs_verification");
            Check(StructuredOpportunityReader.Read(Course("https://other.example.invalid/course"), page, source).Length == 0);
            Check(StructuredOpportunityReader.Read(Course("/course").Replace("\"online\"", "\"in_person\""), page, source).Length == 0);
            Check(StructuredOpportunityReader.Read(Course("/course").Replace("\"provider\"", "\"publisher\""), page, source).Length == 0);
            Check(StructuredOpportunityReader.Read("<script type='application/ld+json'>{broken}</script>", page, source).Length == 0);
            const string conflictingEvent = """<script type="application/ld+json">{"@type":"Event","name":"AI hackathon","description":"Build an artificial intelligence prototype with web programming.","url":"/hackathon","organizer":{"name":"Synthetic University"},"eventAttendanceMode":"https://schema.org/OnlineEventAttendanceMode","startDate":"2026-11-10T10:00:00Z","endDate":"2026-10-01T10:00:00Z"}</script>""";
            var eventListing = StructuredOpportunityReader.Read(conflictingEvent, page, source).Single();
            Check(eventListing.EventEndAt is null && eventListing.VerificationNote.Contains("dates conflict") && eventListing.RegistrationDeadline is null);
            Check(SourceCollector.CandidateLinks("<a href='/course?cohort=one&utm_source=a'>Python course</a><a href='/course?cohort=one&utm_source=b'>Python course</a><a href='/course?cohort=two'>Python course</a><a href='https://other.example.invalid/'>Python course</a>", page).Count == 2);
            return Task.CompletedTask;
        });
        test("robots rules respect specific agents, empty directives and longest allow rules", () => {
            Check(!OfficialPageReader.RobotsAllows("User-agent: *\nDisallow: /private", "/private/course"));
            Check(OfficialPageReader.RobotsAllows("User-agent: *\nDisallow: /\nAllow: /courses/", "/courses/python"));
            Check(OfficialPageReader.RobotsAllows("User-agent: NextStep-SourceReview\nDisallow:\nUser-agent: *\nDisallow: /", "/courses"));
            Check(!OfficialPageReader.RobotsAllows("User-agent: *\nDisallow: /*?secret=", "/courses?secret=x"));
            return Task.CompletedTask;
        });
        test("Google course catalog adapter reads only official course sections without inventing registration facts", () => {
            var page = new Uri("https://developers.google.com/machine-learning");
            var source = new SourceRegistration("google-ml-catalog", "Google", page.AbsoluteUri, "global_online", "official_website", "public_html", null, "Synthetic markup");
            const string html = "<h2 id='foundational-courses'>Foundational courses</h2><h3><a href='/machine-learning/synthetic-course'>Synthetic machine learning course</a></h3><div class='devsite-landing-row-item-description-content'>Learn machine learning with practical exercises.</div><h2 id='guides'>Guides</h2><h3><a href='/machine-learning/synthetic-guide'>Synthetic guide</a></h3><div class='devsite-landing-row-item-description-content'>This is a guide, not a course.</div>";
            var listing = GoogleCourseCatalogReader.Read(html, page, source).Single();
            Check(listing.Title == "Synthetic machine learning course" && listing.Organizer == "Google" && listing.Format == "unknown" && listing.CostStatus == "unknown" && listing.RegistrationDeadline is null && listing.SourceStatus == "needs_verification");
            Check(GoogleCourseCatalogReader.Read(html, new Uri("https://other.example.invalid/machine-learning"), source).Length == 0);
            var conflicting = Course("/course", "First Python course") + Course("/course", "Conflicting Python course");
            Check(StructuredOpportunityReader.Read(conflicting, page, source).Length == 0);
            return Task.CompletedTask;
        });
        test("automatic matching URL preserves all curated metadata and only updates observation freshness", async () => {
            await using var host = new Factory();
            var curated = host.Services.GetRequiredService<DiscoveryCatalog>().Listings().First(item => item.Kind == "course" && item.SourceStatus == "reviewed" && item.LastReviewedAt is not null);
            var id = "check-curated-" + Guid.NewGuid().ToString("N");
            var source = new SourceRegistration(id, "Synthetic observation", curated.OfficialUrl, "global_online", "official_website", "public_html", null, "Synthetic only");
            var feed = host.Services.GetRequiredService<DiscoveryFeed>();
            var observation = curated with { Id = id, Title = "Unreviewed replacement", Organizer = "Unreviewed organizer", Summary = "Unreviewed content", SourceStatus = "needs_verification", LastReviewedAt = null, SourcePassage = null, VerificationNote = "Automatic only" };
            await using var db = new MySqlConnection(host.Services.GetRequiredService<IConfiguration>().GetConnectionString("NextStep")); await db.OpenAsync();
            // Restore any real previously collected observation after this isolated check.
            await using var read = new MySqlCommand("SELECT source_id,page_hash,payload,first_seen_at,checked_at FROM discovered_listings WHERE url_hash=@hash", db);
            read.Parameters.AddWithValue("@hash", MySqlStateStore.Hash(curated.OfficialUrl));
            object[]? previous = null;
            await using (var row = await read.ExecuteReaderAsync()) { if (await row.ReadAsync()) { previous = new object[5]; row.GetValues(previous); } }
            try {
                await feed.StorePage(source, new Uri("https://source.example.invalid/" + id), new("checked", "Synthetic source observation"), [observation], CancellationToken.None);
                var actual = (await feed.Listings(CancellationToken.None)).Single(item => item.Id == curated.Id);
                Check(actual.LastCheckedAt is not null && actual.SourceFreshness == "current");
                Check(JsonSerializer.Serialize(actual with { LastCheckedAt = curated.LastCheckedAt, SourceFreshness = curated.SourceFreshness }, Wire.Json) == JsonSerializer.Serialize(curated, Wire.Json));
                Check(!(await feed.Listings(CancellationToken.None)).Any(item => item.Id == id));
            } finally {
                if (previous is not null) {
                    await using var restore = new MySqlCommand("UPDATE discovered_listings SET source_id=@source,page_hash=@page,payload=@payload,first_seen_at=@first,checked_at=@checked WHERE url_hash=@hash", db);
                    foreach (var pair in new[] { ("@source", previous[0]), ("@page", previous[1]), ("@payload", previous[2]), ("@first", previous[3]), ("@checked", previous[4]), ("@hash", (object)MySqlStateStore.Hash(curated.OfficialUrl)) }) restore.Parameters.AddWithValue(pair.Item1, pair.Item2);
                    await restore.ExecuteNonQueryAsync();
                } else { await using var remove = new MySqlCommand("DELETE FROM discovered_listings WHERE source_id=@id", db); remove.Parameters.AddWithValue("@id", id); await remove.ExecuteNonQueryAsync(); }
                await using var cleanup = new MySqlCommand("DELETE FROM source_pages WHERE source_id=@id", db); cleanup.Parameters.AddWithValue("@id", id); await cleanup.ExecuteNonQueryAsync();
            }
        });
        test("scheduled collection deduplicates MySQL records, preserves first-seen and retains stale data after failure", async () => {
            var reader = new FakePages();
            await using var host = new Factory().WithWebHostBuilder(builder => builder.ConfigureTestServices(services => { services.RemoveAll<IOfficialPageReader>(); services.AddSingleton<IOfficialPageReader>(reader); }));
            var source = new SourceRegistration("check-" + Guid.NewGuid().ToString("N"), "Synthetic source", "https://source.example.invalid/", "global_online", "official_website", "public_html", null, "Never a real source");
            var courseUrl = source.Url + source.Id;
            var collector = host.Services.GetRequiredService<SourceCollector>(); var feed = host.Services.GetRequiredService<DiscoveryFeed>();
            await using var db = new MySqlConnection(host.Services.GetRequiredService<IConfiguration>().GetConnectionString("NextStep")); await db.OpenAsync();
            try {
                reader.Response = new("checked", Course(courseUrl));
                await collector.CollectSources([source], true, CancellationToken.None);
                var first = (await feed.Listings(CancellationToken.None)).Single(item => item.OfficialUrl == courseUrl);
                Check(first.SourceFreshness == "current" && first.LastCheckedAt is not null && first.FirstSeenAt is not null && first.LastReviewedAt is null);
                var calls = reader.Calls;
                await collector.CollectSources([source], false, CancellationToken.None); Check(reader.Calls == calls);
                reader.Response = new("checked", Course(courseUrl, "Updated Python programming course"));
                await collector.CollectSources([source], true, CancellationToken.None);
                var second = (await feed.Listings(CancellationToken.None)).Single(item => item.OfficialUrl == courseUrl);
                Check(first.Id == second.Id && first.FirstSeenAt == second.FirstSeenAt && second.Title.StartsWith("Updated"));
                reader.Response = new("source_unavailable", null);
                await collector.CollectSources([source], true, CancellationToken.None);
                var retained = (await feed.Listings(CancellationToken.None)).Single(item => item.Id == first.Id);
                Check(retained.Title == second.Title && retained.SourceFreshness == "stale" && retained.LastCheckedAt == second.LastCheckedAt);
                reader.Response = new("checked", "<html>Structured details were removed</html>");
                await collector.CollectSources([source], true, CancellationToken.None);
                Check((await feed.Listings(CancellationToken.None)).Single(item => item.Id == first.Id).SourceFreshness == "stale");
                using var client = host.CreateClient();
                var apiRows = await client.GetFromJsonAsync<ListingSummary[]>("/api/listings", Wire.Json); Check(apiRows!.Any(item => item.Id == first.Id));
                var status = await client.GetFromJsonAsync<CollectionStatus>("/api/sources/status", Wire.Json); Check(status!.AutomaticallyDiscoveredCount >= 1);
                await using var gate = new MySqlCommand("SELECT GET_LOCK('nextstep:source-collection:v1',0)", db); Check(Convert.ToInt32(await gate.ExecuteScalarAsync()) == 1);
                try { calls = reader.Calls; await collector.CollectSources([source], true, CancellationToken.None); Check(calls == reader.Calls); }
                finally { await using var release = new MySqlCommand("SELECT RELEASE_LOCK('nextstep:source-collection:v1')", db); await release.ExecuteScalarAsync(); }
            } finally {
                foreach (var table in new[] { "discovered_listings", "source_pages", "intake_candidates", "source_runs" }) { await using var cleanup = new MySqlCommand($"DELETE FROM {table} WHERE source_id=@id", db); cleanup.Parameters.AddWithValue("@id", source.Id); await cleanup.ExecuteNonQueryAsync(); }
            }
        });
    }
    private sealed class FakePages : IOfficialPageReader
    {
        public int Calls;
        public SourcePage Response = new("source_unavailable", null);
        public Task<SourcePage> Read(Uri address, CancellationToken ct) { Calls++; return Task.FromResult(Response); }
    }
}
