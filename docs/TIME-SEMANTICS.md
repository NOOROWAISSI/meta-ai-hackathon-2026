# Date, time and timezone semantics — v0.2

## Instants

An instant is a real point on the timeline. Use an ISO-style `YYYY-MM-DDTHH:mm:ss[.fraction]Z` or `YYYY-MM-DDTHH:mm:ss[.fraction]±HH:mm` string with an explicit known offset. The application profile supports one to seven fractional digits, valid Gregorian dates (years 0001–9999), hours 00–23, minutes/seconds 00–59, and offsets within ±14:00. Whitespace, impossible dates, leap-second notation and RFC-style `-00:00` (unknown local offset) are not trusted instants. UTC and numeric-offset strings may represent the same instant; retain the original offset/text when it is source evidence.

Never infer the server/browser timezone, midnight or a DST resolution for an offset-less value. A named source timezone alone does not make an ambiguous local date a confirmed instant. A curator must supply reviewed evidence for the resolved offset, especially around DST overlaps/gaps. No automatic resolution is added here.

This is the application's constrained timestamp profile, not a claim to accept every RFC timestamp form. The unknown-local-offset distinction is described in [RFC 3339 section 4.3](https://www.rfc-editor.org/rfc/rfc3339#section-4.3); the application conservatively excludes that form from trusted instants.

Server-generated save/evaluation/generation/expiry and receipt timestamps use UTC-based values with an explicit offset. `Z` and `+00:00` are both UTC representations. `reportedAt`, `acceptedAt`, `answeredAt`, `checkedAt`, `reviewedAt`, `lastReviewedAt`, saved metadata and plan budget instants follow the same explicit-offset rule. A timestamp records provenance/time, not independent proof of experience or submission.

## Organizer dates and uncertainty

Trusted deadline/start instants require a reviewed, non-stale timeline event, one unambiguous claim and reviewed evidence with a valid checkedAt. Registration and project submission remain separate kinds. Unknown/conflicting/multiple claims and date-only/offset-less values stay unknown for scheduling; preserve published passages and source-timezone labels. No countdown or plan promise is derived from them. The frontend also withholds a reliable preparation deadline while the overall opportunity requires verification.

Invalid/missing review timestamps cannot establish reviewed rule evidence or complete source coverage. Discovery projections expose uncertain registration instants as null while retaining published date text in the verification note and leaving original source records/passages unchanged. A separately published open/closed state is not inferred from an ambiguous date.

## Calendar preferences

`targetDate` is a `YYYY-MM-DD` calendar preference, not an instant. It may be blank. Validate the calendar date but do not append a timezone, convert it to UTC midnight, or use it as an organizer's submission deadline. Null/missing source timestamps remain unknown; unknown typed profile facts need no reportedAt and are not converted into failed requirements or zero availability.

## Display and precision

Timezone selection changes presentation of a validated instant only. Preserve the authoritative timestamp, original source passage/offset and context; changing display timezone must not change stored deadlines or plan versions. The browser may render milliseconds or shorter human text; do not use shortened display strings to rewrite source evidence or coalesce uncertain claims. The frontend now conservatively requires a single timeline claim, matching the application timeline guard.

## Validation and failure behavior

`ContractTime` centralizes invariant backend parsing. The frontend contract time helper enforces matching calendar/offset rules for deadline/metadata validation and display. Profile writes reject invalid instant metadata with the existing invalid_input envelope and preserve confirmed data. Optional calendar values stay blank/date-only. Server-owned save times are generated after successful storage validation. Existing invalid historical data is not silently normalized or deleted; it needs an explicitly corrected/reconfirmed value before operations requiring valid canonical facts.

Regression scope: explicit UTC/offset equivalence, host-culture independence, valid leap dates, impossible dates, unknown/missing offsets, preserved raw claims, conflicting/multiple deadlines, metadata review trust, date-only preferences, display-zone invariance and failed-save preservation. No live provider call or model-contract change is needed.
