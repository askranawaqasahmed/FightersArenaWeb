# eFightersArena

eFightersArena is a working country-scale esports platform foundation for gamer profiles, teams, sponsors, tournaments, leagues, standings, and flexible multi-stage brackets.

The repository contains a Next.js public website, a private player dashboard, and a protected admin portal, plus a PostgreSQL/Drizzle data layer, gamer OTP authentication, role-gated staff password authentication, versioned REST API, interactive OpenAPI reference, profile PDF export, and a database-backed tournament lifecycle from draft saving through tournament and match start.

For the current shipped feature boundary, verification results, operator workflow, and remaining rollout work, see [Implementation status](docs/implementation-status.md).

## Development Commands

The root `Makefile` applies migrations and seed data to the configured local PostgreSQL database, then manages the Next.js development server as a detached process so `make start` immediately returns control to the current terminal.

```text
make start
make status
make logs
make stop
make restart
make build
```

`make start` connects through `DATABASE_URL`, applies Drizzle migrations, runs the idempotent seed, and starts Next.js in the background. It does not start or stop the local PostgreSQL service. Runtime process and log files are stored under the ignored `.run/` directory.

Copy `.env.example` to `.env` and replace the development secrets before any shared or production deployment.

## Object storage

Slider artwork, event covers, profile pictures, and attachments upload through the authenticated `/api/v1/uploads` endpoint to S3-compatible object storage. Add the `AWS_*` values documented in `.env.example`; credentials remain server-only. `AWS_ENDPOINT_URL` may be left unset for AWS S3 and should be set for Railway buckets, MinIO, Cloudflare R2, or another compatible provider.

## Documentation

- [Documentation index](docs/README.md)
- [Implementation status](docs/implementation-status.md)
- [Product requirements](docs/product-requirements.md)
- [System architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [API and security](docs/api-and-security.md)
- [Tournament engine](docs/tournament-engine.md)
- [Theme and design system](docs/theme-and-design-system.md)
- [Master implementation plan](docs/plans/master-implementation-plan.md)
