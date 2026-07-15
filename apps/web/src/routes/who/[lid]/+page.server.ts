import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';

export const load: PageServerLoad = async ({ fetch, params }) => {
  const lid = encodeURIComponent(params.lid);

  const profile = await api(fetch, `/legislators/${lid}`);

  const [fingerprint, posts, topPosts] = await Promise.all([
    api(fetch, `/legislators/${lid}/voice-fingerprint`).catch(() => ({
      data: [],
      meta: {
        sourceTable: 'app_legislator_topic',
        filters: { lid: params.lid }
      }
    })),
    api(fetch, `/legislators/${lid}/posts`, { limit: 20 }).catch(() => ({
      data: [],
      meta: {
        sourceTable: 'posts',
        filters: { lid: params.lid, limit: 20 }
      }
    })),
    api(fetch, `/legislators/${lid}/posts`, { limit: 10, sort: 'engagement' }).catch(() => ({
      data: [],
      meta: {
        sourceTable: 'posts',
        filters: { lid: params.lid, limit: 10, sort: 'engagement' }
      }
    }))
  ]);

  return { profile, fingerprint, posts, topPosts };
};
