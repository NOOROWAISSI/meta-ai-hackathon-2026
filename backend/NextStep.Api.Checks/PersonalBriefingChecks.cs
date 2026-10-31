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
    public BriefingText Output = new("A source-grounded event summary.", "Your stated interests relate to the published theme; this does not confirm participation conditions.", ["Review the source and prepare a small demonstration."], ["Clarify any unpublished conditions with the organizer."]);
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
            var output=new BriefingText("A grounded HTTP API project overview.","Related to the reported goal.",[],["Clarify unpublished timing."]);
            var handler=new StubHttp(JsonSerializer.Serialize(new{choices=new[]{new{message=new{content=JsonSerializer.Serialize(output,Wire.Json)}}}},Wire.Json));
            var model=new MetaPersonalBriefingModel(new HttpClient(handler),Options.Create(new MetaAiOptions{ApiKey="synthetic-meta-key-only"}));
            var result=await model.Explain(new(){["example"]="Synthetic context"},"ar",CancellationToken.None);
            Check(result.Overview==output.Overview && handler.Calls==1 && handler.RequestBody!.Contains("opportunity_briefing") && handler.RequestBody.Contains("json_schema") && handler.RequestBody.Contains("language"));
        });
        test("malformed personal Meta output is a recoverable error rather than a fabricated explanation",async()=>{
            var handler=new StubHttp("{\"choices\":[]}");var model=new MetaPersonalBriefingModel(new HttpClient(handler),Options.Create(new MetaAiOptions{ApiKey="synthetic-meta-key-only"}));
            try{await model.Explain(new(),"en",CancellationToken.None);throw new Exception("Malformed output accepted");}catch(ApiFault error){Check(error.Error.Code=="invalid_model_output");}
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
    private sealed class DeniedHttp:HttpMessageHandler {public int Calls;protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct){Calls++;throw new Exception("No network allowed");}}
    private sealed class StubHttp(string body):HttpMessageHandler {
        public int Calls;public string? RequestBody;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct){Calls++;Check(request.RequestUri!.AbsoluteUri=="https://api.meta.ai/v1/chat/completions" && request.Headers.Authorization?.Scheme=="Bearer");RequestBody=await request.Content!.ReadAsStringAsync(ct);return new(HttpStatusCode.OK){Content=new StringContent(body,System.Text.Encoding.UTF8,"application/json")};}
    }
}
