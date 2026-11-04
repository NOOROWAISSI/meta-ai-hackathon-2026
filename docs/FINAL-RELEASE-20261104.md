# Final application integration — 4 November 2026

Application revision: `f8cdfc3` (the release-candidate history through
`d5e4247`, followed by the two recording fixes below). The repository
owner requested integration into `noor` and then `main`. The publishing
PRs record their exact merge SHAs; a local build is not a deployment.

## Included work

The release candidate already composes P1 structured-output safety,
corrected P2 disclosure/privacy, the reviewed profile-evidence pipeline,
opportunity discovery and campus collection, preparation/progress,
accounts and password recovery, and the agreed MIT license. See
[the candidate record](RELEASE-CANDIDATE.md) for its original composition.

Two additional application commits address issues observed while recording:

- `6f71e29`: GitHub source inputs persist as account-scoped browser drafts;
  an existing imported GitHub source can prefill the inputs. Refreshing
  does not automatically fetch repositories, import code or call Meta.
  Fact confirmation remains clickable and reports validation errors
  explicitly. Up to 100 selected facts can be accepted, subject to the
  existing canonical profile collection limits. A missing project
  contribution remains unknown rather than being invented. Acceptance
  remains explicit, transactional, version-checked and idempotent.
- `f8cdfc3`: the evidence-analysis adapter supports an overall deadline
  up to 180 seconds, with a 190-second HTTP-client deadline and a
  200-second browser deadline. Set `MetaAi__OverallTimeoutSeconds=180`
  when that larger analysis allowance is required. There is no automatic
  resubmission of private source material, and these limits do not promise
  that a slow provider will return successfully.

Public v0.2 DTOs and task statuses are unchanged. Credentials, account
records, browser sessions, private audit packages and the canary SQL are
excluded from publication. Imported demonstration plans are not silently
seeded into other accounts by application code.

## Independent validation

The exact application changes above passed:

- Frontend: 199 tests across 39 files.
- Backend integration: 151 checks against a dedicated MySQL 8.4 database,
  after applying migrations through version 10.
- Shared AI safety: 316 offline checks; no live provider requests.
- Stored-state compatibility: 4 checks.
- Deep schema verification: 17 column/foreign-key/object checks.
- Browser/API/MySQL journey: 31 assertions, including explicit disclosure,
  candidate acceptance, reload, Done progress, retained work, malformed
  output rejection, version conflicts, cross-account isolation and the
  extraction opt-in boundary. The provider transport was synthetic; the
  production Meta client, decoder and application persistence were used.
- Changed-file ESLint, TypeScript, canonical fixture validation and the
  frontend production build.

The existing reviewed dependency installation was reused with the matching
lockfile; this is not a claim of another clean dependency install. The
first backend attempt preceded schema initialization on the fresh test
database; after applying migrations, all 151 checks passed.

## Live-provider and recording boundary

The genuine accepted six-task E01 canary remains evidence of its original
earlier live generation only. No new live Meta call was made by this final
merge validation. Later source-analysis requests have experienced provider
timeouts locally; the longer deadline is a bounded mitigation, not proof
that provider latency is resolved. Final-prompt live compatibility and
hosted deployment are not certified by these offline checks.

The demo must identify previously generated results as such. A copied
canary plan retains its original assessment context and rendering proof;
it must not be presented as freshly personalized to a different account.
