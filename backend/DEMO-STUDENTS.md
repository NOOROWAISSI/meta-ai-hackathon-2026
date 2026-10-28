# Development student-account seed

Synthetic MySQL accounts, created only by the explicit seed command. No real students or production credentials are seeded.

| Student | Email | Scenario |
| --- | --- | --- |
| Noor Ahmad | noor.student@example.invalid | React/TypeScript, AI/web interests, six hours/week |
| Omar Khaled | omar.student@example.invalid | Python/cybersecurity, zero preparation hours |
| Lina Hassan | lina.student@example.invalid | Partial profile, design/AI, unknown hours |

Shared development-only password: NextStep-Demo-2026!

    powershell -NoProfile -ExecutionPolicy Bypass -File backend/Seed-Students.ps1

The password is intentionally public test data; never reuse it for a real account. Arabic display names are product fixture data. Seeding uses the normal password hasher and an atomic transaction per new account. Repeated execution skips existing normalized emails, preserving passwords, edits, plans and progress. Production is blocked; no HTTP seed endpoint or external mail/model call exists.

example.invalid cannot receive mail. For Gmail recovery use a real test mailbox you own. Age, residence and eligibility stay unknown. Skills are synthetic self-reports. No accepted plan or completed submission is manufactured.

The profile is stored in MySQL. Legacy browser-demo adapters do not show it until API integration is completed. Authentication itself is connected to the backend.
