<script lang="ts">
  import { compact } from '$lib/format';
  import { withBase } from '$lib/paths';
  import TopicIcon from './TopicIcon.svelte';

  type SortDirection = 'none' | 'asc' | 'desc';

  interface Props {
    rows?: any[];
    labelKey?: string;
    valueKey?: string;
    hrefPrefix?: string | null;

    /**
     * Field appended to hrefPrefix when creating drilldown links.
     * The original behavior used row.topic.
     */
    hrefKey?: string;

    /**
     * Maximum number of rows shown. Set to null to show all rows.
     */
    limit?: number | null;

    /**
     * Defaults to "none" to preserve the incoming row order.
     */
    sort?: SortDirection;

    /**
     * Optional common maximum for comparable panels.
     * The component will never use a maximum below the observed value.
     */
    maxValue?: number | null;

    ariaLabel?: string;
    valueLabel?: string;
    emptyMessage?: string;
    showRank?: boolean;
    showSummary?: boolean;
    showTopicIcons?: boolean | null;

    /**
     * Optional custom value formatter.
     */
    formatValue?: ((value: number, row: any) => string) | null;
  }

  interface NormalizedRow {
    key: string;
    label: string;
    value: number;
    href: string | null;
    raw: any;
    sourceIndex: number;
  }

  let {
    rows = [],
    labelKey = 'topicLabel',
    valueKey = 'postCount',
    hrefPrefix = null,
    hrefKey = 'topic',
    limit = 8,
    sort = 'none',
    maxValue = null,
    ariaLabel = 'Categorical values',
    valueLabel = 'posts',
    emptyMessage = 'No data is available for this view.',
    showRank = false,
    showSummary = false,
    showTopicIcons = null,
    formatValue = null
  }: Props = $props();

  const collator = new Intl.Collator('en-US', {
    sensitivity: 'base',
    numeric: true
  });

  const safeHrefPrefix = $derived(
    normalizeHrefPrefix(hrefPrefix)
  );

  const displaysTopicIcons = $derived(
    showTopicIcons ??
      Boolean(safeHrefPrefix?.includes('/topic'))
  );

  const normalizedRows = $derived.by(() =>
    rows
      .map((row, index) =>
        normalizeRow(row, index)
      )
      .filter(
        (row): row is NormalizedRow =>
          row !== null
      )
  );

  const orderedRows = $derived.by(() => {
    if (sort === 'none') {
      return normalizedRows;
    }

    return [...normalizedRows].sort(
      (left, right) => {
        const valueComparison =
          left.value - right.value;

        if (valueComparison !== 0) {
          return sort === 'asc'
            ? valueComparison
            : -valueComparison;
        }

        return collator.compare(
          left.label,
          right.label
        );
      }
    );
  });

  const safeLimit = $derived(
    limit === null
      ? orderedRows.length
      : Number.isFinite(limit)
        ? Math.max(0, Math.trunc(limit))
        : 8
  );

  const visibleRows = $derived(
    orderedRows.slice(0, safeLimit)
  );

  const hiddenCount = $derived(
    Math.max(
      0,
      orderedRows.length - visibleRows.length
    )
  );

  const observedMaximum = $derived(
    visibleRows.reduce(
      (maximum, row) =>
        Math.max(maximum, row.value),
      0
    )
  );

  const scaleMaximum = $derived(
    Math.max(
      1,
      observedMaximum,
      finiteNonNegative(maxValue)
    )
  );

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
      /^(?:nan|na|n\/a|null|none)$/i.test(text)
    ) {
      return null;
    }

    return text;
  }

  function finiteNonNegative(
    value: unknown
  ): number {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return 0;
    }

    const number =
      typeof value === 'number'
        ? value
        : Number(value);

    return Number.isFinite(number)
      ? Math.max(0, number)
      : 0;
  }

  function normalizeHrefPrefix(
    prefix: string | null
  ): string | null {
    if (typeof prefix !== 'string') {
      return null;
    }

    const value = prefix.trim();

    if (!value) return null;

    const compactValue = value.replace(
      /[\u0000-\u0020\u007f]+/g,
      ''
    );

    if (
      /^(?:javascript|data|vbscript):/i.test(
        compactValue
      )
    ) {
      return null;
    }

    return withBase(value);
  }

  function buildHref(
    row: Record<string, unknown>
  ): string | null {
    if (!safeHrefPrefix) return null;

    const segment =
      cleanText(row[hrefKey]) ??
      cleanText(row.topic);

    if (!segment) return null;

    return withBase(`${safeHrefPrefix}${encodeURIComponent(
      segment
    )}`);
  }

  function normalizeRow(
    row: any,
    index: number
  ): NormalizedRow | null {
    if (
      !row ||
      typeof row !== 'object' ||
      Array.isArray(row)
    ) {
      return null;
    }

    const label =
      cleanText(row[labelKey]) ??
      cleanText(row.topic_label) ??
      cleanText(row.topicLabel) ??
      cleanText(row.label) ??
      cleanText(row.name) ??
      cleanText(row.topic) ??
      cleanText(row.party) ??
      '—';

    const value = finiteNonNegative(
      row[valueKey]
    );

    const identity =
      cleanText(row.id) ??
      cleanText(row.topic) ??
      cleanText(row.state) ??
      cleanText(row.party) ??
      cleanText(row.lid) ??
      `${label}-${index}`;

    return {
      key: `${identity}-${index}`,
      label,
      value,
      href: buildHref(row),
      raw: row,
      sourceIndex: index
    };
  }

  function barScale(
    value: number
  ): number {
    if (scaleMaximum <= 0) return 0;

    return Math.min(
      1,
      Math.max(0, value / scaleMaximum)
    );
  }

  function displayValue(
    row: NormalizedRow
  ): string {
    if (formatValue) {
      try {
        const formatted = formatValue(
          row.value,
          row.raw
        );

        if (
          typeof formatted === 'string' &&
          formatted.trim()
        ) {
          return formatted;
        }
      } catch {
        // Fall through to the standard formatter.
      }
    }

    return compact(row.value);
  }

  function accessibleValueLabel(
    row: NormalizedRow
  ): string {
    const unit = valueLabel.trim();

    return unit
      ? `${displayValue(row)} ${unit}`
      : displayValue(row);
  }
