using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using NextStep.Api;
using NextStep.MetaAi;

// The production adapter is exercised, but every HTTP response is in memory. No live provider calls.
internal static class PersonalBriefingTransportChecks
{
    private static readonly BriefingText Output = new("Published event summary.", "Related to your reported interests; participation conditions need a separate check.", ["Read the reviewed requirements."], ["Confirm unpublished details with the organizer."]);
    private static void Check(bool value) { if (!value) throw new Exception("Briefing transport assertion failed"); }
    private static string Envelope(string finish = "stop", string? content = null) => JsonSerializer.Serialize(new { choices = new[] { new { finish_reason = finish, message = new { content = content ?? JsonSerializer.Serialize(Output, Wire.Json) } } } }, Wire.Json);
    private static MetaPersonalBriefingModel Adapter(HttpClient http, int timeout = 90) => new(http, Options.Create(new MetaAiOptions { ApiKey = "synthetic-transport-key-only", OverallTimeoutSeconds = timeout }));
    private static async Task Fault(string code, Func<Task> action)
    {
        try { await action(); throw new Exception("Invalid provider response accepted"); }
        catch (ApiFault fault) { Check(fault.Error.Code == code && !JsonSerializer.Serialize(fault.Error, Wire.Json).Contains("private-provider-diagnostic")); }
    }
    public static void Register(Action<string, Func<Task>> test)
    {
        test("authenticated briefing API traverses the production Meta adapter and preserves MySQL facts", async () => {
            using var handler = new Handler((_, _) => Task.FromResult(Reply(Envelope())));
            using var transport = new HttpClient(handler);
            await using var original = new Factory();
            await using var host = original.WithWebHostBuilder(builder => builder.ConfigureTestServices(services => {
                services.RemoveAll<IPersonalBriefingModel>();
                services.AddSingleton<IPersonalBriefingModel>(Adapter(transport));
            }));
            using var client = host.CreateClient(); client.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
            var email = "transport-check-" + Guid.NewGuid().ToString("N") + "@example.invalid";
            (await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest(email, "Synthetic-Transport-Check-2026!", "Private account name"), Wire.Json)).EnsureSuccessStatusCode();
            var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
            try {
                var before = await client.GetStringAsync("/api/profile");
                var listing = (await client.GetFromJsonAsync<ListingSummary[]>("/api/listings", Wire.Json))!.Single(item => item.Id == "meta-global-ai-2026");
                var record = host.Services.GetRequiredService<Catalog>().Get(listing.Id);
                var revision = JsonSerializer.Serialize(new { listing, planningSourceRevision = record.SourceRevision }, Wire.Json);
                foreach (var language in new[] { "en", "ar" }) {
                    var context = new BriefingContext(listing.Id, profile.Id, profile.Version, revision, language);
                    var response = await client.PostAsJsonAsync("/api/listings/" + listing.Id + "/briefing", new BriefingRequest(context), Wire.Json);
                    response.EnsureSuccessStatusCode();
                    var result = (await response.Content.ReadFromJsonAsync<PersonalBriefing>(Wire.Json))!;
                    Check(result.Context == context && result.Overview == Output.Overview && result.Sources.Length > 0);
                    using var request = JsonDocument.Parse(handler.Body!);
                    Check(request.RootElement.GetProperty("response_format").GetProperty("json_schema").GetProperty("name").GetString() == "opportunity_briefing");
                    var data = JsonNode.Parse(request.RootElement.GetProperty("messages")[1].GetProperty("content").GetString()!)!;
                    Check(data["language"]!.GetValue<string>() == language && data["facts"]!["opportunity"]!["id"]!.GetValue<string>() == listing.Id);
                    Check(!handler.Body!.Contains(email) && !handler.Body.Contains("Private account name") && !handler.Body.Contains("synthetic-transport-key-only"));
                }
                Check(handler.Calls == 2 && await client.GetStringAsync("/api/profile") == before && (await client.GetFromJsonAsync<Plan[]>("/api/plans", Wire.Json))!.Length == 0);
            } finally { await host.Services.GetRequiredService<IStateStore>().Delete(profile.Id["profile-".Length..], CancellationToken.None); }
        });
        test("briefing rejects truncated filtered or missing completion markers even with parseable JSON", async () => {
            foreach (var body in new[] { Envelope("length"), Envelope("content_filter"), "{\"choices\":[{\"message\":{\"content\":\"{}\"}}]}" }) {
                using var handler = new Handler((_, _) => Task.FromResult(Reply(body))); using var http = new HttpClient(handler);
                await Fault("invalid_model_output", () => Adapter(http).Explain(new(), "en", CancellationToken.None));
            }
        });
        test("briefing rejects unexpected schema fields and malformed provider content", async () => {
            var extra = JsonSerializer.SerializeToNode(Output, Wire.Json)!.AsObject(); extra["eligibility"] = true;
            foreach (var content in new[] { extra.ToJsonString(), "not-json", "null", "[]" }) {
                using var handler = new Handler((_, _) => Task.FromResult(Reply(Envelope(content: content)))); using var http = new HttpClient(handler);
                await Fault("invalid_model_output", () => Adapter(http).Explain(new(), "en", CancellationToken.None));
            }
        });
        test("briefing provider refusal is a recoverable failure without leaking its text", async () => {
            const string body = "{\"choices\":[{\"finish_reason\":\"stop\",\"message\":{\"refusal\":\"private-provider-diagnostic\",\"content\":null}}]}";
            using var handler = new Handler((_, _) => Task.FromResult(Reply(body))); using var http = new HttpClient(handler);
            await Fault("provider_unavailable", () => Adapter(http).Explain(new(), "en", CancellationToken.None));
        });
        test("briefing enforces the HTTP response byte limit", async () => {
            using var handler = new Handler((_, _) => Task.FromResult(Reply(new string('x', 65537)))); using var http = new HttpClient(handler);
            await Fault("invalid_model_output", () => Adapter(http).Explain(new(), "en", CancellationToken.None));
        });
        test("briefing HTTP failures and network diagnostics stay server private", async () => {
            foreach (var status in new[] { HttpStatusCode.Unauthorized, HttpStatusCode.TooManyRequests, HttpStatusCode.ServiceUnavailable }) {
                using var handler = new Handler((_, _) => Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent("private-provider-diagnostic") })); using var http = new HttpClient(handler);
                await Fault("provider_unavailable", () => Adapter(http).Explain(new(), "en", CancellationToken.None));
            }
            using var network = new Handler((_, _) => throw new HttpRequestException("private-provider-diagnostic")); using var client = new HttpClient(network);
            await Fault("provider_unavailable", () => Adapter(client).Explain(new(), "en", CancellationToken.None));
        });
        test("briefing timeout remains recoverable and caller cancellation remains cancellation", async () => {
            using var handler = new Handler(async (_, ct) => { await Task.Delay(Timeout.Infinite, ct); return Reply(Envelope()); }); using var http = new HttpClient(handler);
            await Fault("timeout", () => Adapter(http, 1).Explain(new(), "en", CancellationToken.None));
            using var cancelled = new CancellationTokenSource(); cancelled.Cancel();
            try { await Adapter(http).Explain(new(), "en", cancelled.Token); throw new Exception("Cancellation ignored"); }
            catch (OperationCanceledException) { Check(cancelled.IsCancellationRequested); }
        });
    }
    private static HttpResponseMessage Reply(string body) => new(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
    private sealed class Handler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> send) : HttpMessageHandler
    {
        public string? Body;
        public int Calls;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) {
            Calls++; Check(request.RequestUri!.AbsoluteUri == "https://api.meta.ai/v1/chat/completions" && request.Headers.Authorization?.Scheme == "Bearer");
            Body = await request.Content!.ReadAsStringAsync(ct); return await send(request, ct);
        }
    }
}
