# Task-specific preparation comparison

The user rejected topic overlap as a proxy for suitability or skill level. An AI tag is no longer a personal-comparison result. The current implementation compares the published challenge with confirmed task-specific self-report, while keeping participation and submission checks separate.

## Data and behavior

The personal briefing includes additive `startingPoint` display metadata: published challenge, a focused question, optional confirmed answer, localized explanation/next action, four options, and quoted owned-profile evidence. This is a companion view, not a replacement canonical profile, plan or eligibility schema.

The existing `StudentProfile.clarificationAnswers` stores an explicitly confirmed value:

- `not_yet`: has not tried similar work; does not imply no general knowledge.
- `guided`: followed a guide/tutorial; try an independent variation.
- `independent`: reports building similar work independently; start by adapting that work, not automatically repeating beginner tutorials.
- `not_sure`: uncertainty remains explicit.

Missing answers remain unknown even when interests or skill tags say AI. A project description is context, not independently verified mastery. No overall suitability, competence percentage or automatic proficiency score is produced. The four paths describe starting approaches; they do not certify that an event is above/below the student's level or override organizer conditions.

The UI displays the actual published challenge and stated goal, with expandable project/experience/skill evidence. Evidence is quoted as the student's own words, not as an AI-authored claim. It offers one focused hands-on question and requires an explicit confirmation button. Failed saves retain the selection and show Retry without false success. Choosing a radio does not save or generate analysis.

## Model and output boundary

The model receives bounded, owned, confirmed profile descriptions/goals/skill notes, the selected published challenge, reviewed preparation/submission statements, reported hours/constraints, and approved localized choices. These free-text inputs are explicitly untrusted data. Account identity, email, passwords, avatar, age and residence fields are not sent. Student-entered text may itself contain personal details; only relevant descriptions should be entered for analysis.

The output remains strict approved IDs. The personal-relevance vocabulary contains only the current confirmed starting-point ID, or the explicit unknown ID; topic-match IDs are no longer offered or accepted. The model cannot create an independent/novice status from arbitrary input prose, write profile facts, or return an eligibility verdict. The server renders the allowed strings. The first visible next step comes from the confirmed answer; additional priorities can be selected using the bounded preparation context.

For plan generation, a confirmed task-specific answer is projected into the existing `PlanningProfile.AcceptedExperience` self-report context. No shared AI wire DTO changed. It is not an organizer requirement or verified competence. Existing mandatory work, resources, capacity/version checks and explicit plan acceptance remain unchanged.

## Storage endpoint and safety

`PUT /api/listings/{id}/starting-point`

```json
{ "context": { "opportunityId": "…", "profileId": "…", "profileVersion": 1, "sourceRevision": "…", "language": "en" }, "questionId": "preparation-start:…", "answer": "independent" }
```

Authenticated account and existing same-origin write header are required. The server verifies the owned profile/version, current selected source and source-bound question ID. It changes only that clarification answer and profile version, atomically in the existing MySQL store. An exact already-confirmed retry can return the confirmed profile without another version increment. A stale different answer returns 409. Unsupported answers are rejected. Existing answers are preserved; the canonical clarification limit is enforced without deleting older facts.

Question IDs bind to opportunity + canonical source revision (or listing summary where no canonical record exists). A changed source requires a new confirmation; it does not silently transfer an old answer. Profile changes invalidate dependent analysis through the existing version context. No accepted plan, task progress, submission item or eligibility status is rewritten by saving this answer.

## Verification and live boundary

- 92/92 API/MySQL/adversarial checks, including same-interest/different-answer paths, unknown/source changes, explicit confirmation, idempotent retry, stale/unsupported/unauthenticated requests, unchanged Done plan/submission evidence, and confirmed experience reaching regeneration context.
- 156/156 frontend tests, including no auto-save and preserved selection after failed save/retry. TypeScript, lint on changed components/service/tests, contract fixtures and production build passed.
- 177/177 shared AI offline checks; shared provider code and wire contracts unchanged.
- Local browser used only a synthetic provider and disposable account: unknown -> independent confirmation -> not-yet correction, controlled failed-save/Retry, explicit re-analysis, different actual actions for the same AI interest, quoted goal/project data, Arabic/390px layout and no implicit plan creation passed. Account removed.

The owner explicitly chose **local tests only** for this revision. No live Meta call was performed for the new raw-description/starting-point flow. Previous topic-selector live evidence does not validate this revised model context. Final live semantic/compatibility review and any combined #28 composition remain separate gates; do not merge #27 or main on the strength of local-provider tests alone.
