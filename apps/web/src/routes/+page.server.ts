import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const seed = url.searchParams.get('seed') ?? 'landing';
  const [chamber, sampler, topics, states] = await Promise.all([
    api(fetch, '/chamber'),
    api(fetch, '/sampler', { seed, n: 4 }),
    api(fetch, '/topics'),
    api(fetch, '/states')
  ]);
  return { chamber, sampler, topics, states, seed };
};
