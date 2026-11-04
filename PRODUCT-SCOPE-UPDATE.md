# User-confirmed scope update — 28 October 2026

This records Noor's explicit changes to the earlier five-hackathon MVP boundary. It does not silently rewrite the supplied v0.2 documents or claim Rofi approved later integration details.

- Initial geography: Palestine plus global online opportunities.
- Catalog includes actual courses, hackathons, competitions and workshops from companies, universities, educational institutions and student societies. The earlier five canonical hackathon records are a starting slice, not the final size or full product scope.
- Accounts: email/password plus Google sign-in. Browsing remains available without an account. Google requires server-side client configuration; the button must not fake a successful OAuth flow.
- Not interested must remain discoverable with restore/Undo after the toast disappears, and persist across refresh. Hiding does not remove a bookmark or accepted preparation plan.
- Exact user-provided sources: `instagram.com/ewb.nnu/`, `instagram.com/primeacademy12/`, `instagram.com/eknowledge.learn/`. No similarly named academy may be substituted. An-Najah's official EWB society page explicitly links the first handle.

## Collection and publication

Search engines and public social announcements can discover an opportunity. Retain the original discovery source and confirm the material facts against the organizer where possible. An official social announcement can itself be the attributable source; absence of a separate website is not grounds to invent one. Restrictions, inaccessible posts, missing dates/costs and conflicts stay visible.

Source intake is separate from publication. `SourceCollector` retrieves only approved public URLs, bounds time/body/links, records capture failures, deduplicates candidate URLs, and stores candidates as pending_review in MySQL. It does not execute source text, bypass social login, accept arbitrary fetch URLs, or let the model publish eligibility rules. Facebook/Instagram search or API connectors need permitted access before claiming automated coverage. New post URLs can be reviewed directly; inaccessible accounts are not scraped via third-party credential workarounds.

`ListingSummary` is a discovery projection extending the scope. It does not replace canonical `Opportunity` or apply hackathon rule semantics to a course. The initial real listings include seven official online courses/learning paths, the official Meta example with its applications window separately labelled closed, and the five document-derived hackathon snapshots. Only captured fields are presented; certificates/fees/deadlines are not inferred. Local institutions are registered sources, not fabricated active course announcements.

The current real-source page links to organizer pages. Full personalized details/saving/planning across the expanded opportunity types, publication/admin review tooling, source scheduling/search APIs, and replacing the existing labelled browser-demo repositories with account-owned server state are follow-on integration work. Account registration/login alone does not silently upload or synchronize the browser demo.
