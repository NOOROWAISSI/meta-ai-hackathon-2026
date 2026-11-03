# Combined release and recovery policy

This policy supersedes the private rehearsal report's phrase "binary-only rollback." The combined schema is additive, but application JSON readers are not interchangeable. This is a release procedure, not permission to deploy.

## Supported and unsupported targets

Standalone P1/P2 and the pre-combined #29/#30 builds are **not supported downgrade targets after combined writes**. Their strict UserState shapes differ from the combined union. In particular, the real P2 reader rejects `preparationSelections`, including an empty object. Old #29/#30 readers do not support the P1 rendering/history fields. Never make a downgrade appear successful by discarding unknown members, rewriting stored plans, or deleting progress.

Recovery must use a previously retained **compatible combined build** with the same state union and the corrected disclosures, or a reviewed forward fix. Retain its frontend/backend binaries, source SHA, locked dependencies, configuration references and checksums before replacing it. If no such known-good combined build exists, do not advertise binary rollback: take the service out of write mode and prepare a forward fix. Restoring a pre-upgrade snapshot can lose intervening writes and is not an automatic rollback option.

## Before enabling a combined release

1. Stop application writes and scheduled collectors for the maintenance window. Take and verify a restricted backup of the database, including evidence imports, opt-ins, generation acknowledgments, accepted/historical plans, renderings, receipts and artifacts. Keep passwords and raw student records out of public evidence.
2. Rehearse upgrade on a disposable copy. Check actual tables, columns, indexes and foreign keys, not just migration-ledger rows. Verify required column types/nullability separately; CREATE TABLE IF NOT EXISTS does not repair malformed existing objects or missing constraints.
3. Build the offline compatibility checks **against the exact proposed combined recovery target** and run:

   ```powershell
   dotnet run -c Release --project backend/NextStep.StateCompatibility.Checks -- docs/fixtures/sample-payload.json
   ```

   All four checks must pass. They exercise the union envelope, Done progress/effort/artifacts, missing optional legacy collections, and continued rejection of unknown members. This fixture check supplements, rather than replaces, a private replica test using representative already-persisted state and both actual binaries.
4. On that private disposable replica, run the proposed release, create/update synthetic profile and source information, explicitly accept a plan, record progress and artifacts, record/withdraw consent, then restart with the recovery target. Confirm the same information can be read and changed, version conflict protection remains intact, and no unintended provider call occurs. Then restart the proposed release and check again.
5. Record exact source SHAs and binary hashes, migration results, replica round-trip results, ownership and recovery decisions. If any check fails, keep the current valid service in place. A previous passing rehearsal SHA is not evidence for a newly composed release.

## Recovery after writes have occurred

1. Pause writes/collectors and take a new restricted incident snapshot before changing binaries. Retain all post-release writes.
2. Use only the previously verified compatible combined recovery build. Keep the additive schema and consent tables; do not run destructive down migrations. Restore its matching frontend and API together.
3. Verify schema shape, account isolation, profile/source versions, preparation selections, accepted/history/rendering state, receipts, consent status and task/artifact persistence. Smoke-test one synthetic account without contacting a live provider. Resume writes only after these pass.
4. If the compatible build cannot read the current envelope, stay in maintenance and make a forward fix or an explicit operator-reviewed recovery plan. Never silently restore an old snapshot over newer student progress. Any snapshot restoration requires accounting for intervening data and an explicit owner decision.

## Current evidence and limits

The independently reviewed rehearsal passed 630 automated checks, 31 synthetic browser assertions, 17 deep schema checks and five additive-schema paths. The follow-up adds the embedded-link disclosure/payload regressions and the four offline envelope checks. No shared database, production deployment or live-provider request is authorized by those results. An actual-binary replica recovery rehearsal on the final publishable integration SHA and controlled live Meta validation remain release gates.
