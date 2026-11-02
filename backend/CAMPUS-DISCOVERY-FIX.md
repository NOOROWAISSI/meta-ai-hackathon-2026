# Campus discovery visibility — 2 November 2026

## Findings and changes

The public feed contained university posts while the opportunity-list empty state implied there was no activity. Campus posts now follow the same university, topic-search, type and geographical filters as the catalog. When matching posts exist, discovery links to them instead of displaying the generic no-match claim. A failed source check is explicitly distinguished from an absence of university activity. Past reports and secondary social excerpts remain in the post feed, not promoted to reviewed or open opportunities.

Joint announcements previously projected only the first university. The discovery-only `universityIds` extension now preserves all existing attributed universities for filtering and followed-university notifications; the legacy singular field remains compatible. This does not modify the canonical eligibility or preparation contract.

Eight source-backed records were added, bringing the running development snapshot to 25 organization/community posts and 28 opportunity listings in total (the latter includes global courses and hackathons, not 28 university opportunities). This is partial collection coverage, not an assertion that every Palestinian university or social post has been collected.

## Sources and uncertainty

- [PTUK computer engineering club events](https://cseptuk.com/events/): a problem-solving invitation, listed as upcoming with a February day/month but no year. The detail page was unavailable during this check. Current registration and event year remain unknown.
- [An-Najah continuing education Python data analysis announcement](https://zajelnews.najah.edu/news/article/6447/): published 16 April 2026; starts when enough participants enroll. The summary explicitly flags its age. No current registration status is inferred.
- [Palestine Innovation Summit agenda](https://www.technopark.ps/innovationsummit/en/agenda): Bethlehem University/ARIJ's Opportunity Lab on 18 November; QOU's hub introduction on 22 November; Dar al-Kalima's showcase on 21 November; Taqat Work's Gaza bootcamp on 17 November; and JHF's remote product workshop on 21 November. A showcase or hub introduction stays a community update, not a fabricated competition. Published clock times have no confirmed time zone, deadlines, fees or student eligibility.
- [An-Najah's IEEEXtreme report](https://posts.najah.edu/ar/articles/تحت-إشراف-ومتابعة-عمادة-شؤون-الطلبة-وكلية-الهندسة-فرق-جامعة-النجاح-الوطنية): 30 October report; explicitly archived as an ended activity.

Public Facebook/Instagram collection remains access-dependent. Existing secondary excerpts retain their provenance labels. No new live model calls or invented registration claims were used for these additions.

## Verification

- Backend/MySQL checks: 124/124.
- Frontend suite: 180/180 across 36 files, including cross-university attribution and false-empty-state regression checks.
- Changed-file lint, TypeScript, canonical contract fixture validation and production build passed.
- Browser checks: Najah, Bethlehem, QOU and Dar al-Kalima each displayed collected activity without a false no-match state; 390px mobile viewport had no horizontal overflow. The browser used an isolated guest profile.
- Existing accounts, accepted plans, participation evidence and confirmed progress were preserved.
