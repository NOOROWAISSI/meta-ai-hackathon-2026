# Task focus and plan hierarchy follow-up

Addresses #23 and #24 from Rofi's QA report in #22. This is a frontend-only follow-up to approved #21, preserving NextStep's glass surfaces, galaxy palette, navigation and light/dark themes.

## Changes

- The task drawer remembers its invoking control. Escape and Close restore focus to that exact connected button, including a task other than the first. Cancelling an unsaved-change dismissal keeps the dialog open.
- Header counts are compact and labelled; decorative preparation step numbers are removed.
- Embedded preparation uses a section heading and the parent event context; it no longer repeats the event title, organizer or back link. The standalone workspace keeps its full event header and navigation.
- Confirmed plans precede self-reported participation without an accepted plan. Each plan shows labelled task progress, completed/total tasks, remaining effort, deadline uncertainty and its Continue action. A single plan uses the available row width.
- Candidate workload and available time receive visual emphasis. Accept/Discard actions appear immediately after the preview; the full rationale is expandable. Unknown/stale timing and acceptance guards remain unchanged.
- Resource details can be expanded inside task cards. Empty resource messages are concise, and stale/unavailable links stay withheld.
- Task priorities are labelled suggested priorities, distinct from organizer requirements. Submission-check explanations are shorter with the verification limits still available in a disclosure. Repeated identical source notes render once; distinct missing checks remain.

## Verification

- Frontend: **146/146** tests across 29 files. TypeScript, canonical fixture validation and production build passed, including both embedded and standalone preparation heading states.
- Real browser at 1366px and 390px: Enter opens the second task; Escape and Close return focus to the same button. Focus is visible. Light/dark layouts and mobile width were inspected.
- Disposable-account browser regression: candidate preview does not commit a plan; explicit acceptance stores it; a task starts through the drawer; a controlled failed Done save preserves confirmed state; Retry succeeds; refresh retains Done and original estimates; an old-version write is rejected; return to event details succeeds.
- The browser uses the real frontend, ASP.NET application and MySQL with **only the Meta provider replaced by the test adapter**. No live Meta request was made. Temporary accounts were deleted after each run. Production rate limits were not weakened.
- No backend, provider client, shared contract, acceptance, submission or persistence logic changes. Existing source/eligibility uncertainty remains accessible. This does not replace the final merged-branch/live-provider check.

## Synthetic screenshots

These images use a disposable synthetic account and test-generated tasks, not a student's real profile or a live Meta result.

- [Candidate review, light theme](candidate-desktop.png)
- [My Plans, desktop dark theme](my-plans-desktop-dark.png)
- [My Plans, 390px dark theme](my-plans-mobile-dark.png)
- [Task drawer, 390px dark theme](task-mobile-dark.png)

The original independent QA report remains in #22; these follow-up images and checks are separate evidence.
