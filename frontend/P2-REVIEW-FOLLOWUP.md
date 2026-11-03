# P2 independent-review follow-up

This branch targets PR #32 at `40f663b`, not main or the current #30 application. It addresses the three independently reproduced review findings without changing provider requests, the shared contract, database migrations or acceptance/progress storage.

- The English and Arabic disclosure distinguishes excluded structured fields from shared free text. It explicitly asks students to review text that may contain personal information; it makes no automatic redaction guarantee.
- Production error capture emits an allowlisted error name, a generic diagnostic and a valid HTTP status only. It does not traverse causes, serialize arbitrary objects or preserve request/error text. Production console.error arguments use that same boundary, including plain objects. Vite's production flag covers browser builds; local development retains detailed errors for debugging.
- Acknowledgment status and withdrawal remain visible in setup, accepted-plan workspaces and candidate review. Storage confirmation updates the account-scoped status; pending/failed withdrawal never shows success. Retry clears the previous error. Withdrawing does not discard a candidate, erase an accepted plan or restart generation.

Withdrawal blocks future provider requests through the existing backend policy. It does not recall information already sent or cancel a provider request that has already begun. These changes do not claim to solve the combined migration/UserState integration, per-document extraction consent, or live-provider compatibility gates.

Validation: 168 frontend tests across 34 files, TypeScript, changed-file lint, canonical fixture validation and production build. All test inputs are synthetic; no live provider call was used. The unchanged P2 backend/AI baseline was independently verified in the preceding review (104 MySQL checks and 285 AI checks); it is not represented as a new combined-branch run.
