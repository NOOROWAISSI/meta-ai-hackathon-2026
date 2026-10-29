# Shared contract governance — v0.2

Agreed direction: Issue #1, including Rofi's confirmation on 29 October 2026. This policy documents the current wire contract; it introduces no new JSON version field, endpoint version prefix or model output.

## Authority and ownership

Frontend Contract v0.2 defines the shared fields, enums and known/unknown semantics. `docs/fixtures/sample-payload.json` is the canonical synthetic request/response illustration, taken unchanged from PR #2. `frontend/src/lib/contract/sample-payload.json` is its derived test copy, not an independent specification. The flattened local development checkout uses `src/lib/contract/sample-payload.json` for the same copy. Both remain outside normal opportunity navigation.

Noor owns application authorization, current context, HTTP projection, persistence and frontend behavior. Rofi owns provider calls, prompts and output validation. Contract changes are reviewed together. The model candidate (`tasks`, `explanation`) and explicit application-owned acceptance remain separate.

## Compatibility and version changes

Keep v0.2 stable. Removing/renaming fields, changing types, requiredness, meanings, known/unknown semantics or enum/status values requires joint review, a new shared-contract version and an explicit compatibility/migration plan. A change that breaks existing valid consumers is breaking even if its JSON structure appears unchanged.

Optional additions are not automatically compatible: strict consumers may reject unknown properties. Before adding one, document request and response behavior, prove existing consumers can read/write it safely, and coordinate rollout. Do not silently add a version field or invent endpoint negotiation.

For each proposed change, record: current/target shared version; affected producer/consumer fields and semantics; old/new payload examples; unknown/default behavior; deployment order; compatibility tests; treatment of old records; migration/rollback policy and owners; and both teammates' review. Decide the version before implementation is merged.

The explicit-offset validation in this change implements the jointly agreed timestamp semantics of v0.2 and corrects permissive parsing. It changes no wire field/type. Older clients supplying local or malformed timestamps now receive invalid_input and must submit corrected explicit instants. Historical offset-less values must not be silently assigned a server timezone or bulk rewritten; retain stored records for explicit correction/reconfirmation. The supplied sample and development seeds already use explicit instants.

## Separate version domains

Shared contract versions describe the frontend/application/provider boundary. SQL migration versions and internal user-state schema versions describe storage. Profile/submission/plan versions describe optimistic concurrency; sourceRevision describes source context. None is a substitute for a shared contract version, and a database migration alone does not authorize a wire change.

## Canonical fixture workflow

Edit the canonical docs fixture through contract review. It is synthetic, with unverified/unknown source facts; it must not be presented as live data or eligibility evidence. Preserve meaningful IDs, arrays, enums and uncertainty.

From the frontend directory (or flattened local project):

```sh
npm run test:contract
npm run sync:contract
```

The first command checks semantic equality, ignoring object-key/whitespace formatting differences but retaining values and array order. The second explicitly copies the canonical file into the derived frontend fixture; it never modifies the canonical file. The normal frontend test suite also checks equality. Missing or divergent canonical data fails validation. Review every semantic change before syncing; running the sync command is not contract approval.

## Completion and review

Date/time rules and validation evidence are in TIME-SEMANTICS.md. The remaining Issue #1 items stay open until reviewed implementation/tests and this policy are accepted. Adding the canonical file here does not merge or approve PR #2, close #1 or authorize the dependency stack into main.
