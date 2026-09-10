import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { sql, closeDb } from './db/index.js';
import { events } from './data/events.js';
import { renderBarPng, type BarDatum } from './png.js';
import {
  SNAPSHOT_CUTOFF,
  SNAPSHOT_ID,
  US_STATES,
  clampLimit,
  envelope,
  n,
  queryHashOf,
  s,
  stableAnchor,
  stateName,
  titleCasePersonName
} from './utils.js';

type Query = Record<string, string | undefined>;
type ExportSpec = {
  chart?: string;
  filters?: Record<string, unknown>;
  limit?: number;
};

type RateLimitRequest = {
  headers: Record<string, string | string[] | undefined>;
  ip: string;
  socket?: {
    remoteAddress?: string;
  };
};

function envFlag(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  return fallback;
}

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

function firstHeaderValue(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.split(',')[0]?.trim() || null;
}

function isLoopbackAddress(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.replace(/^::ffff:/, '');
  return normalized === '127.0.0.1' || normalized === '::1' || normalized === 'localhost';
}

function forwardedClientAddress(request: RateLimitRequest): string | null {
  return (
    firstHeaderValue(request.headers['cf-connecting-ip']) ||
    firstHeaderValue(request.headers['x-real-ip']) ||
    firstHeaderValue(request.headers['x-forwarded-for'])
  );
}

function hasForwardedClientAddress(request: RateLimitRequest): boolean {
  return Boolean(forwardedClientAddress(request));
}

function rateLimitKey(request: RateLimitRequest): string {
  return forwardedClientAddress(request) ?? request.ip ?? request.socket?.remoteAddress ?? 'unknown';
}

function shouldBypassRateLimit(request: RateLimitRequest): boolean {
  if (!envFlag('CIVICWATCH_RATE_LIMIT_BYPASS_INTERNAL', true)) return false;
  if (hasForwardedClientAddress(request)) return false;
  if (!isLoopbackAddress(request.ip) && !isLoopbackAddress(request.socket?.remoteAddress)) return false;

  const token = process.env.CIVICWATCH_INTERNAL_TOKEN;
  if (!token) return true;

  return firstHeaderValue(request.headers['x-civicwatch-internal-token']) === token;
}

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info'
  },
  trustProxy: envFlag('CIVICWATCH_TRUST_PROXY', true)
});

await app.register(cors, { origin: true });
await app.register(rateLimit, {
  max: envInt('CIVICWATCH_RATE_LIMIT_MAX', 900),
  timeWindow: process.env.CIVICWATCH_RATE_LIMIT_WINDOW ?? '1 minute',
  keyGenerator: rateLimitKey,
  allowList: shouldBypassRateLimit,
  errorResponseBuilder: (_request, context) => ({
    statusCode: 429,
    code: 'RATE_LIMITED',
    error: 'Too Many Requests',
    message: `Rate limit exceeded, retry in ${context.after}`,
    retryAfter: context.after
  })
});
app.addContentTypeParser(
  ['application/octet-stream', 'application/x-www-form-urlencoded', 'text/plain'],
  { parseAs: 'string' },
  (_request, payload, done) => done(null, payload)
);
await app.register(swagger, {
  openapi: {
    info: { title: 'CivicWatch API', version: '0.1.0' }
  }
});
await app.register(swaggerUi, { routePrefix: '/docs' });

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  const err = error as Error & { statusCode?: number };
  const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
  const code = status === 404 ? 'NOT_FOUND' : status === 429 ? 'RATE_LIMITED' : 'INTERNAL';
  reply.code(status).send({
    error: {
      code,
      message: status === 500 ? "We couldn't load that data. Try again in a moment." : err.message,
      requestId: request.id
    },
    meta: { snapshotId: SNAPSHOT_ID, generatedAt: new Date().toISOString() }
  });
});

function normalizedTopic(topic: string | undefined): string | null {
  if (topic === undefined || topic === '') return null;
  return topic === 'uncategorized' ? '999' : topic;
}

function exportSpec(body: unknown): ExportSpec {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as ExportSpec;
    } catch {
      return {};
    }
  }
  return body as ExportSpec;
}

function cleanText(text: unknown) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

function canonicalPostText(text: unknown) {
  return cleanText(text).toLocaleLowerCase();
}

function postRow(row: Record<string, unknown>) {
  const shareCount = n(row.share_count);
  const sharerCount = n(row.sharer_count);
  const sharers = Array.isArray(row.sharers) ? row.sharers : [];
  const shareGroup =
    shareCount > 1 || sharerCount > 1
      ? {
          key: s(row.text_key),
          postCount: shareCount,
          legislatorCount: sharerCount,
          totalLikes: n(row.share_total_likes),
          totalRetweets: n(row.share_total_retweets),
          aggregateEngagement: n(row.aggregate_engagement),
          candidateCount: n(row.candidate_count),
          sharers
        }
      : null;

  return {
    id: n(row.id),
    tweetId: s(row.tweet_id),
    lid: s(row.lid),
    createdAt: s(row.created_at),
    text: cleanText(row.text),
    topic: s(row.topic),
    topicLabel: s(row.topic_label) === 'Unknown Topic (999)' ? 'Uncategorized' : s(row.topic_label),
    likeCount: n(row.like_count),
    retweetCount: n(row.retweet_count),
    replyCount: n(row.reply_count),
    quoteCount: n(row.quote_count),
    engagement: n(row.like_count) + n(row.retweet_count),
    duplicateCount: Math.max(1, n(row.duplicate_count) || 1),
    legislator: {
      name: titleCasePersonName(s(row.name)),
      handle: s(row.handle),
      state: s(row.state),
      chamber: s(row.chamber),
      party: s(row.party)
    },
    shareGroup
  };
}

async function hasCanonicalDailyAggregate() {
  const [row] = await sql`
    SELECT to_regclass('app_topic_engagement_daily_canonical') IS NOT NULL AS exists
  `;
  return Boolean(row?.exists);
}

async function maxPostId() {
  const [row] = await sql`SELECT COALESCE(max(id), 1)::bigint AS max_id FROM app_posts_canonical`;
  return n(row?.max_id);
}

let metaCache:
  | {
      expiresAt: number;
      payload: ReturnType<typeof envelope<Record<string, unknown>>>;
    }
  | null = null;

async function topPostsForLegislator(lid: string, limit = 3) {
  const rows = await sql`
    SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
    FROM app_posts_canonical p
    JOIN topics t ON t.topic = p.topic
    JOIN legislators l ON l.lid = p.lid
    WHERE p.lid = ${lid}
    ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
    LIMIT ${limit}
  `;
  return rows.map(postRow);
}

async function topPostsForTopic(topicId: string, limit = 3) {
  const rows = await sql`
    SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
    FROM app_posts_canonical p
    JOIN topics t ON t.topic = p.topic
    JOIN legislators l ON l.lid = p.lid
    WHERE p.topic = ${topicId}
    ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
    LIMIT ${limit}
  `;
  return rows.map(postRow);
}

async function topPostsForState(
  state: string,
  limit = 3,
  filters: { topic?: string | null; party?: string | null; from?: string | null; to?: string | null } = {}
) {
  const topic = filters.topic ?? null;
  const party = filters.party ?? null;
  const from = filters.from ?? null;
  const to = filters.to ?? null;

  const rows = await sql`
    WITH state_lids AS (
      SELECT lid
      FROM app_legislator_summary
      WHERE state = ${state}
        AND (${party}::text IS NULL OR party = ${party})
    ),
    candidate_posts AS (
      SELECT p.*
      FROM state_lids sl
      JOIN LATERAL (
        SELECT *
        FROM app_posts_canonical p
        WHERE p.lid = sl.lid
          AND (${topic}::text IS NULL OR p.topic = ${topic})
          AND (${from}::date IS NULL OR p.created_at >= ${from}::date)
          AND (${to}::date IS NULL OR p.created_at <= ${to}::date)
        ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
        LIMIT ${limit}
      ) p ON true
    )
    SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
    FROM candidate_posts p
    JOIN topics t ON t.topic = p.topic
    JOIN legislators l ON l.lid = p.lid
    ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
    LIMIT ${limit}
  `;
  return rows.map(postRow);
}

app.get('/api/v1/health', { config: { rateLimit: false } }, async () => {
  const [row] = await sql`SELECT 1 AS ok`;
  return envelope({ ok: row?.ok === 1, postgres: true }, 'health');
});

app.get('/api/v1/meta', async () => {
  const now = Date.now();
  if (metaCache && metaCache.expiresAt > now) {
    return metaCache.payload;
  }

  const [counts] = await sql`
    SELECT
      (SELECT reltuples::bigint FROM pg_class WHERE oid = 'public.posts'::regclass) AS posts,
      (SELECT count(*)::int FROM legislators) AS legislators,
      (SELECT count(*)::int FROM topics) AS topics,
      (SELECT count(DISTINCT state)::int FROM legislators WHERE state IS NOT NULL) AS states,
      (SELECT count(*)::int FROM legislators WHERE state IS NOT NULL AND party IS NOT NULL) AS identified_legislators,
      (SELECT count(*)::int FROM legislators WHERE mrp_ideology IS NOT NULL) AS ideology_legislators,
      (SELECT min(created_at)::text FROM posts) AS first_post_date,
      (SELECT max(created_at)::text FROM posts) AS last_post_date
  `;

  const payload = envelope(
    {
      snapshotId: SNAPSHOT_ID,
      sourceCutoff: SNAPSHOT_CUTOFF,
      rowCounts: {
        posts: n(counts.posts),
        legislators: n(counts.legislators),
        topics: n(counts.topics),
        states: n(counts.states)
      },
      coverage: {
        identifiedLegislators: n(counts.identified_legislators),
        ideologyLegislators: n(counts.ideology_legislators),
        unidentifiedLegislators: n(counts.legislators) - n(counts.identified_legislators)
      },
      coveragePeriod: [s(counts.first_post_date), s(counts.last_post_date)]
    },
    'pg_class + base tables',
    {},
    { coveragePeriod: [s(counts.first_post_date), s(counts.last_post_date)] }
  );

  metaCache = {
    expiresAt: now + envInt('CIVICWATCH_META_CACHE_SECONDS', 300) * 1000,
    payload
  };

  return payload;
});

app.get('/api/v1/chamber', async (request) => {
  const q = request.query as Query;
  const state = q.state?.toUpperCase();
  const party = q.party;
  const chamber = q.chamber?.toUpperCase();
  const topic = normalizedTopic(q.topic);
  const rows = await sql`
    SELECT l.lid, l.name, l.handle, l.state, l.chamber, l.party, l.mrp_ideology,
           l.shor_ideo, ls.total_posts, ls.total_likes, ls.total_retweets
    FROM app_legislator_summary ls
    JOIN legislators l ON l.lid = ls.lid
    WHERE (${state ?? null}::text IS NULL OR l.state = ${state ?? null})
      AND (${party ?? null}::text IS NULL OR l.party = ${party ?? null})
      AND (${chamber ?? null}::text IS NULL OR l.chamber = ${chamber ?? null})
      AND (${topic ?? null}::text IS NULL OR EXISTS (
        SELECT 1 FROM app_legislator_topic alt
        WHERE alt.lid = l.lid AND alt.topic = ${topic ?? null}
      ))
    ORDER BY l.mrp_ideology NULLS LAST, l.party, l.name
  `;

  return envelope(
    rows.map((row) => ({
      lid: s(row.lid),
      name: titleCasePersonName(s(row.name)),
      handle: s(row.handle),
      state: s(row.state),
      chamber: s(row.chamber),
      party: s(row.party),
      mrpIdeology: row.mrp_ideology === null ? null : Number(row.mrp_ideology),
      shorIdeology: row.shor_ideo === null ? null : Number(row.shor_ideo),
      totalPosts: n(row.total_posts),
      totalEngagement: n(row.total_likes) + n(row.total_retweets)
    })),
    'app_legislator_summary',
    q,
    {
      populationCount: 5927,
      includedCount: rows.length,
      excludedMissingCount: rows.filter((row) => row.mrp_ideology === null).length
    }
  );
});

app.get('/api/v1/search', async (request) => {
  const q = (request.query as Query).q?.trim() ?? '';
  if (q.length < 2) return envelope({ legislators: [], states: [], topics: [] }, 'search', { q });

  const like = `%${q}%`;
  const legislators = await sql`
    SELECT l.lid, l.name, l.handle, l.state, l.chamber, l.party, ls.total_posts
    FROM legislators l
    LEFT JOIN app_legislator_summary ls ON ls.lid = l.lid
    WHERE l.name ILIKE ${like} OR l.handle ILIKE ${like} OR l.state ILIKE ${q}
    ORDER BY COALESCE(ls.total_posts, 0) DESC, l.name
    LIMIT 12
  `;
  const topics = await sql`
    SELECT topic, topic_label
    FROM topics
    WHERE topic_label ILIKE ${like} OR topic = ${q}
    ORDER BY topic::int
    LIMIT 12
  `;
  const states = US_STATES.filter(
    (state) => state.code.toLowerCase() === q.toLowerCase() || state.name.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 12);

  return envelope(
    {
      legislators: legislators.map((row) => ({
        lid: s(row.lid),
        name: titleCasePersonName(s(row.name)),
        handle: s(row.handle),
        state: s(row.state),
        chamber: s(row.chamber),
        party: s(row.party),
        totalPosts: n(row.total_posts)
      })),
      states,
      topics: topics.map((row) => ({
        topic: s(row.topic),
        topicLabel: s(row.topic_label) === 'Unknown Topic (999)' ? 'Uncategorized' : s(row.topic_label)
      }))
    },
    'legislators + topics + state list',
    { q }
  );
});

