import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';
import { parseDrilldownContext, removeDrilldownFilter } from '$lib/drilldown';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const overview = url.searchParams.size === 0;
  const date = url.searchParams.get('date') ?? '2022-06-24';
  const width = url.searchParams.get('width') ?? '7';
  let from = url.searchParams.get('from') ?? (overview ? '2020-01-01' : undefined);
  let to = url.searchParams.get('to') ?? (overview ? '2025-01-04' : undefined);
  if (from && to && from === to) {
    const center = new Date(`${from}T00:00:00Z`);
    const start = new Date(center);
    const end = new Date(center);
    start.setUTCDate(start.getUTCDate() - 3);
    end.setUTCDate(end.getUTCDate() + 3);
    from = start.toISOString().slice(0, 10);
    to = end.toISOString().slice(0, 10);
  }
  const rangeDays = from && to
    ? Math.max(1, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1)
    : Math.max(1, Number(width) * 2 + 1);
  const bucket = rangeDays <= 45 ? 'day' : rangeDays <= 240 ? 'week' : 'month';
  const context = parseDrilldownContext(url.searchParams);
  const filters = { date, width, from, to, topic: context.topic, state: context.state, party: context.party, bucket };
  if (overview) {
    const [events, overviewData, topics] = await Promise.all([
      api<any>(fetch, '/events'),
      api<any>(fetch, '/moments/overview'),
      api<any>(fetch, '/topics')
    ]);
    const eventTopics = overviewData.data?.eventTopics ?? {};
    events.data = events.data.map((event: any) => ({ ...event, topTopics: eventTopics[event.eventId] ?? [] }));
    return {
      events,
      window: { data: overviewData.data?.topics ?? [], meta: overviewData.meta },
      daily: { data: overviewData.data?.daily ?? [], meta: overviewData.meta },
      topPosts: { data: [], meta: { sourceTable: 'overview deferred' } },
      topics,
      date,
      width,
      from,
      to,
      context,
      inheritedFilters: [],
      overview: true,
      bucket: 'week',
      clearContextHref: '/moment'
    };
  }
  const [events, window, daily, topPosts, topics] = await Promise.all([
    api(fetch, '/events'),
    api(fetch, '/moments/window', filters),
    api(fetch, '/moments/window/daily', filters),
    api(fetch, '/moments/window/top-posts', { ...filters, limit: 10 }),
    api(fetch, '/topics')
  ]);
  const currentPath = `${url.pathname}${url.search}`;
  const topicLabel = context.topic
    ? topics.data?.find?.((row: any) => String(row.topic) === context.topic)?.topicLabel ?? `Topic ${context.topic}`
    : '';
  const inheritedFilters = [
    context.topic ? { label: 'Topic', value: topicLabel, href: removeDrilldownFilter(currentPath, 'topic') } : null,
    context.state ? { label: 'State', value: context.state, href: removeDrilldownFilter(currentPath, 'state') } : null,
    context.party ? { label: 'Party', value: context.party, href: removeDrilldownFilter(currentPath, 'party') } : null
  ].filter(Boolean);
  return { events, window, daily, topPosts, topics, date, width, from, to, context, inheritedFilters, overview, bucket, clearContextHref: overview ? '/moment' : from && to ? `/moment?from=${from}&to=${to}` : `/moment?date=${date}&width=${width}` };
};
