// Data model, filtering and radial layout for the claim network (/claims).
// Mirrors the payload of GET /api/v1/claims; rendering lives in ClaimNetwork*.svelte.

export type Stance = 'spread' | 'debunk' | 'neutral';
export type PartyCode = 'D' | 'R' | 'I' | 'U';

export interface FactCheck {
  id: string;
  claim: string;
  claimant: string | null;
  claimDate: string | null;
  reviewDate: string | null;
  publisher: string | null;
  rating: string | null;
  ratingNorm: string | null;
  url: string | null;
}

export interface ClaimCluster {
  clusterId: string;
  topic: string;
  label: string;
  shortLabel: string;
  factChecks: FactCheck[];
}

export interface ClaimLegislator {
  lid: string;
  name: string;
  party: string | null;
  state: string | null;
  chamber: string | null;
  synthetic: boolean;
}

export interface ClaimPost {
  postId: string;
  lid: string;
  clusterId: string;
  date: string;
  isRetweet: boolean;
  retweetOf: string | null;
  text: string;
  stance: Stance;
  synthetic: boolean;
}

export interface ClaimNetworkData {
  clusters: ClaimCluster[];
  legislators: ClaimLegislator[];
  posts: ClaimPost[];
}

export const STANCES: Stance[] = ['spread', 'debunk', 'neutral'];
export const STANCE_LABEL: Record<Stance, string> = {
  spread: 'Spreads the claim',
  debunk: 'Debunks it',
  neutral: 'Neutral mention'
};
const STANCE_GERUND: Record<Stance, string> = { spread: 'spreading', debunk: 'debunking', neutral: 'neutral' };
export const STANCE_VERB: Record<Stance, string> = { spread: 'spreads', debunk: 'debunks', neutral: 'neutral' };

export const PARTY_ORDER: PartyCode[] = ['D', 'R', 'I', 'U'];
export const PARTY_NAME: Record<PartyCode, string> = { D: 'Democrat', R: 'Republican', I: 'Independent', U: 'Party unknown' };
export const PARTY_PLURAL: Record<PartyCode, string> = { D: 'Democrats', R: 'Republicans', I: 'Independents', U: 'Party unknown' };
export const PARTY_INITIAL: Record<PartyCode, string> = { D: 'D', R: 'R', I: 'I', U: '?' };
export const PARTY_COLOR: Record<PartyCode, string> = {
  D: 'var(--color-ballot-blue)',
  R: 'var(--color-ballot-red)',
  I: 'var(--color-independent)',
  U: 'var(--color-mute-soft)'
};

export function partyCode(party: string | null | undefined): PartyCode {
  if (party === 'Democratic') return 'D';
  if (party === 'Republican') return 'R';
  if (party === 'Independent') return 'I';
  return 'U';
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function wrapLines(text: string, max: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    if (current && `${current} ${word}`.length > max) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

/* ---------- periods ---------- */

export const isPeriod = (value: string | null | undefined): value is string =>
  value === 'all' || /^\d{4}(-\d{2})?$/.test(value ?? '');

export const inPeriod = (date: string, period: string) => period === 'all' || date.startsWith(period);

export function fullRangeLabel(posts: ClaimPost[]): string {
  const years = posts.map((post) => post.date.slice(0, 4)).sort();
  if (!years.length) return 'All dates';
  const first = years[0];
  const last = years[years.length - 1];
  return first === last ? first : `${first} to ${last}`;
}

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export function periodLabel(period: string, allLabel: string): string {
  if (period === 'all') return allLabel;
  return period.length === 4 ? period : monthLabel(period);
}

export function dateText(date: string | null | undefined): string {
  if (!date) return 'date unknown';
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

export interface PeriodOption {
  value: string;
  label: string;
}

export interface PeriodOptions {
  all: PeriodOption;
  years: PeriodOption[];
  months: PeriodOption[];
}

function countBy<T>(items: T[], key: (item: T) => string): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b));
}

export function periodOptions(posts: ClaimPost[], allLabel: string): PeriodOptions {
  return {
    all: { value: 'all', label: `${allLabel} (${plural(posts.length, 'post')})` },
    years: countBy(posts, (post) => post.date.slice(0, 4)).map(([year, n]) => ({ value: year, label: `${year} (${n})` })),
    months: countBy(posts, (post) => post.date.slice(0, 7)).map(([month, n]) => ({
      value: month,
      label: `${monthLabel(month)} (${n})`
    }))
  };
}

