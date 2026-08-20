-- CivicWatch hydrated tweet integration tables.
-- Additive/non-core: does not modify posts unless the import script is run
-- with --apply-text-updates.

\timing on
\echo Preparing CivicWatch hydration tables...

SET statement_timeout = 0;

CREATE TABLE IF NOT EXISTS app_hydration_imports (
  import_id text PRIMARY KEY,
  source_file text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  attempted_rows bigint NOT NULL DEFAULT 0,
  imported_rows bigint NOT NULL DEFAULT 0,
  ok_text_rows bigint NOT NULL DEFAULT 0,
  tombstone_rows bigint NOT NULL DEFAULT 0,
  not_found_rows bigint NOT NULL DEFAULT 0,
  other_error_rows bigint NOT NULL DEFAULT 0,
  safe_text_update_candidates bigint,
  applied_text_updates bigint,
  notes text
);

CREATE TABLE IF NOT EXISTS app_hydrated_tweets (
  requested_tweet_id text PRIMARY KEY,
  payload_tweet_id text,
  payload_id_matches_requested boolean,
  status text NOT NULL,
  fetched_at timestamptz,
  detail text,
  hydrated_created_at timestamptz,
  hydrated_text text,
  author_user_id text,
  author_screen_name text,
  in_reply_to_status_id text,
  in_reply_to_user_id text,
  in_reply_to_screen_name text,
  parent_tweet_id text,
  parent_user_id text,
  parent_screen_name text,
  quoted_tweet_id text,
  quoted_user_id text,
  quoted_screen_name text,
  mentions jsonb NOT NULL DEFAULT '[]'::jsonb,
  import_id text,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_hydrated_tweet_mentions (
  requested_tweet_id text NOT NULL,
  mentioned_user_id text,
  mentioned_screen_name text NOT NULL,
  mentioned_name text,
  import_id text,
  PRIMARY KEY (requested_tweet_id, mentioned_screen_name)
);

CREATE TABLE IF NOT EXISTS app_hydrated_post_interactions (
  import_id text NOT NULL,
  post_id bigint NOT NULL,
  tweet_id text,
  created_at date NOT NULL,
  topic text NOT NULL,
  source_lid text NOT NULL,
  target_lid text,
  target_handle text NOT NULL,
  interaction_type text NOT NULL,
  target_tweet_id text,
  evidence_text text,
  engagement integer NOT NULL DEFAULT 0,
  confidence text NOT NULL,
  target_match_count integer NOT NULL DEFAULT 0,
  inserted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_hydrated_tweets_payload_idx
  ON app_hydrated_tweets (payload_tweet_id);
CREATE INDEX IF NOT EXISTS app_hydrated_tweets_status_idx
  ON app_hydrated_tweets (status);
CREATE INDEX IF NOT EXISTS app_hydrated_tweets_reply_screen_idx
  ON app_hydrated_tweets (lower(in_reply_to_screen_name));
CREATE INDEX IF NOT EXISTS app_hydrated_tweets_quote_screen_idx
  ON app_hydrated_tweets (lower(quoted_screen_name));
CREATE INDEX IF NOT EXISTS app_hydrated_tweet_mentions_screen_idx
  ON app_hydrated_tweet_mentions (lower(mentioned_screen_name));
CREATE INDEX IF NOT EXISTS app_hydrated_post_interactions_source_idx
  ON app_hydrated_post_interactions (source_lid);
CREATE INDEX IF NOT EXISTS app_hydrated_post_interactions_target_idx
  ON app_hydrated_post_interactions (target_lid);
CREATE INDEX IF NOT EXISTS app_hydrated_post_interactions_topic_idx
  ON app_hydrated_post_interactions (topic);
CREATE INDEX IF NOT EXISTS app_hydrated_post_interactions_type_idx
  ON app_hydrated_post_interactions (interaction_type);
CREATE INDEX IF NOT EXISTS app_hydrated_post_interactions_date_idx
  ON app_hydrated_post_interactions (created_at);

ANALYZE app_hydrated_tweets;
ANALYZE app_hydrated_tweet_mentions;
ANALYZE app_hydrated_post_interactions;
