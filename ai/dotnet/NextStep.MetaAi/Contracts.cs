using System.Text.Json;
using System.Text.Json.Serialization;

namespace NextStep.MetaAi;

public static class ContractJson
{
    public static JsonSerializerOptions CreateOptions() => new(JsonSerializerDefaults.Web);
}
public sealed record PlanCandidateOutput(IReadOnlyList<CandidateTask> Tasks, string Explanation);
public sealed record CandidateTask(string Title, TaskTarget Target, string Priority,
    string Deliverable, string CompletionCriteria, double EstimatedHours, IReadOnlyList<string> ResourceIds);
public sealed record TaskTarget(string Kind,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? GoalId = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? RequirementId = null);
public sealed record PlanGoal(string Id, string Statement);

// Server-only projection: current reviewed evidence AND evaluated applicability.
// Unresolved (null) or false Applies is rejected. Never bind this from browser input.
public sealed record ReviewedRequirement(string Id, string Statement, string Lane,
    bool? Applies, bool IsMandatory,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ReviewedDeliverable? Deliverable = null);
public sealed record ReviewedDeliverable(string Type, IReadOnlyList<string> RequiredActions,
    string SourceRevision, IReadOnlyList<string> EvidenceIds);
public sealed record ExistingPlanTask(string Id, string Title, string Status, TaskTarget Target,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? ActionCode = null);
public sealed record PlanningProfile(IReadOnlyList<string> AcceptedExperience,
    IReadOnlyList<string> ReportedSkills, IReadOnlyList<string> Constraints);

// Trusted server-side projection of a reviewed resource. No URL is sent to the model;
// the app resolves resource IDs to reviewed catalog links after validation.
public sealed record ReviewedResourceInfo(string Id, string Title, string RelevanceNote);

// Internal projection, not the frontend PlanCandidateRequest. The caller captures
// profile/submission/source/base-plan versions and checks them again after generation.
public sealed record PlanGenerationContext(string OpportunityId, string OpportunityTheme,
    string SourceRevision, string ExpectedSourceRevision, IReadOnlyList<PlanGoal> Goals,
    IReadOnlyList<ReviewedRequirement> ReviewedRequirements, IReadOnlyList<string> ReviewedResourceIds,
    double? AvailableHoursPerWeek, DateTimeOffset? ReviewedSubmissionDeadline,
    bool HasConfirmedParticipationBlocker, IReadOnlyList<ExistingPlanTask> ExistingTasks,
    PlanningProfile SelfReport)
{
    // Optional for existing callers. Without descriptive metadata, the generator
    // cannot reference a resource even if its ID is present in ReviewedResourceIds.
    public IReadOnlyList<ReviewedResourceInfo> ReviewedResources { get; init; } = [];
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? RetainedEffortHours { get; init; }
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public double? AvailableCapacityHours { get; init; }
}
public interface IMetaModelClient
{
    Task<PlanCandidateOutput> GenerateCandidateAsync(PlanGenerationContext context,
        CancellationToken cancellationToken = default);
}
public sealed record AiApiError(string Code, string Message, string RequestId, bool Retryable);
public static class ApiErrorMapping
{
    public static int StatusCode(AiApiError error) => error.Code switch
    {
        "invalid_input" => 400, "not_found" => 404, "version_conflict" => 409,
        "rate_limited" => 429, "timeout" => 504,
        "provider_unavailable" or "invalid_model_output" => 503,
        _ => throw new ArgumentException("Unsupported API error code.", nameof(error))
    };
}
