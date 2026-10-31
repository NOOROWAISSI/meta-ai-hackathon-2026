using System.Net;
using NextStep.Api;
using NextStep.MetaAi;

public static class CapacityAndNetworkChecks
{
    private static void Check(bool condition) { if (!condition) throw new Exception("Capacity/network assertion failed"); }
    public static void Register(Action<string, Func<Task>> test)
    {
        test("acceptance and progress use the same reviewed future build window", () => {
            var now = DateTimeOffset.Parse("2026-10-30T00:00:00Z");
            var source = new Catalog().Get("E01");
            TimelineEvent Event(string kind, int days) => new(kind, kind, [new(kind, "Synthetic timing", now.AddDays(days).ToString("O"), ["timing"])], "reviewed");
            var opportunity = source with { InformationFreshness = "current", SourceEvidence = [new("timing", "https://example.invalid/rules", "Test timing", "reviewed", "Synthetic timing", now.ToString("O"))], TimelineEvents = [Event("build_start", 7), Event("submission_close", 14)] };
            var task = new PreparationTask("work", "Work", new("goal", GoalId: "goal"), "should", "Deliverable", "Criteria", 9, 9, "not_started", [], []);
            var before = PreparationCapacity.Evaluate(opportunity, 4, [task], now);
            var started = PreparationCapacity.Evaluate(opportunity, 4, [task with { Status = "in_progress" }], now);
            Check(before.AvailableHours == 4 && started.AvailableHours == before.AvailableHours && before.Feasibility == "infeasible" && before.EvaluatedAt == now);
            var done = PreparationCapacity.Evaluate(opportunity, 4, [task with { Status = "done", RemainingEstimatedHours = 0 }], now);
            Check(done.RemainingEffortHours == 0 && done.Feasibility == "no_remaining_gap" && task.EstimatedHours == 9);
            foreach (var status in new[] { "needs_verification", "conflicting" }) {
                var uncertain = opportunity with { TimelineEvents = [opportunity.TimelineEvents[0] with { SourceStatus = status }, opportunity.TimelineEvents[1]] };
                Check(PreparationCapacity.Evaluate(uncertain, 4, [task], now).AvailableHours is null);
            }
            Check(PreparationCapacity.Evaluate(opportunity, 4, [task], now, currentContext: false).Feasibility == "untimed");
            Check(PreparationCapacity.Evaluate(opportunity, null, [task], now).AvailableHours is null);
            Check(PreparationCapacity.Evaluate(opportunity, 0, [task], now).Feasibility == "infeasible");
            Check(PreparationCapacity.Evaluate(opportunity, 4, [task], now.AddDays(15)).Feasibility == "infeasible");
            return Task.CompletedTask;
        });
        test("source network rejects internal, mapped, special and mixed DNS addresses without connecting", async () => {
            foreach (var text in new[] { "0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "192.0.2.1", "198.18.0.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "255.255.255.255", "::", "::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "fc00::1", "fe80::1", "ff02::1", "2001:db8::1", "2002:7f00:1::1" }) Check(!PublicSourceConnection.IsPublic(IPAddress.Parse(text)));
            foreach (var text in new[] { "8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8" }) Check(PublicSourceConnection.IsPublic(IPAddress.Parse(text)));
            var connections = 0;
            Task<System.IO.Stream> Open(IPAddress ip, int port, CancellationToken ct) { connections++; return Task.FromResult<System.IO.Stream>(new MemoryStream()); }
            foreach (var addresses in new[] { Array.Empty<IPAddress>(), new[] { IPAddress.Loopback }, new[] { IPAddress.Parse("8.8.8.8"), IPAddress.Parse("169.254.169.254") } }) {
                var rejected = false;
                try { await PublicSourceConnection.Connect(new("source.example.invalid", 443), (_, _) => Task.FromResult(addresses), Open, CancellationToken.None); }
                catch (HttpRequestException) { rejected = true; }
                Check(rejected && connections == 0);
            }
        });
        test("source network connects only to the exact validated IP and never resolves again", async () => {
            var resolutions = 0; var publicIp = IPAddress.Parse("1.1.1.1"); IPAddress? connected = null;
            using var result = await PublicSourceConnection.Connect(new("source.example.invalid", 443), (_, _) => { resolutions++; return Task.FromResult(resolutions == 1 ? new[] { publicIp } : new[] { IPAddress.Loopback }); }, (ip, port, _) => { connected = ip; Check(port == 443); return Task.FromResult<System.IO.Stream>(new MemoryStream()); }, CancellationToken.None);
            Check(resolutions == 1 && Equals(connected, publicIp));
            using var reader = new OfficialPageReader();
            Check((await reader.Read(new Uri("https://127.0.0.1/"), CancellationToken.None)).State == "unsafe_address");
            Check((await reader.Read(new Uri("https://example.invalid:8443/"), CancellationToken.None)).State == "unsafe_address");
        });
    }
}
