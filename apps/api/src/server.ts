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
  stateName
} from './utils.js';

type Query = Record<string, string | undefined>;
type ExportSpec = {
  chart?: string;
  filters?: Record<string, unknown>;
  limit?: number;
};

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info'
  }
});

await app.register(cors, { origin: true });
await app.register(rateLimit, {
  max: 300,
  timeWindow: '1 minute'
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

function normalizedTopic(topic: string | undefined) {
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

function postRow(row: Record<string, unknown>) {
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
    legislator: {
      name: s(row.name),
      handle: s(row.handle),
      state: s(row.state),
      chamber: s(row.chamber),
      party: s(row.party)
    }
  };
}

async function maxPostId() {
  const [row] = await sql`SELECT COALESCE(max(id), 1)::bigint AS max_id FROM posts`;
  return n(row?.max_id);
}

app.get('/api/v1/health', async () => {
  const [row] = await sql`SELECT 1 AS ok`;
  return envelope({ ok: row?.ok === 1, postgres: true }, 'health');
});

app.get('/api/v1/meta', async () => {
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

  return envelope(
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
});

app.get('/api/v1/chamber', async (request) => {
  const q = request.query as Query;
  const state = q.state?.toUpperCase();
  const party = q.party;
  const chamber = q.chamber?.toUpperCase();
  const rows = await sql`
    SELECT l.lid, l.name, l.handle, l.state, l.chamber, l.party, l.mrp_ideology,
           l.shor_ideo, ls.total_posts, ls.total_likes, ls.total_retweets
    FROM app_legislator_summary ls
    JOIN legislators l ON l.lid = ls.lid
    WHERE (${state ?? null}::text IS NULL OR l.state = ${state ?? null})
      AND (${party ?? null}::text IS NULL OR l.party = ${party ?? null})
      AND (${chamber ?? null}::text IS NULL OR l.chamber = ${chamber ?? null})
    ORDER BY l.mrp_ideology NULLS LAST, l.party, l.name
  `;

  return envelope(
    rows.map((row) => ({
      lid: s(row.lid),
      name: s(row.name),
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
        name: s(row.name),
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
  const limit = clampLimit(q.limit, 50, 100);
  const search = q.q?.trim();
  const state = q.state?.toUpperCase();
  const party = q.party;
  const chamber = q.chamber?.toUpperCase();
  const sort = q.sort === 'name' ? 'name' : 'posts';

  const rows = await sql`
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
  `;

  return envelope(
    rows.map((row) => ({
      lid: s(row.lid),
      name: s(row.name),
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
    { ...q, limit }
  );
});

app.get('/api/v1/legislators/:lid', async (request, reply) => {
  const { lid } = request.params as { lid: string };
  const [row] = await sql`
    SELECT l.*, ls.total_posts, ls.total_likes, ls.total_retweets, ls.total_replies, ls.total_quotes,
           ls.first_post_date, ls.last_post_date
    FROM legislators l
    LEFT JOIN app_legislator_summary ls ON ls.lid = l.lid
    WHERE l.lid = ${lid}
  `;
  if (!row) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Legislator not found.', requestId: request.id }, meta: { snapshotId: SNAPSHOT_ID, generatedAt: new Date().toISOString() } });

  return envelope(
    {
      lid: s(row.lid),
      name: s(row.name),
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
      totalPosts: n(row.total_posts),
      totalEngagement: n(row.total_likes) + n(row.total_retweets),
      firstPostDate: s(row.first_post_date),
      lastPostDate: s(row.last_post_date)
    },
    'legislators + app_legislator_summary',
    { lid }
  );
});

app.get('/api/v1/legislators/:lid/voice-fingerprint', async (request) => {
  const { lid } = request.params as { lid: string };
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
    { lid },
    { legislator: legislator ?? null }
  );
});

app.get('/api/v1/legislators/:lid/posts', async (request) => {
  const { lid } = request.params as { lid: string };
  const q = request.query as Query;
  const limit = clampLimit(q.limit, 25, 100);
  const cursor = q.cursor ? Number(q.cursor) : null;
  const topic = normalizedTopic(q.topic);
  const rows = await sql`
    SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
    FROM posts p
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
  return envelope(rows.map(postRow), 'posts', { ...q, lid, limit }, { nextCursor: rows.at(-1)?.id ?? null });
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
  return envelope(rows, 'legislators', { lid });
});

app.get('/api/v1/topics', async () => {
  const rows = await sql`
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
  })), 'topic_party_breakdown');
});

app.get('/api/v1/topics/:topicId', async (request) => {
  const topicId = normalizedTopic((request.params as { topicId: string }).topicId) ?? '999';
  const [row] = await sql`
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
  } : null, 'topic_party_breakdown', { topicId });
});

app.get('/api/v1/topic-ribbon', async (request) => {
  const q = request.query as Query;
  const rows = await sql`
    SELECT date::text, topic, topic_label, post_count, total_likes, total_retweets
    FROM topic_engagement_daily
    WHERE (${q.from ?? null}::date IS NULL OR date >= ${q.from ?? null}::date)
      AND (${q.to ?? null}::date IS NULL OR date <= ${q.to ?? null}::date)
    ORDER BY date, CASE WHEN topic = '999' THEN 999 ELSE topic::int END
  `;
  return envelope(rows, 'topic_engagement_daily', q);
});

app.get('/api/v1/topics/:topicId/ribbon', async (request) => {
  const topicId = normalizedTopic((request.params as { topicId: string }).topicId) ?? '999';
  const rows = await sql`
    SELECT date::text, topic, topic_label, post_count, total_likes, total_retweets
    FROM topic_engagement_daily
    WHERE topic = ${topicId}
    ORDER BY date
  `;
  return envelope(rows, 'topic_engagement_daily', { topicId });
});

app.get('/api/v1/topics/:topicId/state-salience', async (request) => {
  const topicId = normalizedTopic((request.params as { topicId: string }).topicId) ?? '999';
  const rows = await sql`
    SELECT state, topic, topic_label, post_count, total_likes, total_retweets
    FROM topic_state_breakdown
    WHERE topic = ${topicId}
    ORDER BY state
  `;
  return envelope(rows, 'topic_state_breakdown', { topicId });
});

app.get('/api/v1/topics/:topicId/party-chamber', async (request) => {
  const topicId = normalizedTopic((request.params as { topicId: string }).topicId) ?? '999';
  const rows = await sql`
    SELECT party, chamber, post_count, total_likes, total_retweets
    FROM app_topic_party_chamber
    WHERE topic = ${topicId}
    ORDER BY party, chamber
  `;
  return envelope(rows, 'app_topic_party_chamber', { topicId });
});

app.get('/api/v1/topics/:topicId/beeswarm', async (request) => {
  const topicId = normalizedTopic((request.params as { topicId: string }).topicId) ?? '999';
  const rows = await sql`
    SELECT l.lid, l.name, l.handle, l.state, l.party, l.chamber, l.mrp_ideology,
           COALESCE(alt.post_count, 0)::bigint AS topic_posts,
           als.total_posts
    FROM legislators l
    JOIN app_legislator_summary als ON als.lid = l.lid
    LEFT JOIN app_legislator_topic alt ON alt.lid = l.lid AND alt.topic = ${topicId}
    WHERE l.mrp_ideology IS NOT NULL
    ORDER BY l.mrp_ideology
  `;
  return envelope(rows.map((row) => ({
    lid: s(row.lid),
    name: s(row.name),
    handle: s(row.handle),
    state: s(row.state),
    party: s(row.party),
    chamber: s(row.chamber),
    mrpIdeology: Number(row.mrp_ideology),
    topicPosts: n(row.topic_posts),
    share: n(row.topic_posts) / Math.max(n(row.total_posts), 1)
  })), 'app_legislator_topic', { topicId }, { includedCount: rows.length });
});

app.get('/api/v1/topics/:topicId/adjacent', async (request) => {
  const topicId = normalizedTopic((request.params as { topicId: string }).topicId) ?? '999';
  const rows = await sql`
    SELECT topic, topic_label, sum(post_count)::bigint AS post_count
    FROM topic_party_breakdown
    WHERE topic <> ${topicId}
    GROUP BY topic, topic_label
    ORDER BY sum(post_count) DESC
    LIMIT 8
  `;
  return envelope(rows, 'topic_party_breakdown', { topicId });
});

app.get('/api/v1/topics/:topicId/top-posts', async (request) => {
  const topicId = normalizedTopic((request.params as { topicId: string }).topicId) ?? '999';
  const q = request.query as Query;
  const limit = clampLimit(q.limit, 10, 25);
  const rows = await sql`
    SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
    FROM posts p
    JOIN topics t ON t.topic = p.topic
    JOIN legislators l ON l.lid = p.lid
    WHERE p.topic = ${topicId}
      AND (${q.state?.toUpperCase() ?? null}::text IS NULL OR l.state = ${q.state?.toUpperCase() ?? null})
      AND (${q.party ?? null}::text IS NULL OR l.party = ${q.party ?? null})
    ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
    LIMIT ${limit}
  `;
  return envelope(rows.map(postRow), 'posts', { ...q, topicId, limit });
});

app.get('/api/v1/states', async () => {
  const rows = await sql`
    SELECT state, sum(post_count)::bigint AS post_count, sum(total_likes)::bigint AS total_likes,
           sum(total_retweets)::bigint AS total_retweets
    FROM topic_state_breakdown
    GROUP BY state
    ORDER BY state
  `;
  return envelope(rows.map((row) => ({
    state: s(row.state),
    stateName: stateName(String(row.state)),
    postCount: n(row.post_count),
    totalEngagement: n(row.total_likes) + n(row.total_retweets)
  })), 'topic_state_breakdown');
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
  const [summary] = await sql`
    SELECT state, count(*)::int AS legislators,
           count(*) FILTER (WHERE party = 'Democratic')::int AS democratic,
           count(*) FILTER (WHERE party = 'Republican')::int AS republican,
           count(*) FILTER (WHERE party = 'Independent')::int AS independent,
           sum(total_posts)::bigint AS posts,
           sum(total_likes + total_retweets)::bigint AS engagement
    FROM app_legislator_summary
    WHERE state = ${state}
    GROUP BY state
  `;
  return envelope({ ...summary, stateName: stateName(state) }, 'app_legislator_summary', { state });
});

app.get('/api/v1/states/:state/topics', async (request) => {
  const state = (request.params as { state: string }).state.toUpperCase();
  const rows = await sql`
    SELECT topic, topic_label, post_count, total_likes, total_retweets
    FROM topic_state_breakdown
    WHERE state = ${state}
    ORDER BY post_count DESC
  `;
  return envelope(rows, 'topic_state_breakdown', { state });
});

app.get('/api/v1/states/:state/trend', async (request) => {
  const state = (request.params as { state: string }).state.toUpperCase();
  const rows = await sql`
    SELECT date_trunc('month', p.created_at)::date AS month, l.party, count(*)::bigint AS post_count
    FROM posts p
    JOIN legislators l ON l.lid = p.lid
    WHERE l.state = ${state}
    GROUP BY 1, l.party
    ORDER BY 1, l.party
  `;
  return envelope(rows, 'posts + legislators', { state });
});

app.get('/api/v1/states/:state/top-posts', async (request) => {
  const state = (request.params as { state: string }).state.toUpperCase();
  const q = request.query as Query;
  const topic = normalizedTopic(q.topic);
  const limit = clampLimit(q.limit, 10, 25);
  const rows = await sql`
    SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
    FROM posts p
    JOIN topics t ON t.topic = p.topic
    JOIN legislators l ON l.lid = p.lid
    WHERE l.state = ${state}
      AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
      AND (${q.party ?? null}::text IS NULL OR l.party = ${q.party ?? null})
    ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
    LIMIT ${limit}
  `;
  return envelope(rows.map(postRow), 'posts + legislators', { ...q, state, limit });
});

app.get('/api/v1/events', async () => envelope(events, 'events.ts'));

app.get('/api/v1/moments/window', async (request) => {
  const q = request.query as Query;
  const date = q.date ?? '2022-06-24';
  const width = Math.min(Math.max(Number(q.width ?? 7), 1), 45);
  const rows = await sql`
    SELECT p.topic, t.topic_label, count(*)::bigint AS post_count,
           sum(p.like_count)::bigint AS total_likes,
           sum(p.retweet_count)::bigint AS total_retweets
    FROM posts p
    JOIN topics t ON t.topic = p.topic
    WHERE p.created_at BETWEEN (${date}::date - ${width}::int) AND (${date}::date + ${width}::int)
    GROUP BY p.topic, t.topic_label
    ORDER BY count(*) DESC
  `;
  return envelope(rows, 'posts', { date, width }, { coveragePeriod: [date, date] });
});

app.get('/api/v1/moments/window/top-posts', async (request) => {
  const q = request.query as Query;
  const date = q.date ?? '2022-06-24';
  const width = Math.min(Math.max(Number(q.width ?? 7), 1), 45);
  const limit = clampLimit(q.limit, 10, 25);
  const rows = await sql`
    SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
    FROM posts p
    JOIN topics t ON t.topic = p.topic
    JOIN legislators l ON l.lid = p.lid
    WHERE p.created_at BETWEEN (${date}::date - ${width}::int) AND (${date}::date + ${width}::int)
    ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
    LIMIT ${limit}
  `;
  return envelope(rows.map(postRow), 'posts', { date, width, limit });
});

app.get('/api/v1/sampler', async (request) => {
  const q = request.query as Query;
  const seed = q.seed ?? String(Date.now());
  const limit = clampLimit(q.n, 6, 12);
  const anchor = stableAnchor(seed, await maxPostId());
  const topic = normalizedTopic(q.topic);
  const rows = await sql`
    SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
    FROM posts p
    JOIN topics t ON t.topic = p.topic
    JOIN legislators l ON l.lid = p.lid
    WHERE p.id >= ${anchor}
      AND (${q.state?.toUpperCase() ?? null}::text IS NULL OR l.state = ${q.state?.toUpperCase() ?? null})
      AND (${q.party ?? null}::text IS NULL OR l.party = ${q.party ?? null})
      AND (${topic ?? null}::text IS NULL OR p.topic = ${topic ?? null})
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
      const topPosts = await sql`
        SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
        FROM posts p
        JOIN topics t ON t.topic = p.topic
        JOIN legislators l ON l.lid = p.lid
        WHERE p.lid = ${id}
        ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
        LIMIT 3
      `;
      results.push({
        kind,
        id,
        label: summary?.name ?? id,
        href: `/who/${id}`,
        metrics: {
          posts: n(summary?.total_posts),
          engagement: n(summary?.total_likes) + n(summary?.total_retweets),
          party: s(summary?.party),
          state: s(summary?.state)
        },
        topicMix: topicMix.map((row) => ({ topic: s(row.topic), topicLabel: s(row.topic_label), postCount: n(row.post_count) })),
        topPosts: topPosts.map(postRow)
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
      const topPosts = await sql`
        SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
        FROM posts p
        JOIN topics t ON t.topic = p.topic
        JOIN legislators l ON l.lid = p.lid
        WHERE l.state = ${state}
        ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
        LIMIT 3
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
        topPosts: topPosts.map(postRow)
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
      const topPosts = await sql`
        SELECT p.*, t.topic_label, l.name, l.handle, l.state, l.chamber, l.party
        FROM posts p
        JOIN topics t ON t.topic = p.topic
        JOIN legislators l ON l.lid = p.lid
        WHERE p.topic = ${topicId}
        ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
        LIMIT 3
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
        topPosts: topPosts.map(postRow)
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
  const limit = clampLimit(spec.limit, 100, 1000);
  if (chart === 'states') {
    const rows = await sql`
      SELECT state, sum(post_count)::bigint AS post_count,
             sum(total_likes)::bigint AS total_likes,
             sum(total_retweets)::bigint AS total_retweets
      FROM topic_state_breakdown
      GROUP BY state
      ORDER BY state
    `;
    return { chart, rows: rows as Record<string, unknown>[] };
  }
  if (chart === 'state-topics') {
    const state = String(filters.state ?? 'TX').toUpperCase();
    const rows = await sql`
      SELECT state, topic, topic_label, post_count, total_likes, total_retweets
      FROM topic_state_breakdown
      WHERE state = ${state}
      ORDER BY post_count DESC
    `;
    return { chart, rows: rows as Record<string, unknown>[] };
  }
  if (chart === 'topic-ribbon') {
    const topic = normalizedTopic(String(filters.topic ?? '20'));
    const rows = await sql`
      SELECT date::text, topic, topic_label, post_count, total_likes, total_retweets
      FROM topic_engagement_daily
      WHERE (${topic ?? null}::text IS NULL OR topic = ${topic ?? null})
        AND (${String(filters.from ?? '') || null}::date IS NULL OR date >= ${String(filters.from ?? '') || null}::date)
        AND (${String(filters.to ?? '') || null}::date IS NULL OR date <= ${String(filters.to ?? '') || null}::date)
      ORDER BY date
      LIMIT ${limit}
    `;
    return { chart, rows: rows as Record<string, unknown>[] };
  }
  if (chart === 'legislator-posts') {
    const lid = String(filters.lid ?? '');
    const rows = await sql`
      SELECT p.id, p.created_at::text, p.lid, l.name, p.topic, t.topic_label,
             p.like_count, p.retweet_count, p.reply_count, p.quote_count, p.text
      FROM posts p
      JOIN legislators l ON l.lid = p.lid
      JOIN topics t ON t.topic = p.topic
      WHERE p.lid = ${lid}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ${limit}
    `;
    return { chart, rows: rows as Record<string, unknown>[] };
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
  const header = [
    `# CivicWatch export`,
    `# snapshot_id=${SNAPSHOT_ID}`,
    `# chart=${chart}`,
    `# filters=${JSON.stringify(spec.filters ?? {})}`,
    `# generated_at=${new Date().toISOString()}`,
  ];
  reply.header('content-type', 'text/csv; charset=utf-8');
  reply.header('content-disposition', `attachment; filename="civicwatch_${chart}_${SNAPSHOT_ID}.csv"`);
  return [...header, ...csvLines(rows)].join('\n');
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
