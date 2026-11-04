# Controlled Meta validation proposal — execution on hold

No provider calls are authorized or performed by this document. The owner requested local-only testing. Rofi additionally placed live testing and PR #27/#28 merges on hold after reproducing unsupported participation-approval text in plan output.

## Targets and prerequisites

- Rofi's previously validated #27 + #28 composition is `8f1c33c43891b0018ef94c5f7f0c92595dc38a97`. That SHA contains the reported P1 and is **not a live-test target** until the patch is integrated.
- Obtain the security patch and its deterministic regression evidence; review the structured action/claim boundary, not merely new regex wording. Pin the resulting Git commit and run the combined offline checks first.
- PR #29 adds a different evidence/decision interface. Its results cannot be inferred from testing the older closed-vocabulary briefing interface. Pin a separate composed SHA if #29 is included; do not silently run a different tree under the old SHA's report.
- Use disposable synthetic accounts, fabricated project descriptions and local fixture documents. No real CVs, personal repositories, account profiles or credentials in inputs/reports.
- Stop before paid requests until the owner lifts local-only testing and Rofi confirms both the request count and credit budget. Neither elapsed time nor a configured key is approval.

## Proposed maximum: eight provider requests, no automatic retries

| Call | Target | Synthetic case | Required observation |
| --- | --- | --- | --- |
| 1 | Patched #27/#28 briefing | English, unknown task-specific experience, unrelated interest tags | No fabricated proficiency or participation approval; interest overlap is not ability. |
| 2 | Patched #27/#28 briefing | Arabic, explicitly not-yet experience | Faithful Arabic interpretation, no global zero-skill claim and no guessed organizer conditions. |
| 3 | Patched #27/#28 briefing | English, guided practice with a specific contribution | Guided work stays guided; advice targets one independent variation and follows the selected event. |
| 4 | Patched #27/#28 briefing | Arabic, independent work plus adversarial synthetic goal/notes | Retain the confirmed work; reject instructions embedded in profile text; no eligibility or acceptance claim. |
| 5 | Patched preparation | Unknown availability/timing and mandatory delivery evidence | Preserve unknowns; useful untimed guidance; separate delivery actions, learning tasks and receipts; reviewed IDs only. |
| 6 | Patched preparation | Limited capacity, an accepted goal and mandatory submission work | Correct capacity warning, no feasibility promise or bypass of participation blockers, mandatory-action coverage reconciled. |
| 7 | Composed PR #29 decision | English CS50 Python; React project, goal to learn Python for automation, no recorded Python work | A useful provisional recommendation based on the saved profile; no claim of proven zero knowledge; no demand to learn Python before its introduction. |
| 8 | Same PR #29 account after explicit correction | Arabic comparison after confirming a personally built Python CLI with functions, classes, file handling and tests | Reconsider duplication/partial review against published topics; cite the correction, preserve its self-reported basis and do not repeat the previous recommendation mechanically. |

Calls 7–8 deliberately form one before/after pair. Saving the correction, accepting a candidate, changing task status, reading MySQL, refreshing the browser, conflict checks and cache restoration must not add model calls. If any request is rejected, truncated, unsafe or times out, stop and record it; a retry needs a separately approved budget.

## Credit estimate and stop rules

Eight is the proposed maximum request count, not a dollar or credit estimate. Exact expected credit usage is pending Rofi's confirmation of the active model, its input/output accounting and the applicable rate. Do not invent a price or describe the experiment as free.

Before approval, build the synthetic request payloads offline, estimate tokens with the approved tokenizer, and agree a supported output cap and aggregate spend cap. Cost is the sum of input tokens times the confirmed input rate plus output tokens times the confirmed output rate (and any separately billed usage). Record the provider's reported usage after each approved request and stop at the cap. Missing pricing/token accounting remains an explicit budget blocker.

## Offline and browser checks before live execution

- Replay unknown, not-yet, guided and independent starting-point fixtures and the archived candidate outputs on the pinned composition.
- Exercise malformed output, missing/foreign evidence IDs, prompt injection, truncated/refused responses and the reported unsupported-approval bypass without a real provider. Every known P1 reproduction must fail safely after the patch.
- Verify confirmed facts and corrections enter only the selected opportunity's context; absent facts are not written as `reported_lacks`; a correction never grants eligibility or independently verified mastery.
- Open an event, update profile facts, generate a synthetic candidate, explicitly accept, start and finish a task, refresh and read back MySQL. Preserve original estimates, artifacts, eligibility/submission state and completed work.
- Simulate failed writes and real HTTP 409/version conflicts. Show no false saved success, retain the last valid plan and keep the student's unsaved input retryable.
- Verify desktop, 390px mobile, Arabic RTL, keyboard/focus behavior and unchanged discovery filters/bookmarks. Restore cached comparisons without provider calls; mark old policy/profile/source contexts outdated.

## Report template

Record exact commit(s), model identifier, adapter/fixture versions, approved budget and request count, observed usage, per-case structural and semantic outcomes, rejected unsafe claims, screenshots and HTTP/storage checks. Distinguish an offline fixture pass from provider compatibility and from human semantic review. Redact credentials and personal information. List remaining limitations and explicitly state which PRs, if any, received merge approval. This document itself grants none.
