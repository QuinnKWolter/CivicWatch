# CivicWatch — Technical Specification

*Implementation brief for the design described in `civicwatch_design_doc.md`. Every decision here should be executable — SQL you can run, code you can copy, filenames you can create, decisions you don't need to relitigate. Where I depart from an earlier draft, I say why in one line.*

---

## 0. Preamble

**Reader.** This document assumes the reader has read the design doc and will build against it. It targets an implementer who is comfortable in TypeScript, PostgreSQL, and Python. It does not assume Rust or ClickHouse expertise; both are deliberately absent from the stack.

**Scope.** Everything from raw source data to a deployed, accessible, exportable web application. Explicit non-goals: real-time streaming, user accounts, authentication, multi-tenant infrastructure, mobile applications separate from the web app, machine learning inference at request time.

**Rule of thumb.** When two approaches would work, pick the one that a single developer can debug at 2 AM. Everything in this doc has been selected with that filter.

---

## 1. Executive summary

### 1.1 The stack

| Layer | Choice | Reason in one line |
|---|---|---|
| Frontend framework | SvelteKit 2 + Svelte 5 (runes) | Small bundles, fine-grained reactivity, direct DOM/Canvas control |
| Language everywhere applicable | TypeScript 5.x (strict) | One language across API and web |
| Backend runtime | Node.js LTS (22 or newer) | Mature, well-supported, hits performance targets for I/O-bound work |
| API framework | Fastify 4 | Fast, low-overhead, first-class TypeScript, schema-driven |
| Contract validation | Zod + `zod-to-openapi` | Single source of truth for request/response types |
| Database | PostgreSQL 17 | Already the source of truth; 22M rows is small for PG; materialized views exist |
| Database driver | `postgres` (Porsager) | Tagged-template SQL, zero ORM, excellent types |
| Migrations | Plain SQL files + `node-pg-migrate` runner | Transparent, reviewable, no ORM lock-in |
| Search | PostgreSQL `pg_trgm` + generated tsvector | Small corpus (~6K legislators + 50 states + 22 topics) |
| Pipeline language | Python 3.12 with `uv`, Polars, DuckDB, PyArrow | Match Quinn's research environment; columnar data processing |
| Object storage | Local filesystem in v1; S3-compatible (MinIO) when needed | Snapshots are ~a few GB of Parquet |
| Reverse proxy | Caddy 2 | Automatic HTTPS, simple config |
| Container runtime | Docker Compose (v1); Podman/Quadlet available later | Broadest familiarity, works on Windows dev |
| CI | GitHub Actions | Public discovery + contributor accessibility |
| Observability | Structured JSON logs + Prometheus + Grafana OSS | Sufficient for a single-node deployment; OTel-ready |
| Analytics | Self-hosted Plausible or Umami | Privacy-respecting page views for research/traffic understanding |
| Fonts | Instrument Sans + JetBrains Mono + Fraunces (all SIL OFL) | Self-hosted, subset, no proprietary dependencies |
| Testing | Vitest + Playwright + axe-core (web); Vitest (api); pytest (pipeline); k6 (load) | Standard FOSS test tooling |
| License | AGPL-3.0-or-later (code) + CC-BY-4.0 (docs) + OFL (fonts) | Institutional review still required |

### 1.2 Deltas from the previously circulated tech doc

- ClickHouse → **PostgreSQL only**. Simpler, sufficient, already provisioned.
- Rust/Axum → **Node.js + Fastify + TypeScript**. Development velocity wins for a small team; performance targets still hit.
- deck.gl / GPU tier → **removed from v1**. Not needed at this data scale.
- Valkey as a separate service → **removed from v1**. Replaced by in-process caching + HTTP caching.
- Forgejo + Woodpecker → **GitHub + Actions**. Public discoverability for a civic-tech tool.
- Podman + Quadlet as the default → **Docker Compose as default**. Podman remains a valid production alternative.
- Client library plurality (viz-core, viz-svg, viz-canvas, viz-gpu) → **one `viz` package** with rendering-mode variants inside components. Fewer packages, less overhead.

### 1.3 Public deployment topology, at a glance

A single VPS or on-prem VM. Reasonable target: 8 vCPU, 32GB RAM, 500GB NVMe SSD. All services on one host in v1, backed up off-host.

```
                     ┌─────────────────────────────┐
                     │           Caddy (443/80)    │
                     └──────────────┬──────────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                                       │
                ▼                                       ▼
      ┌─────────────────┐                     ┌─────────────────┐
      │  SvelteKit      │  ← SSR pages        │  Fastify API    │
      │  (Node adapter) │  ← static assets    │  (Node.js)      │
      └────────┬────────┘                     └────────┬────────┘
               │                                       │
               │           (server-to-server)          │
               └───────────────────────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   PostgreSQL 17     │
                         │   (posts, MVs,      │
                         │    metadata,        │
                         │    search)          │
                         └─────────────────────┘

                    Off-host: object storage for Parquet snapshots,
                             daily PG backups, log shipping
```

Grafana + Prometheus optionally on the same host; move off when it competes for resources.

---

## 2. Guiding principles

Ten principles the implementation should hold to.

1. **Ship one database.** PostgreSQL is enough. Add a second only under evidence.
2. **Bound every query.** Every endpoint enforces row limits, timeouts, and allowed dimensions.
3. **Aggregate on the server, always.** The browser receives visualization-ready payloads, never raw fact rows for aggregate visuals.
4. **Snapshot > mutate.** Data changes are new snapshots; existing rows are immutable during a snapshot's lifetime.
5. **URL is the truth.** Every shareable state is in the URL. Local storage is a convenience, never authoritative.
6. **One language on both sides of the wire.** TypeScript everywhere the wire is crossed. Zod as the single schema source.
7. **Accessibility is a data problem, not a decoration problem.** Every chart has a table.
8. **Motion earns its place.** Six defined animations; no more without justification.
9. **Test the seams.** Integration tests over unit tests where budget is limited. Visual regression for charts.
10. **Optimize the median, protect the tail.** P95 latency is the number that matters; p99 gets timeouts, not tuning.

---

## 3. Constraints and non-goals

### 3.1 Constraints

- Everything FOSS. No proprietary fonts, hosted services required for prod, or closed dependencies.
- Data volume: 22.2M posts, 5,927 legislators, ~1,300 covered dates, 22 topics. Growth budget: assume up to 100M posts before revisiting fundamental architecture.
- Latency budget from the design doc: cached p95 under 200 ms, uncached aggregate p95 under 800 ms, search p95 under 150 ms.
- Bundle budget: landing route under 180 KB gzip JS, under 45 KB gzip CSS.
- Development team: assume 1–3 people, mostly one primary maintainer. Ownership burden matters.
- Development platform: Windows and Linux both supported. Docker Desktop works on Windows.

### 3.2 Non-goals (explicit)

- No user accounts, auth, or personalization in v1.
- No writes from the frontend. Everything is read-only.
- No real-time features. The snapshot is dated.
- No admin UI in v1. Snapshot activation is a CLI command against the database.
- No microservices. One API service, one web service.
- No internationalization framework in v1. English only. Text is written for translation later if that becomes a priority.

---

## 4. Data architecture

### 4.1 One database, PostgreSQL

The single most important simplification in this document.

The existing CivicWatch schema is in PostgreSQL. It contains all 22.2M posts, 5,927 legislators, 22 topics, and three materialized views. It works. Modern PostgreSQL on modest hardware handles:

- The Chamber View aggregate: instant (`legislator_summary` view).
- The Topic Ribbon (~28K daily rows from `topic_engagement_daily`): under 50 ms.
- State breakdowns (1,100 rows from `topic_state_breakdown`): under 20 ms.
- Legislator profile queries (a few thousand posts): under 200 ms with the right indexes.
- Search across 6K legislators with `pg_trgm`: under 30 ms.

The scale threshold at which I would reconsider: **~150M posts**, or sustained aggregate query latency above 500 ms with the right indexes and materialized views. Below that, PostgreSQL wins on operational simplicity.

Configuration recommendations (16 GB effective allocation):

```
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 32MB
maintenance_work_mem = 512MB
max_parallel_workers_per_gather = 4
max_worker_processes = 8
random_page_cost = 1.1
effective_io_concurrency = 200
default_statistics_target = 200
```

### 4.2 Schema strategy

The schema evolves in three sections:

1. **Snapshot dimension** (new). Every fact and aggregate row is tagged with a `snapshot_id`. The application resolves one active snapshot per session by default.
2. **Fact tables** (extend the existing `posts` table). Add snapshot tagging and precomputed sampling hashes.
3. **Aggregate tables** (replace the current materialized views with a richer set). Rebuilt during snapshot activation.

### 4.3 Fact and dimension tables

Full DDL is in Appendix A. Highlights:

- `snapshots` — snapshot manifest.
- `legislators_v2` — the identity/dimension table. Adds `snapshot_id`.
- `topics_v2` — the topic dimension. Adds `snapshot_id`.
- `posts_v2` — the fact table. Adds `snapshot_id`, denormalized `state`/`party`/`chamber`/`is_political`, and two precomputed sampling hashes (`sample_uniform_h`, `sample_weighted_h`).
- `events` — curated event annotations (§8 of the design doc).

Denormalization on `posts_v2` matters. The design's default views (topic drilldown, state drilldown) filter by state, party, chamber, and political classification together. Joining 22M-row posts against 6K-row legislators once per query is fine on modern PG but becomes a bottleneck under concurrency. Denormalize during snapshot build.

Why not just alter the existing `posts` table? Because the snapshot model needs immutability and the ability to publish a new version while an old version is still serving. `posts_v2` lets us load a new snapshot into new rows, validate, and flip the active snapshot ID with a single row update in the `snapshots` table. No downtime, no destructive alteration.

### 4.4 Materialized views (aggregate tables)

Every visualization must be backed by a named aggregate table or view. The full set:

| Aggregate | Backs | Approx rows |
|---|---|---|
| `mv_topic_daily` | Topic Ribbon | ~28,600 (22 topics × 1,300 days) |
| `mv_topic_party_daily` | Topic Ribbon party overlays | ~85K |
| `mv_topic_state_daily` | State salience map, some drilldowns | ~1.4M — probably keep this as a partitioned table, not MV |
| `mv_topic_party_summary` | Topic tiles, party mix | 66 rows (already exists as `topic_party_breakdown`) |
| `mv_topic_state_summary` | Topic-by-state | 1,100 rows |
| `mv_state_topic_summary` | 50-state small multiples | 1,100 rows (same data, different orientation) |
| `mv_state_summary` | State drilldowns, place explorer | 50 rows |
| `mv_legislator_summary` | Legislator profile headers, roll call browse | 5,927 rows (already exists as `legislator_summary`) |
| `mv_legislator_topic` | Voice fingerprint | ~130K (5,927 × 22) |
| `mv_legislator_monthly` | Profile activity timelines | ~356K (5,927 × 60 months) |
| `mv_top_posts_state` | State drilldown top posts | ~500 (top 10 × 50) |
| `mv_top_posts_topic` | Topic drilldown top posts | ~220 (top 10 × 22) |
| `mv_top_posts_legislator` | Profile top posts | ~59K (top 10 × 5,927) |
| `mv_sampler_candidates` | Sampler | ~500K (stratified) |
| `mv_event_window` | Moment explorer windowed stats | ~200 (36 events × several metrics) |
| `mv_legislator_similarity` | Related profiles | ~29K (top 5 nearest × 5,927) |

Refresh strategy: **all rebuilt during snapshot activation**, not incrementally. Rebuilding all of them from `posts_v2` for a single snapshot takes minutes, not hours. Incremental refresh is a complexity we don't need at this scale.

### 4.5 Indexes

Indexes on `posts_v2`:

```sql
-- primary
CREATE INDEX posts_v2_snapshot_id_idx ON posts_v2 (snapshot_id);

-- filter combinations that appear in top endpoints
CREATE INDEX posts_v2_topic_date_idx
  ON posts_v2 (snapshot_id, topic_id, created_date);

CREATE INDEX posts_v2_state_date_idx
  ON posts_v2 (snapshot_id, state, created_date);

CREATE INDEX posts_v2_legislator_date_idx
  ON posts_v2 (snapshot_id, lid, created_date);

-- keyset pagination for post feeds
CREATE INDEX posts_v2_legislator_pagination_idx
  ON posts_v2 (snapshot_id, lid, created_date DESC, id DESC);

CREATE INDEX posts_v2_topic_pagination_idx
  ON posts_v2 (snapshot_id, topic_id, engagement_primary DESC, id DESC);

-- sampler
CREATE INDEX posts_v2_sample_uniform_idx
  ON posts_v2 (snapshot_id, sample_uniform_h);

CREATE INDEX posts_v2_sample_weighted_idx
  ON posts_v2 (snapshot_id, sample_weighted_h);
```

