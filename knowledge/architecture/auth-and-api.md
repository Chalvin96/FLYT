# Authentication and API boundaries

Browser requests use the HTTP-only access cookie. The extension reads that cookie for
each authenticated request and forwards it as a Bearer token. The service worker does
not store session state. A supplied Bearer token takes precedence where the dependency
accepts both credentials.

Dictionary resolution and suggestions remain anonymous. Lemma detail allows optional
authentication; user-scoped mutations require an active learner session. Authentication
checks that the account is active and that the JWT's integer `session_version`
matches the user row on every request, including optional authentication and admin
access. Logout atomically increments that version before clearing cookies, revoking
all existing browser and extension tokens for the account. Account deletion also
invalidates later requests.

Browser isolation uses configured credentialed CORS origins, the access cookie's
SameSite policy, and an Origin check on cookie-bearing POST, PUT, PATCH, and DELETE
requests. Origin must exactly match `FRONTEND_ORIGINS`; when Origin is absent, the
Referer's origin must match. Missing or disallowed origins return 403 with
`ORIGIN_NOT_ALLOWED`. API Bearer credentials take precedence over cookies and bypass
this check; invalid Bearer tokens cannot fall back to cookie authentication. Admin
uses only cookies and always requires the Origin check for unsafe methods, even when
an Authorization header is present. Safe methods, OAuth callbacks, and requests
without the access cookie do not require an Origin. There is no global CSRF token.
Admin rejects SameSite=None, and production requires secure cookies.

Settings default to production. Development login remains a GET link and is mounted
only with explicit `ENV=development`. Test login requires both `ENV=e2e` and
`ENABLE_E2E_TEST_AUTH=true`; enabling test auth in any other environment fails startup.

Routers own transport, not domain policy. They map domain exceptions once at the HTTP
boundary to the standard status and error body. Domain exception classes do not import
FastAPI. Preserve endpoint paths, request and response schemas, generated API types, and
error codes during internal moves.

Integer database IDs in API parameters use `DatabaseId`, bounded to
1 through 2,147,483,647. API datetime fields use `UtcDatetime` to serialize
stored naive UTC values and aware values as RFC 3339 UTC timestamps with `Z`.
Database timestamps remain naive UTC.

OpenAPI documents domain and transport errors with the shared
`ErrorResponse` envelope. HTTP 422 accepts either that envelope or FastAPI's
request-validation error list; routes keep their existing runtime error bodies.

If account deletion gets no response or a 502, 503, or 504 response, report it as
unconfirmed and send the learner to sign in again. Do not claim that the deletion rolled
back. The typed email is a local confirmation gate and is never sent to the API.

Link a provider account only after its proof stream completes; an HTTP 200 alone does
not prove access. Never log tokens or credential plaintext. Commit a rotated refresh
token before the next provider request. If the commit outcome is ambiguous, do not
revoke a replacement token that may have persisted.

ChatGPT OAuth requests use the explicit provider User-Agent. Authorization-code exchange
is form encoded; renewal and revocation use JSON.

Unlink revokes the upstream token, commits the link-row deletion, then clears pending
Redis state best-effort. A Redis failure after commit must not restore a row holding a
revoked credential.

API datetimes use UTC with an explicit `Z` offset; database timestamps remain naive UTC.
