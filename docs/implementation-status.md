# Implementation Status

Last updated: 21 August 2026

## Project Snapshot

eFightersArena is an executable esports platform foundation built with Next.js 16, React 19, PostgreSQL, and Drizzle ORM. The repository currently contains a public website, a private gamer dashboard, a protected administrator portal, a **mobile-ready** versioned REST API, an audited tournament execution engine, S3-compatible media storage, and automated unit, component, integration, and production-build verification.

The current database model contains 43 PostgreSQL tables and eleven Drizzle migrations. The application exposes 50 App Router API route modules under `/api`, and 44 documented operations at `/api/reference` (OpenAPI 3.1 at `/api/openapi.json`).

## Working Now

### Public experience

- Managed homepage hero content, featured games, gamers, sponsors, and competitions.
- Public game catalog and game detail pages.
- Public gamer directory, rankings, profiles, sponsor information, and competition history.
- Public tournament list and tournament detail pages with bracket, group, and match views.
- Responsive navigation and competition presentation.
- Interactive OpenAPI reference at `/api/reference` and OpenAPI 3.1 JSON at `/api/openapi.json`.
- Downloadable sponsor-ready gamer profile PDF.

### Authentication and access

- Gamer phone + password signup and login (`POST /api/v1/auth/signup`, `POST /api/v1/auth/login`). Signup creates the user, phone identity, scrypt credential (`gamer_credentials`), and a public gamer profile with a collision-free slug in one transaction, then returns a session.
- Gamer phone OTP authentication with rotating refresh sessions and HTTP-only cookies (kept for the website; SMS delivery still uses the fixed development code).
- Mobile-friendly token flow: signup, login, and refresh return the rotating refresh token in the JSON response body in addition to the HTTP-only cookie; `POST /auth/refresh` and `POST /auth/logout` accept an optional body `refreshToken` so native clients never depend on cookies.
- Minimal in-memory sliding-window rate limiting on signup, login, and OTP request (per-instance; needs a shared store before multi-node deployment).
- Separate administrator email/password authentication with salted password hashes.
- Development-only superadmin quick sign-in.
- Protected gamer and administrator routes with role-aware authorization.
- Superadmin-only administrator provisioning with audit records.
- Database-backed gamer blocking and unblocking. Blocking revokes every active gamer session, prevents new OTP sessions, and writes an audit record; unblocking requires a fresh login.
- Logout, refresh, session isolation, and rejection of gamer sessions from the admin portal.

### Member self-service API (mobile-ready)

- `GET/PATCH /api/v1/me/profile` — read and edit the signed-in member's own profile (display name, handle, bio, country/city, visibility, game identities). A first PATCH creates the profile for legacy OTP accounts; the public slug never changes on rename.
- `GET /api/v1/me/analytics` — the member's own competitive record (totals, per-event win/loss, placements, teams, sponsors) regardless of profile visibility.
- `GET /api/v1/me/registrations` — every tournament the member applied to, with approval and check-in state; `POST /api/v1/me/registrations/{id}/withdraw` withdraws before the competition starts, and a withdrawn member can re-register while registration is open.
- `GET /api/v1/home` — public dashboard feed: published slides, featured events, registration-open, upcoming, live now, and recent results.
- `GET /api/v1/tournaments/{id}/divisions/{divisionId}/registrations` — public entrants list with display names, avatars, and public profile slugs. Public tournament payloads now include the tournament `id`, and the nested registration/availability/gallery routes accept a slug or uuid.

### Gamer and administrator workspaces

- Private gamer dashboard with profile summary, ranking points, tournament and league participation, placements, and aggregate win/loss records.
- Administrator dashboard, gamer directory and editor, event management, game catalog, content studio, users, reports, and media workflows.
- The administrator event list pins live events first and orders events newest-first within each status group.
- Event builder for shared event details and multiple game competitions.
- Tournament competitions with individual registration and optional registration limits.
- League competitions with administrator-assigned teams, leaders, roster sizing, and confirmation-oriented configuration.
- Event cover images, profile pictures, homepage slider artwork, gallery media, and attachments through authenticated S3-compatible uploads.
- Event lifecycle controls on the event detail page: **Publish event**, **Open registration**, and **Close registration** drive the real tournament status through `POST /api/v1/admin/tournaments/{id}/lifecycle` with validated transitions.
- Registration review: administrators **Approve** (confirm + mark eligible + check in) or **Reject** each mobile registration through `PATCH .../registrations/{registrationId}`; only approved entrants enter bracket generation. This action is the designated future hook for "mark payment received".
- Database-backed homepage slides: the Content Studio slide editor and homepage carousel read and write `homepage_slides` through `GET/POST/PATCH/DELETE /api/v1/admin/content/slides*` and public `GET /api/v1/content/slides` (publish state plus optional schedule window).
- Database-backed per-event photo galleries: uploads link into `tournament_media` through admin gallery endpoints; the public gallery is served at `GET /api/v1/tournaments/{id}/gallery`.

