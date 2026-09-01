# Architecture Decision Register

Architecture Decision Records (ADRs) capture decisions that are costly to reverse or affect multiple modules. No ADR is accepted yet because implementation has not started.

## Required Format

Name files `NNNN-short-title.md` and include:

- status: `proposed`, `accepted`, `superseded`, or `rejected`;
- date and decision owners;
- problem context and constraints;
- considered options;
- decision and rationale;
- positive and negative consequences;
- migration or rollback notes;
- links to affected plans, code, and follow-up decisions.

## First Decisions to Record

1. Modular monolith and monorepo boundaries.
2. Hosting platform and background-worker topology.
3. Runtime schema and OpenAPI generation approach.
4. Gamer OTP and staff MFA providers.
5. Refresh-session and JWT key-management design.
6. Object storage, image processing, and PDF generation.
7. Durable queue and transactional outbox implementation.
8. Live match update transport.

