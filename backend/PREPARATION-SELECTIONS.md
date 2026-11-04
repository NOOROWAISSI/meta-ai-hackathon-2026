# Prepare action and My Plans starting points

Previously, **Prepare for this opportunity** only navigated to an event's preparation route. A discovered hackathon without a canonical planning record, such as `palestine-summit-birzeit-demo-2026`, correctly stopped at source review but left no saved starting point in My Plans.

Signed-in Prepare now confirms an account-owned MySQL write before navigating. My Plans displays these records in **Selected for preparation**, separately from accepted plans and task progress. The source-review entry also provides **Add to My Plans** for direct links and embedded preparation tabs. Guest browsing remains available, with sign-in required to save a choice.

The application storage envelope adds `preparationSelections` with default empty values for existing accounts. It uses the existing `IStateStore.Change` row lock and MySQL persistence; no new browser store, table migration or canonical v0.2 plan schema is introduced. Each record stores the actual opportunity ID, title, organizer and first selection time. Repeated saves are idempotent. Current access state is recomputed on read; an unavailable event keeps its saved title instead of silently disappearing.

Endpoints:

- `GET /api/preparation-selections`: current account's preparation starting points.
- `PUT /api/preparation-selections/{id}` with `expectedAccountId`: save a current hackathon selection.
- `DELETE /api/preparation-selections/{id}` with `expectedAccountId`: remove only that starting point.

Mutation responses are confirmed only after storage succeeds. A failed save stays on details with retry and does not navigate as if saved. Account mismatches, unknown opportunity IDs and non-hackathon records are rejected. No write occurs merely from a GET/navigation. A saved choice does not assert event registration, acceptance, eligibility, submission compliance or a generated/accepted plan. Source-review and explicit plan-acceptance requirements remain in effect. Accepted plans hide the corresponding starting-point card; deleting a selection never deletes a plan, candidate, task, bookmark or profile fact.

Validation:

- Backend: **124/124** checks against real local MySQL with synthetic model adapters. New checks cover Birzeit readback, idempotence, account/kind/ID guards and preservation of an existing accepted plan.
- Frontend: **178/178** tests across 36 files, including storage-before-navigation, recoverable failure and restored starting points.
- TypeScript, changed-file lint, canonical contract fixture validation and production build pass.
- Isolated browser against the running API: simulate a 503 on the first selection save; verify no navigation or stored choice; retry successfully; open My Plans; reload; continue the same Birzeit opportunity. Confirm zero accepted plans were invented, profile/participation facts remained unchanged and no model request was made.
- Only a disposable synthetic account was used for browser verification. Cleanup verified its account ID, owner ID and test-email prefix before removing it. Existing student accounts and progress were preserved.
