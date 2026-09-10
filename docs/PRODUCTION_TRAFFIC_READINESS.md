# CivicWatch Production Traffic Readiness

## Current Diagnosis

The observed production failures are primarily API rate-limit failures surfacing
as SvelteKit page failures.

The problematic flow is:

1. A visitor requests a page such as `/CivicWatch/who/162850946`.
2. SvelteKit server-side rendering calls the Fastify API on localhost.
3. Fastify sees those server-side calls as coming from `127.0.0.1`.
4. `@fastify/rate-limit` counts many visitors against one shared localhost
   bucket.
5. The API returns `429 Too Many Requests`.
6. The SvelteKit API helper throws during SSR, which previously turned the page
   request into a generic `500`.

The Express reverse proxy is probably not the first component failing, but it is
part of the fix: it must preserve the original client address for browser API
traffic, while SvelteKit-to-API localhost traffic should not be treated as
public user traffic.

## Changes Already Made

- Fastify now uses `trustProxy: true` by default.
- Fastify rate limiting is configurable with environment variables.
- Fastify rate-limit keys prefer forwarded client headers when present.
- Loopback requests with no forwarded client address bypass the limiter by
  default. If `CIVICWATCH_INTERNAL_TOKEN` is set, that bypass also requires the
  matching private token from SvelteKit. This protects SvelteKit SSR calls from
  sharing one public bucket.
- `/api/v1/health` no longer consumes rate-limit capacity.
- `/api/v1/meta` is cached in memory for five minutes by default.
- `/api/v1/meta` now sends short-lived HTTP cache headers.
- SvelteKit data preloading now happens on tap rather than hover, reducing
  accidental API fanout during ordinary navigation.
- The API has configurable CORS, request body limits, security/noindex headers,
  and opt-in API docs exposure for production.
- A first-party `/api/v1/analytics` endpoint records compact JSONL page-view,
  client-error, search, filter, and download events without storing raw search
  text or post text.
- SvelteKit's server API helper now preserves upstream HTTP statuses, so an API
  `429` becomes a page-level `429` instead of an opaque `500`.
- The root layout treats `/meta` as non-fatal, so metadata pressure alone should
  not take down page rendering.
- The web app has a route-level error page for 429/404/500 states.
- `apps/web/static/robots.txt` blocks app API crawling, query-string crawling,
  and the currently hidden Compare page for `/CivicWatch`.
- `apps/web/static/sitemap.xml` lists only canonical public pages.
- `server.civicwatch.example.js` now includes a CivicWatch-only public proxy
  with root redirects, security headers, immutable asset caching, access logs,
  root `robots.txt`/`sitemap.xml`, forwarded client headers, and no-dependency
  edge rate limiting.

## Production Environment Variables

Recommended production values:

```env
PUBLIC_BASE_PATH=/CivicWatch
PUBLIC_API_BASE_URL=/CivicWatch/api/v1
API_BASE_URL=http://127.0.0.1:4004/api/v1

API_HOST=127.0.0.1
API_PORT=4004
WEB_HOST=127.0.0.1
WEB_PORT=3004

CIVICWATCH_TRUST_PROXY=true
CIVICWATCH_RATE_LIMIT_MAX=900
CIVICWATCH_RATE_LIMIT_WINDOW=1 minute
CIVICWATCH_RATE_LIMIT_BYPASS_INTERNAL=true
CIVICWATCH_META_CACHE_SECONDS=300
CIVICWATCH_BODY_LIMIT_BYTES=262144
CIVICWATCH_CORS_ENABLED=false
CIVICWATCH_CORS_ORIGINS=https://picso101.sci.pitt.edu
CIVICWATCH_API_DOCS_ENABLED=false
CIVICWATCH_ANALYTICS_ENABLED=true
CIVICWATCH_ANALYTICS_FILE=logs/analytics.jsonl
CIVICWATCH_ANALYTICS_RATE_LIMIT_MAX=120
CIVICWATCH_ANALYTICS_RATE_LIMIT_WINDOW=1 minute
CIVICWATCH_INTERNAL_TOKEN=replace-with-long-random-secret
CIVICWATCH_EDGE_RATE_LIMIT_MAX=600
CIVICWATCH_EDGE_RATE_LIMIT_WINDOW_MS=60000
```

Notes:

- Keep `API_HOST=127.0.0.1` so the Fastify API is not directly public.
- Keep the Express proxy as the public ingress.
- Set the same `CIVICWATCH_INTERNAL_TOKEN` for both the SvelteKit web process
  and the Fastify API process.
- If the API is ever exposed directly to the network, revisit
  `CIVICWATCH_RATE_LIMIT_BYPASS_INTERNAL`, CORS, API docs, and forwarded-header
  trust.
- Keep `CIVICWATCH_API_DOCS_ENABLED=false` in public production unless you
  deliberately want `/docs` exposed through a controlled route.
- Keep `logs/` out of Git and configure log rotation for analytics JSONL.

## Required Express Proxy Update

Set `xfwd: true` on the Express `createProxyMiddleware` entries for CivicWatch.
This causes `X-Forwarded-For`, `X-Forwarded-Host`, and `X-Forwarded-Proto` to be
sent to Fastify.

