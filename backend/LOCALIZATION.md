# Arabic and English

Meta can perform display translation through the server-side model API. See [Meta reasoning guidance](https://dev.meta.ai/docs/reasoning) and [structured output](https://dev.meta.ai/docs/cookbook/structured-output).

## Separation of responsibilities

Fixed UI labels live in frontend localization code, not database rows and not model requests. `LocaleProvider` persists the language preference and applies document `lang`/`dir`. Navigation, authentication/recovery screens, theme controls and the real opportunity catalog have Arabic labels and RTL support. Existing legacy demo Details, Profile, Preparation and Saved screen copy has not yet been fully localized; the presence of a global language control does not mean every legacy sentence is translated.

Dynamic catalog display text uses `POST /api/localization/catalog` with `{ "language": "ar" }` or `en`. The controller calls `CatalogTranslationService` using server-only Meta configuration. The current curated discovery projection is English; English returns that original text without a model request. Arabic translates titles, summaries and verification notes in one structured request. Organization names, official URLs, original quoted source passages, statuses, deadline instants, conditions and canonical matching inputs are never replaced.

The response contains `language`, `sourceRevision`, `translationKind` (`original` or `ai_translation`) and display-only `items`. Translation is labeled as AI output. The Arabic catalog offers original text in each translated card. Provider output shape and IDs are checked; semantic translation accuracy still needs human review, particularly for conditions and uncertainty.

No translated text is manually stored in MySQL. A bounded in-memory cache holds up to eight validated catalog translations for six hours, keyed by original text hash, model, language and prompt version. Source changes invalidate reuse. This cache is disposable, is not a second authoritative content store, and is not shared between backend instances. A semaphore bounds concurrent provider calls on each host. The endpoint uses the existing session, same-origin write protection and generation rate limiter. No automatic provider retries occur.

Missing configuration, timeout or invalid output leaves original content visible with a retry action. React Query isolates translation responses by language and source snapshot so late responses cannot replace another language's view. Language switching does not update eligibility, accepted interpretations, saved opportunities, plans or progress. User-entered profiles are not sent by this catalog translator.

Live Arabic translation still requires the team's `MODEL_API_KEY` in the backend environment. No live provider call has been verified on this host. Provider credentials must never be put in frontend code or committed configuration.


## Proposal ownership and opt-in

This implementation is submitted for Rofi to review, adopt, revise or replace; it is not an approved second AI module. It is stacked on the application PR. The frontend remains off by default: only set VITE_ENABLE_META_TRANSLATION=true after the backend proposal is adopted and configured. No provider implementation in ai/dotnet/NextStep.MetaAi is changed.
