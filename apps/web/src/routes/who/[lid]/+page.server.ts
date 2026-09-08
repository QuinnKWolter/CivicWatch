import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';
import { parseDrilldownContext, removeDrilldownFilter } from '$lib/drilldown';

export const load: PageServerLoad = async ({ fetch, params, url }) => {
  const lid = encodeURIComponent(params.lid);
  const context = parseDrilldownContext(url.searchParams);
  const filters = { topic: context.topic, from: context.from, to: context.to };

  const profile = await api<any>(fetch, `/legislators/${lid}`, { topic: context.topic });

  const [fingerprint, posts, topPosts, network] = await Promise.all([
    api<any>(fetch, `/legislators/${lid}/voice-fingerprint`, filters).catch(() => ({
      data: [],
      meta: {
        sourceTable: 'app_legislator_topic',
        filters: { lid: params.lid }
      }
    })),
    api<any>(fetch, `/legislators/${lid}/posts`, { limit: 20, ...filters }).catch(() => ({
      data: [],
      meta: {
        sourceTable: 'posts',
        filters: { lid: params.lid, limit: 20 }
      }
    })),
    api<any>(fetch, `/legislators/${lid}/posts`, { limit: 10, sort: 'engagement', ...filters }).catch(() => ({
      data: [],
      meta: {
        sourceTable: 'posts',
        filters: { lid: params.lid, limit: 10, sort: 'engagement' }
      }
    })),
    api<any>(fetch, `/legislators/${lid}/network`, { limit: 1200, ...filters }).catch((error) => ({
      data: {
        center: {
          lid: profile.data?.lid ?? params.lid,
          name: profile.data?.name ?? null,
          handle: profile.data?.handle ?? null,
          state: profile.data?.state ?? null,
          chamber: profile.data?.chamber ?? null,
          party: profile.data?.party ?? null,
          ideology: profile.data?.mrpIdeology ?? null
        },
        links: [],
        facets: { topics: [], parties: [], states: [], types: [], directions: [] },
        summary: {}
      },
      meta: {
        sourceTable: 'app_network_edges',
        filters: { lid: params.lid, limit: 1200 },
        networkError: error instanceof Error ? error.message : String(error)
      }
    }))
  ]);

  const currentPath = `${url.pathname}${url.search}`;
  const topicLabel = context.topic
    ? fingerprint.data?.[0]?.topicLabel ?? `Topic ${context.topic}`
    : '';
  const inheritedFilters = [
    context.topic ? { label: 'Topic', value: topicLabel, href: removeDrilldownFilter(currentPath, 'topic') } : null,
    context.state ? { label: 'State', value: context.state, href: removeDrilldownFilter(currentPath, 'state') } : null,
    context.party ? { label: 'Party', value: context.party, href: removeDrilldownFilter(currentPath, 'party') } : null,
    context.from ? { label: 'From', value: context.from, href: removeDrilldownFilter(currentPath, 'from') } : null,
    context.to ? { label: 'To', value: context.to, href: removeDrilldownFilter(currentPath, 'to') } : null,
    context.normalize ? { label: 'Origin scale', value: context.normalize === 'population' ? 'State population' : 'Represented legislators', href: removeDrilldownFilter(currentPath, 'normalize') } : null,
    context.color ? { label: 'Origin color', value: 'Party contribution', href: removeDrilldownFilter(currentPath, 'color') } : null
  ].filter(Boolean);

  return { profile, fingerprint, posts, topPosts, network, context, inheritedFilters, clearContextHref: url.pathname };
};
