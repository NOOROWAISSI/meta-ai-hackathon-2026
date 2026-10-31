# Meta Hackathon 2026 / NextStep

A student opportunity discovery and preparation application. The expanded scope starts with Palestine and global online opportunities.

## Team ownership

- Noor Owaissi: frontend, application backend and MySQL.
- Rofi Ibnu: Meta integration, prompts, eligibility/evaluation coordination and AI quality.
- Integration contracts and deployment are coordinated together.

## Projects

- [frontend](frontend/README.md): React, TypeScript, Tailwind and labelled fictional demo workflows; authentication and real catalog reads use the API.
- [backend](backend/README.md): ASP.NET Core controllers/services/repositories, accounts, recovery, transactional MySQL state and preparation orchestration.
- [ai/dotnet](ai/dotnet/README-INTEGRATION.md): Rofi's original preparation client, dependency PR #10.
- [integration handoff](backend/HANDOFF-ROFI.md): current contracts, review requests and unverified live paths.

    powershell -NoProfile -ExecutionPolicy Bypass -File backend/Setup-Database.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File backend/Start-Api.ps1

In another terminal:

    cd frontend
    npm ci --legacy-peer-deps
    npm run dev

## Review status

This is an integration foundation, not a production-complete MVP. The noor application PR depends on Rofi's provider PR #10. Meta search/content translation are isolated in a separate proposal for Rofi; no live Meta, Google OAuth or Gmail delivery is claimed tested. No browser demo profile/plan is silently imported on sign-in.

Optional demo student accounts: [DEMO-STUDENTS.md](backend/DEMO-STUDENTS.md). Scope decisions: [PRODUCT-SCOPE-UPDATE.md](PRODUCT-SCOPE-UPDATE.md). Secrets belong in private backend configuration, never Git or frontend code. No direct merge to main is part of this publication.
