# NextStep Meta AI - Backend Integration

Status: the standalone v2 client is validated independently; frontend/backend integration is pending. It has not been validated end-to-end and is not production-ready.

## Verification boundary (2026-10-28)

- Baseline for the submission coverage helper: PR #10 head `aa9779abf9cbb91df905a74ebff74914f32371ce` (v2 plus L1-L3 cleanup).
- .NET SDK 8.0.427: library, offline checks and evaluation harness build with zero warnings/errors.
- Prior offline baseline: **123 passed, 0 failed, 123 total** (109 baseline cases, two direct resource-policy boundary cases and 12 evaluation-report/provenance cases). The existing eleven-resource case supplies valid descriptors. Submission coverage regression checks extend this same provider-free executable.
- With submission coverage: **157 passed, 0 failed, 157 total**, including 34 new regression cases. Library, checks and evaluation projects build with zero compiler warnings/errors. Evaluation with no arguments, `--list`, and `--list --live` each lists six scenarios without provider calls; no real key or billable requests were used for this change.
- Evaluation `--list` lists six synthetic scenarios without provider calls, including when combined with `--live`.
- Historical validation: a live Muse Spark 1.3 synthetic smoke test returned three validated tasks. Two saved exploratory batches each reported six structurally successful synthetic scenarios. Those historical artifacts lack commit/prompt provenance, so their precise source-to-run binding is unverified; they are not a quality score or evidence of integrated behavior. Manual rubric verdicts were not completed.
- No new live API calls were made for L1-L3. No provider/prompt/production-policy changes were made.

## Ownership and proposed HTTP boundary

- Rofi: Meta API client, prompt, output validation and provider errors.
- Noor: ASP.NET Core host, API orchestration, frontend adapter and persistence.
- Joint: API contract alignment, acceptance/version policy and end-to-end testing.

Proposed route, **not yet agreed or implemented**:

```text
POST /api/opportunities/{opportunityId}/preparation/candidates
Request: Frontend Contract v0.2 PlanCandidateRequest
Success: PlanCandidateOutput
Error: ApiError
```

The candidate wire contract remains `tasks` plus `explanation`. Generation returns a preview; it does not allocate accepted task IDs, change progress or save a plan.

## Wiring and configuration

Reference `NextStep.MetaAi.csproj` from the future backend project and register:

```csharp
builder.Services.AddMetaAiClient(builder.Configuration);
```

Set `MODEL_API_KEY` in the backend environment. Never expose credentials to frontend code or commit them. Optional `MetaAi` settings and current defaults:

| Setting | Default |
|---|---|
| Model | muse-spark-1.3 |
| ChatCompletionsUrl | https://api.meta.ai/v1/chat/completions |
| AttemptTimeoutSeconds | 30 |
| OverallTimeoutSeconds | 60 |
| MaxRetries | 1 |
| MaxRetryDelaySeconds | 5 |
| MaxResponseBytes | 131072 |

The evaluation harness uses its own default `MetaAiOptions` instance plus the environment key; it does not load the host's configuration. See `NextStep.MetaAi.Eval/README.md` for the versioned report envelope and safe provenance fields.

## Server-authoritative context mapping

`PlanGenerationContext` is an internal projection, not the browser's `PlanCandidateRequest`. Do not bind it directly from request JSON. Resolve the authenticated user's opportunity, accepted profile/self-report, submission state, source revision and base plan from authoritative application state.

- Include only reviewed requirements with known applicability (`Applies == true`) in `submission` or `preparation` lanes. Unknown/unverified facts stay unknown. Participation blockers and eligibility decisions belong to the application.
- Map only affirmative reported skills into `ReportedSkills`; a reported lack of skill is a constraint, and unknown competence is not confirmed competence. Accepted experience remains self-report.
- Use a verified submission instant with its offset for `ReviewedSubmissionDeadline`; use null when unknown. Availability is reported weekly capacity, not a one-week limit on task effort.
- Derive both resource collections from the same server-reviewed catalog snapshot. `ReviewedResourceIds` is an allowlist; IDs alone do not convey relevance. Every selectable ID needs a matching `ReviewedResourceInfo` in **`ReviewedResources`**, with a nonblank title (up to 200 characters) and relevance note (up to 1000). Descriptors outside the allowlist are invalid. At most ten unique resources may be attached to each candidate task.
- The provider receives descriptors (ID/title/relevance note), not the bare allowlist or resource URLs. Resolve validated IDs to current reviewed catalog links in the application. Do not manufacture descriptors from browser strings or IDs. Old constructor calls still compile without descriptors, but their bare IDs cannot be selected by v2. Allowlisting does not prove semantic fit.

This synthetic projection illustrates the v2 types; a real mapper must supply current server-owned values and version checks:

