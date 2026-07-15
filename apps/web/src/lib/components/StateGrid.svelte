<script lang="ts">
  import { compact } from '$lib/format';
  import { withBase } from '$lib/paths';

  type SortMode =
    | 'state'
    | 'count';

  type ScaleMode =
    | 'linear'
    | 'sqrt';

  interface Props {
    states?: any[];

    title?: string;
    caption?: string;
    ariaLabel?: string;

    hrefPrefix?: string | null;

    sort?: SortMode;

    /**
     * Linear is analytically direct. Square-root
     * can make lower-volume states easier to compare.
     */
    scale?: ScaleMode;

    /**
     * Supply a common maximum when several state
     * grids must use the same visual scale.
     */
    maxValue?: number | null;

    showLegend?: boolean;
    showSummary?: boolean;
    showStateName?: boolean;
    includeUnknownState?: boolean;
    maxBlockSize?: string | null;

    valueLabel?: string;
    valueLabelSingular?: string;
    emptyMessage?: string;

    stateNames?: Record<string, string>;

    formatValue?: (
      value: number,
      state: {
        code: string;
        name: string;
        raw: any[];
      }
    ) => string;
  }

  interface InputState {
    code: string;
    explicitName: string | null;
    count: number;
    sourceIndex: number;
    raw: any;
  }

  interface StateSummary {
    code: string;
    name: string;
    count: number;
    sourceIndex: number;
    href: string | null;
    raw: any[];
  }

  let {
    states = [],
    title = '',
    caption = '',
    ariaLabel = 'Post activity by state',
    hrefPrefix = '/place/',
    sort = 'count',
    scale = 'linear',
    maxValue = null,
    showLegend = true,
    showSummary = false,
    showStateName = true,
    includeUnknownState = true,
    maxBlockSize = null,
    valueLabel = 'posts',
    valueLabelSingular = 'post',
    emptyMessage = 'No state activity data is available.',
    stateNames = {},
    formatValue
  }: Props = $props();

  const UNKNOWN_STATE = '??';

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

  const safeHrefPrefix = $derived(
    normalizeHrefPrefix(hrefPrefix)
  );

  const effectiveScale = $derived(
    scale === 'sqrt'
      ? 'sqrt'
      : 'linear'
  );

  let selectedSort = $state<SortMode>('count');

  $effect(() => {
    selectedSort = sort === 'state' ? 'state' : 'count';
  });

  const normalizedInput = $derived.by(() =>
    states
      .map((state, index) =>
        normalizeInputState(
          state,
          index
        )
      )
      .filter(
        (
          state
        ): state is InputState =>
          state !== null &&
          (includeUnknownState ||
            state.code !== UNKNOWN_STATE)
      )
  );

  const aggregatedStates = $derived.by(
    (): StateSummary[] => {
      const lookup = new Map<
        string,
        {
          code: string;
          explicitName: string | null;
          count: number;
          sourceIndex: number;
          raw: any[];
        }
      >();

      for (const state of normalizedInput) {
        const existing = lookup.get(
          state.code
        );

        if (existing) {
          existing.count += state.count;
          existing.raw.push(state.raw);

          if (
            !existing.explicitName &&
            state.explicitName
          ) {
            existing.explicitName =
              state.explicitName;
          }

          continue;
        }

        lookup.set(state.code, {
          code: state.code,
          explicitName:
            state.explicitName,
          count: state.count,
          sourceIndex:
            state.sourceIndex,
          raw: [state.raw]
        });
      }

      const result = [...lookup.values()].map(
        (state): StateSummary => {
          const name =
            state.explicitName ??
            resolveStateName(state.code);

          return {
            code: state.code,
            name,
            count: state.count,
            sourceIndex:
              state.sourceIndex,
            href: stateHref(state.code),
            raw: state.raw
          };
        }
      );

      return result.sort(compareStates);
    }
  );

  const observedMaximum = $derived(
    aggregatedStates.reduce(
      (maximum, state) =>
        Math.max(
          maximum,
          state.count
        ),
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

  const grandTotal = $derived(
    aggregatedStates.reduce(
      (sum, state) =>
        sum + state.count,
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
      ? Math.max(
          0,
          Math.trunc(number)
        )
      : 0;
  }

  function normalizeStateCode(
    value: unknown
  ): string {
    const state = cleanText(value);

    if (!state) {
      return UNKNOWN_STATE;
    }

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

  function normalizeInputState(
    value: any,
    sourceIndex: number
  ): InputState | null {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      return null;
    }

    return {
      code: normalizeStateCode(
        value.state ??
          value.stateCode ??
          value.state_code ??
          value.code ??
          value.abbreviation
      ),

      explicitName:
        cleanText(
          value.stateName ??
            value.state_name ??
            value.name
        ),

      count: finiteNonNegative(
        value.postCount ??
          value.post_count ??
          value.count ??
          value.value
      ),

      sourceIndex,
      raw: value
    };
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

  function resolveStateName(
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

  function compareStates(
    left: StateSummary,
    right: StateSummary
  ): number {
    if (selectedSort === 'count') {
      return (
        right.count -
          left.count ||
        compareStateCodes(
          left.code,
          right.code
        )
      );
    }

    return (
      compareStateCodes(
        left.code,
        right.code
      ) ||
      left.sourceIndex -
        right.sourceIndex
    );
  }

  function compareStateCodes(
    left: string,
    right: string
  ): number {
    if (left === UNKNOWN_STATE) {
      return right === UNKNOWN_STATE
        ? 0
        : 1;
    }

    if (right === UNKNOWN_STATE) {
      return -1;
    }

    return collator.compare(
      left,
      right
    );
  }

  function scaleRatio(
    value: number
  ): number {
    if (
      value <= 0 ||
      scaleMaximum <= 0
    ) {
      return 0;
    }

    const ratio = Math.min(
      1,
      value / scaleMaximum
    );

    return effectiveScale === 'sqrt'
      ? Math.sqrt(ratio)
      : ratio;
  }

  function tintPercentage(
    value: number
  ): number {
    return Number(
      (
        scaleRatio(value) * 38
      ).toFixed(2)
    );
  }

  function displayValue(
    state: StateSummary
  ): string {
    if (formatValue) {
      try {
        const formatted =
          formatValue(
            state.count,
            {
              code: state.code,
              name: state.name,
              raw: state.raw
            }
          );

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

    return compact(state.count);
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
    value: number
  ): string {
    return new Intl.NumberFormat(
      'en-US',
      {
        style: 'percent',
        maximumFractionDigits: 0
      }
    ).format(scaleRatio(value));
  }

  function stateAccessibleLabel(
    state: StateSummary
  ): string {
    return `${state.name}: ${exactValue(
      state.count
    )} ${unitLabel(
      state.count
    )}. ${percentageLabel(
      state.count
    )} of the displayed scale maximum.`;
  }

  const stateGridStyle = $derived(
    maxBlockSize ? `--state-grid-max-block:${maxBlockSize}` : ''
  );
</script>

<section
  class="state-volume"
  aria-label={ariaLabel}
>
  {#if title || caption || showSummary}
    <header class="section-header">
      <div class="heading-copy">
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
            {aggregatedStates.length.toLocaleString()}
            {aggregatedStates.length === 1
              ? 'state'
              : 'states'}
          </span>

          <span aria-hidden="true">
            ·
          </span>

          <span>
            {compact(grandTotal)}
            {unitLabel(grandTotal)}
          </span>
        </p>
      {/if}
    </header>
  {/if}

  {#if aggregatedStates.length}
    <div
      class="sort-toggle"
      aria-label="Sort states"
    >
      <span>Sort</span>

      <button
        type="button"
        class:active={selectedSort === 'count'}
        aria-pressed={selectedSort === 'count'}
        onclick={() => (selectedSort = 'count')}
      >
        Frequency
      </button>

      <button
        type="button"
        class:active={selectedSort === 'state'}
        aria-pressed={selectedSort === 'state'}
        onclick={() => (selectedSort = 'state')}
      >
        A-Z
      </button>
    </div>
  {/if}

  {#if
    showLegend &&
    aggregatedStates.length
  }
    <div
      class="scale-legend"
      aria-label={`State intensity uses a ${effectiveScale} scale from zero to ${exactValue(
        scaleMaximum
      )} ${unitLabel(scaleMaximum)}.`}
    >
      <div
        class="legend-steps"
        aria-hidden="true"
      >
        <span class="legend-swatch low"></span>
        <span class="legend-swatch medium"></span>
        <span class="legend-swatch high"></span>
      </div>

      <p>
        Darker tint and a longer bar indicate
        more {valueLabel}. Scale maximum:
        <strong>
          {compact(scaleMaximum)}
        </strong>.
      </p>
    </div>
  {/if}

  {#if aggregatedStates.length}
    <div
      class:scrollable={Boolean(maxBlockSize)}
      class="states-grid-frame"
      style={stateGridStyle}
    >
      <ul
        class="states-grid"
        aria-label={ariaLabel}
      >
        {#each aggregatedStates as state (state.code)}
          {@const ratio =
            scaleRatio(state.count)}

          {@const cardStyle =
            `--state-tint:${tintPercentage(
              state.count
            )}%;--state-scale:${ratio}`}

          <li>
            {#if state.href}
              <a
                class:zero={
                  state.count === 0
                }
                class="state-card"
                href={state.href}
                style={cardStyle}
                aria-label={stateAccessibleLabel(
                  state
                )}
                title={`${state.name}: ${exactValue(
                  state.count
                )} ${unitLabel(
                  state.count
                )}`}
              >
                <div class="state-heading">
                  <strong>{state.code}</strong>

                  <data
                    value={String(
                      state.count
                    )}
                  >
                    {displayValue(state)}
                  </data>
                </div>

                {#if showStateName}
                  <span
                    class="state-name"
                    title={state.name}
                  >
                    {state.name}
                  </span>
                {/if}

                <span
                  class="meter"
                  aria-hidden="true"
                >
                  <span></span>
                </span>
              </a>
            {:else}
              <div
                class:zero={
                  state.count === 0
                }
                class="state-card static"
                style={cardStyle}
                role="group"
                aria-label={stateAccessibleLabel(
                  state
                )}
                title={`${state.name}: ${exactValue(
                  state.count
                )} ${unitLabel(
                  state.count
                )}`}
              >
                <div class="state-heading">
                  <strong>{state.code}</strong>

                  <data
                    value={String(
                      state.count
                    )}
                  >
                    {displayValue(state)}
                  </data>
                </div>

                {#if showStateName}
                  <span
                    class="state-name"
                    title={state.name}
                  >
                    {state.name}
                  </span>
                {/if}

                <span
                  class="meter"
                  aria-hidden="true"
                >
                  <span></span>
                </span>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {:else}
    <p
      class="empty-state"
      role="status"
    >
      {emptyMessage}
    </p>
  {/if}
</section>

<style>
  .state-volume {
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

  .heading-copy {
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

  .sort-toggle {
    display: inline-flex;
    gap: 3px;
    align-items: center;
    width: fit-content;
    max-width: 100%;
    padding: 3px;
    margin-bottom: 11px;
    color: var(--color-mute, #6b6659);
    background: color-mix(
      in srgb,
      var(--color-elevated, var(--color-card, #fff)) 86%,
      transparent
    );
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 999px;
  }

  .sort-toggle span {
    padding-inline: 8px 5px;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    line-height: 1rem;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .sort-toggle button {
    min-height: 28px;
    padding: 4px 9px;
    color: var(--color-mute, #6b6659);
    font-size: 0.74rem;
    font-weight: 650;
    line-height: 1rem;
    background: transparent;
    border: 0;
    border-radius: 999px;
    box-shadow: none;
  }

  .sort-toggle button:hover {
    color: var(--color-seal, #8a5a1a);
    background: var(--color-hover, rgb(0 0 0 / 5%));
    box-shadow: none;
    transform: none;
  }

  .sort-toggle button.active {
    color: var(--color-ink, #1a1917);
    background: var(--color-card, #fff);
    box-shadow: var(--shadow-sm, 0 1px 2px rgb(0 0 0 / 8%));
  }

  .scale-legend {
    display: flex;
    gap: 9px;
    align-items: center;
    margin-bottom: 11px;
    color: var(--color-mute, #6b6659);
  }

  .scale-legend p {
    margin: 0;
    font-size: 0.72rem;
    line-height: 1.1rem;
  }

  .scale-legend strong {
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
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .legend-steps {
    display: inline-flex;
    gap: 2px;
    flex: 0 0 auto;
  }

  .legend-swatch {
    display: block;
    width: 13px;
    height: 10px;
    background: var(--color-card, #fff);
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 1px;
  }

  .legend-swatch.low {
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 10%,
      var(--color-card, #fff)
    );
  }

  .legend-swatch.medium {
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 24%,
      var(--color-card, #fff)
    );
  }

  .legend-swatch.high {
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 38%,
      var(--color-card, #fff)
    );
  }

  .states-grid-frame {
    min-width: 0;
    max-block-size: var(--state-grid-max-block, none);
  }

  .states-grid-frame.scrollable {
    overflow: auto;
    padding: 2px 4px 2px 2px;
    scrollbar-width: thin;
    overscroll-behavior: contain;
  }

  .states-grid {
    display: grid;
    grid-template-columns:
      repeat(auto-fill, minmax(min(100%, 118px), 132px));
    justify-content: start;
    gap: 8px;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .states-grid li {
    min-width: 0;
    list-style: none;
  }

  .states-grid li::marker {
    content: '';
  }

  .state-card {
    display: grid;
    grid-template-rows:
      auto minmax(1rem, auto) auto;
    gap: 7px;
    min-width: 0;
    min-height: 78px;
    padding: 9px;
    color: var(--color-ink, #1a1917);
    text-decoration: none;
    background: var(--color-card, #fff);
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a)
        var(--state-tint),
      var(--color-card, #fff)
    );
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
    content-visibility: auto;
    contain-intrinsic-block-size: 82px;
    transition:
      color 120ms ease,
      background-color 120ms ease,
      border-color 120ms ease,
      box-shadow 120ms ease;
  }

  a.state-card:hover {
    color: var(--color-seal, #8a5a1a);
    border-color: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 62%,
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

  .state-card.zero {
    background: var(--color-card, #fff);
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
    font-size: 0.82rem;
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
    font-size: 0.68rem;
    line-height: 1rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .state-name {
    min-width: 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.68rem;
    line-height: 0.95rem;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .meter {
    position: relative;
    display: block;
    width: 100%;
    height: 5px;
    overflow: hidden;
    background: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 52%,
      var(--color-card, #fff)
    );
    border-radius: 1px;
  }

  .meter > span {
    position: absolute;
    inset: 0;
    background: var(--color-seal, #8a5a1a);
    transform: scaleX(
      var(--state-scale)
    );
    transform-origin: left center;
    transition: transform 220ms ease-out;
  }

  .state-card.zero .meter > span {
    transform: scaleX(0);
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

    .states-grid {
      grid-template-columns:
        repeat(auto-fill, minmax(min(100%, 112px), 1fr));
      gap: 7px;
    }

    .state-card {
      min-height: 74px;
      padding: 8px;
    }
  }

  @media (max-width: 420px) {
    .scale-legend {
      align-items: flex-start;
    }

    .states-grid {
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

    .state-name {
      font-size: 0.65rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .state-card,
    .meter > span {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .state-card,
    .meter,
    .legend-swatch,
    .empty-state {
      color: CanvasText;
      background: Canvas;
      border-color: CanvasText;
    }

    .meter > span {
      background: Highlight;
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
      break-inside: avoid;
    }

    .meter > span,
    .legend-swatch {
      print-color-adjust: exact;
    }
  }
</style>
