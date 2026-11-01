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

## Decision-focused comparison revision

The current comparison leads with a recommendation: `recommended`, `prepare_first`, `already_covered`, `not_aligned`, or `needs_clarification`. Each result states its reason, incremental learning value and one next action, with profile evidence IDs. Detailed transfer/gap reasoning is expandable, with at most three meaningful points per group, two decisive questions and three preparation priorities. These are learning recommendations, not eligibility decisions or global proficiency scores.

The model receives confirmed source facts with their supporting passages, plus explicit `hours_per_week` units for the typed availability fact. Imported sources awaiting student confirmation are disclosed rather than silently treated as established experience. Skill labels alone cannot justify an already-covered recommendation; a missing skill label cannot justify a confirmed deficit. Unknown experience stays unknown. Concrete work can support a topic-specific judgment without claiming independently verified competence.

`ReviewedLearningOutlines` adds organizer-reviewed content for CS50 Python, SQL, Web and Google's ML Crash Course, checked 2026-11-01. Sources: https://cs50.harvard.edu/python/, https://cs50.harvard.edu/sql/, https://cs50.harvard.edu/web/, https://developers.google.com/machine-learning/crash-course/prereqs-and-prework. The comparison uses these published outcomes and starting-point notes rather than extrapolating a syllabus from tags. An introductory course that teaches foundations does not require learning those same foundations first. A topic may partially overlap with an existing project without the entire course being redundant. Missing outlines remain missing.

`POST /api/listings/{id}/comparison-answer` explicitly confirms a short answer to a question from the current saved comparison. It binds to the selected opportunity/source revision, preserves plans and progress, increments the canonical profile version, supports identical retries and makes the old explanation outdated. The next explicit comparison receives that answer; confirmation itself makes no model request. Answers to unrelated/older opportunity contexts do not enter the new comparison.

Comparisons use `analysisVersion: 2`; saved older prose remains visible but outdated until the student explicitly updates it. There is no automatic regeneration or deletion of progress. Local validation covers source-grounded recommendation guards, known weekly-hour units, supporting quotations, course foundation distinctions, inline answer confirmation, idempotency and stale-context rejection. No live Meta request or real student document is used in these tests. New rich decision semantics still need synthetic live-provider review with Rofi before merge.

## Professional profile evidence

The profile evidence workspace extends the same explicit-confirmation boundary with source-backed CV, selected public GitHub, and LinkedIn information:

- A signed-in student may upload a PDF or DOCX (maximum 5 MB), paste professional text, or attach a LinkedIn profile URL as provenance. A LinkedIn URL alone is never fetched; students must paste or upload the professional information they want analyzed.
- GitHub imports are restricted to one selected public repository. The backend snapshots a bounded set of README/code files at a commit SHA, excludes common generated/dependency/secret paths, and never executes imported code. A repository does not establish who authored its contents.
- Only extracted text is persisted; the uploaded binary is discarded. Sources are private to the owning account and may be deleted. Deleting a source removes its stored quotations, but leaves facts the student previously confirmed and existing plan progress intact.
- The student reviews selected sources and explicitly consents before Meta proposes facts. Proposals must cite exact passages from selected sources and remain drafts until the student edits/selects them. A project requires a personal-contribution description before acceptance.
- Accepted facts enter the existing profile/planning contract as student-confirmed information. Opportunity comparison requires separate consent and sends current professional facts/contributions (including manually entered skills, projects and background), reported availability, goals, practical constraints and participation preferences, plus the selected published opportunity. It does not send raw source documents/quotations or identity/contact fields. It is an explanation, not a verified-skill or eligibility decision.
- Source/profile versions reject stale analysis and edits. Source reads do not increment the shared account revision. The companion `profile_evidence` table is migration 6; existing plan and submission records are not replaced.

Evidence endpoints are authenticated: `GET /api/profile/evidence`, `POST /api/profile/evidence/text`, `POST /api/profile/evidence/upload`, `GET/POST /api/profile/evidence/github`, `POST /api/profile/evidence/analyze`, `POST /api/profile/evidence/accept`, `DELETE /api/profile/evidence/{id}`, and `POST /api/listings/{id}/evidence-comparison`.

The LinkedIn workflow is user-provided text/document only. Reading full LinkedIn profiles requires permissions and API access this app does not have; do not imply that pasting a profile URL grants that access.

### Scope and validation boundary

This feature is an explicitly requested extension to the earlier MVP restriction against CV upload. It does not change the shared v0.2 `StudentProfile`, eligibility statuses, task statuses or plan schema. Companion provenance lives in migration 6 in the existing MySQL authority. No alternative browser profile/plan store is introduced.

The normal opportunity UI uses the new evidence comparison, rather than the four-way starting-point selector. The earlier briefing endpoint remains backward-compatible for existing clients. No model call runs on page load, source import, profile save or source deletion. Source analysis and opportunity comparison each require a deliberate request and explicit consent.

PDFs must contain readable text; scanned/encrypted/unreadable documents need a text PDF, DOCX or pasted text. DOCX parsing rejects external XML entities, macro payloads and oversized archives. GitHub supports public repositories only, up to 30 listed repositories and a bounded 10-file sample; reimport to obtain a newer commit snapshot. Only extracted text is stored. Contact/identity/secret redaction is best-effort, so students must inspect the selected text before consent.

Exact-quotation and reference validation checks provenance, not semantic truth. Student confirmation does not independently prove authorship or competence. Rich generated prose needs a new synthetic live-provider compatibility and semantic-quality review with Rofi before merge; the previous closed-vocabulary briefing results cannot validate this new model interface. The owner requested local tests only, so no live Meta request or real student CV was used for this feature.

Comparisons are persisted per opportunity/language in the private evidence workspace (maximum 12). `GET /api/listings/{id}/evidence-comparison?language=en|ar` restores a prior result without a model call and marks it outdated if the saved profile, sources or opportunity revision changed. A failed or late generation does not overwrite the previous result.

Local validation: 110/110 ASP.NET/MySQL checks, including PDF/DOCX extraction, pinned GitHub transport fixtures, consent, fabricated quotations, owner isolation, idempotent acceptance, atomic rollback, stale response rejection, cached comparison freshness, canonical planning projection and retained Done progress. Frontend: 164/164 tests, TypeScript, changed-file lint, canonical fixture validation and production build. Browser: actual synthetic DOCX upload -> private MySQL source -> extraction via local adapter -> student contribution confirmation -> canonical profile -> reload -> selected real event comparison, with English/Arabic and a 390px viewport; disposable accounts removed afterward. Browser results are synthetic provider evidence, not a Meta quality assessment. The scheduled production collector is stopped during the integration suite because its shared advisory lock can legitimately cause collection fixtures to skip a run.
