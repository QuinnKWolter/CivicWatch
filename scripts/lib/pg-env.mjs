import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function loadDotEnv(path = resolve(repoRoot, '.env')) {
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

    if (process.env[name] === undefined || process.env[name] === '') {
      process.env[name] = value;
    }
  }
}

export function sslModeFromEnv() {
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

export function postgresEnv() {
  loadDotEnv();

  const env = { ...process.env };
  const sslMode = sslModeFromEnv();
  if (sslMode) env.PGSSLMODE = sslMode;

  const password = env.DB_PASSWORD ?? env.POSTGRES_PASSWORD;
  if (password && !env.PGPASSWORD) env.PGPASSWORD = password;

  return { env, sslMode };
}

export function postgresArgs(extra = []) {
  const { env } = postgresEnv();

  if (env.DATABASE_URL) return [env.DATABASE_URL, ...extra];

  const host = env.DB_HOST ?? env.POSTGRES_HOST ?? 'localhost';
  const port = env.DB_PORT ?? env.POSTGRES_PORT ?? '55432';
  const database = env.DB_NAME ?? env.POSTGRES_DB ?? 'civicwatch_explore';
  const user = env.DB_USER ?? env.POSTGRES_USER ?? 'postgres';

  return ['-h', host, '-p', port, '-U', user, '-d', database, ...extra];
}

export function describeTarget() {
  const { env, sslMode } = postgresEnv();

  if (env.DATABASE_URL) {
    return `DATABASE_URL${sslMode ? ` with sslmode=${sslMode}` : ''}`;
  }

  const host = env.DB_HOST ?? env.POSTGRES_HOST ?? 'localhost';
  const port = env.DB_PORT ?? env.POSTGRES_PORT ?? '55432';
  const database = env.DB_NAME ?? env.POSTGRES_DB ?? 'civicwatch_explore';
  const user = env.DB_USER ?? env.POSTGRES_USER ?? 'postgres';
  return `${user}@${host}:${port}/${database}${sslMode ? ` with sslmode=${sslMode}` : ''}`;
}

export function runPsql(args, options = {}) {
  const { env } = postgresEnv();
  const result = spawnSync('psql', args, {
    cwd: repoRoot,
    env,
    shell: false,
    stdio: options.stdio ?? 'inherit',
    input: options.input
  });

  if (result.error) {
    throw result.error;
  }

  return result;
}
