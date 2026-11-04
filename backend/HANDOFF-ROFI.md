# Rofi integration review request

## Ownership and dependency

Noor owns the frontend, application API, accounts and MySQL. Rofi owns Meta calls, prompts and model-output quality, including proposed search/translation. Contracts are agreed together. The application PR is stacked on feat/aspnet-meta-ai-client / PR #10. Original provider code remains unchanged at 1788d39. Do not merge the stack into main before reviewing this dependency.

## Preparation integration

Services/Application.cs constructs trusted PlanGenerationContext, checks profile/submission/source/plan versions and calls IMetaModelClient.GenerateCandidateAsync. Candidate output is validated and late responses are rejected after context/progress changes. The application owns stored drafts, task IDs, explicit acceptance, transaction commits, receipts and confirmed progress.

- POST /api/opportunities/{id}/plan-candidates (also preparation/candidates): candidate body PlanCandidateOutput, application header X-Candidate-Id.
- POST /api/plans/{opportunityId}/accept: candidateId, expectedPlanVersion, operationId. Acceptance checks confirmed context again.
- Status remains not_started / in_progress / done. Done preserves estimates and does not confirm submission compliance.
- Confirmed participation blockers, closed reliable submission windows and zero capacity stop generation. Unknown/conflicting deadlines remain untimed.

## Requested review

1. Confirm request/response DTOs, candidate header, error envelope and version/context behavior against your provider.
2. Review trusted-input projection and candidate validation, especially unknown coverage, resource IDs and budgets.
3. Run a synthetic live preparation call with a server-side key, then verify frontend/API/provider/storage together. Offline checks do not establish live compatibility.
4. Review the separate Meta search/translation proposal; adopt, revise or replace its prompts/client code under your ownership. It is not another approved AI module.

## Additional proposed contracts, outside the app-only PR

Search: one registered source per explicit request; only real web_search_call.results are stored as untrusted pending-review links. No model-only claims or automatic publication. Public indexed social results do not imply Graph API access or complete coverage.

Display translation: proposed POST /api/localization/catalog input {language}; output {language, sourceRevision, translationKind, items:[{id,title,summary,verificationNote}]}. IDs must match the source snapshot. Canonical facts and passages are unchanged, AI output is labelled, and failures preserve originals. The frontend flag stays off until agreed.

## Validation and limits

Application-only: 24 real-MySQL integration checks with test-only model/mail replacements. Frontend publication checks cover tests, TypeScript and production build. The proposal adds five isolated search/translation checks. Live Gmail, Google and Meta remain unverified. Legacy browser-demo adapters are not fully replaced; source JSON is not an opportunity-table seed. Conditional adjustment and production operations remain pending.

## Account integration follow-up - 28 October 2026

The publishing checkout now passes 27 app-only MySQL checks (the five search/translation checks remain in the separate proposal). Normal frontend routes use account APIs for profile metadata and canonical facts, atomic saved/hidden preferences, candidate acceptance, and task progress. The established stacked collections and galaxy/My Fit design remain in place.

The server projects current reviewed resource IDs and descriptors into the existing provider context. Submission checks remain separate and uncovered mandatory targets are visible. This does not replace Rofi's draft deterministic reconciliation work in PR #12; alignment with that policy remains a joint review item.

Rofi's live backend verification at f541c77 is acknowledged. The updated full browser-to-live-Meta journey is not claimed as passed: local checks use test-only provider replacements and the local runtime reports missing Meta configuration. Source-backed personal AI briefing and search/translation are still separate integration work. npm audit findings remain open for compatibility-tested triage.

Frontend changes have a separate integration PR targeting noor. Main must wait for the dependency review and remaining checks; merging the frontend into noor is not approval of the full stack.