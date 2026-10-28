# Dependency security update — 28 October 2026

Before this update, npm audit reported two high-severity packages:

- Zod below 4.6.6: GHSA-mrhx-c7xc-m3w5, oversized collection validation memory exhaustion. Upgraded direct dependency from 3.x to 4.6.7, using the Zod 4 migration guide and checking TypeScript, validation tests and the production build.
- Vite 8.1.5: development-server/editor integration advisories, including GHSA-587h-7wmj-h5pm. Upgraded to 8.3.5. The Vitest alias now uses import.meta.url rather than __dirname for native configuration compatibility.

The lockfile records the actual resolved dependency tree. npm audit after installation reports zero vulnerabilities, including production-only audit. This is a dependency audit result, not a claim that the whole application is security-certified.

References:
- https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- https://zod.dev/v4/changelog
- https://github.com/vitejs/vite/releases/tag/v8.3.5

No unrelated framework migration or forced audit fix was applied. Existing schemas retain their validation behavior under Zod 4; application and contract regressions run against the upgraded dependencies.
