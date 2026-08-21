-- CivicWatch canonical post map.
-- Additive/non-core: does not copy posts. Builds a slim id map plus a view.

\timing on
\echo Preparing CivicWatch canonical post tables...

SET statement_timeout = 0;
SET work_mem = '256MB';
SET maintenance_work_mem = '1GB';
\ir use_app_tablespace.sql

CREATE TABLE IF NOT EXISTS app_post_canonical_builds (
  build_id text PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  raw_post_count bigint,
  canonical_post_count bigint,
  duplicate_group_count bigint,
  duplicate_excess_count bigint
);

INSERT INTO app_post_canonical_builds (build_id, status)
VALUES (:'build_id', 'running')
ON CONFLICT (build_id)
DO UPDATE SET
  started_at = now(),
  finished_at = NULL,
  status = 'running',
  raw_post_count = NULL,
  canonical_post_count = NULL,
  duplicate_group_count = NULL,
  duplicate_excess_count = NULL;

DROP TABLE IF EXISTS app_posts_canonical_map_next;
DROP TABLE IF EXISTS app_post_duplicate_audit_next;
DROP TABLE IF EXISTS app_posts_canonical_next;

\echo Ranking duplicate tweet rows into a slim id map...
CREATE UNLOGGED TABLE app_posts_canonical_map_next AS
SELECT
  id,
  lid,
  tweet_id,
  duplicate_count,
  like_count,
  retweet_count,
  CASE
    WHEN text IS NOT DISTINCT FROM canonical_text THEN NULL
    ELSE canonical_text
  END AS canonical_text
FROM (
  SELECT
    p.id,
    p.lid,
    p.tweet_id,
    p.text,
    p.like_count,
    p.retweet_count,
    (count(*) OVER w)::int AS duplicate_count,
    first_value(p.text) OVER (
      w
      ORDER BY
        CASE
          WHEN p.text IS NULL OR btrim(p.text) = '' THEN 2
          WHEN p.text ~ '[[:cntrl:]]' OR p.text LIKE ('%' || chr(65533) || '%') THEN 1
          ELSE 0
        END,
        length(COALESCE(p.text, '')) DESC,
        (
          COALESCE(p.like_count, 0) +
          COALESCE(p.retweet_count, 0) +
          COALESCE(p.reply_count, 0) +
          COALESCE(p.quote_count, 0)
        ) DESC,
        p.id DESC
    ) AS canonical_text,
    row_number() OVER (
      w
      ORDER BY
        (
          COALESCE(p.like_count, 0) +
          COALESCE(p.retweet_count, 0) +
          COALESCE(p.reply_count, 0) +
          COALESCE(p.quote_count, 0)
        ) DESC,
        length(COALESCE(p.text, '')) DESC,
        p.id DESC
    ) AS canonical_rank
  FROM posts p
  WINDOW w AS (PARTITION BY p.lid, COALESCE(p.tweet_id, 'row:' || p.id::text))
) ranked
WHERE canonical_rank = 1;

\echo Indexing canonical post map...
CREATE UNIQUE INDEX app_posts_canonical_map_next_id_idx
  ON app_posts_canonical_map_next (id);
CREATE INDEX app_posts_canonical_map_next_tweet_lid_idx
  ON app_posts_canonical_map_next (tweet_id, lid)
  WHERE tweet_id IS NOT NULL;
CREATE INDEX app_posts_canonical_map_next_lid_idx
  ON app_posts_canonical_map_next (lid);
CREATE INDEX app_posts_canonical_map_next_duplicate_count_idx
  ON app_posts_canonical_map_next (duplicate_count)
  WHERE duplicate_count > 1;
ANALYZE app_posts_canonical_map_next;

\echo Building duplicate audit table from the map...
CREATE UNLOGGED TABLE app_post_duplicate_audit_next AS
SELECT
  m.lid,
  m.tweet_id,
  m.duplicate_count AS raw_rows,
  m.id AS canonical_id,
  m.id AS min_id,
  m.id AS max_id,
  NULL::date AS first_seen,
  NULL::date AS last_seen,
  NULL::bigint AS min_engagement,
  (COALESCE(m.like_count, 0) + COALESCE(m.retweet_count, 0))::bigint AS max_engagement,
  NULL::int AS text_variants
