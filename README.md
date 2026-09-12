# CivicWatch

CivicWatch is a local SvelteKit/Fastify exploration app for the restored
CivicWatch legislative speech dump. The default setup uses an isolated Postgres
cluster on `localhost:55432`, so it does not touch any other Postgres instances
you may have running on the usual `5432` port.

## Requirements

- Node.js and pnpm
- PostgreSQL command line tools on `PATH` (`pg_ctl`, `psql`, `createdb`,
  `dropdb`, `pg_restore`, `pg_isready`, and `initdb`)
- A local Postgres server or the repo-managed `.postgres-data` cluster
- A local `.env` file; this repo includes one for the current local dump

For a fresh dump restore, use the `db:restore` command below. The runnable
developer app expects the prepared database:

```txt
postgres://postgres@localhost:55432/civicwatch_explore
```

## Install

Install once from the workspace root. `pnpm-lock.yaml` is the single dependency
lockfile for the root package plus `apps/api` and `apps/web`.

```powershell
pnpm install
```

## Restore A Production Dump

Production dumps are distributed as a tar bundle containing a custom-format
Postgres archive, manifest, contents list, checksum, and dump log. Unpack it
from the workspace root.

```powershell
tar -xf .\civicwatch_prod_YYYYMMDD_bundle.tar
```

On macOS/Linux:

```bash
tar -xf ./civicwatch_prod_YYYYMMDD_bundle.tar
```

Confirm the checksum:

```powershell
Get-FileHash .\civicwatch_prod_YYYYMMDD.dump -Algorithm SHA256
```

On macOS:

```bash
shasum -a 256 ./civicwatch_prod_YYYYMMDD.dump
```

On Linux:

```bash
sha256sum ./civicwatch_prod_YYYYMMDD.dump
```

Then restore into the database named by `.env`:

```powershell
pnpm run db:restore -- --dump .\civicwatch_prod_YYYYMMDD.dump --yes
```

On macOS/Linux:

```bash
pnpm run db:restore -- --dump ./civicwatch_prod_YYYYMMDD.dump --yes
```

For a completely fresh local database, use:

```powershell
pnpm run db:restore -- --dump .\civicwatch_prod_YYYYMMDD.dump --yes --recreate
```

On macOS/Linux:

```bash
pnpm run db:restore -- --dump ./civicwatch_prod_YYYYMMDD.dump --yes --recreate
```

The restore command works on Windows, Linux, and macOS as long as the Postgres
CLI tools are on `PATH`. If `.env` points at the default `localhost:55432`
database, the command will initialize and start the repo-managed
`.postgres-data` cluster when needed. It refuses to restore into a non-local
database unless `--force-remote` is provided.

After restoring, `db:restore` runs:

```txt
pnpm run db:prepare
pnpm run db:posts:canonical
pnpm run db:network:repair-counts
```

It does not run the expensive full `db:network:prepare` job because the
distributed production dump already includes `app_post_interactions`,
`app_network_edges`, and the canonical post tables.

Plan for at least 60 GB of free space for a smooth local restore, and 100 GB or
more if you also intend to rebuild expensive derived network tables. The
compressed archive is much smaller than the restored database because Postgres
must also store indexes, materialized views, WAL, and working files during
restore.

## Create A Production Dump

Create production DB bundles on the database server, `picso102`, not the web
server. The commands below use localhost because the process is already running
on the DB host.

```bash
ssh qkw3@picso102.sci.pitt.edu
mkdir -p ~/civicwatch_db_exports
cd ~/civicwatch_db_exports

DUMP_DATE="$(date +%Y%m%d)"
DUMP_NAME="civicwatch_prod_${DUMP_DATE}"

read -rsp "DB password for civicwatch: " PGPASSWORD
echo
export PGPASSWORD
export PGGSSENCMODE=disable
export PGSSLMODE=disable

psql -h 127.0.0.1 -p 5432 -U civicwatch -d civicwatch -c "select 1;"

pg_dump \
  -h 127.0.0.1 \
  -p 5432 \
  -U civicwatch \
  -d civicwatch \
  -F c \
  -Z 9 \
  --no-owner \
  --no-acl \
  --verbose \
  -f "${DUMP_NAME}.dump" \
  2>&1 | tee "${DUMP_NAME}.pg_dump.log"

pg_restore -l "${DUMP_NAME}.dump" > "${DUMP_NAME}.contents.txt"

psql \
  -h 127.0.0.1 \
  -p 5432 \
  -U civicwatch \
  -d civicwatch \
  -v ON_ERROR_STOP=1 \
  -c "
    select 'posts' as table_name, count(*) from posts
    union all select 'legislators', count(*) from legislators
    union all select 'topics', count(*) from topics;
  " > "${DUMP_NAME}.manifest.txt"

sha256sum "${DUMP_NAME}.dump" > "${DUMP_NAME}.sha256"

tar -cf "${DUMP_NAME}_bundle.tar" \
  "${DUMP_NAME}.dump" \
  "${DUMP_NAME}.sha256" \
  "${DUMP_NAME}.contents.txt" \
  "${DUMP_NAME}.manifest.txt" \
  "${DUMP_NAME}.pg_dump.log"

du -h "${DUMP_NAME}.dump" "${DUMP_NAME}_bundle.tar"
unset PGPASSWORD
```

