import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  describeTarget,
  postgresArgs,
  repoRoot,
  runPsql
} from './lib/pg-env.mjs';

const sqlPath = resolve(repoRoot, 'database/scripts/repair_network_edge_counts.sql');

function usage() {
  console.log(`Usage: node ./scripts/repair-network-edge-counts.mjs [options]

Recomputes app_network_edges from current app_post_interactions so edge
post_count/engagement use unique canonical posts while raw counts are preserved.
Core posts and legislators tables are not modified.

Options:
  --apply       Write corrected counts to app_network_edges. Default is dry run.
  -h, --help    Show this help text.

Examples:
  pnpm run db:network:repair-counts
  pnpm run db:network:repair-counts -- --apply
`);
}

let apply = false;

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];

  if (arg === '-h' || arg === '--help') {
    usage();
    process.exit(0);
  } else if (arg === '--apply') {
    apply = true;
  } else {
    console.error(`Unknown option: ${arg}`);
    usage();
    process.exit(1);
  }
}

if (!existsSync(sqlPath)) {
  console.error(`Error: ${sqlPath} was not found.`);
  process.exit(1);
}

console.log(`Repairing CivicWatch network edge counts on ${describeTarget()}...`);
console.log(`Mode: ${apply ? 'apply corrections' : 'dry run preview only'}`);

const args = postgresArgs([
  '-v',
  'ON_ERROR_STOP=1',
  '-v',
  `repair_apply=${apply ? 'true' : 'false'}`,
  '-f',
  sqlPath
]);

const result = runPsql(args);
process.exit(result.status ?? 1);
