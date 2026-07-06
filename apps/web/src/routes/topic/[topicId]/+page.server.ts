import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';

export const load: PageServerLoad = async ({ fetch, params }) => {
  const [topic, ribbon, salience, beeswarm, topPosts, partyChamber, adjacent] = await Promise.all([
    api(fetch, `/topics/${params.topicId}`),
    api(fetch, `/topics/${params.topicId}/ribbon`),
    api(fetch, `/topics/${params.topicId}/state-salience`),
    api(fetch, `/topics/${params.topicId}/beeswarm`),
    api(fetch, `/topics/${params.topicId}/top-posts`, { limit: 10 }),
    api(fetch, `/topics/${params.topicId}/party-chamber`),
    api(fetch, `/topics/${params.topicId}/adjacent`)
  ]);
  return { topic, ribbon, salience, beeswarm, topPosts, partyChamber, adjacent };
};