Sanity-check the bundle before distributing it:

```bash
cat "${DUMP_NAME}.manifest.txt"
cat "${DUMP_NAME}.sha256"
grep -E 'TABLE DATA public (posts|legislators|topics|app_post_interactions|app_network_edges|app_posts_canonical_map)' "${DUMP_NAME}.contents.txt"
```

Fetch the bundle from a local machine with SFTP/FTP, or with `scp`:

```powershell
scp qkw3@picso102.sci.pitt.edu:~/civicwatch_db_exports/civicwatch_prod_YYYYMMDD_bundle.tar .
```

To estimate the restored database size on PICSO102:

```bash
psql -h 127.0.0.1 -p 5432 -U civicwatch -d civicwatch -c "
  select pg_size_pretty(pg_database_size(current_database())) as database_size;
"

psql -h 127.0.0.1 -p 5432 -U civicwatch -d civicwatch -c "
  select
    schemaname || '.' || relname as relation,
    pg_size_pretty(pg_total_relation_size(format('%I.%I', schemaname, relname)::regclass)) as total_size
  from pg_stat_user_tables
  order by pg_total_relation_size(format('%I.%I', schemaname, relname)::regclass) desc
  limit 20;
"
```

## Configure

Local settings live in `.env`, with `.env.example` as the committed template.
The important values are:

```txt
DATABASE_URL=postgres://postgres@localhost:55432/civicwatch_explore
API_BASE_URL=http://127.0.0.1:4000/api/v1
PUBLIC_API_BASE_URL=http://127.0.0.1:4000/api/v1
```

When moving to a remote database, update `DATABASE_URL` for the API process.
When moving the API itself, update both `API_BASE_URL` and
`PUBLIC_API_BASE_URL` so server-rendered and browser-side Svelte requests point
at the same reachable API.

The 2026-09-11 production bundle metadata is:

```txt
coverage=2020-01-01..2025-01-04
posts=22400586
legislators=5927
topics=22
states=50
```

## Run

Start the database, API, and Svelte app with one command.

On Windows:

```powershell
pnpm run start:local
```

On Linux/macOS:

```bash
pnpm run start:local:bash
```

The launcher reads `.env`, starts the isolated Postgres cluster if needed, and
runs both app packages.

- Web: `http://127.0.0.1:5173/`
- API health: `http://127.0.0.1:4000/api/v1/health`
- API docs, when `CIVICWATCH_API_DOCS_ENABLED=true`: `http://127.0.0.1:4000/docs`

On Bash, local Postgres startup is automatic:

- If `.env` points at `localhost:55432`, the launcher starts `.postgres-data`.
- If `.env` points at a remote host such as `picso102.sci.pitt.edu:5432`, the
  launcher skips `.postgres-data` and uses the remote database.

If Postgres is already running and you only want the app processes:

```powershell
pnpm run start:local -- -SkipDbStart
```

On Linux/macOS, the equivalent is:

```bash
pnpm run start:local:bash -- --skip-db-start
```

## Linux Production

For a production Linux host, set `.env` or process-manager environment variables
for the remote database and public API URL:

