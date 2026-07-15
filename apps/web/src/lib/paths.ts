import { base } from '$app/paths';

export function withBase(href: string | null | undefined): string | null {
  if (typeof href !== 'string') {
    return null;
  }

  const value = href.trim();

  if (!value) {
    return null;
  }

  if (
    value.startsWith('#') ||
    value.startsWith('?') ||
    value.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(value)
  ) {
    return value;
  }

  if (!value.startsWith('/')) {
    return value;
  }

  if (!base) {
    return value;
  }

  if (value === base || value.startsWith(`${base}/`)) {
    return value;
  }

  return value === '/' ? base : `${base}${value}`;
}

export function appPath(path: string | null | undefined): string {
  return withBase(path) ?? '#';
}

export function withoutBase(path: string | null | undefined): string {
  if (typeof path !== 'string' || !path) {
    return '/';
  }

  if (!base) {
    return path;
  }

  if (path === base) {
    return '/';
  }

  if (path.startsWith(`${base}/`)) {
    return path.slice(base.length);
  }

  return path;
}