app.get('/api/v1/legislators', async (request) => {
  const q = request.query as Query;
  const requestedLimit = Number(q.limit ?? 100);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(6000, Math.max(1, Math.trunc(requestedLimit)))
    : 100;
  const search = q.q?.trim();
  const state = q.state?.toUpperCase();
  const party = q.party;
  const chamber = q.chamber?.toUpperCase();
  const sort = q.sort === 'name' ? 'name' : 'posts';

  const [rows, [countRow]] = await Promise.all([sql`
    SELECT l.lid, l.name, l.handle, l.state, l.chamber, l.party, l.mrp_ideology,
           ls.total_posts, ls.total_likes, ls.total_retweets, ls.first_post_date, ls.last_post_date
    FROM legislators l
    LEFT JOIN app_legislator_summary ls ON ls.lid = l.lid
    WHERE (${search ?? null}::text IS NULL OR l.name ILIKE ${search ? `%${search}%` : null} OR l.handle ILIKE ${search ? `%${search}%` : null})
      AND (${state ?? null}::text IS NULL OR l.state = ${state ?? null})
      AND (${party ?? null}::text IS NULL OR l.party = ${party ?? null})
      AND (${chamber ?? null}::text IS NULL OR l.chamber = ${chamber ?? null})
    ORDER BY
      CASE WHEN ${sort} = 'posts' THEN COALESCE(ls.total_posts, 0) END DESC,
      l.name ASC
    LIMIT ${limit}
  `, sql`
    SELECT count(*) AS total
    FROM legislators l
    WHERE (${search ?? null}::text IS NULL OR l.name ILIKE ${search ? `%${search}%` : null} OR l.handle ILIKE ${search ? `%${search}%` : null})
      AND (${state ?? null}::text IS NULL OR l.state = ${state ?? null})
      AND (${party ?? null}::text IS NULL OR l.party = ${party ?? null})
      AND (${chamber ?? null}::text IS NULL OR l.chamber = ${chamber ?? null})
  `]);

  return envelope(
    rows.map((row) => ({
      lid: s(row.lid),
      name: titleCasePersonName(s(row.name)),
      handle: s(row.handle),
      state: s(row.state),
      chamber: s(row.chamber),
      party: s(row.party),
      mrpIdeology: row.mrp_ideology === null ? null : Number(row.mrp_ideology),
      totalPosts: n(row.total_posts),
      totalEngagement: n(row.total_likes) + n(row.total_retweets),
      firstPostDate: s(row.first_post_date),
      lastPostDate: s(row.last_post_date)
    })),
    'app_legislator_summary',
    { ...q, limit },
    { total: n(countRow?.total) }
  );
});

app.get('/api/v1/legislators/:lid', async (request, reply) => {
  const { lid } = request.params as { lid: string };
  const q = request.query as Query;
  const topic = normalizedTopic(q.topic);
  const [row] = await sql`
    SELECT l.*, ls.total_posts, ls.total_likes, ls.total_retweets, ls.total_replies, ls.total_quotes,
           ls.first_post_date, ls.last_post_date
    FROM legislators l
    LEFT JOIN app_legislator_summary ls ON ls.lid = l.lid
    WHERE l.lid = ${lid}
  `;
  if (!row) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Legislator not found.', requestId: request.id }, meta: { snapshotId: SNAPSHOT_ID, generatedAt: new Date().toISOString() } });

  const [contextual] = topic ? await sql`
    SELECT count(*) AS total_posts,
           COALESCE(sum(like_count), 0) AS total_likes,
           COALESCE(sum(retweet_count), 0) AS total_retweets,
           min(created_at) AS first_post_date,
           max(created_at) AS last_post_date
    FROM posts
    WHERE lid = ${lid} AND topic = ${topic}
  ` : [];
  const totals = contextual ?? row;

  return envelope(
    {
      lid: s(row.lid),
      name: titleCasePersonName(s(row.name)),
      handle: s(row.handle),
      state: s(row.state),
      chamber: s(row.chamber),
      party: s(row.party),
      firstname: s(row.firstname),
      lastname: s(row.lastname),
      gender: s(row.gender),
      race: s(row.race),
      districtName: s(row.district_name),
      districtNum: s(row.district_num),
      yrElected: row.yr_elected === null ? null : n(row.yr_elected),
      votePct: row.vote_pct === null ? null : Number(row.vote_pct),
      bpUrl: s(row.bp_url),
      mrpIdeology: row.mrp_ideology === null ? null : Number(row.mrp_ideology),
      shorIdeology: row.shor_ideo === null ? null : Number(row.shor_ideo),
      demsharePres: row.demshare_pres === null ? null : Number(row.demshare_pres),
      totalPosts: n(totals.total_posts),
      totalEngagement: n(totals.total_likes) + n(totals.total_retweets),
      firstPostDate: s(totals.first_post_date),
      lastPostDate: s(totals.last_post_date)
    },
    'legislators + app_legislator_summary',
    { lid, topic }
  );
});

app.get('/api/v1/legislators/:lid/voice-fingerprint', async (request) => {
  const { lid } = request.params as { lid: string };
  const q = request.query as Query;
  const topic = normalizedTopic(q.topic);
  const [legislator] = await sql`SELECT lid, name, party FROM legislators WHERE lid = ${lid}`;
  const rows = await sql`
    WITH self AS (
      SELECT alt.topic, alt.topic_label,
             alt.post_count::float / NULLIF(als.total_posts, 0)::float AS self_share,
             alt.post_count
      FROM app_legislator_topic alt
      JOIN app_legislator_summary als ON als.lid = alt.lid
      WHERE alt.lid = ${lid}
    ),
    party_medians AS (
      SELECT alt.topic,
             percentile_disc(0.5) WITHIN GROUP (ORDER BY alt.post_count::float / NULLIF(als.total_posts, 0)::float) AS median_share
      FROM app_legislator_topic alt
      JOIN app_legislator_summary als ON als.lid = alt.lid
      WHERE als.party = ${s(legislator?.party)}
        AND als.total_posts >= 50
      GROUP BY alt.topic
    )
    SELECT t.topic, t.topic_label,
           COALESCE(self.self_share, 0) AS self_share,
           COALESCE(party_medians.median_share, 0) AS party_median_share,
           COALESCE(self.post_count, 0) AS posts_in_topic
    FROM topics t
    LEFT JOIN self ON self.topic = t.topic
    LEFT JOIN party_medians ON party_medians.topic = t.topic
    WHERE (${topic ?? null}::text IS NULL OR t.topic = ${topic ?? null})
    ORDER BY CASE WHEN t.topic = '999' THEN 999 ELSE t.topic::int END
  `;

  return envelope(
    rows.map((row) => ({
      topic: s(row.topic),
      topicLabel: s(row.topic_label) === 'Unknown Topic (999)' ? 'Uncategorized' : s(row.topic_label),
      selfShare: Number(row.self_share),
      partyMedianShare: Number(row.party_median_share),
      deviation: Number(row.self_share) - Number(row.party_median_share),
      postsInTopic: n(row.posts_in_topic)
    })),
    'app_legislator_topic',
    { lid, topic },
    { legislator: legislator ?? null }
  );
});

app.get('/api/v1/legislators/:lid/posts', async (request) => {
  const { lid } = request.params as { lid: string };
  const q = request.query as Query;
  const limit = clampLimit(q.limit, 25, 100);
  const cursor = q.cursor ? Number(q.cursor) : null;
  const topic = normalizedTopic(q.topic);
  const sort = q.sort === 'engagement' ? 'engagement' : 'recent';
  const rows = sort === 'engagement'
    ? await sql`
      SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
      FROM app_posts_canonical p
      JOIN topics t ON t.topic = p.topic
      JOIN legislators l ON l.lid = p.lid
      WHERE p.lid = ${lid}
        AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
        AND (${q.from ?? null}::date IS NULL OR p.created_at >= ${q.from ?? null}::date)
        AND (${q.to ?? null}::date IS NULL OR p.created_at <= ${q.to ?? null}::date)
      ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
      LIMIT ${limit}
    `
    : await sql`
      SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
      FROM app_posts_canonical p
      JOIN topics t ON t.topic = p.topic
      JOIN legislators l ON l.lid = p.lid
      WHERE p.lid = ${lid}
        AND (${cursor}::bigint IS NULL OR p.id < ${cursor})
        AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
        AND (${q.from ?? null}::date IS NULL OR p.created_at >= ${q.from ?? null}::date)
        AND (${q.to ?? null}::date IS NULL OR p.created_at <= ${q.to ?? null}::date)
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ${limit}
    `;
  return envelope(
    rows.map(postRow),
    'posts',
    { ...q, lid, limit, sort },
    { nextCursor: sort === 'recent' && rows.length === limit ? rows.at(-1)?.id ?? null : null }
  );
});

app.get('/api/v1/legislators/:lid/activity', async (request) => {
  const { lid } = request.params as { lid: string };
  const q = request.query as Query;
  const rows = await sql`
    SELECT date_trunc('month', p.created_at)::date AS month, p.topic, t.topic_label, count(*)::int AS post_count
    FROM posts p
    JOIN topics t ON t.topic = p.topic
    WHERE p.lid = ${lid}
      AND (${q.from ?? null}::date IS NULL OR p.created_at >= ${q.from ?? null}::date)
      AND (${q.to ?? null}::date IS NULL OR p.created_at <= ${q.to ?? null}::date)
    GROUP BY 1, p.topic, t.topic_label
    ORDER BY 1, p.topic
  `;
  return envelope(rows, 'posts', { ...q, lid });
});

app.get('/api/v1/legislators/:lid/engagement', async (request) => {
  const { lid } = request.params as { lid: string };
  const rows = await sql`
    SELECT date_trunc('month', created_at)::date AS month,
           sum(like_count)::bigint AS likes,
           sum(retweet_count)::bigint AS retweets,
           sum(reply_count)::bigint AS replies,
           sum(quote_count)::bigint AS quotes,
           count(*)::int AS posts
    FROM posts
    WHERE lid = ${lid}
    GROUP BY 1
    ORDER BY 1
  `;
  return envelope(rows, 'posts', { lid });
});

app.get('/api/v1/legislators/:lid/similar', async (request) => {
  const { lid } = request.params as { lid: string };
  const rows = await sql`
    SELECT other.lid, other.name, other.handle, other.state, other.party,
           abs(other.mrp_ideology - base.mrp_ideology) AS distance
    FROM legislators base
    JOIN legislators other ON other.lid <> base.lid
      AND other.mrp_ideology IS NOT NULL
      AND base.mrp_ideology IS NOT NULL
    WHERE base.lid = ${lid}
    ORDER BY abs(other.mrp_ideology - base.mrp_ideology)
    LIMIT 8
  `;
  return envelope(
    rows.map((row) => ({
      lid: s(row.lid),
      name: titleCasePersonName(s(row.name)),
      handle: s(row.handle),
      state: s(row.state),
      party: s(row.party),
      distance: row.distance === null ? null : Number(row.distance)
    })),
    'legislators',
    { lid }
  );
});

