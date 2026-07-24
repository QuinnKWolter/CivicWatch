import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';
import { parseDrilldownContext, removeDrilldownFilter } from '$lib/drilldown';

export const load: PageServerLoad = async ({ fetch, params, url }) => {
  const lid = encodeURIComponent(params.lid);
  const context = parseDrilldownContext(url.searchParams);
  const filters = { topic: context.topic };

  const profile = await api(fetch, `/legislators/${lid}`, filters);

  const [fingerprint, posts, topPosts] = await Promise.all([
    api(fetch, `/legislators/${lid}/voice-fingerprint`, filters).catch(() => ({
      data: [],
      meta: {
        sourceTable: 'app_legislator_topic',
        filters: { lid: params.lid }
      }
    })),
    api(fetch, `/legislators/${lid}/posts`, { limit: 20, ...filters }).catch(() => ({
      data: [],
      meta: {
        sourceTable: 'posts',
        filters: { lid: params.lid, limit: 20 }
      }
    })),
    api(fetch, `/legislators/${lid}/posts`, { limit: 10, sort: 'engagement', ...filters }).catch(() => ({
      data: [],
      meta: {
        sourceTable: 'posts',
        filters: { lid: params.lid, limit: 10, sort: 'engagement' }
      }
    }))
  ]);

  const currentPath = `${url.pathname}${url.search}`;
  const topicLabel = context.topic
    ? fingerprint.data?.[0]?.topicLabel ?? `Topic ${context.topic}`
    : '';
  const inheritedFilters = [
    context.topic ? { label: 'Topic', value: topicLabel, href: removeDrilldownFilter(currentPath, 'topic') } : null,
    context.party ? { label: 'Party', value: context.party, href: removeDrilldownFilter(currentPath, 'party') } : null,
    context.normalize ? { label: 'Origin scale', value: context.normalize === 'population' ? 'State population' : 'Represented legislators', href: removeDrilldownFilter(currentPath, 'normalize') } : null,
    context.color ? { label: 'Origin color', value: 'Party contribution', href: removeDrilldownFilter(currentPath, 'color') } : null
  ].filter(Boolean);

  return { profile, fingerprint, posts, topPosts, context, inheritedFilters, clearContextHref: url.pathname };
};
