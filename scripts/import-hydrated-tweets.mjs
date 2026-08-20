import { createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

import {
  describeTarget,
  postgresArgs,
  repoRoot,
  runPsql
} from './lib/pg-env.mjs';

const schemaSqlPath = resolve(repoRoot, 'database/scripts/prepare_hydration.sql');
const defaultFile = resolve(repoRoot, 'tweet-hydration/hydrated_tweets.jsonl');

const columns = [
  'requested_tweet_id',
  'payload_tweet_id',
  'payload_id_matches_requested',
  'status',
  'fetched_at',
  'detail',
  'hydrated_created_at',
  'hydrated_text',
  'author_user_id',
  'author_screen_name',
  'in_reply_to_status_id',
  'in_reply_to_user_id',
  'in_reply_to_screen_name',
  'parent_tweet_id',
  'parent_user_id',
  'parent_screen_name',
  'quoted_tweet_id',
  'quoted_user_id',
  'quoted_screen_name',
  'mentions',
  'import_id'
];

function usage() {
  console.log(`Usage: node ./scripts/import-hydrated-tweets.mjs [options]

Imports hydrated tweet metadata into app_hydrated_* tables. By default this
does not update posts.text; it only reports safe text-update candidates.

Options:
  --file <path>            JSONL file. Defaults to tweet-hydration/hydrated_tweets.jsonl.
  --import-id <id>         Stable import id. Defaults to hydration_YYYYMMDD_HHMMSS.
  --batch-size <n>         COPY rows per batch. Default: 5000.
  --limit <n>              Import only first n JSONL records.
  --refresh-only           Skip JSONL import and rebuild derived hydrated
                           interaction tables for an existing import id.
  --apply-text-updates     Update posts.text when the current text is an exact
                           prefix of hydrated text and payload id matches.
  -h, --help               Show this help text.

Examples:
  pnpm run db:hydration:import -- --file tweet-hydration/hydrated_tweets.jsonl --limit 1000
  pnpm run db:hydration:import -- --apply-text-updates
`);
}

function timestampId(prefix) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .replace('T', '_');
  return `${prefix}_${stamp}`;
}

const options = {
  file: defaultFile,
  importId: timestampId('hydration'),
  batchSize: 5000,
  limit: null,
  refreshOnly: false,
  applyTextUpdates: false
};

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  const next = () => process.argv[++index] ?? '';

  if (arg === '-h' || arg === '--help') {
    usage();
    process.exit(0);
  } else if (arg === '--file') {
    options.file = resolve(repoRoot, next());
  } else if (arg === '--import-id') {
    options.importId = next();
  } else if (arg === '--batch-size') {
    options.batchSize = Math.max(1, Number(next()) || 5000);
  } else if (arg === '--limit') {
    options.limit = Math.max(1, Number(next()) || 0);
  } else if (arg === '--refresh-only') {
    options.refreshOnly = true;
  } else if (arg === '--apply-text-updates') {
    options.applyTextUpdates = true;
  } else {
    console.error(`Unknown option: ${arg}`);
    usage();
    process.exit(1);
  }
}

if (!/^[A-Za-z0-9_.:-]+$/.test(options.importId)) {
  console.error('Error: --import-id may contain only letters, numbers, dot, colon, underscore, or dash.');
  process.exit(1);
}

if (!options.refreshOnly && !existsSync(options.file)) {
  console.error(`Error: hydration JSONL was not found at ${options.file}`);
  process.exit(1);
}

if (!existsSync(schemaSqlPath)) {
  console.error(`Error: ${schemaSqlPath} was not found.`);
  process.exit(1);
}

function cleanText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function boolValue(value) {
  if (value === true) return 'true';
  if (value === false) return 'false';
  return null;
}

function copyEscape(value) {
  if (value === null || value === undefined) return String.raw`\N`;
  return String(value)
    .replace(/\\/g, String.raw`\\`)
    .replace(/\t/g, String.raw`\t`)
    .replace(/\r/g, String.raw`\r`)
    .replace(/\n/g, String.raw`\n`);
}

function jsonValue(value) {
  return JSON.stringify(value ?? []);
}

function normalizeMention(mention) {
  const screenName = cleanText(mention?.screen_name);
  if (!screenName) return null;

  return {
    id_str: cleanText(mention?.id_str),
    screen_name: screenName,
    name: cleanText(mention?.name)
  };
}