```csharp
using NextStep.MetaAi;
using NextStep.MetaAi.Application;

var now = DateTimeOffset.UtcNow;
var resources = new[] {
    new ReviewedResourceInfo("resource-demo", "Demo preparation notes",
        "Reviewed guidance on scripting and recording the prototype demonstration")
};
var existing = new[] {
    new ExistingPlanTask("task-started", "Build prototype", "in_progress",
        new TaskTarget("goal", "goal-demo")),
    new ExistingPlanTask("task-done", "Sketch demo flow", "done",
        new TaskTarget("goal", "goal-demo"))
};
var context = new PlanGenerationContext(
    "synthetic-opportunity", "Prototype demonstration", "reviewed-revision-1", "reviewed-revision-1",
    new[] { new PlanGoal("goal-demo", "Demonstrate the prototype") },
    new[] { new ReviewedRequirement("req-video", "Record and submit a demonstration video",
        "submission", true, true) },
    resources.Select(r => r.Id).ToArray(), 5, now.AddDays(14), false, existing,
    new PlanningProfile(new[] { "Built a small application" }, new[] { "C#" },
        new[] { "Required video is still missing" })) {
    ReviewedResources = resources
};
var retained = new[] {
    new RetainedWork("task-started", "in_progress", 3),
    new RetainedWork("task-done", "done", 0)
};
// After generation: PreparationBudget.Evaluate(5, context.ReviewedSubmissionDeadline,
//     evaluationInstant, candidate, retained);
// Outstanding final submission actions must also be reconciled by the application
// using its current evidence and explicit acceptance retention decision (see below).
```

## Retained work, feasibility and mandatory submission limits

The application must decide which accepted tasks survive regeneration, including artifact-bearing unstarted work, and preserve IDs, artifacts, status and remaining effort. Project their actual status; do not relabel unstarted tasks to activate a guard. The current client only rejects exact-title duplicates of `in_progress`/`done` work. It does not prevent semantic duplicates or protect every artifact-retained task at acceptance.

`ExistingPlanTask` has no remaining-effort field. Pass the actual retained records separately to `PreparationBudget.Evaluate`, count each once, and use zero remaining effort for completed work. The optional helper sums new and retained effort without shrinking estimates; unknown timing stays untimed. Its fixed one-minute effort tolerance can mask a small shortfall near cutoff and differs from the inspected frontend's policy. Agree a shared evaluation instant and policy with Noor before presenting authoritative feasibility. Map helper output deliberately: the frontend's `PlanBudget` shape differs, with feasibility on the plan. Evaluation reports exclude retained hours and therefore provide only a diagnostic for new candidate effort.

**Mandatory final submission handling remains an application responsibility.** v2 can accept a structurally valid candidate that omits an outstanding required action or stops at a ready-to-submit file. Applicability/mandatory flags do not establish which actions remain outstanding, and task `done` is not organizer receipt evidence. The optional helper below reports task representation for the application to handle. Acceptance and submission-evidence handling remain pending; no v3 mandatory-submission regex guard is present. Generated criteria and prose are draft instructions, not proof of submission, eligibility or factual correctness.

## Reviewed outstanding submission coverage

`NextStep.MetaAi.Application.SubmissionCoverage.Reconcile` is a pure, deterministic, provider-free helper. It is not called by the provider client or `GenerationPolicy`, does not reject generation for omissions, and leaves `PlanCandidateOutput`, prompts, retries and existing APIs unchanged. No dependency, configuration or DI registration is needed.

Pass three separate server-owned projections from one coherent snapshot:

1. `reviewedOutstandingMandatoryRequirements`: only reviewed, applicable (`Applies == true`), mandatory `submission` requirements that the application has determined are still outstanding from authoritative evidence. `ReviewedRequirement` itself has no outstanding/review-evidence field; its name and flags do not establish that evidence. Do not pass all requirements from generation context without this application-owned selection.
2. `validatedCandidateTasks`: tasks that have already passed candidate validation for that snapshot. The helper is not a substitute for `GenerationPolicy.ValidateCandidate` and does not revalidate prose, effort, resources or priority.
3. `explicitlyRetainedTasks`: only accepted-plan task records the application has decided will survive acceptance. This is a separate list of `ExistingPlanTask`, **not all `context.ExistingTasks`**. Unstarted tasks may be discarded. Preserve task identity/status; do not infer retention from status or alter status to obtain coverage.

The optional fourth argument is `SubmissionSourceCoverage.Unknown` (default), `Incomplete` or `Complete`. This is the application's assessment of the submission requirement sources, passed through unchanged. Never derive it from the number of tasks, an empty reviewed set or an empty omission list. Unknown/incomplete source coverage stays unknown/incomplete even when every supplied requirement ID has a task. The helper cannot discover missing organizer requirements or verify the caller's completeness assertion.

