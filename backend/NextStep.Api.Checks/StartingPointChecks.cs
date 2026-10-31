using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using NextStep.Api;
using NextStep.MetaAi;

internal static class StartingPointChecks
{
    private static void Check(bool value) { if(!value)throw new Exception("Starting point assertion failed"); }
    public static void Register(Action<string,Func<Task>> test)
    {
        test("same AI interest yields distinct novice guided and independent paths only after confirmation", () => {
            var catalog=new Catalog();var listing=new DiscoveryCatalog(catalog).Listings().Single(item=>item.Id=="meta-global-ai-2026");var record=catalog.Get(listing.Id);
            var profile=Input.Blank("profile-synthetic") with { Interests=["AI"], Skills=[new("ai","AI","reported_has")], Goals=[new("goal","Extend my existing project")], ProjectExperience=[new("project","Built a web interface; personal contribution: implemented the input form.")] };
            var id=BriefingStartingPoints.QuestionId(record.Id,record.SourceRevision);
            var empty=BriefingStartingPoints.Create(listing,record,profile,"en");Check(empty.Answer is null && empty.Label.Contains("unknown") && empty.Evidence.Any(item=>item.Kind=="project"));
            var actions=new HashSet<string>();
            foreach(var answer in new[]{"not_yet","guided","independent"})foreach(var language in new[]{"en","ar"}){
                var current=profile with { ClarificationAnswers=[new(id,answer,DateTimeOffset.UtcNow.ToString("O"))] };
                var value=BriefingStartingPoints.Create(listing,record,current,language);Check(value.Answer==answer);actions.Add(value.NextAction);
                var choices=BriefingSelections.Create(listing,record,current,language);Check(choices.Profile.Keys.SequenceEqual(new[]{"profile.start."+answer}) && choices.Priorities["priority.start"]==value.NextAction);
                Check(!choices.Accepts(new("event.details","profile.match.ai",[],[])));
                if(answer=="independent"&&language=="en")Check(value.NextAction.Contains("project you built yourself") && !value.NextAction.Contains("introductory course"));
            }
            Check(actions.Count==6);return Task.CompletedTask;
        });
        test("starting point remains unknown for missing facts not sure or another source revision", () => {
            var catalog=new Catalog();var listing=new DiscoveryCatalog(catalog).Listings().Single(item=>item.Id=="E01");var record=catalog.Get(listing.Id);var profile=Input.Blank("profile-synthetic");
            var question=BriefingStartingPoints.QuestionId(record.Id,record.SourceRevision);
            var old=profile with { ClarificationAnswers=[new(question,"independent",DateTimeOffset.UtcNow.ToString("O"))] };
            Check(BriefingStartingPoints.Create(listing,record with {SourceRevision="new-source"},old,"en").Answer is null);
            var unsure=profile with { ClarificationAnswers=[new(question,"not_sure",DateTimeOffset.UtcNow.ToString("O"))] };
            Check(BriefingStartingPoints.Create(listing,record,unsure,"en").Label.Contains("unknown") && BriefingStartingPoints.PlanningNote(record,unsure) is null);
            Check(BriefingStartingPoints.Create(listing,record,profile,"en").Evidence.Length==0);
            return Task.CompletedTask;
        });
        test("confirmed starting point persists idempotently without changing plans or submission evidence",async()=>{
            await using var host=new Factory();using var client=host.CreateClient();client.DefaultRequestHeaders.Add("X-NextStep-Request","1");
            (await client.PostAsJsonAsync("/api/auth/register",new RegisterRequest("starting-check-"+Guid.NewGuid().ToString("N")+"@example.invalid","Synthetic-Starting-Check-2026!","Temporary starting check"),Wire.Json)).EnsureSuccessStatusCode();
            var profile=(await client.GetFromJsonAsync<StudentProfile>("/api/profile",Wire.Json))!;
            try{
                var listing=(await client.GetFromJsonAsync<ListingSummary[]>("/api/listings",Wire.Json))!.Single(item=>item.Id=="meta-global-ai-2026");var record=host.Services.GetRequiredService<Catalog>().Get(listing.Id);
                profile=profile with { Goals=[new("goal","Adapt my existing prototype")],AvailableHoursPerWeek=new(){["state"]="known",["value"]=5,["reportedAt"]=DateTimeOffset.UtcNow.ToString("O")} };
                profile=(await (await client.PutAsJsonAsync("/api/profile",new ProfileUpdate(profile.Version,profile),Wire.Json)).Content.ReadFromJsonAsync<StudentProfile>(Wire.Json))!;
                var context=new BriefingContext(listing.Id,profile.Id,profile.Version,JsonSerializer.Serialize(new{listing,planningSourceRevision=record.SourceRevision},Wire.Json),"en");
                var submission=(await client.GetFromJsonAsync<SubmissionState>("/api/submissions/"+listing.Id,Wire.Json))!;
                var generated=await client.PostAsJsonAsync("/api/opportunities/"+listing.Id+"/plan-candidates",new AnalysisRequest(record.SourceRevision,profile,submission),Wire.Json);generated.EnsureSuccessStatusCode();
                var candidate=generated.Headers.GetValues("X-Candidate-Id").Single();
                var plan=(await (await client.PostAsJsonAsync("/api/plans/"+listing.Id+"/accept",new AcceptPlan(candidate,null,Guid.NewGuid().ToString("N")),Wire.Json)).Content.ReadFromJsonAsync<Plan>(Wire.Json))!;
                (await client.PatchAsJsonAsync("/api/plans/"+listing.Id+"/tasks/"+plan.Tasks[0].Id,new TaskUpdate(plan.Version,"done",Guid.NewGuid().ToString("N")),Wire.Json)).EnsureSuccessStatusCode();
                var beforePlan=await client.GetStringAsync("/api/plans/"+listing.Id);var beforeSubmission=await client.GetStringAsync("/api/submissions/"+listing.Id);
                var update=new StartingPointUpdate(context,BriefingStartingPoints.QuestionId(record.Id,record.SourceRevision),"independent");
                var endpoint="/api/listings/"+listing.Id+"/starting-point";
                var saved=(await (await client.PutAsJsonAsync(endpoint,update,Wire.Json)).Content.ReadFromJsonAsync<StudentProfile>(Wire.Json))!;
                Check(saved.Version==profile.Version+1 && BriefingStartingPoints.Answer(saved,update.QuestionId)=="independent");
                var retry=(await (await client.PutAsJsonAsync(endpoint,update,Wire.Json)).Content.ReadFromJsonAsync<StudentProfile>(Wire.Json))!;Check(retry.Version==saved.Version);
                Check(await client.GetStringAsync("/api/plans/"+listing.Id)==beforePlan && await client.GetStringAsync("/api/submissions/"+listing.Id)==beforeSubmission);
                Check((await client.PutAsJsonAsync(endpoint,update with {Answer="guided"},Wire.Json)).StatusCode==HttpStatusCode.Conflict);
                Check((await client.PutAsJsonAsync(endpoint,update with {QuestionId="another-source",Context=context with {ProfileVersion=saved.Version}},Wire.Json)).StatusCode==HttpStatusCode.Conflict);
                Check((await client.PutAsJsonAsync(endpoint,update with {Answer="expert-approved"},Wire.Json)).StatusCode==HttpStatusCode.BadRequest);
                Check(BriefingStartingPoints.PlanningNote(record,saved)!.Contains("do not automatically repeat introductory"));
                var currentPlan=(await client.GetFromJsonAsync<Plan>("/api/plans/"+listing.Id,Wire.Json))!;
                host.Model.Prefix="Extend";
                var refreshed=await client.PostAsJsonAsync("/api/opportunities/"+listing.Id+"/plan-candidates",new AnalysisRequest(record.SourceRevision,saved,submission,currentPlan),Wire.Json);refreshed.EnsureSuccessStatusCode();
                Check(host.Model.LastContext!.SelfReport.AcceptedExperience.Any(item=>item.Contains("built similar work independently")));
                Check(await client.GetStringAsync("/api/plans/"+listing.Id)==beforePlan);
                var analysisBefore=Matching.Analyze(record,profile,submission,DateTimeOffset.UtcNow);var analysisAfter=Matching.Analyze(record,saved,submission,DateTimeOffset.UtcNow);
                Check(analysisBefore.Matches.Select(item=>item.Status).SequenceEqual(analysisAfter.Matches.Select(item=>item.Status)));
                using var guest=host.CreateClient();guest.DefaultRequestHeaders.Add("X-NextStep-Request","1");Check((await guest.PutAsJsonAsync(endpoint,update,Wire.Json)).StatusCode==HttpStatusCode.Unauthorized);
            }finally{await host.Services.GetRequiredService<IStateStore>().Delete(profile.Id["profile-".Length..],CancellationToken.None);}
        });
    }
}