function rowFromHydrated(obj) {
  const meta = obj?._meta ?? {};
  const requestedId = cleanText(meta.requested_id);
  if (!requestedId) return null;

  const status = cleanText(meta.status) ?? 'unknown';
  const payloadTweetId = cleanText(meta.payload_id_str ?? obj.id_str);
  const payloadMatches =
    meta.payload_id_matches_requested ??
    (payloadTweetId ? payloadTweetId === requestedId : null);
  const quoted = obj?.quoted_tweet ?? null;
  const parent = obj?.parent ?? null;
  const mentions = Array.isArray(obj?.entities?.user_mentions)
    ? obj.entities.user_mentions.map(normalizeMention).filter(Boolean)
    : [];

  return [
    requestedId,
    payloadTweetId,
    boolValue(payloadMatches),
    status,
    cleanText(meta.fetched_at),
    cleanText(meta.detail ?? obj?.tombstone?.text?.text),
    cleanText(obj?.created_at),
    status === 'ok_text' ? cleanText(obj?.text) : null,
    cleanText(obj?.user?.id_str),
    cleanText(obj?.user?.screen_name),
    cleanText(obj?.in_reply_to_status_id_str),
    cleanText(obj?.in_reply_to_user_id_str),
    cleanText(obj?.in_reply_to_screen_name),
    cleanText(parent?.id_str),
    cleanText(parent?.user?.id_str),
    cleanText(parent?.user?.screen_name),
    cleanText(quoted?.id_str),
    cleanText(quoted?.user?.id_str),
    cleanText(quoted?.user?.screen_name),
    jsonValue(mentions),
    options.importId
  ];
}

