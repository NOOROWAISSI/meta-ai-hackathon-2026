# Google sign-in — local setup

The application uses ASP.NET Core's server-side Google OAuth flow. The browser receives only the application session cookie; provider credentials/tokens are not stored in frontend code or localStorage. This setup does not enable Gmail access or send email.

## Google Cloud configuration

1. Create a **NextStep Development** project in https://console.cloud.google.com/projectcreate using the project's Google account.
2. Open **Google Auth Platform**. Configure Branding with app name NextStep, a support email and a developer contact. Use External audience for students outside one Workspace organization; keep the development app in Testing and add intended test accounts where the console requires them.
3. Create an OAuth **Web application** client under Clients. This is not an API key, desktop client or service account. Basic sign-in uses profile/email scopes only; do not request Gmail/Drive access.
4. Add both exact **Authorized redirect URIs**:

```text
http://127.0.0.1:8082/api/auth/google/callback
http://localhost:8082/api/auth/google/callback
```

The app starts Google sign-in through `/api/auth/google` on the frontend's origin. Vite proxies `/api` to ASP.NET Core on port 5080 and preserves the host. Register the browser-facing origin/callback, not the provider default `/signin-google`. Use the same host consistently throughout a login. No Google JavaScript SDK origin registration is needed for this server-driven flow. If deliberately using the backend directly, that browser-facing callback must be separately registered; it is not the default local journey.

5. Download the new web client's credential JSON or copy its Client ID and secret privately. Never paste the secret into chat or GitHub.

## Local secret setup

From the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File backend/Setup-Google.ps1 -Check
powershell -NoProfile -ExecutionPolicy Bypass -File backend/Setup-Google.ps1 -CredentialsFile 'C:\path\to\downloaded-client.json'
```

Alternatively run Setup-Google.ps1 without arguments: it prompts for the client ID and masks secret input. It writes only selected application configuration keys under ignored `backend/.secrets/google.json`; it does not copy arbitrary downloaded settings or expose credentials in output. Development loads the file; environment overrides remain supported. Restart the backend after setup. Production uses private server configuration/environment/secret storage and HTTPS, not this local file loader.

Check `http://127.0.0.1:8082/api/auth/config`: googleEnabled should become true. It reports configuration presence, not successful provider verification. Open `/login`, choose Continue with Google, use an allowed test account and verify you return to the selected page. Reload and confirm the application account remains signed in, then sign out. Local development account data is preserved; no database reset is needed.

## Errors and boundaries

- redirect_uri_mismatch: compare the exact URL, host, port and callback path with the Cloud client settings.
- Consent denied/invalid state: return safely to login with the prior allowed destination; no account should be created.
- Existing password account with the same email: use its existing method. The application deliberately does not auto-link identities by email alone.
- Google must supply a verified email. PKCE and protected state/correlation are enabled. Synthetic tests verify callback handling, but cannot verify your actual Google project or consent configuration.
- Separate production project/client and deployed HTTPS callback configuration are required before deployment. The localhost setup is not a production approval.

Official references: https://learn.microsoft.com/aspnet/core/security/authentication/social/google-logins and https://developers.google.com/identity/protocols/oauth2/web-server . On 2026-10-29, the account owner confirmed successful live Google sign-in, Gmail password recovery, and account-data persistence in the local environment. This is owner-reported manual verification, separate from the automated synthetic OAuth tests; no production deployment is implied.
