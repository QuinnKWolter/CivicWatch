<script lang="ts">
  import AnimatedNumber from '$lib/components/AnimatedNumber.svelte';
  import EntryMicrovisual from '$lib/components/EntryMicrovisual.svelte';
  import StatStrip from '$lib/components/StatStrip.svelte';
  import { compact } from '$lib/format';
  import { appPath } from '$lib/paths';

  interface Props {
    data?: unknown;
  }

  interface EntryCard {
    href: string;
    eyebrow: string;
    title: string;
    body: string;
    visualKind: 'legislator' | 'state' | 'topic' | 'moment';
    visualLabel: string;
  }

  let { data = null }: Props = $props();

  const entryCards: EntryCard[] = [
    {
      href: appPath('/who'),
      eyebrow: 'People',
      title: 'Look up a legislator',
      body: 'Find profiles, posting patterns, topic fingerprints, and public communication history.',
      visualKind: 'legislator',
      visualLabel: 'Roll-call dots'
    },
    {
      href: appPath('/place'),
      eyebrow: 'Places',
      title: 'Explore a state',
      body: 'Compare chambers, state-level volume, topic mix, and top legislative voices.',
      visualKind: 'state',
      visualLabel: 'State activity grid'
    },
    {
      href: appPath('/topic'),
      eyebrow: 'Issues',
      title: 'Follow a topic',
      body: 'Trace policy areas, political themes, and uncategorized communication across the archive.',
      visualKind: 'topic',
      visualLabel: 'Topic stack'
    },
    {
      href: appPath('/moment'),
      eyebrow: 'Time',
      title: 'Revisit a moment',
      body: 'Move through the timeline and inspect what legislators were saying around key dates.',
      visualKind: 'moment',
      visualLabel: 'Event timeline'
    }
  ];

  const rootData = $derived(toRecord(data));
  const metaPayload = $derived(rootData.meta ?? null);
  const metadata = $derived(extractMetadata(metaPayload));

  const rowCounts = $derived(extractRowCounts(metadata));

  const postCountLabel = $derived(
    displayCount(rowCounts.posts, '22 million')
  );

  const legislatorCountLabel = $derived(
    displayCount(rowCounts.legislators, '5,927')
  );

  const coverageLabel = $derived(
    coverageRangeLabel(metadata) ??
      'January 2020 through December 2024'
  );

  const pageDescription = $derived(
    `Explore ${postCountLabel} public posts from ${legislatorCountLabel} U.S. state legislators, covering ${coverageLabel}.`
  );

  function isRecord(
    value: unknown
  ): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    );
  }

  function toRecord(
    value: unknown
  ): Record<string, unknown> {
    return isRecord(value) ? value : {};
  }

  function cleanText(value: unknown): string | null {
    if (
      typeof value !== 'string' &&
      typeof value !== 'number'
    ) {
      return null;
    }

    const text = String(value).trim();

    if (
      !text ||
      /^(?:nan|na|n\/a|null|none|undefined)$/i.test(text)
    ) {
      return null;
    }

    return text;
  }

  function firstValue(values: unknown[]): unknown {
    for (const value of values) {
      if (
        value !== null &&
        value !== undefined &&
        value !== ''
      ) {
        return value;
      }
    }

    return null;
  }

  function firstRecord(
    values: unknown[]
  ): Record<string, unknown> {
    for (const value of values) {
      if (isRecord(value)) {
        return value;
      }
    }

    return {};
  }

  function normalizeCount(value: unknown): number | null {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return null;
    }

    const number =
      typeof value === 'number' ? value : Number(value);

    if (!Number.isFinite(number)) {
      return null;
    }

    return Math.max(0, Math.trunc(number));
  }

  function displayCount(
    value: number | null,
    fallback: string
  ): string {
    if (value === null) {
      return fallback;
    }

    try {
      return compact(value);
    } catch {
      return value.toLocaleString('en-US');
    }
  }

  function extractMetadata(
    value: unknown
  ): Record<string, unknown> {
    const meta = toRecord(value);
    const nested = toRecord(meta.data);

    if (Object.keys(nested).length > 0) {
      return nested;
    }

    return meta;
  }

  function extractRowCounts(
    meta: Record<string, unknown>
  ): {
    posts: number | null;
    legislators: number | null;
    states: number | null;
    topics: number | null;
  } {
    const counts = firstRecord([
      meta.rowCounts,
      meta.row_counts,
      meta.counts
    ]);

    return {
      posts: normalizeCount(
        firstValue([
          counts.posts,
          counts.postCount,
          counts.post_count,
          meta.posts,
          meta.postCount,
          meta.post_count
        ])
      ),
      legislators: normalizeCount(
        firstValue([
          counts.legislators,
          counts.legislatorCount,
          counts.legislator_count,
          meta.legislators,
          meta.legislatorCount,
          meta.legislator_count
        ])
      ),
      states: normalizeCount(
        firstValue([
          counts.states,
          counts.stateCount,
          counts.state_count,
          meta.states,
          meta.stateCount,
          meta.state_count
        ])
      ),
      topics: normalizeCount(
        firstValue([
          counts.topics,
          counts.topicCategories,
          counts.topic_categories,
          counts.topicCount,
          counts.topic_count,
          meta.topics,
          meta.topicCount,
          meta.topic_count
        ])
      )
    };
  }

  function formatCoverageDate(
    value: unknown
  ): string | null {
    const text = cleanText(value);

    if (!text) {
      return null;
    }

    const normalized =
      /^\d{4}-\d{2}$/.test(text)
        ? `${text}-01T00:00:00.000Z`
        : /^\d{4}-\d{2}-\d{2}$/.test(text)
          ? `${text}T00:00:00.000Z`
          : text;

    const timestamp = Date.parse(normalized);

    if (!Number.isFinite(timestamp)) {
      return text;
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(timestamp));
  }

  function nestedValue(
    source: unknown,
    keys: string[]
  ): unknown {
    const record = toRecord(source);

    return firstValue(keys.map((key) => record[key]));
  }

  function coverageRangeLabel(
    meta: Record<string, unknown>
  ): string | null {
    const coverage = firstRecord([
      meta.coverage,
      meta.dateRange,
      meta.date_range,
      meta.collectionPeriod,
      meta.collection_period
    ]);

    const start = formatCoverageDate(
      firstValue([
        coverage.start,
        coverage.startDate,
        coverage.start_date,
        coverage.minDate,
        coverage.min_date,
        meta.start,
        meta.startDate,
        meta.start_date,
        meta.minDate,
        meta.min_date,
        nestedValue(meta.coverage, [
          'start',
          'startDate',
          'start_date'
        ]),
        nestedValue(meta.dateRange, [
          'start',
          'startDate',
          'start_date'
        ]),
        nestedValue(meta.date_range, [
          'start',
          'startDate',
          'start_date'
        ])
      ])
    );

    const end = formatCoverageDate(
      firstValue([
        coverage.end,
        coverage.endDate,
        coverage.end_date,
        coverage.maxDate,
        coverage.max_date,
        meta.end,
        meta.endDate,
        meta.end_date,
        meta.maxDate,
        meta.max_date,
        nestedValue(meta.coverage, [
          'end',
          'endDate',
          'end_date'
        ]),
        nestedValue(meta.dateRange, [
          'end',
          'endDate',
          'end_date'
        ]),
        nestedValue(meta.date_range, [
          'end',
          'endDate',
          'end_date'
        ])
      ])
    );

    if (start && end) {
      return `${start} through ${end}`;
    }

    if (start) {
      return `from ${start}`;
    }

    if (end) {
      return `through ${end}`;
    }

    return null;
  }
