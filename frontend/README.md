# NextStep

A fictional hackathon discovery and preparation frontend with light/dark galaxy themes.

## Development

Application backend: see [backend/README.md](../backend/README.md) for ASP.NET Core, MySQL, Rofi's provider integration, endpoints, and real-database checks. The existing frontend demo remains explicitly separate until its repositories are switched to the server authority.

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Demo flow

In development, **Load full website demo** at the top of any screen loads one connected fictional student journey: education, skills, two projects, three saved opportunities, an active plan, a completed plan, and an unstarted plan. Follow the numbered links across Profile, Details/My Fit, and My Plans. **Restore my previous data** atomically restores the saved records from before activation. Unsaved edits are not included in the backup. This scenario never marks fictional sources as genuinely reviewed.

Open a collection on Discover, choose **View opportunity**, and explore **Overview**, **Requirements & My Fit**, and **Preparation**. Direct event links use `/?event=aurora-ai`. Returning to Discover preserves its in-memory search, filters, open collection, and saved state.

Event details use the existing five fictional fixtures. Unknown information is shown explicitly; example.org links are placeholders. Personal analysis and Q&A are labelled demo templates behind `src/lib/details/api.ts`, with no live model calls or frontend credentials. Profile edits mark earlier analysis outdated until explicitly updated.

Create and confirm a local preparation plan in the Preparation tab, then use **Continue my plan** for the separate task workspace. Local save failures are reported before presenting changes as confirmed.

Preparation now follows the v0.2 contract: review a demo candidate, explicitly accept it, and track self-reported task progress. **My Plans** lists confirmed plans only. Core profile, saved opportunities, plans, and progress share one transactional IndexedDB store; existing local demo data is imported with recovery backups. See [PREPARATION-REVIEW.md](./PREPARATION-REVIEW.md) for storage, feature flags, and verification.

Development-only **Details preview controls** cover loading, unavailable/stale sources, date conflicts, incomplete profiles, failed analysis and retry, and a clearly simulated hard participation blocker. See [FRONTEND-REVIEW.md](./FRONTEND-REVIEW.md) for implemented behavior and remaining integration boundaries.

## Saved opportunities

Open **Saved** in desktop or mobile navigation (`/saved`). The page reuses Discovery cards, searches saved titles/organizers, filters participation format, and sorts registration dates or recorded save times. Unknown deadlines sort last; migrated bookmarks keep their stored order without invented save dates. Existing session analysis is displayed as demo output when its context is current and profile facts support relevance; opening Saved never requests new model analysis. Participation checks remain separate.

Bookmarks share the existing transactional browser store. Removal and Undo confirm only after commit, preserve accepted preparation plans, and support retry after failure. Undo retains newer bookmarks from other screens. Saved filters survive client navigation. New bookmarks record save timestamps atomically with the bookmark list. The full website demo includes three saved opportunities.

## Verification

```sh
npm test
npx tsc --noEmit
npm run build
```

Production build: `npm run build`. Start the standalone Node server with `node .output/server/index.mjs`.

## Student profile

Open **Profile** in navigation, or **Edit my profile** in event details. Four sections keep draft values while switching. Completion counts optional fields; it is not an eligibility or skill score. Save explicitly confirms local browser storage; failures keep edits available for Retry. Leaving unsaved changes requires a discard decision. Existing preparation plans and completed tasks are preserved.

Profile services are replaceable through `src/lib/profile/service.ts`. Demo project suggestions use only entered wording and technologies, require acceptance, and are never applied as verified skills. No live model calls or credentials are present. Age is not requested without a reviewed event condition. A selected event can be retained with `/profile?event=aurora-ai`; return and explicitly update its analysis after relevant saved changes.


## Application integration and localization

Authentication/recovery and the real source catalog use the sibling ASP.NET API through the Vite /api proxy. Legacy fictional demo stores remain separate. Arabic/English labels and RTL are available for navigation, real opportunities and auth/recovery; legacy copy is not fully translated. Dynamic Meta translation is off by default and belongs to a separate reviewed adapter.