Example:

```js
const civicwatchApiTarget =
  process.env.CIVICWATCH_API_TARGET || 'http://127.0.0.1:4004';
const civicwatchWebTarget =
  process.env.CIVICWATCH_WEB_TARGET || 'http://127.0.0.1:3004';

proxy('/CivicWatch/api', civicwatchApiTarget, '/api', { xfwd: true });

app.use(
  '/CivicWatch',
  createProxyMiddleware({
    target: civicwatchWebTarget,
    changeOrigin: true,
    ws: true,
    xfwd: true,
    pathRewrite: (_pathReq, req) => req.originalUrl,
    onError: (err, req, res) => {
      console.error(`Proxy error (/CivicWatch -> ${civicwatchWebTarget}):`, err.message);
      res.status(502).send('Bad gateway (/CivicWatch)');
    }
  })
);
```

If your helper `proxy()` does not accept an options object yet, update it like:

```js
const proxy = (mountPath, targetBase, backendPrefix = '', extra = {}) =>
  app.use(
    mountPath,
    createProxyMiddleware({
      target: targetBase,
      changeOrigin: true,
      pathRewrite: (pathReq) => `${backendPrefix}${pathReq}`,
      onError: (err, req, res) => {
        console.error(`Proxy error (${mountPath} -> ${targetBase}):`, err.message);
        res.status(502).send(`Bad gateway (${mountPath})`);
      },
      ...extra
    })
  );
```

The maintained full version is `server.civicwatch.example.js`.

Important: browser-side API requests to `/CivicWatch/api/v1/...` need forwarded
client headers. SvelteKit server-side API requests to `127.0.0.1:4004` will not
have forwarded headers and will bypass the API limiter as internal traffic. In
production, use `CIVICWATCH_INTERNAL_TOKEN` so only the SvelteKit process can
claim that bypass.

## Highest-Impact Remaining Follow-Ups

1. Add process supervision.
   Run the Express proxy, SvelteKit server, and Fastify API under `systemd`,
   `pm2`, or another supervisor with restart policies and log rotation.

2. Add OS-level log rotation.
   Rotate Express logs, Fastify logs, SvelteKit logs, and
   `logs/analytics.jsonl`. The JSONL analytics stream is append-only and will
   otherwise grow forever.

3. Audit high-fanout SSR loaders.
   The topic detail page currently makes many server-side API calls. Consider
   bundling related topic detail data into one API endpoint or making secondary
   panels client-deferred.

4. Keep expensive exploratory endpoints bounded.
   Network, post explorer, export, and moment-window endpoints should keep caps,
   use prepared `app_*` tables where possible, and expose clear loading/error
   states.

5. Monitor database pressure.
   Track slow queries, statement timeouts, active connections, and temp file
   usage. The API pool currently allows up to 12 Postgres connections.

6. Consider adding CDN or reverse-proxy compression.
   The Express example sets cache headers for immutable SvelteKit assets, but
   gzip/brotli is best handled by a fronting web server or CDN when available.

## Web Hygiene Checklist

- Serve `/robots.txt` at the site root from Express and from the Svelte app
  subpath. The maintained proxy example does this.
- Keep `/sitemap.xml` limited to canonical pages:
  `/CivicWatch`, `/CivicWatch/who`, `/CivicWatch/place`, `/CivicWatch/topic`,
  `/CivicWatch/moment`, and `/CivicWatch/about`. Avoid enumerating thousands of
  legislator/topic/filter URLs until traffic is stable.
- Ensure canonical links use `/CivicWatch/...` and do not expose duplicate
  root-path URLs.
- Keep API routes out of indexing with robots rules and/or `X-Robots-Tag:
  noindex`.
- Keep security headers at Express or SvelteKit edge:
  `X-Content-Type-Options: nosniff`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, and a measured
  Content Security Policy after testing.
- Compress static assets and API JSON responses with gzip or brotli at the
  reverse proxy.
- Set long cache headers for immutable SvelteKit assets under
  `/CivicWatch/_app/immutable/`.
- Keep `PUBLIC_BASE_PATH=/CivicWatch` set before `pnpm run build`.
- Verify after deploy:
  - `curl -k -I https://picso101.sci.pitt.edu/CivicWatch/`
  - `curl -k -I https://picso101.sci.pitt.edu/CivicWatch/_app/version.json`
  - `curl -k -I https://picso101.sci.pitt.edu/CivicWatch/api/v1/health`
  - `curl -k -I https://picso101.sci.pitt.edu/robots.txt`
  - `curl -k -I https://picso101.sci.pitt.edu/sitemap.xml`
  - `curl -k -I https://picso101.sci.pitt.edu/CivicWatch/robots.txt`

## Practical Demo Settings

For a demo window, prefer resilient settings over strict throttling:

```env
CIVICWATCH_RATE_LIMIT_MAX=1800
CIVICWATCH_RATE_LIMIT_WINDOW=1 minute
CIVICWATCH_RATE_LIMIT_BYPASS_INTERNAL=true
CIVICWATCH_META_CACHE_SECONDS=600
```

If abuse or crawler traffic appears, lower the public API limit at the Express
edge rather than reintroducing a shared localhost SSR bottleneck inside Fastify.
