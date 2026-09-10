import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';

const base = env.API_BASE_URL || 'http://localhost:4000/api/v1';

export async function api<T>(fetcher: typeof fetch, path: string, params?: Record<string, unknown>): Promise<T> {
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  const headers = new Headers();
  if (env.CIVICWATCH_INTERNAL_TOKEN) {
    headers.set('x-civicwatch-internal-token', env.CIVICWATCH_INTERNAL_TOKEN);
  }
  const response = await fetcher(url, { headers });
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after');
    const detail = await response.json().catch(() => null);
    const message =
      response.status === 429
        ? `CivicWatch is receiving heavy traffic. Please try again${retryAfter ? ` in ${retryAfter} seconds` : ' shortly'}.`
        : detail?.error?.message ?? `CivicWatch API ${response.status} for ${url.pathname}`;
    throw error(response.status, message);
  }
  return response.json() as Promise<T>;
}
