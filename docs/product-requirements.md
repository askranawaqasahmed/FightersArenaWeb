# Product Requirements

## Product Vision

eFightersArena will be the trusted national esports record for gamers, teams, sponsors, games, tournaments, leagues, results, and verified achievements. The first product is a responsive Next.js public website and admin portal backed by a mobile-ready API. A gamer mobile application follows after the API stabilizes.

## Product Principles

1. **Verified over claimed:** distinguish organizer-verified results from self-reported profile information.
2. **API first:** every mobile-relevant capability is available through a stable, versioned API.
3. **Format agnostic:** competitions are composed from stages instead of assuming one bracket format.
4. **Immutable competition history:** started stages cannot be structurally edited; corrections are audited.
5. **Privacy by default:** gamers control sponsor-visible contact and personal information.
6. **Country ready, region scalable:** model country, administrative region, city, locale, and time zone explicitly.

## Actors

| Actor | Responsibilities |
| --- | --- |
| Visitor | Browse games, public gamers, teams, tournaments, brackets, standings, and news |
| Gamer | Register by verified phone, complete a profile, join teams, enter competitions, manage visibility, sponsors, and profile export |
| Team leader | Manage roster invitations, roles, eligibility, competition registrations, and lineup submissions |
| Sponsor representative | Manage a verified organization, request or confirm sponsorships, and view consented profile/media-kit data |
| Tournament operator | Configure entries, seed stages, schedule matches, record results, manage disputes, and publish standings |
| Content manager | Manage homepage banners, featured games, featured gamers, and public content |
| Super admin | Manage permissions, games, competition templates, staff, moderation, audit reviews, and platform settings |

## Core Journeys

### Gamer Onboarding

1. Gamer submits phone number and accepts terms/privacy policy.
2. System verifies a one-time code and creates a minimal account.
3. Gamer adds display name, handle, country, city, date-of-birth band, games, roles, platforms, and public visibility.
4. Gamer links or creates a team and submits evidence for claims that require verification.
5. Gamer generates a shareable public profile and downloadable sponsor-ready PDF.

### Tournament Publishing

1. Admin creates a draft tournament and selects one or more games/divisions.
2. Admin defines registration, eligibility, roster, check-in, scoring, schedule, and stage configuration.
3. Operator seeds or draws participants and runs a dry-run validation.
4. Operator publishes registration and later locks the competition structure.
5. Results advance participants, update brackets/standings, and populate verified profiles.

### Sponsorship

1. A gamer or sponsor proposes a sponsorship link.
2. The other party accepts; an admin can verify the sponsor organization.
3. Contract dates, public logo placement, category, status, and visibility are recorded.
4. Private commercial terms remain excluded from public APIs unless a future secure module explicitly supports them.

## MVP Scope

### Public Website

- Landing page with managed hero slides, live/upcoming tournaments, featured games, gamer counts, featured gamers, and sponsors.
- Searchable public gamer, team, game, tournament, match, bracket, and standings pages.
- Country/city filters and clear verified badges.
- SEO metadata, share images, accessible navigation, and responsive layouts.

### Admin Portal

- Secure staff login, role-based navigation, and audit log.
- CRUD workflows for games, geography, gamers, teams, sponsors, media, banners, tournaments, stages, and matches.
- Registration review, seeding, bracket preview, schedule, check-in, result entry, dispute resolution, and publishing.
- Dashboard for pending approvals, active competitions, result issues, and content status.

### API

- `/api/v1` REST JSON endpoints for all gamer/mobile workflows.
- Short-lived JWT access tokens and rotated refresh sessions.
- OpenAPI document plus interactive documentation at a public, read-only URL.
- Pagination, filtering, sorting, idempotency, validation errors, rate limits, and request identifiers.

### Profile Export

- Branded PDF containing public bio, handles, games/roles, verified teams, verified placements, key statistics, current public sponsors, QR code, generated timestamp, and verification URL.
- Snapshot exports remain reproducible and are invalidated/reissued when source data changes materially.

## Competition Scope

The MVP engine supports stage pipelines containing:

- round robin groups;
- single-elimination brackets;
- double-elimination brackets;
- a configurable top-N advancement rule;
- manual/custom seeded stages for exceptional formats;
- best-of series and game/map-level scores;
- configurable points and tie-break rules;
- team and individual participants.

Swiss, ladder, battle-royale lobbies, automated third-party game ingestion, and real-money prizes are later capabilities unless selected for a specific launch game.

## Explicitly Out of Scope for Initial Portal

- Native gamer mobile application.
- Live streaming and video hosting.
- Automated prize payouts or escrow.
- A marketplace for sponsorship contracts.
- In-game anti-cheat software.
- Real-time chat.

## Important Requirements Added to the Brief

- Consent and guardian handling where local rules apply to minors.
- Eligibility, roster locks, substitutions, no-shows, forfeits, disqualifications, and check-in.
- Disputes, evidence attachments, administrative overrides, and complete audit history.
- Time-zone-safe scheduling, localization, and country-specific phone formatting.
- Object storage and image transformation for banners, avatars, sponsor logos, evidence, and exports.
- Notification preferences and delivery history for SMS, email, push, and in-app messages.
- Data retention, account deletion, export, moderation, abuse reporting, backups, and disaster recovery.
- Game-specific statistics schemas so kill-based scoring is not incorrectly imposed on every game.

## Success Measures

- An operator can configure, preview, lock, and run a two-stage competition without a developer.
- Every published result can be traced to an actor, timestamp, source, and correction history.
- A mobile team can implement authentication and gamer onboarding from the published OpenAPI document alone.
- A public bracket remains understandable and usable on small screens.
- Profile exports contain only permitted data and can be verified by URL/QR code.
- No structural competition mutation is accepted after the relevant stage is locked.

