# Expanded scope: accounts and real-source intake

See `../PRODUCT-SCOPE-UPDATE.md` for Noor's explicit approval of Palestine + global online opportunities, courses/hackathons/competitions/workshops, Google + password access, and persistent Not interested recovery.

## Accounts

The login/create-account screen is `/login`. Email registration/login/logout uses real MySQL records and ASP.NET's PasswordHasher. A single transaction creates the account, canonical state and initial session. Tokens are random, hashed in MySQL, HttpOnly, SameSite=Strict and Secure outside Development/Testing. Multiple devices can sign in; logout revokes only the current token. No password or auth token is stored in localStorage/IndexedDB or returned in the response body.

Public endpoints: GET `/api/auth/config`, GET `/api/auth/me`, POST `/api/auth/register`, POST `/api/auth/login`, POST `/api/auth/logout`, GET `/api/auth/google`. Write requests keep the existing custom-header and Origin protection. Credential endpoints are rate-limited. Login uses the same failure message for an unknown address or incorrect password. Return destinations are restricted to local approved routes. Accounts never infer student status, residence, age, skill or organizer acceptance.

Google uses the official ASP.NET Google authentication handler with state/correlation validation, verified Google email, server-side provider credentials and no browser provider tokens. Automatic linking to a password account with the same email is rejected. Set these **server** environment values:

```text
Authentication__Google__ClientId=<your Google OAuth client ID>
Authentication__Google__ClientSecret=<your private client secret>
```

Register the exact callback, e.g. `http://127.0.0.1:8082/api/auth/google/callback`, in your Google OAuth web client. Use HTTPS for deployment. Restart the API after configuring it. Until configured, the UI explicitly disables Google sign-in; no live Google login is claimed tested. See [Microsoft's Google configuration instructions](https://learn.microsoft.com/aspnet/core/security/authentication/social/google-logins?view=aspnetcore-8.0).

Email/password accounts are not email-verified. Password recovery is implemented with live SMTP delivery pending configuration (see PASSWORD-RECOVERY.md). Email confirmation, account-provider linking and production lockout/operational monitoring remain release work. Do not describe an unverified email as independent identity evidence. Existing browser-demo profile/plans are not silently imported or synchronized just because an account signs in. Switching those repositories to the account's server authority remains a separate integration step.

## Real catalog

`GET /api/listings` is a public discovery projection: initially 7 official courses/learning paths, Meta's official 2026 hackathon example, and the 5 document-derived hackathon snapshots. `/opportunities` renders these records with kind, source, original link, review date, and explicit unknown fees/deadlines. It does not apply hackathon eligibility logic or fabricate team rules for a course. `/api/opportunities` remains the canonical hackathon-detail contract; this projection does not replace it.

`GET /api/sources` returns 11 curated source registrations. Noor's exact three Instagram handles are retained. An-Najah's official engineering faculty page links `ewb.nnu` and `facebook.com/ewbnajah`; Prime/Knowledge identities are not substituted with similarly named sites. Source registration alone is not a published course announcement.

The first collection can be reproduced with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File backend/Collect-Sources.ps1
```

It fetches only curated public source URLs, with a 12-second per-page timeout, 512 KiB body limit, 100-link cap, no automatic redirects, no arbitrary URL input, no page script execution, and no source/profile/model text execution. Same-host candidate links are deduplicated and stored in MySQL `intake_candidates` as pending_review. `source_runs` records actual attempts and failures. Nothing is automatically published or marked legally/individually eligible. No Meta call is used for intake.

Initial run: 26 candidate links collected. Social pages require manual/authorized access; no login bypass or third-party credential workaround is attempted. Some JavaScript-heavy pages yielded zero links, and the GDG page exceeded the body limit. These are visible collection limitations, not fabricated complete coverage. Scheduling, permitted social/search API integration, announcement extraction and reviewer publication tooling are subsequent work.

Reviewed listings are maintained separately from pending discoveries. Every newly published announcement must retain its discovery link, attributable organizer source, captured facts, review metadata, unknowns and conflicts. A public official social post may itself be the authoritative announcement; do not invent a separate institutional URL. The current starter catalog is a source-backed first batch, not a claim that all relevant opportunities have been collected.

Meta search/translation are proposed separately for Rofi and are not part of this application-only implementation.
