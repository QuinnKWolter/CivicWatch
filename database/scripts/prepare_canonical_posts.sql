\timing on
\echo Preparing CivicWatch canonical post tables...

SET statement_timeout = 0;

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

DROP TABLE IF EXISTS app_posts_canonical_next;
DROP TABLE IF EXISTS app_post_duplicate_audit_next;

\echo Ranking duplicate tweet rows...
CREATE UNLOGGED TABLE app_posts_canonical_next AS
WITH ranked AS (
  SELECT
    p.*,
    first_value(p.text) OVER (
      PARTITION BY p.lid, COALESCE(p.tweet_id, 'row:' || p.id::text)
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
    count(*) OVER (
      PARTITION BY p.lid, COALESCE(p.tweet_id, 'row:' || p.id::text)
    )::int AS duplicate_count,
    row_number() OVER (
      PARTITION BY p.lid, COALESCE(p.tweet_id, 'row:' || p.id::text)
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
)
SELECT *
FROM ranked
WHERE canonical_rank = 1;

UPDATE app_posts_canonical_next
SET text = canonical_text
WHERE canonical_text IS NOT NULL;

ALTER TABLE app_posts_canonical_next DROP COLUMN canonical_rank;
ALTER TABLE app_posts_canonical_next DROP COLUMN canonical_text;

\echo Indexing canonical post table...
CREATE UNIQUE INDEX app_posts_canonical_next_id_idx ON app_posts_canonical_next (id);
CREATE INDEX app_posts_canonical_next_tweet_lid_idx
  ON app_posts_canonical_next (tweet_id, lid)
  WHERE tweet_id IS NOT NULL;
CREATE INDEX app_posts_canonical_next_lid_created_idx
  ON app_posts_canonical_next (lid, created_at DESC, id DESC);
CREATE INDEX app_posts_canonical_next_lid_engagement_idx
  ON app_posts_canonical_next (lid, ((like_count + retweet_count)) DESC, id DESC);
CREATE INDEX app_posts_canonical_next_topic_engagement_idx
  ON app_posts_canonical_next (topic, ((like_count + retweet_count)) DESC, id DESC);
CREATE INDEX app_posts_canonical_next_created_id_desc_idx
  ON app_posts_canonical_next (created_at DESC, id DESC);
CREATE INDEX app_posts_canonical_next_duplicate_count_idx
  ON app_posts_canonical_next (duplicate_count)
  WHERE duplicate_count > 1;
ANALYZE app_posts_canonical_next;

\echo Building duplicate audit table...
CREATE UNLOGGED TABLE app_post_duplicate_audit_next AS
SELECT
  p.lid,
  p.tweet_id,
  count(*)::int AS raw_rows,
  (array_agg(
    p.id
    ORDER BY
      (
        COALESCE(p.like_count, 0) +
        COALESCE(p.retweet_count, 0) +
        COALESCE(p.reply_count, 0) +
        COALESCE(p.quote_count, 0)
      ) DESC,
      length(COALESCE(p.text, '')) DESC,
      p.id DESC
  ))[1] AS canonical_id,
  min(p.id) AS min_id,
  max(p.id) AS max_id,
  min(p.created_at) AS first_seen,
  max(p.created_at) AS last_seen,
  min(COALESCE(p.like_count, 0) + COALESCE(p.retweet_count, 0))::bigint AS min_engagement,
  max(COALESCE(p.like_count, 0) + COALESCE(p.retweet_count, 0))::bigint AS max_engagement,
  count(DISTINCT p.text)::int AS text_variants
FROM posts p
WHERE p.tweet_id IS NOT NULL
GROUP BY p.lid, p.tweet_id
HAVING count(*) > 1;

CREATE INDEX app_post_duplicate_audit_next_tweet_idx
  ON app_post_duplicate_audit_next (tweet_id);
CREATE INDEX app_post_duplicate_audit_next_lid_idx
  ON app_post_duplicate_audit_next (lid);
CREATE INDEX app_post_duplicate_audit_next_canonical_idx
  ON app_post_duplicate_audit_next (canonical_id);
ANALYZE app_post_duplicate_audit_next;

\echo Swapping canonical post tables into place...
BEGIN;
  DROP TABLE IF EXISTS app_posts_canonical;
  ALTER TABLE app_posts_canonical_next RENAME TO app_posts_canonical;

  DROP TABLE IF EXISTS app_post_duplicate_audit;
  ALTER TABLE app_post_duplicate_audit_next RENAME TO app_post_duplicate_audit;

  UPDATE app_post_canonical_builds
  SET
    status = 'active',
    finished_at = now(),
    raw_post_count = (SELECT count(*) FROM posts),
    canonical_post_count = (SELECT count(*) FROM app_posts_canonical),
    duplicate_group_count = (SELECT count(*) FROM app_post_duplicate_audit),
    duplicate_excess_count = (
      SELECT COALESCE(sum(raw_rows - 1), 0)::bigint
      FROM app_post_duplicate_audit
    )
  WHERE build_id = :'build_id';
COMMIT;

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
