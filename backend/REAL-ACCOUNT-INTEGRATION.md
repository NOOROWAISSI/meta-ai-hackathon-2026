# Real account integration — 28 October 2026

Normal routes now use source-backed opportunities and account-owned HTTP persistence. `/` is the single Discover page; `/opportunities` redirects to it while preserving the selected listing. Fictional Aurora/Tidewater records and full-demo/sample-plan loaders are not used by normal navigation. Historical fixtures remain only for regression tests; existing browser records are not silently uploaded or substituted for real events.

## Account storage

- Profile uses `GET/PUT /api/profile/editor`: canonical StudentProfile plus bounded display/form metadata in the same MySQL owner aggregate. Saving is version-checked and atomic. Fields outside the form, original goal/project IDs and unchanged known/unknown facts are preserved.
- The metadata envelope supports the existing four profile sections, photos, project URLs and practical preferences without replacing the canonical analysis schema. Photos remain outside model prompts. The normal profile has no fake save/suggestion controls.
- Saved and Not interested use server preferences for existing real listing IDs, including courses. PATCH changes only the requested field so hiding cannot accidentally unsave. A recorded saved timestamp supports recent ordering. Undo checks the expected account to avoid updating a newly signed-in account from an old toast.
- Every private screen requires sign-in; public catalog/details remain accessible. Account query keys and component boundaries isolate users. Profile updates invalidate dependent views; old confirmed progress is retained.

## Preparation and progress

The normal Plans route uses the application API, not the mock generator or IndexedDB. The frontend loads confirmed profile/submission/opportunity/resource records, requests a candidate, retains its server `X-Candidate-Id`, and sends only that identifier, expected version and stable operation receipt when accepting. Task updates use the confirmed plan version and are shown as saved only after the API succeeds. Failures preserve drafts and last confirmed state; 409 requires reviewing current data.

All provider requests still go through Rofi's existing server client. No Meta key or direct provider call is added to the browser. Missing configuration is a real error; it never falls back to a template. No synthetic accepted plan is seeded into the application.

Submission requirements remain a separate checklist. A task targeting a requirement is not proof that an artifact is present or compliant. Reported evidence is stored separately with its own version. Uncovered requirements remain visible, with original source passages and uncertainty.

The resource catalog resolves actual reviewed course snapshots to resource IDs/descriptors. Theme-matched current records reach the provider through ReviewedResourceIds/ReviewedResources; stale and absent links are not invented. Review scope is source identity/content, not certificate price or student eligibility. Empty applicable resource sets remain valid.

## Test accounts

Existing Noor/Omar/Lina accounts are preserved. A fourth synthetic account, `adam.student@example.invalid`, has five weekly hours, reported skills and two goals ready for testing. Password: `NextStep-Demo-2026!`. The explicit seed skips existing accounts and never resets edits or progress. These are development accounts and cannot receive mail.

## Remaining external verification

Live Meta generation, personal briefing and translation require Rofi's agreed integrations and server-side credentials. Gmail/Google need their private setup. The real catalog is still curated source snapshots, not a claim of live exhaustive collection or current open registration. Production deployment, monitoring and full source publication workflows remain separate work. No live-provider success is claimed by local fake-provider tests.