app.get('/api/v1/legislators/:lid/network', async (request) => {
  const { lid } = request.params as { lid: string };
  const q = request.query as Query;
  const topic = normalizedTopic(q.topic);
  const interactionType =
    q.type === 'mention' || q.type === 'retweet' ? q.type : null;
  const direction =
    q.direction === 'incoming' || q.direction === 'outgoing' ? q.direction : null;
  const includeExternal = q.external === 'true';
  const minPosts = Math.max(1, Math.trunc(Number(q.minPosts ?? 1)) || 1);
  const limit =
    q.limit === undefined || q.limit === 'all'
      ? 50000
      : clampLimit(q.limit, 360, 50000);
  const queryLimit = q.limit === undefined || q.limit === 'all'
    ? limit
    : Math.min(50000, limit * 3);

  const [center] = await sql`
    SELECT lid, name, handle, state, chamber, party, mrp_ideology
    FROM legislators
    WHERE lid = ${lid}
  `;
  if (!center) {
    return envelope(
      { center: null, links: [], facets: { topics: [], parties: [], states: [], types: [], directions: [] }, summary: {} },
      'app_network_edges',
      { ...q, lid }
    );
  }

  const rows = await sql`
    WITH edge_rows AS (
      SELECT
        'outgoing'::text AS direction,
        e.target_lid,
        COALESCE(e.target_lid, 'external:' || e.target_handle) AS neighbor_key,
        COALESCE(tl.name, '@' || e.target_handle) AS neighbor_name,
        COALESCE(tl.handle, e.target_handle) AS neighbor_handle,
        tl.state AS neighbor_state,
        tl.chamber AS neighbor_chamber,
        tl.party AS neighbor_party,
        tl.mrp_ideology AS neighbor_ideology,
        e.target_handle,
        e.interaction_type,
        e.topic,
        COALESCE(t.topic_label, 'Topic ' || e.topic) AS topic_label,
        e.post_count,
        e.engagement,
        (to_jsonb(e)->>'raw_interaction_count')::bigint AS raw_interaction_count,
        (to_jsonb(e)->>'raw_engagement')::bigint AS raw_engagement,
        (to_jsonb(e)->>'canonical_post_count')::bigint AS canonical_post_count,
        (to_jsonb(e)->>'canonical_engagement')::bigint AS canonical_engagement,
        e.first_seen,
        e.last_seen,
        e.sample_post_id,
        e.confidence
      FROM app_network_edges e
      LEFT JOIN legislators tl ON tl.lid = e.target_lid
      LEFT JOIN topics t ON t.topic = e.topic
      WHERE e.source_lid = ${lid}
        AND (${topic ?? null}::text IS NULL OR e.topic = ${topic ?? null})
        AND (${interactionType ?? null}::text IS NULL OR e.interaction_type = ${interactionType ?? null})
        AND (${direction ?? null}::text IS NULL OR ${direction ?? null}::text = 'outgoing')
        AND (${includeExternal}::boolean OR e.target_lid IS NOT NULL)
        AND e.post_count >= ${minPosts}

      UNION ALL

      SELECT
        'incoming'::text AS direction,
        e.source_lid AS target_lid,
        e.source_lid AS neighbor_key,
        sl.name AS neighbor_name,
        sl.handle AS neighbor_handle,
        sl.state AS neighbor_state,
        sl.chamber AS neighbor_chamber,
        sl.party AS neighbor_party,
        sl.mrp_ideology AS neighbor_ideology,
        e.target_handle,
        e.interaction_type,
        e.topic,
        COALESCE(t.topic_label, 'Topic ' || e.topic) AS topic_label,
        e.post_count,
        e.engagement,
        (to_jsonb(e)->>'raw_interaction_count')::bigint AS raw_interaction_count,
        (to_jsonb(e)->>'raw_engagement')::bigint AS raw_engagement,
        (to_jsonb(e)->>'canonical_post_count')::bigint AS canonical_post_count,
        (to_jsonb(e)->>'canonical_engagement')::bigint AS canonical_engagement,
        e.first_seen,
        e.last_seen,
        e.sample_post_id,
        e.confidence
      FROM app_network_edges e
      JOIN legislators sl ON sl.lid = e.source_lid
      LEFT JOIN topics t ON t.topic = e.topic
      WHERE e.target_lid = ${lid}
        AND (${topic ?? null}::text IS NULL OR e.topic = ${topic ?? null})
        AND (${interactionType ?? null}::text IS NULL OR e.interaction_type = ${interactionType ?? null})
        AND (${direction ?? null}::text IS NULL OR ${direction ?? null}::text = 'incoming')
        AND e.post_count >= ${minPosts}
    )
    SELECT *
    FROM edge_rows
    ORDER BY post_count DESC, engagement DESC, neighbor_key, topic
    LIMIT ${queryLimit}
  `;

  const topics = new Map<string, { topic: string | null; topicLabel: string | null; postCount: number }>();
  const parties = new Map<string, number>();
  const states = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  const directionCounts = new Map<string, number>();

  let totalPosts = 0;
  let totalEngagement = 0;
  let externalLinks = 0;
  let knownLegislatorLinks = 0;

  const duplicateRetweets = new Set(
    rows
      .filter((row) => s(row.interaction_type) === 'retweet')
      .map((row) => [
        s(row.direction),
        s(row.neighbor_key),
        s(row.target_handle),
        s(row.topic),
        n(row.post_count)
      ].join('|'))
  );

  const dedupedRows = rows
    .filter((row) => {
      if (s(row.interaction_type) !== 'mention') return true;
      const key = [
        s(row.direction),
        s(row.neighbor_key),
        s(row.target_handle),
        s(row.topic),
        n(row.post_count)
      ].join('|');
      return !duplicateRetweets.has(key);
    })
    .slice(0, limit);

  const links = dedupedRows.map((row) => {
    const postCount = n(row.post_count);
    const engagement = n(row.engagement);
    const rawInteractionCount = n(row.raw_interaction_count) || postCount;
    const rawEngagement = n(row.raw_engagement) || engagement;
    const canonicalPostCount = n(row.canonical_post_count) || postCount;
    const canonicalEngagement = n(row.canonical_engagement) || engagement;
    totalPosts += postCount;
    totalEngagement += engagement;
    if (row.target_lid === null && row.direction === 'outgoing') externalLinks += 1;
    else knownLegislatorLinks += 1;

    const topicKey = s(row.topic) ?? 'unknown';
    const topicFacet = topics.get(topicKey) ?? {
      topic: s(row.topic),
      topicLabel: s(row.topic_label) === 'Unknown Topic (999)' ? 'Uncategorized' : s(row.topic_label),
      postCount: 0
    };
    topicFacet.postCount += postCount;
    topics.set(topicKey, topicFacet);

    const party = s(row.neighbor_party) ?? 'External';
    parties.set(party, (parties.get(party) ?? 0) + postCount);

    const state = s(row.neighbor_state) ?? 'External';
    states.set(state, (states.get(state) ?? 0) + postCount);

    const type = s(row.interaction_type) ?? 'unknown';
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + postCount);

    const dir = s(row.direction) ?? 'unknown';
    directionCounts.set(dir, (directionCounts.get(dir) ?? 0) + postCount);

    const neighborLid = s(row.target_lid);
    const neighborName = s(row.neighbor_name);

    return {
      id: [
        dir,
        s(row.neighbor_key),
        s(row.target_handle),
        type,
        topicKey,
        row.sample_post_id === null ? '' : n(row.sample_post_id)
      ].join(':'),
      direction: dir,
      source: dir === 'outgoing' ? s(center.lid) : s(row.neighbor_key),
      target: dir === 'outgoing' ? s(row.neighbor_key) : s(center.lid),
      neighborKey: s(row.neighbor_key),
      neighbor: {
        lid: neighborLid,
        name: neighborLid ? titleCasePersonName(neighborName) : neighborName,
        handle: s(row.neighbor_handle),
        state: s(row.neighbor_state),
        chamber: s(row.neighbor_chamber),
        party: s(row.neighbor_party),
        ideology: row.neighbor_ideology === null ? null : Number(row.neighbor_ideology),
        external: neighborLid === null
      },
      targetHandle: s(row.target_handle),
      interactionType: type,
      topic: topicKey,
      topicLabel: s(row.topic_label) === 'Unknown Topic (999)' ? 'Uncategorized' : s(row.topic_label),
      postCount,
      engagement,
      rawInteractionCount,
      rawEngagement,
      canonicalPostCount,
      canonicalEngagement,
      firstSeen: s(row.first_seen),
      lastSeen: s(row.last_seen),
      samplePostId: row.sample_post_id === null ? null : n(row.sample_post_id),
      confidence: s(row.confidence)
    };
  });

  const facetRows = <T>(map: Map<string, T>, mapper: (key: string, value: T) => unknown) =>
    Array.from(map.entries()).map(([key, value]) => mapper(key, value));

  return envelope(
    {
      center: {
        lid: s(center.lid),
        name: titleCasePersonName(s(center.name)),
        handle: s(center.handle),
        state: s(center.state),
        chamber: s(center.chamber),
        party: s(center.party),
        ideology: center.mrp_ideology === null ? null : Number(center.mrp_ideology)
      },
      links,
      facets: {
        topics: Array.from(topics.values()).sort((a, b) => b.postCount - a.postCount),
        parties: facetRows(parties, (party, postCount) => ({ party, postCount })).sort((a: any, b: any) => b.postCount - a.postCount),
        states: facetRows(states, (state, postCount) => ({ state, postCount })).sort((a: any, b: any) => b.postCount - a.postCount),
        types: facetRows(typeCounts, (type, postCount) => ({ type, postCount })),
        directions: facetRows(directionCounts, (direction, postCount) => ({ direction, postCount }))
      },
      summary: {
        linkRows: links.length,
        totalPosts,
        totalEngagement,
        knownLegislatorLinks,
        externalLinks,
      limitedTo: q.limit === undefined || q.limit === 'all' ? null : limit
      }
    },
    'app_network_edges + legislators + topics',
    { ...q, lid, topic, interactionType, direction, includeExternal, minPosts, limit }
  );
});

app.get('/api/v1/topics', async (request) => {
  const q = request.query as Query;
  const state = q.state?.toUpperCase() ?? null;
  const party = q.party === 'Democratic' || q.party === 'Republican' ? q.party : null;
  const from = q.from ?? null;
  const to = q.to ?? null;
  const hasLiveFilters = Boolean(state || party || from || to);
  const rows = hasLiveFilters
    ? from || to
      ? await sql`
      SELECT t.topic, t.topic_label,
             count(p.id)::bigint AS post_count,
             COALESCE(sum(p.like_count), 0)::bigint AS total_likes,
             COALESCE(sum(p.retweet_count), 0)::bigint AS total_retweets
      FROM topics t
      LEFT JOIN posts p ON p.topic = t.topic
        AND (${from}::date IS NULL OR p.created_at >= ${from}::date)
        AND (${to}::date IS NULL OR p.created_at < ${to}::date + 1)
      LEFT JOIN legislators l ON l.lid = p.lid
      WHERE (${state}::text IS NULL OR l.state = ${state})
        AND (${party}::text IS NULL OR l.party = ${party})
      GROUP BY t.topic, t.topic_label
      ORDER BY CASE WHEN t.topic = '999' THEN 999 ELSE t.topic::int END
    `
      : await sql`
      SELECT t.topic, t.topic_label,
             COALESCE(sum(alt.post_count), 0)::bigint AS post_count,
             0::bigint AS total_likes,
             0::bigint AS total_retweets
      FROM topics t
      LEFT JOIN app_legislator_topic alt ON alt.topic = t.topic
      LEFT JOIN legislators l ON l.lid = alt.lid
      WHERE (${state}::text IS NULL OR l.state = ${state})
        AND (${party}::text IS NULL OR l.party = ${party})
      GROUP BY t.topic, t.topic_label
      ORDER BY CASE WHEN t.topic = '999' THEN 999 ELSE t.topic::int END
    `
    : await sql`
      SELECT t.topic, t.topic_label,
             COALESCE(sum(tpb.post_count), 0)::bigint AS post_count,
             COALESCE(sum(tpb.total_likes), 0)::bigint AS total_likes,
             COALESCE(sum(tpb.total_retweets), 0)::bigint AS total_retweets
      FROM topics t
      LEFT JOIN topic_party_breakdown tpb ON tpb.topic = t.topic
      GROUP BY t.topic, t.topic_label
      ORDER BY CASE WHEN t.topic = '999' THEN 999 ELSE t.topic::int END
    `;
  return envelope(rows.map((row) => ({
    topic: s(row.topic),
    topicLabel: s(row.topic_label) === 'Unknown Topic (999)' ? 'Uncategorized' : s(row.topic_label),
    postCount: n(row.post_count),
    totalEngagement: n(row.total_likes) + n(row.total_retweets)
  })), hasLiveFilters ? 'posts + legislators' : 'topic_party_breakdown', { state, party, from, to });
});

app.get('/api/v1/topics/:topicId', async (request) => {
  const topicId = normalizedTopic((request.params as { topicId: string }).topicId) ?? '999';
  const q = request.query as Query;
  const state = q.state?.toUpperCase() ?? null;
  const party = q.party === 'Democratic' || q.party === 'Republican' ? q.party : null;
  const from = q.from ?? null;
  const to = q.to ?? null;
  const hasLiveFilters = Boolean(state || party || from || to);
  const [row] = hasLiveFilters
    ? await sql`
      SELECT t.topic, t.topic_label,
             count(p.id)::bigint AS post_count,
             COALESCE(sum(p.like_count), 0)::bigint AS total_likes,
             COALESCE(sum(p.retweet_count), 0)::bigint AS total_retweets
      FROM topics t
      LEFT JOIN posts p ON p.topic = t.topic
        AND (${from}::date IS NULL OR p.created_at >= ${from}::date)
        AND (${to}::date IS NULL OR p.created_at < ${to}::date + 1)
      LEFT JOIN legislators l ON l.lid = p.lid
      WHERE t.topic = ${topicId}
        AND (${state}::text IS NULL OR l.state = ${state})
        AND (${party}::text IS NULL OR l.party = ${party})
      GROUP BY t.topic, t.topic_label
    `
    : await sql`
      SELECT t.topic, t.topic_label, COALESCE(sum(tpb.post_count), 0)::bigint AS post_count,
             COALESCE(sum(tpb.total_likes), 0)::bigint AS total_likes,
             COALESCE(sum(tpb.total_retweets), 0)::bigint AS total_retweets
      FROM topics t
      LEFT JOIN topic_party_breakdown tpb ON tpb.topic = t.topic
      WHERE t.topic = ${topicId}
      GROUP BY t.topic, t.topic_label
    `;
  return envelope(row ? {
    topic: s(row.topic),
    topicLabel: s(row.topic_label) === 'Unknown Topic (999)' ? 'Uncategorized' : s(row.topic_label),
    postCount: n(row.post_count),
    totalEngagement: n(row.total_likes) + n(row.total_retweets)
  } : null, hasLiveFilters ? 'posts + legislators' : 'topic_party_breakdown', { ...q, topicId, state, party, from, to });
});

