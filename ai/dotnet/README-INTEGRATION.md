# NextStep Meta AI - Backend Integration

Status: the v2 client is integrated into the ASP.NET Core application and normal frontend preparation flow. Rofi independently verified the live browser-to-Meta-to-MySQL happy path at application commit 98cbea1. This is completed integration evidence for that revision, not unconditional approval of the full stack or production readiness.

## Verification boundary (updated 2026-10-29)

- Reviewed client baseline: PR #10 at `aa9779a`; the six core client files match the independently tested PR #14 composition.
- .NET SDK 8.0.427: library, offline checks and evaluation harness build with zero warnings/errors.
- Latest offline execution: **123 passed, 0 failed, 123 total** (109 baseline cases, two direct resource-policy boundary cases and 12 evaluation-report/provenance cases). The existing eleven-resource case now supplies valid descriptors.
- Evaluation `--list` lists six synthetic scenarios without provider calls, including when combined with `--live`.
- Historical validation: a live Muse Spark 1.3 synthetic smoke test returned three validated tasks. Two saved exploratory batches each reported six structurally successful synthetic scenarios. Those historical artifacts lack commit/prompt provenance, so their precise source-to-run binding is unverified; they are not a quality score or evidence of integrated behavior. Manual rubric verdicts were not completed.
- No new live API calls were made for L1-L3. No provider/prompt/production-policy changes were made.

## Completed application integration evidence

- Rofi's [live E2E verification at 98cbea1](https://github.com/NOOROWAISSI/meta-ai-hackathon-2026/pull/8#issuecomment-6478858507): four tasks generated through the real browser, X-Candidate-Id returned without auto-acceptance, explicit acceptance stored plan version 1, task progress stored version 2, and both survived reload. Submission evidence stayed unchanged. One generation attempt with runtime MaxRetries=0 was reported; raw upstream response/billing-ledger verification was not claimed.
- Rofi's [independent PR #14 review at 3785995](https://github.com/NOOROWAISSI/meta-ai-hackathon-2026/pull/14#issuecomment-6488300285): 71 frontend tests, 37 app-only real-MySQL checks, 157 client/helper checks, TypeScript, production build and zero-vulnerability audits passed. Browser/API review covered coverage metadata, uncertainty, progress, reload and backend-failure recovery. No new live Meta call was claimed for this composition.
- The standalone #10 offline suite has 123 checks; 157 includes the separate #12 helper. These counts are not interchangeable. [Final client source review](https://github.com/NOOROWAISSI/meta-ai-hackathon-2026/pull/10#issuecomment-6488929588) found no P0/P1 client defects and requested this documentation handoff.

## Implemented ownership and HTTP boundary

- Rofi: Meta API client, prompt, output validation and provider errors.
- Noor: ASP.NET Core host, API orchestration, frontend adapter and persistence.
- Joint: API contract alignment, acceptance/version policy and end-to-end testing.

The application in PR #8/#14 implements:

```text
POST /api/opportunities/{opportunityId}/plan-candidates
Alias: POST /api/opportunities/{opportunityId}/preparation/candidates
Request: application AnalysisRequest { expectedSourceRevision, profile, submission, previousPlan? }
Success body: PlanCandidateOutput { tasks, explanation }
Success header: X-Candidate-Id (server-owned expiring candidate identifier)
Error body: ApiError { code, message, requestId, retryable, fieldErrors? }

POST /api/plans/{opportunityId}/accept
Request: { candidateId, expectedPlanVersion, operationId }
Success: canonical Plan after confirmed atomic storage

PATCH /api/plans/{opportunityId}/tasks/{taskId}
Request: { expectedVersion, status, operationId, artifactUrls? }
Success: updated canonical Plan after storage; GET /api/plans reads confirmed plans
```

The browser sends saved snapshot copies; the application validates them against owner-scoped authoritative state and constructs PlanGenerationContext itself. It does not bind internal provider context from browser input. Writes use the application's session and X-NextStep-Request header; stale context/version checks return 409. No live endpoint is implemented by the standalone client library itself.

