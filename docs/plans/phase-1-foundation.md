# Phase 1 Foundation Plan

## Objective

Create a secure, deployable foundation on which public web, admin, and future mobile features can be delivered without rewriting authentication, API contracts, database ownership, or design tokens.

## Workstreams

### Repository and Quality

- Initialize package manager and monorepo workspace.
- Scaffold `apps/web`, `apps/worker`, and shared packages.
- Enable strict TypeScript, linting, formatting, unit tests, and affected CI tasks.
- Add pull-request checks for build, test, schema generation, migration drift, and OpenAPI lint.
- Document local setup and environment variables without committing secrets.

### Database

- Start PostgreSQL locally and in staging.
- Add Drizzle configuration, typed client, migration scripts, migration CI, and seed commands.
- Implement initial identity, session, role, permission, audit, geography, and outbox tables.
- Add transaction helper, pagination conventions, UTC/time-zone rules, and integration-test database lifecycle.

### Identity and Authorization

- Implement OTP request/verify behind a provider interface with a safe local adapter.
- Implement hashed challenges, abuse controls, rotating refresh sessions, JWT access tokens, logout, and revoke-all.
- Implement staff login/MFA decision and bootstrap super-admin process.
- Implement permission policy service with self, organization, competition, and platform scopes.
- Record security-sensitive audit events and authorization denials at appropriate sampling levels.

### API Platform

- Define route-handler adapter, runtime schemas, DTO mapping, Problem Details errors, request IDs, and structured logging.
- Publish `/api/v1/health`, authentication endpoints, current-user endpoint, raw OpenAPI, and interactive docs.
- Add cursor pagination, idempotency middleware/storage, optimistic concurrency convention, and rate-limit interface.
- Generate a TypeScript client in CI to prove contract usability.

### Web and Design System

- Convert `docs/theme-and-design-system.md` tokens into platform-neutral source data and CSS variables.
- Build accessible button, input, dialog, menu, table, status badge, skeleton, toast, and form primitives.
- Build responsive public shell, admin shell, authentication pages, forbidden/not-found/error states, and theme showcase.
- Test keyboard, reduced-motion, small-screen, and contrast behavior.

### Operations

- Configure local, preview, staging, and production environment boundaries.
- Add health/readiness, error tracking, metrics baseline, deployment annotations, and alert ownership.
- Define backup schedule, restoration test, key rotation, incident response, and production access procedure.

## Proposed Milestones

1. **F1 — Workspace boots:** local web, worker, database, and tests run with one documented setup flow.
2. **F2 — Database safe:** migrations and integration tests run in CI; audit/outbox patterns are proven.
3. **F3 — Identity works:** gamer and staff staging authentication plus session revocation are verified.
4. **F4 — API contract works:** OpenAPI is public, linted, tested, and generates a compiling client.
5. **F5 — UI foundation works:** public/admin shells and accessible primitives pass visual and interaction review.
6. **F6 — Staging gate:** monitoring, backup, secrets, permission tests, and runbooks pass readiness review.

## Acceptance Checklist

- [ ] Fresh clone reaches a working local environment from documented commands.
- [ ] Empty-database migration and production-like upgrade both pass.
- [ ] OTP values and tokens never appear in database plaintext or logs.
- [ ] Refresh-token rotation and reuse detection revoke the affected family.
- [ ] Authorization tests include unrelated-user access attempts.
- [ ] API errors include stable codes and request IDs.
- [ ] OpenAPI documents every shipped endpoint and generated client compiles.
- [ ] Admin session uses secure browser storage/cookie handling.
- [ ] Keyboard-only navigation works through authentication and shells.
- [ ] Staging alerts, backup, restore, and super-admin bootstrap are exercised.

## Inputs Needed Before Implementation

- Launch country and supported phone country codes.
- First launch game and competition rules.
- Preferred hosting and approximate budget/traffic assumptions.
- OTP/SMS and email provider choices or permission to evaluate them.
- Staff MFA requirement and identity provider preference.
- Brand logo, licensed fonts/assets, and domain name.