app.get('/api/v1/topic-ribbon', async (request) => {
  const q = request.query as Query;
  const state = q.state?.toUpperCase() ?? null;
  const party = q.party === 'Democratic' || q.party === 'Republican' ? q.party : null;
  const from = q.from ?? null;
  const to = q.to ?? null;
  const hasLiveFilters = Boolean(state || party);
  const rows = hasLiveFilters
    ? await sql`
      WITH filtered_legislators AS MATERIALIZED (
        SELECT lid
        FROM legislators
        WHERE (${state}::text IS NULL OR state = ${state})
          AND (${party}::text IS NULL OR party = ${party})
      )
      SELECT p.created_at::date::text AS date, p.topic, t.topic_label,
             count(*)::bigint AS post_count,
             COALESCE(sum(p.like_count), 0)::bigint AS total_likes,
             COALESCE(sum(p.retweet_count), 0)::bigint AS total_retweets
      FROM posts p
      JOIN topics t ON t.topic = p.topic
      JOIN filtered_legislators l ON l.lid = p.lid
      WHERE (${from}::date IS NULL OR p.created_at >= ${from}::date)
        AND (${to}::date IS NULL OR p.created_at < ${to}::date + 1)
      GROUP BY p.created_at::date, p.topic, t.topic_label
      ORDER BY p.created_at::date, CASE WHEN p.topic = '999' THEN 999 ELSE p.topic::int END
    `
    : await sql`
      SELECT date::text, topic, topic_label, post_count, total_likes, total_retweets
      FROM topic_engagement_daily
      WHERE (${from}::date IS NULL OR date >= ${from}::date)
        AND (${to}::date IS NULL OR date <= ${to}::date)
      ORDER BY date, CASE WHEN topic = '999' THEN 999 ELSE topic::int END
    `;
  return envelope(rows, hasLiveFilters ? 'posts + legislators' : 'topic_engagement_daily', { ...q, state, party, from, to });
});

app.get('/api/v1/topics/:topicId/ribbon', async (request) => {
  const topicId = normalizedTopic((request.params as { topicId: string }).topicId) ?? '999';
  const q = request.query as Query;
  const state = q.state?.toUpperCase() ?? null;
  const party = q.party === 'Democratic' || q.party === 'Republican' ? q.party : null;
  const from = q.from ?? null;
  const to = q.to ?? null;
  const hasLiveFilters = Boolean(state || party);
  const rows = hasLiveFilters
    ? await sql`
      SELECT p.created_at::date::text AS date, p.topic, t.topic_label,
             count(*)::bigint AS post_count,
             COALESCE(sum(p.like_count), 0)::bigint AS total_likes,
             COALESCE(sum(p.retweet_count), 0)::bigint AS total_retweets
      FROM posts p
      JOIN topics t ON t.topic = p.topic
      JOIN legislators l ON l.lid = p.lid
      WHERE p.topic = ${topicId}
        AND (${from}::date IS NULL OR p.created_at >= ${from}::date)
        AND (${to}::date IS NULL OR p.created_at < ${to}::date + 1)
        AND (${state}::text IS NULL OR l.state = ${state})
        AND (${party}::text IS NULL OR l.party = ${party})
      GROUP BY p.created_at::date, p.topic, t.topic_label
      ORDER BY p.created_at::date
    `
    : await sql`
      SELECT date::text, topic, topic_label, post_count, total_likes, total_retweets
      FROM topic_engagement_daily
      WHERE topic = ${topicId}
        AND (${from}::date IS NULL OR date >= ${from}::date)
        AND (${to}::date IS NULL OR date <= ${to}::date)
      ORDER BY date
    `;
  return envelope(rows, hasLiveFilters ? 'posts + legislators' : 'topic_engagement_daily', { ...q, topicId, state, party, from, to });
});

app.get('/api/v1/topics/:topicId/state-salience', async (request) => {
  const topicId = normalizedTopic((request.params as { topicId: string }).topicId) ?? '999';
  const q = request.query as Query;
  const state = q.state?.toUpperCase() ?? null;
  const party = q.party === 'Democratic' || q.party === 'Republican' ? q.party : null;
  const from = q.from ?? null;
  const to = q.to ?? null;
  const hasLiveFilters = Boolean(state || party || from || to);
  const rows = hasLiveFilters
    ? await sql`
      WITH represented_legislators AS (
        SELECT state, count(DISTINCT lid)::int AS legislator_count,
               count(DISTINCT lid) FILTER (WHERE party = 'Democratic')::int AS democratic_legislator_count,
               count(DISTINCT lid) FILTER (WHERE party = 'Republican')::int AS republican_legislator_count
        FROM legislators
        WHERE state IS NOT NULL
          AND (${state}::text IS NULL OR state = ${state})
          AND (${party}::text IS NULL OR party = ${party})
        GROUP BY state
      )
      SELECT l.state, p.topic, t.topic_label,
             count(*)::bigint AS post_count,
             COALESCE(sum(p.like_count), 0)::bigint AS total_likes,
             COALESCE(sum(p.retweet_count), 0)::bigint AS total_retweets,
             represented_legislators.legislator_count,
             represented_legislators.democratic_legislator_count,
             represented_legislators.republican_legislator_count,
             count(*) FILTER (WHERE l.party = 'Democratic')::bigint AS democratic_post_count,
             count(*) FILTER (WHERE l.party = 'Republican')::bigint AS republican_post_count
      FROM posts p
      JOIN topics t ON t.topic = p.topic
      JOIN legislators l ON l.lid = p.lid
      LEFT JOIN represented_legislators ON represented_legislators.state = l.state
      WHERE p.topic = ${topicId}
        AND l.state IS NOT NULL
        AND (${state}::text IS NULL OR l.state = ${state})
        AND (${party}::text IS NULL OR l.party = ${party})
        AND (${from}::date IS NULL OR p.created_at >= ${from}::date)
        AND (${to}::date IS NULL OR p.created_at < ${to}::date + 1)
      GROUP BY l.state, p.topic, t.topic_label,
               represented_legislators.legislator_count,
               represented_legislators.democratic_legislator_count,
               represented_legislators.republican_legislator_count
      ORDER BY l.state
    `
    : await sql`
      WITH represented_legislators AS (
        SELECT state, count(DISTINCT lid)::int AS legislator_count,
               count(DISTINCT lid) FILTER (WHERE party = 'Democratic')::int AS democratic_legislator_count,
               count(DISTINCT lid) FILTER (WHERE party = 'Republican')::int AS republican_legislator_count
        FROM app_legislator_summary
        WHERE state IS NOT NULL
        GROUP BY state
      ), party_activity AS (
        SELECT legislators.state,
               sum(app_legislator_topic.post_count) FILTER (WHERE legislators.party = 'Democratic')::bigint AS democratic_post_count,
               sum(app_legislator_topic.post_count) FILTER (WHERE legislators.party = 'Republican')::bigint AS republican_post_count
        FROM app_legislator_topic
        JOIN legislators USING (lid)
        WHERE app_legislator_topic.topic = ${topicId}
        GROUP BY legislators.state
      )
      SELECT breakdown.state, breakdown.topic, breakdown.topic_label,
             breakdown.post_count, breakdown.total_likes, breakdown.total_retweets,
             represented_legislators.legislator_count,
             represented_legislators.democratic_legislator_count,
             represented_legislators.republican_legislator_count,
             party_activity.democratic_post_count,
             party_activity.republican_post_count
      FROM topic_state_breakdown AS breakdown
      LEFT JOIN represented_legislators USING (state)
      LEFT JOIN party_activity USING (state)
      WHERE breakdown.topic = ${topicId}
      ORDER BY breakdown.state
    `;
  return envelope(rows, hasLiveFilters ? 'posts + legislators' : 'topic_state_breakdown', { ...q, topicId, state, party, from, to });
});

app.get('/api/v1/topics/:topicId/party-chamber', async (request) => {
  const topicId = normalizedTopic((request.params as { topicId: string }).topicId) ?? '999';
  const q = request.query as Query;
  const state = q.state?.toUpperCase() ?? null;
  const party = q.party === 'Democratic' || q.party === 'Republican' ? q.party : null;
  const from = q.from ?? null;
  const to = q.to ?? null;
  const hasLiveFilters = Boolean(state || party || from || to);
  const rows = hasLiveFilters
    ? await sql`
      SELECT l.party, l.chamber, count(*)::bigint AS post_count,
             COALESCE(sum(p.like_count), 0)::bigint AS total_likes,
             COALESCE(sum(p.retweet_count), 0)::bigint AS total_retweets
      FROM posts p
      JOIN legislators l ON l.lid = p.lid
      WHERE p.topic = ${topicId}
        AND (${state}::text IS NULL OR l.state = ${state})
        AND (${party}::text IS NULL OR l.party = ${party})
        AND (${from}::date IS NULL OR p.created_at >= ${from}::date)
        AND (${to}::date IS NULL OR p.created_at < ${to}::date + 1)
      GROUP BY l.party, l.chamber
      ORDER BY l.party, l.chamber
    `
    : await sql`
      SELECT party, chamber, post_count, total_likes, total_retweets
      FROM app_topic_party_chamber
      WHERE topic = ${topicId}
      ORDER BY party, chamber
    `;
  return envelope(rows, hasLiveFilters ? 'posts + legislators' : 'app_topic_party_chamber', { ...q, topicId, state, party, from, to });
});

app.get('/api/v1/topics/:topicId/beeswarm', async (request) => {
  const topicId = normalizedTopic((request.params as { topicId: string }).topicId) ?? '999';
  const q = request.query as Query;
  const state = q.state?.toUpperCase() ?? null;
  const party = q.party === 'Democratic' || q.party === 'Republican' ? q.party : null;
  const rows = await sql`
    SELECT l.lid, l.name, l.handle, l.state, l.party, l.chamber, l.mrp_ideology,
           COALESCE(alt.post_count, 0)::bigint AS topic_posts,
           als.total_posts
    FROM legislators l
    JOIN app_legislator_summary als ON als.lid = l.lid
    LEFT JOIN app_legislator_topic alt ON alt.lid = l.lid AND alt.topic = ${topicId}
    WHERE l.mrp_ideology IS NOT NULL
      AND (${state}::text IS NULL OR l.state = ${state})
      AND (${party}::text IS NULL OR l.party = ${party})
    ORDER BY l.mrp_ideology
  `;
  return envelope(rows.map((row) => ({
    lid: s(row.lid),
    name: titleCasePersonName(s(row.name)),
    handle: s(row.handle),
    state: s(row.state),
    party: s(row.party),
    chamber: s(row.chamber),
    mrpIdeology: Number(row.mrp_ideology),
    topicPosts: n(row.topic_posts),
    share: n(row.topic_posts) / Math.max(n(row.total_posts), 1)
  })), 'app_legislator_topic', { ...q, topicId, state, party }, { includedCount: rows.length });
});

app.get('/api/v1/topics/:topicId/adjacent', async (request) => {
  const topicId = normalizedTopic((request.params as { topicId: string }).topicId) ?? '999';
  const q = request.query as Query;
  const state = q.state?.toUpperCase() ?? null;
  const party = q.party === 'Democratic' || q.party === 'Republican' ? q.party : null;
  const from = q.from ?? null;
  const to = q.to ?? null;
  const hasLiveFilters = Boolean(state || party || from || to);
  const rows = hasLiveFilters
    ? from || to
      ? await sql`
      SELECT p.topic, t.topic_label, count(*)::bigint AS post_count
      FROM posts p
      JOIN topics t ON t.topic = p.topic
      JOIN legislators l ON l.lid = p.lid
      WHERE p.topic <> ${topicId}
        AND (${state}::text IS NULL OR l.state = ${state})
        AND (${party}::text IS NULL OR l.party = ${party})
        AND (${from}::date IS NULL OR p.created_at >= ${from}::date)
        AND (${to}::date IS NULL OR p.created_at < ${to}::date + 1)
      GROUP BY p.topic, t.topic_label
      ORDER BY count(*) DESC
      LIMIT 8
    `
      : await sql`
      SELECT alt.topic, alt.topic_label, sum(alt.post_count)::bigint AS post_count
      FROM app_legislator_topic alt
      JOIN legislators l USING (lid)
      WHERE alt.topic <> ${topicId}
        AND (${state}::text IS NULL OR l.state = ${state})
        AND (${party}::text IS NULL OR l.party = ${party})
      GROUP BY alt.topic, alt.topic_label
      ORDER BY sum(alt.post_count) DESC
      LIMIT 8
    `
    : await sql`
      SELECT topic, topic_label, sum(post_count)::bigint AS post_count
      FROM topic_party_breakdown
      WHERE topic <> ${topicId}
      GROUP BY topic, topic_label
      ORDER BY sum(post_count) DESC
      LIMIT 8
    `;
  return envelope(rows, hasLiveFilters ? 'posts + legislators' : 'topic_party_breakdown', { ...q, topicId, state, party, from, to });
});

app.get('/api/v1/topics/:topicId/top-posts', async (request) => {
  const topicId = normalizedTopic((request.params as { topicId: string }).topicId) ?? '999';
  const q = request.query as Query;
  const limit = clampLimit(q.limit, 10, 25);
  const state = q.state?.toUpperCase() ?? null;
  const party = q.party ?? null;
  const from = q.from ?? null;
  const to = q.to ?? null;
  const rows = await sql`
    SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
    FROM app_posts_canonical p
    JOIN topics t ON t.topic = p.topic
    JOIN legislators l ON l.lid = p.lid
    WHERE p.topic = ${topicId}
      AND (${state}::text IS NULL OR l.state = ${state})
      AND (${party}::text IS NULL OR l.party = ${party})
      AND (${from}::date IS NULL OR p.created_at >= ${from}::date)
      AND (${to}::date IS NULL OR p.created_at <= ${to}::date)
    ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
    LIMIT ${limit}
  `;
  return envelope(rows.map(postRow), 'posts', { ...q, topicId, limit });
});

