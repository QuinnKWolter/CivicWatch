import { existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import {
  describeTarget,
  loadDotEnv,
  postgresEnv,
  repoRoot
} from './lib/pg-env.mjs';

function usage() {
  console.log(`Usage: node ./scripts/restore-db.mjs --dump <path> --yes [options]

Restores a CivicWatch custom-format Postgres dump into the database named by
.env / DATABASE_URL. By default, this refuses non-local database targets.

Options:
  --dump <path>              Path to a .dump file created by pg_dump -F c.
  --yes                      Confirm the destructive restore into the target DB.
  --recreate                 Drop and recreate the target database before restore.
  --maintenance-db <name>    DB used for create/drop checks. Defaults to postgres.
  --force-remote             Allow restoring into a non-local host.
  --skip-prepare             Do not run pnpm run db:prepare after restore.
  --skip-canonical           Do not run pnpm run db:posts:canonical after restore.
  --skip-network-repair      Do not run pnpm run db:network:repair-counts after restore.
  -h, --help                 Show this help text.

Examples:
  pnpm run db:restore -- --dump ./civicwatch_prod_20260911.dump --yes
  pnpm run db:restore -- --dump ./civicwatch_prod_20260911.dump --yes --recreate
`);
}

function die(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  console.log(`> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: options.env ?? process.env,
    shell: process.platform === 'win32',
    stdio: options.stdio ?? 'inherit'
  });

  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) {
    die(`${command} exited with ${result.status ?? 1}.`);
  }

  return result;
}

function runOptional(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    env: options.env ?? process.env,
    shell: process.platform === 'win32',
    stdio: options.stdio ?? 'inherit'
  });
}

function stripQuery(value) {
  return String(value ?? '').split('?')[0];
}

function targetFromEnv() {
  loadDotEnv();
  const { env } = postgresEnv();

  if (env.DATABASE_URL) {
    const url = new URL(env.DATABASE_URL);
    const database = decodeURIComponent(stripQuery(url.pathname).replace(/^\//, ''));
    return {
      env,
      database,
      host: url.hostname || 'localhost',
      port: url.port || '5432',
      user: decodeURIComponent(url.username || env.DB_USER || env.POSTGRES_USER || 'postgres'),
      password: url.password ? decodeURIComponent(url.password) : undefined,
      restoreArgs: ['-d', env.DATABASE_URL],
      connectionArgs: ['-h', url.hostname || 'localhost', '-p', url.port || '5432', '-U', decodeURIComponent(url.username || 'postgres')]
    };
  }

  const host = env.DB_HOST ?? env.POSTGRES_HOST ?? 'localhost';
  const port = env.DB_PORT ?? env.POSTGRES_PORT ?? '55432';
  const database = env.DB_NAME ?? env.POSTGRES_DB ?? 'civicwatch_explore';
  const user = env.DB_USER ?? env.POSTGRES_USER ?? 'postgres';

  return {
    env,
    database,
    host,
    port,
    user,
    password: env.DB_PASSWORD ?? env.POSTGRES_PASSWORD,
    restoreArgs: ['-h', host, '-p', port, '-U', user, '-d', database],
    connectionArgs: ['-h', host, '-p', port, '-U', user]
  };
}

function isLocalHost(host) {
  const normalized = String(host ?? '').toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function pgIdentifierArg(value) {
  if (!/^[A-Za-z0-9_.-]+$/.test(value)) {
    die(`Database name "${value}" contains unsupported characters for this restore script.`);
  }
  return value;
}

function terminateConnections(target, maintenanceDb) {
  if (!isLocalHost(target.host)) return;

  runOptional(
    'psql',
    [
      ...target.connectionArgs,
      '-d',
      maintenanceDb,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = ${sqlLiteral(target.database)}
         AND pid <> pg_backend_pid();`
    ],
    { env: target.env, stdio: 'ignore' }
  );
}

