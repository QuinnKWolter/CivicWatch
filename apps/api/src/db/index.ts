import postgres from 'postgres';

function databaseUrlFromEnv() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const host = process.env.DB_HOST ?? process.env.POSTGRES_HOST;
  const port = process.env.DB_PORT ?? process.env.POSTGRES_PORT ?? '5432';
  const name = process.env.DB_NAME ?? process.env.POSTGRES_DB;
  const user = process.env.DB_USER ?? process.env.POSTGRES_USER ?? 'postgres';
  const password = process.env.DB_PASSWORD;

  if (host && name) {
    const auth = password
      ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@`
      : `${encodeURIComponent(user)}@`;
    return `postgres://${auth}${host}:${port}/${name}`;
  }

  return 'postgres://postgres@localhost:55432/civicwatch_explore';
}

export const DATABASE_URL = databaseUrlFromEnv();

export const sql = postgres(DATABASE_URL, {
  max: 12,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
  onnotice: () => {}
});

export async function setReadOnlyDefaults() {
  await sql`SET statement_timeout = '5s'`;
}

export async function closeDb() {
  await sql.end({ timeout: 5 });
}
