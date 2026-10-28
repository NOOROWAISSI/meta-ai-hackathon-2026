# NextStep Meta AI — Backend Integration

Status: standalone client validated; application integration pending.

## Verification

- .NET SDK 8.0.427
- Both .NET projects build with zero warnings/errors
- 100/100 offline checks passed
- Live Muse Spark 1.3 smoke test passed using synthetic context
- Three structured candidate tasks generated and validated
- No API credentials or generated binaries committed

## Ownership

- Rofi: Meta API client, prompt, output validation, provider errors
- Noor: ASP.NET Core host, API orchestration, frontend adapter, persistence
- Joint: API contract alignment and end-to-end testing

## Proposed HTTP boundary (not yet agreed)

POST /api/opportunities/{opportunityId}/preparation/candidates

Request body: Frontend Contract v0.2 PlanCandidateRequest
Success response: PlanCandidateOutput
Error response: ApiError

The endpoint route and request handling require agreement with Noor.

## ASP.NET Core wiring

Reference NextStep.MetaAi.csproj from the backend project.

Register services in Program.cs:

    builder.Services.AddMetaAiClient(builder.Configuration);

Set MODEL_API_KEY in the backend environment.
Never store credentials in frontend code or committed configuration.

Optional MetaAi settings:
- Model: muse-spark-1.3
- ChatCompletionsUrl: https://api.meta.ai/v1/chat/completions
- AttemptTimeoutSeconds: 30
- OverallTimeoutSeconds: 60
- MaxRetries: 1

## Orchestration requirements

1. Resolve the opportunity from authoritative application data.
2. Check opportunity, profile, submission and plan versions.
3. Evaluate confirmed participation blockers.
4. Include only reviewed, applicable requirements and approved resources.
5. Map the frontend request into server-only PlanGenerationContext.
6. Invoke IMetaModelClient.GenerateCandidateAsync.
7. Recheck context and versions before returning the candidate.
8. Return only PlanCandidateOutput or a standardized ApiError.
9. Do not persist candidate tasks during generation.
10. Persist only after explicit user acceptance with concurrency checks.

Unknown or unverified source information must remain unknown.
Generated candidates must not overwrite confirmed plans or progress.

## Pending

- Finalize HTTP endpoint contract with Noor
- Connect the frontend PreparationService adapter
- Integrate authoritative source and context evaluation
- Implement backend acceptance and persistence
- Run frontend-to-backend end-to-end tests
