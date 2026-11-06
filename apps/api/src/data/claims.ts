import demo from './claims-demo.json' with { type: 'json' };

// Claim network served to /claims. Fact-checks are real (Google Fact Check API);
// legislators and posts in claims-demo.json are synthetic placeholders. When
// claim-matched posts land in Postgres, build this same shape from SQL instead.

export type ClaimStance = 'spread' | 'debunk' | 'neutral';

export type FactCheck = {
  id: string;
  claim: string;
  claimant: string | null;
  claimDate: string | null;
  reviewDate: string | null;
  publisher: string | null;
  rating: string | null;
  ratingNorm: string | null;
  url: string | null;
};

export type ClaimCluster = {
  clusterId: string;
  topic: string;
  label: string;
  shortLabel: string;
  factChecks: FactCheck[];
};

export type ClaimLegislator = {
  lid: string;
  name: string;
  party: string | null;
  state: string | null;
  chamber: string | null;
  synthetic: boolean;
};

export type ClaimPost = {
  postId: string;
  lid: string;
  clusterId: string;
  date: string;
  isRetweet: boolean;
  retweetOf: string | null;
  text: string;
  stance: ClaimStance;
  synthetic: boolean;
};

export type ClaimNetwork = {
  clusters: ClaimCluster[];
  legislators: ClaimLegislator[];
  posts: ClaimPost[];
};

const SHORT_LABELS: Record<string, string> = {
  vax_microchip: 'Microchips',
  vax_fertility: 'Fertility and pregnancy',
  vax_deaths: 'Vaccine death reports',
  abortion_claims: 'Abortion claims',
  gov_dead_voters: 'Dead voters',
  gov_dominion: 'Dominion machines',
  gov_stimulus: 'Stimulus checks',
  cr_georgia_law: 'Georgia voting law',
  cr_defund: 'Defund the police',
  cr_blm: 'Black Lives Matter'
};

const STANCES = new Set<string>(['spread', 'debunk', 'neutral']);

const text = (value: unknown) => {
  const result = String(value ?? '').trim();
  return result || null;
};

export const claimNotes = demo.meta;

export const claimNetwork: ClaimNetwork = {
  clusters: demo.clusters.map((cluster) => ({
    clusterId: cluster.cluster_id,
    topic: cluster.topic,
    label: cluster.label,
    shortLabel: SHORT_LABELS[cluster.cluster_id] ?? cluster.label,
    factChecks: cluster.fact_checks.map((check) => ({
      id: check.node_id,
      claim: check.matched_claim.trim().replace(/^[“"]+|[”"]+$/g, ''),
      claimant: text(check.claimant),
      claimDate: text(check.claim_date),
      reviewDate: text(check.review_date),
      publisher: text(check.publisher),
      rating: text(check.rating),
      ratingNorm: text(check.rating_norm),
      url: text(check.url)
    }))
  })),
  legislators: demo.legislators.map((legislator) => ({
    lid: legislator.legislator_id,
    name: legislator.name,
    party: text(legislator.party),
    state: text(legislator.state),
    chamber: text(legislator.chamber),
    synthetic: legislator.synthetic
  })),
  posts: demo.posts
    .filter((post) => STANCES.has(post.stance))
    .map((post) => ({
      postId: post.post_id,
      lid: post.legislator_id,
      clusterId: post.cluster_id,
      date: post.date,
      isRetweet: post.is_retweet,
      retweetOf: text(post.retweet_of),
      text: post.text,
      stance: post.stance as ClaimStance,
      synthetic: post.synthetic
    }))
};