```txt
DB_HOST=picso102.sci.pitt.edu
DB_PORT=5432
DB_NAME=civicwatch
DB_USER=civicwatch
DB_PASSWORD=replace-me
DB_SSL=require
CIVICWATCH_START_LOCAL_POSTGRES=auto
API_HOST=127.0.0.1
API_PORT=4004
API_BASE_URL=https://your-api.example.com/api/v1
PUBLIC_API_BASE_URL=https://your-api.example.com/api/v1
PUBLIC_BASE_PATH=
WEB_HOST=127.0.0.1
WEB_PORT=3000
CIVICWATCH_TRUST_PROXY=true
CIVICWATCH_CORS_ENABLED=false
CIVICWATCH_CORS_ORIGINS=https://picso101.sci.pitt.edu
CIVICWATCH_API_DOCS_ENABLED=false
CIVICWATCH_ANALYTICS_ENABLED=true
CIVICWATCH_ANALYTICS_FILE=logs/analytics.jsonl
CIVICWATCH_INTERNAL_TOKEN=replace-with-long-random-secret
CIVICWATCH_EDGE_RATE_LIMIT_MAX=600
CIVICWATCH_EDGE_RATE_LIMIT_WINDOW_MS=60000
```

This matches the prototype-style backend env shape:

```txt
DB_HOST=picso102.sci.pitt.edu
DB_PORT=5432
DB_NAME=civicwatch
DB_USER=civicwatch
DB_PASSWORD=...
DB_SSL=require
PORT=8500
```

CivicWatch accepts `PORT` as an `API_PORT` alias, but `API_PORT` is clearer
when the same deployment also runs a SvelteKit web process. If your database
password contains URI-special characters, set `DATABASE_URL` explicitly instead
of the split `DB_*` values.

If your remote `.env` contains `DATABASE_URL`, it takes precedence over the
split `DB_*` values. For PICSO102, either use:

```txt
DATABASE_URL=postgres://civicwatch:PASSWORD@picso102.sci.pitt.edu:5432/civicwatch
```

or remove/comment `DATABASE_URL` and use:

```txt
DB_HOST=picso102.sci.pitt.edu
DB_PORT=5432
DB_NAME=civicwatch
DB_USER=civicwatch
DB_PASSWORD=PASSWORD
DB_SSL=require
```

With either version, `pnpm run start:local:bash` will skip local `.postgres-data`
because the database host is not `localhost:55432`.

If the app is mounted under a subpath such as `/CivicWatch`, build with:

```txt
PUBLIC_BASE_PATH=/CivicWatch
PUBLIC_API_BASE_URL=/CivicWatch/api/v1
API_BASE_URL=http://127.0.0.1:4004/api/v1
```

Then install dependencies, build, and start the built Node servers:

```bash
pnpm install --frozen-lockfile
pnpm run db:prepare
pnpm run db:posts:canonical
pnpm run db:network:prepare
pnpm run build
pnpm run start:prod:linux
```

`pnpm run db:prepare` reads `.env`, honors `DB_SSL=require`, and creates the
`app_*` materialized helper views used by the API. Run it once after restoring
or pointing at a new database. The command is safe to repeat when the underlying
database/corpus changes; it will rebuild the helper views and indexes.

`pnpm run db:posts:canonical` is also non-destructive. It preserves raw `posts`
and builds a slim `app_posts_canonical_map` plus an `app_posts_canonical` view
(and `app_post_duplicate_audit`), collapsing duplicate tweet-ID rows for visible
post cards while retaining duplicate counts. Run it before launching a fresh
production build.

On hosts where Postgres `data_directory` lives on a small volume (for example
`/var` with only a few GB free) but `/home` has ample space, create a tablespace
once before the derived-table jobs:

```bash
sudo mkdir -p /home/postgres-tablespaces/civicwatch_app
sudo chown postgres:postgres /home/postgres-tablespaces/civicwatch_app
sudo chmod 700 /home/postgres-tablespaces/civicwatch_app
sudo -u postgres psql -d civicwatch -c "
CREATE TABLESPACE civicwatch_app
  LOCATION '/home/postgres-tablespaces/civicwatch_app';
"
```

The prepare scripts automatically use `civicwatch_app` for derived `app_*`
tables and temp/sort files when that tablespace exists. Core `posts` /
`legislators` stay on the default data directory.

Optional derived interaction tables can be prepared separately:

```bash
pnpm run db:network:prepare
```

This creates and refreshes additive `app_legislator_handles`,
`app_post_interactions`, `app_network_edges`, and `app_network_builds` tables
from `posts` and `legislators`. It does not modify the source tables. You can
scope a build when experimenting:

```bash
pnpm run db:network:prepare -- --state TX --topic 20
pnpm run db:network:prepare -- --from 2024-01-01 --to 2024-12-31
```

The build uses staging tables first, then swaps only the derived `app_*` tables
after the staging work succeeds.

Hydrated tweet JSONL can also be imported non-destructively:

```bash
pnpm run db:hydration:import -- --file tweet-hydration/hydrated_tweets.jsonl
```