app.get('/api/v1/states', async (request) => {
  const q = request.query as Query;
  const topic = q.topic ? (normalizedTopic(String(q.topic)) ?? null) : null;
  const rows = await sql`
    WITH activity AS (
      SELECT state, sum(post_count)::bigint AS post_count,
             sum(total_likes)::bigint AS total_likes,
             sum(total_retweets)::bigint AS total_retweets
      FROM topic_state_breakdown
      WHERE (${topic}::text IS NULL OR topic = ${topic})
      GROUP BY state
    ), represented_legislators AS (
      SELECT state, count(DISTINCT lid)::int AS legislator_count,
             count(DISTINCT lid) FILTER (WHERE party = 'Democratic')::int AS democratic_legislator_count,
             count(DISTINCT lid) FILTER (WHERE party = 'Republican')::int AS republican_legislator_count
      FROM app_legislator_summary
      WHERE state IS NOT NULL
      GROUP BY state
    ), party_activity AS (
      SELECT legislators.state,
             sum(app_legislator_topic.post_count) FILTER (WHERE legislators.party = 'Democratic')::bigint AS democratic_post_count,
             sum(app_legislator_topic.post_count) FILTER (WHERE legislators.party = 'Republican')::bigint AS republican_post_count
      FROM app_legislator_topic
      JOIN legislators USING (lid)
      WHERE (${topic}::text IS NULL OR app_legislator_topic.topic = ${topic})
      GROUP BY legislators.state
    )
    SELECT activity.*, represented_legislators.legislator_count,
           represented_legislators.democratic_legislator_count,
           represented_legislators.republican_legislator_count,
           party_activity.democratic_post_count,
           party_activity.republican_post_count
    FROM activity
    LEFT JOIN represented_legislators USING (state)
    LEFT JOIN party_activity USING (state)
    ORDER BY state
  `;
  return envelope(rows.map((row) => ({
    state: s(row.state),
    stateName: stateName(String(row.state)),
    postCount: n(row.post_count),
    legislatorCount: n(row.legislator_count),
    democraticLegislatorCount: n(row.democratic_legislator_count),
    republicanLegislatorCount: n(row.republican_legislator_count),
    democraticPostCount: n(row.democratic_post_count),
    republicanPostCount: n(row.republican_post_count),
    totalEngagement: n(row.total_likes) + n(row.total_retweets)
  })), 'topic_state_breakdown', { topic });
});

app.get('/api/v1/states/small-multiples', async () => {
  const rows = await sql`
    SELECT state, topic, topic_label, post_count
    FROM topic_state_breakdown
    ORDER BY state, CASE WHEN topic = '999' THEN 999 ELSE topic::int END
  `;
  return envelope(rows, 'topic_state_breakdown');
});

app.get('/api/v1/states/:state', async (request) => {
  const state = (request.params as { state: string }).state.toUpperCase();
  const q = request.query as Query;
  const topic = normalizedTopic(q.topic);
  const party = q.party === 'Democratic' || q.party === 'Republican' ? q.party : null;
  const [summary] = await sql`
    SELECT l.state, count(DISTINCT l.lid)::int AS legislators,
           count(DISTINCT l.lid) FILTER (WHERE l.party = 'Democratic')::int AS democratic,
           count(DISTINCT l.lid) FILTER (WHERE l.party = 'Republican')::int AS republican,
           count(DISTINCT l.lid) FILTER (WHERE l.party = 'Independent')::int AS independent,
           sum(alt.post_count)::bigint AS posts, 0::bigint AS engagement
    FROM app_legislator_topic alt
    JOIN legislators l USING (lid)
    WHERE l.state = ${state}
      AND (${topic ?? null}::text IS NULL OR alt.topic = ${topic ?? null})
      AND (${party}::text IS NULL OR l.party = ${party})
    GROUP BY l.state
  `;
  return envelope({ ...summary, stateName: stateName(state) }, 'app_legislator_topic + legislators', { state, topic, party });
});

app.get('/api/v1/states/:state/topics', async (request) => {
  const state = (request.params as { state: string }).state.toUpperCase();
  const q = request.query as Query;
  const topic = normalizedTopic(q.topic);
  const party = q.party === 'Democratic' || q.party === 'Republican' ? q.party : null;
  const rows = await sql`
    SELECT alt.topic, alt.topic_label, sum(alt.post_count)::bigint AS post_count,
           0::bigint AS total_likes, 0::bigint AS total_retweets
    FROM app_legislator_topic alt
    JOIN legislators l USING (lid)
    WHERE l.state = ${state}
      AND (${topic ?? null}::text IS NULL OR alt.topic = ${topic ?? null})
      AND (${party}::text IS NULL OR l.party = ${party})
    GROUP BY alt.topic, alt.topic_label
    ORDER BY sum(alt.post_count) DESC
  `;
  return envelope(rows, 'app_legislator_topic + legislators', { state, topic, party });
});

app.get('/api/v1/states/:state/trend', async (request) => {
  const state = (request.params as { state: string }).state.toUpperCase();
  const q = request.query as Query;
  const topic = normalizedTopic(q.topic);
  const party = q.party === 'Democratic' || q.party === 'Republican' ? q.party : null;
  const from = q.from ?? null;
  const to = q.to ?? null;
  const rows = await sql`
    SELECT date_trunc('month', p.created_at)::date AS month, l.party, count(*)::bigint AS post_count
    FROM posts p
    JOIN legislators l ON l.lid = p.lid
    WHERE l.state = ${state}
      AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
      AND (${party}::text IS NULL OR l.party = ${party})
      AND (${from}::date IS NULL OR p.created_at >= ${from}::date)
      AND (${to}::date IS NULL OR p.created_at <= ${to}::date)
    GROUP BY 1, l.party
    ORDER BY 1, l.party
  `;
  return envelope(rows, 'posts + legislators', { state, topic, party });
});

app.get('/api/v1/states/:state/top-posts', async (request) => {
  const state = (request.params as { state: string }).state.toUpperCase();
  const q = request.query as Query;
  const topic = normalizedTopic(q.topic);
  const limit = clampLimit(q.limit, 10, 25);
  return envelope(
    await topPostsForState(state, limit, { topic, party: q.party ?? null, from: q.from ?? null, to: q.to ?? null }),
    'posts + legislators',
    { ...q, state, limit }
  );
});

app.get('/api/v1/events', async () => envelope(events, 'events.ts'));

app.get('/api/v1/moments/overview', async () => {
  const hasCanonicalDaily = await hasCanonicalDailyAggregate();
  const rows = hasCanonicalDaily
    ? await sql`
      SELECT date::text, topic, topic_label, post_count, total_likes, total_retweets
      FROM app_topic_engagement_daily_canonical
      WHERE date BETWEEN '2020-01-01'::date AND '2025-01-04'::date
      ORDER BY date
    `
    : await sql`
      SELECT date::text, topic, topic_label, post_count, total_likes, total_retweets
      FROM topic_engagement_daily
      WHERE date BETWEEN '2020-01-01'::date AND '2025-01-04'::date
      ORDER BY date
    `;
  const weeks = new Map<string, { date: string; post_count: number; engagement: number }>();
  const topicTotals = new Map<string, { topic: string; topic_label: string; post_count: number }>();
  const eventTotals = new Map<string, Map<string, { topic: string; topicLabel: string; postCount: number }>>();

  for (const event of events) eventTotals.set(event.eventId, new Map());
  for (const row of rows) {
    const date = s(row.date) ?? '';
    const parsed = new Date(`${date}T00:00:00Z`);
    const day = parsed.getUTCDay();
    parsed.setUTCDate(parsed.getUTCDate() - (day === 0 ? 6 : day - 1));
    const week = parsed.toISOString().slice(0, 10);
    const weekly = weeks.get(week) ?? { date: week, post_count: 0, engagement: 0 };
    weekly.post_count += n(row.post_count);
    weekly.engagement += n(row.total_likes) + n(row.total_retweets);
    weeks.set(week, weekly);

    const topic = s(row.topic) ?? '';
    const total = topicTotals.get(topic) ?? { topic, topic_label: s(row.topic_label) ?? '', post_count: 0 };
    total.post_count += n(row.post_count);
    topicTotals.set(topic, total);

    for (const event of events) {
      const end = event.endDate ?? event.startDate;
      if (date < event.startDate || date > end) continue;
      const byTopic = eventTotals.get(event.eventId)!;
      const rawTopicLabel = s(row.topic_label) ?? '';
      const topicLabel = rawTopicLabel === 'Unknown Topic (999)' ? 'Uncategorized' : rawTopicLabel;
      const current = byTopic.get(topic) ?? { topic, topicLabel, postCount: 0 };
      current.postCount += n(row.post_count);
      byTopic.set(topic, current);
    }
  }

  const eventTopics = Object.fromEntries(events.map((event) => [
    event.eventId,
    [...(eventTotals.get(event.eventId)?.values() ?? [])].filter((topic) => topic.topic !== '999').sort((a, b) => b.postCount - a.postCount).slice(0, 3)
  ]));

  return envelope({
    daily: [...weeks.values()],
    topics: [...topicTotals.values()].sort((a, b) => b.post_count - a.post_count),
    eventTopics
  }, hasCanonicalDaily ? 'app_topic_engagement_daily_canonical + events.ts' : 'topic_engagement_daily + events.ts', {
    bucket: 'week',
    dedupe: hasCanonicalDaily ? 'canonical_posts' : 'raw_daily_fallback'
  });
});

app.get('/api/v1/moments/window', async (request) => {
  const q = request.query as Query;
  const date = q.date ?? '2022-06-24';
  const width = Math.min(Math.max(Number(q.width ?? 7), 1), 45);
  const from = q.from ?? null;
  const to = q.to ?? null;
  const topic = normalizedTopic(q.topic);
  const state = q.state?.toUpperCase() ?? null;
  const party = q.party ?? null;
  const hasCanonicalDaily = await hasCanonicalDailyAggregate();
  const usePrecomputedDaily = !state && !party;
  const rows = usePrecomputedDaily
    ? await sql`
      SELECT topic, topic_label,
             sum(post_count)::bigint AS post_count,
             sum(total_likes)::bigint AS total_likes,
             sum(total_retweets)::bigint AS total_retweets
      FROM ${hasCanonicalDaily ? sql`app_topic_engagement_daily_canonical` : sql`topic_engagement_daily`}
      WHERE date >= COALESCE(${from}::date, ${date}::date - ${width}::int)
        AND date < COALESCE(${to}::date + 1, ${date}::date + ${width}::int + 1)
        AND (${topic ?? null}::text IS NULL OR topic = ${topic ?? null})
      GROUP BY topic, topic_label
      ORDER BY sum(post_count) DESC
    `
    : await sql`
      SELECT p.topic, t.topic_label, count(*)::bigint AS post_count,
             sum(p.like_count)::bigint AS total_likes,
             sum(p.retweet_count)::bigint AS total_retweets
      FROM app_posts_canonical p
      JOIN topics t ON t.topic = p.topic
      JOIN legislators l ON l.lid = p.lid
      WHERE p.created_at >= COALESCE(${from}::date, ${date}::date - ${width}::int)
        AND p.created_at < COALESCE(${to}::date + 1, ${date}::date + ${width}::int + 1)
        AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
        AND (${state}::text IS NULL OR l.state = ${state})
        AND (${party}::text IS NULL OR l.party = ${party})
      GROUP BY p.topic, t.topic_label
      ORDER BY count(*) DESC
    `;
  return envelope(
    rows,
    usePrecomputedDaily
      ? hasCanonicalDaily
        ? 'app_topic_engagement_daily_canonical'
        : 'topic_engagement_daily'
      : 'app_posts_canonical + legislators',
    {
      date,
      width,
      from,
      to,
      topic,
      state,
      party,
      dedupe: hasCanonicalDaily || !usePrecomputedDaily ? 'canonical_posts' : 'raw_daily_fallback'
    }
  );
});

app.get('/api/v1/moments/window/daily', async (request) => {
  const q = request.query as Query;
  const date = q.date ?? '2022-06-24';
  const width = Math.min(Math.max(Number(q.width ?? 7), 1), 45);
  const from = q.from ?? null;
  const to = q.to ?? null;
  const topic = normalizedTopic(q.topic);
  const state = q.state?.toUpperCase() ?? null;
  const party = q.party ?? null;
  const bucket = q.bucket === 'month' ? 'month' : q.bucket === 'week' ? 'week' : 'day';
  const hasCanonicalDaily = await hasCanonicalDailyAggregate();
  const usePrecomputedDaily = !state && !party;
  const rows = usePrecomputedDaily
    ? await sql`
      WITH filtered AS (
        SELECT CASE
                 WHEN ${bucket}::text = 'month' THEN date_trunc('month', date::timestamp)::date
                 WHEN ${bucket}::text = 'week' THEN date_trunc('week', date::timestamp)::date
                 ELSE date
               END AS bucket_start,
               post_count,
               total_likes,
               total_retweets
        FROM ${hasCanonicalDaily ? sql`app_topic_engagement_daily_canonical` : sql`topic_engagement_daily`}
        WHERE date >= COALESCE(${from}::date, ${date}::date - ${width}::int)
          AND date < COALESCE(${to}::date + 1, ${date}::date + ${width}::int + 1)
          AND (${topic ?? null}::text IS NULL OR topic = ${topic ?? null})
      )
      SELECT bucket_start::text AS date,
             COALESCE(sum(post_count), 0)::bigint AS post_count,
             COALESCE(sum(total_likes + total_retweets), 0)::bigint AS engagement
      FROM filtered
      GROUP BY bucket_start
      ORDER BY bucket_start
    `
    : await sql`
      WITH filtered AS (
        SELECT CASE
                 WHEN ${bucket}::text = 'month' THEN date_trunc('month', p.created_at::timestamp)::date
                 WHEN ${bucket}::text = 'week' THEN date_trunc('week', p.created_at::timestamp)::date
                 ELSE p.created_at::date
               END AS bucket_start,
               p.like_count, p.retweet_count
        FROM app_posts_canonical p JOIN legislators l ON l.lid = p.lid
        WHERE p.created_at >= COALESCE(${from}::date, ${date}::date - ${width}::int)
          AND p.created_at < COALESCE(${to}::date + 1, ${date}::date + ${width}::int + 1)
          AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
          AND (${state}::text IS NULL OR l.state = ${state})
          AND (${party}::text IS NULL OR l.party = ${party})
      )
      SELECT bucket_start::text AS date, count(*)::bigint AS post_count,
             COALESCE(sum(like_count + retweet_count), 0)::bigint AS engagement
      FROM filtered GROUP BY bucket_start ORDER BY bucket_start
    `;
  return envelope(
    rows,
    usePrecomputedDaily
      ? hasCanonicalDaily
        ? 'app_topic_engagement_daily_canonical'
        : 'topic_engagement_daily'
      : 'app_posts_canonical + legislators',
    {
      date,
      width,
      from,
      to,
      topic,
      state,
      party,
      bucket,
      dedupe: hasCanonicalDaily || !usePrecomputedDaily ? 'canonical_posts' : 'raw_daily_fallback'
    }
  );
});

