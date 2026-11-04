# NextStep demo runbook

The [official event page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon) lists project submission on 4 November 2026 at 21:00 ET: 5 November at 02:00 UTC / 04:00 Asia/Hebron. The [official waiver](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver), read in a public JavaScript browser, evaluates the working demo and demo-video quality. The organizer reminder supplied by Noor on 3 November specifies a **three-minute demo video** and a **mandatory open-source GitHub repository**. The signed-in submission form is still unavailable; a mandatory hosted application URL, allowed upload hosts and exact form fields remain unconfirmed.

Use [the timed narration](submission/VIDEO-SCRIPT.md), [draft form answers](submission/APPLICATION-ANSWERS.md), and [final checklist](submission/FINAL-CHECKLIST.md). Repository visibility is public; both contributors approved the [MIT license](../LICENSE), included on this candidate. Verify the submitted revision includes it too and preserve third-party notices. See the [independent review](PR34-INDEPENDENT-REVIEW.md) for current offline and live evidence boundaries.

## Verify the machine before recording

Keep the application and MySQL running. On this development machine the frontend is `http://127.0.0.1:8082`, the API is `http://127.0.0.1:5080`, and MySQL is private on port 33306. In the published monorepo, start from `frontend`; in the existing IDE workspace where `package.json` and `src` are at the root, stay at the root. Use an explicit port so another service cannot silently move the demo:

```powershell
# Published monorepo only: cd frontend
npm run dev -- --host 127.0.0.1 --port 8082 --strictPort
```

From the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File backend/Check-Demo.ps1 -Mode Local
powershell -NoProfile -ExecutionPolicy Bypass -File backend/Check-Demo.ps1 -Mode Submission
```

Exit 0 in Local mode means the public UI/API checks passed, not that Meta, OAuth or email delivery were verified. Submission mode returns exit 2 while any release gate remains pending. Exit 1 means a runtime check failed. The script makes only public GET requests and never creates a student, email, AI analysis or plan. Review `DEMO-RELEASE-GATES.json`; only replace a pending status with `passed` when evidence for the final candidate exists.

## Walkthrough

1. Open Discover and show the galaxy card stacks. Choose An-Najah. Current courses come from the actual session pages and are distinct from past activities and unconfirmed announcements. Open one internal details page before the external organizer link.
2. Save an opportunity, open Saved, search for it, remove it and Undo. Reload once to demonstrate confirmed account persistence. Saving does not create a plan.
3. Open Profile. Show confirmed background, interests, availability and personally contributed project work. Use a synthetic CV/GitHub project for the recording. In the integrated privacy revision, document extraction requires its own opt-in; review suggestions before adopting them. Do not upload identity documents or use a real student's private data for a rehearsal.
4. Open the Meta hackathon details. Explain relevance, missing information and participation conditions separately. Interest overlap and an uploaded artifact do not establish eligibility or competence.
5. Select Prepare. For an event with insufficient planning sources, show that My Plans stores the chosen starting point and clearly labels the review requirement. Do not claim this is an accepted AI plan.
6. On a reviewed event with a planning workspace, review availability and goals, then the data-sharing disclosure. The final integrated candidate must be used for the live generation scene. Preview tasks, effort and constraints before explicit acceptance.
7. Accept the plan after storage confirms, start one task, mark it Done, reload and show the same task state in My Plans. Return to the event. Task progress remains separate from organizer submission evidence.

## What is still gated

The current #30 application can demonstrate public discovery and account workflows, but it does not include the reviewed P1/P2 combined release. Do not present the current Meta generation path as having the final privacy/structured-output safeguards. The API reporting `modelConfigured=true` confirms configuration presence only.

The proposed integration sequence remains P1 -> corrected P2 -> #29/#30 reconciliation -> combined tests/schema and recovery verification -> controlled synthetic live Meta validation. Keep main unchanged until these gates pass. The private combined rehearsal at aefee57f was independently verified with 630 automated checks, 31 synthetic browser assertions, 17 schema checks and five additive upgrade paths. These are offline/rehearsal results, not final release or live-provider approval. Follow-up corrections and the actual publishable integration SHA still need review. A standalone P1/P2 binary cannot safely read the full combined state after writes; use a tested compatible combined recovery build or a reviewed forward fix, preserving post-upgrade progress.

Development seed accounts are synthetic local accounts. Do not publish the documented development password or copy that database into a public demo. Do not reset an existing student's profile or plan to make a recording look complete. If an external provider is unavailable, show the real error and preserve inputs; never substitute a template and call it live AI.

## Assets to finalize from the signed-in submission form

- Required submission form, exact deadline/time zone and attachment limits.
- Recording duration and required scenes; use test identities and hide notifications, credentials and configuration screens.
- Whether an accessible hosted URL is required, including frontend/API hosting, HTTPS, secure cookies, Google redirect URLs and database access.
- Repository/README links, contributor attribution and any organizer-specific requirements.
