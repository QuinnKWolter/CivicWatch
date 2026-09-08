import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';
import { parseDrilldownContext } from '$lib/drilldown';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const context = parseDrilldownContext(url.searchParams);
  const [states, matrix, topics] = await Promise.all([
    api(fetch, '/states', { topic: context.topic }),
    api(fetch, '/states/small-multiples'),
    api(fetch, '/topics')
  ]);
  return { states, matrix, topics, context };
};