function runSqlText(sql) {
  const result = runPsql(postgresArgs(['-v', 'ON_ERROR_STOP=1']), {
    input: `SET statement_timeout = 0;\n${sql}`,
    stdio: ['pipe', 'inherit', 'inherit']
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
}

function copyBatch(rows) {
  if (!rows.length) return;

  const data = rows.map((row) => row.map(copyEscape).join('\t')).join('\n');
  const quotedColumns = columns.join(', ');
  const sql = `
DROP TABLE IF EXISTS hydration_import_stage;
CREATE TEMP TABLE hydration_import_stage (LIKE app_hydrated_tweets INCLUDING DEFAULTS);
COPY hydration_import_stage (${quotedColumns}) FROM STDIN WITH (FORMAT text, DELIMITER E'\\t', NULL '\\N');
${data}
\\.
INSERT INTO app_hydrated_tweets (${quotedColumns})
SELECT ${quotedColumns}
FROM hydration_import_stage
ON CONFLICT (requested_tweet_id) DO UPDATE
SET
  payload_tweet_id = EXCLUDED.payload_tweet_id,
  payload_id_matches_requested = EXCLUDED.payload_id_matches_requested,
  status = EXCLUDED.status,
  fetched_at = EXCLUDED.fetched_at,
  detail = EXCLUDED.detail,
  hydrated_created_at = EXCLUDED.hydrated_created_at,
  hydrated_text = EXCLUDED.hydrated_text,
  author_user_id = EXCLUDED.author_user_id,
  author_screen_name = EXCLUDED.author_screen_name,
  in_reply_to_status_id = EXCLUDED.in_reply_to_status_id,
  in_reply_to_user_id = EXCLUDED.in_reply_to_user_id,
  in_reply_to_screen_name = EXCLUDED.in_reply_to_screen_name,
  parent_tweet_id = EXCLUDED.parent_tweet_id,
  parent_user_id = EXCLUDED.parent_user_id,
  parent_screen_name = EXCLUDED.parent_screen_name,
  quoted_tweet_id = EXCLUDED.quoted_tweet_id,
  quoted_user_id = EXCLUDED.quoted_user_id,
  quoted_screen_name = EXCLUDED.quoted_screen_name,
  mentions = EXCLUDED.mentions,
  import_id = EXCLUDED.import_id,
  imported_at = now();
`;

  runSqlText(sql);
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function refreshDerivedSql() {
  const importId = sqlLiteral(options.importId);

  return `
\\timing on
\\echo Refreshing hydrated mention table...
TRUNCATE app_hydrated_tweet_mentions;

INSERT INTO app_hydrated_tweet_mentions (
  requested_tweet_id,
  mentioned_user_id,
  mentioned_screen_name,
  mentioned_name,
  import_id
)
SELECT DISTINCT
  h.requested_tweet_id,
  mention->>'id_str',
  lower(mention->>'screen_name'),
  mention->>'name',
  h.import_id
FROM app_hydrated_tweets h
CROSS JOIN LATERAL jsonb_array_elements(h.mentions) AS mention
WHERE h.status = 'ok_text'
  AND mention ? 'screen_name'
  AND NULLIF(mention->>'screen_name', '') IS NOT NULL;

\\echo Refreshing hydrated post interaction table...
TRUNCATE app_hydrated_post_interactions;

WITH raw_handles AS (
  SELECT lid, handle AS handle FROM legislators
  UNION ALL SELECT lid, handle_1 FROM legislators
  UNION ALL SELECT lid, handle_2 FROM legislators
  UNION ALL SELECT lid, camphand FROM legislators
  UNION ALL SELECT lid, offhand FROM legislators
  UNION ALL SELECT lid, perhand FROM legislators
  UNION ALL SELECT lid, CASE WHEN name LIKE '@%' THEN name ELSE NULL END FROM legislators
), handle_match AS (
  SELECT
    lower(regexp_replace(btrim(handle), '^@', '')) AS handle_norm,
    CASE WHEN count(DISTINCT lid) = 1 THEN min(lid) END AS target_lid,
    count(DISTINCT lid)::integer AS match_count
  FROM raw_handles
  WHERE handle IS NOT NULL
    AND btrim(handle) <> ''
    AND lower(btrim(handle)) NOT IN ('nan', 'na', 'n/a', 'null', 'none', '|na|na|na')
    AND lower(regexp_replace(btrim(handle), '^@', '')) ~ '^[a-z0-9_]{1,15}$'
  GROUP BY lower(regexp_replace(btrim(handle), '^@', ''))
), native_mentions AS (
  SELECT
    h.import_id,
    p.id AS post_id,
    p.tweet_id,
    p.created_at,
    p.topic,
    p.lid AS source_lid,
    hm.target_lid,
    lower(m.mentioned_screen_name) AS target_handle,
    'hydrated_mention' AS interaction_type,
    NULL::text AS target_tweet_id,
    left(h.hydrated_text, 500) AS evidence_text,
    COALESCE(p.like_count, 0) + COALESCE(p.retweet_count, 0) AS engagement,
    CASE
      WHEN hm.match_count = 1 THEN 'known_legislator_handle'
      WHEN hm.match_count > 1 THEN 'ambiguous_legislator_handle'
      ELSE 'external_or_unknown_handle'
    END AS confidence,
    COALESCE(hm.match_count, 0) AS target_match_count
  FROM app_hydrated_tweets h
  JOIN posts p ON p.tweet_id = h.requested_tweet_id
  JOIN app_hydrated_tweet_mentions m ON m.requested_tweet_id = h.requested_tweet_id
  LEFT JOIN handle_match hm ON hm.handle_norm = lower(m.mentioned_screen_name)
  WHERE h.status = 'ok_text'
), native_replies AS (
  SELECT
    h.import_id,
    p.id AS post_id,
    p.tweet_id,
    p.created_at,
    p.topic,
    p.lid AS source_lid,
    hm.target_lid,
    lower(h.in_reply_to_screen_name) AS target_handle,
    'hydrated_reply' AS interaction_type,
    h.in_reply_to_status_id AS target_tweet_id,
    left(h.hydrated_text, 500) AS evidence_text,
    COALESCE(p.like_count, 0) + COALESCE(p.retweet_count, 0) AS engagement,
    CASE
      WHEN hm.match_count = 1 THEN 'known_legislator_handle'
      WHEN hm.match_count > 1 THEN 'ambiguous_legislator_handle'
      ELSE 'external_or_unknown_handle'
    END AS confidence,
    COALESCE(hm.match_count, 0) AS target_match_count
  FROM app_hydrated_tweets h
  JOIN posts p ON p.tweet_id = h.requested_tweet_id
  LEFT JOIN handle_match hm ON hm.handle_norm = lower(h.in_reply_to_screen_name)
  WHERE h.status = 'ok_text'
    AND NULLIF(h.in_reply_to_screen_name, '') IS NOT NULL
), native_quotes AS (
  SELECT
    h.import_id,
    p.id AS post_id,
    p.tweet_id,
    p.created_at,
    p.topic,
    p.lid AS source_lid,
    hm.target_lid,
    lower(h.quoted_screen_name) AS target_handle,
    'hydrated_quote' AS interaction_type,
    h.quoted_tweet_id AS target_tweet_id,
    left(h.hydrated_text, 500) AS evidence_text,
    COALESCE(p.like_count, 0) + COALESCE(p.retweet_count, 0) AS engagement,
    CASE
      WHEN hm.match_count = 1 THEN 'known_legislator_handle'
      WHEN hm.match_count > 1 THEN 'ambiguous_legislator_handle'
      ELSE 'external_or_unknown_handle'
    END AS confidence,
    COALESCE(hm.match_count, 0) AS target_match_count
  FROM app_hydrated_tweets h
  JOIN posts p ON p.tweet_id = h.requested_tweet_id
  LEFT JOIN handle_match hm ON hm.handle_norm = lower(h.quoted_screen_name)
  WHERE h.status = 'ok_text'
    AND NULLIF(h.quoted_screen_name, '') IS NOT NULL
)
INSERT INTO app_hydrated_post_interactions (
  import_id,
  post_id,
  tweet_id,
  created_at,
  topic,
  source_lid,
  target_lid,
  target_handle,
  interaction_type,
  target_tweet_id,
  evidence_text,
  engagement,
  confidence,
  target_match_count
)
SELECT *
FROM (
  SELECT * FROM native_mentions
  UNION ALL
  SELECT * FROM native_replies
  UNION ALL
  SELECT * FROM native_quotes
) interactions
WHERE COALESCE(target_lid, '') <> source_lid;

ANALYZE app_hydrated_tweets;
ANALYZE app_hydrated_tweet_mentions;
ANALYZE app_hydrated_post_interactions;
`;
}

function textUpdateSql() {
  const importId = sqlLiteral(options.importId);
  const apply = options.applyTextUpdates;

  return `
\\timing on
WITH candidates AS (
  SELECT p.id
  FROM posts p
  JOIN app_hydrated_tweets h ON h.requested_tweet_id = p.tweet_id
  WHERE h.status = 'ok_text'
    AND h.import_id = ${importId}
    AND h.payload_id_matches_requested IS TRUE
    AND h.hydrated_text IS NOT NULL
    AND p.text IS NOT NULL
    AND h.hydrated_text <> p.text
    AND char_length(h.hydrated_text) > char_length(p.text)
    AND left(h.hydrated_text, char_length(p.text)) = p.text
), candidate_count AS (
  SELECT count(*)::bigint AS n FROM candidates
), updated AS (
  ${apply ? `
  UPDATE posts p
  SET text = h.hydrated_text
  FROM app_hydrated_tweets h
  WHERE h.requested_tweet_id = p.tweet_id
    AND h.status = 'ok_text'
    AND h.import_id = ${importId}
    AND h.payload_id_matches_requested IS TRUE
    AND h.hydrated_text IS NOT NULL
    AND p.text IS NOT NULL
    AND h.hydrated_text <> p.text
    AND char_length(h.hydrated_text) > char_length(p.text)
    AND left(h.hydrated_text, char_length(p.text)) = p.text
  RETURNING p.id
  ` : `
  SELECT NULL::bigint AS id WHERE false
  `}
), updated_count AS (
  SELECT count(*)::bigint AS n FROM updated
)
UPDATE app_hydration_imports
SET
  safe_text_update_candidates = (SELECT n FROM candidate_count),
  applied_text_updates = (SELECT n FROM updated_count)
WHERE import_id = ${importId};

SELECT
  ${apply ? `'applied'` : `'dry_run'`} AS text_update_mode,
  safe_text_update_candidates,
  applied_text_updates
FROM app_hydration_imports
WHERE import_id = ${importId};
`;
}

function finalStatsSql(stats) {
  const importId = sqlLiteral(options.importId);

  const statsAssignments = stats
    ? `
  attempted_rows = ${stats.attempted},
  imported_rows = ${stats.imported},
  ok_text_rows = ${stats.ok_text},
  tombstone_rows = ${stats.tombstone},
  not_found_rows = ${stats.not_found},
  other_error_rows = ${stats.other_error + stats.parse_error},
  notes = ${sqlLiteral(stats.parse_error ? `${stats.parse_error} JSONL parse errors skipped.` : 'Import completed.')}`
    : `
  attempted_rows = (SELECT count(*)::bigint FROM app_hydrated_tweets WHERE import_id = ${importId}),
  imported_rows = (SELECT count(*)::bigint FROM app_hydrated_tweets WHERE import_id = ${importId}),
  ok_text_rows = (SELECT count(*)::bigint FROM app_hydrated_tweets WHERE import_id = ${importId} AND status = 'ok_text'),
  tombstone_rows = (SELECT count(*)::bigint FROM app_hydrated_tweets WHERE import_id = ${importId} AND status = 'tombstone'),
  not_found_rows = (SELECT count(*)::bigint FROM app_hydrated_tweets WHERE import_id = ${importId} AND status = 'not_found'),
  other_error_rows = (
    SELECT count(*)::bigint
    FROM app_hydrated_tweets
    WHERE import_id = ${importId}
      AND status NOT IN ('ok_text', 'tombstone', 'not_found')
  ),
  notes = 'Refresh-only finalization completed from already imported hydrated rows.'`;

  return `
UPDATE app_hydration_imports
SET
  finished_at = now(),
  status = 'complete',
${statsAssignments}
WHERE import_id = ${importId};

SELECT
  import_id,
  status,
  attempted_rows,
  imported_rows,
  ok_text_rows,
  tombstone_rows,
  not_found_rows,
  other_error_rows,
  safe_text_update_candidates,
  applied_text_updates,
  finished_at
FROM app_hydration_imports
WHERE import_id = ${importId};

SELECT
  'hydrated_interactions' AS relation,
  interaction_type,
  count(*)::bigint AS rows,
  count(*) FILTER (WHERE target_lid IS NOT NULL)::bigint AS legislator_targets
FROM app_hydrated_post_interactions
GROUP BY interaction_type
ORDER BY interaction_type;
`;
}

async function main() {
  console.log(`Preparing hydration tables on ${describeTarget()}...`);
  let result = runPsql(postgresArgs(['-v', 'ON_ERROR_STOP=1', '-f', schemaSqlPath]));
  if (result.status !== 0) process.exit(result.status ?? 1);

  if (options.refreshOnly) {
    runSqlText(`
UPDATE app_hydration_imports
SET
  started_at = now(),
  finished_at = NULL,
  status = 'refreshing',
  notes = 'Refresh-only recovery: rebuilding derived hydrated interaction tables without rereading JSONL.'
WHERE import_id = ${sqlLiteral(options.importId)};

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app_hydration_imports WHERE import_id = ${sqlLiteral(options.importId)}
  ) THEN
    RAISE EXCEPTION 'Unknown hydration import id: %', ${sqlLiteral(options.importId)};
  END IF;
END $$;
`);
  } else {
    runSqlText(`
INSERT INTO app_hydration_imports (import_id, source_file, status, notes)
VALUES (
  ${sqlLiteral(options.importId)},
  ${sqlLiteral(options.file)},
  'running',
  ${sqlLiteral(options.applyTextUpdates ? 'Import will apply conservative text updates.' : 'Dry run: importing metadata but not updating posts.text.')}
)
ON CONFLICT (import_id) DO UPDATE
SET
  source_file = EXCLUDED.source_file,
  started_at = now(),
  finished_at = NULL,
  status = 'running',
  attempted_rows = 0,
  imported_rows = 0,
  ok_text_rows = 0,
  tombstone_rows = 0,
  not_found_rows = 0,
  other_error_rows = 0,
  safe_text_update_candidates = NULL,
  applied_text_updates = NULL,
  notes = EXCLUDED.notes;
`);
  }

  console.log(`Import id: ${options.importId}`);
  if (!options.refreshOnly) {
    console.log(`Importing ${options.file}`);
    console.log(`Batch size: ${options.batchSize}`);
  } else {
    console.log('Mode: refresh already imported hydrated rows');
  }
  console.log(`Text updates: ${options.applyTextUpdates ? 'APPLY conservative updates' : 'dry run only'}`);

  let stats = null;

  if (!options.refreshOnly) {
    stats = {
    attempted: 0,
    imported: 0,
    ok_text: 0,
    tombstone: 0,
    not_found: 0,
    other_error: 0,
    parse_error: 0
    };
    let batch = [];

    const rl = createInterface({
      input: createReadStream(options.file, { encoding: 'utf8' }),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      if (options.limit && stats.attempted >= options.limit) break;

      stats.attempted += 1;

      try {
        const row = rowFromHydrated(JSON.parse(line));
        if (!row) continue;

        const status = row[3];
        if (status === 'ok_text') stats.ok_text += 1;
        else if (status === 'tombstone') stats.tombstone += 1;
        else if (status === 'not_found') stats.not_found += 1;
        else stats.other_error += 1;

        batch.push(row);
        stats.imported += 1;
      } catch {
        stats.parse_error += 1;
      }

      if (batch.length >= options.batchSize) {
        copyBatch(batch);
        batch = [];
        console.log(`Imported ${stats.imported.toLocaleString()} rows...`);
      }
    }

    copyBatch(batch);
  }

  console.log('Refreshing hydrated mention/reply/quote interaction tables...');
  runSqlText(refreshDerivedSql());

  console.log(options.applyTextUpdates
    ? 'Applying conservative text updates...'
    : 'Computing conservative text-update candidates...');
  runSqlText(textUpdateSql());

  runSqlText(finalStatsSql(stats));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
