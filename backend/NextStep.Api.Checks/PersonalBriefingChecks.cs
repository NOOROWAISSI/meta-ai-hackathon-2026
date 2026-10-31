using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using NextStep.Api;
using NextStep.MetaAi;

public sealed class FakePersonalBriefingModel : IPersonalBriefingModel
{
    public int Calls;
    public TaskCompletionSource? Entered;
    public TaskCompletionSource? Resume;
    public BriefingText Output = new("event.details", "profile.none", ["priority.sources"], ["question.source"]);
    public async Task<BriefingText> Explain(JsonObject facts, string language, CancellationToken ct) { Calls++; Entered?.TrySetResult(); if (Resume is not null) await Resume.Task.WaitAsync(ct); return Output; }
}
public static class PersonalBriefingChecks
{
    private static void Check(bool value) { if (!value) throw new Exception("Personal briefing assertion failed"); }
    private static async Task Run(Func<Factory,HttpClient,StudentProfile,BriefingContext,Task> check)
    {
        await using var host = new Factory(); using var client = host.CreateClient(); client.DefaultRequestHeaders.Add("X-NextStep-Request","1");
        (await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest("personal-check-"+Guid.NewGuid().ToString("N")+"@example.invalid", "Synthetic-Briefing-Check-2026!", "Temporary briefing check"), Wire.Json)).EnsureSuccessStatusCode();
        var profile = (await client.GetFromJsonAsync<StudentProfile>("/api/profile",Wire.Json))!;
        try {
            var listing = (await client.GetFromJsonAsync<ListingSummary[]>("/api/listings",Wire.Json))!.Single(item=>item.Id=="meta-global-ai-2026");
            var record = host.Services.GetRequiredService<Catalog>().Get(listing.Id);
            var context = new BriefingContext(listing.Id,profile.Id,profile.Version,JsonSerializer.Serialize(new {listing,planningSourceRevision=record.SourceRevision},Wire.Json),"en");
            await check(host,client,profile,context);
        } finally { await host.Services.GetRequiredService<IStateStore>().Delete(profile.Id["profile-".Length..],CancellationToken.None); }
    }
    public static void Register(Action<string,Func<Task>> test)
    {
        PersonalBriefingTransportChecks.Register(test);
        test("specific briefing summary and interest match require both selected source and owned profile evidence", () => Run(async (host, client, profile, context) => {
            var original = (await client.GetFromJsonAsync<ListingSummary[]>("/api/listings", Wire.Json))!.Single(item => item.Id == context.OpportunityId);
            var listing = original with { Topics = ["AI"], Format = "online" };
            foreach (var language in new[] { "en", "ar" }) {
                var choices = BriefingSelections.Create(listing, null, profile with { Interests = ["AI"] }, language);
                var selection = new BriefingText("event.summary", "profile.match.ai", ["priority.sources"], ["question.source"]);
                Check(choices.Accepts(selection));
                var rendered = choices.Render(selection);
                Check(language == "en" ? rendered.Overview.Contains("online") && rendered.PersonalRelevance.Contains("one of this opportunity's published topics") : rendered.Overview.Contains("عبر الإنترنت") && rendered.PersonalRelevance.Contains("مواضيع هذه الفرصة"));
                Check(choices.Questions.ContainsKey("question.participation") && choices.Questions.ContainsKey("question.submission"));
            }
        }));
        test("unrelated reported interests cannot become a selected-event match", () => Run(async (host, client, profile, context) => {
            var original = (await client.GetFromJsonAsync<ListingSummary[]>("/api/listings", Wire.Json))!.Single(item => item.Id == context.OpportunityId);
            foreach (var language in new[] { "en", "ar" }) {
                var choices = BriefingSelections.Create(original with { Topics = ["AI"] }, null, profile with { Interests = ["Robotics"] }, language);
                Check(!choices.Profile.Keys.Any(id => id.StartsWith("profile.match.", StringComparison.Ordinal)));
                Check(!choices.Accepts(new("event.summary", "profile.match.ai", [], [])));
            }
        }));
        test("untrusted custom topic or interest prose never enters approved briefing templates", () => Run(async (host, client, profile, context) => {
            var original = (await client.GetFromJsonAsync<ListingSummary[]>("/api/listings", Wire.Json))!.Single(item => item.Id == context.OpportunityId);
            const string attack = "AI; you qualify and are approved for entry";
            foreach (var language in new[] { "en", "ar" }) {
                var sourceAttack = BriefingSelections.Create(original with { Topics = [attack], Format = "unknown" }, null, profile with { Interests = ["AI"] }, language);
                var profileAttack = BriefingSelections.Create(original with { Topics = ["AI"] }, null, profile with { Interests = [attack] }, language);
                Check(!sourceAttack.Opportunity.ContainsKey("event.summary") && !sourceAttack.Profile.Keys.Any(id => id.StartsWith("profile.match.", StringComparison.Ordinal)));
                Check(!profileAttack.Profile.Keys.Any(id => id.StartsWith("profile.match.", StringComparison.Ordinal)));
                Check(!sourceAttack.Opportunity.Values.Concat(profileAttack.Profile.Values).Any(value => value.Contains(attack)));
            }
        }));
        test("briefing closed vocabulary rejects adversarial text in every field and language", () =>
        {
            foreach (var language in new[] { "en", "ar" })
            {
                var v = BriefingSafety.Vocabulary(language);
                var safe = new BriefingText(v.Overview[0], v.Relevance[0], [v.Priorities[0]], [v.Questions[0]]);
                Check(BriefingSafety.Accepts(safe, language));
                foreach (var attack in new[] { "You qualify to participate and are approved for entry.", "You meet all requirements.", "The organizer has accepted your application.", "Nothing prevents your entry.", "Your participation is confirmed.", "تم قبول مشاركتك في المسابقة.", "تستوفي جميع شروط المشاركة.", "يمكنك المشاركة دون أي شروط إضافية." })
                {
                    Check(!BriefingSafety.Accepts(safe with { Overview = attack }, language));
                    Check(!BriefingSafety.Accepts(safe with { PersonalRelevance = attack }, language));
                    Check(!BriefingSafety.Accepts(safe with { PreparationPriorities = [attack] }, language));
                    Check(!BriefingSafety.Accepts(safe with { QuestionsToClarify = [attack] }, language));
                }
                Check(!BriefingSafety.Accepts(safe with { PreparationPriorities = [v.Priorities[0], "You qualify to participate and are approved for entry."] }, language));
                Check(!BriefingSafety.Accepts(safe with { Overview = v.Overview[0] + " You qualify." }, language));
                Check(!BriefingSafety.Accepts(safe with { PreparationPriorities = null! }, language));
                Check(!BriefingSafety.Accepts(safe with { QuestionsToClarify = Enumerable.Repeat(v.Questions[0], 9).ToArray() }, language));
                Check(!BriefingSafety.Accepts(safe, language == "en" ? "ar" : "en"));
            }
            return Task.CompletedTask;
        });
        test("briefing API rejects the exact unsupported verdict without changing saved work", () => Run(async (host, client, profile, context) =>
        {
            var before = await client.GetStringAsync("/api/profile");
            host.Briefing.Output = host.Briefing.Output with { Overview = "You qualify to participate and are approved for entry." };
            var result = await client.PostAsJsonAsync("/api/listings/" + context.OpportunityId + "/briefing", new BriefingRequest(context), Wire.Json);
            Check(result.StatusCode == HttpStatusCode.ServiceUnavailable);
            Check((await result.Content.ReadFromJsonAsync<ApiError>(Wire.Json))!.Code == "invalid_model_output");
            Check(await client.GetStringAsync("/api/profile") == before && (await client.GetFromJsonAsync<Plan[]>("/api/plans", Wire.Json))!.Length == 0);
        }));
        test("briefing API accepts neutral Arabic vocabulary and rejects a verdict in each field", () => Run(async (host, client, profile, context) =>
        {
            context = context with { Language = "ar" };
            var safe = new BriefingText("event.details", "profile.none", ["priority.sources"], ["question.source"]);
            const string attack = "تم قبول مشاركتك في المسابقة.";
            foreach (var output in new[] { safe with { Overview = attack }, safe with { PersonalRelevance = attack }, safe with { PreparationPriorities = [attack] }, safe with { QuestionsToClarify = [attack] } })
            {
                host.Briefing.Output = output;
                var rejected = await client.PostAsJsonAsync("/api/listings/" + context.OpportunityId + "/briefing", new BriefingRequest(context), Wire.Json);
                Check(rejected.StatusCode == HttpStatusCode.ServiceUnavailable && (await rejected.Content.ReadFromJsonAsync<ApiError>(Wire.Json))!.Code == "invalid_model_output");
            }
            host.Briefing.Output = safe;
            var accepted = await client.PostAsJsonAsync("/api/listings/" + context.OpportunityId + "/briefing", new BriefingRequest(context), Wire.Json);
            Check(accepted.IsSuccessStatusCode && (await accepted.Content.ReadFromJsonAsync<PersonalBriefing>(Wire.Json))!.Overview == "راجع تفاصيل الفرصة المنشورة والمصادر الأصلية.");
        }));
        test("structured selection rejects unsupported and cross-field IDs in all fields", () => Run(async (host, client, profile, context) =>
        {
            var listing = (await client.GetFromJsonAsync<ListingSummary[]>("/api/listings", Wire.Json))!.Single(item => item.Id == context.OpportunityId);
            var record = host.Services.GetRequiredService<Catalog>().Get(context.OpportunityId);
            foreach (var language in new[] { "en", "ar" })
            {
                var choices = BriefingSelections.Create(listing, record, profile, language);
                var safe = new BriefingText("event.details", "profile.none", ["priority.sources"], ["question.source"]);
                Check(choices.Accepts(safe));
                foreach (var attack in new[] { "You qualify to participate and are approved for entry.", "You meet all requirements.", "Nothing prevents your entry.", "تم قبول مشاركتك في المسابقة.", "تستوفي جميع شروط المشاركة.", "profile.interest.ai", "event.topic.invented" })
                {
                    Check(!choices.Accepts(safe with { Overview = attack }));
                    Check(!choices.Accepts(safe with { PersonalRelevance = attack }));
                    Check(!choices.Accepts(safe with { PreparationPriorities = [attack] }));
                    Check(!choices.Accepts(safe with { QuestionsToClarify = [attack] }));
                }
                Check(!choices.Accepts(safe with { PreparationPriorities = ["priority.sources", "invented"] }));
            }
        }));
        test("briefing renders owned profile interest and rejects an unsupported interest", () => Run(async (host, client, profile, context) =>
        {
            var url = "/api/listings/" + context.OpportunityId + "/briefing";
            host.Briefing.Output = new("event.details", "profile.interest.ai", ["priority.sources"], ["question.source"]);
            var rejected = await client.PostAsJsonAsync(url, new BriefingRequest(context), Wire.Json);
            Check(rejected.StatusCode == HttpStatusCode.ServiceUnavailable);
            (await client.PutAsJsonAsync("/api/profile", new ProfileUpdate(profile.Version, profile with { Interests = ["AI"] }), Wire.Json)).EnsureSuccessStatusCode();
            var current = (await client.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
            context = context with { ProfileVersion = current.Version };
            foreach (var language in new[] { "en", "ar" })
            {
                var response = await client.PostAsJsonAsync(url, new BriefingRequest(context with { Language = language }), Wire.Json);
                response.EnsureSuccessStatusCode();
                var value = (await response.Content.ReadFromJsonAsync<PersonalBriefing>(Wire.Json))!;
                Check(language == "en" ? value.PersonalRelevance.Contains("interest in AI") : value.PersonalRelevance.Contains("الذكاء الاصطناعي"));
            }
        }));
        test("missing source evidence keeps participation and submission questions available", () => Run(async (host, client, profile, context) =>
        {
            var listing = (await client.GetFromJsonAsync<ListingSummary[]>("/api/listings", Wire.Json))!.Single(item => item.Id == context.OpportunityId);
            foreach (var language in new[] { "en", "ar" })
            {
                var choices = BriefingSelections.Create(listing, null, profile, language);
                Check(choices.Questions.ContainsKey("question.participation") && choices.Questions.ContainsKey("question.submission"));
                Check(!choices.Profile.ContainsKey("profile.interest.ai"));
                Check(!choices.Accepts(new("event.details", "profile.interest.ai", ["priority.sources"], ["question.source"])));
            }
        }));
        test("briefing cache is isolated between signed-in accounts", () => Run(async (host, client, profile, context) =>
        {
            var url = "/api/listings/" + context.OpportunityId + "/briefing";
            (await client.PostAsJsonAsync(url, new BriefingRequest(context), Wire.Json)).EnsureSuccessStatusCode();
            using var other = host.CreateClient(); other.DefaultRequestHeaders.Add("X-NextStep-Request", "1");
            (await other.PostAsJsonAsync("/api/auth/register", new RegisterRequest("other-" + Guid.NewGuid().ToString("N") + "@example.invalid", "Synthetic-Other-Account-2026!", "Other account"), Wire.Json)).EnsureSuccessStatusCode();
            var second = (await other.GetFromJsonAsync<StudentProfile>("/api/profile", Wire.Json))!;
            try
            {
                Check((await other.PostAsJsonAsync(url, new BriefingRequest(context), Wire.Json)).StatusCode == HttpStatusCode.Conflict);
                var own = context with { ProfileId = second.Id, ProfileVersion = second.Version };
                (await other.PostAsJsonAsync(url, new BriefingRequest(own), Wire.Json)).EnsureSuccessStatusCode();
                Check(host.Briefing.Calls == 2);
            }
            finally { await host.Services.GetRequiredService<IStateStore>().Delete(second.Id["profile-".Length..], CancellationToken.None); }
        }));
        test("reviewed event timing exposes registration separately and retains source conflicts",()=>{
            var catalog=new Catalog();var discovery=new DiscoveryCatalog(catalog);
            var cosmo=catalog.Get("E05");Check(Catalog.Instant(cosmo,"registration_close")==DateTimeOffset.Parse("2027-01-18T16:00:00-06:00"));
            Check(discovery.Listings().Single(item=>item.Id=="E05").RegistrationDeadline is not null && discovery.Listings().Single(item=>item.Id=="E01").RegistrationDeadline is null);
            Check(Catalog.Instant(catalog.Get("E02"),"submission_close")==DateTimeOffset.Parse("2026-11-28T15:00:00-08:00"));
            Check(catalog.Get("E03").Requirements.Any(rule=>rule.SourceStatus=="conflicting") && Catalog.Instant(catalog.Get("meta-global-ai-2026"),"registration_close") is null);
            Check(catalog.All().All(item=>item.SourceCoverage.Participation.State=="incomplete" && item.TimelineEvents.Select(e=>e.Id).Distinct().Count()==item.TimelineEvents.Length));
            return Task.CompletedTask;
        });
        test("optional reviewed learning resources resolve to real catalog IDs for each selected hackathon",()=>{
            var catalog=new Catalog();var discovery=new DiscoveryCatalog(catalog);var resources=new ResourceCatalog(discovery);
            foreach(var record in catalog.All()){
                var result=resources.For(record);Check(result.Length>0 && result.All(item=>item.Status=="reviewed" && !item.Url.Contains("example.") && discovery.Listings().Any(course=>item.Id=="resource-"+course.Id && course.Kind=="course" && course.OfficialUrl==item.Url)));
            }
            return Task.CompletedTask;
        });
        test("personal explanation uses selected server source, caches a context and never creates a plan",()=>Run(async (host,client,profile,context)=>{
            var before = await client.GetStringAsync("/api/profile");
            var url = "/api/listings/"+context.OpportunityId+"/briefing";
            var first=await client.PostAsJsonAsync(url,new BriefingRequest(context),Wire.Json);first.EnsureSuccessStatusCode();
            var value=(await first.Content.ReadFromJsonAsync<PersonalBriefing>(Wire.Json))!;
            Check(value.Context==context && value.Sources.All(link=>Input.Url(link.Url)) && value.Sources.Any(link=>link.Url=="https://dev.meta.ai/events/global-hackathon") && ContractTime.IsInstant(value.GeneratedAt));
            (await client.PostAsJsonAsync(url,new BriefingRequest(context),Wire.Json)).EnsureSuccessStatusCode();
            Check(host.Briefing.Calls==1 && host.Model.Calls==0 && (await client.GetFromJsonAsync<Plan[]>("/api/plans",Wire.Json))!.Length==0 && await client.GetStringAsync("/api/profile")==before);
        }));
        test("briefing rejects tampered profile/source context and unauthenticated requests before model use",()=>Run(async(host,client,profile,context)=>{
            var url="/api/listings/"+context.OpportunityId+"/briefing";
            foreach(var changed in new[]{context with {ProfileId="other-student"},context with {ProfileVersion=context.ProfileVersion+1},context with {SourceRevision="{}"}})
                Check((await client.PostAsJsonAsync(url,new BriefingRequest(changed),Wire.Json)).StatusCode==HttpStatusCode.Conflict);
            using var guest=host.CreateClient();guest.DefaultRequestHeaders.Add("X-NextStep-Request","1");
            Check((await guest.PostAsJsonAsync(url,new BriefingRequest(context),Wire.Json)).StatusCode==HttpStatusCode.Unauthorized && host.Briefing.Calls==0);
            (await guest.PostAsync("/api/session",null)).EnsureSuccessStatusCode();
            var anonymous=(await guest.GetFromJsonAsync<StudentProfile>("/api/profile",Wire.Json))!;
            try { Check((await guest.PostAsJsonAsync(url,new BriefingRequest(context),Wire.Json)).StatusCode==HttpStatusCode.Unauthorized && host.Briefing.Calls==0); }
            finally { await host.Services.GetRequiredService<IStateStore>().Delete(anonymous.Id["profile-".Length..],CancellationToken.None); }
        }));
        test("late personal explanation is discarded after confirmed profile changes",()=>Run(async(host,client,profile,context)=>{
            host.Briefing.Entered=new();host.Briefing.Resume=new();
            var pending=client.PostAsJsonAsync("/api/listings/"+context.OpportunityId+"/briefing",new BriefingRequest(context),Wire.Json);
            await host.Briefing.Entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
            try {(await client.PutAsJsonAsync("/api/profile",new ProfileUpdate(profile.Version,profile with {Interests=["Web"]}),Wire.Json)).EnsureSuccessStatusCode();}
            finally{host.Briefing.Resume.TrySetResult();}
            Check((await pending).StatusCode==HttpStatusCode.Conflict);
        }));
        test("invented links and eligibility verdicts from explanation output are rejected",()=>Run(async(host,client,profile,context)=>{
            foreach(var output in new[]{host.Briefing.Output with {Overview="See https://invented.example.invalid"},host.Briefing.Output with {PersonalRelevance="You are eligible and guaranteed to finish."}}){host.Briefing.Output=output;Check(!(await client.PostAsJsonAsync("/api/listings/"+context.OpportunityId+"/briefing",new BriefingRequest(context),Wire.Json)).IsSuccessStatusCode);}
            Check((await client.GetFromJsonAsync<Plan[]>("/api/plans",Wire.Json))!.Length==0);
        }));
        test("missing Meta key fails explicitly without sending a provider request",async()=>{
            var handler=new DeniedHttp();var model=new MetaPersonalBriefingModel(new HttpClient(handler),Options.Create(new MetaAiOptions()));
            try{await model.Explain(new(),"en",CancellationToken.None);throw new Exception("Missing key accepted");}catch(ApiFault error){Check(error.Error.Code=="provider_unavailable" && handler.Calls==0);}
        });
        test("personal Meta adapter sends the bounded structured schema through the approved endpoint",async()=>{
            var output = new BriefingText("event.details", "profile.none", [], ["question.source"]);
            var handler=new StubHttp(JsonSerializer.Serialize(new{choices=new[]{new{finish_reason="stop",message=new{content=JsonSerializer.Serialize(output,Wire.Json)}}}},Wire.Json));
            var model=new MetaPersonalBriefingModel(new HttpClient(handler),Options.Create(new MetaAiOptions{ApiKey="synthetic-meta-key-only"}));
            var result = await model.Explain(Facts(), "ar", CancellationToken.None);
            Check(result.Overview == output.Overview && handler.Calls == 1 && handler.RequestBody!.Contains("opportunity_briefing") && handler.RequestBody.Contains("json_schema") && handler.RequestBody.Contains("language") && handler.RequestBody.Contains("\"enum\"") && handler.RequestBody.Contains("\"strict\":true") && handler.RequestBody.Contains("\"additionalProperties\":false"));
        });
        test("malformed personal Meta output is a recoverable error rather than a fabricated explanation",async()=>{
            var handler=new StubHttp("{\"choices\":[]}");var model=new MetaPersonalBriefingModel(new HttpClient(handler),Options.Create(new MetaAiOptions{ApiKey="synthetic-meta-key-only"}));
            try { await model.Explain(Facts(), "en", CancellationToken.None); throw new Exception("Malformed output accepted"); } catch (ApiFault error) { Check(error.Error.Code == "invalid_model_output"); }
        });
        test("age and legal-majority editor facts persist separately and do not infer jurisdiction",()=>Run(async(host,client,profile,context)=>{
            var at=DateTimeOffset.UtcNow.ToString("O");
            var updated=profile with {EntrantType=new(){["state"]="known",["value"]="individual",["reportedAt"]=at},ReportedAge=new(){["state"]="known",["value"]=22,["reportedAt"]=at},Residence=new(){["country"]=new JsonObject{["state"]="known",["value"]="PS",["reportedAt"]=at},["region"]=new JsonObject{["state"]="unknown"}},Majority=new(){["jurisdiction"]="PS",["reached"]=new JsonObject{["state"]="known",["value"]=true,["reportedAt"]=at}}};
            var response=await client.PutAsJsonAsync("/api/profile/editor",new ProfileEditorUpdate(profile.Version,updated,new(){["reportedAge"]=22,["majorityReached"]="yes",["majorityJurisdiction"]="PS"}),Wire.Json);response.EnsureSuccessStatusCode();
            var read=(await client.GetFromJsonAsync<StudentProfile>("/api/profile",Wire.Json))!; Check(Input.Fact<double>(read.ReportedAge)==22 && Input.Fact<bool>(read.Majority["reached"])==true);
            var record=host.Services.GetRequiredService<Catalog>().Get(context.OpportunityId);
            var result=Matching.Analyze(record,read,Catalog.EmptySubmission(record),DateTimeOffset.UtcNow);
            Check(result.ParticipationSummary=="needs_verification");
            foreach(var rule in record.Requirements.Where(rule=>rule.Evaluation["key"]?.GetValue<string>()=="minimum_age")) Check(result.Matches.Single(match=>match.RequirementId==rule.Id).Status=="supported");
            var foreign=read with {Residence=new(){["country"]=new JsonObject{["state"]="known",["value"]="OTHER",["reportedAt"]=at},["region"]=new JsonObject{["state"]="unknown"}}};
            var comparison=Matching.Analyze(record,foreign,Catalog.EmptySubmission(record),DateTimeOffset.UtcNow);
            foreach(var rule in record.Requirements.Where(rule=>rule.Evaluation["key"]?.GetValue<string>()=="majority"))Check(comparison.Matches.Single(match=>match.RequirementId==rule.Id).Status=="unknown");
        }));
    }
    private static JsonObject Facts() => new()
    {
        ["choices"] = JsonSerializer.SerializeToNode(new
        {
            opportunity = new Dictionary<string, string> { { "event.details", "Details" } },
            profile = new Dictionary<string, string> { { "profile.none", "Profile" } },
            priorities = new Dictionary<string, string> { { "priority.sources", "Sources" } },
            questions = new Dictionary<string, string> { { "question.source", "Question" } }
        }, Wire.Json)
    };
    private sealed class DeniedHttp:HttpMessageHandler {public int Calls;protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct){Calls++;throw new Exception("No network allowed");}}
    private sealed class StubHttp(string body):HttpMessageHandler {
        public int Calls;public string? RequestBody;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct){Calls++;Check(request.RequestUri!.AbsoluteUri=="https://api.meta.ai/v1/chat/completions" && request.Headers.Authorization?.Scheme=="Bearer");RequestBody=await request.Content!.ReadAsStringAsync(ct);return new(HttpStatusCode.OK){Content=new StringContent(body,System.Text.Encoding.UTF8,"application/json")};}
    }
}
