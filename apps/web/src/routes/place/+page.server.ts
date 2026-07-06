import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';

export const load: PageServerLoad = async ({ fetch }) => {
  const [states, matrix] = await Promise.all([
    api(fetch, '/states'),
    api(fetch, '/states/small-multiples')
  ]);
  return { states, matrix };
};