### Database-backed tournament lifecycle

- Event drafts, game competitions, stages, and lifecycle metadata are synchronized from the event builder to PostgreSQL.
- Registration policy and remaining-slot availability are enforced independently from planned participant capacity.
- Tournament start uses actual registered or confirmed entrants who are eligible and checked in.
- Pre-start validation checks lifecycle state, stage configuration, entrant count, participant type, roster limits, registration limits, series length, round-robin legs, and existing fixture conflicts.
- Operators can preview one game competition without mixing matches from sibling competitions.
- Tournament start transactionally persists stage participants, rounds, bracket fixtures, match sides, standings, audit events, and outbox events, then moves the stage, competition, and parent event to live state.
- Round-robin, single-elimination, and double-elimination generation support deterministic seeding, byes, lower-bracket paths, and an optional reset final.
- A successful tournament start immediately exposes its persisted match list in the admin portal.
- Bracket previews use compact 28px vertical gaps both between adjacent match cards and between the upper- and lower-bracket sections.
- Preview participants whose seed is unavailable no longer show the misleading `#0` prefix; real seed numbers remain visible.
- Live competitions provide **Manage matches** controls. The first startable pairing is promoted above the bracket, ready pairings have **Start match**, paused pairings have **Resume match**, and unresolved fixtures remain blocked until both participants are known.
- The match table prioritizes live, ready, scheduled, other active, and terminal matches in that order, with stable match-number ordering inside each status group.
- Every generated preview or persisted bracket match receives a stable stage-wide match number ordered by round, bracket path, and match sequence. Upper-round fixtures such as `U1-M3` and `U1-M4` therefore precede the corresponding lower round, and finals are numbered last.
- Starting a match persists its start time and marks its bracket card with a pulsing **LIVE** icon. The match table shows the continuously updated elapsed timer and retains the final total duration after completion; finished bracket cards keep their scores and winning-side highlight.
- Match actions use the authenticated `/api/v1/admin/matches/{id}/lifecycle` endpoint and audited lifecycle transitions.
- Live matches expose score inputs and an **End match** action. Completion saves scores, the winner, and the end time; propagates winner and loser destinations; refreshes downstream readiness; recalculates standings; and can optionally start the next ready match.
- Completed matches expose an audited **Edit score** action with a required correction reason and incremented result version. Score-only corrections recalculate standings; winner corrections also update unlocked downstream bracket slots and are blocked once a dependent match has started or finished. Completed tournament history remains locked.
- Tournament completion remains disabled until every persisted match is final, forfeited, or cancelled.
- Completion saves immutable participant-history snapshots and only completes the parent event when all sibling competitions are terminal.
- Administrators can add isolated rehearsal signups in development to validate the complete start flow without treating bracket-preview names as real entrants.

### API and platform foundation

- REST endpoints under `/api/v1` return consistent data envelopes and Problem Details errors.
- APIs cover health, authentication (password signup/login, OTP, admin), current user, member profile/analytics/registrations, home feed, content slides, games, gamers, gamer account status, sponsors, teams, tournaments, public entrants, event galleries, registrations, availability, stage generation, uploads, media, administrator users, tournament drafts, tournament lifecycle (publish/open/close/start/complete), registration review, registration policy, rehearsal entrants, and match lifecycle.
- PostgreSQL records cover identity, staff credentials, geography, games, profiles, teams, sponsors, tournaments, registrations, stages, rounds, matches, standings, disputes, media, notifications, exports, auditing, outbox delivery, and webhooks.
- Match start and end timestamps are stored through migration `0008_workable_khan.sql` and drive both the live elapsed timer and retained completion duration.
- The idempotent seed supplies Pakistan geography, games, roles, permissions, sponsors, homepage content, sample competition history, featured competitions, and a bootstrap superadmin.
- Root Make commands manage migrations, seed data, and the detached Next.js development process while leaving PostgreSQL service management external.

