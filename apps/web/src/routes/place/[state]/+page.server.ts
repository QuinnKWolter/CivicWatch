import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';
import { parseDrilldownContext, removeDrilldownFilter } from '$lib/drilldown';

export const load: PageServerLoad = async ({ fetch, params, url }) => {
  const context = parseDrilldownContext(url.searchParams);
  const filters = { topic: context.topic, party: context.party };
  const [summary, topics, topPosts, chamber, trend] = await Promise.all([
    api<any>(fetch, `/states/${params.state}`, filters),
    api<any>(fetch, `/states/${params.state}/topics`, filters),
    api<any>(fetch, `/states/${params.state}/top-posts`, { limit: 10, ...filters }),
    api<any>(fetch, '/chamber', { state: params.state.toUpperCase(), party: context.party, topic: context.topic }),
    api<any>(fetch, `/states/${params.state}/trend`, filters)
  ]);
  const currentPath = `${url.pathname}${url.search}`;
  const topicLabel = context.topic
    ? topics?.data?.find?.((row: any) => String(row.topic) === context.topic)?.topic_label ?? `Topic ${context.topic}`
    : '';
  const inheritedFilters = [
    context.topic ? { label: 'Topic', value: topicLabel, href: removeDrilldownFilter(currentPath, 'topic') } : null,
    context.party ? { label: 'Party', value: context.party, href: removeDrilldownFilter(currentPath, 'party') } : null,
    context.normalize ? { label: 'Origin scale', value: context.normalize === 'population' ? 'State population' : 'Represented legislators', href: removeDrilldownFilter(currentPath, 'normalize') } : null,
    context.color ? { label: 'Origin color', value: 'Party contribution', href: removeDrilldownFilter(currentPath, 'color') } : null
  ].filter(Boolean);
  return { summary, topics, topPosts, chamber, trend, state: params.state.toUpperCase(), context, inheritedFilters, clearContextHref: url.pathname };
};
