import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';

export const load: PageServerLoad = async ({ fetch, params }) => {
  const [summary, topics, topPosts, chamber, trend] = await Promise.all([
    api(fetch, `/states/${params.state}`),
    api(fetch, `/states/${params.state}/topics`),
    api(fetch, `/states/${params.state}/top-posts`, { limit: 10 }),
    api(fetch, '/chamber', { state: params.state.toUpperCase() }),
    api(fetch, `/states/${params.state}/trend`)
  ]);
  return { summary, topics, topPosts, chamber, trend, state: params.state.toUpperCase() };
};
