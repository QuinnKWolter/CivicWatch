# CivicWatch Operations Runbook

## Release Checklist

1. Pull the intended commit on the production host.
2. Confirm `.env` has the public base path and loopback targets:
   `PUBLIC_BASE_PATH=/CivicWatch`,
   `PUBLIC_API_BASE_URL=/CivicWatch/api/v1`, and
   `API_BASE_URL=http://127.0.0.1:4004/api/v1`.
3. Confirm production hardening values:
   `CIVICWATCH_CORS_ENABLED=false`,
   `CIVICWATCH_API_DOCS_ENABLED=false`,
   `CIVICWATCH_ANALYTICS_ENABLED=true`, and matching
   `CIVICWATCH_INTERNAL_TOKEN` values for web and API.
4. Run database preparation after restoring or replacing the database:
   `pnpm run db:prepare`,
   `pnpm run db:posts:canonical`, and
   `pnpm run db:network:prepare` when network views are needed.
5. Run `pnpm install --frozen-lockfile`, `pnpm run check`, and
   `pnpm run build`.
6. Restart the API, SvelteKit web process, and Express proxy through the chosen
   process supervisor.
7. Verify:
   `curl -k -I https://picso101.sci.pitt.edu/CivicWatch/`,
   `curl -k https://picso101.sci.pitt.edu/CivicWatch/api/v1/health`,
   and `curl -k -I https://picso101.sci.pitt.edu/robots.txt`.

## Process Supervision

Example `systemd` units live in `deploy/systemd/`, and an example logrotate
policy lives in `deploy/logrotate/civicwatch.example`. Review the user, paths,
Node path, and working directories before installing them on production. The
proxy unit binds to port 443 and therefore runs as root in the example; using a
fronting web server or Linux capabilities is preferable if available.

## Traffic Incident Checklist

When users report 429 or 500 errors:

1. Check Express access logs for crawlers, repeated query URLs, or a single IP
   generating many requests.
2. Check Fastify logs for the request id, upstream status, and rate-limit
   messages.
3. Confirm the Express proxy is sending forwarded headers with `xfwd: true`.
4. Confirm `CIVICWATCH_INTERNAL_TOKEN` is present in both the API and web
   process environments.
5. Temporarily raise `CIVICWATCH_EDGE_RATE_LIMIT_MAX` for a demo window if the
   traffic is legitimate.
6. If errors are database timeouts rather than rate limits, check active
   connections, slow queries, temp file usage, and whether derived `app_*`
   tables are current.

## Analytics

The app sends first-party analytics to `/api/v1/analytics`. Events are written
as JSONL to `CIVICWATCH_ANALYTICS_FILE`, defaulting to `logs/analytics.jsonl`.

Recorded event families:

- `page_view`
- `client_error`
- `search_completed` and `search_failed`
- `filters_applied`
- `copy_link`
- `download_started`, `download_completed`, and `download_failed`

The client does not send raw search strings, post text, or page content.
Configure log rotation for `logs/analytics.jsonl` before a public launch.

## Cleanup

Keep these out of Git and remove/recreate them as needed:

- `.postgres-data/`
- `.postgres-log/`
- root database dumps named `civicwatch_postgres_full_*`
- `tweet-hydration/`
- `legislator_missing_data_export/`
- `apps/web/.build-stale-*/`
- `logs/`

Do not delete `.postgres-data/` unless you are intentionally discarding the
local restored database.

## Rollback

Keep the previous production checkout, build output, and `.env` available. If a
release fails:

1. Stop the web/API processes for the new release.
2. Restore the previous checkout or symlink target.
3. Restart the previous API and web process.
4. Restart the Express proxy only if `server.js` changed.
5. Re-run the verification curls above.
