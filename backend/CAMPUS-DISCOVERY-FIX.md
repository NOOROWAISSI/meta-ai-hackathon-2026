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

## Follow-up: actual enrollment and source freshness

The earlier April Python invitation was traced to its actual [course detail page](https://www.najah.ai/Courses/Details/3281), which explicitly displays `The Course is Completed`. It is now closed/ended and omitted from current discovery, while its history remains in the archive.

Discovery now defaults to current/upcoming items. Separate views expose unconfirmed availability and archived/closed activities. An old or undated announcement is not made current by a new collection timestamp. Published future activity dates describe timing only; registration and participation remain separately checked. A native course enrollment observation expires after seven days or a failed source check.

The registered [Najah Academy live catalog](https://www.najah.ai/Courses) uses `onclick` session links instead of normal anchors. A bounded native adapter follows those public course links, preserves their teacher/session identifiers, and checks the actual enrollment-control region. `Enroll now` and `The Course is Completed` are distinguished from navigation login links and hidden registration/completion modals. Current verified sessions at this check include AI foundations, digital skills, and AI-assisted digital marketing. No publication/start date or deadline is inferred from a catalog card.

The branch's [IEEE activities page](https://ieeennu.com/activities) publicly calls `/api/events/approved`. Its native reader supports the public event envelope, collects only activity fields, and never interprets moderation `APPROVED` as student approval. Forty-eight real records were read in the local collection run; past or undated unconfirmed records remain outside current openings. The university-referenced [EWB activity site](https://ewbpal.com/activities/) is also registered. Restricted Facebook/Instagram retrieval is still not treated as evidence of no activity; authenticated/private social content is not fetched.

These adapters use public sources with no model calls. For Najah's robots file, only its observed same-origin redirect to the explicit `/Home/HandleError/404` handler is treated as a missing robots file; other redirects and restrictions remain unavailable.

Follow-up validation: 127/127 backend/MySQL checks, 180/180 frontend checks, TypeScript, changed-file lint, canonical contract validation and production build passed. An isolated browser verified Najah's current course sessions, the completed April course only in the archive, a separate unconfirmed view, mobile sizing and zero model calls. Live public-source collection was checked through the application repository; no student accounts or plans were changed.

- Backend/MySQL checks: 124/124.
- Frontend suite: 180/180 across 36 files, including cross-university attribution and false-empty-state regression checks.
- Changed-file lint, TypeScript, canonical contract fixture validation and production build passed.
- Browser checks: Najah, Bethlehem, QOU and Dar al-Kalima each displayed collected activity without a false no-match state; 390px mobile viewport had no horizontal overflow. The browser used an isolated guest profile.
- Existing accounts, accepted plans, participation evidence and confirmed progress were preserved.
