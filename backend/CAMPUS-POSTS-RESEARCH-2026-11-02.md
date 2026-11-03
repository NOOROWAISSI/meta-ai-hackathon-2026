# Campus organizations and actual posts — 2 November 2026

The initial directory was incomplete and did not satisfy the request to collect actual organization announcements. This follow-up expands it from 11 to **47 group/chapter records** and introduces **17 actual announcements, activities and reports**, rather than just organization links.

## Coverage and evidence

All 21 universities in the Ministry university category were individually searched using their institution name with student/computing/engineering club terms, in addition to targeted Arabic, Google/GDSC, IEEE, ACM and EWB searches. This is a researched coverage expansion, **not an assertion that every existing society or campus chapter has been found**. A group without a trustworthy matching reference remains unverified. Results for similarly named institutions outside Palestine were not adopted (including Al-Azhar Egypt, Al-Ahliyya Amman and Hebron Libya).

The data now includes the official Google chapter at Birzeit and its Facebook/Instagram links, Google Al-Aqsa, self-published GDSC pages for An-Najah and Al-Azhar Gaza, IEEE Bethlehem, CSE/CS communities, programming clubs, and documented engineering chapters. The historical GDG Nablus university reference is not silently equated with the current self-published GDSC An-Najah page.

`palestine-network.json` carries each identity reference and optional social links. `referenceKind` distinguishes institutional/program references, an organization's own statement, a partner mention, and a public republication. Partner/republication references do not claim independent institutional verification. IEEE societies are not invented for every university.

Representative primary references:

- https://gdg.community.dev/gdg-on-campus-birzeit-university-birzeit-palestine/
- https://gdg.community.dev/gdg-on-campus-al-aqsa-university-gaza-state-of-palestine/
- https://www.najah.edu/en/about/history-and-traditions/campus-life/deanship-student-affairs/students-clubs/
- https://staffairs.ppu.edu/en/clubs
- https://www.aaup.edu/ieee
- https://events.vtools.ieee.org/m/509175
- https://ieee-aess.org/activities/chapters
- https://cseptuk.com/about/

## Actual content and provenance

Discover's **What are they organizing?** section displays collected text, organizer/community attribution, published date text where available, event timing, source excerpts and original-source links. Filters cover university, Facebook, Instagram, LinkedIn, organization websites, announcements and past reports. Filter choices survive internal navigation. A current primary-source announcement can open the existing internal opportunity-details view; no accepted plan is created by reading a post.

The records include the BinX Tech / IEEE Bethlehem RAG AI Bootcamp & Hackathon announcement, Birzeit Google DevOps/AI/datathon events, Al-Aqsa's Google information session, Kadoorie's programming-competition results, An-Najah's IoT/Arduino news and AAUP's engineering festival.

Facebook/Instagram public access was actually attempted. Facebook returned a temporary-access-block page and Instagram pages could not be retrieved directly. Searches nevertheless exposed public indexed/republication excerpts. **Five records are therefore explicitly `secondary_excerpt`, not primary-source reads**: three IEEE Birzeit Facebook activity excerpts and two GDG Birzeit Instagram excerpts. Their `contentUrl` identifies the public republication/indexed page, independently of `originalUrl`. Where an exact original post permalink could not be recovered, the original organization page is linked; no post URL is invented. The UI says that the original was not read directly.

Social excerpts do not become confirmed/open opportunities. The NASA excerpt's November dates have no confirmed year and remain uncertain; it is not turned into a timed preparation plan. Historical posts stay in an archive even if their original wording said to register. The Notion/robotics republications contain weekday/date discrepancies, which are preserved in their date text. An announcement's unknown deadline or organizer conditions remain unknown. A list of collaborating clubs is not a student eligibility verdict. The RAG listing names BinX Tech and IEEE Bethlehem as organizers, with other community associations kept separately.

Relevant public content:

- https://www.linkedin.com/company/binxtech
- https://cseptuk.com/events/إعلان-نتائج-newcomers-programming-competition/
- https://www.iugaza.edu.ps/p34869/
- https://www.findglocal.com/PS/Ramallah/355654031195591/IEEE---Birzeit-University-Student-Branch (public republication, not original Facebook)
- https://www.pixnoy.com/pl/profile/gdgbzu/ (indexed republication excerpts; direct original Instagram access was unavailable)

## Working periodic ingestion

`GdgCampusReader` reads event descriptions embedded in the chapter's **public HTML**, not a private Bevy API. An attempted unauthenticated directory API returned a permission error; it is not bypassed. The parser validates the chapter URL and ID, rejects other-host URLs and mismatched/cohost chapter IDs, and preserves the publisher's past/upcoming split without inferring open registration.

Official GDG HTML embeds substantial site configuration (the examined Birzeit page was about 732,000 characters). Public retrieval therefore permits a fixed 1 MiB limit **only for `gdg.community.dev`**; the existing 512 KiB limit stays in effect for other hosts. Robots checks, public-address DNS pinning, HTTPS and timeout safeguards remain unchanged.

The existing scheduler now persists these native chapter activities in MySQL. An actual collection ingested **five public GDG events** from Birzeit/Al-Aqsa. Canonical event URLs deduplicate the original curated snapshots and fetched entries. First-seen timestamps survive repeated updates, so a recheck does not manufacture a new notification. Multiple social excerpts pointing to one original profile remain separate posts rather than being incorrectly collapsed by profile URL.

Migration **8** adds `campus_activities` to the existing MySQL authority. Public `GET /api/sources/posts` returns the feed. It does not expose account data or call a model when opened. Completed activities and secondary excerpts are excluded from the opportunity projection; the current RAG announcement appears as `needs_verification` with unknown registration, fees, format and deadlines. Canonical preparation, submission and eligibility contracts are unchanged.

The researched social snapshots are **not** a claim of automatic full Facebook/Instagram ingestion. Those restricted sources still need a permitted retrieval/provider integration. Google event collection is operational; the existing Meta announcement adapter remains behind the backend and its existing budget. This follow-up did not send student data or run live preparation generation.

## Verification

- Backend: **121/121** local MySQL checks, model adapters synthetic. New checks cover public chapter parsing, wrong chapter/external URL rejection, archived/social-excerpt exclusion, no implicit model calls, idempotent storage and stable first seen.
- Frontend: **175/175** tests across 35 files. New checks cover actual post descriptions, source transparency, university/channel filtering, archive separation and retry.
- TypeScript, changed-file lint, canonical fixture validation and production build passed.
- Isolated browser: actual RAG content, internal details link, three Facebook excerpts, two Instagram excerpts, archive behavior and English/Arabic mobile layout without horizontal overflow. No real student account or personal source was used.

Existing private configuration, accounts, profile facts, saved opportunities and confirmed plan/task progress were preserved. Main-branch and preparation-model quality gates remain separate; this work does not imply the held integration is merge-approved.
