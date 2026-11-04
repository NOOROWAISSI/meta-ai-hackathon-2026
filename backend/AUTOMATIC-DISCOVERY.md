# Automatic official-source discovery

Discovery checks run in ASP.NET Core while the API is running. The first due check starts 15 seconds after startup. A five-minute poll consults persisted `source_runs`; successful sources are due every 12 hours by default, failed sources after one hour. Restarting the API does not reset these times. An offline laptop cannot perform checks: continuous operation requires hosting the API.

## Configuration and operation

`SourceCollection:Enabled` (default true), `IntervalHours` (default 12, bounded 1–168), and `MaxPagesPerSource` (default 4, bounded 1–10) are server settings. Environment overrides use the usual double underscore separator. The worker is disabled in the Testing environment. No provider credentials or Meta calls are involved.

Apply the additive migration with `backend/Start-Api.ps1 -MigrateOnly`, then start the API normally. Migration v5 adds `source_pages` and `discovered_listings`; it preserves accounts, preferences, student seeds, existing plans and progress. The database schema version is separate from the v0.2 frontend/AI contract version.

For an explicit bounded check:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File backend/Collect-Sources.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File backend/Collect-Sources.ps1 -Source google-ml-catalog
```

A MySQL named lock prevents overlapping scheduled, CLI and application-instance collection runs. Connections release the lock when they close, including after process failure. Page observations and their extracted records are stored in one transaction. A failed page retrieval never erases previously stored listings. The next scheduled pass retries; disabling collection does not delete data.

## What is automatically published

- Schema.org Course/Event/EducationEvent JSON-LD with a supported tech category, explicit title and description, an explicit organizer/provider, an HTTPS same-origin URL, and supported geographic/online context. Ambiguous duplicate descriptions for the same URL are not promoted. Unknown or incomplete records remain outside the published feed.
- A narrowly scoped adapter for Google's official machine-learning catalog reads its foundational/advanced course cards. It excludes guides and glossaries. Course titles/descriptions are copied from the live source; the configured official host identifies Google. A markup change that no longer matches the adapter does not produce guessed content.

This is bounded collection from registered sources, not unrestricted internet search. No credentials, login bypass or automatic Facebook/Instagram scraping are used. Robots directives are checked before fetching; redirects, unavailable robots files other than 404, oversized pages, non-HTML content and unavailable pages are not bypassed. Collection respects same-origin links, per-source limits, delays and HTTP timeouts.

Other HTML links are stored in `intake_candidates` for source review. Social accounts remain registered references requiring a public retrievable announcement or a separately authorized platform integration. A university directory is not itself evidence that registration for a course is open.

## Facts, freshness and compatibility

`GET /api/listings` merges persisted discoveries with existing listings. Deduplication preserves original curated IDs, saved preferences and plan references. Automatically refreshed course descriptions can replace their discovery snapshot while keeping the ID; canonical hackathon planning rules are never automatically rewritten. Updating a reviewed planning record still requires a source revision through that separate workflow.

Optional discovery-only fields are `firstSeenAt`, `lastCheckedAt`, `sourcePageUrl`, `eventEndAt`, `availabilityState` and `sourceFreshness`. They do not replace canonical Opportunity, AssessmentContext, Plan or Meta DTOs. `lastReviewedAt` remains distinct from automatic retrieval. Automatic records use `needs_verification`, not human-reviewed metadata, and never enter the reviewed preparation-resource catalog automatically.

The UI marks a newly discovered, current listing as New for seven days. New means first found by NextStep, not newly announced by the organizer. Existing curated opportunities are not relabeled New after refresh. Expired explicit-offset event end dates and source cancellation statuses are shown separately from registration. Missing/ambiguous deadlines remain unknown; event end times, offer expiry dates, an accessible page, and a successful request do not imply open registration. Fees, certificates, benefits and participation conditions are not invented.

Failed, changed-without-extractable-details, or older-than-seven-day snapshots remain readable with a stale-source label. `GET /api/sources/status` reports the actual last attempts and counts. The Discovery page refreshes its feed/status every five minutes and retains existing filters and navigation. A scheduled check is not a promise of newly published results on every pass.

## Verification

Backend checks use actual MySQL with isolated synthetic source IDs and a fake page reader; their cleanup removes only their own source rows. Checks cover URL/cohort deduplication, source/organizer separation, missing facts, geography, robots rules, structured conflicts, Google course-vs-guide extraction, due scheduling, repeated upserts with stable first-seen times, retained stale records and the cross-process collection lock. These are distinct from an explicit live-source collection pass.

References: [ASP.NET Core hosted services](https://learn.microsoft.com/aspnet/core/fundamentals/host/hosted-services?view=aspnetcore-8.0), [Schema.org Course](https://schema.org/Course), [Schema.org Event](https://schema.org/Event), [Google machine-learning catalog](https://developers.google.com/machine-learning).

Local verification on 2026-10-29: a live Google catalog pass stored eight source-derived courses. One matched an existing course URL, retaining its curated ID; seven were additional discoveries, producing 20 displayed listings without duplicates. Other checked pages supplied 33 pending-review candidate links; those were not automatically promoted to published opportunities. Social sources remained manual references, and source access/size failures remained visible in collection status. After integrating reviewed dependencies #15/#16/#18, this branch passed 52/52 backend checks (the local combined workspace passed 57/57, including the separate Meta proposal checks); the full frontend suite passed 94/94, TypeScript and the production build passed. An isolated browser verified seven New labels, internal opportunity details, preserved collection state through in-app return navigation, and no horizontal overflow at 390px. Synthetic check rows were removed by their scoped cleanup.
