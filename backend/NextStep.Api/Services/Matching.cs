using System.Text.Json.Nodes;

namespace NextStep.Api;

public static class Matching
{
    public static AssessmentContext Context(Opportunity o, StudentProfile p, SubmissionState s) => new(o.Id, p.Id, p.Version, o.SourceRevision, s.Version);
    public static bool? Applies(Rule r, StudentProfile p) => r.Applicability["key"]?.GetValue<string>() switch
    {
        "all" => true,
        "division" => Input.StringFact(p.Team["division"]) is { } division ? division == r.Applicability["division"]?.GetValue<string>() : null,
        "entrant_type" => Input.StringFact(p.EntrantType) is { } entrant ? entrant == r.Applicability["entrantType"]?.GetValue<string>() : null,
        _ => null
    };
    public static AnalysisResult Analyze(Opportunity o, StudentProfile p, SubmissionState s, DateTimeOffset now)
    {
        Input.Profile(p); Input.Submission(s, o);
        var matches = o.Requirements.Select(r => Evaluate(o, r, p, s)).ToArray();
        var warnings = new List<AnalysisWarning>();
        foreach (var match in matches.Where(m => m.Status is "unknown" or "source_conflict")) warnings.Add(new(match.ReasonCode, match.Explanation, match.RequirementId));
        bool Complete(string lane, Coverage coverage) => coverage.State == "complete" && ContractTime.IsInstant(coverage.ReviewedAt) && coverage.MissingChecks.Length == 0 && o.Requirements.Any(r => r.Lane == lane && r.IsMandatory && Applies(r, p) == true) && o.Requirements.Where(r => r.Lane == lane && r.IsMandatory && Applies(r, p) != false).All(r => coverage.ReviewedRequirementIds.Contains(r.Id) && Catalog.Reviewed(o, r) && matches.Single(m => m.RequirementId == r.Id).Status is "supported" or "not_applicable");
        string Summary(string lane, Coverage coverage, string failed, string supported) {
            var rules = o.Requirements.Where(r => r.Lane == lane && r.IsMandatory).Select(r => matches.Single(m => m.RequirementId == r.Id)).ToArray();
            if (coverage.State != "complete") warnings.Add(new("incomplete_coverage", $"{lane} source coverage is incomplete."));
            return rules.Any(m => m.Status == "not_met") ? failed : Complete(lane, coverage) ? supported : "needs_verification";
        }
        var phases = new[] { ("registration", "registration_open", "registration_close"), ("build", "build_start", "build_end"), ("submission", "submission_open", "submission_close") }.Select(pair => {
            var start = Catalog.Instant(o, pair.Item2); var end = Catalog.Instant(o, pair.Item3);
            // Exact cutoff inclusivity is not encoded by v0.2; do not invent it.
            var state = end is { } closed && now > closed ? "closed" : start is { } begins && now < begins ? "upcoming" : start is not null && end is not null && now > start && now < end ? "open" : "unknown";
            return new PhaseState(pair.Item1, state, o.TimelineEvents.Where(t => t.Kind == pair.Item2 || t.Kind == pair.Item3).Select(t => t.Id).ToArray(), state == "unknown" ? "The reviewed phase window or exact cutoff convention is not confirmed." : "Based on the reviewed phase-specific instants.");
        }).ToArray();
        return new(Context(o, p, s), Summary("participation", o.SourceCoverage.Participation, "does_not_meet_confirmed_requirement", "meets_checked_conditions"), Summary("submission", o.SourceCoverage.Submission, "incomplete", "meets_checked_criteria"), phases, matches, warnings.ToArray());
    }
    private static RequirementMatch Evaluate(Opportunity o, Rule r, StudentProfile p, SubmissionState s)
    {
        RequirementMatch Result(string status, string reason, string explanation, string evidence = "none") => new(r.Id, status, explanation, r.SourceEvidenceIds, evidence, reason);
        var applies = Applies(r, p);
        if (applies == false) return Result("not_applicable", "not_applicable", "This reliably identified alternative does not apply to the selected path.");
        if (applies is null) return Result("unknown", "missing_profile_fact", "Clarify entrant type or division; applicability is unknown.");
        if (r.SourceStatus == "conflicting") return Result("source_conflict", "conflicting_claims", "Published claims conflict. Inspect both source passages before deciding.");
        if (!Catalog.Reviewed(o, r)) return Result("unknown", r.SourceStatus == "stale" || o.InformationFreshness == "stale" ? "stale_source" : "insufficient_source", "A current reviewed passage or complete rule interpretation is missing.");
        bool? meets = null;
        var key = r.Evaluation["key"]?.GetValue<string>();
        if (key is "unresolved" or "geographic_policy" or "reported_condition") return Result("unknown", "insufficient_source", "A reviewed interpretation or permitted policy registry is not yet available.");
        switch (key)
        {
            case "minimum_age": if (Input.Fact<double>(p.ReportedAge) is { } age) meets = age >= r.Evaluation["minimum"]!.GetValue<double>(); break;
            case "majority":
                var country = Input.StringFact(p.Residence["country"]);
                if (country is not null && string.Equals(country, p.Majority["jurisdiction"]?.GetValue<string>(), StringComparison.OrdinalIgnoreCase)) meets = Input.Fact<bool>(p.Majority["reached"]);
                break;
            case "enrollment": if (Input.StringFact(p.Enrollment) is { } enrollment) meets = r.Evaluation["allowed"]!.AsArray().Any(n => n?.GetValue<string>() == enrollment); break;
            case "team_bound":
                double? size = Input.StringFact(p.EntrantType) == "individual" ? 1 : Input.Fact<double>(p.Team["size"]);
                if (size is not null) meets = r.Evaluation["bound"]?.GetValue<string>() == "minimum" ? size >= r.Evaluation["count"]!.GetValue<double>() : size <= r.Evaluation["count"]!.GetValue<double>();
                break;
            case "same_division": meets = Input.StringFact(p.EntrantType) == "individual" ? true : Input.Fact<bool>(p.Team["sameDivision"]); break;
            case "submission_criterion":
                var item = s.Items.SingleOrDefault(i => i.RequirementId == r.Id);
                if (item?.State == "missing") meets = false;
                else if (item is not null) {
                    var criterion = r.Evaluation["criterion"]?.GetValue<string>() ?? "";
                    var value = item.CriterionResults.GetValueOrDefault(criterion);
                    meets = value == "reported_not_met" ? false : value == "reported_met" || criterion == "presence" && item.State == "reported_present" ? true : null;
                }
                break;
            // No geographic/legal policy or reported-condition whitelist has been
            // jointly reviewed yet. Unknown is the only supported default.
        }
        if (r.Subject == "individual" && r.Lane is "participation" or "prize" && meets != false)
        {
            var entrant = Input.StringFact(p.EntrantType);
            if (entrant != "individual") {
                var members = Input.Fact<bool>(p.Team["allMembersMeetRule"]?[r.Id]);
                meets = entrant == "team" && members == false ? false : meets == true && entrant == "team" && members == true ? true : null;
            }
        }
        return meets switch {
            true => Result("supported", "matches", "Accepted self-report supports this reviewed condition only; it is not independent verification.", "self_report"),
            false => Result("not_met", "fails", "Accepted explicit information contradicts this reviewed condition in its own lane.", "self_report"),
            _ => Result("unknown", r.Lane == "submission" ? "missing_submission_fact" : "missing_profile_fact", "Relevant accepted information or a reviewed interpretation is still missing.")
        };
    }
}
