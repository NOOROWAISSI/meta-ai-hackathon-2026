# Development student accounts

These are actual accounts in development MySQL with synthetic names and self-reported facts. Creation is explicit and allowed only in Development or Testing.

| Name | Email | Scenario |
| --- | --- | --- |
| Noor Ahmad | noor.student@example.invalid | React, TypeScript, AI/web interests, six weekly hours |
| Omar Khaled | omar.student@example.invalid | Python/security interests, zero weekly hours |
| Lina Hassan | lina.student@example.invalid | Partial profile, design/AI interests, unknown availability |
| Adam Saleh | adam.student@example.invalid | Python, React, APIs, five weekly hours and two preparation goals |

Development password for all four: `NextStep-Demo-2026!`

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File backend/Seed-Students.ps1
```

Existing accounts are skipped, preserving passwords, profile edits, preferences, plans and progress. New accounts are created atomically using normal password hashing. No plans, completed submissions, eligibility results or AI output are seeded. No Meta call or email is sent.

Normal Profile, Saved and Plans read account-owned API data. The example.invalid addresses cannot receive mail; recovery delivery requires a real address you control and private Gmail configuration. Age, residence and eligibility are not inferred.
