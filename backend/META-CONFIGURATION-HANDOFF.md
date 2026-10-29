# Local Meta configuration and integration ownership

The local preparation page reported `Meta AI configuration is unavailable`. The existing ASP.NET application/provider boundary is wired, but the local health check reported `modelConfigured: false`. This is missing local configuration, not evidence of a defective Meta client or a completed live request.

## This change

In Development only, the backend can read optional ignored `backend/.secrets/meta.json`. It uses the existing `MetaAi:ApiKey` option consumed by Rofi's shared client. Environment variables still override local file settings, and the client's existing `MODEL_API_KEY` convention remains unchanged. No shared client, prompt, endpoint, model default, candidate DTO, authorization, plan acceptance or progress code is changed.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File backend/Setup-Meta.ps1 -Check
powershell -NoProfile -ExecutionPolicy Bypass -File backend/Setup-Meta.ps1
```

The second command asks for the key with hidden input and writes only local configuration. It does not test or call Meta. Restart the API afterwards; `/api/health` reports configuration presence only. A configured key may still be invalid or unauthorized. Do not send keys through chat, PRs, comments or committed files. Do not substitute Google OAuth credentials, Facebook/Instagram Graph tokens, or a Gmail App Password for the Meta Model API key. Production uses private server environment/secret management rather than this development file.

## Ownership and current boundaries

| Area | Responsibility / current state |
| --- | --- |
| Application frontend, authenticated context, MySQL, candidate acceptance, progress and source collection | Noor/application layer. Source collection in PR #17 does not call Meta. |
| Shared Meta transport/configuration conventions, plan-generation prompts, model output/schema policy and provider-specific validation | Rofi's existing AI module. This PR does not replace that module. |
| Credentials | Project owner configures the server privately; nobody is asked to post a key to GitHub. |
| Browser-to-provider verification | Joint integration check after the environment is privately configured; prior evidence is tied to its tested commit/environment. |
| Personal opportunity briefing and contextual questions | Display boundary exists but is not connected to a live backend adapter. Needs an agreed contract and ownership; not implemented by this configuration change. |
| Search and Arabic content translation | PR #11 remains Draft. Rofi requested genuine provider search, presentation-only translation and shared transport/configuration. No live search/translation-quality approval is claimed. |
| New discovery records and preparation | New summaries do not automatically become canonical reviewed hackathon planning records. Current preparation entry uses E01–E05; a capability-based route/record handoff is a separate application follow-up. |

## Requested review from Rofi

Please confirm that the existing `MetaAi:ApiKey` / `MODEL_API_KEY` conventions remain the agreed local setup. No AI rewrite or new provider client is requested. Once a project key is configured privately, the next verification is one deliberate browser generation request, explicit acceptance, MySQL persistence, progress update and reload, preserving unknown hours/deadlines and submission evidence.

For the next AI feature, please confirm a shared-client adapter contract for a source-backed opportunity summary, personal relevance, preparation priorities and focused questions. Answers must preserve unknowns and must not create eligibility decisions or confirmed profile facts. This is a request for alignment, not an already implemented or approved endpoint.

Verification on this isolated branch: backend/MySQL checks 41/41 PASS; PowerShell parser and no-secret `-Check` PASS; `.secrets/meta.json` is ignored; no diff under `ai/dotnet`. No credential was added and no live Meta request was made. Previous live success reported in PR #8 belongs to the separately tested environment/commit, not this configuration check.