</script>

{#if visibleRows.length}
  <div class="mini-bars">
    <ol
      class:no-rank={!showRank}
      aria-label={ariaLabel}
    >
      {#each visibleRows as row, index (row.key)}
        <li class="bar-row">
          {#if showRank}
            <span
              class="rank"
              aria-hidden="true"
            >
              {index + 1}
            </span>
          {/if}

          <div class="label-cell">
            {#if row.href}
              <a
                href={row.href}
                title={row.label}
              >
                {#if displaysTopicIcons}
                  <TopicIcon label={row.label} size={12} />
                {/if}

                <span>{row.label}</span>
              </a>
            {:else}
              <span title={row.label}>
                {#if displaysTopicIcons}
                  <TopicIcon label={row.label} size={12} />
                {/if}

                <span>{row.label}</span>
              </span>
            {/if}
          </div>

          <div
            class="bar-cell"
            aria-hidden="true"
          >
            <span class="bar-track">
              <span
                class="bar-fill"
                style={`--bar-scale:${barScale(row.value)}`}
              ></span>
            </span>
          </div>

          <data
            class="value"
            value={String(row.value)}
            aria-label={accessibleValueLabel(row)}
          >
            {displayValue(row)}
          </data>
        </li>
      {/each}
    </ol>

    {#if showSummary && hiddenCount > 0}
      <p class="summary">
        Showing
        {visibleRows.length.toLocaleString()}
        of
        {orderedRows.length.toLocaleString()}
        categories.
      </p>
    {/if}
  </div>
{:else if emptyMessage}
  <p class="empty-state" role="status">
    {emptyMessage}
  </p>
{/if}

<style>
  .mini-bars {
    min-width: 0;
  }

  ol {
    display: grid;
    gap: 0;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .bar-row {
    display: grid;
    grid-template-columns:
      28px
      minmax(110px, 1fr)
      minmax(96px, 1.25fr)
      minmax(54px, auto);
    grid-template-areas:
      'rank label bar value';
    gap: 10px;
    align-items: center;
    min-width: 0;
    min-height: 36px;
    padding-block: 7px;
    font-size: 0.875rem;
    line-height: 1.2rem;
    border-top: 1px solid
      color-mix(
        in srgb,
        var(--color-rule, #d9d2c1) 62%,
        transparent
      );
  }

  .bar-row:first-child {
    border-top: 0;
  }

  ol.no-rank .bar-row {
    grid-template-columns:
      minmax(110px, 1fr)
      minmax(96px, 1.25fr)
      minmax(54px, auto);
    grid-template-areas:
      'label bar value';
  }

  .rank {
    grid-area: rank;
    color: var(--color-mute-soft, #9c9787);
    font-family: var(
      --font-data,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.69rem;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .label-cell {
    grid-area: label;
    min-width: 0;
  }

  .label-cell > a,
  .label-cell > span {
    display: flex;
    gap: 7px;
    align-items: center;
    min-width: 0;
    overflow: hidden;
    color: var(--color-ink, #1a1917);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .label-cell > a > span:last-child,
  .label-cell > span > span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .label-cell > a {
    text-decoration-line: underline;
    text-decoration-color: transparent;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
    border-radius: 3px;
    transition:
      color 120ms ease,
      text-decoration-color 120ms ease;
  }

  .label-cell > a:hover {
    color: var(--color-seal, #8a5a1a);
    text-decoration-color: currentColor;
  }

  .label-cell > a:focus-visible {
    color: var(--color-seal, #8a5a1a);
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .bar-cell {
    grid-area: bar;
    min-width: 0;
  }

  .bar-track {
    position: relative;
    display: block;
    width: 100%;
    height: 8px;
    overflow: hidden;
    background: var(
      --color-track,
      color-mix(
        in srgb,
        var(--color-rule, #d9d2c1) 48%,
        var(--color-card, #fff)
      )
    );
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 2px;
  }

  .bar-fill {
    position: absolute;
    inset: -1px;
    background: var(--color-seal, #8a5a1a);
    border-radius: inherit;
    transform: scaleX(var(--bar-scale));
    transform-origin: left center;
    transition: transform 240ms ease-out;
    will-change: transform;
  }

  .value {
    grid-area: value;
    min-width: 0;
    color: var(--color-mute, #6b6659);
    font-family: var(
      --font-data,
      var(
        --type-mono,
        'JetBrains Mono',
        ui-monospace,
        monospace
      )
    );
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
  }

  .summary {
    margin: 8px 0 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.75rem;
    line-height: 1.1rem;
  }

  .empty-state {
    min-height: 52px;
    padding: 14px;
    margin: 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.82rem;
    line-height: 1.3rem;
    text-align: center;
    background: var(--color-card, #fff);
    border: 1px dashed
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  @media (max-width: 620px) {
    .bar-row {
      grid-template-columns:
        24px minmax(0, 1fr) auto;
      grid-template-areas:
        'rank label value'
        '. bar bar';
      gap: 5px 8px;
      padding-block: 9px;
    }

    ol.no-rank .bar-row {
      grid-template-columns:
        minmax(0, 1fr) auto;
      grid-template-areas:
        'label value'
        'bar bar';
    }

    .label-cell > a,
    .label-cell > span {
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .label-cell > a > span:last-child,
    .label-cell > span > span:last-child {
      white-space: normal;
    }

    .bar-track {
      height: 7px;
    }
  }

  @media (max-width: 360px) {
    .bar-row {
      grid-template-columns:
        22px minmax(0, 1fr) auto;
    }

    .value {
      font-size: 0.73rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .label-cell a,
    .bar-fill {
      transition: none;
    }

    .bar-fill {
      will-change: auto;
    }
  }

  @media (forced-colors: active) {
    .bar-track {
      background: Canvas;
      border-color: CanvasText;
    }

    .bar-fill {
      background: Highlight;
    }

    .label-cell > a,
    .label-cell > span,
    .value,
    .rank {
      color: CanvasText;
    }

    .label-cell a:focus-visible {
      outline-color: Highlight;
    }
  }

  @media print {
    .bar-fill {
      background: #555;
      print-color-adjust: exact;
    }

    .bar-track {
      border-color: #999;
    }
  }
</style>
