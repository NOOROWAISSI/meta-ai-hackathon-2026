# NextStep — Final QA & Frontend Improvement Brief

**Date:** 31 October 2026  
**Outcome:** 🟠 **CONDITIONAL GO** for the *tested local demo journey*  
**Tested commit:** `10840279ca22fbd30fb79e8f72172041b32ae9f8` (PR #21)  
**Audience:** Rofi & Noor  
**Scope:** Final browser E2E, functional risk, and screenshot-based frontend polish. **No code was changed.**

> **Bottom line:** NextStep can demonstrate a complete journey from discovering an event to generating a preparation draft, accepting a plan, updating tasks, and retaining progress in MySQL. There is one reproducible accessibility bug, some important limitations to explain honestly, and a short list of visual improvements. This is *not* a full production release certification.

## 1. Results at a glance

| Area | Result | What it means |
|---|---|---|
| Backend automated checks | **62/62 passed** | Executed earlier in the same QA worktree, not rerun by the browser auditor |
| Frontend automated checks | **138/138 passed** | Passed with `NODE_OPTIONS=--no-experimental-webstorage` on Node 26 |
| Frontend contract & production build | **Passed** | Separate local checks; build output had nonblocking dependency notices |
| Local API | **Healthy** | HTTP 200; `storage=mysql`, `modelConfigured=true` |
| Browser QA | **19 pass · 1 fail · 2 partial · 1 blocked · 5 not tested** | 28 manual check groups; see caveats below |
| **Release decision** | **CONDITIONAL GO** | Suitable for a controlled demo of the tested path, subject to fixes and final integrated retest |

**Environment:** Mac Apple Silicon; Chrome authenticated demo session; frontend `127.0.0.1:8080`; ASP.NET backend `127.0.0.1:5080`; isolated MySQL 8.4 QA database on `127.0.0.1:33307`. This was not a production test.

## 2. What we actually demonstrated

| User journey | Finding | Evidence |
|---|---|---|
| **Discover an event** | Meta hackathon found, inspected, and saved. Source uncertainty remains visible. | [Sources](evidence/01-sources-overview.jpg) · [Participation](evidence/02-participation-unknowns.jpg) |
| **Use a saved profile** | Demo profile provided Python, React, API skills and **5 h/week** availability. Missing information was not fabricated. | [Before generation](evidence/03-before-generation.jpg) |
| **Generate a draft** | One UI generation request produced **6 personalized tasks, 23 estimated hours** using the configured Meta client path. | [Candidate preview](evidence/04-live-candidate-preview.jpg) |
| **Accept deliberately** | The candidate remained a draft until the user explicitly accepted it. Coverage and uncertainty warnings stayed visible. | [Accepted plan](evidence/05-accepted-plan.jpg) |
| **Track progress** | Task moved through *Not started → In progress → Done*. | [In progress](evidence/06-task-in-progress.jpg) · [Done](evidence/07-task-done-confirmed.jpg) |
| **Keep progress after refresh** | After reload/navigation, My Plans showed **1 plan, 1/6 tasks done, 21 h remaining**. Read-only MySQL inspection independently confirmed the records. | [My Plans](evidence/08-my-plans-after-reload.jpg) · [DB evidence](evidence/mysql-readonly-evidence.json) |
| **Protect confirmed work** | A stale write from a second browser tab was rejected; confirmed state remained intact. | [Conflict protection](evidence/10-stale-progress-protected.jpg) |
| **Separate preparation from submission** | Completing the portal-preparation task did **not** mark actual submission evidence as complete; it remained Missing. | [Missing evidence](evidence/09-persisted-plan-and-missing-evidence.jpg) |
| **Responsive experience** | The plan page and task dialog were usable at 390 × 844 without observed horizontal overflow on the measured page. | [Mobile plan](evidence/11-mobile-plan-390.jpg) · [Task dialog](evidence/12-mobile-task-dialog.jpg) |

### Important limits on the results

- **Meta API:** The real-client configuration, supported endpoint, normal backend wiring, and successful generation support that the actual Meta integration was used. However, *independent upstream API telemetry* (HTTP response ID, request trace, billing/usage record) was **not captured**. We should say “integrated live generation succeeded,” not “independently certified provider traffic.”
- **Timing:** Six tasks total **23 h**. At **5 h/week**, that is roughly **4.6 weeks of effort**, *not* a verified time-to-deadline forecast. Because the reviewed submission instant and resulting preparation window are unknown/conflicted, the product correctly labels feasibility **untimed/unknown**.
- **Eligibility and submission:** Six participation checks remained unknown. Task completion, a reported plan, and actual organizer submission/eligibility are different things. No organizer submission or legal eligibility verification occurred.
- **Data state:** The QA demo account intentionally ends with one saved Meta event, one accepted plan, and the portal-preparation task Done. Submission evidence remains Missing/Unknown. Do not use this as proof of real organizer compliance.

## 3. Confirmed bug — action required

### QA-01 · P2 accessibility · Task-dialog focus is not restored

**Owner:** Noor  
**Where:** Accepted plan → **View task** dialog  
**Reproduction:**

1. Open `http://127.0.0.1:8080/plans?event=meta-global-ai-2026` in the test environment.
2. Navigate to a task’s **View task** button using the keyboard and press **Enter**.
3. Close the dialog with **Escape**.
4. Inspect keyboard focus or press **Tab** to continue navigating.

**Expected:** Focus returns to the exact **View task** button that opened the dialog.  
**Observed:** Focus falls to the page **BODY**. Users navigating by keyboard can lose their place.  
**Evidence:** [Focus snapshot](evidence/15-focus-after-escape.json); reproduced with keyboard and after mobile-width testing.

**Acceptance criteria:**

- Closing via Escape, the Close button, or a supported dismissal returns focus to the invoking task control, when it still exists.
- Focus is visible, remains in a sensible order, and does not break task progress updates.
- Verify on desktop and mobile, including keyboard-only interaction.

No P0/P1 app defect was observed in the **executed scenarios**; untested paths remain uncertain.

## 4. Frontend improvements — design feedback, **not** QA failures

These observations come from reviewing the supplied screenshots. They should be tracked separately from QA-01 and **must not require rewriting the preparation/acceptance logic**.

| Priority | Area | Suggested change | Why |
|---|---|---|---|
| **P2 (highest visual payoff)** | Oversized top-right KPI (`1`, `0/6`, `1/6`) | Replace floating hero numbers with **compact, labeled progress summaries** near the actual plan/list. Avoid duplicating task progress already shown below. | The metric dominates the page and is weakly connected to the user’s next action. It crowds mobile headers. |
| **P2** | **My Plans** desktop | Make the saved plan card more prominent; include a compact progress bar and *tasks done / hours remaining / timing unknown* directly in the card. | Current card is small relative to the canvas, with substantial unused space. |
| **P2** | Preparation heading & density | Reduce repeated event title/hero heading; prioritize the next actionable step; collapse long resources/details where sensible. | Improves scanning without hiding substantive warnings. |
| **P2** | Candidate workload / submission warnings | Lead with “23 h estimated,” “Fit: unknown,” and a short explanation. Move detailed source/coverage reasoning behind an accessible **Why?** section. | Users need a clear decision before reading the diagnostic detail. |
| **P3** | User-facing technical copy | Replace QA/developer-style wording such as “Empty resource lists are valid” with concise user-oriented copy, or omit it when irrelevant. | Less intimidating, particularly for students. |
| **P3** | Task priorities | Label `MUST / SHOULD / COULD` as **suggested plan priorities**, visually distinct from official organizer requirements. | Prevents confusion between recommendations and externally mandatory rules. |
| **P3** | Mobile content | Reduce very long card stacks and keep primary task actions easy to reach; retest 390px layout. | Better usability in the most constrained view. |

**Design direction:** Preserve the blue/white visual identity, existing cards and uncertainty safeguards. This is a **focused hierarchy and copy pass**, not a full redesign. Do **not** hide missing eligibility, incomplete submission coverage, or source conflicts for the sake of cleaner screens.

**Screenshot references:** [My Plans](evidence/08-my-plans-after-reload.jpg) · [Candidate](evidence/04-live-candidate-preview.jpg) · [Accepted plan](evidence/05-accepted-plan.jpg) · [Mobile](evidence/11-mobile-plan-390.jpg).

## 5. Remaining risk and demo honesty

**Partially tested**

- Timed capacity fit was unavailable because the verified event window was not established.
- Console, accessibility and semantic checks were sampled rather than exhaustive.

**Blocked**

- Independent provider wire-level telemetry / complete browser HTTP trace was not available in the audit environment.

**Not tested in this browser audit**

- Provider timeout/error/rate-limit recovery.
- Stale or expired candidate acceptance.
- Persisted zero-hour generation rejection and a confirmed timed over-capacity case.
- Replacement-plan regeneration retaining previously completed work.
- Second-account isolation and cross-browser behavior.

The backend automated suite already exercises several safeguards, but that is **not a substitute for marking these browser scenarios untested**.

**Judge-facing caution:** The separate *Requirements & My Fit* personal-explanation panel was observed as awaiting backend integration. Do not present it as the same feature as the **working live preparation generator**. Scheduled source checks also appeared paused/pending and source/submission coverage incomplete. These are known, disclosed limitations.

## 6. Next actions — by owner

| Owner | Action | Done when |
|---|---|---|
| **Noor — now** | Fix **QA-01** keyboard focus restoration. | Reproduced steps pass; no regression in task editing. |
| **Noor — after QA-01** | Do compact KPI + My Plans hierarchy polish first; address duplicate heading/copy if time allows. | Desktop and 390px mobile screenshots are visibly clearer; all warnings remain accessible. |
| **Rofi + Noor — before demo** | Review published source timing and **23 h** workload without inventing dates. | Demo states known facts and “unknown” accurately; no unfounded feasibility claim. |
| **Rofi — before demo** | Verify actual organizer participation, applicable track/team conditions, portal deliverables and required submission evidence separately from demo-task completion. | Any definitive claim is backed by official reviewed evidence. |
| **Both — integration gate** | Retest after merging the staged PRs into the actual integration branch. | Health, real UI path, acceptance, progress, MySQL persistence and mobile focus behavior still pass on the **merged commit**, not only `1084027`. |
| **Both — if time permits** | Add bounded failure-path QA and independent provider request metadata. | Current unknowns are either tested or explicitly disclosed; do not exhaust model credits on repeated calls. |

## 7. Evidence & provenance

- **Source:** Rewritten and reorganized from Codex’s 31 Oct 2026 browser QA evidence, plus a **separate screenshot-based UI review**. Test results were **not rerun** for this rewrite.
- **Test SHA:** `10840279ca22fbd30fb79e8f72172041b32ae9f8`.
- **Manual QA:** 19 pass / 1 fail / 2 partial / 1 blocked / 5 untested, **28 total**.
- **Images & read-only proof:** included in [`evidence/`](evidence/); hyperlinks in this report work when the whole bundle is kept together.
- **Public source references reviewed by QA:** [Meta event](https://dev.meta.ai/events/global-hackathon) · [rules/waiver](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver).
- **Privacy:** No API key, DB password, cookies or session headers included. The evidence is from a demo account, but review images/data before publishing in a public repository.

**Recommendation:** Post this as a standalone QA document / linked GitHub artifact. Keep PR #21 approval intact; use an **informational post-approval comment** to point to it, and track QA-01 + frontend polish in dedicated Issues. Do not reinterpret this as a request for changes to the already-approved PR.