app.get('/api/v1/moments/window/top-posts', async (request) => {
  const q = request.query as Query;
  const date = q.date ?? '2022-06-24';
  const width = Math.min(Math.max(Number(q.width ?? 7), 1), 45);
  const limit = clampLimit(q.limit, 10, 25);
  const candidateLimit = Math.min(Math.max(limit * 60, 240), 600);
  const sharerLimit = 80;
  const from = q.from ?? null;
  const to = q.to ?? null;
  const topic = normalizedTopic(q.topic);
  const state = q.state?.toUpperCase() ?? null;
  const party = q.party ?? null;
  const candidateRows = await sql`
    SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
    FROM app_posts_canonical p
    JOIN topics t ON t.topic = p.topic
    JOIN legislators l ON l.lid = p.lid
    WHERE p.created_at >= COALESCE(${from}::date, ${date}::date - ${width}::int)
      AND p.created_at < COALESCE(${to}::date + 1, ${date}::date + ${width}::int + 1)
      AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
      AND (${state}::text IS NULL OR l.state = ${state})
      AND (${party}::text IS NULL OR l.party = ${party})
      AND COALESCE(btrim(p.text), '') <> ''
    ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
    LIMIT ${candidateLimit}
  `;
  const groups = new Map<
    string,
    {
      key: string;
      representative: Record<string, unknown>;
      rows: Record<string, unknown>[];
      rawTexts: Set<string>;
      peakEngagement: number;
      candidateEngagement: number;
    }
  >();

  for (const row of candidateRows) {
    const key = canonicalPostText(row.text);
    if (!key) continue;

    const engagement = n(row.like_count) + n(row.retweet_count);
    const group =
      groups.get(key) ??
      {
        key,
        representative: row,
        rows: [] as Record<string, unknown>[],
        rawTexts: new Set<string>(),
        peakEngagement: engagement,
        candidateEngagement: 0
      };

    group.rows.push(row);
    group.rawTexts.add(cleanText(row.text));
    group.candidateEngagement += engagement;

    if (
      engagement > group.peakEngagement ||
      (engagement === group.peakEngagement && n(row.id) > n(group.representative.id))
    ) {
      group.representative = row;
      group.peakEngagement = engagement;
    }

    groups.set(key, group);
  }

  const selectedGroups = [...groups.values()]
    .sort(
      (a, b) =>
        b.peakEngagement - a.peakEngagement ||
        b.candidateEngagement - a.candidateEngagement ||
        a.key.localeCompare(b.key)
    )
    .slice(0, limit);

  const selectedTexts = Array.from(
    new Set(selectedGroups.flatMap((group) => [...group.rawTexts]))
  );

  const sharerRows = selectedTexts.length
    ? await sql`
      SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
      FROM app_posts_canonical p
      JOIN topics t ON t.topic = p.topic
      JOIN legislators l ON l.lid = p.lid
      WHERE p.created_at >= COALESCE(${from}::date, ${date}::date - ${width}::int)
        AND p.created_at < COALESCE(${to}::date + 1, ${date}::date + ${width}::int + 1)
        AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
        AND (${state}::text IS NULL OR l.state = ${state})
        AND (${party}::text IS NULL OR l.party = ${party})
        AND p.text = ANY(${selectedTexts}::text[])
      ORDER BY p.text, (p.like_count + p.retweet_count) DESC, p.id DESC
    `
    : [];

  const stats = new Map<
    string,
    {
      postCount: number;
      totalLikes: number;
      totalRetweets: number;
      aggregateEngagement: number;
      sharersByLid: Map<string, Record<string, unknown>>;
    }
  >();

  for (const row of sharerRows) {
    const key = canonicalPostText(row.text);
    const current =
      stats.get(key) ??
      {
        postCount: 0,
        totalLikes: 0,
        totalRetweets: 0,
        aggregateEngagement: 0,
        sharersByLid: new Map<string, Record<string, unknown>>()
      };

    const engagement = n(row.like_count) + n(row.retweet_count);
    current.postCount += 1;
    current.totalLikes += n(row.like_count);
    current.totalRetweets += n(row.retweet_count);
    current.aggregateEngagement += engagement;

    const lid = s(row.lid) || `unknown:${n(row.id)}`;
    const existing = current.sharersByLid.get(lid);

    if (!existing || engagement > n(existing.engagement)) {
      current.sharersByLid.set(lid, { ...row, engagement });
    }

    stats.set(key, current);
  }

  const rows = selectedGroups.map((group) => {
    const stat = stats.get(group.key);
    const fallbackRows = group.rows;
    const fallbackSharers = new Map<string, Record<string, unknown>>();

    for (const row of fallbackRows) {
      const lid = s(row.lid) || `unknown:${n(row.id)}`;
      const engagement = n(row.like_count) + n(row.retweet_count);
      const existing = fallbackSharers.get(lid);
      if (!existing || engagement > n(existing.engagement)) {
        fallbackSharers.set(lid, { ...row, engagement });
      }
    }

    const sharerRowsForGroup = [
      ...(stat?.sharersByLid.values() ?? fallbackSharers.values())
    ].sort(
      (a, b) =>
        n(b.engagement) - n(a.engagement) ||
        String(s(a.name)).localeCompare(String(s(b.name)))
    );

    const postCount = stat?.postCount ?? fallbackRows.length;
    const totalLikes =
      stat?.totalLikes ??
      fallbackRows.reduce((sum, row) => sum + n(row.like_count), 0);
    const totalRetweets =
      stat?.totalRetweets ??
      fallbackRows.reduce((sum, row) => sum + n(row.retweet_count), 0);
    const aggregateEngagement =
      stat?.aggregateEngagement ??
      fallbackRows.reduce(
        (sum, row) => sum + n(row.like_count) + n(row.retweet_count),
        0
      );

    return {
      ...group.representative,
      text_key: group.key,
      candidate_count: group.rows.length,
      share_count: postCount,
      sharer_count: sharerRowsForGroup.length,
      share_total_likes: totalLikes,
      share_total_retweets: totalRetweets,
      aggregate_engagement: aggregateEngagement,
      sharers: sharerRowsForGroup.slice(0, sharerLimit).map((row) => ({
        lid: s(row.lid),
        name: s(row.name),
        handle: s(row.handle),
        state: s(row.state),
        chamber: s(row.chamber),
        party: s(row.party),
        createdAt: s(row.created_at),
        engagement: n(row.engagement)
      }))
    };
  });

  return envelope(rows.map(postRow), 'posts + legislators', {
    date,
    width,
    from,
    to,
    topic,
    state,
    party,
    limit,
    candidateLimit,
    sharerLimit,
    dedupe: 'canonical_text'
  });
});

app.get('/api/v1/posts/explore', async (request) => {
  const q = request.query as Query;
  const limit = clampLimit(q.limit, 8, 24);
  const cursor = Number(q.cursor);
  const safeCursor = Number.isFinite(cursor) && cursor > 0 ? Math.trunc(cursor) : null;
  const state = q.state?.toUpperCase() ?? null;
  const topic = normalizedTopic(q.topic);
  const party = q.party ?? null;
  const chamber = q.chamber ?? null;
  const lid = q.lid ?? null;
  const from = q.from ?? null;
  const to = q.to ?? null;
  const minEngagement = Number(q.minEngagement);
  const safeMinEngagement =
    Number.isFinite(minEngagement) && minEngagement > 0
      ? Math.trunc(minEngagement)
      : null;
  const sort = q.sort === 'engagement' ? 'engagement' : 'recent';

  const edgeSourceLid = q.edgeSourceLid ?? null;
  const edgeTargetLid = q.edgeTargetLid ?? null;
  const edgeTargetHandle = q.edgeTargetHandle ?? null;
  const edgeType =
    q.edgeType === 'mention' || q.edgeType === 'retweet' ? q.edgeType : null;
  const edgeTopic = normalizedTopic(q.edgeTopic);

  if (edgeSourceLid || edgeTargetLid || edgeTargetHandle || edgeType || edgeTopic) {
    const rows = sort === 'engagement'
      ? await sql`
        WITH edge_ids AS (
          SELECT DISTINCT COALESCE(pc.id, i.post_id) AS id
          FROM app_post_interactions i
          LEFT JOIN app_posts_canonical_map pc
            ON pc.tweet_id = i.tweet_id
           AND pc.lid = i.source_lid
          WHERE (${edgeSourceLid}::text IS NULL OR i.source_lid = ${edgeSourceLid})
            AND (${edgeTargetLid}::text IS NULL OR i.target_lid = ${edgeTargetLid})
            AND (${edgeTargetHandle}::text IS NULL OR lower(i.target_handle) = lower(${edgeTargetHandle}))
            AND (${edgeType}::text IS NULL OR i.interaction_type = ${edgeType})
            AND (${edgeTopic ?? null}::text IS NULL OR i.topic = ${edgeTopic ?? null})
        )
        SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party,
               COUNT(*) OVER()::int AS total
        FROM edge_ids e
        JOIN app_posts_canonical p ON p.id = e.id
        JOIN topics t ON t.topic = p.topic
        JOIN legislators l ON l.lid = p.lid
        WHERE (${state}::text IS NULL OR l.state = ${state})
          AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
          AND (${party}::text IS NULL OR l.party = ${party})
          AND (${chamber}::text IS NULL OR l.chamber = ${chamber})
          AND (${from}::date IS NULL OR p.created_at >= ${from}::date)
          AND (${to}::date IS NULL OR p.created_at < (${to}::date + INTERVAL '1 day'))
          AND (${safeMinEngagement}::int IS NULL OR (p.like_count + p.retweet_count) >= ${safeMinEngagement})
        ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
        LIMIT ${limit}
      `
      : await sql`
        WITH edge_ids AS (
          SELECT DISTINCT COALESCE(pc.id, i.post_id) AS id
          FROM app_post_interactions i
          LEFT JOIN app_posts_canonical_map pc
            ON pc.tweet_id = i.tweet_id
           AND pc.lid = i.source_lid
          WHERE (${edgeSourceLid}::text IS NULL OR i.source_lid = ${edgeSourceLid})
            AND (${edgeTargetLid}::text IS NULL OR i.target_lid = ${edgeTargetLid})
            AND (${edgeTargetHandle}::text IS NULL OR lower(i.target_handle) = lower(${edgeTargetHandle}))
            AND (${edgeType}::text IS NULL OR i.interaction_type = ${edgeType})
            AND (${edgeTopic ?? null}::text IS NULL OR i.topic = ${edgeTopic ?? null})
        )
        SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party,
               COUNT(*) OVER()::int AS total
        FROM edge_ids e
        JOIN app_posts_canonical p ON p.id = e.id
        JOIN topics t ON t.topic = p.topic
        JOIN legislators l ON l.lid = p.lid
        WHERE (${safeCursor}::bigint IS NULL OR p.id < ${safeCursor})
          AND (${state}::text IS NULL OR l.state = ${state})
          AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
          AND (${party}::text IS NULL OR l.party = ${party})
          AND (${chamber}::text IS NULL OR l.chamber = ${chamber})
          AND (${from}::date IS NULL OR p.created_at >= ${from}::date)
          AND (${to}::date IS NULL OR p.created_at < (${to}::date + INTERVAL '1 day'))
          AND (${safeMinEngagement}::int IS NULL OR (p.like_count + p.retweet_count) >= ${safeMinEngagement})
        ORDER BY p.id DESC
        LIMIT ${limit}
      `;

    return envelope(
      rows.map(postRow),
      'app_post_interactions + app_posts_canonical + legislators',
      { ...q, limit, sort, edgeSourceLid, edgeTargetLid, edgeTargetHandle, edgeType, edgeTopic },
      {
        nextCursor: sort === 'recent' && rows.length === limit ? rows.at(-1)?.id ?? null : null,
        total: rows.length ? n(rows[0].total) : 0,
        totalKind: 'unique_canonical_posts'
      }
    );
  }

  const rows = from || to
    ? await sql`
      SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
      FROM app_posts_canonical p
      JOIN topics t ON t.topic = p.topic
      JOIN legislators l ON l.lid = p.lid
      WHERE (${safeCursor}::bigint IS NULL OR p.id < ${safeCursor})
        AND (${lid}::text IS NULL OR p.lid = ${lid})
        AND (${state}::text IS NULL OR l.state = ${state})
        AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
        AND (${party}::text IS NULL OR l.party = ${party})
        AND (${chamber}::text IS NULL OR l.chamber = ${chamber})
        AND (${from}::date IS NULL OR p.created_at >= ${from}::date)
        AND (${to}::date IS NULL OR p.created_at < (${to}::date + INTERVAL '1 day'))
        AND (${safeMinEngagement}::int IS NULL OR (p.like_count + p.retweet_count) >= ${safeMinEngagement})
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ${limit}
    `
    : sort === 'engagement'
      ? await sql`
        SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
        FROM app_posts_canonical p
        JOIN topics t ON t.topic = p.topic
        JOIN legislators l ON l.lid = p.lid
        WHERE (${lid}::text IS NULL OR p.lid = ${lid})
          AND (${state}::text IS NULL OR l.state = ${state})
          AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
          AND (${party}::text IS NULL OR l.party = ${party})
          AND (${chamber}::text IS NULL OR l.chamber = ${chamber})
          AND (${safeMinEngagement}::int IS NULL OR (p.like_count + p.retweet_count) >= ${safeMinEngagement})
        ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
        LIMIT ${limit}
      `
    : await sql`
      SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
      FROM app_posts_canonical p
      JOIN topics t ON t.topic = p.topic
      JOIN legislators l ON l.lid = p.lid
      WHERE (${safeCursor}::bigint IS NULL OR p.id < ${safeCursor})
        AND (${lid}::text IS NULL OR p.lid = ${lid})
        AND (${state}::text IS NULL OR l.state = ${state})
        AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
        AND (${party}::text IS NULL OR l.party = ${party})
        AND (${chamber}::text IS NULL OR l.chamber = ${chamber})
        AND (${safeMinEngagement}::int IS NULL OR (p.like_count + p.retweet_count) >= ${safeMinEngagement})
      ORDER BY p.id DESC
      LIMIT ${limit}
    `;
  return envelope(
    rows.map(postRow),
    'posts + legislators',
    { ...q, limit, sort },
    { nextCursor: sort === 'recent' && rows.length === limit ? rows.at(-1)?.id ?? null : null }
  );
});

