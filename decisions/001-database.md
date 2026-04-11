# 001 — Database Engine

**Date:** 2026-04-11  
**Status:** Accepted

## Context

CLAUDE.md specifies these requirements before implementation begins:

- Multi-user schema from the start (even if Phase 1 hardcodes one user)
- Async image processing with per-image status tracking
- Must run locally **without a separate service** if possible
- Production target: DigitalOcean App Platform or Droplet
- JSON column storage for palette arrays and settings blobs
- Schema version-controlled and migration-managed

The realistic candidates are SQLite, PostgreSQL, and MySQL/MariaDB.

## Decision

**SQLite via better-sqlite3, with Knex.js for schema migrations.**

Rationale:

- **No separate service.** SQLite is a file on disk. `npm run dev` works immediately after cloning — no `docker-compose up`, no Postgres install, no environment-specific service management. This satisfies the explicit "without a separate service if possible" requirement.
- **JSON support.** SQLite ships with the JSON1 extension enabled by default in all modern builds. `JSON()`, `json_extract()`, and `json_each()` cover every access pattern required by the schema (palette arrays, metadata blobs, customization objects). Columns are stored as `TEXT` with a `CHECK(json_valid(...))` constraint where strictness matters.
- **Multi-user schema is a design concern, not an engine concern.** Every table carries a `user_id` foreign key as specified. The engine doesn't need to enforce this — the application layer does. SQLite handles this correctly.
- **Async status tracking fits naturally.** The `images` table will carry a `status` column (`pending` → `processing` → `ready` | `error`). SQLite handles concurrent reads from the async pipeline and the API layer safely when WAL mode is enabled (one write at a time, which is fine for this workload).
- **DigitalOcean Droplet deployment is straightforward.** The database file lives alongside the app. For App Platform, a persistent volume is attached to the mount path. If the project later outgrows SQLite (concurrent write contention, team collaboration, managed backups), migrating to Postgres via Knex dialect swap is a contained change — all queries are already abstracted through the query builder.
- **Knex.js** provides dialect-agnostic migrations, a schema builder, and a query builder. Migrations live in `server/db/migrations/` and are tracked in a `knex_migrations` table. A seed script in `server/db/seeds/` creates the Phase 1 default user.

PostgreSQL was considered but rejected for Phase 1 because it requires a running service, adds local setup friction, and offers no meaningful advantage at this scale. Nothing in the schema or query patterns requires JSONB, arrays, full-text search, or other Postgres-specific features.

## Consequences

**Easier:**
- Zero-configuration local development
- Portable: the database is a single file, trivially backed up or reset
- Migrations and seeds work identically in dev and production

**Harder:**
- App Platform deployments require a persistent volume to be explicitly provisioned (the default ephemeral filesystem would wipe the database on redeploy)
- SQLite allows only one concurrent writer; if a future phase introduces heavy parallel write load (e.g., bulk import), this will become a bottleneck
- Some Postgres-specific features (JSONB operators, `RETURNING` with complex expressions, advisory locks) are unavailable — Knex abstractions must stay within the common subset

**Migration path if SQLite is outgrown:**
Switch the Knex connection config to `pg`, run `knex migrate:latest` against a Postgres instance, and migrate the data. Schema changes are minimal because JSON columns map directly to `jsonb` and all other types are standard SQL.
