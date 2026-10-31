# Preparation & Progress

The new flow preserves the existing Discover, Details, Profile, and galaxy design. Enter from the event's primary preparation action, its Preparation tab, or My Plans. Relevant Profile edits return to the selected event or plan; confirmed progress is retained.

## Contract and boundaries

`src/lib/contract/types.ts` and `sample-payload.json` reproduce the supplied Frontend Contract v0.2 types and Appendix A fixture. Explicit adapters project the existing editable profile and five fictional event records into those types. Missing facts remain unknown. Unverified fictional dates cannot become reliable submission deadlines or eligibility decisions.

`src/lib/preparation/service.ts` is a replaceable mock generation adapter. It returns only candidate fields, never authoritative IDs, progress, eligibility statuses, or source-review metadata. No Meta requests, provider keys, or live endpoint claims are included. Resources resolve through the stored catalog; empty lists are valid and example.org placeholders are never recommended as reviewed resources.

## Storage and versions

`src/lib/storage/database.ts` owns IndexedDB `nextstep-browser`, schema version 1. Profile, saved opportunities, canonical event/submission records, plans, progress, operation receipts, and update metadata use one store. Acceptance and task updates commit in transactions. UI confirmation occurs only after transaction completion. Expected versions and AssessmentContext reject stale writes; operation receipts make retry idempotent. Broadcast notifications trigger reloads across tabs. Presentation settings such as theme/time zone remain local preferences.

Legacy localStorage records are imported atomically, with raw recovery backups retained in IndexedDB. Legacy confirmed task IDs, completion, effort, and artifacts are retained where the event is recognized. Unusable records produce recovery notices. The Storage & recovery control exports a backup and offers an explicitly confirmed reset. It never silently resets data.

Relevant profile/source/submission changes mark the previous plan outdated while preserving its tasks. Generation ignores late responses from older contexts. Refreshing preparation is deliberate; candidates do not replace committed data before acceptance. Started/completed tasks and artifact links survive replacement. Task completion changes preparation progress only.

## Optional features

Disabled by default; configure before starting Vite:

```env
VITE_ENABLE_PLAN_ADJUSTMENT=true
VITE_ENABLE_TASK_ARTIFACTS=true
```

Adjustment previews preserve completed work and check plan/context versions and the unfinished task set before atomic acceptance. The conservative demo adapter does not invent estimate reductions. Artifact links remain self-reported artifacts. Disabled features have no normal-interface controls.

Development-only fixture controls cover unknown/zero availability, conflicting/closed deadlines, infeasible capacity, no-gap output, hard blockers, generation timeout/failure/invalid output, and storage failures. Conditional adjustment controls simulate preview failure and version conflict. Simulated source/capacity scenarios are preview-only and cannot be accepted as published facts. These controls are omitted from production builds.

## Verification

Run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

42 automated tests cover existing screens plus canonical fixture compatibility, known/unknown facts, candidate validation, reliable deadlines, zero/closed/hard-blocked generation, atomic rollback, failed-save retention, idempotent acceptance, competing writers, stale profile/source/submission context, late-response rejection, all-done/no-padding behavior, preserved started/completed tasks and artifacts, adjustment acceptance/conflicts, resource validation, and legacy migration.

An isolated browser journey verified Discover → Details → Profile update → analysis refresh → candidate review → failed acceptance/retry → accepted plan → In progress → Done → failed progress save/retry → refresh with confirmed progress → Details. My Plans excludes unaccepted drafts. Its selector and the embedded Preparation tab open the same confirmed workspace. A 390px mobile viewport has no horizontal overflow. Task drawer screenshots were inspected after the opening transition.

Additional browser checks exercised zero hours, closed submissions, hard blockers, unknown-hours untimed guidance, timeout/failure/invalid generation, and retry/discard. A separate origin with both optional flags enabled verified artifact saving and adjustment preview cancellation, recoverable preview failure, version conflict, and successful acceptance while preserving completed work. Default configuration hides adjustment controls.

Integration remains frontend-only: real source review, backend persistence, and live model generation belong to the future ASP.NET Core service. Fictional source records intentionally produce untimed guidance unless reliable reviewed dates are supplied.
