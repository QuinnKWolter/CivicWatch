<script lang="ts">
  import { compact } from '$lib/format';
  import { withBase } from '$lib/paths';

  type SortMode = 'state' | 'total';

  interface Props {
    rows?: any[];

    title?: string;
    caption?: string;
    ariaLabel?: string;

    hrefPrefix?: string | null;

    /**
     * Number of globally leading categorized topics assigned
     * their own consistent color across every state.
     *
     * Remaining categorized topics are combined into "Other".
     */
    maxTopics?: number;

    sort?: SortMode;
    showLegend?: boolean;
    showSummary?: boolean;
    showLeadingTopic?: boolean;
    includeUnknownState?: boolean;

    valueLabel?: string;
    valueLabelSingular?: string;
    emptyMessage?: string;

    /**
     * Optional state or jurisdiction name overrides.
     *
     * Example:
     * {
     *   CA: 'California',
     *   PR: 'Puerto Rico'
     * }
     */
    stateNames?: Record<string, string>;

    formatValue?: (
      value: number,
      context: {
        state: string;
        topic?: string;
      }
    ) => string;
  }

  interface NormalizedInputRow {
    state: string;
    topicKey: string;
    topicLabel: string;
    count: number;
    uncategorized: boolean;
  }

  interface TopicTotal {
    key: string;
    label: string;
    count: number;
    uncategorized: boolean;
  }

  interface Category {
    key: string;
    label: string;
    colorClass: string;
    kind:
      | 'topic'
      | 'other'
      | 'uncategorized';
  }

  interface StateTopic {
    key: string;
    label: string;
    count: number;
    uncategorized: boolean;
  }

  interface StateSegment {
    key: string;
    label: string;
    count: number;
    share: number;
    colorClass: string;
  }

  interface StateSummary {
    code: string;
    name: string;
    total: number;
    href: string | null;
    segments: StateSegment[];
    leadingTopic: StateTopic | null;
    leadingShare: number;
    accessibleLabel: string;
  }

  let {
    rows = [],
    title = '',
    caption = '',
    ariaLabel = 'State topic mix',
    hrefPrefix = '/place/',
    maxTopics = 5,
    sort = 'state',
    showLegend = true,
    showSummary = false,
    showLeadingTopic = true,
    includeUnknownState = true,
    valueLabel = 'posts',
    valueLabelSingular = 'post',
    emptyMessage = 'No state topic data is available.',
    stateNames = {},
    formatValue
  }: Props = $props();

  const OTHER_KEY = '__other__';
  const UNCATEGORIZED_KEY =
    '__uncategorized__';
  const UNKNOWN_STATE = '??';

  const TOPIC_COLOR_CLASSES = [
    'tone-0',
    'tone-1',
    'tone-2',
    'tone-3',
    'tone-4',
    'tone-5'
  ] as const;

  const DEFAULT_STATE_NAMES: Record<
    string,
    string
  > = {
    AL: 'Alabama',
    AK: 'Alaska',
    AZ: 'Arizona',
    AR: 'Arkansas',
    CA: 'California',
    CO: 'Colorado',
    CT: 'Connecticut',
    DE: 'Delaware',
    FL: 'Florida',
    GA: 'Georgia',
    HI: 'Hawaii',
    ID: 'Idaho',
    IL: 'Illinois',
    IN: 'Indiana',
    IA: 'Iowa',
    KS: 'Kansas',
    KY: 'Kentucky',
    LA: 'Louisiana',
    ME: 'Maine',
    MD: 'Maryland',
    MA: 'Massachusetts',
    MI: 'Michigan',
    MN: 'Minnesota',
    MS: 'Mississippi',
    MO: 'Missouri',
    MT: 'Montana',
    NE: 'Nebraska',
    NV: 'Nevada',
    NH: 'New Hampshire',
    NJ: 'New Jersey',
    NM: 'New Mexico',
    NY: 'New York',
    NC: 'North Carolina',
    ND: 'North Dakota',
    OH: 'Ohio',
    OK: 'Oklahoma',
    OR: 'Oregon',
    PA: 'Pennsylvania',
    RI: 'Rhode Island',
    SC: 'South Carolina',
    SD: 'South Dakota',
    TN: 'Tennessee',
    TX: 'Texas',
    UT: 'Utah',
    VT: 'Vermont',
    VA: 'Virginia',
    WA: 'Washington',
    WV: 'West Virginia',
    WI: 'Wisconsin',
    WY: 'Wyoming',

    DC: 'District of Columbia',
    AS: 'American Samoa',
    GU: 'Guam',
    MP: 'Northern Mariana Islands',
    PR: 'Puerto Rico',
    VI: 'U.S. Virgin Islands'
  };

  const collator = new Intl.Collator(
    'en-US',
    {
      sensitivity: 'base',
      numeric: true
    }
  );

  const safeMaxTopics = $derived(
    Number.isFinite(maxTopics)
      ? Math.min(
          TOPIC_COLOR_CLASSES.length,
          Math.max(
            1,
            Math.trunc(maxTopics)
          )
        )
      : 5
  );

  const safeHrefPrefix = $derived(
    normalizeHrefPrefix(hrefPrefix)
  );

  const normalizedRows = $derived.by(() =>
    rows
      .map(normalizeInputRow)
      .filter(
        (
          row
        ): row is NormalizedInputRow =>
          row !== null &&
          (includeUnknownState ||
            row.state !== UNKNOWN_STATE)
      )
  );

  const globalTopics = $derived.by(() => {
    const totals = new Map<
      string,
      TopicTotal
    >();

    for (const row of normalizedRows) {
      const key = row.uncategorized
        ? UNCATEGORIZED_KEY
        : row.topicKey;

      const current = totals.get(key);

      if (current) {
        current.count += row.count;
      } else {
        totals.set(key, {
          key,
          label: row.uncategorized
            ? 'Uncategorized'
            : row.topicLabel,
          count: row.count,
          uncategorized:
            row.uncategorized
        });
      }
    }

    return [...totals.values()];
  });

  const leadingTopics = $derived(
    globalTopics
      .filter(
        (topic) =>
          !topic.uncategorized
      )
      .sort(compareTopicTotals)
      .slice(0, safeMaxTopics)
  );

  const leadingTopicKeys = $derived(
    new Set(
      leadingTopics.map(
        (topic) => topic.key
      )
    )
  );

  const hasOtherTopics = $derived(
    globalTopics.some(
      (topic) =>
        !topic.uncategorized &&
        !leadingTopicKeys.has(topic.key)
    )
  );

  const hasUncategorized = $derived(
    globalTopics.some(
      (topic) =>
        topic.uncategorized
    )
  );

  const categories = $derived.by(
    (): Category[] => {
      const result: Category[] =
        leadingTopics.map(
          (topic, index) => ({
            key: topic.key,
            label: topic.label,
            colorClass:
              TOPIC_COLOR_CLASSES[index],
            kind: 'topic'
          })
        );

      if (hasOtherTopics) {
        result.push({
          key: OTHER_KEY,
          label: 'Other topics',
          colorClass: 'other',
          kind: 'other'
        });
      }

      if (hasUncategorized) {
        result.push({
          key: UNCATEGORIZED_KEY,
          label: 'Uncategorized',
          colorClass: 'uncategorized',
          kind: 'uncategorized'
        });
      }

      return result;
    }
  );

  const categoryLookup = $derived(
    new Map(
      categories.map(
        (category) => [
          category.key,
          category
        ]
      )
    )
  );

  const stateSummaries = $derived.by(
    (): StateSummary[] => {
      const states = new Map<
        string,
        {
          code: string;
          total: number;
          categoryCounts: Map<
            string,
            number
          >;
          topicCounts: Map<
            string,
            StateTopic
          >;
        }
      >();

      for (const row of normalizedRows) {
        let state = states.get(row.state);

        if (!state) {
          state = {
            code: row.state,
            total: 0,
            categoryCounts: new Map(),
            topicCounts: new Map()
          };

          states.set(row.state, state);
        }

        state.total += row.count;

        const categoryKey =
          row.uncategorized
            ? UNCATEGORIZED_KEY
            : leadingTopicKeys.has(
                  row.topicKey
                )
              ? row.topicKey
              : OTHER_KEY;

        state.categoryCounts.set(
          categoryKey,
          (state.categoryCounts.get(
            categoryKey
          ) ?? 0) + row.count
        );

        const topicKey =
          row.uncategorized
            ? UNCATEGORIZED_KEY
            : row.topicKey;

        const existingTopic =
          state.topicCounts.get(topicKey);

        if (existingTopic) {
          existingTopic.count += row.count;
        } else {
          state.topicCounts.set(
            topicKey,
            {
              key: topicKey,
              label: row.uncategorized
                ? 'Uncategorized'
                : row.topicLabel,
              count: row.count,
              uncategorized:
                row.uncategorized
            }
          );
        }
      }

      const summaries = [
        ...states.values()
      ].map((state) => {
        const topics = [
          ...state.topicCounts.values()
        ].sort(compareStateTopics);

        const leadingTopic =
          topics.find(
            (topic) => topic.count > 0
          ) ?? null;

        const leadingShare =
          leadingTopic &&
          state.total > 0
            ? leadingTopic.count /
              state.total
            : 0;

        const segments = categories
          .map((category) => {
            const count =
              state.categoryCounts.get(
                category.key
              ) ?? 0;

            return {
              key: category.key,
              label: category.label,
              count,
              share:
                state.total > 0
                  ? count / state.total
                  : 0,
              colorClass:
                category.colorClass
            };
          })
          .filter(
            (segment) =>
              segment.count > 0
          );

        const name = stateName(
          state.code
        );

        return {
          code: state.code,
          name,
          total: state.total,
          href: stateHref(state.code),
          segments,
          leadingTopic,
          leadingShare,
          accessibleLabel:
            stateAccessibleLabel(
              name,
              state.total,
              topics
            )
        };
      });

      return summaries.sort(
        (left, right) => {
          if (sort === 'total') {
            return (
              right.total -
                left.total ||
              collator.compare(
                left.code,
                right.code
              )
            );
          }

          if (
            left.code === UNKNOWN_STATE
          ) {
            return 1;
          }

          if (
            right.code === UNKNOWN_STATE
          ) {
            return -1;
          }

          return collator.compare(
            left.code,
            right.code
          );
        }
      );
    }
  );

  const grandTotal = $derived(
    stateSummaries.reduce(
      (sum, state) =>
        sum + state.total,
      0
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
      /^(?:nan|na|n\/a|null|none)$/i.test(
        text
      )
    ) {
      return null;
    }

    return text;
  }

  function finiteNonNegativeInteger(
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
      ? Math.max(
          0,
          Math.trunc(number)
        )
      : 0;
  }

  function normalizeState(
    value: unknown
  ): string {
    const state = cleanText(value);

    if (!state) return UNKNOWN_STATE;

    const normalized =
      state.toUpperCase();

    if (
      normalized === 'UNKNOWN' ||
      normalized === 'UNAVAILABLE' ||
      normalized === 'UNCLASSIFIED'
    ) {
      return UNKNOWN_STATE;
    }

    return normalized;
  }

  function isUncategorizedTopic(
    key: string,
    label: string
  ): boolean {
    return (
      key === '999' ||
      /^(?:unknown topic(?:\s*\(999\))?|uncategori[sz]ed|unclassified|topic unknown)$/i.test(
        label.trim()
      )
    );
  }

  function normalizeInputRow(
    row: any
  ): NormalizedInputRow | null {
    if (
      !row ||
      typeof row !== 'object' ||
      Array.isArray(row)
    ) {
      return null;
    }

    const state = normalizeState(
      row.state ??
        row.stateCode ??
        row.state_code
    );

    const topicValue =
      cleanText(
        row.topic ??
          row.topicId ??
          row.topic_id
      );

    const topicLabel =
      cleanText(
        row.topic_label ??
          row.topicLabel ??
          row.label ??
          row.topicName ??
          row.topic_name
      ) ??
      (topicValue
        ? `Topic ${topicValue}`
        : 'Uncategorized');

    const topicKey =
      topicValue ??
      `label:${topicLabel.toLocaleLowerCase()}`;

    const uncategorized =
      isUncategorizedTopic(
        topicKey,
        topicLabel
      );

    return {
      state,
      topicKey,
      topicLabel,
      count:
        finiteNonNegativeInteger(
          row.post_count ??
            row.postCount ??
            row.count ??
            row.value
        ),
      uncategorized
    };
  }

  function compareTopicTotals(
    left: TopicTotal,
    right: TopicTotal
  ): number {
    return (
      right.count -
        left.count ||
      collator.compare(
        left.label,
        right.label
      )
    );
  }

  function compareStateTopics(
    left: StateTopic,
    right: StateTopic
  ): number {
    return (
      right.count -
        left.count ||
      collator.compare(
        left.label,
        right.label
      )
    );
  }

  function normalizeHrefPrefix(
    value: string | null
  ): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const href = value.trim();

    if (!href) return null;

    const compactHref = href.replace(
      /[\u0000-\u0020\u007f]+/g,
      ''
    );

    if (
      /^(?:javascript|data|vbscript):/i.test(
        compactHref
      )
    ) {
      return null;
    }

    return withBase(href);
  }

  function stateHref(
    state: string
  ): string | null {
    if (
      !safeHrefPrefix ||
      state === UNKNOWN_STATE
    ) {
      return null;
    }

    return withBase(`${safeHrefPrefix}${encodeURIComponent(
      state
    )}`);
  }

  function stateName(
    code: string
  ): string {
    if (code === UNKNOWN_STATE) {
      return 'State unknown';
    }

    return (
      cleanText(stateNames[code]) ??
      DEFAULT_STATE_NAMES[code] ??
      code
    );
  }

  function displayValue(
    value: number,
    state: string,
    topic?: string
  ): string {
    if (formatValue) {
      try {
        const formatted =
          formatValue(value, {
            state,
            topic
          });

        if (
          typeof formatted ===
            'string' &&
          formatted.trim()
        ) {
          return formatted;
        }
      } catch {
        // Fall through to the standard formatter.
      }
    }

    return compact(value);
  }

  function exactValue(
    value: number
  ): string {
    return value.toLocaleString(
      'en-US'
    );
  }

  function unitLabel(
    value: number
  ): string {
    return value === 1
      ? valueLabelSingular
      : valueLabel;
  }

  function percentageLabel(
    share: number
  ): string {
    return new Intl.NumberFormat(
      'en-US',
      {
        style: 'percent',
        maximumFractionDigits: 0
      }
    ).format(share);
  }

  function stateAccessibleLabel(
    name: string,
    total: number,
    topics: StateTopic[]
  ): string {
    const leading = topics
      .filter(
        (topic) => topic.count > 0
      )
      .slice(0, 3);

    const base = `${name}: ${exactValue(
      total
    )} ${unitLabel(total)}.`;

    if (!leading.length || total <= 0) {
      return `${base} No populated topic categories.`;
    }

    const mix = leading
      .map(
        (topic) =>
          `${topic.label}, ${percentageLabel(
            topic.count / total
          )}`
      )
      .join('; ');

    return `${base} Leading topics: ${mix}.`;
  }