Example inside application orchestration, after generating a validated candidate and deciding retention:

```csharp
// These inputs come from authoritative application evidence/acceptance policy.
// reviewedOutstandingMandatoryRequirements: IReadOnlyList<ReviewedRequirement>
// tasksToRetainOnAcceptance: IReadOnlyList<ExistingPlanTask>
var coverage = SubmissionCoverage.Reconcile(
    reviewedOutstandingMandatoryRequirements,
    candidate.Tasks,
    tasksToRetainOnAcceptance,
    SubmissionSourceCoverage.Unknown);
// Surface coverage.UnrepresentedRequirementIds for application handling.
// Recompute at acceptance after rechecking versions, evidence and retention.
```

`SubmissionCoverageReport` returns:

| Field | Meaning |
|---|---|
| `ReviewedOutstandingMandatoryRequirementIds` | The supplied reviewed outstanding mandatory submission set |
| `CandidateRequirementIds` | IDs in that set directly targeted by candidate tasks |
| `RetainedRequirementIds` | IDs in that set directly targeted by explicitly retained tasks |
| `UnrepresentedRequirementIds` | Reviewed outstanding IDs represented by neither task collection |
| `SourceCoverage` | The caller-supplied source assessment, unchanged |

All ID lists are independent read-only snapshots, deduplicated and sorted using ordinal comparison. Matching is exact and case-sensitive, with no trimming, title/prose matching, keyword heuristics or model calls. Only unambiguous `kind: requirement` targets with `requirementId` count; goal targets never count, even if a goal ID has the same text. Targets outside the supplied outstanding set are excluded. An ID represented in both task collections appears in both lists and is removed from omissions once. Duplicate targets do not multiply coverage. Malformed projection/target inputs produce `invalid_input`; missing actions are ordinary report data, never `invalid_model_output`.

There is no six-requirement cap or report truncation. Generation still returns at most six tasks. Eight outstanding requirements with six different candidate targets can leave two explicitly reported omissions; retained tasks may represent either of those IDs. Noor's application decides how to surface omissions or add server-owned checklist/actions without changing the model's wire contract or silently dropping required work to fit a task limit or budget.

**Representation is not fulfillment.** A task targeting a requirement can still contain only preparation work. A retained task with status `done` represents its target but does not remove the requirement from the reviewed outstanding list or establish organizer receipt, eligibility, verification or compliance. Even with `SourceCoverage.Complete` and no unrepresented IDs, this report establishes only task representation of the supplied set. It exposes no checklist-complete or submission-success verdict. The application continues to own outstanding/completed evidence, eligibility and source review, candidate acceptance, persistence and frontend presentation. Keep budget `no_remaining_gap` separate from these submission facts.

Before integration, agree with Noor on the authoritative evidence-to-outstanding projection and stable ID lifecycle; source-completeness assessment; actual retention decision; omission handling/presentation; and whether/how to expose this internal report through HTTP. No HTTP response fields or persisted schema are added here. Recheck relevant source/submission/base-plan versions and recompute coverage at acceptance; this standalone helper cannot make that transaction atomic.

## Generation, explicit acceptance and version checks

1. Authorize access and capture one coherent opportunity/source, profile, submission, base-plan and resource-review snapshot. Compare browser expected versions with authoritative versions before generation. The client itself only compares `SourceRevision` with `ExpectedSourceRevision`.
2. Evaluate participation blockers, project reviewed context and invoke `GenerateCandidateAsync` with request-abort cancellation.
3. Recheck all relevant versions, reviewed facts, resources and cutoff after generation, before returning the preview. Report coverage against an explicit proposed retention selection and current outstanding requirements. Map standardized errors; no candidate persistence during generation.
4. On **explicit user acceptance**, authorize again and recheck current versions/facts/cutoff. Recompute submission coverage using the actual retention decision and current evidence; handle omissions explicitly. Reconcile the complete remaining-effort budget. Allocate task IDs/status in application code.
5. Persist atomically with base-version/concurrency checks and idempotency for acceptance retries. Preserve existing progress/artifacts, then verify persisted readback and frontend rendering.

## Remaining integration dependencies

- Agree the HTTP endpoint and actual v0.2 request/error serialization with Noor.
- Implement the ASP.NET host/orchestration and server-authoritative mapper.
- Connect the frontend `PreparationService` HTTP adapter; the inspected frontend uses a mock service.
- Implement acceptance, authorization, persistence, idempotency and post-generation/acceptance version checks.
- Reconcile mandatory actions/evidence, retained artifacts/effort and frontend/.NET budget policy.
- Run cross-language contract, conflict/error, persistence and full frontend-to-backend tests with synthetic data.

None of those application paths is implemented by this client cleanup. Independent library validation does not establish end-to-end integration or production readiness.
