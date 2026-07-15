<script lang="ts">
  import { compact } from '$lib/format';

  interface Props {
    meta?: unknown;
    ariaLabel?: string;

    /**
     * Used only when the metadata does not expose
     * collection boundaries.
     */
    fallbackStartDate?: string | null;
    fallbackEndDate?: string | null;

    showDateRange?: boolean;
    showMissing?: boolean;
    compactMode?: boolean;
  }

  interface CoverageCounts {
    posts: number | null;
    legislators: number | null;
    states: number | null;
    topics: number | null;
  }

  interface CoverageMetric {
    key: keyof CoverageCounts;
    value: number | null;
    label: string;
    singularLabel: string;
  }

  interface DateValue {
    label: string;
    dateTime: string | null;
  }

  interface CoverageRange {
    start: DateValue | null;
    end: DateValue | null;
    label: string;
  }

  let {
    meta = null,
    ariaLabel = 'Dataset coverage summary',
    fallbackStartDate = '2020-01-01',
    fallbackEndDate = '2024-12-31',
    showDateRange = true,
    showMissing = true,
    compactMode = false
  }: Props = $props();

  const normalizedCounts = $derived(
    extractCounts(meta)
  );

  const metrics = $derived.by(
    (): CoverageMetric[] => {
      const result: CoverageMetric[] = [
        {
          key: 'posts',
          value: normalizedCounts.posts,
          label: 'posts',
          singularLabel: 'post'
        },
        {
          key: 'legislators',
          value:
            normalizedCounts.legislators,
          label: 'legislators',
          singularLabel: 'legislator'
        },
        {
          key: 'states',
          value: normalizedCounts.states,
          label: 'states',
          singularLabel: 'state'
        },
        {
          key: 'topics',
          value: normalizedCounts.topics,
          label: 'topic categories',
          singularLabel: 'topic category'
        }
      ];

      return showMissing
        ? result
        : result.filter(
            (metric) =>
              metric.value !== null
          );
    }
  );

  const coverageRange = $derived(
    extractCoverageRange(
      meta,
      fallbackStartDate,
      fallbackEndDate
    )
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

  function firstValue(
    values: unknown[]
  ): unknown {
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

  function normalizeCount(
    value: unknown
  ): number | null {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return null;
    }

    const number =
      typeof value === 'number'
        ? value
        : Number(value);

    if (!Number.isFinite(number)) {
      return null;
    }

    return Math.max(
      0,
      Math.trunc(number)
    );
  }

  function extractCounts(
    value: unknown
  ): CoverageCounts {
    const root = isRecord(value)
      ? value
      : {};

    const data = isRecord(root.data)
      ? root.data
      : {};

    const counts = firstRecord([
      data.rowCounts,
      data.row_counts,
      root.rowCounts,
      root.row_counts,
      data.counts,
      root.counts
    ]);

    return {
      posts: normalizeCount(
        firstValue([
          counts.posts,
          counts.postCount,
          counts.post_count,
          data.postCount,
          data.post_count
        ])
      ),

      legislators: normalizeCount(
        firstValue([
          counts.legislators,
          counts.legislatorCount,
          counts.legislator_count,
          data.legislatorCount,
          data.legislator_count
        ])
      ),

      states: normalizeCount(
        firstValue([
          counts.states,
          counts.stateCount,
          counts.state_count,
          data.stateCount,
          data.state_count
        ])
      ),

      topics: normalizeCount(
        firstValue([
          counts.topics,
          counts.topicCategories,
          counts.topic_categories,
          counts.topicCount,
          counts.topic_count,
          data.topicCount,
          data.topic_count
        ])
      )
    };
  }

  function cleanText(
    value: unknown
  ): string | null {
    if (
      typeof value !== 'string' &&
      typeof value !== 'number'
    ) {
      return null;
    }

    const text = String(value).trim();

    if (
      !text ||
      /^(?:nan|na|n\/a|null|none)$/i.test(
        text
      )
    ) {
      return null;
    }

    return text;
  }

  function normalizeDate(
    value: unknown
  ): DateValue | null {
    const text = cleanText(value);

    if (!text) return null;

    const timestamp = Date.parse(text);

    if (!Number.isFinite(timestamp)) {
      return {
        label: text,
        dateTime: null
      };
    }

    const date = new Date(timestamp);

    return {
      label: new Intl.DateTimeFormat(
        'en-US',
        {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC'
        }
      ).format(date),

      dateTime: date
        .toISOString()
        .slice(0, 10)
    };
  }

  function extractCoverageRange(
    value: unknown,
    fallbackStart: string | null,
    fallbackEnd: string | null
  ): CoverageRange {
    const root = isRecord(value)
      ? value
      : {};

    const data = isRecord(root.data)
      ? root.data
      : {};

    const coverage = firstRecord([
      data.coverage,
      root.coverage,
      data.dateRange,
      data.date_range,
      root.dateRange,
      root.date_range,
      data.collectionPeriod,
      root.collectionPeriod
    ]);

    const startValue = firstValue([
      coverage.startDate,
      coverage.start_date,
      coverage.start,
      coverage.minDate,
      coverage.min_date,
      data.startDate,
      data.start_date,
      data.minCreatedAt,
      data.min_created_at,
      root.startDate,
      root.start_date,
      fallbackStart
    ]);

    const endValue = firstValue([
      coverage.endDate,
      coverage.end_date,
      coverage.end,
      coverage.maxDate,
      coverage.max_date,
      data.endDate,
      data.end_date,
      data.maxCreatedAt,
      data.max_created_at,
      root.endDate,
      root.end_date,
      fallbackEnd
    ]);

    const start = normalizeDate(startValue);
    const end = normalizeDate(endValue);

    let label = 'Coverage dates unavailable';

    if (start && end) {
      label = `${start.label}–${end.label}`;
    } else if (start) {
      label = `From ${start.label}`;
    } else if (end) {
      label = `Through ${end.label}`;
    }

    return {
      start,
      end,
      label
    };
  }

  function displayCount(
    value: number | null
  ): string {
    if (value === null) return '—';

    try {
      return compact(value);
    } catch {
      return value.toLocaleString('en-US');
    }
  }

  function exactCount(
    value: number | null
  ): string {
    return value === null
      ? 'Not reported'
      : value.toLocaleString('en-US');
  }

  function metricLabel(
    metric: CoverageMetric
  ): string {
    return metric.value === 1
      ? metric.singularLabel
      : metric.label;
  }

  function metricDescription(
    metric: CoverageMetric
  ): string {
    if (metric.value === null) {
      return `${metric.label}: not reported`;
    }

    return `${exactCount(
      metric.value
    )} ${metricLabel(metric)}`;
  }
</script>

<dl
  class:compact={compactMode}
  class="stat-strip"
  aria-label={ariaLabel}
>
  {#each metrics as metric (metric.key)}
    <div
      class="stat"
      title={metricDescription(metric)}
    >
      <dd>
        {#if metric.value !== null}
          <data value={String(metric.value)}>
            {displayCount(metric.value)}
          </data>
        {:else}
          <span
            class="missing"
            aria-label="Not reported"
          >
            —
          </span>
        {/if}
      </dd>

      <dt>{metricLabel(metric)}</dt>
    </div>
  {/each}

  {#if showDateRange}
    <div
      class="stat coverage"
      title={coverageRange.label}
    >
      <dd class="date-range">
        {#if
          coverageRange.start &&
          coverageRange.end
        }
          <time
            datetime={coverageRange.start
              .dateTime ?? undefined}
          >
            {coverageRange.start.label}
          </time>

          <span
            class="date-separator"
            aria-hidden="true"
          >
            –
          </span>

          <time
            datetime={coverageRange.end
              .dateTime ?? undefined}
          >
            {coverageRange.end.label}
          </time>
        {:else if coverageRange.start}
          <span class="date-prefix">
            From
          </span>

          <time
            datetime={coverageRange.start
              .dateTime ?? undefined}
          >
            {coverageRange.start.label}
          </time>
        {:else if coverageRange.end}
          <span class="date-prefix">
            Through
          </span>

          <time
            datetime={coverageRange.end
              .dateTime ?? undefined}
          >
            {coverageRange.end.label}
          </time>
        {:else}
          <span class="missing">
            —
          </span>
        {/if}
      </dd>

      <dt>coverage period</dt>
    </div>
  {/if}
</dl>

<style>
  .stat-strip {
    display: grid;
    grid-template-columns: repeat(
      auto-fit,
      minmax(min(100%, 132px), 1fr)
    );
    gap: 8px;
    align-items: stretch;
    min-width: 0;
    padding: 0;
    margin: 0;
    color: var(--color-ink, #1a1917);
  }

  .stat {
    display: grid;
    gap: 2px;
    align-content: start;
    min-width: 0;
    padding: 10px 11px;
    background: color-mix(
      in srgb,
      var(--color-card, #fff) 76%,
      transparent
    );
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  .stat:first-child {
    padding-inline-start: 11px;
  }

  .stat dd,
  .stat dt {
    min-width: 0;
    margin: 0;
  }

  .stat dd {
    color: var(--color-ink, #1a1917);
    font-family: var(
      --font-data,
      var(
        --type-mono,
        'JetBrains Mono',
        ui-monospace,
        monospace
      )
    );
    font-size: 0.84rem;
    font-weight: 650;
    line-height: 1.15rem;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }

  .stat dt {
    color: var(--color-mute, #6b6659);
    font-size: 0.76rem;
    line-height: 1.1rem;
    overflow-wrap: anywhere;
  }

  .coverage {
    grid-column: span 2;
  }

  .date-range {
    display: inline-flex;
    gap: 4px;
    align-items: baseline;
  }

  .date-prefix {
    color: var(--color-mute, #6b6659);
    font-family: var(
      --font-body,
      'Instrument Sans',
      system-ui,
      sans-serif
    );
    font-size: 0.72rem;
    font-weight: 500;
  }

  .date-separator {
    color: var(
      --color-mute-soft,
      #9c9787
    );
  }

  .missing {
    color: var(
      --color-mute-soft,
      #9c9787
    );
    font-weight: 500;
  }

  .stat-strip.compact {
    grid-template-columns: repeat(
      auto-fit,
      minmax(min(100%, 118px), 1fr)
    );
    gap: 8px;
  }

  .compact .stat {
    padding: 9px 10px;
  }

  .compact .stat dd {
    font-size: 0.78rem;
  }

  .compact .stat dt {
    font-size: 0.7rem;
  }

  @media (max-width: 760px) {
    .stat-strip {
      grid-template-columns:
        repeat(
          2,
          minmax(0, 1fr)
        );
      gap: 8px;
    }

    .stat {
      grid-template-columns: 1fr;
      gap: 2px;
    }

    .stat:first-child {
      padding-inline-start: 10px;
    }

    .stat dd {
      font-size: 0.82rem;
    }

    .stat dt {
      white-space: normal;
    }

    .coverage {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 390px) {
    .stat-strip {
      grid-template-columns: 1fr;
    }

    .stat,
    .stat:nth-child(-n + 2),
    .stat:nth-child(even) {
      display: grid;
    }

    .coverage {
      grid-column: auto;
    }
  }

  @media (forced-colors: active) {
    .stat-strip,
    .stat {
      color: CanvasText;
      border-color: CanvasText;
    }

    .stat dd,
    .stat dt,
    .missing,
    .date-prefix {
      color: CanvasText;
    }
  }

  @media print {
    .stat-strip {
      color: #000;
      border-color: #999;
      break-inside: avoid;
    }

    .stat {
      border-color: #999;
    }

    .stat dd,
    .stat dt {
      color: #000;
    }
  }
</style>
