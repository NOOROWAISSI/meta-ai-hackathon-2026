# Personal explanations and event-scoped profile facts

## Application endpoint

`POST /api/listings/{id}/briefing` requires an authenticated account and the existing same-origin write header. Body: `{ "context": { "opportunityId", "profileId", "profileVersion", "sourceRevision", "language" } }`, with language `en` or `ar`.

This implements the existing display-only `BriefingContext` frontend boundary. Its source revision serializes the selected listing plus the canonical planning-source revision. It is not a replacement for the shared v0.2 `AssessmentContext` or an eligibility assessment. The service reads the current account/profile and selected event from the server, rejects mismatched contexts before generation, and checks them again before accepting a late response.

Output contains the same four explanation sections, the echoed context, application-attached original source links, and an explicit generated timestamp. A new app-side `IPersonalBriefingModel` adapter uses the existing server `MetaAiOptions` and approved Chat Completions endpoint; the shared `ai/dotnet` plan client and DTOs are unchanged. The adapter sends a structured JSON schema with bounded response size/time, disables redirects, and does not expose provider errors or credentials. Invalid shape, model-supplied URLs and common unsupported eligibility/guarantee claims are rejected. This is a basic output guard, not a guarantee of semantic model accuracy; the UI labels AI output and links the sources.

Only a bounded subset of confirmed self-reported study field, interests, skills, goals, background, project descriptions, constraints and availability is sent. Deterministic participation-check results provide context without sending raw age, residence, display name, photos, passwords or email. All strings are untrusted data. No generated explanation becomes a profile fact, submission item, task or accepted plan.

A bounded 20-minute/40-entry server memory cache avoids repeated model requests for the same account/source/profile/language context. This is a derivative cache, not an additional authoritative persistence store; MySQL remains authoritative. The frontend requests generation deliberately, ignores old contexts and removes private explanation queries on account changes. Opening details alone does not issue a model request.

## Conditional age inputs

The Profile route resolves the selected event's reviewed participation conditions. Age in whole years is optional and appears only for a reviewed minimum-age check; legal-majority confirmation appears only for a reviewed majority condition. Stale/unreviewed or unresolved interpretations do not create new collection requirements. No birth date or document upload is added.

Values use existing canonical `reportedAge` and `majority` known/unknown facts. Blank stays unknown; `false` stays an explicit answer. Legal-majority confirmation is scoped to the student's explicitly selected residence; it is never inferred from numeric age or transferred to a new country. Unchanged facts/timestamps are preserved. Explicit Save and existing profile-version checks apply. Plans/progress are not erased by profile changes, and incomplete source coverage still prevents an overall eligibility claim.

The new optional form metadata is additive; deploy the backend's editor validation before the corresponding frontend.

## Key setup deliberately deferred

The owner confirmed the Meta key is still with Rofi. No key was provisioned, copied, committed or requested in chat, and no live Meta call was made. The local missing-key case fails explicitly and keeps profile/plans unchanged.

When the key is available, run the existing hidden-input helper locally:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File backend/Setup-Meta.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File backend/Setup-Meta.ps1 -Check
```

Restart the API afterward. Both plan generation and explanations use that server-side configuration. Production uses secret configuration such as `MetaAi__ApiKey`; never use a frontend/Vite variable for a provider key. Key presence/health is not live provider verification.

## Verification

- Backend: 72/72 real-MySQL checks with synthetic provider/HTTP handlers, including owner/source isolation, cache reuse, late responses, invalid output, missing-key zero-network behavior, profile persistence and jurisdiction mismatch.
- Frontend: 152/152 tests, TypeScript, canonical fixture validation and production build.
- Disposable-account browser: actual form age/majority Save -> MySQL -> reload; selected-event explanation through the backend -> original source links; no implicit plan creation; reviewed resources and separate registration timing; 390px layout. Explanation output was synthetic. Temporary test accounts were deleted.
- Live provider quality, actual organizer participation and the final merged-branch test remain separate.
