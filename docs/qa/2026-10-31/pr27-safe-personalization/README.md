# PR #27: updated safe-personalization live gate

## Revisions and method

- Rofi integration: `965f4c08b26575937986284c1c88a18201a99172`, cherry-picked into #27 as `89e8c7ecfbde2bef5367565fa6bc0670d1287516`.
- Refinement and current executable code tested: `5ff26b3369f33816cd4b61bee56f3eae9ed87530`.
- Requested model: `muse-spark-1.3`; private configuration; actual Meta provider, ASP.NET test host and real MySQL. No model mock was substituted. Physical upstream attempt counts/provider-side telemetry were not captured.
- Both languages were requested through the actual frontend language toggle and explanation control, not just raw API calls. Only disposable synthetic account data was used. No keys/cookies/account identifiers are in the artifacts; the account was deleted.
- [First integration output](integrated-generic-output.json) and [refined output](refined-live-output.json) include UTC timestamps, exact tested commits and source links. Earlier briefing evidence from `8ebef71` is preliminary and does not certify this implementation.

## Review finding and correction

The P1 fix closes the output vocabulary: Meta returns server-approved IDs, the service validates them and renders EN/AR strings. Transport completion, byte/time, refusal, malformed-output and source/profile-version protections remain intact. IDs cannot assert raw model eligibility prose, and profile-derived IDs belong to the signed-in account.

The first new-head live run passed transport/safety but chose generic instructions in both languages despite supplied AI interest and AI event topic. That was a usefulness limitation, not a clean personalization pass. The independent refinement adds approved compact topic/format summaries and exact interest/topic-match choices. A match requires both selected-source and owned-profile evidence. The prompt and choice order prefer these choices over generic fallbacks. No free-form output, task padding, new skill inference or AI profile write was introduced.

The second live run selected the specific choices in both languages. English described online participation and the published AI topic; relevance said the student reported AI interest and explicitly denied that this established eligibility or experience. Arabic conveyed the same facts and qualifier. Original source links were attached by the app. No new organizer facts, scores, dates, achievements or submission verdicts appeared in the inspected output.

## Reproduced verification

| Check | Result |
|---|---|
| Rofi integrated backend/MySQL/adversarial suite | 86/86 PASS on `89e8c7e` |
| Refined backend/MySQL/adversarial suite | 89/89 PASS on `5ff26b3` |
| Shared AI offline suite | 177/177 PASS; shared AI code unchanged by refinement |
| Frontend | 154/154 PASS on integration; frontend tree identical after refinement |
| TypeScript, canonical fixtures, production frontend build | PASS on integration; frontend tree unchanged |
| Final API Release build | PASS, 0 warnings/errors on refinement |
| English + Arabic actual UI/live provider | PASS on refinement |
| Original source links, cache timestamp reuse, no profile/plan mutation | PASS |
| Arabic RTL and 390px mobile width, no internal IDs displayed | PASS |
| Profile change rejects cached old context | HTTP 409; no plan created |
| Malicious or unrelated topic/interest cannot create match | API regression checks PASS in EN/AR |

No frontend/shared-AI executable files changed between the full regression run and refinement; that was verified with Git, rather than rerunning unchanged suites. No baseline lint rule or branch protection was bypassed. The final live run did not hit navigation rate limits.

## Scope and remaining review

This is bounded topic/format/interest personalization, not rich analysis of goals, skills, projects or experience. The vocabulary currently recognizes a small controlled set of topics; unsupported custom entries retain a neutral fallback. Matching a topic is not organizer eligibility or demonstrated competence. Missing coverage still offers clarification questions. Model choice preference was observed in these draws, not proven reliable across all future responses; all accepted choices remain server-approved even if a future response chooses a less useful fallback.

The plan generation/acceptance/progress path was not modified or rerun in this briefing-only live check. Its earlier E2E evidence is historical; the backend regressions cover preserving existing application behavior. #28's plan-prompt change is still separate and not included here. Keep #27 unmerged until Rofi's final review, and test any eventual combined composition and GitHub merge SHA before release. `main` is unchanged.
