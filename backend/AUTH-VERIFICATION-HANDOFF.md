# Google sign-in and Gmail recovery handoff

This follow-up targets `noor`. It does not merge the pending contract/time-governance PR, change the Meta provider client, or introduce a new authentication schema.

## What changed

- Development can load optional ignored `backend/.secrets/google.json`, with environment variables taking precedence. `Setup-Google.ps1` imports a Google Web OAuth download or accepts masked local input; `-Check` reports configuration presence without printing credentials.
- Google sign-in explicitly enables PKCE and preserves the allowlisted event/profile/plan return destination after cancellation or an existing-account conflict. Provider tokens are not saved. Verified Google email is required; matching email alone never links an existing password account.
- Login explains an existing-account conflict. Forgot Password explains that Google-only accounts should use Google sign-in and that local recovery does not reset a Google password.
- Existing Gmail SMTP setup and password-recovery endpoints are reused. This PR does not implement a second recovery service.

## Local setup

Follow [GOOGLE-LOGIN.md](GOOGLE-LOGIN.md), then run the existing `backend/Setup-Gmail.ps1` locally for Gmail SMTP. Enter the project email and Gmail App Password only in that terminal. Restart `backend/Start-Api.ps1` after changing private settings. Google OAuth credentials and Gmail SMTP credentials serve different purposes.

Keep `.secrets`, downloaded OAuth JSON, SMTP passwords, recovery pepper, provider keys and account data outside version control. Each developer configures private credentials independently; no credential handoff through PR comments is needed.

## Verification

Automated backend checks use a test-only OAuth backchannel and actual local MySQL transactions. They cover same-origin callbacks and PKCE, persisted application sessions, selected-event return navigation, sign-out, cancelled/invalid state, unverified email rejection, and refusal to auto-link a password account. These checks do not call Google.

On 2026-10-29 the account owner confirmed the local manual checks: Google sign-in/sign-out, Gmail recovery-code delivery and password reset, and persistence of account data. This owner-reported verification is separate from automated checks and is not production deployment approval.

Production still requires its own OAuth client, HTTPS callbacks, server secret storage, and deployment-specific mail configuration. No production or live Meta verification is claimed here.
