# Meta Hackathon 2026 / NextStep

A student opportunity discovery and preparation application. The expanded scope starts with Palestine and global online opportunities.

## Team ownership

- Noor Owaissi: frontend, application backend and MySQL.
- Rofi Ibnu: Meta integration, prompts, eligibility/evaluation coordination and AI quality.
- Integration contracts and deployment are coordinated together.

## Projects

- [frontend](frontend/README.md): React, TypeScript and Tailwind discovery, saved opportunities, profile and preparation workflows; account state and source-backed catalog reads use the API.
- [backend](backend/README.md): ASP.NET Core controllers/services/repositories, accounts, recovery, transactional MySQL state and preparation orchestration.
- [ai/dotnet](ai/dotnet/README-INTEGRATION.md): Rofi's original preparation client, dependency PR #10.
- [integration handoff](backend/HANDOFF-ROFI.md): current contracts, review requests and unverified live paths.

    powershell -NoProfile -ExecutionPolicy Bypass -File backend/Setup-Database.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File backend/Start-Api.ps1

In another terminal:

    cd frontend
    npm ci
    npm run dev -- --host 127.0.0.1 --port 8082 --strictPort

## Review status

The current application branch has local build, frontend and MySQL checks, but the final P1/P2 privacy and structured-output integration is still under review in PRs #31/#32. Its frontend review follow-up is isolated in PR #33. Earlier live-provider evidence does not certify the final combined candidate. No browser demo profile or plan is silently imported on sign-in.

For the demo, use [the walkthrough](docs/DEMO-RUNBOOK.md) and [release gates](docs/DEMO-RELEASE-GATES.json). Run `powershell -NoProfile -ExecutionPolicy Bypass -File backend/Check-Demo.ps1 -Mode Local` to check public UI/API availability. Submission mode intentionally refuses to report readiness while the final integration, authenticated submission requirements and live E2E remain unverified. Provider configuration alone is not a successful model call.

The frontend lockfile matches the corrected P1 lockfile without changing package.json. For the IDE workspace where package.json/src live at the root, run the frontend commands there instead of changing to frontend.

Optional demo student accounts: [DEMO-STUDENTS.md](backend/DEMO-STUDENTS.md). Scope decisions: [PRODUCT-SCOPE-UPDATE.md](PRODUCT-SCOPE-UPDATE.md). Secrets belong in private backend configuration, never Git or frontend code. No direct merge to main is part of this publication.
