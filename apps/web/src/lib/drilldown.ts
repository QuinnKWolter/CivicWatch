export type DrilldownContext = {
  topic?: string;
  state?: string;
  party?: 'Democratic' | 'Republican';
  normalize?: 'population' | 'legislators';
  color?: 'contribution';
};

export function parseDrilldownContext(params: URLSearchParams): DrilldownContext {
  const partyValue = params.get('party')?.toLowerCase();
  const normalizeValue = params.get('normalize')?.toLowerCase();
  return {
    topic: clean(params.get('topic')),
    state: clean(params.get('state'))?.toUpperCase(),
    party: partyValue === 'democratic' ? 'Democratic' : partyValue === 'republican' ? 'Republican' : undefined,
    normalize: normalizeValue === 'population' ? 'population' : normalizeValue === 'legislators' ? 'legislators' : undefined,
    color: params.get('color')?.toLowerCase() === 'contribution' ? 'contribution' : undefined
  };
}

export function appendDrilldownContext(path: string, context: DrilldownContext): string {
  const [pathname, existing = ''] = path.split('?');
  const params = new URLSearchParams(existing);
  for (const [key, value] of Object.entries(context)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}`;
}

export function removeDrilldownFilter(path: string, key: keyof DrilldownContext): string {
  const url = new URL(path, 'http://civicwatch.local');
  url.searchParams.delete(key);
  return `${url.pathname}${url.search}`;
}

function clean(value: string | null): string | undefined {
  const text = value?.trim();
  return text || undefined;
}