</script>

<section
  class="state-topic-mix"
  aria-label={ariaLabel}
>
  {#if title || caption || showSummary}
    <header class="section-header">
      <div>
        {#if title}
          <h2>{title}</h2>
        {/if}

        {#if caption}
          <p class="caption">
            {caption}
          </p>
        {/if}
      </div>

      {#if showSummary}
        <p class="summary">
          <span>
            {stateSummaries.length.toLocaleString()}
            {stateSummaries.length === 1
              ? 'state'
              : 'states'}
          </span>

          <span aria-hidden="true">·</span>

          <span>
            {displayValue(
              grandTotal,
              'all'
            )}
            {unitLabel(grandTotal)}
          </span>
        </p>
      {/if}
    </header>
  {/if}

  {#if
    showLegend &&
    stateSummaries.length &&
    categories.length
  }
    <ul
      class="legend"
      aria-label="Topic color legend"
    >
      {#each categories as category (category.key)}
        <li>
          <span
            class={`legend-swatch ${category.colorClass}`}
            aria-hidden="true"
          ></span>

          <span>{category.label}</span>
        </li>
      {/each}
    </ul>
  {/if}

  {#if stateSummaries.length}
    <ul
      class="state-grid"
      aria-label={ariaLabel}
    >
      {#each stateSummaries as state (state.code)}
        <li>
          {#if state.href}
            <a
              class="state-card"
              href={state.href}
              aria-label={state.accessibleLabel}
              title={state.accessibleLabel}
            >
              <div class="state-heading">
                <strong
                  title={state.name}
                >
                  {state.code}
                </strong>

                <data
                  value={String(
                    state.total
                  )}
                >
                  {displayValue(
                    state.total,
                    state.code
                  )}
                </data>
              </div>

              <span
                class:empty={
                  state.total === 0
                }
                class="stack"
                aria-hidden="true"
              >
                {#each state.segments as segment (segment.key)}
                  <span
                    class={`segment ${segment.colorClass}`}
                    style={`--segment-width:${segment.share * 100}%`}
                    title={`${segment.label}: ${exactValue(segment.count)} ${unitLabel(segment.count)}`}
                  ></span>
                {/each}
              </span>

              {#if showLeadingTopic}
                <span class="leading-topic">
                  {#if state.leadingTopic}
                    <span>
                      {state.leadingTopic.label}
                    </span>

                    <span>
                      {percentageLabel(
                        state.leadingShare
                      )}
                    </span>
                  {:else}
                    <span>
                      No populated topics
                    </span>
                  {/if}
                </span>
              {/if}
            </a>
          {:else}
            <div
              class="state-card static"
              aria-label={state.accessibleLabel}
              title={state.accessibleLabel}
            >
              <div class="state-heading">
                <strong
                  title={state.name}
                >
                  {state.code}
                </strong>

                <data
                  value={String(
                    state.total
                  )}
                >
                  {displayValue(
                    state.total,
                    state.code
                  )}
                </data>
              </div>

              <span
                class:empty={
                  state.total === 0
                }
                class="stack"
                aria-hidden="true"
              >
                {#each state.segments as segment (segment.key)}
                  <span
                    class={`segment ${segment.colorClass}`}
                    style={`--segment-width:${segment.share * 100}%`}
                    title={`${segment.label}: ${exactValue(segment.count)} ${unitLabel(segment.count)}`}
                  ></span>
                {/each}
              </span>

              {#if showLeadingTopic}
                <span class="leading-topic">
                  {#if state.leadingTopic}
                    <span>
                      {state.leadingTopic.label}
                    </span>

                    <span>
                      {percentageLabel(
                        state.leadingShare
                      )}
                    </span>
                  {:else}
                    <span>
                      No populated topics
                    </span>
                  {/if}
                </span>
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty-state" role="status">
      {emptyMessage}
    </p>
  {/if}
</section>

<style>
  .state-topic-mix {
    min-width: 0;
    color: var(--color-ink, #1a1917);
  }

  .section-header {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .section-header > div {
    min-width: 0;
  }

  h2 {
    margin: 0;
    font-size: clamp(
      1.15rem,
      1.06rem + 0.28vw,
      1.4rem
    );
    line-height: 1.25;
    letter-spacing: -0.01em;
  }

  .caption {
    max-width: 72ch;
    margin: 4px 0 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.875rem;
    line-height: 1.4rem;
  }

  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 7px;
    align-items: center;
    margin: 2px 0 0;
    color: var(
      --color-mute-soft,
      #9c9787
    );
    font-family: var(
      --font-data,
      var(
        --type-mono,
        'JetBrains Mono',
        ui-monospace,
        monospace
      )
    );
    font-size: 0.72rem;
    line-height: 1.1rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 7px 16px;
    align-items: center;
    padding: 0 0 12px;
    margin: 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.72rem;
    line-height: 1rem;
    list-style: none;
  }

  .legend li {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    min-width: 0;
  }

  .legend li > span:last-child {
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .legend-swatch {
    width: 8px;
    height: 8px;
    border: 1px solid
      transparent;
    border-radius: 2px;
    flex: 0 0 auto;
  }

  .state-grid {
    display: grid;
    grid-template-columns:
      repeat(
        auto-fit,
        minmax(min(100%, 124px), 1fr)
      );
    gap: 8px;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .state-grid li {
    min-width: 0;
    list-style: none;
  }

  .state-grid li::marker {
    content: '';
  }

  .state-card {
    display: grid;
    grid-template-rows:
      auto auto minmax(1rem, auto);
    gap: 8px;
    min-width: 0;
    min-height: 86px;
    padding: 9px;
    color: var(--color-ink, #1a1917);
    text-decoration: none;
    background: var(--color-card, #fff);
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
    content-visibility: auto;
    contain-intrinsic-block-size: 86px;
    transition:
      color 120ms ease,
      background-color 120ms ease,
      border-color 120ms ease,
      box-shadow 120ms ease;
  }

  a.state-card:hover {
    color: var(--color-seal, #8a5a1a);
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 4%,
      var(--color-card, #fff)
    );
    border-color: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 58%,
      var(--color-rule, #d9d2c1)
    );
    box-shadow: 0 3px 12px
      rgb(26 25 23 / 5%);
  }

  a.state-card:focus-visible {
    color: var(--color-seal, #8a5a1a);
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .state-card.static {
    cursor: default;
  }

  .state-heading {
    display: flex;
    gap: 7px;
    align-items: baseline;
    justify-content: space-between;
    min-width: 0;
    flex-wrap: wrap;
  }

  .state-heading strong {
    min-width: max-content;
    font-family: var(
      --font-data,
      var(
        --type-mono,
        'JetBrains Mono',
        ui-monospace,
        monospace
      )
    );
    font-size: 0.8rem;
    font-weight: 700;
    line-height: 1rem;
    letter-spacing: 0.025em;
    white-space: nowrap;
  }

  .state-heading data {
    min-width: max-content;
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
    font-size: 0.66rem;
    line-height: 1rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .stack {
    display: flex;
    width: 100%;
    height: 10px;
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
      color-mix(
        in srgb,
        var(--color-rule, #d9d2c1) 72%,
        transparent
      );
    border-radius: 2px;
  }

  .stack.empty {
    opacity: 0.58;
  }

  .segment {
    width: var(--segment-width);
    min-width: 0;
    height: 100%;
    transition: width 220ms ease-out;
  }

  .segment:last-child {
    border-right: 0;
  }

  .tone-0 {
    background: var(--color-seal, #8a5a1a);
  }

  .tone-1 {
    background: var(--color-signal, #3a6c4c);
  }

  .tone-2 {
    background: var(
      --color-ballot-blue,
      #274b6e
    );
  }

  .tone-3 {
    background: var(
      --color-ballot-red,
      #a13530
    );
  }

  .tone-4 {
    background: var(
      --color-independent,
      #7a6a4a
    );
  }

  .tone-5 {
    background: var(--color-warn, #a86a1f);
  }

  .other {
    background: var(--color-mute, #6b6659);
  }

  .uncategorized {
    background: var(
      --color-mute-soft,
      #9c9787
    );
  }

  .leading-topic {
    display: flex;
    gap: 5px;
    align-items: baseline;
    justify-content: space-between;
    min-width: 0;
    flex-wrap: wrap;
    color: var(--color-mute, #6b6659);
    font-size: 0.66rem;
    line-height: 0.95rem;
  }

  .leading-topic > span:first-child {
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .leading-topic > span:last-child {
    font-family: var(
      --font-data,
      var(
        --type-mono,
        'JetBrains Mono',
        ui-monospace,
        monospace
      )
    );
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .empty-state {
    min-height: 90px;
    padding: 22px;
    margin: 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.84rem;
    line-height: 1.35rem;
    text-align: center;
    background: var(--color-card, #fff);
    border: 1px dashed
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  @media (max-width: 720px) {
    .section-header {
      display: grid;
      gap: 7px;
    }

    .summary {
      white-space: normal;
    }

    .state-grid {
      grid-template-columns:
        repeat(
          auto-fit,
          minmax(min(100%, 112px), 1fr)
        );
      gap: 7px;
    }

    .state-card {
      min-height: 82px;
      padding: 8px;
    }
  }

  @media (max-width: 420px) {
    .legend {
      display: grid;
      grid-template-columns:
        repeat(
          2,
          minmax(0, 1fr)
        );
      gap: 7px 10px;
    }

    .state-grid {
      grid-template-columns:
        repeat(
          2,
          minmax(0, 1fr)
        );
    }

    .state-heading {
      align-items: flex-start;
      flex-direction: column;
      gap: 1px;
    }

    .state-heading data {
      font-size: 0.64rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .state-card,
    .segment {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .state-card,
    .stack,
    .empty-state {
      color: CanvasText;
      background: Canvas;
      border-color: CanvasText;
    }

    .segment,
    .legend-swatch {
      background: Highlight;
      border-color: Canvas;
    }

    a.state-card:focus-visible {
      outline-color: Highlight;
    }
  }

  @media print {
    .state-card {
      color: #000;
      background: transparent;
      border-color: #999;
      box-shadow: none;
      content-visibility: visible;
      contain-intrinsic-size: auto;
      break-inside: avoid;
    }

    .segment,
    .legend-swatch {
      print-color-adjust: exact;
    }
  }
</style>
