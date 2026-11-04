# Source data review — 31 October 2026

Reviewed current public event pages to replace document-only timing references with source-backed data. Opportunity IDs, requirement IDs, self-reported submission evidence and confirmed plans are preserved. The five original event records now have explicit reviewed timing evidence, source hosts, relevant topic tags and versioned source fingerprints. Missing/ambiguous facts stay unknown; source coverage remains incomplete.

| Record | Public sources | Important retained limits |
|---|---|---|
| E01 · LaunchPad | [Rules](https://launchpad-hacks.devpost.com/rules) | Deadline header supplies EST. The start's Eastern Time offset is not explicit; no award contents are invented. |
| E02 · Global AI Builder | [Rules](https://global-ai-builders-challenge.devpost.com/rules), [overview](https://global-ai-builders-challenge.devpost.com/) | Published PST/America-Los-Angeles timing is used. Certificates have participation/award conditions; sponsor additions are not guaranteed. |
| E03 · HETIC | [Rules](https://ai-agents-founders-hetic-26.devpost.com/rules), [overview](https://ai-agents-founders-hetic-26.devpost.com/) | Start-window and team-cap conflicts remain visible. Age-or-majority interpretation remains unresolved. |
| E04 · PayPal | [Rules](https://paypalaihackathon.devpost.com/rules), [overview](https://paypalaihackathon.devpost.com/) | The published deadline is separate from registration. Approximate results timing stays approximate; inconsistent prize totals are not collapsed into a claimed amount. |
| E05 · Cosmo | [Rules](https://cosmohacks.devpost.com/rules), [overview](https://cosmohacks.devpost.com/) | CST is explicitly UTC−6. Registration and submission share a cutoff only because the organizer states that relationship. Sponsor access remains conditional. |

The existing Meta snapshot retains its ET/EST conflict and unconfirmed submission instant. No source is marked as a complete eligibility or submission inventory.

## Learning resources

Rechecked the seven existing official learning pages: [Google ML](https://developers.google.com/machine-learning/crash-course), Harvard [CS50x](https://cs50.harvard.edu/x/), [Python](https://cs50.harvard.edu/python/), [SQL](https://cs50.harvard.edu/sql/), [Web](https://cs50.harvard.edu/web/), Microsoft [Python fundamentals](https://learn.microsoft.com/en-us/training/paths/get-started-with-python-fundamentals/), and [AI concepts](https://learn.microsoft.com/en-us/training/paths/ai-concepts/).

`Data/resource-links.json` adds six manually reviewed optional preparation relationships for the previously empty event groups. The API resolves them against the existing reviewed course catalog and keeps the same `resource-{listingId}` IDs. Matching a topic or adding a resource is not an organizer requirement, proof of personal suitability, free-access guarantee or certificate entitlement. Missing/unreviewed records are not promoted; stale links remain withheld by the existing task UI. Empty resource arrays remain valid.

The Discovery projection now actually exposes canonical reviewed registration cutoffs and topic tags, instead of discarding them. Submission deadlines are never substituted for missing registration deadlines. Known deadline instants use published standard-zone/region information; ambiguous starts and approximate dates retain their original text without an invented instant.

The source review is a manual published-data snapshot, not a social scraping integration or proof of live participant eligibility. It does not change automatic-collection safeguards or erase accepted progress.
