# API and Security

## Contract Strategy

- Base path: `/api/v1`.
- Media type: `application/json`; file uploads use signed object-storage flows.
- OpenAPI is hand-maintained in `src/lib/openapi.ts` alongside the zod runtime validation used in each handler.
- Public interactive documentation: `/api/reference` (Scalar UI, no authentication required — share this URL with mobile and desktop client developers).
- Raw contract: `/api/openapi.json` — feed this to OpenAPI client generators (Kotlin, Swift, Dart, C#, TypeScript) to produce typed SDKs for the mobile and desktop applications.
- Production documentation exposes examples and schemas but never private endpoints, secrets, internal stack traces, or live privileged credentials.
- Breaking changes require a new major API version; additive fields and endpoints are allowed within `v1`.

## Resource Groups

```text
/api/v1/auth/*
/api/v1/me/*
/api/v1/gamers/*
/api/v1/teams/*
/api/v1/sponsors/*
/api/v1/games/*
/api/v1/tournaments/*
/api/v1/stages/*
/api/v1/matches/*
/api/v1/standings/*
/api/v1/content/*
/api/v1/home
/api/v1/admin/*
```

Nested URLs express ownership for creation and listing, while canonical resource URLs handle direct reads/updates. Example: `POST /tournaments/{id}/stages` and `GET /stages/{stageId}`.

## Response Conventions

Success responses use stable resource DTOs. Collection responses include cursor pagination:

```json
{
  "data": [],
  "page": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

Errors use Problem Details-compatible JSON:

```json
{
  "type": "https://efightersarena.example/problems/stage-locked",
  "title": "Stage is locked",
  "status": 409,
  "code": "STAGE_LOCKED",
  "detail": "Seeding cannot change after a stage is locked.",
  "requestId": "req_...",
  "errors": []
}
```

Use `400` for malformed input, `401` for missing/invalid authentication, `403` for denied permission, `404` when a resource is unavailable to that actor, `409` for state/version conflicts, `422` for valid JSON that violates business validation, and `429` for throttling.

## Authentication

### Gamer Signup and Login (password — primary mobile flow)

1. `POST /auth/signup` accepts phone, password (min 8 chars), display name, and optional email. It creates the user, verified-later phone identity, scrypt credential (`gamer_credentials`), and a public gamer profile with a collision-free slug in one transaction, then returns a session.
2. `POST /auth/login` accepts phone + password and returns one generic invalid-credentials response for every failure shape; blocked accounts receive 403 `ACCOUNT_BLOCKED`.
3. Both return `{ accessToken, tokenType, expiresIn, refreshToken, user }` in the body **and** set the HTTP-only cookies, so the same endpoints serve native apps (store the tokens) and the website (rely on cookies).
4. Signup and login are rate limited per phone (in-memory sliding window; per-instance).

### Gamer Login (phone OTP — website)

1. `POST /auth/otp/request` accepts a normalized phone number (rate limited; SMS delivery still uses the fixed development code — a real provider is a deferred integration).
2. `POST /auth/otp/verify` consumes the one-time challenge, auto-creates the account on first verification, and creates a session.

### Session Rotation (both flows)

1. Client receives a short-lived (15 min) signed JWT access token and a rotating opaque 30-day refresh token.
2. `POST /auth/refresh` rotates the refresh token. It reads the token from the optional JSON body `{ refreshToken }` first (mobile) and falls back to the cookie (web); the new refresh token is always returned in the body and re-set as a cookie. Token-family reuse detection is planned but not yet implemented — a replayed revoked token is rejected but does not revoke the family.
3. `POST /auth/logout` revokes the current session (body `refreshToken` or cookie).

Store OTP and refresh tokens only as cryptographic hashes. Do not put phone numbers, permissions lists, private profile fields, or sensitive sponsor data in access-token claims.

### Admin Login

1. `POST /auth/admin/login` accepts a normalized email address and password over TLS.
2. Only the bootstrap `super_admin` and active `admin` accounts whose credential was provisioned by that superadmin can receive an admin session.
3. Passwords are stored as salted scrypt hashes; failures return one generic invalid-credentials response.
4. Admin access is held in secure, HTTP-only cookies and is re-authorized against the current account, session, and role in the database.
5. Only `super_admin` can call `POST /admin/users`; it creates an `admin` role account and an immutable audit event.

Phone OTP authentication always creates a gamer session and cannot grant admin portal access.

### Access Token Claims

- `iss`, `aud`, `sub`, `iat`, `nbf`, `exp`, `jti`;
- session identifier (`sid`);
- account type (`gamer`/`admin`) and, for staff, the admin role.

Current implementation signs HS256 with a symmetric secret (`JWT_PRIVATE_SECRET`, `kid: local-v1`) and 15-minute expiry, with strict issuer/audience/algorithm checks. Moving to asymmetric keys with rotation remains a production hardening step, and the secret must be set explicitly in production (the code falls back to a known development value). Authorization always resolves current roles and resource scope server-side.

### Mobile Client Consumption

- Every authenticated endpoint accepts `Authorization: Bearer <accessToken>` first and falls back to the session cookie, so native clients never need cookie handling.
- Persist the `refreshToken` from signup/login/refresh responses in secure device storage (Keychain / EncryptedSharedPreferences) and send it in the refresh body when the access token expires.
- Member-scoped resources live under `/me/*`: profile read/update, analytics, registrations, and withdraw.
- Public reads (tournaments, entrants, brackets, galleries, slides, `/home`) need no authentication; nested tournament routes accept a slug or uuid.

### Browser Session Safety

For the admin web portal, prefer secure, HTTP-only, same-site cookies/BFF handling so JavaScript does not persist bearer tokens. Mutations require origin/CSRF protection as appropriate. Staff accounts require stronger authentication, MFA, recovery controls, and shorter high-risk re-authentication windows.

## Authorization

Apply deny-by-default policies using action plus resource scope. Example permissions:

- `profile:read_private:self`;
- `team:manage:owned`;
- `sponsorship:respond:subject`;
- `tournament:manage:assigned`;
- `match:result:write:assigned`;
- `content:publish`;
- `identity:verify`;
- `audit:read`.

Every endpoint must test horizontal access control. A valid identifier never implies access. PostgreSQL Row-Level Security can later provide defense in depth for selected multi-tenant tables, but application policies remain mandatory.

## Mutation Safety

- Require `Idempotency-Key` for registration, sponsorship, export, payment-like, and result submission operations.
- Use optimistic concurrency (`version` or ETag/`If-Match`) for admin edits.
- Wrap bracket/result transitions and outbox writes in one transaction.
- Sign webhooks, timestamp deliveries, retry with backoff, and document duplicate delivery.
- Limit upload type, size, dimensions, count, ownership, and scan/moderate before publication.

## Security Baseline

- Validate every input and serialize explicit output DTOs.
- Parameterize all database access through Drizzle; review raw SQL separately.
- Rate-limit by risk and actor, with stricter OTP, login, export, search, and write policies.
- Redact tokens, OTPs, contact values, and private profile data from logs.
- Encrypt transport, managed storage, backups, and high-sensitivity application fields where appropriate.
- Use a Content Security Policy, safe image domains, secure headers, dependency scanning, and secret scanning.
- Keep immutable audit events for admin, verification, role, result, bracket, sponsorship, and privacy changes.
- Define backup restoration tests, incident response, retention, deletion, and breach-notification procedures before production.

## API Quality Gates

- OpenAPI lint passes and every operation has a stable `operationId`.
- Generated mobile/client SDK compiles in CI.
- Contract tests cover success and documented error responses.
- Authorization tests cover owner, permitted staff, unrelated authenticated user, and anonymous access.
- Migration tests apply from an empty database and upgrade a production-like snapshot.
- Load tests cover public tournament traffic and live result updates before major events.
