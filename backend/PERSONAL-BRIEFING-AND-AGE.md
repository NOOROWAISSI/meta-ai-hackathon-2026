# Personal explanations and conditional profile facts

## Application endpoint

`POST /api/listings/{id}/briefing` requires an authenticated account and the existing same-origin write header. Body: `{ "context": { "opportunityId", "profileId", "profileVersion", "sourceRevision", "language" } }`, with language `en` or `ar`.

This implements the existing display-only `BriefingContext` frontend boundary. Its source revision serializes the selected listing plus the canonical planning-source revision. It is not a replacement for the shared v0.2 `AssessmentContext` or an eligibility assessment. The service reads the current account/profile and selected event from the server, rejects mismatched contexts before generation, and checks them again before accepting a late response.

The REST output contains the same four explanation sections, the echoed context, application-attached original source links, and an explicit generated timestamp. The app-side `IPersonalBriefingModel` uses existing server `MetaAiOptions` and the approved Chat Completions endpoint; shared `ai/dotnet` plan DTOs and provider behavior are unchanged. Following Rofi's safety integration (`965f4c0`, cherry-picked as `89e8c7e`), the model selects only server-approved IDs through a strict enum JSON schema. The server validates each ID against the selected account/event/language choices and renders the corresponding English/Arabic text. Model prose, unsupported/cross-field IDs, unknown properties and unsupported verdicts cannot become displayed explanation text. The bounded HTTP, no-redirect, sanitized-error and `finish_reason: stop` protections remain.

The topic/interest-only selector has been superseded: interest overlap cannot determine a starting level or suitability. The current comparison reads bounded, owned self-reported goals, project/experience descriptions and skill notes as untrusted preparation context, alongside the selected challenge and reviewed deliverables. The model still returns strict approved IDs; the personal-relevance choices are restricted to the current explicitly confirmed task-specific starting point, or unknown. The server renders the response and quoted self-report evidence is labeled separately. Identity, email, passwords, age and residence fields are not sent.

An explicit question distinguishes not-yet, guided, independent and not-sure experience for this selected challenge. Confirmation uses the existing canonical clarificationAnswers with source/version safety and never changes eligibility or confirmed progress. Confirmed starting-point self-report also reaches plan-generation context. See [Preparation experience comparison](PREPARATION-EXPERIENCE-COMPARISON.md) for the current behavior, endpoint, privacy limits and tests. This is a preparation starting approach, not a proficiency score or a claim that a course/event matches the student's level.
A bounded 20-minute/40-entry server memory cache avoids repeated model requests for the same account/source/profile/language context. This is a derivative cache, not an additional authoritative persistence store; MySQL remains authoritative. The frontend requests generation deliberately, ignores old contexts and removes private explanation queries on account changes. Opening details alone does not issue a model request.

## Conditional age inputs

The Profile route resolves the selected event's reviewed participation conditions. Age in whole years is optional and appears only for a reviewed minimum-age check; legal-majority confirmation appears only for a reviewed majority condition. Stale/unreviewed or unresolved interpretations do not create new collection requirements. No birth date or document upload is added.

Values use existing canonical `reportedAge` and `majority` known/unknown facts. Blank stays unknown; `false` stays an explicit answer. Legal-majority confirmation is scoped to the student's explicitly selected residence; it is never inferred from numeric age or transferred to a new country. Unchanged facts/timestamps are preserved. Explicit Save and existing profile-version checks apply. Plans/progress are not erased by profile changes, and incomplete source coverage still prevents an overall eligibility claim.

The new optional form metadata is additive; deploy the backend's editor validation before the corresponding frontend.

## Private key configuration

Configuration was originally deferred while Rofi held the key. On 31 October 2026, the supplied credential was saved through the existing hidden-input helper into ignored local backend configuration, and live access was verified. No key is included in source, reports or this document. Credential rotation was requested separately after its appearance in chat. The missing-key failure path remains covered and keeps profile/plans unchanged.

