using System.Text.Json;
using System.Text.Json.Nodes;
using NextStep.MetaAi;
using NextStep.MetaAi.Application;

namespace NextStep.Api;

public sealed class Application(IStateStore store, Catalog catalog, IMetaModelClient model, ResourceCatalog resources)
{
    public static SubmissionState Submission(UserState state, Opportunity opportunity) => state.Submissions.GetValueOrDefault(opportunity.Id) ?? Catalog.EmptySubmission(opportunity);
    public Task<StudentProfile> SaveProfile(string owner, ProfileUpdate update, CancellationToken ct)
    {
        Input.Require(update is not null && update.Profile is not null); Input.Profile(update.Profile);
        return store.Change(owner, state => {
            if (state.Profile.Id != update.Profile.Id || state.Profile.Version != update.ExpectedVersion || update.Profile.Version != update.ExpectedVersion) throw new ApiFault("version_conflict", "The profile changed. Reload before saving; plans and progress are preserved.");
            state.Profile = Wire.Copy(update.Profile with { Version = checked(update.ExpectedVersion + 1) });
            return state.Profile;
        }, ct);
    }
    public Task<SubmissionState> SaveSubmission(string owner, string id, SubmissionUpdate update, CancellationToken ct)
    {
        var opportunity = catalog.Get(id); Input.Require(update is not null); Input.Submission(update.Submission, opportunity);
        return store.Change(owner, state => {
            if (Submission(state, opportunity).Version != update.ExpectedVersion || update.Submission.Version != update.ExpectedVersion) throw new ApiFault("version_conflict", "Submission facts changed. Reload and review your edits.");
            var confirmed = update.Submission with { Version = checked(update.ExpectedVersion + 1) };
            state.Submissions[id] = Wire.Copy(confirmed); return confirmed;
        }, ct);
    }
    private static void Check(Opportunity o, UserState state, AnalysisRequest request)
    {
        Input.Require(request is not null && request.Profile is not null && request.Submission is not null);
        Input.Profile(request.Profile); Input.Submission(request.Submission, o);
        if (request.ExpectedSourceRevision != o.SourceRevision || !JsonNode.DeepEquals(JsonSerializer.SerializeToNode(request.Profile, Wire.Json), JsonSerializer.SerializeToNode(state.Profile, Wire.Json)) || !JsonNode.DeepEquals(JsonSerializer.SerializeToNode(request.Submission, Wire.Json), JsonSerializer.SerializeToNode(Submission(state, o), Wire.Json))) throw new ApiFault("version_conflict", "Save and reload current profile/submission facts first. Source or accepted facts changed.");
        if (request.PreviousPlan is not null && !JsonNode.DeepEquals(JsonSerializer.SerializeToNode(request.PreviousPlan, Wire.Json), JsonSerializer.SerializeToNode(state.Plans.GetValueOrDefault(o.Id), Wire.Json))) throw new ApiFault("version_conflict", "The accepted plan changed. Reload before generating another draft.");
    }
    public Task<AnalysisResult> Analyze(string owner, string id, AnalysisRequest request, CancellationToken ct)
    {
        var opportunity = catalog.Get(id);
        return store.Read(owner, state => { Check(opportunity, state, request); return Matching.Analyze(opportunity, state.Profile, Submission(state, opportunity), DateTimeOffset.UtcNow); }, ct);
    }
    public async Task<StoredCandidate> Generate(string owner, string id, AnalysisRequest request, CancellationToken ct)
    {
        var opportunity = catalog.Get(id);
        var snapshot = await store.Read(owner, state => { Check(opportunity, state, request); return Wire.Copy(state); }, ct);
        var submission = Submission(snapshot, opportunity); var profile = snapshot.Profile;
        var analysis = Matching.Analyze(opportunity, profile, submission, DateTimeOffset.UtcNow);
        var previous = snapshot.Plans.GetValueOrDefault(id);
        var rules = opportunity.Requirements.Where(r => r.Lane is "submission" or "preparation" && r.Evaluation["key"]?.GetValue<string>() != "unresolved" && Catalog.Reviewed(opportunity, r) && Matching.Applies(r, profile) == true && analysis.Matches.Single(m => m.RequirementId == r.Id).Status != "supported").Select(r => new ReviewedRequirement(r.Id, r.Statement, r.Lane, true, r.IsMandatory)).ToArray();
        var reviewedResources = resources.For(opportunity).Where(resource => resource.Status == "reviewed").ToArray();
        var projection = new PlanGenerationContext(id, opportunity.Theme, opportunity.SourceRevision, request.ExpectedSourceRevision, profile.Goals, rules, reviewedResources.Select(resource => resource.Id).ToArray(), Input.Fact<double>(profile.AvailableHoursPerWeek), Catalog.Instant(opportunity, "submission_close"), analysis.ParticipationSummary == "does_not_meet_confirmed_requirement", previous?.Tasks.Select(t => new ExistingPlanTask(t.Id, t.Title, t.Status, t.Target)).ToArray() ?? [], new PlanningProfile(profile.ProjectExperience.Select(e => e.Description).Concat(profile.AcceptedInterpretations.Select(e => e.Text)).Append(profile.Background).Where(s => !string.IsNullOrWhiteSpace(s)).Take(30).Select(s => s.Length <= 1000 ? s : s[..1000]).ToArray(), profile.Skills.Where(s => s.State == "reported_has").Select(s => s.Label).Take(30).ToArray(), profile.Constraints)) { ReviewedResources = reviewedResources.Select(resource => new ReviewedResourceInfo(resource.Id, resource.Title, resource.RelevanceNote)).ToArray() };
        GenerationPolicy.ValidateInput(projection);
        var output = await model.GenerateCandidateAsync(projection, ct);
        GenerationPolicy.ValidateInput(projection); GenerationPolicy.ValidateCandidate(output, projection);
        var retained = SubmissionReconciliation.Retain(previous);
        if (output.Tasks.Any(t => retained.Any(old => string.Equals(old.Title.Trim(), t.Title.Trim(), StringComparison.OrdinalIgnoreCase)))) throw new ApiFault("invalid_model_output", "The draft repeats retained work. Your accepted plan is unchanged.");
        return await store.Change(owner, state => {
            Check(opportunity, state, request);
            if (state.Plans.GetValueOrDefault(id)?.Version != previous?.Version) throw new ApiFault("version_conflict", "Progress changed while generating. Request a fresh draft.");
            _ = SubmissionReconciliation.Assess(opportunity, state.Profile, Submission(state, opportunity), previous, output.Tasks, SubmissionReconciliation.Retain(previous));
            var now = DateTimeOffset.UtcNow;
            foreach (var expired in state.Candidates.Where(p => p.Value.ExpiresAt <= now).Select(p => p.Key).ToArray()) state.Candidates.Remove(expired);
            if (state.Candidates.Count >= 20) throw new ApiFault("rate_limited", "Too many pending drafts. Discard an older draft first.");
            var candidate = new StoredCandidate(Guid.NewGuid().ToString("N"), id, analysis.Context, previous?.Version, Wire.Copy(profile.Goals), Wire.Copy(output), now.AddMinutes(30));
            state.Candidates.Add(candidate.Id, candidate); return candidate;
        }, ct);
    }
    public Task<Plan> Accept(string owner, string id, AcceptPlan request, CancellationToken ct)
    {
        var opportunity = catalog.Get(id); Input.Require(request is not null && Input.Id(request.CandidateId) && Input.Id(request.OperationId));
        var fingerprint = MySqlStateStore.Hash("accept:" + id + JsonSerializer.Serialize(request, Wire.Json));
        return store.Change(owner, state => {
            if (Replay(state, request.OperationId, fingerprint, id)) return state.Plans[id];
            if (!state.Candidates.TryGetValue(request.CandidateId, out var candidate) || candidate.OpportunityId != id || candidate.ExpiresAt <= DateTimeOffset.UtcNow) throw new ApiFault("not_found", "This draft expired or is unavailable. Generate another draft.");
            var submission = Submission(state, opportunity); var currentContext = Matching.Context(opportunity, state.Profile, submission); var previous = state.Plans.GetValueOrDefault(id);
            if (candidate.Context != currentContext || previous?.Version != request.ExpectedPlanVersion || candidate.BaseVersion != request.ExpectedPlanVersion) throw new ApiFault("version_conflict", "Context or plan version changed. Your previous plan is kept.");
            var analysis = Matching.Analyze(opportunity, state.Profile, submission, DateTimeOffset.UtcNow);
            if (analysis.ParticipationSummary == "does_not_meet_confirmed_requirement") throw new ApiFault("invalid_input", "Preparation cannot bypass a confirmed participation blocker.");
            var deadline = Catalog.Instant(opportunity, "submission_close");
            if (deadline <= DateTimeOffset.UtcNow) throw new ApiFault("invalid_input", "The confirmed submission window has closed.");
            if (Input.Fact<double>(state.Profile.AvailableHoursPerWeek) == 0 && candidate.Output.Tasks.Count > 0) throw new ApiFault("invalid_input", "Zero reported hours cannot support positive preparation work.");
            var retained = SubmissionReconciliation.Retain(previous);
            var coverage = SubmissionReconciliation.Assess(opportunity, state.Profile, submission, previous, candidate.Output.Tasks, retained, candidate.Id);
            var tasks = retained.Concat(candidate.Output.Tasks.Select(t => new PreparationTask(Guid.NewGuid().ToString("N"), t.Title, t.Target, t.Priority, t.Deliverable, t.CompletionCriteria, t.EstimatedHours, t.EstimatedHours, "not_started", t.ResourceIds.ToArray(), []))).ToArray();
            var goals = candidate.Goals.Concat(previous?.Goals ?? []).DistinctBy(g => g.Id).ToArray(); var budget = Budget(opportunity, state.Profile, tasks);
            var plan = new Plan(previous?.Id ?? Guid.NewGuid().ToString("N"), checked((previous?.Version ?? 0) + 1), currentContext, goals, tasks, tasks.Select(t => t.Id).ToArray(), budget.Budget, budget.Feasibility, new[] { candidate.Output.Explanation, "Progress is self-reported and does not change eligibility or submission facts." }.Concat(deadline is null ? ["Submission timing is unconfirmed; this is untimed guidance."] : Array.Empty<string>()).ToArray());
            plan = plan with { Warnings = plan.Warnings.Concat(coverage.Report.UnrepresentedRequirementIds.Select(requirementId => "Submission action not represented by plan tasks: " + opportunity.Requirements.Single(rule => rule.Id == requirementId).Statement)).Concat(coverage.Report.SourceCoverage != "complete" ? ["Submission source coverage remains " + coverage.Report.SourceCoverage + "; task coverage does not establish submission completeness."] : Array.Empty<string>()).ToArray() };
            state.Plans[id] = plan; state.Candidates.Remove(candidate.Id); Remember(state, request.OperationId, fingerprint, id); return plan;
        }, ct);
    }
    public Task<SubmissionCoverageView> Coverage(string owner, string id, string? candidateId, CancellationToken ct)
    {
        var opportunity = catalog.Get(id);
        return store.Read(owner, state => {
            var plan = state.Plans.GetValueOrDefault(id); var submission = Submission(state, opportunity);
            if (candidateId is null) return SubmissionReconciliation.Assess(opportunity, state.Profile, submission, plan, [], plan?.Tasks ?? []);
            if (!state.Candidates.TryGetValue(candidateId, out var candidate) || candidate.OpportunityId != id || candidate.ExpiresAt <= DateTimeOffset.UtcNow) throw new ApiFault("not_found", "This draft is unavailable for your account.");
            if (candidate.Context != Matching.Context(opportunity, state.Profile, submission) || candidate.BaseVersion != plan?.Version) throw new ApiFault("version_conflict", "Draft context changed. Reload current evidence and request a new draft.");
            return SubmissionReconciliation.Assess(opportunity, state.Profile, submission, plan, candidate.Output.Tasks, SubmissionReconciliation.Retain(plan), candidate.Id);
        }, ct);
    }
    public Task<Plan> Progress(string owner, string id, string taskId, TaskUpdate request, CancellationToken ct)
    {
        catalog.Get(id); Input.Require(request is not null && Input.Id(request.OperationId) && request.Status is "not_started" or "in_progress" or "done");
        Input.Require(request.ArtifactUrls is null || request.ArtifactUrls.Length <= 8 && request.ArtifactUrls.All(u => u.Length <= 2000 && Input.Url(u)), "Artifact URLs must be valid HTTP(S) links.");
        var fingerprint = MySqlStateStore.Hash("progress:" + id + ":" + taskId + JsonSerializer.Serialize(request, Wire.Json));
        return store.Change(owner, state => {
            if (Replay(state, request.OperationId, fingerprint, id)) return state.Plans[id];
            var plan = state.Plans.GetValueOrDefault(id) ?? throw new ApiFault("not_found", "No accepted plan exists for this opportunity.");
            if (plan.Version != request.ExpectedVersion) throw new ApiFault("version_conflict", "Progress changed in another request. Reload before applying your unsaved change.");
            if (!plan.Tasks.Any(t => t.Id == taskId)) throw new ApiFault("not_found", "This task does not belong to the selected plan.");
            var tasks = plan.Tasks.Select(t => t.Id != taskId ? t : t with { Status = request.Status, RemainingEstimatedHours = request.Status == "done" ? 0 : t.RemainingEstimatedHours > 0 ? t.RemainingEstimatedHours : t.EstimatedHours, ArtifactUrls = request.ArtifactUrls ?? t.ArtifactUrls }).ToArray();
            var assessment = PreparationBudget.Evaluate(plan.Budget.HoursPerWeek, plan.Budget.DeadlineInstant is { } date ? DateTimeOffset.Parse(date) : null, DateTimeOffset.UtcNow, new([], "Confirmed progress"), tasks.Select(t => new RetainedWork(t.Id, t.Status, t.RemainingEstimatedHours)).ToArray());
            var updated = plan with { Version = checked(plan.Version + 1), Tasks = tasks, Budget = ToBudget(assessment), Feasibility = assessment.Feasibility };
            state.Plans[id] = updated; Remember(state, request.OperationId, fingerprint, id); return updated;
        }, ct);
    }
    private static (PlanBudget Budget, string Feasibility) Budget(Opportunity o, StudentProfile p, PreparationTask[] tasks)
    {
        var now = DateTimeOffset.UtcNow; var start = Catalog.Instant(o, "build_start"); var effective = start is { } begins && begins > now ? begins : now;
        var budget = PreparationBudget.Evaluate(Input.Fact<double>(p.AvailableHoursPerWeek), Catalog.Instant(o, "submission_close"), effective, new([], "Accepted preparation"), tasks.Select(t => new RetainedWork(t.Id, t.Status, t.RemainingEstimatedHours)).ToArray());
        return (ToBudget(budget with { EvaluatedAt = now }), budget.Feasibility);
    }
    private static PlanBudget ToBudget(BudgetAssessment b) => new(b.EvaluatedAt.ToString("O"), b.HoursPerWeek, b.DeadlineInstant?.ToString("O"), b.AvailableHours, b.RemainingEffortHours, b.Assumption);
    private static bool Replay(UserState state, string operation, string fingerprint, string opportunity)
    {
        if (!state.Receipts.TryGetValue(operation, out var receipt)) return false;
        if (receipt.Fingerprint != fingerprint || receipt.OpportunityId != opportunity) throw new ApiFault("version_conflict", "The operation ID was already used for a different change.");
        return true;
    }
    private static void Remember(UserState state, string operation, string fingerprint, string opportunity)
    {
        state.Receipts[operation] = new(fingerprint, opportunity);
        while (state.Receipts.Count > 100) state.Receipts.Remove(state.Receipts.Keys.First());
    }
}
