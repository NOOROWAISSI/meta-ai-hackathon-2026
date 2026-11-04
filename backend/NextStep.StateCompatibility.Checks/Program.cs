using System.Text.Json;
using System.Text.Json.Nodes;
using NextStep.Api;

// Offline state-envelope compatibility checks. Compile this tool against the
// proposed combined rollback build, not an unrelated installed binary. No DB,
// provider, account credentials or student payload is read by this program.
if (args.Length != 1) throw new ArgumentException("Pass docs/fixtures/sample-payload.json as the only argument.");
var fixture = JsonNode.Parse(await File.ReadAllTextAsync(args[0]))!;
var plan = fixture["plan"]!.Deserialize<Plan>(Wire.Json)!;
var task = plan.Tasks[0] with { Status = "done", RemainingEstimatedHours = 0, ArtifactUrls = ["https://example.invalid/synthetic-artifact"] };
plan = plan with { Tasks = [task, ..plan.Tasks.Skip(1)] };
var key = plan.Context.OpportunityId;
var state = new UserState {
    Profile = Input.Blank("profile-synthetic-compatibility"),
    Plans = new() { [key] = plan },
    HistoricalPlans = new() { [key] = plan with { Id = "synthetic-historical-plan" } },
    PlanRenderings = new() { [key] = new(plan.Id, [], true, false, true) },
    PreparationSelections = new() { [key] = new(key, "Synthetic event", "Synthetic organizer", "2026-11-03T00:00:00Z") }
};
var before = JsonSerializer.SerializeToNode(state, Wire.Json)!;
var read = before.Deserialize<UserState>(Wire.Json)!;
var after = JsonSerializer.SerializeToNode(read, Wire.Json)!;
Check(JsonNode.DeepEquals(before, after), "combined reader/writer preserves the full union envelope");
var saved = read.Plans[key].Tasks[0];
Check(saved.Status == "done" && saved.RemainingEstimatedHours == 0 && saved.EstimatedHours == task.EstimatedHours && saved.ArtifactUrls.SequenceEqual(task.ArtifactUrls), "Done progress, original effort and artifact links survive");
var legacy = before.DeepClone().AsObject();
legacy.Remove("preparationSelections"); legacy.Remove("historicalPlans"); legacy.Remove("planRenderings");
var upgraded = legacy.Deserialize<UserState>(Wire.Json)!;
Check(upgraded.PreparationSelections.Count == 0 && upgraded.HistoricalPlans.Count == 0 && upgraded.PlanRenderings.Count == 0 && upgraded.Plans[key].Tasks[0].Status == "done", "older envelopes gain empty optional collections without losing existing progress");
var invalid = before.DeepClone().AsObject(); invalid["unreviewedStateField"] = true;
var refused = false;
try { _ = invalid.Deserialize<UserState>(Wire.Json); } catch (JsonException) { refused = true; }
Check(refused, "unknown state members remain rejected rather than silently dropped");
Console.WriteLine("RESULT passed=4 failed=0 total=4. This does not certify standalone P1/P2 downgrade compatibility.");
static void Check(bool condition, string name) { if (!condition) throw new Exception(name); Console.WriteLine("PASS " + name); }
