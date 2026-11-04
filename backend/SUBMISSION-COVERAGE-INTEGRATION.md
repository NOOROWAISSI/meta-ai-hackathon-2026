# Submission coverage integration

This application integration consumes Rofi's PR #12 helper unchanged (83d2a21). It does not change provider prompts, candidate wire output, acceptance input, canonical Plan, or task statuses.

## Application projection

`SubmissionReconciliation.Assess` selects mandatory submission rules from the current server snapshot. Rules require reviewed evidence, confirmed applicability and a supported evaluator interpretation. Supported/not-applicable criteria are excluded from outstanding work. Unknown submission facts remain outstanding and unknown, never confirmed failures. Unknown applicability, stale/conflicting/unresolved source rules stay visible separately.

The shared `Retain` policy preserves started/Done tasks and tasks with artifact links. Other unstarted tasks may be replaced. Generation preview and acceptance use this exact policy. Task status does not establish criterion fulfillment or organizer receipt.

Source coverage is mapped independently. Complete requires explicit reviewed source coverage and its evidence/IDs, not an empty omission set. Coverage does not determine participation or submission success.

## Transactions and HTTP

Generation validates the candidate and reconciles after checking current context/base version inside the owner transaction. Acceptance validates context/base versions, recomputes against current evidence and actual retained tasks in the same transaction, and atomically stores the plan, coverage warnings and idempotency receipt. Omissions do not reject otherwise valid candidates or invent model tasks.

The application-only companion read endpoint is `GET /api/submissions/{opportunityId}/coverage?candidateId={optional}`. It is owner-scoped, requires an existing session and does not change state. Candidate lookup checks ownership, opportunity, expiry, context and base plan version. Without a candidate it reports against current evidence and confirmed plan tasks; an outdated plan is labeled.

The response includes `context`, `planVersion`, `candidateId`, `planOutdated`, `report` and `unresolvedRequirementIds`. `report` contains Rofi's five report fields using camelCase, with sourceCoverage as unknown/incomplete/complete. This is separate application metadata for review, not a new model output or replacement contract. No additional persisted schema is needed.

The UI waits for matching candidate coverage before accepting. Report failures/stale context preserve the candidate and existing plan. The separate submission checklist distinguishes candidate representation, retained representation, omissions and unresolved sources. Progress never writes submission evidence.

## Validation scope

Regression cases cover partial criteria; unknown applicability; stale/conflicting rules; retained Done tasks and artifact identity; omission handling; private and cross-account candidate access; changed submission evidence; old source revisions; competing acceptances; and preserving source uncertainty even with zero omissions. Existing tests cover competing task writers, transaction rollback and late model responses.

Browser verification uses the real API/MySQL for the report, reload and mobile presentation. Provider replacement exists only in backend tests. Rofi's previous live browser-to-Meta verification applies to 98cbea1, not this updated revision. The local runtime lacks a provider key; no new live generation is claimed. Main remains unmerged pending review.