Generation validates output and may persist an expiring candidate, but never accepts a plan, allocates accepted task IDs, or changes progress. The application returns X-Candidate-Id. Acceptance accepts only this ID plus expected version and idempotency receipt, rechecks current context and commits atomically. The model never assigns authoritative task IDs or eligibility status.

PR #14 adds an owner-scoped, read-only companion coverage report at GET /api/submissions/{id}/coverage?candidateId={optional}; its application metadata is documented in backend/SUBMISSION-COVERAGE-INTEGRATION.md on that branch. It does not extend PlanCandidateOutput or the acceptance request.

## Wiring and configuration

The existing `backend/NextStep.Api` references `NextStep.MetaAi.csproj` and registers:

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
// Missing final submission actions must also be reconciled by the application.
```

## Retained work, feasibility and mandatory submission limits

The application must decide which accepted tasks survive regeneration, including artifact-bearing unstarted work, and preserve IDs, artifacts, status and remaining effort. Project their actual status; do not relabel unstarted tasks to activate a guard. The current client only rejects exact-title duplicates of `in_progress`/`done` work. It does not prevent semantic duplicates or protect every artifact-retained task at acceptance.

`ExistingPlanTask` has no remaining-effort field. Pass the actual retained records separately to `PreparationBudget.Evaluate`, count each once, and use zero remaining effort for completed work. The optional helper sums new and retained effort without shrinking estimates; unknown timing stays untimed. Its fixed one-minute effort tolerance can mask a small shortfall near cutoff. The application uses the server helper and projects its result to the frontend; retain the shared server evaluation policy and reviewed instant when evolving this behavior. Map helper output deliberately: the frontend's `PlanBudget` shape differs, with feasibility on the plan. Evaluation reports exclude retained hours and therefore provide only a diagnostic for new candidate effort.

**Mandatory final submission handling remains an application responsibility.** v2 can accept a structurally valid candidate that omits an outstanding required action or stops at a ready-to-submit file. Applicability/mandatory flags do not establish which actions remain outstanding, and task `done` is not organizer receipt evidence. Reconcile outstanding actions against current submission evidence and retained work, and surface uncovered actions or use a server-owned final-action checklist/task. The pure helper in #12 and its application integration in #14 address representation and explicit omissions under review; no v3 mandatory-submission regex guard is present. Generated criteria and prose are draft instructions, not proof of submission, eligibility or factual correctness.

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
3. Recheck all relevant versions, reviewed facts, resources and cutoff after generation, before returning the preview. Map standardized errors; the application can store an expiring candidate and return its identifier, but no accepted plan/progress is committed during generation.
4. On **explicit user acceptance**, authorize again and recheck current versions/facts/cutoff. Reconcile retained tasks, mandatory final actions and the complete remaining-effort budget. Allocate task IDs/status in application code.
5. Persist atomically with base-version/concurrency checks and idempotency for acceptance retries. Preserve existing progress/artifacts, then verify persisted readback and frontend rendering.

## Final handoff and remaining review

The browser adapter, ASP.NET orchestration, reviewed-resource projection, explicit acceptance, MySQL persistence, idempotency and context/version checks are implemented in the application review branches. Ownership remains: Rofi owns provider calls/prompts/validation; Noor owns account-scoped application state, API projection and frontend behavior. The candidate contract and application-owned acceptance boundary above are the implemented handoff.

- Resolve and independently review PR #14's separate Rolldown/Vite compatibility finding; no new live Meta request is required for that dependency-only fix.
- Review the #12 helper/#14 evidence mapping, companion metadata contract, retention and uncertainty handling before approving their integration into the review branch.
- Merge approval for #10, #12, #8 and #14 and the dependency stack into main remains separate. Historical/live verification is evidence, not permission to bypass review.
- Keep search/translation #11 in Draft until the core integration is stable. If adopted, share provider transport/configuration/errors, preserve canonical IDs/revisions/uncertainty and run focused live search/Arabic-quality checks. No live search/translation approval is claimed.
- Production operations, secrets setup, source curation and broader quality evaluation remain separate from the tested synthetic happy path.
