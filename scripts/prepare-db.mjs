import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(repoRoot, '.env');
const sqlPath = resolve(repoRoot, 'database/scripts/prepare_explore.sql');

function loadDotEnv(path) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

    const index = trimmed.indexOf('=');
    const name = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[name]) process.env[name] = value;
  }
}

function sslModeFromEnv() {
  const mode = (
    process.env.PGSSLMODE ??
    process.env.DB_SSL ??
    process.env.POSTGRES_SSL ??
    ''
  ).toLowerCase();

  if (mode === 'require' || mode === 'true' || mode === '1') return 'require';
  if (mode === 'prefer' || mode === 'allow' || mode === 'disable') return mode;
  if (mode === 'false' || mode === '0') return 'disable';
  return undefined;
}

loadDotEnv(envPath);

const env = { ...process.env };
const sslMode = sslModeFromEnv();
if (sslMode) env.PGSSLMODE = sslMode;

const host = env.DB_HOST ?? env.POSTGRES_HOST ?? 'localhost';
const port = env.DB_PORT ?? env.POSTGRES_PORT ?? '55432';
const database = env.DB_NAME ?? env.POSTGRES_DB ?? 'civicwatch_explore';
const user = env.DB_USER ?? env.POSTGRES_USER ?? 'postgres';
const password = env.DB_PASSWORD ?? env.POSTGRES_PASSWORD;

if (password && !env.PGPASSWORD) env.PGPASSWORD = password;

const args = env.DATABASE_URL
  ? [env.DATABASE_URL]
  : ['-h', host, '-p', port, '-U', user, '-d', database];

args.push('-v', 'ON_ERROR_STOP=1', '-f', sqlPath);

console.log(
  `Preparing CivicWatch database ${env.DATABASE_URL ? 'from DATABASE_URL' : `${user}@${host}:${port}/${database}`}${sslMode ? ` with sslmode=${sslMode}` : ''}...`
);

const result = spawnSync('psql', args, {
  cwd: repoRoot,
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