</script>

<svelte:head>
  <title>CivicWatch | Explore state legislative posts</title>

  <meta
    name="description"
    content={pageDescription}
  />
</svelte:head>

<section class="home-hero">
  <div class="container hero-layout">
    <div class="hero-copy">
      <h1>
        Explore
        <AnimatedNumber value={rowCounts.posts} fallback={postCountLabel} />
        public posts from
        <AnimatedNumber value={rowCounts.legislators} fallback={legislatorCountLabel} />
        U.S. state legislators.
      </h1>

      <p class="lede">
        CivicWatch opens up state legislative communication
        across {coverageLabel}, so anyone can inspect what
        lawmakers discuss, where attention concentrates, and
        how patterns differ across people, places, parties,
        topics, and moments.
      </p>
    </div>

    <aside
      class="hero-facts"
      aria-label="Dataset overview"
    >
      <StatStrip
        meta={metaPayload}
        compactMode
      />
    </aside>
  </div>
</section>

<section
  class="entry-section"
  aria-labelledby="entry-heading"
>
  <div class="container">
    <div class="section-heading">
      <p class="eyebrow">Start exploring</p>

      <h2 id="entry-heading">
        Four practical ways into the archive
      </h2>

      <p>
        Begin with a legislator, a state, a topic, or a
        point in time. Each path stays linkable and works as
        a stable route into the same underlying dataset.
      </p>
    </div>

    <div class="entry-grid">
      {#each entryCards as card (card.href)}
        <a
          class="entry-card"
          href={card.href}
        >
          <span class="entry-copy">
            <span class="entry-eyebrow">
              {card.eyebrow}
            </span>

            <strong>{card.title}</strong>

            <em>{card.body}</em>
          </span>

          <EntryMicrovisual
            kind={card.visualKind}
            label={card.visualLabel}
          />
        </a>
      {/each}
    </div>
  </div>
</section>

<style>
  .home-hero {
    padding-block: clamp(34px, 5.5vw, 64px) 24px;
    color: var(--color-ink, #1a1917);
    background:
      linear-gradient(
        to bottom,
        color-mix(
          in srgb,
          var(--color-seal, #8a5a1a) 5%,
          transparent
        ),
        transparent 46%
      ),
      var(--color-paper, #f5f1e7);
    border-bottom: 1px solid
      var(--color-rule, #d9d2c1);
  }

  .hero-layout {
    display: grid;
    grid-template-columns:
      minmax(0, 1.35fr)
      minmax(320px, 0.65fr);
    gap: clamp(28px, 5vw, 72px);
    align-items: end;
  }

  .hero-copy {
    max-width: 980px;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: var(--color-seal, #8a5a1a);
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    max-width: 18ch;
    margin: 0;
    font-size: clamp(2.05rem, 5vw, 4.25rem);
    font-weight: 740;
    line-height: 0.98;
    letter-spacing: -0.052em;
  }

  .lede {
    max-width: 74ch;
    margin: 18px 0 0;
    color: var(--color-mute, #6b6659);
    font-size: clamp(1rem, 1.2vw, 1.16rem);
    line-height: 1.65rem;
  }

  .hero-facts {
    display: grid;
    gap: 10px;
    min-width: 0;
    width: min(100%, 460px);
    padding: 12px;
    background: color-mix(
      in srgb,
      var(--color-card, #fff) 82%,
      transparent
    );
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  .entry-section {
    padding-block: clamp(34px, 5vw, 58px);
  }

  .section-heading {
    max-width: 760px;
    margin-bottom: 18px;
  }

  .section-heading h2 {
    margin: 0;
    font-size: clamp(1.45rem, 2.4vw, 2.15rem);
    line-height: 1.08;
    letter-spacing: -0.035em;
  }

  .section-heading p:not(.eyebrow) {
    max-width: 68ch;
    margin: 8px 0 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.92rem;
    line-height: 1.45rem;
  }

  .entry-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .entry-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    align-items: end;
    min-width: 0;
    min-height: 158px;
    padding: 14px;
    color: var(--color-ink, #1a1917);
    text-decoration: none;
    background: var(--color-card, #fff);
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 6px;
    transition:
      color 120ms ease,
      background-color 120ms ease,
      border-color 120ms ease,
      box-shadow 120ms ease;
  }

  .entry-card:hover {
    color: var(--color-seal, #8a5a1a);
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 4%,
      var(--color-card, #fff)
    );
    border-color: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 38%,
      var(--color-rule, #d9d2c1)
    );
    box-shadow: 0 8px 24px rgb(26 25 23 / 5%);
  }

  .entry-card:focus-visible {
    outline: 2px solid var(--color-seal, #8a5a1a);
    outline-offset: 3px;
  }

  .entry-copy {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  .entry-eyebrow {
    color: var(--color-mute-soft, #9c9787);
    font-size: 0.64rem;
    font-weight: 700;
    line-height: 0.9rem;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .entry-copy strong {
    color: currentColor;
    font-size: 0.96rem;
    line-height: 1.15rem;
  }

  .entry-copy em {
    color: var(--color-mute, #6b6659);
    font-size: 0.78rem;
    font-style: normal;
    line-height: 1.2rem;
  }

  @media (max-width: 1120px) {
    .hero-layout {
      grid-template-columns: 1fr;
      align-items: start;
    }

    h1 {
      max-width: 17ch;
    }

    .hero-facts {
      max-width: 760px;
    }

    .entry-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

  }

  @media (max-width: 720px) {
    .home-hero {
      padding-block: 30px 20px;
    }

    h1 {
      max-width: 14ch;
      font-size: clamp(2rem, 11vw, 3.25rem);
    }

    .lede {
      margin-top: 18px;
      font-size: 0.96rem;
      line-height: 1.48rem;
    }

    .hero-facts {
      padding: 12px;
    }

    .entry-grid {
      grid-template-columns: 1fr;
    }

    .entry-card {
      min-height: 132px;
    }

  }

  @media (max-width: 460px) {
    .entry-card {
      grid-template-columns: 1fr;
      gap: 12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .entry-card {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .home-hero,
    .hero-facts,
    .entry-card {
      color: CanvasText;
      background: Canvas;
      border-color: CanvasText;
    }

    .entry-card:focus-visible {
      outline-color: Highlight;
    }
  }

  @media print {
    .home-hero {
      background: transparent;
      border-color: #999;
    }

    .entry-card,
    .hero-facts {
      break-inside: avoid;
      box-shadow: none;
    }
  }
</style>
