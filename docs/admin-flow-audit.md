# Admin flow audit

## Canonical hierarchy

1. Event — shared title, schedule, location, description, and lifecycle.
2. Game competition — one game configured as either an open Tournament or an assigned-team League.
3. Stage pipeline — one or more independently configurable group or elimination stages.
4. Participants — individual tournament registrations or league team assignments.

An Event can contain multiple Game competitions. Each game competition owns its own capacity, stages, registration policy, teams, leaders, and participant confirmations.

## Tournament flow

- The event page exposes lifecycle controls: **Publish event** (draft → published), **Open registration**, and **Close registration** (re-opening is allowed until start). Self-registration is only accepted while registration is open.
- Mobile users register individually through the public API and immediately appear in the participant table and the public entrants list.
- Registration and account status are visible in the event detail page; each pending registration has audited **Approve** and **Reject** actions.
- Approving confirms the entrant, marks them eligible, and checks them in — only approved entrants are seeded into brackets. A member can withdraw before start and re-register while registration is open.
- Payment tracking is deferred by product decision: no payment fields exist yet. Manual "mark payment received" will be layered onto the Approve action, and a payment gateway can follow without changing participant records.

## League flow

- Superadmin configures team count and players per team.
- Superadmin names teams and assigns each leader and roster.
- The assigned player sees a pending team assignment in the future mobile experience.
- The player must confirm or decline the assignment.
- The event detail page exposes incomplete rosters and pending confirmations before league activation.

## Content flow

- Articles and slider images are created as drafts or published explicitly.
- Draft content never renders on the public homepage.
- Published articles render in the homepage news section (articles are still browser-local; no articles table exists yet).
- Homepage slides persist in PostgreSQL (`homepage_slides`) through authenticated admin CRUD endpoints; the public homepage and mobile home feed read them from `GET /api/v1/content/slides`, honoring the publish flag and optional schedule window.
- Published slider images render in configured order in the homepage carousel, advance automatically, and retain manual previous, next, and direct-selection controls.
- Slider publication requires a title, image, and accessible alt text.
- Slider images and article attachments are stored as S3 objects rather than browser data URLs.

## Event gallery flow

- After an event ends, administrators upload photos (purpose `event-gallery`) and each upload is linked to the event in `tournament_media` with a caption; images can be removed from the gallery without deleting the stored file.
- The public gallery is served at `GET /api/v1/tournaments/{id}/gallery` for the website and mobile app.

## Media flow

- One authenticated upload endpoint handles slider images, event covers, player profile pictures, and attachments.
- Object keys are persisted in `media_assets`; public rendering uses stable application media URLs rather than exposing storage credentials.
- Image uploads allow JPEG, PNG, WebP, and GIF up to 8 MB. Attachments allow common images, PDF, document, spreadsheet, text, and CSV formats up to 20 MB.
- Player profile-picture uploads update the gamer profile immediately.

## Game catalog flow

- Games support create, read, edit, activation, and deletion.
- Active catalog games appear publicly and are selectable while configuring an Event game competition.
- Inactive games remain in admin history but cannot be selected for new competition configuration.

## Validation coverage

- Event name, dates, location, chronological date order, and at least one game competition.
- Unique game catalog slugs and required name/genre fields.
- At least one stage per game competition.
- Tournament capacity of at least two participants.
- League minimum of two teams and one player per team.
- League leader inclusion in the assigned roster and roster-size limits.
- Article title/body and slider title/image/alt text before publication.
- Preview generation from the current unsaved event configuration.

## Production integrations still required

Event drafts, game competitions, stages, registrations, registration review, event lifecycle (publish/open/close/start/complete), generated fixtures, match lifecycle transitions, homepage slides, and event galleries now persist through authenticated server APIs and PostgreSQL transactions. The event builder keeps a browser backup for recovery, but a draft must be synchronized to PostgreSQL before it can start. Content-studio articles remain browser-local. Before multi-user production rollout, move articles to a shared server API, complete the dispute and manual bracket-recovery operator interfaces around the existing lifecycle services, integrate a real SMS provider behind the existing OTP endpoints, and add manual payment marking followed by the payment-provider webhook flow.
