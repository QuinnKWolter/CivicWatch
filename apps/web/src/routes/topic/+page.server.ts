import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';
import { parseDrilldownContext } from '$lib/drilldown';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const context = parseDrilldownContext(url.searchParams);
  const filters = {
    state: context.state,
    party: context.party,
    from: context.from,
    to: context.to
  };
  const [topics, ribbon] = await Promise.all([
    api(fetch, '/topics', filters),
    api(fetch, '/topic-ribbon', { from: context.from, to: context.to })
  ]);
  return { topics, ribbon, context };
};