That command creates and fills `app_hydrated_tweets`,
`app_hydrated_tweet_mentions`, `app_hydrated_post_interactions`, and
`app_hydration_imports`. By default it only reports how many `posts.text` rows
could be safely expanded. To test a small slice first:

```bash
pnpm run db:hydration:import -- --file tweet-hydration/hydrated_tweets.jsonl --limit 1000
```

To actually apply conservative text expansions:

```bash
pnpm run db:hydration:apply-text -- --file tweet-hydration/hydrated_tweets.jsonl
```

Text updates are intentionally narrow: the hydrated payload id must match the
requested tweet id, the hydrated text must be longer, and the current database
text must be an exact prefix of the hydrated text. No other `posts` columns are
changed.

If the JSONL import finishes but the final derived-table refresh is interrupted
or hits a database timeout, rerun only the finalization step with the import id
printed by the failed run:

```bash
pnpm run db:hydration:import -- --refresh-only --import-id hydration_YYYYMMDD_HHMMSS
```

This does not reread the JSONL file. It rebuilds the hydrated mention/reply/quote
interaction tables, recomputes safe text-update candidates, and marks the import
complete.

`pnpm run build` loads the root `.env` before building. That is required for
subpath deployments because SvelteKit must see `PUBLIC_BASE_PATH=/CivicWatch`
at build time; otherwise the browser will request assets from `/_app/...`
instead of `/CivicWatch/_app/...`.

Production traffic defaults are intentionally conservative:

- The API should bind to `127.0.0.1`, with public traffic entering through the
  Express reverse proxy.
- Set `CIVICWATCH_INTERNAL_TOKEN` to the same long random value for the API and
  web processes so SSR requests can bypass public rate-limit buckets without
  opening that bypass to forwarded public traffic.
- Keep `CIVICWATCH_CORS_ENABLED=false` in production unless a separate approved
  origin must call the API directly.
- First-party analytics are written as JSONL to `CIVICWATCH_ANALYTICS_FILE`.
  They record page views, client errors, downloads, and search result counts,
  but not raw search text or post text.
- `server.civicwatch.example.js` includes root redirects, security headers,
  immutable asset caching, request logs, `robots.txt`, and edge rate limiting.

See `docs/OPERATIONS_RUNBOOK.md` and `docs/PRODUCTION_TRAFFIC_READINESS.md` for
release checks, incident triage, analytics notes, and traffic-hardening details.
Example `systemd` and logrotate templates live under `deploy/`.

`start:prod:linux` passes `--skip-db-start` because production should usually
point at a managed or separately supervised Postgres instance. If you really do
want to run the restored local cluster on Linux, call
`bash ./scripts/start-civicwatch.sh --production` instead.

For a production-like development run on Linux, use the same command:

```bash
pnpm run start:local:bash
```

## Useful Commands

```powershell
pnpm run check
pnpm run build
pnpm run db:start
pnpm run db:prepare
pnpm run db:network:prepare
pnpm run db:hydration:import -- --limit 1000
pnpm run db:stop
```

`pnpm run check` validates the API TypeScript project and the SvelteKit app.
`pnpm run db:prepare` applies the exploration views/index prep script against
the database described by `.env`. `pnpm run db:network:prepare` builds the
network preprocessing tables. `pnpm run db:hydration:import` imports hydrated
tweet metadata in dry-run text-update mode unless `--apply-text-updates` is
passed.

## Troubleshooting

- `pg_ctl was not found`: add your PostgreSQL `bin` directory to `PATH`.
- `Postgres data directory not found`: restore the dump into `.postgres-data`
  according to `POSTGRES_DUMP_README.md`.
- Client lookups return 404: confirm the API is running and
  `PUBLIC_API_BASE_URL` points to `/api/v1`.
- Landing page returns 500 with `relation "app_legislator_summary" does not
  exist`: run `pnpm run db:prepare` against the active database, then restart
  the API/web process.
- Port conflicts: this app uses Postgres `55432`, API `4000`, and web `5173`
  by default. Adjust `.env` for Postgres/API conflicts; the Svelte dev port
  lives in `apps/web/package.json`.

## Scope

The implementation follows the design and technical documents with a runnable
local analytical slice: landing, sampler, chamber view, lookup, legislator
profiles with voice fingerprints and interaction networks, place explorer,
topic explorer, moment explorer, About/methods content, bounded API endpoints,
metadata envelopes, exports, and no-data handling. The Compare interface remains
hidden until it receives a fuller product pass.
