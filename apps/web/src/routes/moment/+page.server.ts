import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const date = url.searchParams.get('date') ?? '2022-06-24';
  const width = url.searchParams.get('width') ?? '7';
  const [events, window, topPosts] = await Promise.all([
    api(fetch, '/events'),
    api(fetch, '/moments/window', { date, width }),
    api(fetch, '/moments/window/top-posts', { date, width, limit: 10 })
  ]);
  return { events, window, topPosts, date, width };
};
