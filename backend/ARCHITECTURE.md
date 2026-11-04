# Backend organization

Reference inspected: [Wasel-Backend](https://github.com/AhmadYaser23/Wasel-Backend-), commit `7af676d`, on 28 October 2026. NextStep follows its controller/service/repository organization. No Wasel domain code or configuration secrets were copied.

```text
NextStep.Api/
  Controllers/       HTTP routes, request binding and response status
  Services/          Profile/plan workflows, matching, accounts and source intake
  Repositories/      IStateStore, transactional MySQL implementation and catalogs
  Models/DTOs/       Frontend Contract v0.2 request and response types
  Validation/        Known/unknown facts and domain input validation
  Configuration/     Google sign-in setup and cookie configuration
  Data/              Existing SQL migrations and reviewed catalog snapshots
  Program.cs         Dependency injection, middleware and collector commands
```

Controllers are grouped into Auth, Profile, Opportunities, Plans, Submissions, Preferences, Discovery and System. They receive services/repositories through dependency injection. The shared `NextStep.Api` type namespace remains stable for Rofi's integration and the checks; physical folders describe responsibilities.

The public `/api/...` routes, response field names, error envelope, cookie sessions, rate limits, JSON validation and source/plan version checks remain compatible. The existing `IStateStore` transaction boundary is retained so one progress update commits atomically. No database migration, data deletion or authentication migration is part of this refactor. Rofi's provider project is unchanged.

## Remaining differences from Wasel

Wasel uses EF Core with SQL Server, JWT bearer authentication, AutoMapper and API versioning. NextStep currently uses parameterized MySQL repositories, server-owned cookie sessions and the agreed v0.2 DTOs. Changing database provider, adopting EF Core, switching authentication or changing route versions is separate implementation work; none is implied by this folder/controller refactor.

Some workflows still share the existing `Application` service, and account SQL is still inside the existing Accounts implementation. Further extraction into focused services and account repositories can proceed behind the unchanged controller and contract boundaries. A normalized relational model with EF migrations requires a planned migration of the existing confirmed JSON state; this change does not pretend that migration has occurred.

Validation: `backend/Check-Api.ps1` exercises the controllers against real local MySQL with a test-only provider replacement. Production has no mock provider fallback.
