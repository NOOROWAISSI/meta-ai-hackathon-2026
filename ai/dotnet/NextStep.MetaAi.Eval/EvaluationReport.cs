using System.Text;
using System.Text.Json;
using NextStep.MetaAi;

namespace NextStep.MetaAi.Evaluation;

internal sealed record EvaluationReport(int SchemaVersion, EvaluationProvenance Provenance,
    IReadOnlyList<EvaluationResult> Results, string Mode = "live")
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    internal string ToJson() => JsonSerializer.Serialize(this, Json);

    internal string ToMarkdown()
    {
        var b = new StringBuilder();
        b.AppendLine(Mode == "offline-fixtures" ? "# NextStep Meta AI — Offline Fixture Replay" : "# NextStep Meta AI — Live Quality Evaluation");
        b.AppendLine();
        b.AppendLine("Synthetic scenarios only. Results describe standalone MetaAi client behavior, not end-to-end production behavior.");
        if (Mode == "offline-fixtures") b.AppendLine("Frozen synthetic provider responses; no provider calls. This replay does not establish live model quality.");
        b.AppendLine("The report excludes credentials and user-specific private data. Model output is retained for manual review.");
        b.AppendLine();
        b.AppendLine("## Provenance");
        b.AppendLine();
        b.AppendLine("```json");
        b.AppendLine(JsonSerializer.Serialize(Provenance, Json));
        b.AppendLine("```");
        b.AppendLine();
        b.AppendLine("Git metadata describes the working tree at execution. Source, prompt and scenario fingerprints describe the embedded build inputs; sourceMatchesWorkingTree detects later edits. Null metadata means unavailable.");
        b.AppendLine();
        b.AppendLine("## Execution summary");
        b.AppendLine();
        b.AppendLine("| Scenario | API + structural validation | Tasks | Latency (ms) | Feasibility (diagnostic) |");
        b.AppendLine("|---|---|---:|---:|---|");
        foreach (var r in Results)
            b.AppendLine($"| {r.Id} | {r.Status}{(r.ErrorCode is null ? "" : " / " + r.ErrorCode)} | {r.TaskCount?.ToString() ?? "-"} | {r.ElapsedMilliseconds} | {r.Feasibility ?? "-"} |");
        b.AppendLine();
        b.AppendLine("**Interpretation:** Structural success is not a quality score. The budget diagnostic excludes retained hours because the generation context carries status/title, not remaining effort. It cannot establish final plan feasibility when existing work remains.");
        b.AppendLine();
        b.AppendLine("## Manual quality rubric (0–2 points each; /10 per scenario)");
        b.AppendLine();
        b.AppendLine("- Groundedness (0 invented facts, deadlines, eligibility verdicts, URLs, achievements).");
        b.AppendLine("- Personalization (matches reported skills, accepted experience and constraints without treating self-reports as verified).");
        b.AppendLine("- Actionability (specific deliverable and verifiable completion criteria; minimal filler).");
        b.AppendLine("- Effort realism (credible estimated hours, workload feasibility is transparently interpreted; infeasible work has minimum scope, critical path, deferrals and a concrete next decision).");
        b.AppendLine("- Existing/mandatory work (avoids semantic duplicates; covers every required action including conditional delivery and confirmation, with evidence separate from Done).");
        b.AppendLine();
        b.AppendLine("Scoring: 0 = materially fails, 1 = mixed/minor limitations, 2 = strong. A 0 in groundedness or existing/mandatory work is a release blocker regardless of average.");
        b.AppendLine();
        foreach (var r in Results)
        {
            b.AppendLine($"## {r.Id} — {r.Focus}");
            b.AppendLine();
            b.AppendLine($"- Status: `{r.Status}`; provider/validation error: `{r.ErrorCode ?? "none"}`");
            b.AppendLine($"- Duration: {r.ElapsedMilliseconds} ms");
            if (r.AvailableHours is { } hours)
                b.AppendLine($"- Available hours before deadline: {hours:F1} (even weekly distribution)");
            if (r.RemainingEffortHours is { } effort)
                b.AppendLine($"- New candidate effort: {effort:F1} h");
            foreach (var t in r.Candidate?.Tasks ?? Array.Empty<CandidateTask>())
                b.AppendLine($"- Task: {t.Title.Replace("\r", " ").Replace("\n", " ")} | {t.Priority} | {t.EstimatedHours:F1}h | {t.Target.Kind}");
            foreach (var action in r.Actions ?? Array.Empty<PlanActionSelection>())
                b.AppendLine($"- Selected action: `{action.Action}` | target `{action.Target.Kind}` | rendering reason `{r.Reason}`");
            if (r.Candidate is { } c)
                b.AppendLine($"- Explanation: {c.Explanation.Replace("\r", " ").Replace("\n", " ")}");
            foreach (var f in r.Flags)
                b.AppendLine($"- Review flag: {f}");
            b.AppendLine("- Groundedness __/2 | Personalization __/2 | Actionability __/2 | Effort __/2 | Existing/mandatory __/2");
            b.AppendLine("- Verdict / notes: ______");
            b.AppendLine();
        }
        b.AppendLine("## Follow-up decision");
        b.AppendLine("- [ ] Manually review every candidate using results.json (includes deliverables, completion criteria and resource IDs).");
        b.AppendLine("- [ ] Document failures with scenario and exact generated task; distinguish prompt defects, validation defects, and source/context deficiencies.");
        b.AppendLine("- [ ] If a failure is material, fix on a separate commit and rerun affected scenarios plus regression checks.");
        b.AppendLine("- [ ] Repeat priority scenarios 2–3 times later to assess stability; a single run is exploratory only.");
        return b.ToString();
    }

}

internal sealed record EvaluationResult(string Id, string Focus, string Status, long ElapsedMilliseconds,
    int? TaskCount, PlanCandidateOutput? Candidate, string? Feasibility,
    double? AvailableHours, double? RemainingEffortHours, string[] Flags, string? ErrorCode,
    IReadOnlyList<PlanActionSelection>? Actions = null, string? Reason = null);
