import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';

export const load: PageServerLoad = async ({ fetch }) => {
  const [states, matrix, topics] = await Promise.all([
    api(fetch, '/states'),
    api(fetch, '/states/small-multiples'),
    api(fetch, '/topics')
  ]);
  return { states, matrix, topics };
};
