import { createHash } from 'node:crypto';

export const SNAPSHOT_ID = 'cw_2026_07_02_full';
export const SNAPSHOT_CUTOFF = '2024-12-31';

export function n(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value);
}

export function s(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

export function clampLimit(raw: unknown, fallback = 25, max = 100): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export function queryHashOf(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 16);
}

export function envelope<T>(
  data: T,
  sourceTable: string,
  filters: Record<string, unknown> = {},
  extra: Record<string, unknown> = {}
) {
  return {
    data,
    meta: {
      snapshotId: SNAPSHOT_ID,
      filters,
      sourceTable,
      queryHash: queryHashOf({ sourceTable, filters }),
      generatedAt: new Date().toISOString(),
      ...extra
    }
  };
}

export function partyShort(party: string | null | undefined): string {
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

export function titleCasePersonName(value: string | null | undefined): string | null {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();

  if (!text) return null;

  return text
    .split(' ')
    .map((part, index) => titleCaseNamePart(part, index))
    .join(' ');
}

export function stateName(code: string): string {
  return US_STATES.find((state) => state.code === code)?.name ?? code;
}

export const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['FL', 'Florida'], ['GA', 'Georgia'],
  ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'],
  ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'],
  ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'],
  ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming']
].map(([code, name]) => ({ code, name }));

export function stableAnchor(seed: string, maxId: number): number {
  const hex = createHash('sha256').update(seed).digest('hex').slice(0, 12);
  return (Number.parseInt(hex, 16) % Math.max(maxId, 1)) + 1;
}
