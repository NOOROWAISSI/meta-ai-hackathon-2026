# NextStep Meta AI - Backend Integration

Status: the standalone v2 client is validated independently; frontend/backend integration is pending. It has not been validated end-to-end and is not production-ready.

## Verification boundary (2026-10-28)

- Baseline: `feat/aspnet-meta-ai-client`, v2 commit `1788d39`; L1-L3 cleanup remains local for review.
- .NET SDK 8.0.427: library, offline checks and evaluation harness build with zero warnings/errors.
- Latest offline execution: **123 passed, 0 failed, 123 total** (109 baseline cases, two direct resource-policy boundary cases and 12 evaluation-report/provenance cases). The existing eleven-resource case now supplies valid descriptors.
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
// Missing final submission actions must also be reconciled by the application.
```

## Retained work, feasibility and mandatory submission limits

The application must decide which accepted tasks survive regeneration, including artifact-bearing unstarted work, and preserve IDs, artifacts, status and remaining effort. Project their actual status; do not relabel unstarted tasks to activate a guard. The current client only rejects exact-title duplicates of `in_progress`/`done` work. It does not prevent semantic duplicates or protect every artifact-retained task at acceptance.

`ExistingPlanTask` has no remaining-effort field. Pass the actual retained records separately to `PreparationBudget.Evaluate`, count each once, and use zero remaining effort for completed work. The optional helper sums new and retained effort without shrinking estimates; unknown timing stays untimed. Its fixed one-minute effort tolerance can mask a small shortfall near cutoff and differs from the inspected frontend's policy. Agree a shared evaluation instant and policy with Noor before presenting authoritative feasibility. Map helper output deliberately: the frontend's `PlanBudget` shape differs, with feasibility on the plan. Evaluation reports exclude retained hours and therefore provide only a diagnostic for new candidate effort.

**Mandatory final submission handling remains an application responsibility.** v2 can accept a structurally valid candidate that omits an outstanding required action or stops at a ready-to-submit file. Applicability/mandatory flags do not establish which actions remain outstanding, and task `done` is not organizer receipt evidence. Reconcile outstanding actions against current submission evidence and retained work, and surface uncovered actions or use a server-owned final-action checklist/task. This workflow is pending; no v3 mandatory-submission regex guard is present. Generated criteria and prose are draft instructions, not proof of submission, eligibility or factual correctness.

## Generation, explicit acceptance and version checks

1. Authorize access and capture one coherent opportunity/source, profile, submission, base-plan and resource-review snapshot. Compare browser expected versions with authoritative versions before generation. The client itself only compares `SourceRevision` with `ExpectedSourceRevision`.
2. Evaluate participation blockers, project reviewed context and invoke `GenerateCandidateAsync` with request-abort cancellation.
3. Recheck all relevant versions, reviewed facts, resources and cutoff after generation, before returning the preview. Map standardized errors; no candidate persistence during generation.
4. On **explicit user acceptance**, authorize again and recheck current versions/facts/cutoff. Reconcile retained tasks, mandatory final actions and the complete remaining-effort budget. Allocate task IDs/status in application code.
5. Persist atomically with base-version/concurrency checks and idempotency for acceptance retries. Preserve existing progress/artifacts, then verify persisted readback and frontend rendering.

## Remaining integration dependencies

- Agree the HTTP endpoint and actual v0.2 request/error serialization with Noor.
- Implement the ASP.NET host/orchestration and server-authoritative mapper.
- Connect the frontend `PreparationService` HTTP adapter; the inspected frontend uses a mock service.
- Implement acceptance, authorization, persistence, idempotency and post-generation/acceptance version checks.
- Reconcile mandatory actions/evidence, retained artifacts/effort and frontend/.NET budget policy.
- Run cross-language contract, conflict/error, persistence and full frontend-to-backend tests with synthetic data.

None of those application paths is implemented by this client cleanup. Independent library validation does not establish end-to-end integration or production readiness.
