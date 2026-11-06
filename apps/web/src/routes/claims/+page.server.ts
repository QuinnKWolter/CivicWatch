import type { PageServerLoad } from './$types';
import { api } from '$lib/api/server';
import type { ClaimNetworkData } from '$lib/claims';

export const load: PageServerLoad = async ({ fetch }) => {
  const claims = await api<{ data: ClaimNetworkData; meta: Record<string, unknown> }>(fetch, '/claims');
  return { claims };
};