function ensureRepoPostgresCluster(target) {
  if (!isLocalHost(target.host) || String(target.port) !== '55432') return;

  const dataDir = resolve(repoRoot, '.postgres-data');
  const logDir = resolve(repoRoot, '.postgres-log');

  const ready = runOptional('pg_isready', ['-h', target.host, '-p', target.port], {
    env: target.env,
    stdio: 'ignore'
  });

  if ((ready.status ?? 1) === 0) return;

  if (!existsSync(dataDir)) {
    console.log('Initializing repo-managed Postgres cluster at .postgres-data...');
    run('initdb', ['-D', dataDir, '-U', target.user, '--encoding=UTF8'], {
      env: target.env
    });
  }

  mkdirSync(logDir, { recursive: true });

  console.log(`Starting repo-managed Postgres on ${target.host}:${target.port}...`);
  run(
    'pg_ctl',
    [
      '-D',
      dataDir,
      '-o',
      `-p ${target.port} -c listen_addresses=localhost -c shared_buffers=1GB -c work_mem=32MB -c maintenance_work_mem=1GB`,
      '-l',
      resolve(logDir, 'postgres.log'),
      'start'
    ],
    { env: target.env }
  );
}

const options = {
  dump: '',
  yes: false,
  recreate: false,
  maintenanceDb: 'postgres',
  forceRemote: false,
  skipPrepare: false,
  skipCanonical: false,
  skipNetworkRepair: false
};

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  const next = () => process.argv[++index] ?? '';

  if (arg === '--') {
    continue;
  } else if (arg === '--dump') {
    options.dump = next();
  } else if (arg === '--yes') {
    options.yes = true;
  } else if (arg === '--recreate') {
    options.recreate = true;
  } else if (arg === '--maintenance-db') {
    options.maintenanceDb = next();
  } else if (arg === '--force-remote') {
    options.forceRemote = true;
  } else if (arg === '--skip-prepare') {
    options.skipPrepare = true;
  } else if (arg === '--skip-canonical') {
    options.skipCanonical = true;
  } else if (arg === '--skip-network-repair') {
    options.skipNetworkRepair = true;
  } else if (arg === '-h' || arg === '--help') {
    usage();
    process.exit(0);
  } else {
    console.error(`Unknown option: ${arg}`);
    usage();
    process.exit(1);
  }
}

if (!options.dump) {
  usage();
  die('--dump is required.');
}

if (!options.yes) {
  usage();
  die('--yes is required because restore is destructive to the target database.');
}

const dumpPath = resolve(repoRoot, options.dump);
if (!existsSync(dumpPath)) die(`Dump file not found: ${dumpPath}`);

const target = targetFromEnv();
if (target.password && !target.env.PGPASSWORD) target.env.PGPASSWORD = target.password;

if (!options.forceRemote && !isLocalHost(target.host)) {
  die(
    `Refusing to restore into non-local database target ${describeTarget()}. ` +
      'Use --force-remote only if you are intentionally overwriting that database.'
  );
}

pgIdentifierArg(target.database);

console.log(`Restoring ${dumpPath}`);
console.log(`Target: ${describeTarget()}`);
console.log('This will replace objects in the target database.');

run('pg_restore', ['--list', dumpPath], { env: target.env, stdio: 'ignore' });
ensureRepoPostgresCluster(target);

if (options.recreate) {
  const baseArgs = [...target.connectionArgs, '-d', options.maintenanceDb];
  const existsResult = runOptional(
    'psql',
    [
      ...baseArgs,
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
      '-c',
      `SELECT 1 FROM pg_database WHERE datname = ${sqlLiteral(target.database)};`
    ],
    { env: target.env, stdio: 'pipe' }
  );

  if (String(existsResult.stdout ?? '').trim() === '1') {
    terminateConnections(target, options.maintenanceDb);
    run('dropdb', [...target.connectionArgs, '--if-exists', target.database], { env: target.env });
  }

  run('createdb', [...target.connectionArgs, target.database], { env: target.env });
} else {
  const createResult = runOptional('createdb', [...target.connectionArgs, target.database], {
    env: target.env,
    stdio: 'pipe'
  });

  if ((createResult.status ?? 1) === 0) {
    console.log(`Created database ${target.database}.`);
  } else {
    console.log(`Database ${target.database} already exists or could not be created; restoring into existing database.`);
  }
}

run(
  'pg_restore',
  [
    ...target.restoreArgs,
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    '--verbose',
    dumpPath
  ],
  { env: target.env }
);

if (!options.skipPrepare) run('pnpm', ['run', 'db:prepare']);
if (!options.skipCanonical) run('pnpm', ['run', 'db:posts:canonical']);
if (!options.skipNetworkRepair) run('pnpm', ['run', 'db:network:repair-counts']);

console.log('CivicWatch database restore complete.');