For initial setup or a replacement key, run the existing hidden-input helper locally:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File backend/Setup-Meta.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File backend/Setup-Meta.ps1 -Check
```

Restart the API afterward. Both plan generation and explanations use that server-side configuration. Production uses secret configuration such as `MetaAi__ApiKey`; never use a frontend/Vite variable for a provider key. Key presence/health is not live provider verification.

## Verification

- Backend: 92/92 real-MySQL/adversarial checks after safety integration and refinement, including closed-ID/schema rejection, EN/AR unsupported verdicts in every field, owner/cache isolation, stale responses, strict HTTP boundaries, conditional profile facts, and missing-key zero-network behavior. Topic matches require both selected-source and owned-profile evidence; unrelated or hostile custom prose cannot create one.
- Frontend: 156/156 tests, TypeScript, canonical fixture validation and production build.
- Shared AI: 177/177 offline checks and seven evaluation CLI listing/selection/error cases; none uses a live provider. The Windows provenance fixture is run with a process-local Git ceiling so an unrelated home-directory repository cannot affect its non-repository test.
- Disposable-account browser: actual form age/majority Save -> MySQL -> reload; selected-event explanation through the backend -> original source links; no implicit plan creation; reviewed resources and separate registration timing; 390px layout. Explanation output was synthetic. Temporary test accounts were deleted.
- Live checks at code revision `8ebef71`: English UI explanation, Arabic authenticated-backend explanation, context reuse, live candidate generation/acceptance, real MySQL task progress, failed-save Retry, reload, version conflict, unchanged submission evidence, mobile layout and return navigation passed with a disposable synthetic account. The account was deleted. Navigation rate limits were respected before retrying the final navigation.
- The six-scenario live quality run was structurally successful, but qualitative review found an overly conservative empty response for unknown facts. That independent plan-prompt follow-up is isolated in [PR #28](https://github.com/NOOROWAISSI/meta-ai-hackathon-2026/pull/28), with [redacted evidence and qualitative review](https://github.com/NOOROWAISSI/meta-ai-hackathon-2026/blob/0838061/docs/qa/2026-10-31/live-meta-quality/README.md). It is not merged into this branch. Verbose explanations remain a UX limitation.
- Actual organizer participation, repeated-run reliability, review approval and the final eventual merge-SHA smoke are separate from observed live compatibility.
- Updated live gate after the safety change: both English and Arabic were deliberately requested through the actual UI on `5ff26b3`, using the real provider. Approved format/topic summaries and interest matches rendered without internal IDs, Arabic RTL/mobile passed, cache reuse preserved the timestamp, no profile/plan mutation occurred, and a changed profile rejected the old context with 409. The disposable account was removed. [Current evidence and limitations](../docs/qa/2026-10-31/pr27-safe-personalization/README.md) supersede the old head's briefing quality result; the earlier plan E2E is historical and was not rerun in this briefing-only check.

## Live compatibility procedure and remaining review gate

**Current experience-comparison revision: local tests only by explicit owner choice.** The historical live results below predate the new description/starting-point context and must not be treated as its live validation. See PREPARATION-EXPERIENCE-COMPARISON.md.

This branch is based on merged #26 (`noor` at `723fb8f`). The old briefing run at `8ebef71` was preliminary for the safety change; the updated briefing gate was repeated on `5ff26b3`. Keep #27 unmerged pending final review of the current implementation and evidence. The independent #28 plan-prompt change needs its own review and combined verification; these results do not claim that combination has been tested. `main` remains gated.

1. Use a disposable, synthetic signed-in account and a reviewed selected event. Confirm private server configuration without printing it. Do not use real student identity/profile data for quality evaluation.
2. Deliberately request one English and one Arabic personal explanation through the actual frontend/API. Record the tested commit, model name, UTC run time, HTTP outcome, source/profile context and whether the response was generated or cached; exclude keys, cookies and account identifiers from reports.
3. Manually compare every explanation section with the selected event and confirmed synthetic facts. Unknown/conflicting dates and participation conditions must remain unresolved; relevance must not imply eligibility. Check grounding, language, invented links/benefits/skills, preparation usefulness and original-source links. A structurally valid answer is not a quality pass.
4. With explicit authorization for the billable run, rerun the existing synthetic quality scenarios using the evaluation harness's `--live` option. Inspect all mandatory preparation AND delivery actions, critical path and capacity decisions manually. Frozen replay is only regression evidence, not proof the new prompt improves live output.
5. In the authenticated application, generate a candidate, review and explicitly accept it, start and finish a task, reload, and verify MySQL persistence. Exercise stale-context/version-conflict rejection and ensure task completion never changes submission evidence or eligibility. Preserve existing valid progress.
6. Remove only the disposable test account, attach a redacted result with any limitations, obtain review, then repeat the relevant smoke on the eventual GitHub merge SHA. This gate does not authorize a merge into `main`.
