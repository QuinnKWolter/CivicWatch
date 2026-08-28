import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  describeTarget,
  postgresArgs,
  repoRoot,
  runPsql
} from './lib/pg-env.mjs';

const sqlPath = resolve(repoRoot, 'database/scripts/prepare_canonical_posts.sql');

function usage() {
  console.log(`Usage: node ./scripts/prepare-canonical-posts.mjs [options]

Builds a slim canonical post map and view without copying the posts table.

Options:
  --build-id <id>   Stable build id. Defaults to canonical_posts_YYYYMMDD_HHMMSS.
  -h, --help        Show this help text.

Examples:
  pnpm run db:posts:canonical
  pnpm run db:posts:canonical --build-id demo_refresh
`);
}

function timestampId() {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .replace('T', '_');
}

const options = {
  buildId: `canonical_posts_${timestampId()}`
};

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  const next = () => process.argv[++index] ?? '';

  if (arg === '--') {
    continue;
  } else if (arg === '-h' || arg === '--help') {
    usage();
    process.exit(0);
  } else if (arg === '--build-id') {
    options.buildId = next();
  } else {
    console.error(`Unknown option: ${arg}`);
    usage();
    process.exit(1);
  }
}

if (!/^[A-Za-z0-9_.:-]+$/.test(options.buildId)) {
  console.error('Error: --build-id may contain only letters, numbers, dot, colon, underscore, or dash.');
  process.exit(1);
}

if (!existsSync(sqlPath)) {
  console.error(`Error: ${sqlPath} was not found.`);
  process.exit(1);
}

console.log(`Preparing CivicWatch canonical post table on ${describeTarget()}...`);
console.log(`Build ${options.buildId}; raw posts are preserved.`);

const args = postgresArgs([
  '-v',
  'ON_ERROR_STOP=1',
  '-v',
  `build_id=${options.buildId}`,
  '-f',
  sqlPath
]);

const result = runPsql(args);
process.exit(result.status ?? 1);
