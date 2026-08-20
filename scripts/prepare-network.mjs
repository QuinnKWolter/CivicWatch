import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  describeTarget,
  postgresArgs,
  repoRoot,
  runPsql
} from './lib/pg-env.mjs';

const sqlPath = resolve(repoRoot, 'database/scripts/prepare_network.sql');

function usage() {
  console.log(`Usage: node ./scripts/prepare-network.mjs [options]

Builds derived legislator interaction tables without modifying core posts or
legislators.

Options:
  --build-id <id>   Stable build id. Defaults to network_YYYYMMDD_HHMMSS.
  --from <date>     Include posts on/after YYYY-MM-DD.
  --to <date>       Include posts on/before YYYY-MM-DD.
  --topic <id>      Include only one topic id.
  --state <code>    Include only source legislators in one state.
  --party <name>    Include only source legislators in one party.
  -h, --help        Show this help text.

Examples:
  pnpm run db:network:prepare
  pnpm run db:network:prepare -- --state TX --topic 20
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
  buildId: `network_${timestampId()}`,
  from: '',
  to: '',
  topic: '',
  state: '',
  party: ''
};

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  const next = () => process.argv[++index] ?? '';

  if (arg === '-h' || arg === '--help') {
    usage();
    process.exit(0);
  } else if (arg === '--build-id') {
    options.buildId = next();
  } else if (arg === '--from') {
    options.from = next();
  } else if (arg === '--to') {
    options.to = next();
  } else if (arg === '--topic') {
    options.topic = next();
  } else if (arg === '--state') {
    options.state = next().toUpperCase();
  } else if (arg === '--party') {
    options.party = next();
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

console.log(`Preparing CivicWatch network tables on ${describeTarget()}...`);
console.log(
  `Build ${options.buildId}; filters: ${JSON.stringify({
    from: options.from || null,
    to: options.to || null,
    topic: options.topic || null,
    state: options.state || null,
    party: options.party || null
  })}`
);

const args = postgresArgs([
  '-v',
  'ON_ERROR_STOP=1',
  '-v',
  `build_id=${options.buildId}`,
  '-v',
  `network_from=${options.from}`,
  '-v',
  `network_to=${options.to}`,
  '-v',
  `network_topic=${options.topic}`,
  '-v',
  `network_state=${options.state}`,
  '-v',
  `network_party=${options.party}`,
  '-f',
  sqlPath
]);

const result = runPsql(args);
process.exit(result.status ?? 1);
