-- Recompute app_network_edges counts from current app_post_interactions.
-- Core tables are not modified. Dry run unless repair_apply=true.

\timing on
\echo Preparing CivicWatch network edge count repair...
SET statement_timeout = 0;
SET work_mem = '256MB';
SET maintenance_work_mem = '1GB';
\ir use_app_tablespace.sql

ALTER TABLE app_network_edges
  ADD COLUMN IF NOT EXISTS raw_interaction_count bigint,
  ADD COLUMN IF NOT EXISTS raw_engagement bigint,
  ADD COLUMN IF NOT EXISTS canonical_post_count bigint,
  ADD COLUMN IF NOT EXISTS canonical_engagement bigint;

CREATE TABLE IF NOT EXISTS app_posts_canonical_map (
  id bigint PRIMARY KEY,
  lid text NOT NULL,
  tweet_id text,
  duplicate_count integer NOT NULL DEFAULT 1,
  like_count integer,
  retweet_count integer,
  canonical_text text
);

\echo Ensuring helper indexes exist...
CREATE INDEX IF NOT EXISTS app_post_interactions_edge_repair_idx
  ON app_post_interactions (source_lid, target_lid, target_handle, interaction_type, topic);
CREATE INDEX IF NOT EXISTS app_post_interactions_tweet_source_repair_idx
  ON app_post_interactions (tweet_id, source_lid)
  WHERE tweet_id IS NOT NULL;

DROP TABLE IF EXISTS app_network_edge_counts_repair;

\echo Recomputing raw and canonical edge counts...
CREATE UNLOGGED TABLE app_network_edge_counts_repair AS
WITH edge_post_rows AS (
  SELECT
    pi.source_lid,
    pi.target_lid,
    pi.target_handle,
    pi.interaction_type,
    pi.topic,
    pi.post_id,
    pi.created_at,
    pi.engagement AS raw_engagement,
    COALESCE(pc.id, pi.post_id) AS canonical_post_id,
    CASE
      WHEN pc.id IS NOT NULL THEN COALESCE(pc.like_count, 0) + COALESCE(pc.retweet_count, 0)
      ELSE pi.engagement
    END AS canonical_post_engagement
  FROM app_post_interactions pi
  LEFT JOIN app_posts_canonical_map pc
    ON pc.tweet_id = pi.tweet_id
   AND pc.lid = pi.source_lid
), raw_edges AS (
  SELECT
    source_lid,
    target_lid,
    target_handle,
    interaction_type,
    topic,
    count(*)::bigint AS raw_interaction_count,
    sum(raw_engagement)::bigint AS raw_engagement,
    min(created_at) AS raw_first_seen,
    max(created_at) AS raw_last_seen,
    (array_agg(post_id ORDER BY raw_engagement DESC, post_id DESC))[1] AS raw_sample_post_id
  FROM edge_post_rows
  GROUP BY source_lid, target_lid, target_handle, interaction_type, topic
), canonical_posts AS (
  SELECT
    source_lid,
    target_lid,
    target_handle,
    interaction_type,
    topic,
    canonical_post_id,
    min(created_at) AS first_seen,
    max(created_at) AS last_seen,
    max(canonical_post_engagement)::bigint AS canonical_engagement
  FROM edge_post_rows
  GROUP BY source_lid, target_lid, target_handle, interaction_type, topic, canonical_post_id
), canonical_edges AS (
  SELECT
    source_lid,
    target_lid,
    target_handle,
    interaction_type,
    topic,
    count(*)::bigint AS canonical_post_count,
    sum(canonical_engagement)::bigint AS canonical_engagement,
    min(first_seen) AS first_seen,
    max(last_seen) AS last_seen,
    (array_agg(canonical_post_id ORDER BY canonical_engagement DESC, canonical_post_id DESC))[1] AS sample_post_id
  FROM canonical_posts
  GROUP BY source_lid, target_lid, target_handle, interaction_type, topic
)
SELECT
  re.source_lid,
  re.target_lid,
  re.target_handle,
  re.interaction_type,
  re.topic,
  re.raw_interaction_count,
  re.raw_engagement,
  ce.canonical_post_count,
  ce.canonical_engagement,
  ce.first_seen,
  ce.last_seen,
  ce.sample_post_id
FROM raw_edges re
JOIN canonical_edges ce
  ON ce.source_lid = re.source_lid
 AND ce.target_lid IS NOT DISTINCT FROM re.target_lid
 AND ce.target_handle = re.target_handle
 AND ce.interaction_type = re.interaction_type
 AND ce.topic = re.topic;

CREATE INDEX app_network_edge_counts_repair_key_idx
  ON app_network_edge_counts_repair (source_lid, target_lid, target_handle, interaction_type, topic);
ANALYZE app_network_edge_counts_repair;

\echo Repair preview:
SELECT
  count(*)::bigint AS edge_rows,
  sum(raw_interaction_count)::bigint AS raw_interactions,
  sum(canonical_post_count)::bigint AS canonical_posts,
  count(*) FILTER (WHERE raw_interaction_count <> canonical_post_count)::bigint AS edges_with_duplicate_raw_rows,
  sum(raw_interaction_count - canonical_post_count)::bigint AS duplicate_raw_rows_removed,
  sum(raw_engagement)::bigint AS raw_engagement,
  sum(canonical_engagement)::bigint AS canonical_engagement
FROM app_network_edge_counts_repair;

\echo Largest duplicate corrections:
SELECT
  source_lid,
  target_lid,
  target_handle,
  interaction_type,
  topic,
  raw_interaction_count,
  canonical_post_count,
  raw_interaction_count - canonical_post_count AS duplicate_rows_removed,
  raw_engagement,
  canonical_engagement
FROM app_network_edge_counts_repair
WHERE raw_interaction_count <> canonical_post_count
ORDER BY duplicate_rows_removed DESC, raw_interaction_count DESC
LIMIT 20;

\if :repair_apply
  \echo Applying corrected counts to app_network_edges...
  BEGIN;
    UPDATE app_network_edges e
    SET
      raw_interaction_count = r.raw_interaction_count,
      raw_engagement = r.raw_engagement,
      canonical_post_count = r.canonical_post_count,
      canonical_engagement = r.canonical_engagement,
      post_count = r.canonical_post_count,
      engagement = r.canonical_engagement,
      first_seen = r.first_seen,
      last_seen = r.last_seen,
      sample_post_id = r.sample_post_id
    FROM app_network_edge_counts_repair r
    WHERE e.source_lid = r.source_lid
      AND e.target_lid IS NOT DISTINCT FROM r.target_lid
      AND e.target_handle = r.target_handle
      AND e.interaction_type = r.interaction_type
      AND e.topic = r.topic;
  COMMIT;

  ANALYZE app_network_edges;

  \echo Corrected app_network_edges summary:
  SELECT
    count(*)::bigint AS edge_rows,
    sum(raw_interaction_count)::bigint AS raw_interactions,
    sum(post_count)::bigint AS canonical_posts,
    count(*) FILTER (WHERE raw_interaction_count <> post_count)::bigint AS edges_with_duplicate_raw_rows
  FROM app_network_edges;
\else
  \echo Dry run only. Re-run with --apply to update app_network_edges.
\endif

DROP TABLE IF EXISTS app_network_edge_counts_repair;
