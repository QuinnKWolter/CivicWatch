import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const q = url.searchParams.get('q') ?? undefined;
  const state = url.searchParams.get('state') ?? undefined;
  const party = url.searchParams.get('party') ?? undefined;
  const chamber = url.searchParams.get('chamber') ?? undefined;
  const legislators = await api(fetch, '/legislators', { limit: 6000 });
  return { legislators, q, state, party, chamber };
};
