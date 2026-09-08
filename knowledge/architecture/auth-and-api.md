# Authentication and API boundaries

Browser requests use the HTTP-only access cookie. Extension mutations read that cookie at invocation time and forward it as a Bearer token for that request; a supplied Bearer token takes precedence where the authenticated dependency supports both. The extension never stores session state.

Inactive or deleted users are rejected at the canonical authentication boundary. Authentication-only extension mutations require a valid learner session; public dictionary lookup and optional-auth detail preserve anonymous behavior. Browser isolation uses configured credentialed CORS origins and cookie SameSite policy; there is no global CSRF-token or request-Origin validation middleware. The admin surface rejects SameSite=None, and production requires secure cookies.

Domain errors are mapped once at the HTTP boundary to the canonical status/body shape. Routers do not contain domain policy and domain exceptions do not import FastAPI. Preserve endpoint paths, request/response schemas, generated API types, and error codes during internal moves.

Destructive responses with an unknown gateway outcome are reported as unconfirmed and resolved by a full session reload. Confirmation UI never sends its typed gate value to the API.
