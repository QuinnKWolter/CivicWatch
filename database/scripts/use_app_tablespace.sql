-- Prefer tablespace civicwatch_app when it exists (typically on /home).
-- Core posts/legislators stay on the default PGDATA volume.

SELECT CASE
  WHEN EXISTS (SELECT 1 FROM pg_tablespace WHERE spcname = 'civicwatch_app')
    THEN set_config('default_tablespace', 'civicwatch_app', false)
  ELSE set_config('default_tablespace', '', false)
END AS default_tablespace_setting;

SELECT CASE
  WHEN EXISTS (SELECT 1 FROM pg_tablespace WHERE spcname = 'civicwatch_app')
    THEN set_config('temp_tablespaces', 'civicwatch_app', false)
  ELSE set_config('temp_tablespaces', '', false)
END AS temp_tablespaces_setting;

SELECT
  current_setting('default_tablespace') AS default_tablespace,
  current_setting('temp_tablespaces') AS temp_tablespaces;

DO $$
DECLARE
  has_app_ts boolean;
  rel text;
  current_ts text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_tablespace WHERE spcname = 'civicwatch_app'
  ) INTO has_app_ts;

  IF NOT has_app_ts THEN
    RAISE NOTICE
      'Tablespace civicwatch_app not found; derived tables will use default PGDATA (%).',
      current_setting('data_directory');
    RETURN;
  END IF;

  FOREACH rel IN ARRAY ARRAY[
    'app_post_canonical_builds',
    'app_posts_canonical_map',
    'app_post_duplicate_audit',
    'app_network_builds',
    'app_legislator_handles',
    'app_post_interactions',
    'app_network_edges'
  ]
  LOOP
    IF to_regclass(format('public.%I', rel)) IS NULL THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(t.spcname, d.spcname)
    INTO current_ts
    FROM pg_class c
    JOIN pg_database db ON db.datname = current_database()
    JOIN pg_tablespace d ON d.oid = db.dattablespace
    LEFT JOIN pg_tablespace t ON t.oid = NULLIF(c.reltablespace, 0)
    WHERE c.oid = to_regclass(format('public.%I', rel));

    IF current_ts IS DISTINCT FROM 'civicwatch_app' THEN
      EXECUTE format('ALTER TABLE %I SET TABLESPACE civicwatch_app', rel);
      RAISE NOTICE 'Moved %.% to tablespace civicwatch_app', 'public', rel;
    END IF;
  END LOOP;
END
$$;
