
# Exact OAuth Configuration

MINHAS AI uses the existing Manus OAuth infrastructure and does not invent client IDs, servers, tokens, or callback URLs. Production OAuth is fail-closed: a callback is exchanged only when the decoded redirect URI exactly matches an allowlisted value.

Configure these server-side variables through the deployment secret manager, never in source control:

```env
OAUTH_SERVER_URL=<existing Manus OAuth server URL>
OAUTH_ALLOWED_REDIRECT_URIS=https://<published-app-domain>/api/oauth/callback
OAUTH_NATIVE_REDIRECT_URI=manusminhasaiappbuilder://oauth/callback
PUBLIC_APP_URL=https://<published-app-domain>
```

`OAUTH_ALLOWED_REDIRECT_URIS` accepts a comma-separated list of exact URI strings. Wildcards are rejected. The web callback must be the exact published API callback URI, and the native callback must be the exact deep-link URI emitted by the Expo configuration. Preview URLs must be added explicitly when preview authentication is required; they are not inferred in production.

The Android intent filter is scheme-only and contains no wildcard host. The callback validates the decoded state redirect URI before code exchange. Production callback redirects use `PUBLIC_APP_URL` or the exact allowlisted web callback origin and never trust an arbitrary forwarded host.

If the allowlist is absent, authentication and the final production gate remain **BLOCKED** rather than reporting a false success.


