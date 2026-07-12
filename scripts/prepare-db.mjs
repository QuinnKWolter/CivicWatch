import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(repoRoot, '.env');
const sqlPath = resolve(repoRoot, 'database/scripts/prepare_explore.sql');
const fallbackSql = String.raw`
SET statement_timeout = 0;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping pg_trgm extension: insufficient privilege.';
END
$$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS unaccent;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping unaccent extension: insufficient privilege.';
END
$$;

DROP MATERIALIZED VIEW IF EXISTS app_legislator_topic;
DROP MATERIALIZED VIEW IF EXISTS app_topic_party_chamber;
DROP MATERIALIZED VIEW IF EXISTS app_legislator_summary;

CREATE MATERIALIZED VIEW app_legislator_summary AS
SELECT
  l.lid,
  l.name,
  l.handle,
  l.state,
  l.chamber,
  l.party,
  count(p.id)::bigint AS total_posts,
  COALESCE(sum(p.like_count), 0)::bigint AS total_likes,
  COALESCE(sum(p.retweet_count), 0)::bigint AS total_retweets,
  COALESCE(sum(p.reply_count), 0)::bigint AS total_replies,
  COALESCE(sum(p.quote_count), 0)::bigint AS total_quotes,
  min(p.created_at) AS first_post_date,
  max(p.created_at) AS last_post_date,
  count(*) FILTER (WHERE p.is_political)::bigint AS political_posts
FROM legislators l
LEFT JOIN posts p ON p.lid = l.lid
GROUP BY l.lid, l.name, l.handle, l.state, l.chamber, l.party;

CREATE UNIQUE INDEX app_legislator_summary_lid_idx ON app_legislator_summary (lid);
CREATE INDEX app_legislator_summary_state_idx ON app_legislator_summary (state);
CREATE INDEX app_legislator_summary_party_idx ON app_legislator_summary (party);
CREATE INDEX app_legislator_summary_posts_idx ON app_legislator_summary (total_posts DESC);

CREATE MATERIALIZED VIEW app_legislator_topic AS
SELECT
  p.lid,
  p.topic,
  t.topic_label,
  count(*)::bigint AS post_count,
  COALESCE(sum(p.like_count), 0)::bigint AS total_likes,
  COALESCE(sum(p.retweet_count), 0)::bigint AS total_retweets
FROM posts p
JOIN topics t ON t.topic = p.topic
GROUP BY p.lid, p.topic, t.topic_label;

CREATE INDEX app_legislator_topic_lid_idx ON app_legislator_topic (lid);
CREATE INDEX app_legislator_topic_topic_idx ON app_legislator_topic (topic);
CREATE UNIQUE INDEX app_legislator_topic_lid_topic_idx ON app_legislator_topic (lid, topic);

CREATE INDEX IF NOT EXISTS idx_posts_topic_engagement
  ON posts (topic, ((like_count + retweet_count)) DESC, id DESC);

CREATE MATERIALIZED VIEW app_topic_party_chamber AS
SELECT
  p.topic,
  t.topic_label,
  l.party,
  l.chamber,
  count(*)::bigint AS post_count,
  COALESCE(sum(p.like_count), 0)::bigint AS total_likes,
  COALESCE(sum(p.retweet_count), 0)::bigint AS total_retweets
FROM posts p
JOIN topics t ON t.topic = p.topic
JOIN legislators l ON l.lid = p.lid
WHERE l.party IS NOT NULL AND l.chamber IS NOT NULL
GROUP BY p.topic, t.topic_label, l.party, l.chamber;

CREATE UNIQUE INDEX app_topic_party_chamber_idx
  ON app_topic_party_chamber (topic, party, chamber);

ANALYZE legislators;
ANALYZE posts;
ANALYZE topics;
ANALYZE topic_engagement_daily;
ANALYZE topic_party_breakdown;
ANALYZE topic_state_breakdown;
ANALYZE app_legislator_summary;
ANALYZE app_legislator_topic;
ANALYZE app_topic_party_chamber;
`;

function loadDotEnv(path) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const index = trimmed.indexOf('=');
    const name = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[name]) process.env[name] = value;
  }
}

function sslModeFromEnv() {
  const mode = (
    process.env.PGSSLMODE ??
    process.env.DB_SSL ??
    process.env.POSTGRES_SSL ??
    ''
  ).toLowerCase();

  if (mode === 'require' || mode === 'true' || mode === '1') return 'require';
  if (mode === 'prefer' || mode === 'allow' || mode === 'disable') return mode;
  if (mode === 'false' || mode === '0') return 'disable';
  return undefined;
}

loadDotEnv(envPath);

let activeSqlPath = sqlPath;
if (!existsSync(activeSqlPath)) {
  const tempDir = mkdtempSync(join(tmpdir(), 'civicwatch-db-'));
  activeSqlPath = join(tempDir, 'prepare_explore.sql');
  writeFileSync(activeSqlPath, fallbackSql.trimStart());
  console.warn(
    `Warning: ${sqlPath} was not found; using embedded prepare SQL fallback.`
  );
}

const env = { ...process.env };
const sslMode = sslModeFromEnv();
if (sslMode) env.PGSSLMODE = sslMode;

const host = env.DB_HOST ?? env.POSTGRES_HOST ?? 'localhost';
const port = env.DB_PORT ?? env.POSTGRES_PORT ?? '55432';
const database = env.DB_NAME ?? env.POSTGRES_DB ?? 'civicwatch_explore';
const user = env.DB_USER ?? env.POSTGRES_USER ?? 'postgres';
const password = env.DB_PASSWORD ?? env.POSTGRES_PASSWORD;

if (password && !env.PGPASSWORD) env.PGPASSWORD = password;

const args = env.DATABASE_URL
  ? [env.DATABASE_URL]
  : ['-h', host, '-p', port, '-U', user, '-d', database];

args.push('-v', 'ON_ERROR_STOP=1', '-f', activeSqlPath);

console.log(
  `Preparing CivicWatch database ${env.DATABASE_URL ? 'from DATABASE_URL' : `${user}@${host}:${port}/${database}`}${sslMode ? ` with sslmode=${sslMode}` : ''}...`
);

const result = spawnSync('psql', args, {
  cwd: repoRoot,
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
