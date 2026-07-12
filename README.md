# CivicWatch

CivicWatch is a local SvelteKit/Fastify exploration app for the restored
CivicWatch legislative speech dump. The default setup uses an isolated Postgres
cluster on `localhost:55432`, so it does not touch any other Postgres instances
you may have running on the usual `5432` port.

## Requirements

- Node.js and pnpm
- PostgreSQL command line tools on `PATH` (`pg_ctl`, `psql`, and `pg_isready`)
- The restored CivicWatch Postgres data directory at `.postgres-data`
- A local `.env` file; this repo includes one for the current local dump

For a fresh dump restore, follow `POSTGRES_DUMP_README.md` first. The runnable
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

The current local dump metadata captured in `.env` is:

```txt
snapshot=cw_2026_07_02_full
coverage=2020-01-01..2025-01-04
posts=22175504
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
- API docs: `http://127.0.0.1:4000/docs`

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

If the app is mounted under a subpath such as `/prototype04`, build with:

```txt
PUBLIC_BASE_PATH=/prototype04
PUBLIC_API_BASE_URL=/prototype04/api/v1
API_BASE_URL=http://127.0.0.1:4004/api/v1
```

Then install dependencies, build, and start the built Node servers:

```bash
pnpm install --frozen-lockfile
pnpm run build
pnpm run start:prod:linux
```

`pnpm run build` loads the root `.env` before building. That is required for
subpath deployments because SvelteKit must see `PUBLIC_BASE_PATH=/prototype04`
at build time; otherwise the browser will request assets from `/_app/...`
instead of `/prototype04/_app/...`.

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
pnpm run db:stop
```

`pnpm run check` validates the API TypeScript project and the SvelteKit app.
`pnpm run db:prepare` applies the exploration views/index prep script against
the local `civicwatch_explore` database.

## Troubleshooting

- `pg_ctl was not found`: add your PostgreSQL `bin` directory to `PATH`.
- `Postgres data directory not found`: restore the dump into `.postgres-data`
  according to `POSTGRES_DUMP_README.md`.
- Client lookups return 404: confirm the API is running and
  `PUBLIC_API_BASE_URL` points to `/api/v1`.
- Port conflicts: this app uses Postgres `55432`, API `4000`, and web `5173`
  by default. Adjust `.env` for Postgres/API conflicts; the Svelte dev port
  lives in `apps/web/package.json`.

## Scope

The implementation follows the design and technical documents with a runnable
local analytical slice: landing, sampler, chamber view, lookup, legislator
profiles with voice fingerprints, place explorer, topic explorer, moment
explorer, compare, methods, bounded API endpoints, metadata envelopes, and
no-data handling.