Partitioning: consider list-partitioning `posts_v2` on `snapshot_id`. This makes snapshot rotation cheap (drop old partition) and constrains query planning to the active snapshot. Partition per year within snapshot is optional; probably unnecessary at 22M rows.

### 4.6 Search infrastructure

Three separate search corpora:

- Legislators (~6K rows).
- States (50 rows).
- Topics (22 rows).

Use PostgreSQL `pg_trgm` for legislator name/handle fuzzy matching, plus a generated tsvector column for full-text on display name. States and topics use exact-plus-prefix matching (they're tiny).

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- generated column for normalized search text
ALTER TABLE legislators_v2
  ADD COLUMN search_text text
  GENERATED ALWAYS AS (
    lower(unaccent(coalesce(name, '') || ' ' || coalesce(handle, '')))
  ) STORED;

CREATE INDEX legislators_v2_search_trgm_idx
  ON legislators_v2 USING gin (search_text gin_trgm_ops);
```

Query pattern for legislator search:

```sql
SELECT lid, name, handle, state, party, chamber, total_posts
FROM legislators_v2 l
JOIN mv_legislator_summary ls ON ls.lid = l.lid
WHERE l.snapshot_id = $1
  AND (
    l.search_text % lower(unaccent($2))    -- similarity match
    OR l.search_text ILIKE lower(unaccent($2)) || '%'  -- prefix boost
  )
ORDER BY
  similarity(l.search_text, lower(unaccent($2))) DESC,
  ls.total_posts DESC
LIMIT 20;
```

For a fresh implementer: yes, `pg_trgm` on 6K rows is instant. There is no reason to introduce Elasticsearch, Typesense, or Meilisearch.

### 4.7 Sampler infrastructure

The Sampler needs fast, reproducible, filter-respecting random selection.

Build-time work:

- For each post in `posts_v2`, compute:
  - `sample_uniform_h`: `md5(id::text)::bytea` interpreted as a large integer, or `hashint8(id)`. Deterministic, uniform.
  - `sample_weighted_h`: `sample_uniform_h / (1 + log(1 + likes + retweets))`. Deterministic, weighted toward engagement.

At query time, the Sampler receives a `seed` (from the URL or the shuffle button), a filter set, and returns N posts. Query pattern:

```sql
WITH filtered AS (
  SELECT id, sample_uniform_h
  FROM posts_v2
  WHERE snapshot_id = $1
    AND ($2::text IS NULL OR state = $2)
    AND ($3::text IS NULL OR topic_id = $3::int)
    AND ($4::daterange IS NULL OR created_date <@ $4)
)
SELECT p.*
FROM filtered
JOIN posts_v2 p USING (id)
WHERE filtered.sample_uniform_h >= hashtextextended($5, 0)
ORDER BY filtered.sample_uniform_h
LIMIT $6;
```

This finds the smallest slice of posts whose hash is at or above the seed's hash, up to N. Because the hash is stored and indexed, the query is O(log N) into the index and returns immediately.

The `mv_sampler_candidates` table can pre-stratify samples for common filter contexts (per state, per topic, per event window), reducing even the small overhead above. For unusual filter combinations the raw query is fine.

### 4.8 Snapshot model

Full DDL for the snapshot manifest:

```sql
CREATE TABLE snapshots (
  snapshot_id      text        PRIMARY KEY,
  status           text        NOT NULL
    CHECK (status IN ('building','validated','active','retired')),
  source_cutoff    date        NOT NULL,
  built_at         timestamptz NOT NULL DEFAULT now(),
  activated_at     timestamptz,
  retired_at       timestamptz,
  row_counts       jsonb       NOT NULL,   -- {posts, legislators, topics, events}
  coverage         jsonb       NOT NULL,   -- {profiled_legislators, topics_populated, ...}
  input_checksums  jsonb       NOT NULL,
  classifier_ver   text        NOT NULL,
  code_commit      text        NOT NULL,
  schema_version   text        NOT NULL,
  notes            text
);

CREATE UNIQUE INDEX one_active_snapshot ON snapshots (status)
  WHERE status = 'active';
```

The partial unique index guarantees at most one active snapshot at a time. Activation is a two-step transaction:

```sql
BEGIN;
UPDATE snapshots SET status = 'retired', retired_at = now()
  WHERE status = 'active';
UPDATE snapshots SET status = 'active', activated_at = now()
  WHERE snapshot_id = $1 AND status = 'validated';
COMMIT;
```

Application code resolves the active snapshot with a cached query at startup and on cache invalidation events. Snapshot IDs may also appear in permalinks for reproducibility (e.g., `/topic/health?snap=cw_2026_07_01_001`).

### 4.9 Storage sizing

Rough sizes on disk:

- `posts_v2` with denormalization and indexes: ~15 GB.
- All materialized aggregates: <500 MB combined.
- `legislators_v2`, `topics_v2`, `events`, `snapshots`: negligible.
- Parquet snapshot in object storage: ~4 GB per snapshot, compressed.

Keep three snapshots online (current + two prior for rollback). Retire older snapshots by dropping their partition or their rows.

Total PostgreSQL disk under 60 GB even with three snapshots live. A 500 GB SSD is comfortable.

---

## 5. Backend API

### 5.1 Runtime and framework

**Node.js LTS (v22 or higher) with Fastify 4.**

Why Node.js over Rust for this specific application:

1. **The API is I/O-bound.** Every endpoint hits PostgreSQL and returns a bounded payload. There's no in-process computation to justify Rust's memory model.
2. **Shared types with the frontend.** Zod schemas defined once and used on both sides of the wire eliminate a class of integration bugs. Rust would require code-generation of TypeScript DTOs, which works but is another moving part.
3. **Development velocity.** Iterating on API contracts is dramatically faster in TypeScript. For a small team, this matters more than raw runtime speed.
4. **Sufficient performance.** Fastify serves 30–50K req/s on a laptop for JSON responses. Postgres is the bottleneck, not Node.

Runtime configuration:

- Node.js LTS. Use `nvm` or Volta locally; use the official Node Docker image in prod.
- ES modules throughout.
- `tsx` for development (auto-restart on save).
- `tsc --build` for production compilation.
- No transpilation to older JS; target modern Node.

### 5.2 Type contracts and validation

**Zod is the source of truth.** Every endpoint has a request schema and a response schema written in Zod. `zod-to-openapi` derives an OpenAPI 3.1 document. `openapi-typescript` (or manual export) publishes the response types to the frontend.

Example:

```ts
// packages/schemas/src/legislators.ts
import { z } from 'zod'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
extendZodWithOpenApi(z)

export const LegislatorId = z.string().min(1).max(64)

export const VoiceFingerprintResponse = z.object({
  data: z.array(z.object({
    topicId: z.number().int(),
    topicLabel: z.string(),
    selfShare: z.number(),
    partyMedianShare: z.number(),
    deviation: z.number(),
    postsInTopic: z.number().int(),
  })),
  meta: z.object({
    snapshotId: z.string(),
    legislator: z.object({
      lid: LegislatorId,
      name: z.string(),
      handle: z.string().nullable(),
      party: z.enum(['Democratic', 'Republican', 'Independent']).nullable(),
      state: z.string().length(2).nullable(),
    }),
    totalPosts: z.number().int(),
    coveragePeriod: z.tuple([z.string(), z.string()]),
    sourceTable: z.literal('mv_legislator_topic'),
    queryHash: z.string(),
    generatedAt: z.string().datetime(),
  }),
})

export type VoiceFingerprintResponse =
  z.infer<typeof VoiceFingerprintResponse>
```

The endpoint handler validates input, executes the SQL, and returns the shaped response. Fastify's schema validation reads the Zod schema (via a small adapter) and applies it at both request parse time and response serialization time.

Where Zod isn't a perfect fit (large `select` unions, discriminated types with many arms), fall back to `z.discriminatedUnion` or manual TypeScript types — but never bypass validation.

### 5.3 Endpoint catalog

Full list, versioned under `/api/v1/`. Every endpoint is `GET` unless noted.

**Metadata**
- `GET /meta` — snapshot ID, cutoff date, row counts, coverage stats. Cached aggressively.
- `GET /health` — liveness + PostgreSQL connectivity.

**Legislators**
- `GET /legislators?party=&chamber=&state=&sort=&cursor=&limit=` — paginated roll call.
- `GET /legislators/{lid}` — profile header (identity + lifetime totals).
- `GET /legislators/{lid}/voice-fingerprint` — 22-topic deviation vs. party median.
- `GET /legislators/{lid}/activity?from=&to=&groupBy=topic` — daily/monthly activity.
- `GET /legislators/{lid}/engagement?from=&to=` — engagement time series + top 5 posts.
- `GET /legislators/{lid}/posts?from=&to=&topic=&minEngagement=&political=&cursor=&limit=` — the "all posts" tail.
- `GET /legislators/{lid}/similar` — nearest neighbors on voice fingerprint.

**Places**
- `GET /states?metric=` — 50 states colored by the requested metric (choropleth data).
- `GET /states/small-multiples` — state-by-topic matrix for the 50-cell grid.
- `GET /states/{state}` — state page header + composition + top voices.
- `GET /states/{state}/topics` — topic mix within a state.
- `GET /states/{state}/trend?groupBy=party` — daily/monthly volume in the state.
- `GET /states/{state}/top-posts?topic=&party=&sortBy=` — top posts in the state.

**Topics**
- `GET /topics` — all 22 topics with headline stats.
- `GET /topics/{topicId}` — topic drilldown header.
- `GET /topics/{topicId}/ribbon` — the daily/monthly stream.
- `GET /topics/{topicId}/state-salience` — choropleth of topic-share by state.
- `GET /topics/{topicId}/beeswarm` — legislator-level ideology positions weighted by topic activity.
- `GET /topics/{topicId}/party-chamber` — 2×2 matrix.
- `GET /topics/{topicId}/adjacent` — co-occurring topics.
- `GET /topics/{topicId}/top-posts?state=&party=&sortBy=&cursor=` — top posts in the topic.
- `GET /topic-ribbon?from=&to=&groupBy=` — the full 22-band stream for the topic explorer landing.

**Moments**
- `GET /events` — the curated event list.
- `GET /moments/window?date=&width=` — topic mix + biggest movers for a window.
- `GET /moments/window/top-posts?date=&width=&sortBy=` — top posts in the window.

**Chamber (landing visualization)**
- `GET /chamber?filter=` — legislator positions + party + basic stats. Cached hard.

**Compare**
- `GET /compare?slots=` — normalized comparison payload for up to 4 slots.

**Search**
- `GET /search?q=` — legislators + states + topics grouped.

**Sampler**
- `GET /sampler?seed=&n=&filters=` — N sample posts respecting filters.

**Exports** (POST because they may take time)
- `POST /exports/csv` — request body specifies chart type + filters; returns a streaming CSV.
- `POST /exports/png` — same shape; returns a PNG (or a signed URL to a rendered image).
- `POST /exports/permalink` — normalize a URL into a canonical permalink.

**Total endpoint count: 32.** That's the entire API surface. Any request that doesn't map to one of these is a 404; there is no `SELECT` field selection, no arbitrary group-by, no GraphQL.

### 5.4 Response envelope

Every analytical response uses the same envelope:

```ts
{
  data: T,               // shape varies per endpoint
  meta: {
    snapshotId: string,          // active snapshot
    filters: Record<string, unknown>,  // normalized filter parameters
    populationCount?: number,    // total population for the query context
    includedCount?: number,      // rows contributing to the answer
    excludedMissingCount?: number, // rows excluded for missing dimensions
    coveragePeriod?: [string, string], // [ISO date, ISO date] where relevant
    sourceTable: string,         // which aggregate produced this
    queryHash: string,           // sha256 of normalized query
    generatedAt: string,         // ISO timestamp
  }
}
```

Every response — even error responses — include `snapshotId` when known. The frontend uses this to detect snapshot rotations and surface a subtle refresh prompt.

### 5.5 Error taxonomy

Fixed set of application error codes returned as JSON:

```ts
{
  error: {
    code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'RATE_LIMITED' |
          'SNAPSHOT_UNAVAILABLE' | 'QUERY_TIMEOUT' | 'INTERNAL',
    message: string,             // human-readable, safe for display
    details?: unknown,           // structured detail (validation issues)
    requestId: string,
  },
  meta: { snapshotId, generatedAt }
}
```

Never expose SQL errors, stack traces, or internal detail. Log the full error server-side with the `requestId`.

### 5.6 Query safety

Rules the API service enforces:

- **Allowlisted dimensions.** Only enumerated dimensions can appear in filters: `party`, `chamber`, `state`, `topic`, `from`, `to`, `minEngagement`, `political`. Anything else in the query string is ignored (silently) or 400 (in strict mode).
- **Allowlisted sort keys.** Each endpoint publishes its allowed sort keys.
- **Bounded row limits.** No endpoint returns more than 50,000 rows. Post feeds cap at 100 per page and use cursor pagination.
- **Bounded date ranges.** Filter ranges are clamped to the snapshot's coverage period.
- **Statement timeouts.** Every PG connection sets `statement_timeout = 5000` (5 seconds). Exports use a longer-lived pool with `statement_timeout = 30000`.
- **Read-only credentials.** The API's PG user has `GRANT SELECT` on the analytical tables only. No `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP`. Migrations and snapshot activation use a separate elevated user.
- **Parameterized queries only.** The `postgres` library uses tagged templates, which parameterize by construction. No string concatenation into SQL, ever.

### 5.7 Rate limiting

Two layers, in this order:

1. **Global per-IP.** 300 requests/minute for JSON endpoints, 30/minute for export endpoints. Implemented as a sliding-window counter in Fastify with an in-process map (Node clustering not needed at v1 scale).
2. **Per-endpoint bucket.** Sampler `/api/v1/sampler` limited to 60/minute per IP; exports to 5/minute.

On rate-limit exhaustion, respond with `429 Too Many Requests`, an `X-RateLimit-Reset` header, and the `RATE_LIMITED` error code.

### 5.8 Caching layers

Three layers, ordered from cheapest to most expensive to miss.

1. **HTTP caching (Caddy + browser).** Public GET responses set `Cache-Control` with values chosen per endpoint:
   - `/api/v1/meta`: 5 minutes.
   - `/api/v1/states`, `/api/v1/topics`, and other snapshot-stable aggregates: 1 hour with `stale-while-revalidate=3600`.
   - Legislator profiles: 30 minutes.
   - Search: 5 minutes.
   - Sampler: no cache (seed-varying).
2. **In-process query cache (Node).** A small LRU (via `lru-cache`) keyed by `snapshotId + endpoint + normalizedFilterHash`. 500 MB soft cap. Cleared on snapshot rotation.
3. **PostgreSQL query planner and buffer cache.** Trust it; tune it (`shared_buffers`, `effective_cache_size`).

We are deliberately not running Redis/Valkey in v1. Add it when the in-process cache proves insufficient — the eviction is the signal, and the migration is straightforward.

### 5.9 Exports

Two paths:

- **CSV.** Streaming. The handler opens a cursor on the PG query, writes CSV rows as they arrive. Include a header comment block with the snapshot ID, filters, and generation date. Files typically 10 KB to 5 MB.
- **PNG.** Renders the current chart as SVG server-side, then rasterizes with `sharp` or `resvg`. For whole-page comparisons, spawn a headless Playwright browser against a `/export-preview/{token}` route that renders without interactive chrome, then screenshot.

Both endpoints return files with `Content-Disposition: attachment; filename="civicwatch_{chart}_{snapshot}_{yyyymmdd}.csv"`.

The permalink endpoint (`POST /api/v1/exports/permalink`) is a normalization pass: given a URL, return the canonical form (filters sorted alphabetically, deprecated parameters dropped). This lets shared links reproduce consistently even if the URL parameters were originally in a different order.

---

## 6. Frontend architecture

### 6.1 Runtime and framework

**SvelteKit 2 with Svelte 5 (runes).** The design doc's decision holds. Svelte's compiler emits minimal code, and Svelte 5's runes give clean fine-grained reactivity without a virtual DOM. For a viz-heavy application where individual DOM/Canvas ownership matters, this is the right choice.

Configuration:

- SvelteKit 2 with the Node adapter (`@sveltejs/adapter-node`).
- Svelte 5 with runes enabled.
- TypeScript strict.
- Vite as bundler (comes with SvelteKit).
- pnpm workspaces.

### 6.2 Routing and layouts

SvelteKit file-based routing, organized to match the design doc's screen inventory.

```
src/routes/
├── +layout.svelte           # persistent chrome (top bar, footer)
├── +layout.server.ts        # loads /meta once per session
├── +page.svelte             # landing
├── +page.server.ts          # loads chamber + coverage data
├── who/
│   ├── +page.svelte         # browse/search
│   ├── +page.server.ts
│   └── [lid]/
│       ├── +page.svelte     # legislator profile
│       └── +page.server.ts
├── place/
│   ├── +page.svelte         # place explorer
│   ├── +page.server.ts
│   └── [state]/
│       ├── +page.svelte
│       └── +page.server.ts
├── topic/
│   ├── +page.svelte
│   ├── +page.server.ts
│   └── [topicId]/
│       ├── +page.svelte
│       └── +page.server.ts
├── moment/
│   ├── +page.svelte
│   └── +page.server.ts
├── compare/
│   ├── +page.svelte
│   └── +page.server.ts
├── methods/
│   └── +page.svelte
├── about/
│   └── +page.svelte
├── export-preview/
│   └── [token]/
│       └── +page.svelte     # server-side render target for PNG exports
└── api/                     # optional server routes that proxy the API
    └── ...
```

- Layouts render the top bar (search, help, analyst-mode indicator) and footer.
- `+page.server.ts` files fetch initial data on the server. Client-side data (updates from filter changes) uses the same `fetch` against the backend API.
- Progressive enhancement: server-rendered HTML works without JS for the landing, legislator profiles, states, and topics. Interactive controls (filter chips, brushes, comparison) require JS.

### 6.3 State model

Four categories of state, kept separate.

- **URL state** — filters, selected snapshot, comparison slots, sort order. Read via `$page.url.searchParams`. Written via `goto()` with `keepFocus: true` and `noScroll: true`.
- **Remote state** — API responses. Fetched in `+page.server.ts` for SSR; refetched in `+page.svelte` via `invalidate()` when URL state changes. No TanStack Query — SvelteKit's `load` + `invalidate` is enough at this scale.
- **Session state** — analyst-mode toggle, recent searches, current comparison slots (kept in URL too, but session-cached for reopening). Stored in `sessionStorage`.
- **Persistent local state** — saved views, sampler preferences. Stored in `localStorage` behind a small typed wrapper.
- **Ephemeral component state** — hover, brush drag, popover open, tooltip position. Local runes.

Global stores (`$state` in module scope) are reserved for: current snapshot metadata, current analyst-mode flag, and the saved-views collection. Nothing else.

### 6.4 Data loading

`+page.server.ts` example for the topic drilldown:

```ts
// src/routes/topic/[topicId]/+page.server.ts
import type { PageServerLoad } from './$types'
import { api } from '$lib/api/server'

export const load: PageServerLoad = async ({
  params,
  url,
  fetch,
  depends
}) => {
  depends(`app:topic:${params.topicId}`)

  const from = url.searchParams.get('from') ?? undefined
  const to = url.searchParams.get('to') ?? undefined

  const [header, ribbon, salience, matrix, adjacent, topPosts] =
    await Promise.all([
      api(fetch).get(`/topics/${params.topicId}`),
      api(fetch).get(`/topics/${params.topicId}/ribbon`, { from, to }),
      api(fetch).get(`/topics/${params.topicId}/state-salience`),
      api(fetch).get(`/topics/${params.topicId}/party-chamber`),
      api(fetch).get(`/topics/${params.topicId}/adjacent`),
      api(fetch).get(`/topics/${params.topicId}/top-posts`, { limit: 10 }),
    ])

  return { header, ribbon, salience, matrix, adjacent, topPosts }
}
```

Six requests in parallel, all with narrow, bounded payloads. Total data transfer well under 250 KB for a fresh page load.

### 6.5 Design tokens

Tokens ship as a single package (`packages/tokens`) that emits three artifacts:

1. **CSS variables** — used by web CSS and print stylesheet.
2. **TypeScript constants** — used by Canvas rendering and SVG generators.
3. **JSON** — used by the pipeline's SVG export.

Source of truth is a single TypeScript file:

```ts
// packages/tokens/src/index.ts
export const color = {
  ink: '#1a1917',
  paper: '#f5f1e7',
  card: '#ffffff',
  rule: '#d9d2c1',
  mute: '#6b6659',
  muteSoft: '#9c9787',
  ballotBlue: '#274b6e',
  ballotRed: '#a13530',
  independent: '#7a6a4a',
  seal: '#8a5a1a',
  signal: '#3a6c4c',
  warn: '#a86a1f',
  error: '#8a2a20',
} as const

export const space = {
  '1': '4px', '2': '8px', '3': '12px', '4': '16px',
  '6': '24px', '8': '32px', '12': '48px', '16': '64px', '24': '96px',
} as const

export const radius = {
  chip: '4px', card: '6px', panel: '10px', none: '0',
} as const

export const type = {
  display: `'Fraunces', 'GT Alpina Wide', ui-sans-serif, system-ui, sans-serif`,
  body: `'Instrument Sans', 'Untitled Sans', ui-sans-serif, system-ui, sans-serif`,
  mono: `'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace`,
} as const
```

A tiny build script generates:

```css
/* packages/tokens/dist/tokens.css */
:root {
  --color-ink: #1a1917;
  --color-paper: #f5f1e7;
  /* ... */
}
```

### 6.6 Typography and fonts

Fonts are self-hosted (no CDN dependency, no Google Fonts request). Three faces:

- **Display**: Fraunces (SIL OFL). Warm, editorial, quirky. Fallback: system serif.
- **Body**: Instrument Sans (SIL OFL). Humanist, character. Fallback: system sans.
- **Mono**: JetBrains Mono (SIL OFL). Excellent tabular numerics. Fallback: `ui-monospace`.

Subsetting: use `glyphhanger` or `fonttools` to produce WOFF2 files with only the glyphs needed for the covered content (Latin + numerics + punctuation). Two subsets per family:

- `latin-basic.woff2` — for the landing and top-of-fold content, preloaded.
- `latin-extended.woff2` — for methods/about/post text, loaded on-demand.

`font-display: swap`. FOUT is acceptable and honest.

### 6.7 CSS architecture

- Vanilla CSS with CSS custom properties.
- CSS layers for cascade discipline.
- Component-scoped styles via Svelte's `<style>` block.
- No Tailwind. The design vocabulary is specific enough (Roll Call) that utility classes fight the aesthetic more than they help.
- No CSS-in-JS.

Layer order in `app.css`:

```css
@layer reset, tokens, base, layout, components, utilities, overrides;

@layer reset {
  /* Andy Bell's reset, adapted */
}

@layer tokens {
  @import 'tokens.css';
}

@layer base {
  html {
    font-family: var(--type-body);
    color: var(--color-ink);
    background: var(--color-paper);
    line-height: 1.5;
  }
  /* type scale, base link styles, etc. */
}

@layer layout {
  .container-page { max-width: 1360px; margin-inline: auto; padding-inline: var(--space-6); }
  .container-text { max-width: 720px; margin-inline: auto; padding-inline: var(--space-4); }
  /* etc. */
}

@layer utilities {
  .visually-hidden { /* ... */ }
  .tabular { font-variant-numeric: tabular-nums; }
}
```

Container queries for chart responsiveness. Media queries only for breakpoint-level layout shifts.

### 6.8 Component primitives

Accessible primitives from **Melt UI** (Svelte 5 native, headless). Wrap them in CivicWatch-styled variants that live in `packages/ui`.

Components we need:

- Dialog / modal
- Popover
- Tooltip
- Combobox (search modal)
- Tabs
- Toggle group (party filter, sort switcher)
- Select (dropdown filters)
- Slider (date range)
- Toast

Everything else (cards, buttons, chips, charts) is a straightforward Svelte component with no primitive dependency.

### 6.9 Progressive enhancement

The landing, legislator profiles, state pages, and topic pages must render meaningful HTML without JavaScript. This gives:

- Google-crawlable content for a public research tool.
- Graceful degradation on old devices or restricted network profiles.
- Faster perceived load (the HTML is there before the JS parses).

Interactive features that require JS: filters, brushes, comparison, sampler shuffle, canvas visualizations, export flows. The Chamber View renders as an accessible table when JS is unavailable.

### 6.10 SEO and metadata

For a citizen-facing public tool this matters.

Every page includes:

- `<title>` — specific and descriptive. `"Ken King (R-TX) — CivicWatch"`, not `"CivicWatch"`.
- `<meta name="description">` — one specific sentence with numbers.
- OpenGraph tags — `og:title`, `og:description`, `og:image`, `og:type`.
- Twitter card tags — same content, `twitter:card="summary_large_image"`.
- Structured data (JSON-LD) where meaningful — `Person` for legislator profiles with links to the underlying Ballotpedia URL if present.
- Canonical URL.
- Snapshot ID as a `<meta name="civicwatch:snapshot">` for reference.

OG image generation: a server-side route (`/og/legislator/{lid}.png`) that renders a 1200×630 image with the legislator's name, party, state, headline stats, and a tiny voice-fingerprint sparkline. Cached hard.

`robots.txt`: allow crawling of all public routes except `/export-preview/*`. Sitemap generated per snapshot, listing every legislator profile, every state page, every topic page.

---

## 7. Visualization engine

### 7.1 Rendering strategy

Three-tier rendering, chosen per visualization not per application:

| Tier | When |
|---|---|
| HTML/CSS | Cards, tables, chips, tooltips, legends, controls |
| SVG | Charts with ≤500 marks or per-mark interactivity (small multiples, sparklines, choropleth, topic ribbon, voice fingerprint bars) |
| Canvas 2D | Charts with 500–10,000 marks and dense hit-testing (Chamber View, Engagement Scatter, dense Beeswarm variants) |

WebGL/GPU rendering is deferred — no v1 visualization needs it.

### 7.2 Chart component contract

Every chart implements this contract:

```ts
// packages/viz/src/contract.ts
export interface ChartComponent<TData, TFilters = {}> {
  // Data as returned from the API
  data: TData

  // Current filters (for caption metadata, export)
  filters?: TFilters

  // Design-doc-derived rendering config
  config?: ChartConfig

  // Emits
  onSelect?: (id: string) => void
  onHover?: (id: string | null) => void

  // Introspection for accessibility + export
  summary: () => string             // plain-language paragraph
  tableRows: () => TableRow[]       // rows for accessible fallback
  exportSpec: () => ExportSpec      // for CSV/PNG generation
}
```

Every chart uses the same internal decomposition:

```
<div class="chart">
  <h3>{title}</h3>
  <p class="caption">{caption}</p>
  {#if rendererMode === 'svg'}
    <svg>{... marks ...}</svg>
  {:else}
    <canvas></canvas>
  {/if}
  <details class="chart-table">
    <summary>View as table</summary>
    <table>{... tableRows ...}</table>
  </details>
</div>
```

The table `<details>` element is always present. It's collapsed by default but keyboard-accessible and screen-reader-visible. This is not a nice-to-have; it's the accessibility floor.

### 7.3 Accessibility fallback

Every visualization renders three parallel outputs from the same normalized data:

1. **The interactive chart** (SVG or Canvas).
2. **A plain-language summary** — an ARIA-linked paragraph describing the chart's shape and headline numbers. Generated from data, not hardcoded. Example: *"Topic ribbon showing 22 categories across 5 years. Government Operations dominates every year at 12–18% share. Health peaked at 9% in April 2020 and again at 7% in June 2022. Uncategorized posts (grey band at bottom) average 39%."*
3. **A tabular view** — the underlying data as an accessible `<table>`, wrapped in `<details>` so it's collapsed by default but always reachable.

For dense charts (Chamber View, Engagement Scatter), keyboard navigation uses a single focus proxy: the chart takes focus, arrow keys change the "active" mark, and the active mark's details are read via an `aria-live` region. Do not create 5,927 hidden focusable elements.

### 7.4 Web workers

Workers only where they earn their place. Specific tasks:

- **Chamber View layout.** Compute deterministic positions for 5,927 dots once, cache in a message. Rearrangements from filters are done off-main-thread.
- **Beeswarm collision resolution.** For the corrected legislator-weighted variant, packing dots without overlap is fine off-thread.

Not workers:

- Sparklines. Tiny math, main thread is fine.
- Voice fingerprint bars. Tiny math.
- Topic ribbon. Precomputed by the API.
- Choropleth. TopoJSON + D3 projection is fast.

Worker communication via structured cloning, not string-serialization. Cancel in-flight worker tasks when filters change; use `AbortController` if the worker supports it, or a message-versioning scheme otherwise.

### 7.5 Export path

Every chart's `exportSpec()` produces:

```ts
type ExportSpec = {
  chart: string                     // 'topic-ribbon', 'chamber', ...
  filters: Record<string, unknown>
  data: unknown                     // the actual data used
  dimensions: { width: number, height: number }
  caption: {
    title: string
    filters: string
    source: string
    snapshotId: string
    generatedAt: string
  }
}
```

The API's `/exports/png` endpoint receives this spec, replays the same SVG rendering server-side (via a shared renderer package), rasterizes with `sharp` or `resvg`, and returns the PNG. Because rendering happens server-side using the same code, exports are reproducible from a permalink.

For canvas charts, the export path also has a server-side SVG variant that renders the same data as vectors — smaller file, sharper output at any resolution.

---

## 8. Per-visualization implementation

### 8.1 Chamber View

**Renderer.** Canvas 2D for dots; SVG overlay for axis labels, annotations, and hover ring. HTML for the tooltip and side panel.

**Data.** `GET /chamber?filter=` returns:

```json
{
  "data": {
    "positioned": [
      {"lid":"444464812","x":0.68,"party":"Republican","postCount":2341},
      ...
    ],
    "unpositioned": [
      {"lid":"...","party":"Democratic","postCount":34},
      ...
    ]
  },
  "meta": { ... }
}
```

Positions (`x` in [−1, 1]) are precomputed at snapshot build; the API returns them denormalized. `y` is computed client-side from `postCount` (higher post-count legislators sit closer to the front row).

**Rendering.**

```ts
// In a worker
function renderChamber(data: ChamberData, ctx: OffscreenCanvasRenderingContext2D) {
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  const cx = w / 2
  const cy = h * 0.85
  const rInner = h * 0.3
  const rOuter = h * 0.75

  for (const d of data.positioned) {
    const theta = mapXToTheta(d.x)          // [−1,1] → [PI, 2*PI] (top hemicycle)
    const r = mapPostCountToRadius(d.postCount, rInner, rOuter)
    const px = cx + r * Math.cos(theta)
    const py = cy + r * Math.sin(theta)
    ctx.fillStyle = partyColor(d.party)
    ctx.beginPath()
    ctx.arc(px, py, DOT_RADIUS, 0, 2 * Math.PI)
    ctx.fill()
  }
  // Unpositioned drawn as a small horizontal row above the arc.
}
```

**Interaction.** A quadtree built from positions; hover uses `quadtree.find(x, y, DOT_RADIUS * 2)` to locate the nearest dot. Tooltip is HTML, updated at most once per animation frame (`requestAnimationFrame`).

**Roll Call reveal.** On filter change, dots animate to new positions with a stagger of ~1–2 ms per dot. Total animation duration ~600 ms, capped by `count * 1.5ms + 400ms` to avoid interminable stagger with 5,927 dots.

**Accessibility.** A `<details>` with the full legislator table (name, party, state, chamber, ideology, post count) is always rendered adjacent to the canvas. Focus falls to the chart element; arrow keys move an "active dot" ring through position-sorted order; the active dot's details go to a live region.

### 8.2 Topic Ribbon

**Renderer.** SVG paths. 22 bands + optional Uncategorized band. Even at daily granularity for 5 years (~1,300 points × 22 bands), this is well under the SVG mark budget.

**Data.** `GET /topic-ribbon?groupBy=day` returns a matrix:

```json
{
  "data": {
    "dates": ["2020-01-01","2020-01-02", ...],
    "series": [
      { "topicId": 0, "topicLabel": "Government Operations",
        "shares": [0.12, 0.14, 0.13, ...] },
      ...
    ]
  },
  "meta": { ... }
}
```

Total payload for 5 years daily: ~28,600 numbers × 8 bytes JSON overhead ≈ 400 KB uncompressed, ~80 KB gzipped. If we need it smaller, group by week (~200 KB uncompressed, ~40 KB gzipped) with no visible loss to the viewer.

**Rendering.** D3's `d3.stack()` for stacked areas, `d3.area()` for the path generator. Stable band order (defined in `packages/tokens/src/topics.ts`) prevents distracting wiggle.

**Interaction.** Hover to highlight one band (others dim). Click to solo. Time cursor snaps to daily granularity. Event annotations (§8 of design doc) appear as vertical ticks with labels on hover.

### 8.3 US Choropleth

**Renderer.** SVG with `d3-geo` (Albers USA projection) and TopoJSON boundaries.

**Data.** `GET /states?metric=post_volume` returns 50 state values plus their metadata. Add topology as a static asset (`us-albers-10m.json`, ~50 KB) served once and cached hard.

**Missing data.** States with truly zero coverage get a diagonal-hatch fill. In practice all 50 states have coverage; this handles the case if a future snapshot has gaps.

**Interaction.** Hover shows a small floating card near the state. Click navigates to `/place/{state}`.

### 8.4 50-state small multiples

**Renderer.** CSS Grid for the layout; one small SVG per cell for the stacked bar.

50 cells × 22 segments = 1,100 SVG rects total. Trivial for the browser.

**Data.** Same `mv_state_topic_summary` aggregate, returned in a state-major shape.

### 8.5 Voice fingerprint

**Renderer.** SVG horizontal bars. 22 rows. Trivially small.

**Data.** `GET /legislators/{lid}/voice-fingerprint` returns 22 rows (one per topic) with `selfShare`, `partyMedianShare`, `deviation`.

**Rendering.** Bar length maps to `deviation`. Bars extending past the party-median tick line render in the legislator's party color; bars falling short render in `mute`. Sort by absolute deviation descending.

**Radial variant.** For compact profile-header display, a radial version using `d3-arc`. Same data, different shape. Documented in the code as decorative — the horizontal variant is canonical.

### 8.6 Beeswarm on ideology (corrected)

The important correction: **one dot per legislator, sized by their post volume on the topic, not one dot per post.** The design doc's original wording was ambiguous; this is the right implementation.

**Data.** `GET /topics/{topicId}/beeswarm` returns:

```json
{
  "data": [
    { "lid": "...", "ideology": -0.34, "party": "Democratic",
      "postsOnTopic": 187, "totalPosts": 2412 },
    ...
  ],
  "meta": { ... }
}
```

Only legislators with an ideology position appear on the axis. Legislators without an ideology score appear in a separate small strip labeled "not scored."

**Rendering.** Compute non-overlapping positions using `d3-force` with `forceX(x(ideology))` and `forceCollide(radius)`, radius derived from `postsOnTopic`. Canvas 2D for 3,000+ dots; SVG for smaller filtered subsets.

**Density backdrop.** Optional silhouette rendered behind the dots via kernel density estimate (`d3-array` histogram is fine at this scale).

### 8.7 Engagement scatter

**Renderer.** Canvas 2D for dots (up to ~3,600 legislators with data), SVG for axes and quadrant labels.

**Axes.** Post count on x (log scale — engagement distributions are heavy-tailed), median engagement per post on y (log scale for the same reason).

**Reference lines.** Median post count and median engagement rendered as light `rule`-colored lines, creating four labeled quadrants.

**Hit testing.** Quadtree.

### 8.8 Sparklines

**Renderer.** Pure SVG path, generated by a shared function.

```ts
// packages/viz/src/sparkline.ts
export function sparklinePath(
  values: number[],
  width: number,
  height: number,
  padding = 2
): string {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = (width - 2 * padding) / (values.length - 1)
  return values.map((v, i) => {
    const x = padding + i * step
    const y = height - padding - ((v - min) / range) * (height - 2 * padding)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}
```

No axes, no per-point circles, no chart framework instance. One SVG path element per sparkline. Tens of thousands of these on a page would still render fast.

### 8.9 Sampler

**Renderer.** Semantic HTML and CSS. No canvas, no SVG.

Cards are `<article>` elements. In stream mode, use CSS `transform: translate3d()` for horizontal movement (never `left`, which triggers layout). Bounded number of DOM nodes (12 max in stream mode; recycle on drift-off).

Fetch: `GET /sampler?seed=X&n=4&filters=...`. On shuffle, seed is a fresh random number. In stream mode, poll for a new batch every ~30 seconds and stitch it into the drifting sequence.

---

## 9. Data pipeline

### 9.1 Sources

The pipeline ingests from:

- **Existing PostgreSQL corpus** (the current database described in the field catalog).
- **Legislator metadata joins** (Ballotpedia URLs, voting-record joins) — external CSV or database inputs.
- **Event annotations** — a single hand-curated YAML file in the repo (see `pipelines/data/events.yaml`).

### 9.2 Language and libraries

- Python 3.12+ with `uv` for dependency management.
- **Polars** for main transformations.
- **DuckDB** for cross-source joins and quick analytical passes.
- **PyArrow** for Parquet I/O.
- **Pandera** for schema validation.
- **psycopg** (v3) for PostgreSQL loading.
- **pytest** for pipeline tests.
- No dbt in v1. The transformation graph is small (a dozen stages); a Makefile or `invoke` recipe is enough.

### 9.3 Stages

```
extract        →  Pull raw posts, legislators, topics from source PG. Checksum inputs.
normalize      →  Standardize column names, types. Coerce dates. Drop truly empty rows.
enrich         →  Join legislator metadata. Compute engagement_primary = likes + retweets.
                  Compute sample_uniform_h and sample_weighted_h.
validate       →  Pandera schemas + custom checks (see §9.4).
write_parquet  →  Emit versioned Parquet under snapshots/{snapshot_id}/.
load_staging   →  Bulk-load Parquet into staging tables in PG.
build_aggs     →  Recompute every materialized view / aggregate table.
verify_aggs    →  Reconcile aggregate totals against fact totals.
activate       →  Update the snapshots table atomically.
notify         →  Invalidate app-level cache; log the activation.
```

Each stage is a single Python module in `pipelines/data/stages/`.

### 9.4 Validation gates

The pipeline refuses to activate a snapshot if any of these fails:

- Row counts within ±10% of prior snapshot (unless flagged as intentional growth).
- Unique post IDs within the snapshot.
- All topic IDs valid.
- All dates within `[2020-01-01, snapshot_cutoff]`.
- All engagement values non-negative.
- Party values in `{Democratic, Republican, Independent, null}`.
- Chamber values in `{H, S, null}`.
- State codes in the 50-state set or null.
- Coverage stats within expected ranges (party population 60±5%, etc.).
- Every aggregate total reconciles to a corresponding fact total (topic post counts sum to overall, etc.).
- Sampler returns valid results for at least three test filter combinations.
- Every event in `events.yaml` falls within the snapshot date range.

Failures produce a validation report as HTML in `snapshots/{snapshot_id}/validation/validation-report.html` and an exit code that the CI or activation script treats as a hard stop.

### 9.5 Snapshot activation

Activation is a CLI command:

```bash
uv run python -m civicwatch_pipeline activate cw_2026_07_01_001
```

Which runs the two-statement transaction in §4.8. After success, it makes an HTTP `POST /internal/reload-snapshot` call to each API instance to invalidate in-process caches. The endpoint requires a shared secret (from an env var) and is not exposed publicly.

### 9.6 Rollback

Rolling back is symmetrical:

```bash
uv run python -m civicwatch_pipeline rollback cw_2026_06_01_001
```

Which flips the current active snapshot to `retired` and the specified snapshot back to `active`. Because we keep three snapshots online, rollback is a single transaction with no data movement.

If a snapshot needs to be dropped entirely (data quality issue discovered post-activation), a separate command removes its rows from `posts_v2` after retirement.

---

## 10. Search implementation

Detailed in §4.6. Frontend query pattern:

```ts
// Debounced (150 ms) on input change; canceled on subsequent keypress.
const results = await api.get('/search', { q })
```

Response shape:

```json
{
  "data": {
    "legislators": [
      { "lid":"...","name":"Ken King","handle":"KingForTexas",
        "state":"TX","party":"Republican","totalPosts":2341,
        "score":0.72 },
      ...
    ],
    "states": [
      { "code":"TX","name":"Texas","score":1.0 }
    ],
    "topics": [
      { "id":3,"label":"Health","score":0.9 }
    ]
  },
  "meta": { ... }
}
```

The frontend groups results in the search modal by section. Keyboard nav uses arrow keys across the flattened list, wrapping section boundaries.

---

## 11. Exports implementation

### 11.1 CSV

Streaming implementation:

```ts
// apps/api/src/routes/exports.csv.ts
fastify.post('/api/v1/exports/csv', async (request, reply) => {
  const spec = ExportSpec.parse(request.body)
  const { sql, params } = buildSQLForSpec(spec)

  reply.type('text/csv; charset=utf-8')
  reply.header('Content-Disposition',
    `attachment; filename="${filenameFor(spec)}"`)

  // header comment
  reply.raw.write(`# CivicWatch export\n`)
  reply.raw.write(`# snapshot: ${activeSnapshotId()}\n`)
  reply.raw.write(`# chart: ${spec.chart}\n`)
  reply.raw.write(`# filters: ${JSON.stringify(spec.filters)}\n`)
  reply.raw.write(`# generated: ${new Date().toISOString()}\n`)

  // column headers
  reply.raw.write(csvHeader(spec) + '\n')

  // stream rows
  const cursor = sql.cursor()  // postgres.js cursor API
  for await (const rows of cursor) {
    for (const row of rows) reply.raw.write(csvRow(row) + '\n')
  }

  reply.raw.end()
})
```

No BOM by default (UTF-8 CSV works in Excel 2016+); optional BOM added via a `?bom=1` query flag for older tooling.

### 11.2 PNG

Two strategies:

**Individual chart (single visualization).** Server reconstructs the chart as SVG using a shared renderer package, then rasterizes:

```ts
import { renderChartToSVG } from '@civicwatch/viz-server'
import { Resvg } from '@resvg/resvg-js'

const svg = renderChartToSVG(spec)
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } })
  .render()
  .asPng()
```

`@resvg/resvg-js` is a pure-Rust SVG renderer with Node bindings — bundled as a WASM binary. FOSS-compatible.

**Whole-page comparison or complex layout.** Playwright against a headless Chromium hitting `/export-preview/{token}`:

```ts
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setViewportSize({ width: 1440, height: 900 })
await page.goto(`http://localhost:3000/export-preview/${token}`)
await page.waitForSelector('[data-export-ready="true"]')
const png = await page.screenshot({ fullPage: true })
```

Playwright is heavier (Chromium is ~100 MB); reserve it for cases the SVG path can't handle.

### 11.3 Permalinks

Permalinks are URLs. `POST /api/v1/exports/permalink` normalizes:

- Query parameters sorted alphabetically.
- Deprecated parameters dropped.
- Snapshot ID included (`?snap=cw_...`) when the caller requests reproducibility.
- Multi-value params in a stable form.

Returns the canonical URL as JSON. Frontend copies to clipboard via the async clipboard API.

---

## 12. URL contract

The URL is the durable state. Every shareable filter, selection, and mode belongs in the URL.

### 12.1 Query parameter conventions

- `from`, `to` — ISO dates (YYYY-MM-DD).
- `party` — repeatable: `?party=D&party=R`.
- `state` — repeatable, two-letter codes.
- `topic` — repeatable, numeric IDs.
- `chamber` — `H` or `S`.
- `political` — `true` / `false` / (unset = both).
- `sort` — enumerated per endpoint.
- `snap` — snapshot ID (usually omitted; defaults to active).
- `compare` — repeatable slot identifiers for the compare page.
- `no-uncategorized` — boolean.

### 12.2 Route URLs

- `/` — landing.
- `/who?party=&chamber=&state=&sort=` — legislator browse.
- `/who/{lid}` — profile.
- `/place?metric=` — place explorer.
- `/place/{state}` — state drilldown.
- `/topic?groupBy=` — topic explorer.
- `/topic/{topicId}` — topic drilldown.
- `/moment?date=&width=&categories=` — moment explorer.
- `/compare?slot=&slot=&slot=` — compare page.
- `/methods`, `/about` — static pages.

### 12.3 URL parsing

A single `parseFilters(url)` helper on both server and client, using the Zod schema from `packages/schemas/src/url.ts`. Invalid values are silently corrected (e.g., unknown state codes dropped) with a non-blocking notice appended to a shared warnings list; no filters ever throw a whole-page error.

---

## 13. Testing strategy

### 13.1 Unit tests

Frontend (Vitest):

- Sparkline path generator.
- URL parse/serialize round-trips.
- Filter chip label formatting.
- Coverage calculation helpers.
- Sampler seed handling.

Backend (Vitest):

- Zod schemas (positive and negative cases).
- Query builders for filter combinations.
- SQL parameterization safety (no interpolation into raw strings).
- Cache key normalization.

Pipeline (pytest):

- Each stage's pure transformation function.
- Sample hash determinism.
- Validation gate correctness.

### 13.2 Integration tests

Backend against real PostgreSQL container (Testcontainers or a compose service in CI):

- Every endpoint's happy path against a small seeded snapshot.
- Snapshot activation / rollback.
- Cursor pagination correctness across page boundaries.
- CSV export stream integrity.

Estimated count: ~40 tests, running in under 60 seconds against a fresh PG container.

### 13.3 Visual regression

Playwright screenshot comparison against fixed reference images for each chart type, at fixed viewport sizes, with fonts loaded, animations disabled, and a deterministic snapshot.

Fixtures include:

- Empty data.
- Missing party.
- Missing ideology.
- Extreme engagement outliers.
- Long post text.
- Mobile widths (375 × 667).
- Tablet (768 × 1024).
- Desktop (1440 × 900).
- Reduced motion.
- Print stylesheet.

Reference images live in the repo and are updated via a `pnpm test:visual --update` command with human review.

### 13.4 Accessibility tests

- axe-core on every route during CI (via Playwright).
- Full keyboard traversal test for each explorer, asserting focus visibility and no traps.
- Screen-reader table presence assertion.
- `prefers-reduced-motion` snapshot tests.
- High-contrast forced-color-mode snapshot tests.

### 13.5 Load tests

k6 scripts for:

- Landing route under cold cache (target: p95 < 800 ms).
- Landing route under warm cache (target: p95 < 200 ms).
- Search burst (100 rps, target: p95 < 150 ms).
- Sampler shuffles (200 rps target: p95 < 300 ms).
- Filter changes on a busy explorer.
- CSV export under load.

Run monthly against a staging environment loaded with a production-sized snapshot.

### 13.6 Data quality tests

Pipeline-level assertions (run as part of validation gates in §9.4), plus a small standalone test suite for the query regression tests: canonical queries whose results should be stable across snapshots (unless snapshots change intentionally).

---

## 14. Observability

### 14.1 Logging

Structured JSON logs from both API and web. Fields:

```json
{
  "timestamp": "2026-07-01T14:22:00Z",
  "level": "info",
  "service": "civicwatch-api",
  "requestId": "01H...",
  "route": "/api/v1/topics/3/ribbon",
  "durationMs": 42,
  "statusCode": 200,
  "snapshotId": "cw_2026_07_01_001",
  "cacheHit": true,
  "userAgent": "...",
  "message": "request completed"
}
```

Ship logs with `promtail` to a Loki instance. Retention: 30 days.

Never log post text or personally identifiable request bodies. Log filters, log durations, log status codes, log correlation IDs. That's enough to debug.

### 14.2 Metrics

Prometheus scrape endpoints on both API (`/metrics`) and web (`/metrics`). Metrics:

- `civicwatch_http_requests_total{route, status, cache}` — counter.
- `civicwatch_http_duration_seconds{route}` — histogram.
- `civicwatch_query_duration_seconds{endpoint, source_table}` — histogram.
- `civicwatch_cache_hits_total{layer}` — counter.
- `civicwatch_cache_misses_total{layer}` — counter.
- `civicwatch_snapshot_active` — gauge with `snapshot_id` label.
- `civicwatch_export_duration_seconds{format}` — histogram.
- `civicwatch_exports_total{format, status}` — counter.
- `civicwatch_pg_connections{state}` — gauge.

Grafana dashboards for:

- Endpoint health (request rate, error rate, latency).
- Query performance by source table.
- Cache effectiveness.
- Snapshot health.
- Export queue depth.
- Frontend Web Vitals (received via a browser beacon endpoint).

### 14.3 Traces (optional in v1)

OpenTelemetry SDKs are wired but disabled unless a `OTEL_EXPORTER_OTLP_ENDPOINT` env var is set. This lets deployments opt into full tracing without paying the overhead by default. Tempo as the collector when enabled.

### 14.4 Frontend web vitals

Report Core Web Vitals (LCP, INP, CLS) to a `/api/v1/vitals` beacon endpoint on `visibilitychange`. Store in Prometheus via a small aggregator, or drop into Loki as structured events.

---

## 15. Security

### 15.1 Input safety

- All request parameters validated with Zod at the handler entry point.
- No SQL string interpolation. Ever. Enforced via a lint rule against `sql\`\${` patterns outside of `postgres.js` tagged templates.
- All allowlists (dimensions, sort keys, state codes) enforced against enum sets.

### 15.2 Output safety

- Post text rendered via textContent equivalents — never `innerHTML`.
- URLs in post text rendered as `<span class="muted">https://...</span>`, not `<a>`. External links can't be trusted to still exist.
- All exports validate input specs before rendering.

### 15.3 Headers

Caddy applies:

- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: interest-cohort=()`

### 15.4 Database posture

- API user has `SELECT` on the analytical tables and views only.
- Migrations run as a separate elevated user, invoked only by the deployment pipeline.
- PostgreSQL not exposed to the public network. Only Caddy and the API service can reach it.
- `pg_hba.conf` restricts connections to Unix socket for local services or TLS for remote administrative access.

### 15.5 Rate limiting and abuse

- Global per-IP limits enforced in Fastify.
- Aggressive limits on export endpoints (5/min per IP).
- Sampler endpoint limited to 60/min per IP.
- Behind Caddy's `rate_limit` module as a second-line defense.
- Automatic block on repeated `429`s within a rolling window (`fail2ban`-style).

### 15.6 Secrets

- `.env` file for local dev (not committed).
- Environment variables for prod (via systemd unit or Compose env).
- Never log secrets. Ever.
- Rotate the internal reload-secret quarterly.

---

## 16. Deployment

### 16.1 Target

A single VPS or on-prem VM to start. Baseline:

- 8 vCPU (Intel/AMD, with AVX2 for `resvg`)
- 32 GB RAM
- 500 GB NVMe SSD
- 1 Gbps network
- Debian stable or Ubuntu LTS

Estimated monthly cost from Hetzner or equivalent providers: ~$40–60 (with the exact bill depending on your provider — verify at time of purchase).

### 16.2 Topology

Five services on one host, via Docker Compose:

```yaml
# deploy/docker-compose.yml
services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports: ["80:80","443:443"]
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on: [web, api]

  web:
    image: civicwatch/web:${TAG}
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
      API_BASE_URL: http://api:4000
      PUBLIC_ORIGIN: https://civicwatch.example
    depends_on: [api]

  api:
    image: civicwatch/api:${TAG}
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 4000
      DATABASE_URL: ${DATABASE_URL}
      RELOAD_SECRET: ${RELOAD_SECRET}
    depends_on: [postgres]

  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: civicwatch
      POSTGRES_USER: civicwatch_admin
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./postgres/postgresql.conf:/etc/postgresql/postgresql.conf:ro
    command: ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]

  prometheus:
    image: prom/prometheus:latest
    restart: unless-stopped
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prom_data:/prometheus
    profiles: ["observability"]

  grafana:
    image: grafana/grafana-oss:latest
    restart: unless-stopped
    volumes:
      - grafana_data:/var/lib/grafana
    profiles: ["observability"]

volumes:
  caddy_data: {}
  caddy_config: {}
  pg_data: {}
  prom_data: {}
  grafana_data: {}
```

Observability services run under the `observability` profile so they can be enabled with `docker compose --profile observability up`.

### 16.3 Backups

Three separate backup streams:

- **PostgreSQL**: continuous WAL archiving to off-host object storage via `pgbackrest` or `wal-g`. Weekly full base backup, hourly incrementals. Retention: 30 days.
- **Parquet snapshots**: replicated to off-host object storage on activation.
- **Application configuration**: `caddy/`, `postgres/*.conf`, `prometheus/`, and `docker-compose.yml` in a private repo.

Restore drills: quarterly. Restore from most recent backup to a scratch VM, confirm application boots, confirm active snapshot resolves. Log the outcome; retention verified is the goal, not just backups completed.

### 16.4 Blue/green (optional)

For zero-downtime deploys, run two Compose stacks on different Docker networks and swap Caddy's upstream. Not needed in v1; the whole stack restart is ~15 seconds and can be scheduled for low-traffic windows.

### 16.5 Kubernetes threshold

Migrate to k3s or upstream Kubernetes if:

- Multiple application nodes become necessary (traffic outgrows one VPS).
- Independent scaling of API vs. web becomes valuable.
- The team already runs k8s and finds Compose burdensome.

None of these are v1 concerns.

---

## 17. Performance budgets and enforcement

Restated from the design doc with enforcement mechanisms.

| Budget | Target | Enforced by |
|---|---|---|
| Landing JS | ≤180 KB gzip | Vite bundle analyzer; fails CI if breached |
| Landing CSS | ≤45 KB gzip | Same |
| Cached API p95 | ≤200 ms | Prometheus alert |
| Uncached aggregate API p95 | ≤800 ms | Prometheus alert |
| Search p95 | ≤150 ms | Prometheus alert |
| Filter-to-render p95 | ≤1 s | Frontend RUM beacon |
| LCP on mid-tier mobile | ≤2.5 s | Web Vitals |
| CLS | ≈0 | Web Vitals |
| Hover response | ≤1 frame | Manual + Playwright timing test |
| Sustained animation | 60 fps desktop | Manual + `perf.measure` |
| Chart payload | ≤250 KB compressed | API response size logging |
| Interactive endpoint | ≤50,000 rows | Enforced in API code |

Any endpoint that would return more than 50,000 rows is either paginated, aggregated, or 400.

### Data-scale reduction order

When the payload gets too big, reduce in this order:

1. Pre-aggregate (server produces the aggregate).
2. Bin (server produces bins instead of raw values).
3. Top-N plus a "rest" bucket.
4. Density (server produces a density estimate).
5. Sample (deterministic, seed-based).
6. Raw records — only for explicit table views or exports.

Never solve a backend aggregation problem with a faster frontend renderer.

---

## 18. Accessibility contract

Restated with concrete acceptance criteria.

- **WCAG 2.2 AA** for every page.
- **Keyboard**: every interactive element reachable via Tab; every action available via keyboard; visible focus outlines using `--color-seal` at 2px.
- **Screen readers**: every chart has a `<h3>` title, a descriptive caption, an `aria-describedby` linking to a plain-language summary, and a fallback `<table>`.
- **Motion**: `prefers-reduced-motion` respected: Sampler stream mode disabled, Chamber View reveal replaced by instant placement, chart morphs replaced by crossfades, hover transitions instant.
- **Color contrast**: verified in the token table (§3.2 of design doc).
- **Non-color signaling**: party has letter labels at small sizes; engagement change has arrow glyphs; topic categories have distinct labels.

Acceptance: axe-core reports zero violations on every route; manual screen-reader review on VoiceOver + NVDA before each major release; keyboard-only tests recorded and archived.

---

## 19. Repository layout

Concrete monorepo structure:

```
civicwatch/
├── apps/
│   ├── web/                        # SvelteKit app
│   │   ├── src/
│   │   │   ├── routes/             # file-based routing
│   │   │   ├── lib/                # $lib imports
│   │   │   │   ├── api/            # API client
│   │   │   │   ├── charts/         # chart components
│   │   │   │   ├── components/     # UI components
│   │   │   │   ├── stores/         # global state
│   │   │   │   ├── utils/          # helpers
│   │   │   │   └── workers/        # web workers
│   │   │   └── app.html
│   │   ├── static/                 # fonts, favicon, us-states.json
│   │   ├── tests/                  # Playwright specs
│   │   ├── svelte.config.js
│   │   ├── vite.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── api/                        # Fastify API
│       ├── src/
│       │   ├── routes/             # one file per endpoint family
│       │   ├── db/                 # postgres.js instance, query modules
│       │   ├── cache/              # LRU cache module
│       │   ├── exports/            # export handlers
│       │   ├── middleware/         # rate limit, error handling
│       │   ├── openapi/            # OpenAPI generator
│       │   └── server.ts           # entry point
│       ├── tests/                  # Vitest specs
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── schemas/                    # Zod schemas (shared)
│   │   ├── src/
│   │   │   ├── legislators.ts
│   │   │   ├── topics.ts
│   │   │   ├── states.ts
│   │   │   ├── moments.ts
│   │   │   ├── search.ts
│   │   │   ├── sampler.ts
│   │   │   ├── exports.ts
│   │   │   └── url.ts              # URL query schema
│   │   └── package.json
│   │
│   ├── tokens/                     # design tokens
│   │   ├── src/index.ts            # TS constants
│   │   ├── dist/tokens.css         # generated
│   │   └── package.json
│   │
│   ├── viz/                        # chart primitives (D3 wrappers)
│   │   ├── src/
│   │   │   ├── sparkline.ts
│   │   │   ├── chamber.ts
│   │   │   ├── ribbon.ts
│   │   │   ├── choropleth.ts
│   │   │   ├── beeswarm.ts
│   │   │   ├── fingerprint.ts
│   │   │   ├── scatter.ts
│   │   │   └── shared/             # scales, colors, formats
│   │   └── package.json
│   │
│   ├── viz-server/                 # server-side SVG rendering for exports
│   │   ├── src/index.ts
│   │   └── package.json
│   │
│   └── ui/                         # accessible primitives + CivicWatch style
│       ├── src/
│       │   ├── Button.svelte
│       │   ├── Chip.svelte
│       │   ├── Dialog.svelte
│       │   ├── Combobox.svelte
│       │   └── Slider.svelte
│       └── package.json
│
├── pipelines/
│   └── data/                       # Python pipeline
│       ├── pyproject.toml          # uv-managed
│       ├── src/
│       │   └── civicwatch_pipeline/
│       │       ├── stages/
│       │       ├── validate/
│       │       └── cli.py
│       ├── events.yaml             # curated event annotations
│       └── tests/
│
├── database/
│   ├── migrations/                 # numbered SQL files
│   │   ├── 001_snapshots.sql
│   │   ├── 002_legislators_v2.sql
│   │   ├── 003_topics_v2.sql
│   │   ├── 004_events.sql
│   │   ├── 005_posts_v2.sql
│   │   ├── 006_indexes.sql
│   │   ├── 007_search.sql
│   │   └── 008_aggregates.sql
│   ├── seeds/                      # small test snapshots
│   └── postgresql.conf             # prod config
│
├── deploy/
│   ├── docker-compose.yml
│   ├── caddy/
│   │   └── Caddyfile
│   ├── prometheus/
│   │   └── prometheus.yml
│   ├── grafana/
│   │   └── dashboards/
│   └── scripts/
│       ├── backup.sh
│       └── restore.sh
│
├── docs/
│   ├── design/
│   │   └── civicwatch_design_doc.md
│   ├── technical/
│   │   └── civicwatch_technical_spec.md  # this document
│   ├── architecture/
│   │   └── decisions/              # ADRs
│   ├── api/
│   │   └── openapi.yaml            # generated
│   └── data-dictionary/
│       └── fields.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── visual-regression.yml
│       └── release.yml
│
├── pnpm-workspace.yaml
├── package.json                    # workspace root
├── tsconfig.base.json
├── .editorconfig
├── .gitignore
├── LICENSE                         # AGPL-3.0-or-later
├── LICENSE-docs                    # CC-BY-4.0
├── CONTRIBUTING.md
└── README.md
```

Three apps, six packages, one pipeline, one database, one deploy folder, docs. Concrete, not abstract.

---

## 20. Development workflow

### 20.1 Prerequisites

- Node.js 22+ (nvm or Volta)
- pnpm 9+
- Python 3.12+ with uv
- Docker Desktop or Podman
- PostgreSQL client tools (psql, pg_dump)

### 20.2 Bootstrap

```bash
# Clone
git clone https://github.com/YOUR_ORG/civicwatch.git
cd civicwatch

# Install JS deps
pnpm install

# Install Python deps
cd pipelines/data && uv sync && cd ../..

# Start dependencies
docker compose up -d postgres

# Wait for PG, then run migrations
pnpm db:migrate

# Load a small seed snapshot
pnpm db:seed

# Start web + api in dev
pnpm dev
```

Two commands after clone. Design doc's promise: a fresh contributor can be reading code on their machine in under 15 minutes.

### 20.3 Common commands

```bash
pnpm dev              # web + api in watch mode
pnpm build            # production build of both apps
pnpm test             # all vitest + pytest tests
pnpm test:e2e         # Playwright end-to-end
pnpm test:visual      # visual regression
pnpm test:a11y        # accessibility
pnpm lint             # ESLint + Prettier + Svelte check
pnpm typecheck        # tsc --noEmit everywhere

pnpm db:migrate       # apply pending migrations
pnpm db:rollback      # rollback last migration
pnpm db:seed          # load a small dev snapshot

pnpm pipeline:build cw_YYYY_MM_DD_001    # build a snapshot
pnpm pipeline:activate cw_YYYY_MM_DD_001 # activate it
```

### 20.4 CI

GitHub Actions with these jobs:

- `lint` — ESLint, Prettier, tsc, svelte-check.
- `test-web` — Vitest for the web app.
- `test-api` — Vitest for the API, against a PG service container.
- `test-pipeline` — pytest.
- `test-e2e` — Playwright against a built app + seed DB.
- `test-visual` — screenshot comparison.
- `test-a11y` — axe-core in Playwright.
- `bundle-size` — Vite bundle analyzer with budget assertions.
- `build-images` — Docker images for web and api, pushed to a registry on release tags.

Each PR runs the full test matrix. Merges to `main` also build container images tagged `main`.

### 20.5 Release

Releases are Git tags. A GitHub Actions workflow:

1. Runs the full test suite.
2. Builds container images tagged with the version.
3. Publishes an OpenAPI schema artifact.
4. Publishes an SBOM (via `syft` or equivalent).
5. Drafts release notes from conventional commits (if that's used) or manual.

Production deploy is a manual step: pull the images on the host, `docker compose up -d`, verify health.

---

## 21. Milestones (technical, keyed to design doc §17)

Restatement of the design doc milestones with technical acceptance criteria.

### Milestone 1: Foundation and Lookup

**Ship:** Landing (static), Legislator profile with Voice Fingerprint, browse/search, static Sampler.

**Technical criteria:**
- Repository structure per §19 in place; monorepo builds.
- Tokens package emits CSS variables consumed by web.
- Fonts self-hosted and preloading.
- Snapshot model + migrations 001–007 applied.
- One seed snapshot loaded from a small subset of real data.
- API endpoints: `/meta`, `/health`, `/search`, `/legislators`, `/legislators/{lid}`, `/legislators/{lid}/voice-fingerprint`, `/legislators/{lid}/posts`, `/sampler`.
- OpenAPI schema published.
- Web routes: `/`, `/who`, `/who/{lid}`, `/methods`, `/about`.
- Landing bundle ≤180 KB gzip.
- P95 search latency ≤150 ms against seed data.
- Playwright covers: landing loads, search returns results, profile renders, sampler shuffles.
- Full accessibility pass for the routes in scope.

### Milestone 2: Places

**Ship:** Place explorer with choropleth + small multiples; state drilldown.

**Technical criteria:**
- Migration 008 (aggregates) applied; `mv_state_summary`, `mv_state_topic_summary`, `mv_top_posts_state`, `mv_topic_state_daily` populated.
- API endpoints: `/states`, `/states/small-multiples`, `/states/{state}`, `/states/{state}/topics`, `/states/{state}/trend`, `/states/{state}/top-posts`.
- Web routes: `/place`, `/place/{state}`.
- TopoJSON asset for US states packaged.
- Contextual filter chip system in place.
- All 50 states render without a route-level chart framework dependency.
- P95 map render ≤800 ms.

### Milestone 3: Topics

**Ship:** Topic explorer with Topic Ribbon + topic tiles; topic drilldown with corrected beeswarm.

**Technical criteria:**
- All topic aggregates populated: `mv_topic_daily`, `mv_topic_party_summary`, `mv_topic_state_summary`, `mv_top_posts_topic`.
- API endpoints: `/topics`, `/topics/{id}`, `/topics/{id}/ribbon`, `/topics/{id}/state-salience`, `/topics/{id}/beeswarm`, `/topics/{id}/party-chamber`, `/topics/{id}/adjacent`, `/topics/{id}/top-posts`, `/topic-ribbon`.
- Web routes: `/topic`, `/topic/{topicId}`.
- Beeswarm renders one dot per legislator (not per post), size ∝ posts on topic.
- Topic Ribbon stable over the full 5-year range at 60 fps.

### Milestone 4: Moments

**Ship:** Moment explorer with scrubber, category filters, window control; curated events wired.

**Technical criteria:**
- `events.yaml` populated from design doc §8.
- `mv_event_window` populated.
- API endpoints: `/events`, `/moments/window`, `/moments/window/top-posts`.
- Web route: `/moment`.
- Scrubber previews locally at 60 fps; server queries only on settled position.
- Stale requests cancelled on scrub.

### Milestone 5: Analyst Mode

**Ship:** Global filter bar, Compare, exports (PNG + SVG + CSV), permalinks, saved views.

**Technical criteria:**
- Compare page supports up to 4 slots of mixed entity types.
- Exports: `/exports/csv`, `/exports/png`, `/exports/permalink`.
- Server-side chart rendering via `viz-server` package.
- Playwright-driven PNG path available for full-page exports.
- Saved views stored in localStorage with schema version.
- Rate limits enforced on export endpoints.

### Milestone 6: Polish and Integrity

**Ship:** Full a11y pass, Sampler stream mode, methods + about pages, print stylesheet, mobile optimizations.

**Technical criteria:**
- axe-core violations: zero on every route.
- Every chart has a linked accessible table.
- Sampler stream mode implemented with `prefers-reduced-motion` gating.
- Print stylesheet produces clean PDFs on every route.
- Mobile: landing loads under 2.5 s LCP on a mid-tier device on 4G.
- Full k6 load-test suite passing against target latencies.
- Observability dashboards live in Grafana.

---

## 22. Non-negotiable rules

Restated because these must survive any implementation decision:

1. The browser never receives the complete corpus.
2. Every chart has a named aggregate table or bounded query source.
3. URL state is permalink state.
4. Snapshot IDs are immutable.
5. Every analytical response carries `meta` with snapshot ID and coverage.
6. Missing data is never silently discarded.
7. SVG, Canvas, and (later) GPU rendering are selected per chart, not per app.
8. Every canvas chart has an accessible table representation.
9. No visualization framework dictates CivicWatch's visual style.
10. No route pays the bundle cost for visualizations it doesn't use.
11. No large `OFFSET` pagination. Cursors only.
12. No `ORDER BY rand()` sampling. Precomputed hashes only.
13. No arbitrary SQL from the client.
14. No proprietary font or hosted-service runtime dependency.
15. No Kubernetes until a documented operational reason exists.
16. No raw-post beeswarm; legislator-weighted only.
17. No client-side calculation that could be precomputed once per snapshot.
18. No export whose data cannot be reproduced from its permalink + snapshot.
19. Every release has a data manifest, code commit hash, and SBOM.
20. Performance, accessibility, and reproducibility are acceptance criteria, not polish.

---

## 23. Remaining technical questions

Smaller open questions, not blocking:

1. **`Cache-Control` values for legislator-profile endpoints.** 30 minutes is a guess. Instrument and tune.
2. **Sampling weight formula.** `log1p(likes + retweets)` is a reasonable prior; validate against user feedback that samples feel interesting rather than boring or extreme.
3. **Compare slot count.** 4 is a guess based on desktop layout; if analytics show most users only use 2 or 3, tighten.
4. **Server-side SVG renderer choice.** `resvg` (WASM) vs. spawning Playwright. Benchmark after M1.
5. **Legislator URL format.** `/who/{lid}` is canonical; do we also want `/who/{state}/{lastname}` as a friendly alias? Yes if it doesn't add much surface; defer decision.
6. **Frontend web vitals endpoint schema.** Fields chosen from Web Vitals RFC; verify against the Grafana dashboard.
7. **How long to keep retired snapshots online.** Suggested three; may need to be more or fewer depending on operational feedback and disk usage.

---

## Appendix A: Full DDL for core tables

```sql
-- ============================================================
-- 001_snapshots.sql
-- ============================================================
CREATE TABLE snapshots (
  snapshot_id       text        PRIMARY KEY,
  status            text        NOT NULL
    CHECK (status IN ('building','validated','active','retired')),
  source_cutoff     date        NOT NULL,
  built_at          timestamptz NOT NULL DEFAULT now(),
  activated_at      timestamptz,
  retired_at        timestamptz,
  row_counts        jsonb       NOT NULL,
  coverage          jsonb       NOT NULL,
  input_checksums   jsonb       NOT NULL,
  classifier_ver    text        NOT NULL,
  code_commit       text        NOT NULL,
  schema_version    text        NOT NULL,
  notes             text
);

CREATE UNIQUE INDEX one_active_snapshot
  ON snapshots (status)
  WHERE status = 'active';

-- ============================================================
-- 002_legislators_v2.sql
-- ============================================================
CREATE TABLE legislators_v2 (
  snapshot_id       text        NOT NULL REFERENCES snapshots(snapshot_id),
  lid               text        NOT NULL,
  name              text        NOT NULL,
  handle            text,
  state             char(2),
  chamber           char(1)     CHECK (chamber IS NULL OR chamber IN ('H','S')),
  party             text        CHECK (party IS NULL OR party IN
                                       ('Democratic','Republican','Independent')),
  firstname         text,
  lastname          text,
  gender            char(1)     CHECK (gender IS NULL OR gender IN ('M','F')),
  race              text,
  district_num      text,
  district_name     text,
  district_type     text,
  yr_elected        integer,
  yr_left_office    integer,
  bp_url            text,
  shor_ideo         double precision,
  mrp_ideology      double precision,
  mrp_ideology_se   double precision,
  demshare_pres     double precision,
  search_text       text        GENERATED ALWAYS AS (
                                  lower(unaccent(
                                    coalesce(name,'') || ' ' || coalesce(handle,'')
                                  ))
                                ) STORED,
  PRIMARY KEY (snapshot_id, lid)
);

CREATE INDEX legislators_v2_search_trgm_idx
  ON legislators_v2 USING gin (search_text gin_trgm_ops);

CREATE INDEX legislators_v2_state_party_idx
  ON legislators_v2 (snapshot_id, state, party);

-- ============================================================
-- 003_topics_v2.sql
-- ============================================================
CREATE TABLE topics_v2 (
  snapshot_id       text        NOT NULL REFERENCES snapshots(snapshot_id),
  topic_id          integer     NOT NULL,
  topic_label       text        NOT NULL,
  is_uncategorized  boolean     NOT NULL DEFAULT false,
  display_order     smallint    NOT NULL,
  PRIMARY KEY (snapshot_id, topic_id)
);

-- ============================================================
-- 004_events.sql
-- ============================================================
CREATE TABLE events (
  event_id          serial      PRIMARY KEY,
  name              text        NOT NULL,
  category          text        NOT NULL
    CHECK (category IN ('elections','federal_politics','scotus',
                        'mass_violence','legislation','crises',
                        'legislative_institution')),
  start_date        date        NOT NULL,
  end_date          date,
  context_note      text,
  active            boolean     NOT NULL DEFAULT true
);

CREATE INDEX events_date_idx ON events (start_date);

-- ============================================================
-- 005_posts_v2.sql
-- ============================================================
CREATE TABLE posts_v2 (
  snapshot_id           text        NOT NULL REFERENCES snapshots(snapshot_id),
  id                    bigint      NOT NULL,
  tweet_id              text,
  lid                   text        NOT NULL,
  created_at            timestamptz NOT NULL,
  created_date          date        NOT NULL,
  text                  text        NOT NULL,
  topic_id              integer     NOT NULL,
  topic_probability     real,
  state                 char(2),        -- denormalized
  party                 text,           -- denormalized
  chamber               char(1),        -- denormalized
  is_political          boolean,
  political_score       real,
  like_count            integer     NOT NULL DEFAULT 0,
  retweet_count         integer     NOT NULL DEFAULT 0,
  reply_count           integer     NOT NULL DEFAULT 0,
  quote_count           integer     NOT NULL DEFAULT 0,
  engagement_primary    integer     GENERATED ALWAYS AS
                                    (like_count + retweet_count) STORED,
  count_misinfo         smallint    NOT NULL DEFAULT 0,
  sample_uniform_h      bigint      NOT NULL,
  sample_weighted_h     bigint      NOT NULL,
  PRIMARY KEY (snapshot_id, id)
) PARTITION BY LIST (snapshot_id);

-- Create partitions per snapshot at load time:
-- CREATE TABLE posts_v2_cw_2026_07_01_001
--   PARTITION OF posts_v2 FOR VALUES IN ('cw_2026_07_01_001');

-- ============================================================
-- 006_indexes.sql
-- ============================================================
CREATE INDEX posts_v2_snapshot_topic_date_idx
  ON posts_v2 (snapshot_id, topic_id, created_date);

CREATE INDEX posts_v2_snapshot_state_date_idx
  ON posts_v2 (snapshot_id, state, created_date);

CREATE INDEX posts_v2_snapshot_lid_date_idx
  ON posts_v2 (snapshot_id, lid, created_date);

CREATE INDEX posts_v2_snapshot_lid_pagination_idx
  ON posts_v2 (snapshot_id, lid, created_date DESC, id DESC);

CREATE INDEX posts_v2_snapshot_sample_u_idx
  ON posts_v2 (snapshot_id, sample_uniform_h);

CREATE INDEX posts_v2_snapshot_sample_w_idx
  ON posts_v2 (snapshot_id, sample_weighted_h);

-- ============================================================
-- 007_search.sql
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================
-- 008_aggregates.sql
-- ============================================================
CREATE MATERIALIZED VIEW mv_topic_daily AS
SELECT
  p.snapshot_id,
  p.created_date AS date,
  p.topic_id,
  t.topic_label,
  count(*)                AS post_count,
  sum(p.like_count)       AS total_likes,
  sum(p.retweet_count)    AS total_retweets,
  sum(p.reply_count)      AS total_replies,
  sum(p.quote_count)      AS total_quotes,
  sum(p.engagement_primary) AS total_engagement
FROM posts_v2 p
JOIN topics_v2 t ON (t.snapshot_id, t.topic_id) = (p.snapshot_id, p.topic_id)
GROUP BY p.snapshot_id, p.created_date, p.topic_id, t.topic_label;

CREATE INDEX mv_topic_daily_snapshot_idx ON mv_topic_daily (snapshot_id, date, topic_id);

-- Similar MVs for the rest of §4.4. Omitted here for brevity; every one has
-- an INDEX on (snapshot_id, primary_dimension) and every one is refreshed
-- during snapshot activation via a single build script.

CREATE MATERIALIZED VIEW mv_legislator_summary AS
SELECT
  l.snapshot_id,
  l.lid,
  l.name,
  l.handle,
  l.state,
  l.chamber,
  l.party,
  count(p.id)                 AS total_posts,
  sum(p.like_count)           AS total_likes,
  sum(p.retweet_count)        AS total_retweets,
  sum(p.reply_count)          AS total_replies,
  sum(p.quote_count)          AS total_quotes,
  sum(p.engagement_primary)   AS total_engagement,
  min(p.created_date)         AS first_post_date,
  max(p.created_date)         AS last_post_date,
  count(*) FILTER (WHERE p.is_political) AS political_posts
FROM legislators_v2 l
LEFT JOIN posts_v2 p
  ON (p.snapshot_id, p.lid) = (l.snapshot_id, l.lid)
GROUP BY l.snapshot_id, l.lid, l.name, l.handle, l.state, l.chamber, l.party;

CREATE INDEX mv_legislator_summary_pk_idx
  ON mv_legislator_summary (snapshot_id, lid);

-- Refresh order (invoked by the pipeline during activation):
-- REFRESH MATERIALIZED VIEW mv_topic_daily;
-- REFRESH MATERIALIZED VIEW mv_topic_party_summary;
-- ...
```

## Appendix B: Example API endpoint

```ts
// apps/api/src/routes/legislators/voice-fingerprint.ts
import type { FastifyPluginAsync } from 'fastify'
import { VoiceFingerprintResponse } from '@civicwatch/schemas'
import { sql } from '../../db/index.js'
import { activeSnapshot } from '../../db/snapshot.js'
import { cached } from '../../cache/index.js'
import { queryHashOf } from '../../utils/hash.js'

const voiceFingerprint: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/v1/legislators/:lid/voice-fingerprint', {
    schema: {
      params: {
        type: 'object',
        properties: { lid: { type: 'string', minLength: 1, maxLength: 64 } },
        required: ['lid'],
      },
    },
    handler: async (request, reply) => {
      const { lid } = request.params as { lid: string }
      const snapshot = await activeSnapshot()

      const cacheKey = `${snapshot.id}:voice-fingerprint:${lid}`
      const result = await cached(cacheKey, 30 * 60_000, async () => {
        const [legislator] = await sql`
          SELECT lid, name, handle, state, chamber, party
          FROM legislators_v2
          WHERE snapshot_id = ${snapshot.id} AND lid = ${lid}
        `

        if (!legislator) return null

        const [{ total_posts, first_post_date, last_post_date }] = await sql`
          SELECT total_posts, first_post_date, last_post_date
          FROM mv_legislator_summary
          WHERE snapshot_id = ${snapshot.id} AND lid = ${lid}
        `

        const rows = await sql`
          WITH self AS (
            SELECT topic_id, count(*)::float / ${total_posts}::float AS share,
                   count(*) AS posts_in_topic
            FROM posts_v2
            WHERE snapshot_id = ${snapshot.id} AND lid = ${lid}
            GROUP BY topic_id
          ),
          party_medians AS (
            SELECT topic_id, percentile_disc(0.5) WITHIN GROUP (
              ORDER BY topic_share
            ) AS median_share
            FROM (
              SELECT p.topic_id, l.lid,
                     count(*)::float
                       / max(ls.total_posts)::float AS topic_share
              FROM posts_v2 p
              JOIN legislators_v2 l USING (snapshot_id, lid)
              JOIN mv_legislator_summary ls USING (snapshot_id, lid)
              WHERE p.snapshot_id = ${snapshot.id}
                AND l.party = ${legislator.party}
                AND ls.total_posts >= 50   -- avoid dividing by tiny denominators
              GROUP BY p.topic_id, l.lid, ls.total_posts
            ) x
            GROUP BY topic_id
          )
          SELECT t.topic_id,
                 t.topic_label,
                 coalesce(self.share, 0)                    AS self_share,
                 coalesce(party_medians.median_share, 0)    AS party_median_share,
                 coalesce(self.share, 0) -
                   coalesce(party_medians.median_share, 0)  AS deviation,
                 coalesce(self.posts_in_topic, 0)::int      AS posts_in_topic
          FROM topics_v2 t
          LEFT JOIN self ON self.topic_id = t.topic_id
          LEFT JOIN party_medians ON party_medians.topic_id = t.topic_id
          WHERE t.snapshot_id = ${snapshot.id}
          ORDER BY t.display_order
        `

        return { legislator, total_posts, first_post_date, last_post_date, rows }
      })

      if (result === null) {
        return reply.code(404).send({
          error: { code: 'NOT_FOUND',
                   message: 'Legislator not found in active snapshot.',
                   requestId: request.id },
          meta: { snapshotId: snapshot.id, generatedAt: new Date().toISOString() },
        })
      }

      const response: VoiceFingerprintResponse = {
        data: result.rows.map(r => ({
          topicId: r.topic_id,
          topicLabel: r.topic_label,
          selfShare: r.self_share,
          partyMedianShare: r.party_median_share,
          deviation: r.deviation,
          postsInTopic: r.posts_in_topic,
        })),
        meta: {
          snapshotId: snapshot.id,
          legislator: result.legislator,
          totalPosts: result.total_posts,
          coveragePeriod: [
            result.first_post_date.toISOString().slice(0, 10),
            result.last_post_date.toISOString().slice(0, 10),
          ],
          sourceTable: 'mv_legislator_topic',
          queryHash: queryHashOf({ endpoint: 'voice-fingerprint', lid }),
          generatedAt: new Date().toISOString(),
        },
      }

      reply.header('Cache-Control', 'public, max-age=1800')
      return response
    },
  })
}

export default voiceFingerprint
```

## Appendix C: Example Svelte chart component

```svelte
<!-- apps/web/src/lib/charts/VoiceFingerprint.svelte -->
<script lang="ts">
  import type { VoiceFingerprintResponse } from '@civicwatch/schemas'
  import { color } from '@civicwatch/tokens'

  interface Props {
    data: VoiceFingerprintResponse
  }
  let { data }: Props = $props()

  let sorted = $derived(
    [...data.data].sort(
      (a, b) => Math.abs(b.deviation) - Math.abs(a.deviation),
    ),
  )

  let maxAbsDev = $derived(
    Math.max(...sorted.map(r => Math.abs(r.deviation)), 0.01),
  )

  let partyColor = $derived(
    data.meta.legislator.party === 'Democratic' ? color.ballotBlue :
    data.meta.legislator.party === 'Republican' ? color.ballotRed :
    color.independent,
  )

  const rowH = 22
  const width = 420
  const barMaxWidth = width * 0.4
  const centerX = width * 0.55
  const height = $derived(sorted.length * rowH + 24)

  // For accessibility fallback
  const summary = $derived(
    `Voice fingerprint for ${data.meta.legislator.name}. ` +
    `${sorted.length} topics ranked by deviation from ${data.meta.legislator.party ?? 'party'} median. ` +
    `Most distinctive: ${sorted[0]?.topicLabel} at ` +
    `${(sorted[0]?.deviation * 100).toFixed(1)}%.`
  )
</script>

<figure class="chart">
  <figcaption class="chart-caption">
    <h3>Voice fingerprint</h3>
    <p>Topics {data.meta.legislator.name} discusses more (bars right) or less
    (bars left) than the typical
    {data.meta.legislator.party ?? 'legislator'}.</p>
  </figcaption>

  <p class="visually-hidden" aria-live="off">{summary}</p>

  <svg
    role="img"
    aria-labelledby="vf-title"
    aria-describedby="vf-desc"
    viewBox="0 0 {width} {height}"
    width={width}
    height={height}
  >
    <title id="vf-title">Voice fingerprint</title>
    <desc id="vf-desc">{summary}</desc>

    <!-- center line -->
    <line
      x1={centerX} x2={centerX} y1="0" y2={height - 24}
      stroke={color.rule} stroke-width="1"
    />

    {#each sorted as row, i}
      {@const y = i * rowH + 12}
      {@const dev = row.deviation}
      {@const barLen = (Math.abs(dev) / maxAbsDev) * barMaxWidth}
      {@const barColor = dev >= 0 ? partyColor : color.mute}

      <text
        x={centerX - 8} y={y + 4}
        text-anchor="end"
        font-family={color.type ? '' : ''} font-size="12"
        fill={color.ink}
      >
        {row.topicLabel}
      </text>

      <rect
        x={dev >= 0 ? centerX : centerX - barLen}
        y={y - 4}
        width={barLen}
        height="8"
        fill={barColor}
        rx="1"
      />

      <text
        x={dev >= 0 ? centerX + barLen + 4 : centerX - barLen - 4}
        y={y + 4}
        text-anchor={dev >= 0 ? 'start' : 'end'}
        font-size="11"
        fill={color.mute}
        class="tabular"
      >
        {(dev * 100).toFixed(1)}%
      </text>
    {/each}
  </svg>

  <details class="chart-table">
    <summary>View as table</summary>
    <table>
      <thead>
        <tr>
          <th>Topic</th>
          <th>Self share</th>
          <th>Party median</th>
          <th>Deviation</th>
          <th>Posts</th>
        </tr>
      </thead>
      <tbody>
        {#each sorted as row}
          <tr>
            <td>{row.topicLabel}</td>
            <td class="tabular">{(row.selfShare * 100).toFixed(1)}%</td>
            <td class="tabular">{(row.partyMedianShare * 100).toFixed(1)}%</td>
            <td class="tabular">{(row.deviation * 100).toFixed(1)}%</td>
            <td class="tabular">{row.postsInTopic}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </details>
</figure>

<style>
  .chart {
    background: var(--color-card);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-card);
    padding: var(--space-6);
  }

  .chart-caption { margin: 0 0 var(--space-4); }
  .chart-caption h3 { margin: 0 0 var(--space-2); font-size: 1.125rem; }
  .chart-caption p { margin: 0; color: var(--color-mute); font-size: 0.875rem; }

  .chart-table {
    margin-top: var(--space-6);
    border-top: 1px solid var(--color-rule);
    padding-top: var(--space-4);
  }
  .chart-table summary { cursor: pointer; color: var(--color-mute); font-size: 0.875rem; }
  .chart-table table { width: 100%; border-collapse: collapse; margin-top: var(--space-3); }
  .chart-table th, .chart-table td {
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--color-rule);
    text-align: left;
  }
  .chart-table th { font-weight: 500; color: var(--color-mute); font-size: 0.8125rem; }
</style>
```

## Appendix D: Environment variables

```
# apps/api
DATABASE_URL=postgres://civicwatch_read:...@postgres:5432/civicwatch
DATABASE_URL_ADMIN=postgres://civicwatch_admin:...@postgres:5432/civicwatch  # migrations only
PORT=4000
NODE_ENV=production
RELOAD_SECRET=<32 random chars>
LOG_LEVEL=info
CACHE_MAX_BYTES=536870912  # 512 MB
RATE_LIMIT_JSON=300        # per IP per minute
RATE_LIMIT_EXPORT=5        # per IP per minute
OTEL_EXPORTER_OTLP_ENDPOINT=   # optional

# apps/web
PUBLIC_ORIGIN=https://civicwatch.example
API_BASE_URL=http://api:4000
PORT=3000
NODE_ENV=production

# pipelines/data
SOURCE_DB_URL=postgres://readonly@source:5432/civicwatch_source
TARGET_DB_URL=postgres://civicwatch_admin:...@postgres:5432/civicwatch
SNAPSHOT_STORAGE=./snapshots         # or s3://bucket/path/
RELOAD_URLS=http://api:4000/internal/reload
RELOAD_SECRET=<same as api>
```

## Appendix E: Docker Compose for local dev

```yaml
# deploy/docker-compose.dev.yml
services:
  postgres:
    image: postgres:17-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: civicwatch
      POSTGRES_USER: civicwatch
      POSTGRES_PASSWORD: dev
    volumes:
      - ./postgres/postgresql.conf:/etc/postgresql/postgresql.conf:ro
      - pg_data:/var/lib/postgresql/data
    command: ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]

  # Web and API run natively via `pnpm dev` for hot reload

volumes:
  pg_data:
```

For dev, the web + api run natively via `pnpm dev` (with `tsx` and Vite watching for changes) while Postgres runs in Compose. For production, both apps run in Compose with pre-built images.

---

*End of technical specification.*

*The next document to produce, if we haven't already: a threat model, an OpenAPI schema file (auto-generated from Zod), and a browser-support matrix. All are follow-ons to this baseline rather than prerequisites for starting implementation.*
