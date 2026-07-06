import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const slots = url.searchParams.get('slots') ?? 'topic:20,state:TX';
  const compare = await api(fetch, '/compare', { slots });
  return { compare, slots };
};