/* ---------- filtering and tallies ---------- */

export interface PostFilter {
  clusterId?: string | null;
  lid?: string | null;
  period: string;
  includeNeutral: boolean;
}

export function filterPosts(posts: ClaimPost[], filter: PostFilter): ClaimPost[] {
  return posts.filter(
    (post) =>
      (!filter.clusterId || post.clusterId === filter.clusterId) &&
      (!filter.lid || post.lid === filter.lid) &&
      inPeriod(post.date, filter.period) &&
      (filter.includeNeutral || post.stance !== 'neutral')
  );
}

export interface Tally {
  n: number;
  spread: number;
  debunk: number;
  neutral: number;
  retweets: number;
  main: Stance;
}

export function tally(posts: ClaimPost[]): Tally {
  const result: Tally = { n: posts.length, spread: 0, debunk: 0, neutral: 0, retweets: 0, main: 'spread' };
  for (const post of posts) {
    result[post.stance] += 1;
    if (post.isRetweet) result.retweets += 1;
  }
  result.main = STANCES.reduce<Stance>((best, stance) => (result[stance] > result[best] ? stance : best), 'spread');
  return result;
}

export function breakdown(counts: Pick<Tally, Stance>): string {
  return STANCES.filter((stance) => counts[stance])
    .map((stance) => `${counts[stance]} ${STANCE_GERUND[stance]}`)
    .join(', ');
}

export interface LegislatorTally extends Tally {
  lid: string;
  name: string;
  state: string | null;
  chamber: string | null;
  party: PartyCode;
  synthetic: boolean;
}

