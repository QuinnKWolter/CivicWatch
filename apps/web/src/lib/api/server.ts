import { env } from '$env/dynamic/private';

const base = env.API_BASE_URL || 'http://localhost:4000/api/v1';

export async function api<T>(fetcher: typeof fetch, path: string, params?: Record<string, unknown>): Promise<T> {
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`CivicWatch API ${response.status} for ${url.pathname}`);
  }
  return response.json() as Promise<T>;
}
