import type { LayoutServerLoad } from './$types';
import { api } from '$lib/api/server';

export const load: LayoutServerLoad = async ({ fetch }) => {
  const meta = await api(fetch, '/meta');
  return { meta };
};
