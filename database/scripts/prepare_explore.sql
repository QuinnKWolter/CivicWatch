-- CivicWatch local exploration helpers.
-- Run after restoring civicwatch_postgres_full_2026-07-02.dump into civicwatch_explore.

SET statement_timeout = 0;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping optional pg_trgm extension: %', SQLERRM;
END
$$;

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS unaccent;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping optional unaccent extension: %', SQLERRM;
END
$$;

DROP MATERIALIZED VIEW IF EXISTS app_legislator_topic;
DROP MATERIALIZED VIEW IF EXISTS app_topic_party_chamber;
DROP MATERIALIZED VIEW IF EXISTS app_legislator_summary;
DROP MATERIALIZED VIEW IF EXISTS app_state_top_posts;

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

CREATE INDEX IF NOT EXISTS idx_posts_lid_engagement
  ON posts (lid, ((like_count + retweet_count)) DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_posts_created_id_desc
  ON posts (created_at DESC, id DESC);

CREATE MATERIALIZED VIEW app_state_top_posts AS
SELECT id, state, state_rank
FROM (
  SELECT
    p.id,
    l.state,
    row_number() OVER (
      PARTITION BY l.state
      ORDER BY (p.like_count + p.retweet_count) DESC, p.id DESC
    ) AS state_rank
  FROM posts p
  JOIN legislators l ON l.lid = p.lid
  WHERE l.state IS NOT NULL
) ranked
WHERE state_rank <= 25;

CREATE UNIQUE INDEX app_state_top_posts_state_rank_idx
  ON app_state_top_posts (state, state_rank);
CREATE INDEX app_state_top_posts_id_idx ON app_state_top_posts (id);

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
ANALYZE app_state_top_posts;
ANALYZE app_topic_party_chamber;
