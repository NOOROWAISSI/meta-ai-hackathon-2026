using System.Text.Json.Nodes;

namespace NextStep.Api;

public static class Input
{
    public static void Require([System.Diagnostics.CodeAnalysis.DoesNotReturnIf(false)] bool condition, string message = "Invalid request.") { if (!condition) throw new ApiFault("invalid_input", message); }
    public static bool Text(string? value, int max = 1000) => value is not null && value.Length <= max;
    public static bool Id(string? value) => !string.IsNullOrWhiteSpace(value) && value.Length <= 200 && !value.Any(char.IsControl);
    public static bool Url(string? value) => Uri.TryCreate(value, UriKind.Absolute, out var url) && url.Scheme is "https" or "http" && string.IsNullOrEmpty(url.UserInfo);
    public static T? Fact<T>(JsonNode? fact) where T : struct => fact?["state"]?.GetValue<string>() == "known" ? fact["value"]?.GetValue<T>() : null;
    public static string? StringFact(JsonNode? fact) => fact?["state"]?.GetValue<string>() == "known" ? fact["value"]?.GetValue<string>() : null;
    private static void CheckFact(JsonNode? node, Func<JsonNode, bool> check)
    {
        Require(node is JsonObject, "Expected a known or unknown profile fact.");
        var fact = (JsonObject)node!;
        if (fact["state"]?.GetValue<string>() == "unknown") { Require(fact.All(p => p.Key is "state" or "reason") && (fact["reason"] is null || Text(fact["reason"]!.GetValue<string>()))); return; }
        Require(fact["state"]?.GetValue<string>() == "known" && fact.All(p => p.Key is "state" or "value" or "reportedAt") && fact["value"] is not null && check(fact["value"]!) && DateTimeOffset.TryParse(fact["reportedAt"]?.GetValue<string>(), out _), "A known fact needs a valid value and reportedAt.");
    }
    public static void Profile(StudentProfile p)
    {
        Require(p is not null && Id(p.Id) && p.Version >= 0 && p.Version < int.MaxValue);
        CheckFact(p.ReportedAge, n => n.GetValue<double>() is var age && double.IsFinite(age) && age >= 0 && age <= 130 && age == Math.Truncate(age));
        Require(p.Majority is not null && p.Majority.All(v => v.Key is "jurisdiction" or "reached"));
        CheckFact(p.Majority["reached"], n => n is JsonValue value && value.TryGetValue<bool>(out _));
        Require(p.Majority["jurisdiction"] is null || Text(p.Majority["jurisdiction"]!.GetValue<string>(), 200));
        CheckFact(p.Enrollment, n => n.GetValue<string>() is "school" or "higher_education" or "not_enrolled");
        Require(p.Residence is not null && p.Residence.All(v => v.Key is "country" or "region"));
        CheckFact(p.Residence["country"], n => Text(n.GetValue<string>(), 200) && !string.IsNullOrWhiteSpace(n.GetValue<string>()));
        CheckFact(p.Residence["region"], n => Text(n.GetValue<string>(), 200) && !string.IsNullOrWhiteSpace(n.GetValue<string>()));
        CheckFact(p.EntrantType, n => n.GetValue<string>() is "individual" or "team" or "organization");
        Require(p.Team is not null && p.Team.All(v => v.Key is "size" or "division" or "sameDivision" or "allMembersMeetRule"));
        CheckFact(p.Team["size"], n => n.GetValue<double>() is var size && double.IsFinite(size) && size >= 1 && size <= 100 && size == Math.Truncate(size));
        CheckFact(p.Team["division"], n => n.GetValue<string>() is "school" or "college_plus");
        CheckFact(p.Team["sameDivision"], n => n is JsonValue value && value.TryGetValue<bool>(out _));
        Require(p.Team["allMembersMeetRule"] is JsonObject members && members.Count <= 100);
        foreach (var pair in (JsonObject)p.Team["allMembersMeetRule"]!) { Require(Id(pair.Key)); CheckFact(pair.Value, n => n is JsonValue value && value.TryGetValue<bool>(out _)); }
        CheckFact(p.AvailableHoursPerWeek, n => n.GetValue<double>() is var hours && double.IsFinite(hours) && hours >= 0 && hours <= 168);
        Require(Text(p.Background, 4000) && p.ProjectExperience is { Length: <= 20 } && p.ProjectExperience.All(x => x is not null && Id(x.Id) && Text(x.Description, 4000)) && p.ProjectExperience.Select(x => x.Id).Distinct().Count() == p.ProjectExperience.Length);
        Require(p.Skills is { Length: <= 50 } && p.Skills.All(s => s is not null && Id(s.Id) && Text(s.Label, 100) && s.State is "reported_has" or "reported_lacks" or "unknown") && p.Skills.Select(s => s.Id).Distinct().Count() == p.Skills.Length);
        Require(p.Goals is { Length: <= 30 } && p.Goals.All(g => g is not null && Id(g.Id) && !string.IsNullOrWhiteSpace(g.Statement) && Text(g.Statement)) && p.Goals.Select(g => g.Id).Distinct().Count() == p.Goals.Length);
        Require(p.Interests is { Length: <= 30 } && p.Interests.All(s => Text(s, 100)) && p.Constraints is { Length: <= 30 } && p.Constraints.All(s => Text(s)) && p.PreferredFormats is { Length: <= 3 } && p.PreferredFormats.All(s => s is "online" or "in_person" or "hybrid"));
        Require(p.AcceptedInterpretations is { Length: <= 30 } && p.AcceptedInterpretations.All(x => x is not null && p.ProjectExperience.Any(e => e.Id == x.ExperienceId) && Text(x.Text) && DateTimeOffset.TryParse(x.AcceptedAt, out _)));
        Require(p.ClarificationAnswers is { Length: <= 30 } && p.ClarificationAnswers.All(x => x is not null && Id(x.QuestionId) && Text(x.Answer) && DateTimeOffset.TryParse(x.AnsweredAt, out _)) && (p.PreferredLanguage is null || Text(p.PreferredLanguage, 50)));
    }
    public static void Submission(SubmissionState s, Opportunity opportunity)
    {
        Require(s is not null && s.OpportunityId == opportunity.Id && s.Version >= 1 && s.Version < int.MaxValue && s.Items is { Length: <= 100 });
        Require(s.Items.All(x => x is not null) && s.Items.Select(x => x.RequirementId).Distinct().Count() == s.Items.Length);
        foreach (var item in s.Items)
        {
            Require(item is not null && opportunity.Requirements.Any(r => r.Id == item.RequirementId && r.Lane == "submission" && r.IsMandatory));
            Require(item.State is "missing" or "reported_present" or "unknown" && item.EvidenceLevel == "self_report" && (item.ArtifactUrl is null || (item.ArtifactUrl.Length <= 2000 && Url(item.ArtifactUrl))));
            Require(item.CriterionResults is not null && item.CriterionResults.Count <= 7 && item.CriterionResults.All(c => c.Key is "presence" or "visibility" or "duration" or "license" or "functionality" or "disclosure" or "content" && c.Value is "reported_met" or "reported_not_met" or "unknown"));
        }
    }
    public static StudentProfile Blank(string id)
    {
        static JsonObject U() => new() { ["state"] = "unknown" };
        return new(id, 0, U(), new() { ["reached"] = U() }, U(), new() { ["country"] = U(), ["region"] = U() }, U(), new() { ["size"] = U(), ["division"] = U(), ["sameDivision"] = U(), ["allMembersMeetRule"] = new JsonObject() }, U(), "", [], [], [], [], [], [], [], []);
    }
}
