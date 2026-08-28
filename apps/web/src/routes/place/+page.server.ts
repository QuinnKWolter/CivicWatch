import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const topic = url.searchParams.get('topic') ?? undefined;
  const party = url.searchParams.get('party') ?? undefined;
  const [states, matrix, topics] = await Promise.all([
    api(fetch, '/states', { topic }),
    api(fetch, '/states/small-multiples'),
    api(fetch, '/topics')
  ]);
  return { states, matrix, topics, context: { topic, party } };
};
