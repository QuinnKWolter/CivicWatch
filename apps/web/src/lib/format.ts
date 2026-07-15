export function compact(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('en-US', {
    notation: Math.abs(n) >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(n) >= 10000 ? 1 : 0
  }).format(n);
}

export function integer(value: number | string | null | undefined): string {
  return new Intl.NumberFormat('en-US').format(Number(value ?? 0));
}

export function pct(value: number | string | null | undefined, digits = 0): string {
  return `${(Number(value ?? 0) * 100).toFixed(digits)}%`;
}

export function dateLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}

export function partyInitial(party: string | null | undefined): string {
  if (party === 'Democratic') return 'D';
  if (party === 'Republican') return 'R';
  if (party === 'Independent') return 'I';
  return '?';
}

const LOWERCASE_NAME_PARTS = new Set([
  'da',
  'de',
  'del',
  'der',
  'di',
  'du',
  'la',
  'le',
  'van',
  'von'
]);

const UPPERCASE_NAME_PARTS = new Set(['ii', 'iii', 'iv', 'vi']);

function titleCaseNamePart(part: string, index: number): string {
  const lower = part.toLocaleLowerCase('en-US');

  if (UPPERCASE_NAME_PARTS.has(lower)) return lower.toLocaleUpperCase('en-US');

  if (index > 0 && LOWERCASE_NAME_PARTS.has(lower)) return lower;

  const cased = lower.replace(/(^|[-'’])(\p{L})/gu, (_match, prefix: string, letter: string) =>
    `${prefix}${letter.toLocaleUpperCase('en-US')}`
  );

  return cased.replace(/\bMc(\p{L})/gu, (_match, letter: string) => `Mc${letter.toLocaleUpperCase('en-US')}`);
}

export function titleCasePersonName(value: string | null | undefined): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();

  if (!text) return '';

  return text
    .split(' ')
    .map((part, index) => titleCaseNamePart(part, index))
    .join(' ');
}
