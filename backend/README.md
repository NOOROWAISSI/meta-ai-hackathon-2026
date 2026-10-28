# NextStep application backend

ASP.NET Core (.NET 8), MySQL 8.4 and Rofi's unchanged preparation provider from commit 1788d39 / PR #10. DTOs follow Frontend Contract v0.2. This is an application integration foundation, not a complete production backend.

## Run from the repository root

Prerequisites: a .NET 8-compatible SDK and Docker Desktop. Frontend, backend and ai are sibling directories.

    powershell -NoProfile -ExecutionPolicy Bypass -File backend/Setup-Database.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File backend/Start-Api.ps1

Setup generates private database credentials under ignored backend/.secrets/, starts MySQL on 127.0.0.1:33306 and applies additive schema migrations through version 4. It never resets the volume. For another database set ConnectionStrings__NextStep on the server.

API: http://127.0.0.1:5080; health: /api/health. Frontend: cd frontend, npm ci --legacy-peer-deps, npm run dev. Vite proxies /api to the backend.

## Implemented

- Controller/service/repository organization: [ARCHITECTURE.md](ARCHITECTURE.md).
- Real MySQL email/password accounts, HttpOnly cookie sessions and Google OAuth wiring. Live Google login requires private credentials and remains unverified.
- Email recovery with single-use codes/grants, guess limits, cooldown and session revocation: [PASSWORD-RECOVERY.md](PASSWORD-RECOVERY.md). Live Gmail delivery requires private configuration and remains unverified.
- Canonical profile/submission writes, input validation, independent participation/submission matching and expected-version checks.
- Preparation candidates via Rofi's IMetaModelClient; explicit acceptance, application-owned task IDs, context rechecks, idempotent retries and transactional progress.
- Source-backed catalog projections, approved-page collection and pending-review discoveries.
- Explicit Development/Testing-only student account seed: [DEMO-STUDENTS.md](DEMO-STUDENTS.md).

## Contract and storage

Writes require X-NextStep-Request: 1; browser writes also require an allowed Origin. Private routes resolve account/guest sessions. Errors retain the canonical ApiError envelope. Provider credentials and model calls stay on the server.

user_state stores one versioned canonical JSON aggregate per owner. Row locks and transactions protect profile, submission, candidate, plan, preference and progress writes. This is real MySQL persistence, but not a normalized table per domain entity and not EF Core. Login/session creation and password reset use transactions to prevent old-password session races.

Routes include /api/auth/*, /api/profile, /api/submissions/{id}, /api/opportunities/{id}/analysis, /api/opportunities/{id}/plan-candidates, /api/plans, /api/plans/{opportunityId}/accept, /api/plans/{opportunityId}/tasks/{taskId}, /api/preferences and own-data export/delete. Candidate output is PlanCandidateOutput plus X-Candidate-Id. The preparation/candidates alias has identical behavior. Task status remains not_started / in_progress / done. Completion does not satisfy organizer requirements.

MODEL_API_KEY belongs only in the backend environment or user secrets. Rofi's provider has no fake fallback in the normal host. Rofi verified a live backend scenario at f541c77; the full browser-to-provider journey on the updated revision still needs verification.

## Data, checks and boundaries

Data/catalog.json has five document-derived hackathon snapshots with incomplete coverage. listings.json adds eight discovery records; sources.json has eleven registered sources. These are file-backed snapshots, not opportunity-table seeds or guarantees of open registration. Collected URLs remain pending_review, not automatically published.

    powershell -NoProfile -ExecutionPolicy Bypass -File backend/Seed-Students.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File backend/Check-Api.ps1
    dotnet build backend/NextStep.sln --configuration Release

The app-only suite has 27 real-MySQL integration checks with provider/email replacements only in test hosts. Five other checks belong to the separate Meta search/translation proposal.

Normal frontend routes now use source-backed opportunities and account-owned API persistence for Profile, Saved, Not interested, preparation acceptance and progress. The agreed stacked-card design, galaxy details tabs and My Fit constellation are retained. Historical fixtures remain outside normal navigation. Full browser-to-live-provider verification on this revision, opportunity tables/publication tooling, scheduling, conditional plan adjustment, email verification/provider linking and production hardening remain pending. See REAL-ACCOUNT-INTEGRATION.md.

Meta search/translation implementation is deliberately outside this app PR. The frontend translation boundary is disabled by default; enabling VITE_ENABLE_META_TRANSLATION requires the separately reviewed adapter. See [LOCALIZATION.md](LOCALIZATION.md) and [HANDOFF-ROFI.md](HANDOFF-ROFI.md).
