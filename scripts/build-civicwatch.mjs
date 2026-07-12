import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(repoRoot, '.env');

function loadDotEnv(path) {
  if (!existsSync(path)) return;

  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  for (const line of lines) {
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

function pnpmInvocation() {
  const currentExecutor = process.env.npm_execpath;

  if (currentExecutor?.includes('pnpm')) {
    return {
      command: process.execPath,
      prefixArgs: [currentExecutor]
    };
  }

  if (process.platform === 'win32') {
    const pnpmScript = resolve(
      process.env.APPDATA ?? '',
      'npm/node_modules/pnpm/bin/pnpm.cjs'
    );

    if (existsSync(pnpmScript)) {
      return {
        command: process.execPath,
        prefixArgs: [pnpmScript]
      };
    }
  }

  return {
    command: 'pnpm',
    prefixArgs: []
  };
}

const pnpm = pnpmInvocation();

function run(args) {
  const result = spawnSync(pnpm.command, [...pnpm.prefixArgs, ...args], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit'
  });

  if (result.error) {
    console.error(result.error.message);
  }

  if (result.status !== 0) process.exit(result.status ?? 1);
}

loadDotEnv(envPath);

run(['--dir', 'apps/api', 'run', 'build']);
run(['--dir', 'apps/web', 'exec', 'svelte-kit', 'sync']);
run(['--dir', 'apps/web', 'run', 'build']);