FROM app_posts_canonical_map_next m
WHERE m.tweet_id IS NOT NULL
  AND m.duplicate_count > 1;

CREATE INDEX app_post_duplicate_audit_next_tweet_idx
  ON app_post_duplicate_audit_next (tweet_id);
CREATE INDEX app_post_duplicate_audit_next_lid_idx
  ON app_post_duplicate_audit_next (lid);
CREATE INDEX app_post_duplicate_audit_next_canonical_idx
  ON app_post_duplicate_audit_next (canonical_id);
ANALYZE app_post_duplicate_audit_next;

\echo Swapping canonical post map and view into place...
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relname = 'app_posts_canonical'
      AND c.relkind = 'v'
  ) THEN
    DROP VIEW app_posts_canonical;
  ELSIF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relname = 'app_posts_canonical'
      AND c.relkind = 'r'
  ) THEN
    DROP TABLE app_posts_canonical;
  END IF;
END
$$;

BEGIN;
  DROP TABLE IF EXISTS app_posts_canonical_map;
  ALTER TABLE app_posts_canonical_map_next RENAME TO app_posts_canonical_map;

  ALTER INDEX IF EXISTS app_posts_canonical_map_next_id_idx
    RENAME TO app_posts_canonical_map_id_idx;
  ALTER INDEX IF EXISTS app_posts_canonical_map_next_tweet_lid_idx
    RENAME TO app_posts_canonical_map_tweet_lid_idx;
  ALTER INDEX IF EXISTS app_posts_canonical_map_next_lid_idx
    RENAME TO app_posts_canonical_map_lid_idx;
  ALTER INDEX IF EXISTS app_posts_canonical_map_next_duplicate_count_idx
    RENAME TO app_posts_canonical_map_duplicate_count_idx;

  DROP TABLE IF EXISTS app_post_duplicate_audit;
  ALTER TABLE app_post_duplicate_audit_next RENAME TO app_post_duplicate_audit;

  ALTER INDEX IF EXISTS app_post_duplicate_audit_next_tweet_idx
    RENAME TO app_post_duplicate_audit_tweet_idx;
  ALTER INDEX IF EXISTS app_post_duplicate_audit_next_lid_idx
    RENAME TO app_post_duplicate_audit_lid_idx;
  ALTER INDEX IF EXISTS app_post_duplicate_audit_next_canonical_idx
    RENAME TO app_post_duplicate_audit_canonical_idx;
COMMIT;

DO $$
DECLARE
  select_list text;
BEGIN
  SELECT string_agg(
    CASE
      WHEN a.attname = 'text' THEN 'COALESCE(m.canonical_text, p.text) AS text'
      ELSE 'p.' || quote_ident(a.attname)
    END,
    ', ' ORDER BY a.attnum
  )
  INTO select_list
  FROM pg_attribute a
  WHERE a.attrelid = 'posts'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped;

  EXECUTE format(
    'CREATE VIEW app_posts_canonical AS SELECT %s, m.duplicate_count FROM posts p JOIN app_posts_canonical_map m ON m.id = p.id',
    select_list
  );
END
$$;

ANALYZE app_posts_canonical_map;
ANALYZE app_post_duplicate_audit;

UPDATE app_post_canonical_builds
SET
  status = 'active',
  finished_at = now(),
  raw_post_count = (SELECT count(*) FROM posts),
  canonical_post_count = (SELECT count(*) FROM app_posts_canonical_map),
  duplicate_group_count = (SELECT count(*) FROM app_post_duplicate_audit),
  duplicate_excess_count = (
    SELECT COALESCE(sum(raw_rows - 1), 0)::bigint
    FROM app_post_duplicate_audit
  )
WHERE build_id = :'build_id';

SELECT
  build_id,
  status,
  raw_post_count,
  canonical_post_count,
  duplicate_group_count,
  duplicate_excess_count,
  finished_at
FROM app_post_canonical_builds
WHERE build_id = :'build_id';
