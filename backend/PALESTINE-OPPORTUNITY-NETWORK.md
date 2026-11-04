# Palestine opportunity network

The initial snapshot below was expanded to 47 group/chapter records and an actual organization-post feed. Current scope, social-source provenance, migration 8 and verification are documented in [CAMPUS-POSTS-RESEARCH-2026-11-02.md](CAMPUS-POSTS-RESEARCH-2026-11-02.md). The original 11-group / 45-source figures below describe the initial verification snapshot, not exhaustive current coverage.

## Delivered

- A searchable Discover directory of all 21 universities in the Ministry's university category, with Arabic and English names, official links and identity references. University colleges are a separate Ministry category and are not silently counted as universities.
- Eleven documented student/community groups: IEEE at An-Najah, Birzeit, AAUP, PPU, Al-Quds, IUG and Palestine Ahliya; EWB at An-Najah; the university-documented Google groups at An-Najah/Nablus and PPU; and An-Najah's Microsoft .NET club. A historical institutional reference establishes a documented identity, not current officer appointments or guaranteed activity. Other branches remain unverified, not assumed absent.
- University filtering alongside existing search, scope and type filters. The existing opportunity stacks, colors and navigation are retained. Training is a discovery projection; the shared v0.2 hackathon contract and planning access checks are unchanged.
- Account-owned university follows, a count of newly discovered listings since follow/last-seen, and explicit Mark seen. Only confirmed writes change the displayed follow state. Unfollowing never changes saved opportunities, plans or progress.
- Two source-checked upcoming activities from the official Palestine Innovation Summit agenda. Birzeit's Mini Hackathon & Demo Day explicitly describes selected existing projects: it is not presented as permission for a new student to enter. The remote product workshop names JHF as organizer, independently of the summit host. Deadlines, fees and time zones remain unknown where unpublished.

## Primary references

- Ministry directory: https://www.mohe.pna.ps/Higher-Education/Institutions/Universities
- Each group carries its own institutional/IEEE `referenceUrl` in `NextStep.Api/Data/palestine-network.json`.
- Upcoming activity source: https://www.technopark.ps/innovationsummit/en/agenda
- Canonical addresses for Al-Azhar, PPU, Al-Quds, AOU and Israa were checked from official redirects and explicitly updated in the directory. Retrieval safeguards were not relaxed to follow arbitrary redirects.

## Collection and Meta boundary

The existing scheduler checks due sources every five minutes, with a normal twelve-hour interval for successful checks/manual-review sources and a one-hour retry interval for retrieval failures. A sweep processes at most 12 sources and four pages per source by default. Oldest/unseen sources are processed first so later institutions are not starved. A MySQL advisory lock prevents overlapping collectors; the CLI now reports a busy collector instead of claiming a second collection succeeded.

Public HTML goes through the existing robots, public-address DNS pinning, HTTPS, size and timeout safeguards. Structured Course/Event data and the Google catalog adapter remain preferred. Unstructured Palestinian announcement pages can use the new server-only `IAnnouncementIntelligence` adapter. It uses the existing Meta structured-response transport; it is not a social search API and does not grant Facebook/Instagram access.

Meta classifies announcement/recap/directory/other, extracts literal title/organizer/description/invitation passages, and proposes a constrained technical topic/type. Server validation requires source quotations and matching subject words. The website host is never silently substituted for the organizer. Format, registration, fees and dates remain unknown. A university association identifies source coverage, not a confirmed event venue. Generic university news is never attributed to an IEEE branch merely because that branch's collection feed points there.

The adapter accepts at most 18,000 normalized source characters. Its page-content cache survives restarts in MySQL. Successful and rejected unchanged pages do not issue repeated calls; transient failures have a 24-hour cooldown. Claims are counted conservatively against a default **three extraction attempts per UTC day**, including unsuccessful attempts. Collection remains serialized by the collector's database lock. The configured hard ceiling is 30; zero disables new attempts. A generated listing is labelled `needs_verification`, never human-reviewed or eligible. Old articles with a recognizable publication date older than 45 days are excluded before calling the model. Publication formats not recognized remain uncertain, and registration is never inferred open.

Settings:

```json
{
  "SourceCollection": {
    "Enabled": true,
    "IntervalHours": 12,
    "MaxSourcesPerSweep": 12,
    "MaxPagesPerSource": 4,
    "MetaExtraction": { "Enabled": true, "MaxDailyRequests": 3 }
  }
}
```

Provider credentials remain in backend-only configuration. No student profile, CV or repository is sent by the public-source collector. Instagram sources are explicitly manual-review records until a separately authorized retrieval integration exists. A reachable home page does not mean every announcement is retrievable or currently accepting participants.

## Storage and APIs

Migration 7 adds `announcement_extractions` and `campus_follows` to the existing MySQL authority. Existing accounts, profile evidence, saved state, plans and tasks are preserved.

- Public `GET /api/sources/network`: institution/group identities and references.
- Existing `GET /api/sources` and `/api/sources/status`: source registration and actual retrieval outcomes, plus extraction counters.
- Signed-in `GET /api/campus-follows`: account-owned choices and new listing IDs.
- `PUT /api/campus-follows/{id}`: `{ "following": true, "expectedAccountId": "…" }`.
- `PUT /api/campus-follows/{id}/seen`: `{ "expectedAccountId": "…" }`.

Follow mutations require the current account, existing university ID, existing same-origin write protections and confirmed database storage. Repeating Follow does not reset the original follow date. Notifications mean newly discovered source records, not verified enrollment or guaranteed availability. Old curated records without a known first-seen timestamp do not create invented notifications.

Run the existing migration command before starting an older database. A targeted source sweep uses the existing `--collect-sources --source university-birzeit` CLI arguments. Limits are configurable; a sweep is bounded and may defer other sources. No additional public administration/crawl endpoint is exposed.

## Verification on 2 November 2026

- Backend: **118/118** checks against real local MySQL; all model responses synthetic in the regression suite. Tests cover literal evidence, recap rejection, unsupported topics, old publications, persisted positive/negative caching, cooldown/no duplicate request, zero budget, account ownership, idempotent follows, new listing notifications/Mark seen and preservation of empty plan state.
- Frontend: **172/172** tests across 34 files, including no optimistic follow success and retained state after failed removal.
- Existing AI module: **177/177** offline checks.
- TypeScript, changed-file lint, canonical contract fixture validation and production build pass.
- Isolated browser: 21 selectable universities, real Birzeit event filtering, clear filter recovery, English/Arabic RTL and 390px mobile without horizontal overflow. No real student account or professional source was used.
- One bounded real root-page sweep attempted all **45** registered sources. After correcting five canonical addresses, **24** were readable, **4** explicitly needed manual review, **8** had unavailable robots checks, **4** returned 403, **1** exceeded the size limit, **2** were unavailable and **2** still redirected. These are source observations, not 45 successfully populated feeds.
- **Three live public-page extraction attempts** were made under the daily cap, with no provider failures recorded and **zero publishable extracted listings**. These observations do not establish model-quality acceptance. The two new summit activities are separately source-checked records, not falsely presented as successful live model extraction.

## Remaining boundaries

The directory covers the Ministry university list, not an exhaustive verified inventory of every campus chapter. Social access restrictions and unavailable official sites still need source-owner access or permitted adapters. A future reviewed-resource or plan-generation change must keep its own contract and quality gates. This work does not resolve Rofi's separate plan-output policy finding or authorize merging the held integration stack into `main`.
