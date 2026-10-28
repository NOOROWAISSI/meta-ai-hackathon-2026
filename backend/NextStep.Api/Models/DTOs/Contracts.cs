using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using NextStep.MetaAi;

namespace NextStep.Api;

public sealed class ApiAssemblyMarker;

// Canonical v0.2 wire names are camelCase. JsonObject retains the contract's typed
// fact/evaluator unions; Input validates their allowed shapes before use/storage.
public static class Wire
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow, MaxDepth = 32 };
    public static T Copy<T>(T value) => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value, Json), Json)!;
}
public sealed record ApiError(string Code, string Message, string RequestId, bool Retryable, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Dictionary<string, string[]>? FieldErrors = null);
public sealed class ApiFault(string code, string message, bool retryable = false) : Exception(message)
{
    public ApiError Error { get; } = new(code, message, Guid.NewGuid().ToString("N"), retryable);
}
public sealed record Evidence(string Id, string SourceUrl, string SourceSection, string Status, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Passage, string? CheckedAt);
public sealed record Coverage(string State, string[] ReviewedRequirementIds, string[] MissingChecks, string? ReviewedAt);
public sealed record CoverageSet(Coverage Participation, Coverage Submission, Coverage Prize);
public sealed record Claim(string Value, string[] EvidenceIds);
public sealed record Rule(string Id, string Statement, string Subject, JsonObject Applicability, JsonObject Evaluation, Claim[] Claims, string[] SourceEvidenceIds, string SourceStatus, string Kind, string Lane, bool IsMandatory);
public sealed record TimelineClaim(string Id, string PublishedText, string? DateTime, string[] EvidenceIds, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? TimeZone = null);
public sealed record TimelineEvent(string Id, string Kind, TimelineClaim[] Claims, string SourceStatus);
public sealed record InterestTag(string Id, string Label, string[] EvidenceIds);
public sealed record Opportunity(string Id, string Title, string Organizer, string CanonicalEventUrl, string OfficialUrl, string Format, string Theme, string SourceRevision, string? LastReviewedAt, string InformationFreshness, string CostStatus, string[] Benefits, Evidence[] SourceEvidence, CoverageSet SourceCoverage, Rule[] Requirements, TimelineEvent[] TimelineEvents, InterestTag[] InterestTags, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? ListingHost = null, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? RulesUrl = null);
public sealed record AssessmentContext(string OpportunityId, string ProfileId, int ProfileVersion, string SourceRevision, int SubmissionVersion);
public sealed record ProjectExperience(string Id, string Description);
public sealed record Skill(string Id, string Label, string State);
public sealed record AcceptedInterpretation(string ExperienceId, string Text, string AcceptedAt);
public sealed record ClarificationAnswer(string QuestionId, string Answer, string AnsweredAt);
public sealed record StudentProfile(string Id, int Version, JsonObject ReportedAge, JsonObject Majority, JsonObject Enrollment, JsonObject Residence, JsonObject EntrantType, JsonObject Team, JsonObject AvailableHoursPerWeek, string Background, ProjectExperience[] ProjectExperience, Skill[] Skills, string[] Interests, PlanGoal[] Goals, string[] PreferredFormats, string[] Constraints, AcceptedInterpretation[] AcceptedInterpretations, ClarificationAnswer[] ClarificationAnswers, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? PreferredLanguage = null);
public sealed record SubmissionItem(string RequirementId, string State, Dictionary<string, string> CriterionResults, string EvidenceLevel, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? ArtifactUrl = null);
public sealed record SubmissionState(string OpportunityId, int Version, SubmissionItem[] Items);
public sealed record AnalysisRequest(string ExpectedSourceRevision, StudentProfile Profile, SubmissionState Submission, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Plan? PreviousPlan = null);
public sealed record RequirementMatch(string RequirementId, string Status, string Explanation, string[] SourceEvidenceIds, string EvidenceLevel, string ReasonCode);
public sealed record PhaseState(string Phase, string Status, string[] TimelineEventIds, string Explanation);
public sealed record AnalysisWarning(string Code, string Message, string? RequirementId = null);
public sealed record AnalysisResult(AssessmentContext Context, string ParticipationSummary, string SubmissionSummary, PhaseState[] Phases, RequirementMatch[] Matches, AnalysisWarning[] Warnings);
public sealed record PreparationTask(string Id, string Title, TaskTarget Target, string Priority, string Deliverable, string CompletionCriteria, double EstimatedHours, double RemainingEstimatedHours, string Status, string[] ResourceIds, string[] ArtifactUrls);
public sealed record PlanBudget(string EvaluatedAt, double? HoursPerWeek, string? DeadlineInstant, double? AvailableHours, double RemainingEffortHours, string Assumption);
public sealed record Plan(string Id, int Version, AssessmentContext Context, PlanGoal[] Goals, PreparationTask[] Tasks, string[] TaskOrder, PlanBudget Budget, string Feasibility, string[] Warnings);
public sealed record ProgressState(string PlanId, int ConfirmedPlanVersion, string SaveState);
public sealed record OpportunityPreference(string OpportunityId, bool Saved, bool NotInterested);
public sealed record ProfileUpdate(int ExpectedVersion, StudentProfile Profile);
public sealed record SubmissionUpdate(int ExpectedVersion, SubmissionState Submission);
public sealed record AcceptPlan(string CandidateId, int? ExpectedPlanVersion, string OperationId);
public sealed record TaskUpdate(int ExpectedVersion, string Status, string OperationId, string[]? ArtifactUrls = null);

// Application storage envelope, never a competing public contract or model DTO.
public sealed record StoredCandidate(string Id, string OpportunityId, AssessmentContext Context, int? BaseVersion, PlanGoal[] Goals, PlanCandidateOutput Output, DateTimeOffset ExpiresAt);
public sealed record Receipt(string Fingerprint, string OpportunityId);
public sealed class UserState
{
    public int SchemaVersion { get; set; } = 1;
    public StudentProfile Profile { get; set; } = null!;
    public Dictionary<string, SubmissionState> Submissions { get; set; } = [];
    public Dictionary<string, Plan> Plans { get; set; } = [];
    public Dictionary<string, StoredCandidate> Candidates { get; set; } = [];
    public Dictionary<string, Receipt> Receipts { get; set; } = [];
    public Dictionary<string, OpportunityPreference> Preferences { get; set; } = [];
}
