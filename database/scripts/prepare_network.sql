-- CivicWatch legislator interaction preprocessing.
-- Additive/non-core: builds app_* derived tables from posts + legislators.

\timing on
\echo Preparing CivicWatch network preprocessing tables...
SET statement_timeout = 0;
SET work_mem = '256MB';
SET maintenance_work_mem = '1GB';
\ir use_app_tablespace.sql

CREATE TABLE IF NOT EXISTS app_network_builds (
  build_id text PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  handle_count bigint,
  interaction_count bigint,
  edge_count bigint,
  notes text
);

CREATE TABLE IF NOT EXISTS app_legislator_handles (
  lid text NOT NULL,
  handle text NOT NULL,
  handle_norm text NOT NULL,
  source text NOT NULL,
  priority integer NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  legislator_name text,
  state text,
  party text,
  chamber text,
  build_id text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_post_interactions (
  build_id text NOT NULL,
  post_id bigint NOT NULL,
  tweet_id text,
  created_at date NOT NULL,
  topic text NOT NULL,
  source_lid text NOT NULL,
  target_lid text,
  target_handle text NOT NULL,
  interaction_type text NOT NULL,
  evidence_text text,
  engagement integer NOT NULL DEFAULT 0,
  confidence text NOT NULL,
  target_match_count integer NOT NULL DEFAULT 0,
  hydrated boolean NOT NULL DEFAULT false,
  inserted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_network_edges (
  build_id text NOT NULL,
  source_lid text NOT NULL,
  target_lid text,
  target_handle text NOT NULL,
  interaction_type text NOT NULL,
  topic text NOT NULL,
  source_state text,
  target_state text,
  source_party text,
  target_party text,
  source_chamber text,
  target_chamber text,
  post_count bigint NOT NULL,
  engagement bigint NOT NULL,
  first_seen date NOT NULL,
  last_seen date NOT NULL,
  sample_post_id bigint,
  confidence text NOT NULL,
  raw_interaction_count bigint,
  raw_engagement bigint,
  canonical_post_count bigint,
  canonical_engagement bigint
);

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

INSERT INTO app_network_builds (build_id, status, filters, notes)
VALUES (
  :'build_id',
  'running',
  jsonb_build_object(
    'from', NULLIF(:'network_from', ''),
    'to', NULLIF(:'network_to', ''),
    'topic', NULLIF(:'network_topic', ''),
    'state', NULLIF(:'network_state', ''),
    'party', NULLIF(:'network_party', '')
  ),
  'Derived from existing posts.text and legislator handle fields. Core tables are not modified.'
)
ON CONFLICT (build_id) DO UPDATE
SET
  started_at = now(),
  finished_at = NULL,
  status = 'running',
  filters = EXCLUDED.filters,
  notes = EXCLUDED.notes;

DROP TABLE IF EXISTS app_legislator_handles_next;
DROP TABLE IF EXISTS app_network_source_posts_next;
DROP TABLE IF EXISTS app_network_text_interactions_next;
DROP TABLE IF EXISTS app_post_interactions_next;
DROP TABLE IF EXISTS app_network_edges_next;

\echo Building legislator handle lookup...
CREATE UNLOGGED TABLE app_legislator_handles_next (LIKE app_legislator_handles INCLUDING DEFAULTS);

INSERT INTO app_legislator_handles_next (
  lid,
  handle,
  handle_norm,
  source,
  priority,
  is_primary,
  legislator_name,
  state,
  party,
  chamber,
  build_id
)
WITH raw_handles AS (
  SELECT lid, name, state, party, chamber, handle AS handle, 'handle' AS source, 10 AS priority, true AS is_primary
  FROM legislators
  UNION ALL
  SELECT lid, name, state, party, chamber, handle_1, 'handle_1', 20, false FROM legislators
  UNION ALL
  SELECT lid, name, state, party, chamber, handle_2, 'handle_2', 30, false FROM legislators
  UNION ALL
  SELECT lid, name, state, party, chamber, camphand, 'camphand', 40, false FROM legislators
  UNION ALL
  SELECT lid, name, state, party, chamber, offhand, 'offhand', 50, false FROM legislators
  UNION ALL
  SELECT lid, name, state, party, chamber, perhand, 'perhand', 60, false FROM legislators
  UNION ALL
  SELECT lid, name, state, party, chamber, CASE WHEN name LIKE '@%' THEN name ELSE NULL END, 'name_at_handle', 70, false
  FROM legislators
), cleaned AS (
  SELECT DISTINCT
    lid,
    btrim(handle) AS handle,
    lower(regexp_replace(btrim(handle), '^@', '')) AS handle_norm,
    source,
    priority,
    is_primary,
    name,
    state,
    party,
    chamber
  FROM raw_handles
  WHERE handle IS NOT NULL
    AND btrim(handle) <> ''
    AND lower(btrim(handle)) NOT IN ('nan', 'na', 'n/a', 'null', 'none', '|na|na|na')
)
SELECT
  lid,
  handle,
  handle_norm,
  source,
  priority,
  is_primary,
  name,
  state,
  party,
  chamber,
  :'build_id'
FROM cleaned
WHERE handle_norm ~ '^[a-z0-9_]{1,15}$';

CREATE INDEX app_legislator_handles_next_norm_idx ON app_legislator_handles_next (handle_norm);
CREATE INDEX app_legislator_handles_next_lid_idx ON app_legislator_handles_next (lid);
ANALYZE app_legislator_handles_next;

CREATE UNLOGGED TABLE app_post_interactions_next (LIKE app_post_interactions INCLUDING DEFAULTS);

\echo Staging source posts that contain handles...
CREATE UNLOGGED TABLE app_network_source_posts_next AS
SELECT
  p.id,
  p.tweet_id,
  p.created_at,
  p.topic,
  p.lid AS source_lid,
  p.text,
  md5(p.text) AS text_key,
  COALESCE(p.like_count, 0) + COALESCE(p.retweet_count, 0) AS engagement
FROM posts p
JOIN legislators sl ON sl.lid = p.lid
WHERE p.text IS NOT NULL
  AND p.text LIKE '%@%'
  AND (NULLIF(:'network_from', '') IS NULL OR p.created_at >= NULLIF(:'network_from', '')::date)
  AND (NULLIF(:'network_to', '') IS NULL OR p.created_at <= NULLIF(:'network_to', '')::date)
  AND (NULLIF(:'network_topic', '') IS NULL OR p.topic = NULLIF(:'network_topic', ''))
  AND (NULLIF(:'network_state', '') IS NULL OR sl.state = NULLIF(:'network_state', ''))
  AND (NULLIF(:'network_party', '') IS NULL OR sl.party = NULLIF(:'network_party', ''));

CREATE INDEX app_network_source_posts_next_text_key_idx ON app_network_source_posts_next (text_key);
CREATE INDEX app_network_source_posts_next_source_idx ON app_network_source_posts_next (source_lid);
CREATE INDEX app_network_source_posts_next_topic_idx ON app_network_source_posts_next (topic);
ANALYZE app_network_source_posts_next;

\echo Extracting handles once per distinct post text...
CREATE UNLOGGED TABLE app_network_text_interactions_next (
  text_key text NOT NULL,
  text text NOT NULL,
  target_handle text NOT NULL,
  interaction_type text NOT NULL,
  evidence_text text NOT NULL,
  PRIMARY KEY (text_key, target_handle, interaction_type)
);

INSERT INTO app_network_text_interactions_next (
  text_key,
  text,
  target_handle,
  interaction_type,
  evidence_text
)
SELECT DISTINCT
  d.text_key,
  d.text,
  lower((m.handle)[1]) AS target_handle,
  'retweet',
  left(d.text, 500)
FROM (
  SELECT DISTINCT text_key, text
  FROM app_network_source_posts_next
  WHERE text LIKE 'RT @%:%'
) d
CROSS JOIN LATERAL regexp_matches(d.text, '^RT @([A-Za-z0-9_]{1,15}):') AS m(handle);

INSERT INTO app_network_text_interactions_next (
  text_key,
  text,
  target_handle,
  interaction_type,
  evidence_text
)
SELECT DISTINCT
  d.text_key,
  d.text,
  lower((m.handle)[1]) AS target_handle,
  'mention',
  left(d.text, 500)
FROM (
  SELECT DISTINCT text_key, text
  FROM app_network_source_posts_next
) d
CROSS JOIN LATERAL regexp_matches(d.text, '@([A-Za-z0-9_]{1,15})', 'g') AS m(handle)
WHERE NOT (
  d.text LIKE 'RT @%:%'
  AND lower((m.handle)[1]) = lower(substring(d.text FROM '^RT @([A-Za-z0-9_]{1,15}):'))
)
ON CONFLICT DO NOTHING;

CREATE INDEX app_network_text_interactions_next_text_key_idx ON app_network_text_interactions_next (text_key);
CREATE INDEX app_network_text_interactions_next_handle_idx ON app_network_text_interactions_next (target_handle);
ANALYZE app_network_text_interactions_next;

\echo Expanding parsed text interactions back to posts...
INSERT INTO app_post_interactions_next (
  build_id,
  post_id,
  tweet_id,
  created_at,
  topic,
  source_lid,
  target_lid,
  target_handle,
  interaction_type,
  evidence_text,
  engagement,
  confidence,
  target_match_count,
  hydrated
)
WITH handle_match AS (
  SELECT
    handle_norm,
    CASE WHEN count(DISTINCT lid) = 1 THEN min(lid) END AS target_lid,
    count(DISTINCT lid)::integer AS match_count
  FROM app_legislator_handles_next
  GROUP BY handle_norm
)
SELECT
  :'build_id',
  p.id,
  p.tweet_id,
  p.created_at,
  p.topic,
  p.source_lid,
  hm.target_lid,
  ti.target_handle,
  ti.interaction_type,
  ti.evidence_text,
  p.engagement,
  CASE
    WHEN hm.match_count = 1 THEN 'known_legislator_handle'
    WHEN hm.match_count > 1 THEN 'ambiguous_legislator_handle'
    ELSE 'external_or_unknown_handle'
  END,
  COALESCE(hm.match_count, 0),
  false
FROM app_network_source_posts_next p
JOIN app_network_text_interactions_next ti
  ON ti.text_key = p.text_key
 AND ti.text = p.text
LEFT JOIN handle_match hm ON hm.handle_norm = ti.target_handle
WHERE COALESCE(hm.target_lid, '') <> p.source_lid;

CREATE INDEX app_post_interactions_next_source_idx ON app_post_interactions_next (source_lid);
CREATE INDEX app_post_interactions_next_target_idx ON app_post_interactions_next (target_lid);
CREATE INDEX app_post_interactions_next_handle_idx ON app_post_interactions_next (target_handle);
CREATE INDEX app_post_interactions_next_topic_idx ON app_post_interactions_next (topic);
CREATE INDEX app_post_interactions_next_type_idx ON app_post_interactions_next (interaction_type);
CREATE INDEX app_post_interactions_next_date_idx ON app_post_interactions_next (created_at);
ANALYZE app_post_interactions_next;

\echo Aggregating network edges...
CREATE UNLOGGED TABLE app_network_edges_next AS
WITH edge_post_rows AS (
  SELECT
    pi.*,
    COALESCE(pc.id, pi.post_id) AS canonical_post_id,
    CASE
      WHEN pc.id IS NOT NULL THEN COALESCE(pc.like_count, 0) + COALESCE(pc.retweet_count, 0)
      ELSE pi.engagement
    END AS canonical_post_engagement
  FROM app_post_interactions_next pi
  LEFT JOIN app_posts_canonical_map pc
    ON pc.tweet_id = pi.tweet_id
   AND pc.lid = pi.source_lid
), raw_edges AS (
SELECT
  :'build_id'::text AS build_id,
  epr.source_lid,
  epr.target_lid,
  epr.target_handle,
  epr.interaction_type,
  epr.topic,
  sl.state AS source_state,
  tl.state AS target_state,
  sl.party AS source_party,
  tl.party AS target_party,
  sl.chamber AS source_chamber,
  tl.chamber AS target_chamber,
  count(*)::bigint AS raw_interaction_count,
  sum(epr.engagement)::bigint AS raw_engagement,
  min(epr.created_at) AS raw_first_seen,
  max(epr.created_at) AS raw_last_seen,
  (array_agg(epr.post_id ORDER BY epr.engagement DESC, epr.post_id DESC))[1] AS raw_sample_post_id,
  CASE
    WHEN bool_or(epr.confidence = 'known_legislator_handle') THEN 'known_legislator_handle'
    WHEN bool_or(epr.confidence = 'ambiguous_legislator_handle') THEN 'ambiguous_legislator_handle'
    ELSE 'external_or_unknown_handle'
  END AS confidence
FROM edge_post_rows epr
JOIN legislators sl ON sl.lid = epr.source_lid
LEFT JOIN legislators tl ON tl.lid = epr.target_lid
GROUP BY
  epr.source_lid,
  epr.target_lid,
  epr.target_handle,
  epr.interaction_type,
  epr.topic,
  sl.state,
  tl.state,
  sl.party,
  tl.party,
  sl.chamber,
  tl.chamber
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
  GROUP BY
    source_lid,
    target_lid,
    target_handle,
    interaction_type,
    topic,
    canonical_post_id
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
  GROUP BY
    source_lid,
    target_lid,
    target_handle,
    interaction_type,
    topic
)
SELECT
  re.build_id,
  re.source_lid,
  re.target_lid,
  re.target_handle,
  re.interaction_type,
  re.topic,
  re.source_state,
  re.target_state,
  re.source_party,
  re.target_party,
  re.source_chamber,
  re.target_chamber,
  ce.canonical_post_count AS post_count,
  ce.canonical_engagement AS engagement,
  ce.first_seen,
  ce.last_seen,
  ce.sample_post_id,
  re.confidence,
  re.raw_interaction_count,
  re.raw_engagement,
  ce.canonical_post_count,
  ce.canonical_engagement
FROM raw_edges re
JOIN canonical_edges ce
  ON ce.source_lid = re.source_lid
 AND ce.target_lid IS NOT DISTINCT FROM re.target_lid
 AND ce.target_handle = re.target_handle
 AND ce.interaction_type = re.interaction_type
 AND ce.topic = re.topic;

CREATE INDEX app_network_edges_next_source_idx ON app_network_edges_next (source_lid);
CREATE INDEX app_network_edges_next_target_idx ON app_network_edges_next (target_lid);
CREATE INDEX app_network_edges_next_topic_idx ON app_network_edges_next (topic);
CREATE INDEX app_network_edges_next_type_idx ON app_network_edges_next (interaction_type);
CREATE INDEX app_network_edges_next_source_state_idx ON app_network_edges_next (source_state);
CREATE INDEX app_network_edges_next_target_state_idx ON app_network_edges_next (target_state);
CREATE INDEX app_network_edges_next_weight_idx ON app_network_edges_next (post_count DESC, engagement DESC);
ANALYZE app_network_edges_next;

\echo Swapping derived network tables into place...
BEGIN;
  TRUNCATE app_legislator_handles;
  INSERT INTO app_legislator_handles SELECT * FROM app_legislator_handles_next;

  TRUNCATE app_post_interactions;
  INSERT INTO app_post_interactions SELECT * FROM app_post_interactions_next;

  TRUNCATE app_network_edges;
  INSERT INTO app_network_edges (
    build_id,
    source_lid,
    target_lid,
    target_handle,
    interaction_type,
    topic,
    source_state,
    target_state,
    source_party,
    target_party,
    source_chamber,
    target_chamber,
    post_count,
    engagement,
    first_seen,
    last_seen,
    sample_post_id,
    confidence,
    raw_interaction_count,
    raw_engagement,
    canonical_post_count,
    canonical_engagement
  )
  SELECT
    build_id,
    source_lid,
    target_lid,
    target_handle,
    interaction_type,
    topic,
    source_state,
    target_state,
    source_party,
    target_party,
    source_chamber,
    target_chamber,
    post_count,
    engagement,
    first_seen,
    last_seen,
    sample_post_id,
    confidence,
    raw_interaction_count,
    raw_engagement,
    canonical_post_count,
    canonical_engagement
  FROM app_network_edges_next;

  UPDATE app_network_builds
  SET
    status = 'active',
    finished_at = now(),
    handle_count = (SELECT count(*) FROM app_legislator_handles),
    interaction_count = (SELECT count(*) FROM app_post_interactions),
    edge_count = (SELECT count(*) FROM app_network_edges)
  WHERE build_id = :'build_id';
COMMIT;

CREATE INDEX IF NOT EXISTS app_legislator_handles_norm_idx ON app_legislator_handles (handle_norm);
CREATE INDEX IF NOT EXISTS app_legislator_handles_lid_idx ON app_legislator_handles (lid);
CREATE INDEX IF NOT EXISTS app_post_interactions_source_idx ON app_post_interactions (source_lid);
CREATE INDEX IF NOT EXISTS app_post_interactions_target_idx ON app_post_interactions (target_lid);
CREATE INDEX IF NOT EXISTS app_post_interactions_handle_idx ON app_post_interactions (target_handle);
CREATE INDEX IF NOT EXISTS app_post_interactions_topic_idx ON app_post_interactions (topic);
CREATE INDEX IF NOT EXISTS app_post_interactions_type_idx ON app_post_interactions (interaction_type);
CREATE INDEX IF NOT EXISTS app_post_interactions_date_idx ON app_post_interactions (created_at);
CREATE INDEX IF NOT EXISTS app_network_edges_source_idx ON app_network_edges (source_lid);
CREATE INDEX IF NOT EXISTS app_network_edges_target_idx ON app_network_edges (target_lid);
CREATE INDEX IF NOT EXISTS app_network_edges_topic_idx ON app_network_edges (topic);
CREATE INDEX IF NOT EXISTS app_network_edges_type_idx ON app_network_edges (interaction_type);
CREATE INDEX IF NOT EXISTS app_network_edges_source_state_idx ON app_network_edges (source_state);
CREATE INDEX IF NOT EXISTS app_network_edges_target_state_idx ON app_network_edges (target_state);
CREATE INDEX IF NOT EXISTS app_network_edges_weight_idx ON app_network_edges (post_count DESC, engagement DESC);
CREATE INDEX IF NOT EXISTS app_network_edges_source_weight_idx ON app_network_edges (source_lid, post_count DESC, engagement DESC);
CREATE INDEX IF NOT EXISTS app_network_edges_target_weight_idx ON app_network_edges (target_lid, post_count DESC, engagement DESC);

\echo Cleaning network staging tables...
DROP TABLE IF EXISTS app_legislator_handles_next;
DROP TABLE IF EXISTS app_network_source_posts_next;
DROP TABLE IF EXISTS app_network_text_interactions_next;
DROP TABLE IF EXISTS app_post_interactions_next;
DROP TABLE IF EXISTS app_network_edges_next;

ANALYZE app_legislator_handles;
ANALYZE app_post_interactions;
ANALYZE app_network_edges;

SELECT
  build_id,
  status,
  handle_count,
  interaction_count,
  edge_count,
  filters,
  finished_at
FROM app_network_builds
WHERE build_id = :'build_id';
