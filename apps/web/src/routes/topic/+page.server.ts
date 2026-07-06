import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';

export const load: PageServerLoad = async ({ fetch }) => {
  const [topics, ribbon] = await Promise.all([
    api(fetch, '/topics'),
    api(fetch, '/topic-ribbon')
  ]);
  return { topics, ribbon };
};
