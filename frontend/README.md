# NextStep frontend

React and TypeScript hackathon discovery interface using TanStack Start and Tailwind CSS.

## Run locally

Requires Node.js 22.12+ or 24 LTS.

```sh
cd frontend
npm ci --legacy-peer-deps
npm run dev
```

Open http://localhost:8080.

## Discover

Search and filter the five fictional demo opportunities, expand stacked collections, save opportunities, and edit a local profile. Light and dark galaxy themes support desktop and mobile. View opportunity opens a compact preview; the full details workflow is delivered separately.

All events and recommendation messages are synthetic. Links use example.org placeholders. No backend, database, or live AI service is connected. Saved state and profile data stay in this browser. My Plans, Saved, and Profile navigation pages are placeholders at this stage.

## Verification

```sh
npm test
npx tsc --noEmit
npm run build
```

Start the production server with `node .output/server/index.mjs` after building.
