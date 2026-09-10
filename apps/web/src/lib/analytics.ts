import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';

type AnalyticsValue = string | number | boolean | null | undefined;
type AnalyticsPayload = Record<string, AnalyticsValue>;

const SAFE_PARAMS = new Set([
  'color',
  'date',
  'from',
  'normalize',
  'party',
  'state',
  'to',
  'topic',
  'width'
]);

const apiBase = () =>
  (env.PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1').replace(/\/+$/, '');

function bounded(value: unknown, max = 180): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function safePath(url: URL): string {
  const params = new URLSearchParams();

  for (const key of SAFE_PARAMS) {
    const value = url.searchParams.get(key);
    if (value) params.set(key, value.slice(0, 80));
  }

  const query = params.toString();
  return `${url.pathname}${query ? `?${query}` : ''}`;
}

function normalizePayload(payload: AnalyticsPayload): Record<string, string | number | boolean | null> {
  const entries = Object.entries(payload)
    .slice(0, 24)
    .map(([key, value]) => {
      if (typeof value === 'number') return [key, Number.isFinite(value) ? value : null] as const;
      if (typeof value === 'boolean') return [key, value] as const;
      if (typeof value === 'string') return [key, bounded(value, 240)] as const;
      return [key, null] as const;
    });

  return Object.fromEntries(entries);
}

export function trackEvent(name: string, payload: AnalyticsPayload = {}): void {
  if (!browser) return;

  const body = JSON.stringify({
    name,
    payload: normalizePayload(payload),
    clientTime: new Date().toISOString()
  });
  const url = `${apiBase()}/analytics`;

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return;
    }

    void fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => {});
  } catch {
    // Analytics must never affect the app experience.
  }
}

export function trackPageView(url: URL, routeId: string | null | undefined): void {
  trackEvent('page_view', {
    path: safePath(url),
    routeId: bounded(routeId, 120),
    title: bounded(document.title, 120),
    referrer: bounded(document.referrer ? new URL(document.referrer).pathname : '', 120),
    width: window.innerWidth,
    height: window.innerHeight,
    theme: document.documentElement.dataset.theme ?? null
  });
}

export function trackClientError(kind: string, message: unknown, routeId?: string | null): void {
  trackEvent('client_error', {
    kind: bounded(kind, 80),
    message: bounded(message, 240),
    path: safePath(new URL(window.location.href)),
    routeId: bounded(routeId, 120)
  });
}
