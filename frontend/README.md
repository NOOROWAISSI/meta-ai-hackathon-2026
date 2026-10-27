# NextStep

A fictional hackathon discovery and preparation frontend with light/dark galaxy themes.

## Development

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone https://github.com/NOOROWAISSI/meta-ai-hackathon-2026.git
cd meta-ai-hackathon-2026/frontend
npm ci --legacy-peer-deps
npm run dev
```

## Demo flow

Open a collection on Discover, choose **View opportunity**, and explore **Overview**, **Requirements & My Fit**, and **Preparation**. Direct event links use `/?event=aurora-ai`. Returning to Discover preserves its in-memory search, filters, open collection, and saved state.

Event details use the existing five fictional fixtures. Unknown information is shown explicitly; example.org links are placeholders. Personal analysis and Q&A are labelled demo templates behind `src/lib/details/api.ts`, with no live model calls or frontend credentials. Profile edits mark earlier analysis outdated until explicitly updated.

Create and confirm a local preparation plan in the Preparation tab, then use **Continue my plan** for the separate task workspace. Local save failures are reported before presenting changes as confirmed.

Development-only **Details preview controls** cover loading, unavailable/stale sources, date conflicts, incomplete profiles, failed analysis and retry, and a clearly simulated hard participation blocker. See [FRONTEND-REVIEW.md](./FRONTEND-REVIEW.md) for implemented behavior and remaining integration boundaries.

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
