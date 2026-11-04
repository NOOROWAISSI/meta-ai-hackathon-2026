# Preparation entry for discovered hackathons

All hackathon details and Saved entries expose preparation. Navigation no longer relies on `E01–E05` or an `E` prefix. My Fit also uses the server's planning-record capability instead of interpreting the ID. Existing confirmed plan workspaces and their persistence remain unchanged.

## Public capability boundary

`GET /api/opportunities/{id}/preparation-access` returns selected-opportunity display metadata and one state:

| State | Behavior |
| --- | --- |
| `workspace_available` | The hackathon has an actual canonical planning record. A signed-in student opens the existing account workspace; a guest gets a sign-in action retaining the selected event. This state is not an eligibility, source-completeness, model-availability or feasibility verdict. |
| `source_review_required` | The hackathon exists in discovery but has no canonical planning record. Publicly show the event and the participation/submission/source information that needs review. Do not call generation or manufacture rules, dates, a placeholder plan or a private profile requirement. |
| `unsupported_kind` | Courses, competitions and workshops remain readable/savable learning or discovery opportunities; they do not become hackathon plans. |

An unknown listing returns the existing `ApiError` with HTTP 404. Storage/network failures have a retry path, with confirmed progress unchanged. The endpoint reads public source data, requires no account, and does not invoke Meta or create an account/session/plan.

The navigation descriptor does not replace `Opportunity`, `PlanCandidateOutput`, `AssessmentContext` or any shared Meta DTO. The selected ID and planning ID must agree at the frontend service boundary. Public capability queries are keyed by opportunity; private workspace state remains keyed/remounted by the authenticated owner. Late results for another event cannot replace the current view.

The planning catalog no longer has an artificial five-record maximum. It validates unique valid IDs and evidence references. Its original five source fixtures remain unchanged; a sixth reviewed public Meta record is now included. Adding a new real planning record still requires reviewed source information through the catalog workflow; discovering a summary does not perform that review automatically.

## Navigation and storage

The Details preparation tab, the main preparation action, Saved and `/plans?event=...` use the same entry. Missing planning information is visible before sign-in. Guests can still read source details; private My Plans without a selected event remains account-protected.

Source-review views link back to the event, the official page and the profile with the return context preserved. In-app navigation keeps the existing per-visit discovery search/filter/collection memory. It does not introduce a second persistence store, modify a profile draft, or change accepted tasks, artifact links, submission evidence or plan versions. Generation, acceptance and task writes continue through the existing backend and their existing guards.

## Verification

The final publication-branch checks are recorded in the pull request. The earlier combined local workspace passed 62 MySQL checks and 111 frontend tests; five separate search/translation proposal checks are excluded from publication.

Coverage includes arbitrary planning IDs, unreviewed source-review states, unsupported courses, missing listings, preserved sign-in context, late responses, unchanged accepted progress and explicit self-reported participation. The Meta record now opens the real workspace after its public source review; its incomplete source coverage and uncertain timing remain visible.

Browser verification covered public details, mobile layout, My Fit, workspace entry, discovery return context and unchanged stored plans. No live Meta request or key provisioning was performed. Private account data and maintenance helpers are excluded.
