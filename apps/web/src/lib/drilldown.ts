import { base } from '$app/paths';

export type DrilldownContext = {
  topic?: string;
  state?: string;
  party?: 'Democratic' | 'Republican';
  normalize?: 'population' | 'legislators';
  color?: 'contribution';
  from?: string;
  to?: string;
  date?: string;
  width?: string;
  bucket?: 'day' | 'week' | 'month';
};

export function parseDrilldownContext(params: URLSearchParams): DrilldownContext {
  const partyValue = params.get('party')?.toLowerCase();
  const normalizeValue = params.get('normalize')?.toLowerCase();
  return {
    topic: clean(params.get('topic')),
    state: clean(params.get('state'))?.toUpperCase(),
    party: partyValue === 'democratic' ? 'Democratic' : partyValue === 'republican' ? 'Republican' : undefined,
    normalize: normalizeValue === 'population' ? 'population' : normalizeValue === 'legislators' ? 'legislators' : undefined,
    color: params.get('color')?.toLowerCase() === 'contribution' ? 'contribution' : undefined,
    from: clean(params.get('from')),
    to: clean(params.get('to')),
    date: clean(params.get('date')),
    width: clean(params.get('width')),
    bucket: params.get('bucket') === 'month' ? 'month' : params.get('bucket') === 'week' ? 'week' : params.get('bucket') === 'day' ? 'day' : undefined
  };
}

export function appendDrilldownContext(path: string, context: DrilldownContext): string {
  const [pathname, existing = ''] = path.split('?');
  const params = new URLSearchParams(existing);
  for (const [key, value] of Object.entries(context)) {
    if (value && !params.has(key)) params.set(key, value);
  }
  prunePathEncodedFilters(pathname, params);
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

function prunePathEncodedFilters(pathname: string, params: URLSearchParams): void {
  const routePath = base && pathname.startsWith(`${base}/`)
    ? pathname.slice(base.length)
    : pathname;

  if (/^\/topic\/[^/]+\/?$/i.test(routePath)) {
    params.delete('topic');
  }

  if (/^\/place\/[^/]+\/?$/i.test(routePath)) {
    params.delete('state');
  }
}
