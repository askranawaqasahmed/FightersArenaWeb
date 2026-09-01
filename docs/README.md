# eFightersArena Documentation

## Current Status

The first executable eFightersArena platform foundation is implemented. It includes the public site, protected admin workspaces, PostgreSQL/Drizzle schema and migrations, local seed data, password and OTP/JWT sessions, a mobile-ready versioned API (member signup/login, self-service profile, analytics, registrations, home feed, entrants, galleries, and slides), interactive OpenAPI documentation at `/api/reference`, gamer profile PDF exports, and tested competition generation. See [implementation status](implementation-status.md) for the exact boundary between working code and production rollout work.

## Product Documents

| Document | Purpose |
| --- | --- |
| [Product requirements](product-requirements.md) | Scope, actors, journeys, rules, and success criteria |
| [System architecture](architecture.md) | Recommended application boundaries, services, and runtime topology |
| [Data model](data-model.md) | Core PostgreSQL entities, relationships, constraints, and audit strategy |
| [API and security](api-and-security.md) | REST conventions, OpenAPI, JWT sessions, authorization, and protection controls |
| [Tournament engine](tournament-engine.md) | Stage model, bracket generation, standings, advancement, locking, and disputes |
| [Theme and design system](theme-and-design-system.md) | Shared web/mobile palette, typography, tokens, components, and accessibility |
| [Architecture decisions](decisions/README.md) | Proposed, accepted, superseded, and rejected technical decisions |
| [Implementation status](implementation-status.md) | Shipped capabilities, verification evidence, and production follow-ups |

## Delivery Plans

| Plan | Outcome |
| --- | --- |
| [Master implementation plan](plans/master-implementation-plan.md) | Ordered phases, acceptance gates, risks, and definition of done |
| [Phase 1 foundation](plans/phase-1-foundation.md) | Executable plan for the first production-quality foundation |

## Documentation Rules

1. Update the relevant document in the same pull request as a behavior, schema, API, or design-token change.
2. Treat generated OpenAPI output and Drizzle migrations as implementation truth once code exists.
3. Add Architecture Decision Records under `docs/decisions/` for irreversible or expensive choices.
4. Never document a feature as implemented until it is shipped and verified.

## External References

- [Liquipedia Dota 2](https://liquipedia.net/dota2/) is a product reference for readable tournament, team, player, match, standings, and bracket presentation. eFightersArena will implement its own data model and competition engine.
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html) defines the public API contract format.
- [JSON Web Token RFC 7519](https://www.rfc-editor.org/rfc/rfc7519) defines JWT structure.
- [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) is a future defense-in-depth option, not a replacement for application authorization.