export function tallyByLegislator(posts: ClaimPost[], legislators: Map<string, ClaimLegislator>): LegislatorTally[] {
  const groups = new Map<string, ClaimPost[]>();
  for (const post of posts) groups.set(post.lid, [...(groups.get(post.lid) ?? []), post]);
  return [...groups]
    .map(([lid, group]) => {
      const legislator = legislators.get(lid);
      return {
        lid,
        name: legislator?.name ?? lid,
        state: legislator?.state ?? null,
        chamber: legislator?.chamber ?? null,
        party: partyCode(legislator?.party),
        synthetic: legislator?.synthetic ?? true,
        ...tally(group)
      };
    })
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

export interface ClusterTally extends Tally {
  clusterId: string;
}

export function tallyByCluster(posts: ClaimPost[]): ClusterTally[] {
  const groups = new Map<string, ClaimPost[]>();
  for (const post of posts) groups.set(post.clusterId, [...(groups.get(post.clusterId) ?? []), post]);
  return [...groups].map(([clusterId, group]) => ({ clusterId, ...tally(group) })).sort((a, b) => b.n - a.n);
}

/* ---------- radial layout ---------- */

export const GRAPH_WIDTH = 720;
export const GRAPH_HEIGHT = 620;
const CX = 360;
const CY = 300;
export const GRAPH_CENTER = { x: CX, y: CY };
export const TOP_N = 20;

function polar(index: number, count: number, radius: number, start = -Math.PI / 2) {
  const angle = count === 1 ? start : start + (2 * Math.PI * index) / count;
  return { angle, x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

/** d3.scaleSqrt().domain([1, max]).range(range), without the dependency. */
function sqrtScale(max: number, [low, high]: [number, number]) {
  const span = Math.sqrt(max) - 1;
  return (value: number) => (span > 0 ? low + ((Math.sqrt(value) - 1) / span) * (high - low) : (low + high) / 2);
}

export interface Spoke {
  stance: Stance;
  n: number;
  width: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GraphTip {
  title: string;
  body: string;
}

export interface GraphNode {
  key: string;
  kind: 'legislator' | 'party' | 'claim' | 'more';
  x: number;
  y: number;
  r: number;
  fill: string | null;
  initial: string;
  label: string[];
  labelX: number;
  labelY: number;
  anchor: 'start' | 'middle' | 'end';
  color: string;
  spokes: Spoke[];
  nodeLabel: string;
  edgeLabel: string;
  nodeTip: GraphTip | null;
  edgeTip: GraphTip | null;
  lid?: string;
  party?: PartyCode;
  clusterId?: string;
}

interface Placed {
  angle: number;
  x: number;
  y: number;
  labelRadius: number;
}

function placeLabel(place: Placed, lineCount: number) {
  const cos = Math.cos(place.angle);
  const mid = Math.abs(cos) < 0.05;
  const lx = CX + place.labelRadius * Math.cos(place.angle);
  const ly = CY + place.labelRadius * Math.sin(place.angle);
  const labelY = mid
    ? ly + (Math.sin(place.angle) > 0 ? 14 : -4 - (lineCount - 1) * 14)
    : ly + 4 - (lineCount - 1) * 7;
  return { labelX: lx, labelY, anchor: (mid ? 'middle' : cos > 0 ? 'start' : 'end') as GraphNode['anchor'] };
}

/** Parallel lines per node, offset sideways when a node carries more than one stance. */
function spokesFor(place: Placed, lines: Array<{ stance: Stance; n: number }>, width: (n: number) => number): Spoke[] {
  const nx = -(place.y - CY);
  const ny = place.x - CX;
  const length = Math.hypot(nx, ny) || 1;
  return lines.map((line, index) => {
    const offset = (index - (lines.length - 1) / 2) * 6;
    const ox = (offset * nx) / length;
    const oy = (offset * ny) / length;
    const w = width(line.n);
    return {
      ...line,
      width: line.stance === 'neutral' ? Math.min(3, w) : w,
      x1: CX + ox,
      y1: CY + oy,
      x2: place.x + ox,
      y2: place.y + oy
    };
  });
}

export interface ClaimGraph {
  nodes: GraphNode[];
  more: GraphNode | null;
}

/** Claim in the middle, its top legislators around it (optionally one party only). */
export function legislatorRing(clusterId: string, legislators: LegislatorTally[], party: PartyCode | null): ClaimGraph {
  const pool = party ? legislators.filter((legislator) => legislator.party === party) : legislators;
  const shown = pool
    .slice(0, TOP_N)
    .sort(
      (a, b) =>
        PARTY_ORDER.indexOf(a.party) - PARTY_ORDER.indexOf(b.party) ||
        STANCES.indexOf(a.main) - STANCES.indexOf(b.main) ||
        b.n - a.n
    );
  const rest = pool.length - shown.length;
  const count = shown.length + (rest > 0 ? 1 : 0);
  const width = sqrtScale(Math.max(3, ...shown.map((legislator) => legislator.n)), [2, 10]);

  const nodes = shown.map((legislator, index): GraphNode => {
    const place = { ...polar(index, count, 210), labelRadius: 224 };
    const label = [`${truncate(legislator.name, 20)} (${legislator.n})`];
    const summary = `${plural(legislator.n, 'post')}: ${breakdown(legislator)}`;
    return {
      key: `${clusterId}|${legislator.lid}`,
      kind: 'legislator',
      x: place.x,
      y: place.y,
      r: 9,
      fill: PARTY_COLOR[legislator.party],
      initial: PARTY_INITIAL[legislator.party],
      label,
      ...placeLabel(place, label.length),
      color: PARTY_COLOR[legislator.party],
      spokes: spokesFor(place, [{ stance: legislator.main, n: legislator.n }], width),
      nodeLabel: `${legislator.name}, ${PARTY_NAME[legislator.party]}, ${plural(legislator.n, 'post')}. Show their other claims.`,
      edgeLabel: `Read ${legislator.name}'s ${plural(legislator.n, 'post')} on this claim`,
      nodeTip: {
        title: legislator.name,
        body: `${[PARTY_NAME[legislator.party], legislator.state, legislator.chamber].filter(Boolean).join(', ')}. Select to see their other claims.`
      },
      edgeTip: { title: legislator.name, body: `${summary}. Select to read them.` },
      lid: legislator.lid,
      party: legislator.party,
      clusterId
    };
  });

  let more: GraphNode | null = null;
  if (rest > 0) {
    const place = { ...polar(count - 1, count, 210), labelRadius: 224 };
    more = {
      key: 'more',
      kind: 'more',
      x: place.x,
      y: place.y,
      r: 12,
      fill: null,
      initial: '+',
      label: [`${rest} more`],
      ...placeLabel(place, 1),
      color: 'var(--color-mute)',
      spokes: [],
      nodeLabel: `Show ${rest} more legislators in the list`,
      edgeLabel: '',
      nodeTip: { title: `${rest} more legislators`, body: 'Listed in full beside the chart.' },
      edgeTip: null
    };
  }

  return { nodes, more };
}

/** Claim in the middle, one node per party sized by how many legislators it holds. */
export function partyRing(legislators: LegislatorTally[]): GraphNode[] {
  const groups = PARTY_ORDER.map((party) => {
    const members = legislators.filter((legislator) => legislator.party === party);
    const counts = {
      spread: members.reduce((sum, member) => sum + member.spread, 0),
      debunk: members.reduce((sum, member) => sum + member.debunk, 0),
      neutral: members.reduce((sum, member) => sum + member.neutral, 0)
    };
    return { party, members: members.length, n: counts.spread + counts.debunk + counts.neutral, ...counts };
  }).filter((group) => group.members);

  const width = sqrtScale(
    Math.max(...groups.flatMap((group) => STANCES.map((stance) => group[stance]))),
    [2, 20]
  );

  return groups.map((group, index): GraphNode => {
    const size = 3.5 * Math.sqrt(group.members);
    const place = { ...polar(index, groups.length, 200, Math.PI), labelRadius: 222 + size };
    const label = [`${PARTY_PLURAL[group.party]}: ${group.members}`];
    return {
      key: `party:${group.party}`,
      kind: 'party',
      x: place.x,
      y: place.y,
      r: 12 + size,
      fill: PARTY_COLOR[group.party],
      initial: PARTY_INITIAL[group.party],
      label,
      ...placeLabel(place, 1),
      color: PARTY_COLOR[group.party],
      spokes: spokesFor(
        place,
        STANCES.filter((stance) => group[stance]).map((stance) => ({ stance, n: group[stance] })),
        width
      ),
      nodeLabel: `${PARTY_PLURAL[group.party]}, ${plural(group.members, 'legislator')}. Show these legislators.`,
      edgeLabel: `Show the ${PARTY_PLURAL[group.party]} who posted about this claim`,
      nodeTip: { title: PARTY_PLURAL[group.party], body: 'Select to show these legislators.' },
      edgeTip: {
        title: PARTY_PLURAL[group.party],
        body: `${plural(group.members, 'legislator')}, ${plural(group.n, 'post')}: ${breakdown(group)}`
      },
      party: group.party
    };
  });
}

/** One legislator in the middle, every claim they posted about around them. */
export function claimRing(
  lid: string,
  party: PartyCode,
  rows: ClusterTally[],
  clusters: Map<string, ClaimCluster>
): GraphNode[] {
  const width = sqrtScale(Math.max(3, ...rows.map((row) => row.n)), [2, 10]);
  return rows.map((row, index): GraphNode => {
    const cluster = clusters.get(row.clusterId);
    const shortLabel = cluster?.shortLabel ?? row.clusterId;
    const place = { ...polar(index, rows.length, 165, -Math.PI * 0.75), labelRadius: 180 };
    const label = wrapLines(`${shortLabel} (${row.n})`, 16);
    return {
      key: `${row.clusterId}|${lid}`,
      kind: 'claim',
      x: place.x,
      y: place.y,
      r: 9,
      fill: 'var(--color-ink)',
      initial: '',
      label,
      ...placeLabel(place, label.length),
      color: PARTY_COLOR[party],
      spokes: spokesFor(place, [{ stance: row.main, n: row.n }], width),
      nodeLabel: `${cluster?.label ?? shortLabel}, ${plural(row.n, 'post')}. Show everyone who posted about it.`,
      edgeLabel: `Read ${plural(row.n, 'post')} on ${shortLabel}`,
      nodeTip: { title: cluster?.topic ?? 'Claim', body: 'Select to show everyone who posted about this claim.' },
      edgeTip: { title: cluster?.label ?? shortLabel, body: `${plural(row.n, 'post')}: ${breakdown(row)}. Select to read them.` },
      lid,
      clusterId: row.clusterId
    };
  });
}

export function centerBox(label: string) {
  const lines = wrapLines(label, 20).slice(0, 4);
  const width = 190;
  const height = 22 + lines.length * 18;
  return {
    x: CX - width / 2,
    y: CY - height / 2,
    width,
    height,
    lines: lines.map((text, index) => ({ text, y: CY - height / 2 + 26 + index * 18 }))
  };
}