## Current Tournament Operator Flow

1. Create or edit an event and configure at least one game competition and stage.
2. Select tournament or league behavior and configure capacity, registration, teams, and stage format.
3. Save the draft. Unsaved browser-backed edits show an active **Save draft to enable** action instead of a dimmed, unusable start button.
4. Select **Publish event**, then **Open registration**. Members can now self-register from the mobile app or website and immediately see themselves in the public entrants list.
5. **Approve** each real registration (or **Reject** it) in the participant table; approval confirms the entrant, marks them eligible, and checks them in.
6. Select **Close registration** when the field is set (re-opening is allowed until start).
7. Preview the generated structure and resolve every pre-start validation error.
8. Select **Start tournament** to persist the bracket and move the competition live.
9. Use the promoted **Start match** action above the bracket or open **Manage matches**. Live pairings appear first in the table, followed by ready, scheduled, other active, and completed pairings.
10. Enter both players' scores and select **End match**. The winner advances and, in double elimination, the loser follows the configured lower-bracket path while the live preview refreshes.
11. If a completed result needs correction, select **Edit score**, enter the corrected scores and a required reason, and save the audited revision before downstream matches begin.
12. End the tournament after every match reaches a terminal state.

## Verified on 21 August 2026

- Strict TypeScript type checking and the full ESLint run pass.
- The complete unit and component suite passes: 25 test files and 126 tests.
- Tournament lifecycle component coverage verifies preflight validation, tournament start, immediate match visibility, top-level start controls, status and match-number ordering, compact bracket spacing, seed display, persisted live timing, score submission, score correction, bracket advancement refresh, blocked completion, and rehearsal signups.
- New component coverage verifies the registration Approve/Reject review actions, the API-backed event gallery upload/remove flow, and API-backed slide publishing rendered by the homepage hero.
- PostgreSQL integration coverage (9 files, 10 tests) verifies draft persistence, entrant creation, start validation, double-elimination bracket persistence, tournament start, persisted match start/end timing, score-driven lifecycle completion, and versioned audited result correction.
- New integration coverage verifies password-signup primitives with slug collision handling, the complete mobile registration flow (draft → publish → open → self-register → approve/reject → withdraw/re-register → close → start with only approved entrants seeded), slide publish-window filtering, and unique gallery linking.
- The complete mobile flow was also exercised live against the development server: signup → login → profile edit → body-token refresh → publish/open registration → self-register by slug → public entrants → admin approve → close → start → public bracket → own analytics → home feed.
- The Next.js 16 production build completes successfully and generates all configured static and dynamic routes.

## Known Boundaries

- Content-studio **articles** (and article attachments metadata) remain browser-local; there is no articles table yet. Homepage slides and event galleries have moved to shared PostgreSQL APIs.
- Payment tracking is intentionally deferred by product decision: no payment fields exist. Manual "mark payment received" will be layered onto the existing registration Approve action, and a payment gateway comes later.
- Score entry, winner selection, and audited score correction are exposed in the current admin UI; dispute, explicit forfeiture, and manual bracket-recovery controls still need production UX completion around the existing lifecycle services.
- Public demo datasets are not yet fully replaced by operator-created database records on every page (teams and sponsors list endpoints are still hardcoded stubs; the profile PDF still renders demo data).
- The separate native gamer mobile application has not been built; the API it will consume is complete and documented at `/api/reference`.
- Rate limiting is in-memory and per-instance; use a shared store before running multiple server instances.
- Production deployment still requires real SMS, email/push, object-storage, monitoring, backup, domain, and secret-management configuration, and `JWT_PRIVATE_SECRET` must be set explicitly (the code falls back to a known development secret).
- Staff MFA/passkeys, account recovery, legal review, accessibility audit, penetration testing, load testing, and live-event rehearsal remain production gates.

These boundaries are rollout and operator-experience work; the core local tournament start, timed match execution, result completion or correction, and bracket advancement paths are implemented and database-verified.
