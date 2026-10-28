# Meta source discovery

The application-owned intake adapter uses Meta Responses `/v1/responses` with `web_search` and `include: ["web_search_call.results"]`. It does not modify Rofi's preparation client, which uses Chat Completions. Official reference: https://dev.meta.ai/docs/search-grounding

Configure `MODEL_API_KEY` in the backend process environment, or `MetaAi:ApiKey` through .NET user secrets. Never commit it or send it from the browser. Then run one focused search:

```powershell
./backend/Search-Sources.ps1 -SourceId ewb-najah
```

Use an exact source ID from `backend/NextStep.Api/Data/sources.json` or `/api/sources`. One invocation makes one potentially billable provider request, with a 60-second timeout and no automatic retries. An invalid source makes no provider request. A timeout can still incur provider usage; retry deliberately.

Only raw results from completed `web_search_call` items are accepted. A model-only answer is rejected. Empty searched results are valid. Responses are limited to 512 KiB and 50 unique HTTPS links. Titles and URLs are untrusted hints; the app does not fetch arbitrary returned URLs. Queries preserve exact registered account URLs, but search results can contain unrelated sources and do not establish identity.

The existing MySQL intake transaction stores candidates with source `meta:<registered-id>` and a `search_results_pending_review` run status. Candidates remain pending review; they do not appear in the public opportunity catalog automatically. Repeated URLs are deduplicated. No model prose, inferred dates, inferred eligibility, or registration status is promoted into organizer evidence.

This is web discovery of publicly indexed content, not direct Facebook/Instagram Graph API access. Private, login-only and unindexed posts can be absent. No platform-authentication bypass is implemented. Model search is not guaranteed; lack of a search call produces an explicit recoverable error.

Local validation covers missing credentials, incomplete responses, model-only answers, empty search results, unsafe URLs and deduplication. A live Meta search has not been verified on this host because no server key is configured. Provider access and coverage must be checked with the team's configured key.
