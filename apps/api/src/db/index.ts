import postgres from 'postgres';

export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres@localhost:55432/civicwatch_explore';

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
