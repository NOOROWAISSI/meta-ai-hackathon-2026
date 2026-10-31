# Email password recovery

The redesigned `/login` uses one centered form; `/forgot-password` provides email → six-digit code → new password → confirmed success, with Arabic/English labels, keyboard focus, mobile layout, resend cooldown and preserved inputs on failure. Return context is carried back to sign-in. Codes, reset grants and passwords stay in component memory and are never put in browser persistence, URLs or application logs.

## Server setup

For Noor's selected dedicated Gmail sender: enable Google 2-Step Verification, create an [App Password](https://myaccount.google.com/apppasswords), then run locally:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File backend/Setup-Gmail.ps1
```

The script prompts for the sender address and masks the App Password, writes the SMTP configuration plus a random recovery pepper to ignored `backend/.secrets/email.json`, and preserves an existing pepper. It does not send mail. Restart the API afterward. The development host reads that private file; production uses environment variables or a secret store. Local settings are private configuration on disk and must not be shared or committed. Google may restrict App Passwords for organization-managed or Advanced Protection accounts; see [Google's requirements](https://support.google.com/accounts/answer/185833?hl=en).

Set these through .NET user secrets or backend environment variables, never committed configuration:

| Environment variable | Value |
| --- | --- |
| `Email__Host` | Your SMTP provider hostname |
| `Email__Port` | STARTTLS port, normally `587` |
| `Email__Username` | Provider SMTP username |
| `Email__Password` | Provider SMTP/app password |
| `Email__From` | Verified sender email address |
| `Authentication__RecoveryPepper` | Random server-only secret, at least 32 characters |

The SMTP adapter requires authenticated STARTTLS and validates certificates using platform defaults. Implicit TLS on port 465 is not supported by this adapter. Gmail requires a dedicated account with an app password and the corresponding Google account configuration; an ordinary account password is not the intended credential. Confirm provider-specific setup before use.

Restart the backend after setting secrets. Without configuration, requesting a code returns a clear unavailable error; no email is claimed to have been sent. Local end-to-end checks use an injected test sender, not the user's mailbox or a fake production fallback. No real email delivery has been verified on this host.

## Flow and persistence

`POST /api/auth/request-password-reset` accepts `{email, language}` and returns `{challengeId, expiresInSeconds, resendAfterSeconds}`. The response does not reveal whether the account exists or uses Google only. Only an existing password account receives an email. Codes last 10 minutes, allow at most five guesses, and can be requested once per minute per normalized email. Existing IP rate limits also apply.

`POST /api/auth/verify-password-reset` accepts `{challengeId, code}` and returns a short-lived reset token only after successful verification. This verification consumes further use of the code. `POST /api/auth/reset-password` accepts `{challengeId, resetToken, password}` and returns 204 only after an atomic commit.

Schema version 4 adds the `password_recovery` table without modifying existing saved data. Codes and reset tokens are stored as HMAC hashes keyed by the server pepper; the six-digit code is never stored in plaintext. Successful reset preserves the account, profile, plans and progress, consumes the recovery grant and revokes all account sessions. Password-login checks and session creation share a transaction so an old-password login cannot race past reset session revocation. Reset is never used to silently create a password for a Google-only account.

Resending invalidates the previous challenge after the cooldown. A mail failure invalidates the unsent challenge and returns an error. Provider acceptance does not guarantee inbox delivery; the UI advises checking spam. Changing the recovery pepper invalidates outstanding recovery challenges. Expired rows older than one day are pruned in bounded batches during new requests.

Tests cover confirmed reset, single-use grants, old-session revocation, saved-profile retention, guess limits, unknown accounts, cooldown and failed-send retry. Production still needs actual provider credentials, inbox-delivery verification, and operational monitoring. Account-existence timing equivalence is not guaranteed by synchronous SMTP sending; high-volume deployment should use a durable mail queue.

References: [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [Microsoft STARTTLS behavior](https://learn.microsoft.com/en-us/dotnet/api/system.net.mail.smtpclient.enablessl?view=net-8.0).
