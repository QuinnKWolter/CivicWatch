import { describe, expect, it } from 'vitest';
import {
  TOP_N,
  breakdown,
  claimRing,
  filterPosts,
  fullRangeLabel,
  legislatorRing,
  partyRing,
  periodOptions,
  tally,
  tallyByCluster,
  tallyByLegislator,
  type ClaimCluster,
  type ClaimLegislator,
  type ClaimPost,
  type Stance
} from './claims';

const legislators: ClaimLegislator[] = [
  { lid: 'A', name: 'Ann Able', party: 'Democratic', state: 'PA', chamber: 'State House', synthetic: true },
  { lid: 'B', name: 'Ben Bell', party: 'Republican', state: 'TX', chamber: 'State Senate', synthetic: true },
  { lid: 'C', name: 'Cal Cross', party: null, state: null, chamber: null, synthetic: true }
];
const legislatorMap = new Map(legislators.map((legislator) => [legislator.lid, legislator]));

let nextId = 0;
const post = (lid: string, clusterId: string, stance: Stance, date: string, isRetweet = false): ClaimPost => ({
  postId: `P${++nextId}`,
  lid,
  clusterId,
  date,
  isRetweet,
  retweetOf: isRetweet ? 'someone' : null,
  text: 'text',
  stance,
  synthetic: true
});

const posts = [
  post('A', 'x', 'debunk', '2020-03-01'),
  post('A', 'x', 'debunk', '2020-04-01', true),
  post('A', 'y', 'spread', '2021-01-05'),
  post('B', 'x', 'spread', '2020-03-09'),
  post('B', 'x', 'neutral', '2021-02-01'),
  post('C', 'x', 'spread', '2021-02-02')
];

describe('filterPosts', () => {
  it('drops neutral posts unless asked', () => {
    expect(filterPosts(posts, { clusterId: 'x', period: 'all', includeNeutral: false })).toHaveLength(4);
    expect(filterPosts(posts, { clusterId: 'x', period: 'all', includeNeutral: true })).toHaveLength(5);
  });

  it('filters by year, month and legislator', () => {
    expect(filterPosts(posts, { period: '2020', includeNeutral: true })).toHaveLength(3);
    expect(filterPosts(posts, { period: '2020-03', includeNeutral: true })).toHaveLength(2);
    expect(filterPosts(posts, { lid: 'A', period: 'all', includeNeutral: true })).toHaveLength(3);
  });
});

describe('tallies', () => {
  it('counts stances and retweets, and picks the main stance', () => {
    const result = tally(posts.filter((item) => item.lid === 'A'));
    expect(result).toMatchObject({ n: 3, spread: 1, debunk: 2, neutral: 0, retweets: 1, main: 'debunk' });
    expect(breakdown(result)).toBe('1 spreading, 2 debunking');
  });

  it('prefers spread on a tie, like the demo', () => {
    expect(tally([post('A', 'x', 'debunk', '2020-01-01'), post('A', 'x', 'spread', '2020-01-02')]).main).toBe('spread');
  });

  it('sorts legislators by post count, then name, and maps party codes', () => {
    const rows = tallyByLegislator(filterPosts(posts, { clusterId: 'x', period: 'all', includeNeutral: true }), legislatorMap);
    expect(rows.map((row) => [row.lid, row.n, row.party])).toEqual([
      ['A', 2, 'D'],
      ['B', 2, 'R'],
      ['C', 1, 'U']
    ]);
  });

  it('groups a legislator\'s posts by claim', () => {
    expect(tallyByCluster(posts.filter((item) => item.lid === 'A')).map((row) => [row.clusterId, row.n])).toEqual([
      ['x', 2],
      ['y', 1]
    ]);
  });
});

describe('periods', () => {
  it('labels the full range and counts posts per year and month', () => {
    expect(fullRangeLabel(posts)).toBe('2020 to 2021');
    const options = periodOptions(posts, '2020 to 2021');
    expect(options.all.label).toBe('2020 to 2021 (6 posts)');
    expect(options.years.map((option) => option.label)).toEqual(['2020 (3)', '2021 (3)']);
    expect(options.months[0]).toEqual({ value: '2020-03', label: 'Mar 2020 (2)' });
  });
});

describe('layouts', () => {
  const many: ClaimLegislator[] = Array.from({ length: TOP_N + 5 }, (_, index) => ({
    lid: `L${index}`,
    name: `Legislator ${String(index).padStart(2, '0')}`,
    party: index % 2 ? 'Republican' : 'Democratic',
    state: 'OH',
    chamber: 'State House',
    synthetic: true
  }));
  const manyPosts = many.map((legislator) => post(legislator.lid, 'x', 'spread', '2020-05-01'));
  const rows = tallyByLegislator(manyPosts, new Map(many.map((legislator) => [legislator.lid, legislator])));

  it('shows the top legislators and a "more" node for the rest', () => {
    const graph = legislatorRing('x', rows, null);
    expect(graph.nodes).toHaveLength(TOP_N);
    expect(graph.more?.label).toEqual(['5 more']);
    expect(graph.nodes[0].party).toBe('D');
    expect(graph.nodes.at(-1)?.party).toBe('R');
  });

  it('narrows to one party', () => {
    const graph = legislatorRing('x', rows, 'R');
    expect(graph.nodes.every((node) => node.party === 'R')).toBe(true);
    expect(graph.more).toBeNull();
  });

  it('draws one spoke per stance for party nodes', () => {
    const groups = partyRing(
      tallyByLegislator(filterPosts(posts, { clusterId: 'x', period: 'all', includeNeutral: true }), legislatorMap)
    );
    expect(groups.map((group) => group.key)).toEqual(['party:D', 'party:R', 'party:U']);
    const republicans = groups[1];
    expect(republicans.spokes.map((spoke) => spoke.stance)).toEqual(['spread', 'neutral']);
    expect(republicans.spokes[0].x1).not.toBe(republicans.spokes[1].x1);
    expect(republicans.spokes[1].width).toBeLessThanOrEqual(3);
  });

  it('places a legislator\'s claims around them', () => {
    const clusters = new Map<string, ClaimCluster>([
      ['x', { clusterId: 'x', topic: 'Health', label: 'Claim X', shortLabel: 'X', factChecks: [] }],
      ['y', { clusterId: 'y', topic: 'Health', label: 'Claim Y', shortLabel: 'Y', factChecks: [] }]
    ]);
    const nodes = claimRing('A', 'D', tallyByCluster(posts.filter((item) => item.lid === 'A')), clusters);
    expect(nodes.map((node) => node.label)).toEqual([['X (2)'], ['Y (1)']]);
    expect(nodes[0].color).toBe('var(--color-ballot-blue)');
  });
});
