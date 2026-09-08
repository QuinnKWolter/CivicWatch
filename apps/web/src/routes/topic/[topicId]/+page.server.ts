import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';
import { parseDrilldownContext, removeDrilldownFilter } from '$lib/drilldown';

export const load: PageServerLoad = async ({ fetch, params, url }) => {
  const context = parseDrilldownContext(url.searchParams);
  const filters = {
    state: context.state,
    party: context.party,
    from: context.from,
    to: context.to
  };
  const [topic, topics, ribbon, salience, beeswarm, topPosts, partyChamber, adjacent] = await Promise.all([
    api(fetch, `/topics/${params.topicId}`, filters),
    api(fetch, '/topics', filters),
    api(fetch, `/topics/${params.topicId}/ribbon`, filters),
    api(fetch, `/topics/${params.topicId}/state-salience`, filters),
    api(fetch, `/topics/${params.topicId}/beeswarm`, filters),
    api(fetch, `/topics/${params.topicId}/top-posts`, { limit: 10, ...filters }),
    api(fetch, `/topics/${params.topicId}/party-chamber`, filters),
    api(fetch, `/topics/${params.topicId}/adjacent`, filters)
  ]);
  const currentPath = `${url.pathname}${url.search}`;
  const inheritedFilters = [
    context.state ? { label: 'State', value: context.state, href: removeDrilldownFilter(currentPath, 'state') } : null,
    context.party ? { label: 'Party', value: context.party, href: removeDrilldownFilter(currentPath, 'party') } : null,
    context.from ? { label: 'From', value: context.from, href: removeDrilldownFilter(currentPath, 'from') } : null,
    context.to ? { label: 'To', value: context.to, href: removeDrilldownFilter(currentPath, 'to') } : null,
    context.normalize ? { label: 'Origin scale', value: context.normalize === 'population' ? 'State population' : 'Represented legislators', href: removeDrilldownFilter(currentPath, 'normalize') } : null,
    context.color ? { label: 'Origin color', value: 'Party contribution', href: removeDrilldownFilter(currentPath, 'color') } : null
  ].filter(Boolean);
  return { topic, topics, ribbon, salience, beeswarm, topPosts, partyChamber, adjacent, context, inheritedFilters, clearContextHref: url.pathname };
};
