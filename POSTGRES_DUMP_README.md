# CivicWatch Postgres Dump

This directory includes full Postgres backups of the local `civicwatch` database.

## Primary Full SQL Backup

- File: `civicwatch_postgres_full_2026-07-02.sql`
- Format: PostgreSQL plain SQL (`pg_dump -F p`)
- Source database: `civicwatch`
- Source server: PostgreSQL 17.6 on `localhost:5432`
- Created: 2026-07-02
- Size: about 6.0 GB
- SHA-256: `7ED9B838A44C40792AD20EE2950F9479F5230E7DEFF94D5934830F8B0C7B2C26`

This is an uncompressed, readable logical backup. It includes schema DDL, table `COPY` data blocks, sequence state, constraints, indexes, foreign keys, and materialized view refresh commands.

Verified markers in the SQL file include:

- `CREATE TABLE public.legislators`
- `CREATE TABLE public.posts`
- `CREATE TABLE public.topics`
- `COPY public.legislators (...) FROM stdin`
- `COPY public.posts (...) FROM stdin`
- `COPY public.topics (...) FROM stdin`
- `SELECT pg_catalog.setval('public.posts_id_seq', 22177134, true)`
- `REFRESH MATERIALIZED VIEW public.topic_engagement_daily`
- `REFRESH MATERIALIZED VIEW public.topic_party_breakdown`
- `REFRESH MATERIALIZED VIEW public.topic_state_breakdown`
- `-- PostgreSQL database dump complete`

## Optional Custom Archive

- File: `civicwatch_postgres_full_2026-07-02.dump`
- Format: PostgreSQL custom archive (`pg_dump -F c`)
- Source database: `civicwatch`
- Source server: PostgreSQL 17.6 on `localhost:5432`
- Created: 2026-07-02
- Size: about 2.0 GB
- SHA-256: `90634178FCD78C0ED7D6F5534D9EBA1E815E3B4FD7A10682E6FF3D65451B4570`

Both backups include schema and data for:

- `public.legislators`
- `public.posts`
- `public.topics`
- `public.legislator_summary`
- `public.topic_engagement_daily`
- `public.topic_party_breakdown`
- `public.topic_state_breakdown`
- `public.posts_id_seq`
- Indexes, constraints, foreign keys, sequence state, and materialized view data

## Restore From SQL

Create the target database first if needed:

```powershell
createdb -h localhost -p 5432 -U postgres civicwatch
```

Restore into an existing database:

```powershell
psql -h localhost -p 5432 -U postgres -d civicwatch -v ON_ERROR_STOP=1 -f .\civicwatch_postgres_full_2026-07-02.sql
```

## Restore From Custom Archive

```powershell
pg_restore -h localhost -p 5432 -U postgres -d civicwatch --clean --if-exists --no-owner --no-privileges --verbose .\civicwatch_postgres_full_2026-07-02.dump
```

If using this repo's backend tooling from `backend/`, this also works:

```powershell
pnpm run load-dump "..\new_app\civicwatch_postgres_full_2026-07-02.dump"
```
