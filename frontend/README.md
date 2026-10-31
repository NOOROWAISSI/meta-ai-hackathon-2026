# NextStep

Source-backed opportunity discovery and account-owned preparation using React, TypeScript, ASP.NET Core and MySQL. Existing galaxy themes and profile styling are retained.

## Run locally

See ../backend/README.md for private MySQL configuration and Docker setup. Run in separate terminals:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ../backend/Start-Api.ps1
npm install
npm run dev -- --host 127.0.0.1 --port 8082
```

Open http://127.0.0.1:8082. Vite proxies /api to the backend on port 5080. From this directory, explicitly seed accounts with ../backend/Seed-Students.ps1. Four synthetic development accounts are documented in [DEMO-STUDENTS.md](../backend/DEMO-STUDENTS.md). Existing accounts and progress are preserved on reseeding.

## Current journey

Discover is the single public catalog at /. Old /opportunities links redirect there. Cards open source summaries inside the app before the official link. Catalog records are curated real-source snapshots, not a claim of live exhaustive collection or open registration. Unknown details remain unknown.

Sign in to save opportunities, restore hidden opportunities, edit the four-section profile or use My Plans. These screens use the application API and MySQL, with confirmed saves, version checks and retry. Saving or hiding does not create or delete a plan. Public browsing remains available without an account.

Preparation loads confirmed account facts and reviewed resource descriptors, requests a server candidate, requires explicit acceptance, and persists self-reported progress through the API. Submission evidence stays separate from completed tasks. Missing Meta configuration produces an unavailable state; there is no mock-plan fallback in normal routes. Rofi owns the provider integration. Personal AI briefings, translation, Gmail and Google still require their agreed integration/private configuration.

Historical fictional fixtures remain for regression tests, outside normal navigation. Existing browser records are not silently imported into accounts. See [REAL-ACCOUNT-INTEGRATION.md](../backend/REAL-ACCOUNT-INTEGRATION.md) for boundaries and remaining external verification.

## Verification

```sh
npm test
npx tsc --noEmit
npm run build
```

Backend checks are in backend/NextStep.Api.Tests. Standalone frontend server: node .output/server/index.mjs. Keep provider keys, Gmail credentials and .secrets out of source control.