app.get('/api/v1/sampler', async (request) => {
  const q = request.query as Query;
  const seed = q.seed ?? String(Date.now());
  const limit = clampLimit(q.n, 6, 12);
  const anchor = stableAnchor(seed, await maxPostId());
  const topic = normalizedTopic(q.topic);
  const state = q.state?.toUpperCase() ?? null;
  const party = q.party ?? null;
  const chamber = q.chamber ?? null;
  const lid = q.lid ?? null;
  const from = q.from ?? null;
  const to = q.to ?? null;
  const minEngagement = Number(q.minEngagement);
  const safeMinEngagement =
    Number.isFinite(minEngagement) && minEngagement > 0
      ? Math.trunc(minEngagement)
      : null;
  const rows = await sql`
    SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
    FROM app_posts_canonical p
    JOIN topics t ON t.topic = p.topic
    JOIN legislators l ON l.lid = p.lid
    WHERE p.id >= ${anchor}
      AND (${lid}::text IS NULL OR p.lid = ${lid})
      AND (${state}::text IS NULL OR l.state = ${state})
      AND (${party}::text IS NULL OR l.party = ${party})
      AND (${chamber}::text IS NULL OR l.chamber = ${chamber})
      AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
      AND (${from}::date IS NULL OR p.created_at >= ${from}::date)
      AND (${to}::date IS NULL OR p.created_at < (${to}::date + INTERVAL '1 day'))
      AND (${safeMinEngagement}::int IS NULL OR (p.like_count + p.retweet_count) >= ${safeMinEngagement})
    ORDER BY p.id
    LIMIT ${limit}
  `;
  return envelope(rows.map(postRow), 'posts', { ...q, seed, n: limit }, { sampling: 'deterministic id anchor, no ORDER BY random()' });
});

app.get('/api/v1/compare', async (request) => {
  const slots = ((request.query as Query).slots ?? '').split(',').map((slot) => slot.trim()).filter(Boolean).slice(0, 4);
  const results = [];
  for (const slot of slots) {
    const [kind, id] = slot.split(':');
    if (kind === 'legislator' && id) {
      const [summary] = await sql`
        SELECT lid, name, handle, state, party, chamber, total_posts, total_likes, total_retweets
        FROM app_legislator_summary
        WHERE lid = ${id}
      `;
      const topicMix = await sql`
        SELECT topic, topic_label, post_count
        FROM app_legislator_topic
        WHERE lid = ${id}
        ORDER BY post_count DESC
        LIMIT 22
      `;
      results.push({
        kind,
        id,
        label: titleCasePersonName(s(summary?.name)) ?? id,
        href: `/who/${id}`,
        metrics: {
          posts: n(summary?.total_posts),
          engagement: n(summary?.total_likes) + n(summary?.total_retweets),
          party: s(summary?.party),
          state: s(summary?.state)
        },
        topicMix: topicMix.map((row) => ({ topic: s(row.topic), topicLabel: s(row.topic_label), postCount: n(row.post_count) })),
        topPosts: await topPostsForLegislator(id, 3)
      });
    } else if (kind === 'state' && id) {
      const state = id.toUpperCase();
      const [summary] = await sql`
        SELECT ${state}::text AS state,
               sum(post_count)::bigint AS posts,
               sum(total_likes)::bigint AS total_likes,
               sum(total_retweets)::bigint AS total_retweets
        FROM topic_state_breakdown
        WHERE state = ${state}
      `;
      const topicMix = await sql`
        SELECT topic, topic_label, post_count
        FROM topic_state_breakdown
        WHERE state = ${state}
        ORDER BY post_count DESC
        LIMIT 22
      `;
      results.push({
        kind,
        id: state,
        label: stateName(state),
        href: `/place/${state}`,
        metrics: {
          posts: n(summary?.posts),
          engagement: n(summary?.total_likes) + n(summary?.total_retweets),
          state
        },
        topicMix: topicMix.map((row) => ({ topic: s(row.topic), topicLabel: s(row.topic_label), postCount: n(row.post_count) })),
        topPosts: await topPostsForState(state, 3)
      });
    } else if (kind === 'topic' && id) {
      const topicId = normalizedTopic(id) ?? '999';
      const [summary] = await sql`
        SELECT topic, topic_label,
               sum(post_count)::bigint AS posts,
               sum(total_likes)::bigint AS total_likes,
               sum(total_retweets)::bigint AS total_retweets
        FROM topic_party_breakdown
        WHERE topic = ${topicId}
        GROUP BY topic, topic_label
      `;
      const topicMix = await sql`
        SELECT party AS topic, party AS topic_label, post_count
        FROM topic_party_breakdown
        WHERE topic = ${topicId}
        ORDER BY post_count DESC
      `;
      results.push({
        kind,
        id: topicId,
        label: s(summary?.topic_label) === 'Unknown Topic (999)' ? 'Uncategorized' : s(summary?.topic_label),
        href: `/topic/${topicId}`,
        metrics: {
          posts: n(summary?.posts),
          engagement: n(summary?.total_likes) + n(summary?.total_retweets)
        },
        topicMix: topicMix.map((row) => ({ topic: s(row.topic), topicLabel: s(row.topic_label), postCount: n(row.post_count) })),
        topPosts: await topPostsForTopic(topicId, 3)
      });
    }
  }
  return envelope(results, 'compare', { slots });
});

app.post('/api/v1/exports/permalink', async (request) => {
  const body = (request.body ?? {}) as { url?: string };
  const url = new URL(body.url ?? '/', 'http://localhost');
  url.searchParams.sort();
  return envelope({ permalink: `${url.pathname}${url.search}` }, 'url');
});

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvLines(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return ['value'];
  const columns = Object.keys(rows[0]);
  return [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))];
}

