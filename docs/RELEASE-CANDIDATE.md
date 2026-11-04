# Release candidate for the hackathon submission

This branch (integration/release-candidate) is the final technical build
prepared for the Meta Global AI Developer Hackathon submission. It is a
review branch: nothing here merges into noor or main, deploys, or submits
anything by itself.

## Composition, in the agreed order

1. P1 structured plan-output safety (PR #31).
2. Corrected P2 privacy and disclosure (PR #32, including the PR #33
   corrections).
3. Profile evidence with its separate extraction opt-in (PR #29) and the
   opportunity network and submission documents (PR #30), as composed and
   rehearsed in the combined candidate (PR #34, through efaeb0e).
4. Independent-review corrections (PR #35): malformed provider envelopes
   are classified as invalid_model_output instead of escaping as server
   errors, and the selection guide is generated inside the outbound
   projection as user data, so student-controlled identifiers never enter
   the system instructions.
5. The MIT license agreed by both contributors, and the submission
   documentation.

Migration numbering on this line runs 1 to 10, with disclosure_acks at
version 9. That numbering belongs to the combined line; the standalone P2
branch keeps its own numbering (disclosure_acks at version 6) and the two
must not be renumbered into each other.

## Verification

All suites are run on the final commit of this branch before the
submission deadline (5 November 2026, 09:00 WIB): shared AI checks,
backend and MySQL checks, frontend tests with TypeScript and the
production build, state-envelope compatibility, schema verification, the
synthetic browser journey, and the recovery rehearsal with real binaries.
Exact counts are reported in the release-candidate pull request. Earlier
results on ancestor commits are historical evidence, not results for this
SHA.

## Live Meta evidence boundary

One live generation canary passed on commit d74a236 (an ancestor): a
six-task candidate through the real backend in 76.8 seconds, accepted and
persisted. PR #35 moved the selection guide from the system message into
the user-data projection; that prompt boundary has not been revalidated
live, and the authorized provider budget is exhausted. This candidate
makes no live-compatibility claim beyond the canary's original SHA. The
demo recording therefore uses the previously generated and accepted plan,
labeled as pre-generated.

## Demo seed assessment

The demo student seed on this line is remediated: the password comes from
the NEXTSTEP_DEMO_SEED_PASSWORD environment variable and seeding fails
closed when it is unset; seeding runs only through the explicit
--seed-students command and only in Development or Testing; the accounts
use example.invalid addresses and normal password hashing, and existing
accounts are never overwritten. No credential is committed on this line.

Residual item for the repository owner: three unmerged feature branches
(the PR #30 line and the standalone PR #31 and PR #32 branch tips) still
carry an older seed file with a committed development password constant.
That password protects only synthetic demo accounts in databases someone
deliberately seeds in Development or Testing, and no hosted deployment of
this application exists, so it is not exploitable against any real
system. The safe tidy-up is to update or delete those stale branches;
rewriting their history is not required for this submission and is not
done here.

## Recording

Record against this branch's final commit. The accepted six-task plan
from the live canary is preserved in a disposable database on the
integration machine; a SQL export of that synthetic state is handed over
privately (never in this repository or in GitHub comments) so the
recording environment can import it, run this build, and display the real
pre-generated plan. If the import cannot be completed, the fallback is
the offline synthetic journey state, labeled on camera as synthetic test
data. New live generation is not authorized and must not be presented as
part of the recording.
