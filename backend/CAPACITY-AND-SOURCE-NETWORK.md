# Preparation capacity and official-source connections

## Application changes

The application uses one preparation-capacity policy for accepting a plan and saving progress. When a reviewed build start is in the future, both calculations begin there rather than granting extra time before the event. If a published start exists but is conflicting or unreviewed, capacity stays untimed. A missing start retains the existing assumption that preparation can begin now. The provider's existing classification tolerance and task estimates are unchanged.

A profile, submission or source context change does not silently refresh an accepted plan. Progress writes preserve its original context, task identities, estimates and artifacts. Its reported-hours snapshot remains unchanged; schedule capacity becomes unknown until deliberate regeneration and acceptance in the current context. Completed work still has zero remaining effort. Submission evidence and participation conclusions are never changed by completing tasks.

The frontend includes the previously reviewed #19 provisional workload preview. New and retained effort remain distinct, stale drafts suppress the preview, and existing explicit acceptance/version checks remain intact. No shared v0.2 DTO, provider implementation, production prompt or credential handling is changed.

## Network boundary

Official-source reads use a direct SocketsHttpHandler connection callback with proxies and redirects disabled. Each connection resolves DNS once, rejects empty or mixed public/private answers, and connects to an explicitly checked IP. Normal TLS verification still uses the original hostname. HTTPS on port 443 is required. Private, loopback, link-local, shared-address, multicast, reserved/documentation and IPv4-mapped internal addresses are rejected. Special IPv6 transition ranges are excluded conservatively.

Robots checks, response-size limits, timeouts, cancellation, same-origin collection bounds, MySQL locking and stale snapshot retention remain in place. This protects the official-page reader; it is not a claim about unrelated HTTP integrations, and production egress policy remains a separate operational control.

## Verification

- Combined frontend: 138/138 tests, TypeScript, canonical fixture validation and production build passed.
- Application/MySQL: 62/62 checks passed with a synthetic provider. New cases cover future build windows, unknown/conflicting timing, zero/unknown availability, stale-profile progress, blocked/mixed DNS and resolution-to-connection pinning.
- The hardened reader retrieved the official Google machine-learning catalog successfully without persisting a collection run.
- No live Meta call, key provisioning, shared-client change, production data reset or private account record is included.

The isolated browser workflow passed with a disposable synthetic account, real frontend and ASP.NET/MySQL, replacing only the Meta provider. It verified draft preview without a committed plan, explicit acceptance, task start through the drawer, controlled failed Done save without false success, retry, Done after page reload, rejected stale-version writes, mobile width and return to event details. The temporary account was deleted afterward. The unchanged production rate-limit window was respected between the fast automated desktop and mobile phases. This is separate from live provider verification.