async function exportRows(spec: ExportSpec) {
  const chart = spec.chart ?? 'topics';
  const filters = spec.filters ?? {};
  const limit = clampLimit(spec.limit, 5000, 5000);

  if (chart === 'legislators') {
    const lid = cleanText(filters.lid) || null;
    const search = cleanText(filters.q) || null;
    const state = cleanText(filters.state).toUpperCase() || null;
    const party = cleanText(filters.party) || null;
    const chamber = cleanText(filters.chamber).toUpperCase() || null;
    const rows = await sql`
      SELECT l.lid, l.name, l.handle, l.state, l.chamber, l.party,
             l.mrp_ideology, l.shor_ideo, l.district_name, l.district_num,
             l.gender, l.race, l.yr_elected, l.vote_pct,
             ls.total_posts, ls.total_likes, ls.total_retweets,
             ls.total_replies, ls.total_quotes, ls.first_post_date, ls.last_post_date
      FROM legislators l
      LEFT JOIN app_legislator_summary ls ON ls.lid = l.lid
      WHERE (${lid}::text IS NULL OR l.lid = ${lid})
        AND (${search}::text IS NULL OR l.name ILIKE ${search ? `%${search}%` : null} OR l.handle ILIKE ${search ? `%${search}%` : null})
        AND (${state}::text IS NULL OR l.state = ${state})
        AND (${party}::text IS NULL OR l.party = ${party})
        AND (${chamber}::text IS NULL OR l.chamber = ${chamber})
      ORDER BY COALESCE(ls.total_posts, 0) DESC, l.name ASC
      LIMIT ${limit}
    `;
    return { chart, rows: rows.map((row) => ({ ...row, name: titleCasePersonName(s(row.name)) })) as Record<string, unknown>[] };
  }

  if (chart === 'legislator_posts') {
    const lid = cleanText(filters.lid);
    const topic = normalizedTopic(cleanText(filters.topic) || undefined);
    const from = cleanText(filters.from) || null;
    const to = cleanText(filters.to) || null;
    const sort = cleanText(filters.sort) === 'engagement' ? 'engagement' : 'recent';
    const rows = await sql`
      SELECT p.id, p.tweet_id, p.created_at::text, p.lid, l.name, l.handle,
             l.state, l.chamber, l.party, p.topic, t.topic_label,
             p.like_count, p.retweet_count, p.reply_count, p.quote_count,
             NULL::int AS duplicate_count, p.text
      FROM posts p
      JOIN legislators l ON l.lid = p.lid
      JOIN topics t ON t.topic = p.topic
      WHERE p.lid = ${lid}
        AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
        AND (${from}::date IS NULL OR p.created_at >= ${from}::date)
        AND (${to}::date IS NULL OR p.created_at < ${to}::date + 1)
      ORDER BY
        CASE WHEN ${sort} = 'engagement' THEN COALESCE(p.like_count, 0) + COALESCE(p.retweet_count, 0) END DESC,
        p.created_at DESC,
        p.id DESC
      LIMIT ${limit}
    `;
    return { chart, rows: rows.map((row) => ({ ...row, name: titleCasePersonName(s(row.name)) })) as Record<string, unknown>[] };
  }

  if (chart === 'states') {
    const topic = normalizedTopic(cleanText(filters.topic) || undefined);
    const party = cleanText(filters.party) || null;
    const rows = party
      ? await sql`
        WITH activity AS (
          SELECT l.state,
                 sum(alt.post_count)::bigint AS post_count
          FROM app_legislator_topic alt
          JOIN legislators l USING (lid)
          WHERE l.state IS NOT NULL
            AND l.party = ${party}
            AND (${topic ?? null}::text IS NULL OR alt.topic = ${topic ?? null})
          GROUP BY l.state
        ), represented AS (
          SELECT state,
                 count(DISTINCT lid)::int AS legislator_count,
                 count(DISTINCT lid) FILTER (WHERE party = 'Democratic')::int AS democratic_legislator_count,
                 count(DISTINCT lid) FILTER (WHERE party = 'Republican')::int AS republican_legislator_count
          FROM legislators
          WHERE state IS NOT NULL AND party = ${party}
          GROUP BY state
        )
        SELECT activity.state,
               activity.post_count,
               0::bigint AS total_likes,
               0::bigint AS total_retweets,
               represented.legislator_count,
               represented.democratic_legislator_count,
               represented.republican_legislator_count
        FROM activity
        LEFT JOIN represented USING (state)
        ORDER BY activity.state
      `
      : await sql`
      WITH activity AS (
        SELECT state,
               sum(post_count)::bigint AS post_count,
               sum(total_likes)::bigint AS total_likes,
               sum(total_retweets)::bigint AS total_retweets
        FROM topic_state_breakdown
        WHERE (${topic ?? null}::text IS NULL OR topic = ${topic ?? null})
        GROUP BY state
      ), represented AS (
        SELECT state,
               count(DISTINCT lid)::int AS legislator_count,
               count(DISTINCT lid) FILTER (WHERE party = 'Democratic')::int AS democratic_legislator_count,
               count(DISTINCT lid) FILTER (WHERE party = 'Republican')::int AS republican_legislator_count
        FROM legislators
        WHERE state IS NOT NULL
        GROUP BY state
      )
      SELECT activity.state,
             activity.post_count,
             activity.total_likes,
             activity.total_retweets,
             represented.legislator_count,
             represented.democratic_legislator_count,
             represented.republican_legislator_count
      FROM activity
      LEFT JOIN represented USING (state)
      ORDER BY activity.state
    `;
    return { chart, rows: rows as Record<string, unknown>[] };
  }

  if (chart === 'state_topics') {
    const state = cleanText(filters.state).toUpperCase() || null;
    const topic = normalizedTopic(cleanText(filters.topic) || undefined);
    const party = cleanText(filters.party) || null;
    const rows = party
      ? await sql`
        SELECT l.state, alt.topic, alt.topic_label,
               sum(alt.post_count)::bigint AS post_count,
               0::bigint AS total_likes,
               0::bigint AS total_retweets
        FROM app_legislator_topic alt
        JOIN legislators l USING (lid)
        WHERE (${state}::text IS NULL OR l.state = ${state})
          AND (${topic ?? null}::text IS NULL OR alt.topic = ${topic ?? null})
          AND l.party = ${party}
        GROUP BY l.state, alt.topic, alt.topic_label
        ORDER BY l.state, sum(alt.post_count) DESC
      `
      : await sql`
      SELECT state, topic, topic_label, post_count, total_likes, total_retweets
      FROM topic_state_breakdown
      WHERE (${state}::text IS NULL OR state = ${state})
        AND (${topic ?? null}::text IS NULL OR topic = ${topic ?? null})
      ORDER BY state, post_count DESC
    `;
    return { chart, rows: rows as Record<string, unknown>[] };
  }

  if (chart === 'state_posts') {
    const state = cleanText(filters.state).toUpperCase();
    const topic = normalizedTopic(cleanText(filters.topic) || undefined);
    const party = cleanText(filters.party) || null;
    const from = cleanText(filters.from) || null;
    const to = cleanText(filters.to) || null;
    const rows = await sql`
      SELECT p.id, p.tweet_id, p.created_at::text, p.lid, l.name, l.handle,
             l.state, l.chamber, l.party, p.topic, t.topic_label,
             p.like_count, p.retweet_count, p.reply_count, p.quote_count,
             NULL::int AS duplicate_count, p.text
      FROM posts p
      JOIN legislators l ON l.lid = p.lid
      JOIN topics t ON t.topic = p.topic
      WHERE l.state = ${state}
        AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
        AND (${party}::text IS NULL OR l.party = ${party})
        AND (${from}::date IS NULL OR p.created_at >= ${from}::date)
        AND (${to}::date IS NULL OR p.created_at < ${to}::date + 1)
      ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
      LIMIT ${limit}
    `;
    return { chart, rows: rows.map((row) => ({ ...row, name: titleCasePersonName(s(row.name)) })) as Record<string, unknown>[] };
  }

  if (chart === 'topic_daily') {
    const topic = normalizedTopic(cleanText(filters.topic) || undefined);
    const from = cleanText(filters.from) || null;
    const to = cleanText(filters.to) || null;
    const rows = await sql`
      SELECT date::text, topic, topic_label, post_count, total_likes, total_retweets
      FROM topic_engagement_daily
      WHERE (${topic ?? null}::text IS NULL OR topic = ${topic ?? null})
        AND (${from}::date IS NULL OR date >= ${from}::date)
        AND (${to}::date IS NULL OR date <= ${to}::date)
      ORDER BY date
      LIMIT ${limit}
    `;
    return { chart, rows: rows as Record<string, unknown>[] };
  }

  if (chart === 'topic_posts') {
    const topic = normalizedTopic(cleanText(filters.topic) || undefined);
    const state = cleanText(filters.state).toUpperCase() || null;
    const party = cleanText(filters.party) || null;
    const from = cleanText(filters.from) || null;
    const to = cleanText(filters.to) || null;
    const rows = await sql`
      SELECT p.id, p.tweet_id, p.created_at::text, p.lid, l.name, l.handle,
             l.state, l.chamber, l.party, p.topic, t.topic_label,
             p.like_count, p.retweet_count, p.reply_count, p.quote_count,
             NULL::int AS duplicate_count, p.text
      FROM posts p
      JOIN legislators l ON l.lid = p.lid
      JOIN topics t ON t.topic = p.topic
      WHERE (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
        AND (${state}::text IS NULL OR l.state = ${state})
        AND (${party}::text IS NULL OR l.party = ${party})
        AND (${from}::date IS NULL OR p.created_at >= ${from}::date)
        AND (${to}::date IS NULL OR p.created_at < ${to}::date + 1)
      ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
      LIMIT ${limit}
    `;
    return { chart, rows: rows.map((row) => ({ ...row, name: titleCasePersonName(s(row.name)) })) as Record<string, unknown>[] };
  }

  if (chart === 'moment_daily') {
    const date = cleanText(filters.date) || '2022-06-24';
    const width = Math.min(Math.max(Number(filters.width ?? 7), 1), 45);
    const from = cleanText(filters.from) || null;
    const to = cleanText(filters.to) || null;
    const topic = normalizedTopic(cleanText(filters.topic) || undefined);
    const state = cleanText(filters.state).toUpperCase() || null;
    const party = cleanText(filters.party) || null;
    const bucket = cleanText(filters.bucket) === 'month' ? 'month' : cleanText(filters.bucket) === 'week' ? 'week' : 'day';
    const hasCanonicalDaily = await hasCanonicalDailyAggregate();
    const rows = !state && !party
      ? await sql`
        WITH filtered AS (
          SELECT CASE
                   WHEN ${bucket}::text = 'month' THEN date_trunc('month', date::timestamp)::date
                   WHEN ${bucket}::text = 'week' THEN date_trunc('week', date::timestamp)::date
                   ELSE date
                 END AS bucket_start,
                 post_count,
                 total_likes,
                 total_retweets
          FROM ${hasCanonicalDaily ? sql`app_topic_engagement_daily_canonical` : sql`topic_engagement_daily`}
          WHERE date >= COALESCE(${from}::date, ${date}::date - ${width}::int)
            AND date < COALESCE(${to}::date + 1, ${date}::date + ${width}::int + 1)
            AND (${topic ?? null}::text IS NULL OR topic = ${topic ?? null})
        )
        SELECT bucket_start::text AS date,
               COALESCE(sum(post_count), 0)::bigint AS post_count,
               COALESCE(sum(total_likes + total_retweets), 0)::bigint AS engagement
        FROM filtered
        GROUP BY bucket_start
        ORDER BY bucket_start
        LIMIT ${limit}
      `
      : await sql`
        WITH filtered AS (
          SELECT CASE
                   WHEN ${bucket}::text = 'month' THEN date_trunc('month', p.created_at::timestamp)::date
                   WHEN ${bucket}::text = 'week' THEN date_trunc('week', p.created_at::timestamp)::date
                   ELSE p.created_at::date
                 END AS bucket_start,
                 p.like_count,
                 p.retweet_count
          FROM posts p
          JOIN legislators l ON l.lid = p.lid
          WHERE p.created_at >= COALESCE(${from}::date, ${date}::date - ${width}::int)
            AND p.created_at < COALESCE(${to}::date + 1, ${date}::date + ${width}::int + 1)
            AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
            AND (${state}::text IS NULL OR l.state = ${state})
            AND (${party}::text IS NULL OR l.party = ${party})
        )
        SELECT bucket_start::text AS date,
               count(*)::bigint AS post_count,
               COALESCE(sum(like_count + retweet_count), 0)::bigint AS engagement
        FROM filtered
        GROUP BY bucket_start
        ORDER BY bucket_start
        LIMIT ${limit}
      `;
    return { chart, rows: rows as Record<string, unknown>[] };
  }

  if (chart === 'moment_topics') {
    const date = cleanText(filters.date) || '2022-06-24';
    const width = Math.min(Math.max(Number(filters.width ?? 7), 1), 45);
    const from = cleanText(filters.from) || null;
    const to = cleanText(filters.to) || null;
    const topic = normalizedTopic(cleanText(filters.topic) || undefined);
    const state = cleanText(filters.state).toUpperCase() || null;
    const party = cleanText(filters.party) || null;
    const hasCanonicalDaily = await hasCanonicalDailyAggregate();
    const rows = !state && !party
      ? await sql`
        SELECT topic, topic_label,
               sum(post_count)::bigint AS post_count,
               sum(total_likes)::bigint AS total_likes,
               sum(total_retweets)::bigint AS total_retweets
        FROM ${hasCanonicalDaily ? sql`app_topic_engagement_daily_canonical` : sql`topic_engagement_daily`}
        WHERE date >= COALESCE(${from}::date, ${date}::date - ${width}::int)
          AND date < COALESCE(${to}::date + 1, ${date}::date + ${width}::int + 1)
          AND (${topic ?? null}::text IS NULL OR topic = ${topic ?? null})
        GROUP BY topic, topic_label
        ORDER BY sum(post_count) DESC
      `
      : await sql`
        SELECT p.topic, t.topic_label,
               count(*)::bigint AS post_count,
               COALESCE(sum(p.like_count), 0)::bigint AS total_likes,
               COALESCE(sum(p.retweet_count), 0)::bigint AS total_retweets
        FROM posts p
        JOIN legislators l ON l.lid = p.lid
        JOIN topics t ON t.topic = p.topic
        WHERE p.created_at >= COALESCE(${from}::date, ${date}::date - ${width}::int)
          AND p.created_at < COALESCE(${to}::date + 1, ${date}::date + ${width}::int + 1)
          AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
          AND (${state}::text IS NULL OR l.state = ${state})
          AND (${party}::text IS NULL OR l.party = ${party})
        GROUP BY p.topic, t.topic_label
        ORDER BY count(*) DESC
      `;
    return { chart, rows: rows as Record<string, unknown>[] };
  }

  if (chart === 'moment_posts') {
    const date = cleanText(filters.date) || '2022-06-24';
    const width = Math.min(Math.max(Number(filters.width ?? 7), 1), 45);
    const from = cleanText(filters.from) || null;
    const to = cleanText(filters.to) || null;
    const topic = normalizedTopic(cleanText(filters.topic) || undefined);
    const state = cleanText(filters.state).toUpperCase() || null;
    const party = cleanText(filters.party) || null;
    const rows = await sql`
      SELECT p.id, p.tweet_id, p.created_at::text, p.lid, l.name, l.handle,
             l.state, l.chamber, l.party, p.topic, t.topic_label,
             p.like_count, p.retweet_count, p.reply_count, p.quote_count,
             NULL::int AS duplicate_count, p.text
      FROM posts p
      JOIN legislators l ON l.lid = p.lid
      JOIN topics t ON t.topic = p.topic
      WHERE p.created_at >= COALESCE(${from}::date, ${date}::date - ${width}::int)
        AND p.created_at < COALESCE(${to}::date + 1, ${date}::date + ${width}::int + 1)
        AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
        AND (${state}::text IS NULL OR l.state = ${state})
        AND (${party}::text IS NULL OR l.party = ${party})
      ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
      LIMIT ${limit}
    `;
    return { chart, rows: rows.map((row) => ({ ...row, name: titleCasePersonName(s(row.name)) })) as Record<string, unknown>[] };
  }

  const rows = await sql`
    SELECT topic, topic_label, sum(post_count)::bigint AS post_count,
           sum(total_likes)::bigint AS total_likes,
           sum(total_retweets)::bigint AS total_retweets
    FROM topic_party_breakdown
    GROUP BY topic, topic_label
    ORDER BY post_count DESC
  `;
  return { chart: 'topics', rows: rows as Record<string, unknown>[] };
}

app.post('/api/v1/exports/csv', async (request, reply) => {
  const spec = exportSpec(request.body);
  const { chart, rows } = await exportRows(spec);
  const generatedDate = new Date().toISOString().slice(0, 10);
  const header = [
    `# CivicWatch export`,
    `# snapshot_id=${SNAPSHOT_ID}`,
    `# chart=${chart}`,
    `# filters=${JSON.stringify(spec.filters ?? {})}`,
    `# generated_at=${new Date().toISOString()}`,
  ];
  reply.header('content-type', 'text/csv; charset=utf-8');
  reply.header('content-disposition', `attachment; filename="civicwatch_${chart}_${generatedDate}.csv"`);
  return [...header, ...csvLines(rows)].join('\n');
});

app.post('/api/v1/exports/json', async (request, reply) => {
  const spec = exportSpec(request.body);
  const { chart, rows } = await exportRows(spec);
  const generatedAt = new Date().toISOString();
  const generatedDate = generatedAt.slice(0, 10);

  reply.header('content-type', 'application/json; charset=utf-8');
  reply.header('content-disposition', `attachment; filename="civicwatch_${chart}_${generatedDate}.json"`);
  return {
    snapshotId: SNAPSHOT_ID,
    chart,
    filters: spec.filters ?? {},
    requestedLimit: spec.limit ?? 5000,
    exportedRecords: rows.length,
    cap: 5000,
    generatedAt,
    rows
  };
});

app.post('/api/v1/exports/png', async (request, reply) => {
  const spec = exportSpec(request.body);
  const { chart, rows } = await exportRows(spec);
  const bars: BarDatum[] = rows.slice(0, 16).map((row) => ({
    label: String(row.topic_label ?? row.state ?? row.topic ?? ''),
    value: n(row.post_count ?? row.posts),
    color: chart === 'states' ? '#3a6c4c' : '#8a5a1a'
  }));
  const png = renderBarPng(bars);
  reply.header('content-type', 'image/png');
  reply.header('content-disposition', `attachment; filename="civicwatch_${chart}_${SNAPSHOT_ID}.png"`);
  return png;
});

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
const host = process.env.API_HOST ?? '127.0.0.1';

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  await closeDb();
  process.exit(1);
}

process.on('SIGINT', async () => {
  await app.close();
  await closeDb();
});
