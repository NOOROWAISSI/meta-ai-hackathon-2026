# Meta search and content translation: review proposal

Owner for adoption: Rofi (@Reckbeg). This is a separate review spike stacked on the noor application branch, not a production-approved replacement for Rofi's provider or an authorization to take over his AI work. No source under ai/dotnet/NextStep.MetaAi is modified.

## Search discovery

The prototype calls Meta Responses /v1/responses with web_search and include: [web_search_call.results]. It accepts one registered source per explicit CLI invocation, requires an actual completed search call, bounds the response size/count, and saves HTTPS links to the existing pending-review MySQL intake. Model-only prose is rejected; empty searched results are valid. Nothing is published automatically.

This discovers publicly indexed content. It does not grant direct Facebook/Instagram Graph API access, bypass login, or guarantee access to every post. Search result titles/URLs do not establish organizer identity, current availability or eligibility.

Code: backend/NextStep.Api/Services/MetaSourceSearch.cs and backend/Search-Sources.ps1. Setup/limits: backend/META-SOURCE-SEARCH.md.

## Display translation

POST /api/localization/catalog accepts {language: ar|en} and returns {language, sourceRevision, translationKind, items:[{id,title,summary,verificationNote}]}. The English curated projection is returned unchanged. Arabic uses structured Chat Completions output. Validate IDs/shape; cache by source hash, prompt version, model and target language. Canonical facts, organizer names, dates/status fields and original source passages are not overwritten. AI translation is labelled and failures preserve original content.

Code: CatalogTranslationService, LocalizationController and Models/DTOs/Localization.cs under backend/NextStep.Api. Frontend requests remain disabled unless VITE_ENABLE_META_TRANSLATION=true is explicitly configured after adoption. Fixed UI labels do not require a model call or database translations.

## Requested decisions

1. Confirm the proposed source-search and translation DTOs, error codes, source-revision behavior and where the adapters should live in your module.
2. Review prompts and semantic quality: no invented facts, no softened negations/requirements, preserved uncertainty and safe handling of source text as untrusted data.
3. Decide whether to reuse a common provider transport/options implementation, including bounded timeout/rate-limit handling, rather than keeping the prototype clients as final structure.
4. Verify live search grounding and Arabic translation with a server-side team key; inspect actual returned source URLs and representative translations.
5. Confirm accepted provider changes before enabling the UI flag or merging this stack into main.

## Validation and limitations

The combined prototype has 29 backend integration checks: the application's 24 plus five proposal-only checks for grounded-result parsing, missing-key behavior, request shape, validated translation caching and source preservation. Provider HTTP responses in these five checks are synthetic. No live Meta search or translation has been verified locally. Schema/ID validation does not prove semantic translation accuracy. Credentials remain server-only; no local secret files are included.
