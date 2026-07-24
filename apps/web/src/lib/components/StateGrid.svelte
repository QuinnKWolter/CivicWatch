<script lang="ts">
  import { compact } from '$lib/format';
  import { appendDrilldownContext, type DrilldownContext } from '$lib/drilldown';
  import { withBase } from '$lib/paths';

  type SortMode =
    | 'state'
    | 'count';

  type ScaleMode =
    | 'linear'
    | 'sqrt';

  type PartyMode = 'both' | 'democratic' | 'republican';
  type ColorMode = 'volume' | 'contribution';

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
    normalizeByPopulation?: boolean;
    normalizeByLegislators?: boolean;
    party?: PartyMode;
    colorMode?: ColorMode;
    drilldownContext?: DrilldownContext;

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
    legislatorCount: number;
    democraticPostCount: number;
    republicanPostCount: number;
    democraticLegislatorCount: number;
    republicanLegislatorCount: number;
    sourceIndex: number;
    raw: any;
  }

  interface StateSummary {
    code: string;
    name: string;
    count: number;
    legislatorCount: number;
    democraticPostCount: number;
    republicanPostCount: number;
    democraticLegislatorCount: number;
    republicanLegislatorCount: number;
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
    normalizeByPopulation = false,
    normalizeByLegislators = false,
    party = 'both',
    colorMode = 'volume',
    drilldownContext = {},
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
          legislatorCount: number;
          democraticPostCount: number;
          republicanPostCount: number;
          democraticLegislatorCount: number;
          republicanLegislatorCount: number;
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
          existing.legislatorCount = Math.max(existing.legislatorCount, state.legislatorCount);
          existing.democraticPostCount += state.democraticPostCount;
          existing.republicanPostCount += state.republicanPostCount;
          existing.democraticLegislatorCount = Math.max(existing.democraticLegislatorCount, state.democraticLegislatorCount);
          existing.republicanLegislatorCount = Math.max(existing.republicanLegislatorCount, state.republicanLegislatorCount);
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
          legislatorCount: state.legislatorCount,
          democraticPostCount: state.democraticPostCount,
          republicanPostCount: state.republicanPostCount,
          democraticLegislatorCount: state.democraticLegislatorCount,
          republicanLegislatorCount: state.republicanLegislatorCount,
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
            legislatorCount: state.legislatorCount,
            democraticPostCount: state.democraticPostCount,
            republicanPostCount: state.republicanPostCount,
            democraticLegislatorCount: state.democraticLegislatorCount,
            republicanLegislatorCount: state.republicanLegislatorCount,
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
          visualValue(state)
        ),
      0
    )
  );

  const democraticMaximum = $derived(
    Math.max(0, ...aggregatedStates.map((state) => partyMeasure(state, 'democratic')))
  );
  const democraticMinimum = $derived(
    Math.min(...aggregatedStates.map((state) => partyMeasure(state, 'democratic')))
  );
  const republicanMaximum = $derived(
    Math.max(0, ...aggregatedStates.map((state) => partyMeasure(state, 'republican')))
  );
  const republicanMinimum = $derived(
    Math.min(...aggregatedStates.map((state) => partyMeasure(state, 'republican')))
  );

  const scaleMaximum = $derived(
    Math.max(
      1,
      observedMaximum,
      normalizeByPopulation
        ? 0
        : finiteNonNegative(maxValue)
    )
  );

  const grandTotal = $derived(
    aggregatedStates.reduce(
      (sum, state) =>
        sum + filteredCount(state),
      0
    )
  );

  // U.S. Census Bureau Vintage 2025 resident population estimates, July 1, 2025.
  const STATE_POPULATION_2025: Record<string, number> = {
    AL: 5193088, AK: 737270, AZ: 7623818, AR: 3114791, CA: 39355309,
    CO: 6012561, CT: 3688496, DE: 1059952, DC: 693645, FL: 23462518,
    GA: 11302748, HI: 1432820, ID: 2029733, IL: 12719141, IN: 6973333,
    IA: 3238387, KS: 2977220, KY: 4606864, LA: 4618189, ME: 1414874,
    MD: 6265347, MA: 7154084, MI: 10127884, MN: 5830405, MS: 2954160,
    MO: 6270541, MT: 1144694, NE: 2018006, NV: 3282188, NH: 1415342,
    NJ: 9548215, NM: 2125498, NY: 20002427, NC: 11197968, ND: 799358,
    OH: 11900510, OK: 4123288, OR: 4273586, PA: 13059432, RI: 1114521,
    SC: 5570274, SD: 935094, TN: 7315076, TX: 31709821, UT: 3538904,
    VT: 644663, VA: 8880107, WA: 8001020, WV: 1766147, WI: 5972787,
    WY: 588753
  };

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

      legislatorCount: finiteNonNegative(
        value.legislatorCount ??
          value.legislator_count ??
          value.legislators
      ),

      democraticPostCount: finiteNonNegative(
        value.democraticPostCount ?? value.democratic_post_count
      ),
      republicanPostCount: finiteNonNegative(
        value.republicanPostCount ?? value.republican_post_count
      ),
      democraticLegislatorCount: finiteNonNegative(
        value.democraticLegislatorCount ?? value.democratic_legislator_count
      ),
      republicanLegislatorCount: finiteNonNegative(
        value.republicanLegislatorCount ?? value.republican_legislator_count
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

    return withBase(appendDrilldownContext(`${safeHrefPrefix}${encodeURIComponent(
      state
    )}`, drilldownContext));
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
        visualValue(right) -
          visualValue(left) ||
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

  function normalizedValue(state: StateSummary): number | null {
    const count = filteredCount(state);
    if (normalizeByLegislators) {
      const legislators = filteredLegislatorCount(state);
      return legislators > 0
        ? count / legislators
        : null;
    }
    const population = STATE_POPULATION_2025[state.code];
    return population ? (count / population) * 100_000 : null;
  }

  function visualValue(state: StateSummary): number {
    return normalizeByPopulation || normalizeByLegislators
      ? (normalizedValue(state) ?? 0)
      : filteredCount(state);
  }

  function filteredCount(state: StateSummary): number {
    if (party === 'democratic') return state.democraticPostCount;
    if (party === 'republican') return state.republicanPostCount;
    return state.count;
  }

  function filteredLegislatorCount(state: StateSummary): number {
    if (party === 'democratic') return state.democraticLegislatorCount;
    if (party === 'republican') return state.republicanLegislatorCount;
    return state.legislatorCount;
  }

  function contributionScores(state: StateSummary): { democratic: number; republican: number } {
    return {
      democratic: minMaxScore(partyMeasure(state, 'democratic'), democraticMinimum, democraticMaximum),
      republican: minMaxScore(partyMeasure(state, 'republican'), republicanMinimum, republicanMaximum)
    };
  }

  function partyMeasure(state: StateSummary, selectedParty: 'democratic' | 'republican'): number {
    const count = selectedParty === 'democratic' ? state.democraticPostCount : state.republicanPostCount;
    if (normalizeByPopulation) {
      const population = STATE_POPULATION_2025[state.code];
      return population ? (count / population) * 100_000 : 0;
    }
    if (normalizeByLegislators) {
      const legislators = selectedParty === 'democratic'
        ? state.democraticLegislatorCount
        : state.republicanLegislatorCount;
      return legislators > 0 ? count / legislators : 0;
    }
    return count;
  }

  function minMaxScore(value: number, minimum: number, maximum: number): number {
    return maximum > minimum ? (value - minimum) / (maximum - minimum) : value > 0 ? 1 : 0;
  }

  function contributionColor(state: StateSummary): string {
    const scores = contributionScores(state);
    const d = party === 'republican' ? 0 : scores.democratic;
    const r = party === 'democratic' ? 0 : scores.republican;
    const total = d + r;
    if (total <= 0) {
      return party === 'democratic' ? '#356fa3' : party === 'republican' ? '#b54842' : '#70558b';
    }
    const democraticShare = d / total;
    const red = [181, 72, 66];
    const purple = [112, 85, 139];
    const blue = [53, 111, 163];
    const from = democraticShare <= 0.5 ? red : purple;
    const to = democraticShare <= 0.5 ? purple : blue;
    const t = democraticShare <= 0.5 ? democraticShare * 2 : (democraticShare - 0.5) * 2;
    return `rgb(${from.map((channel, index) => Math.round(channel + (to[index] - channel) * t)).join(' ')})`;
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

  function scaleRatio(state: StateSummary): number {
    const value = visualValue(state);
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
    state: StateSummary
  ): number {
    return Number(
      (
        scaleRatio(state) * 38
      ).toFixed(2)
    );
  }

  function displayValue(
    state: StateSummary
  ): string {
    if (normalizeByPopulation || normalizeByLegislators) {
      const normalized = normalizedValue(state);
      return normalized === null
        ? '—'
        : `${normalized.toLocaleString('en-US', {
            maximumFractionDigits: 1
          })}${normalizeByLegislators ? ' / legislator' : ' / 100k'}`;
    }

    if (formatValue) {
      try {
        const formatted =
          formatValue(
            filteredCount(state),
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

    return compact(filteredCount(state));
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
    state: StateSummary
  ): string {
    return new Intl.NumberFormat(
      'en-US',
      {
        style: 'percent',
        maximumFractionDigits: 0
      }
    ).format(scaleRatio(state));
  }

  function stateAccessibleLabel(
    state: StateSummary
  ): string {
    const normalized = normalizedValue(state);
    const normalizedLabel = (normalizeByPopulation || normalizeByLegislators) && normalized !== null
      ? ` ${normalized.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${normalizationUnit()}.`
      : '';
    return `${state.name}: ${exactValue(
      filteredCount(state)
    )} ${partyCountLabel(filteredCount(state))}.${normalizedLabel} ${percentageLabel(
      state
    )} of the displayed scale maximum.`;
  }

  function stateTitle(state: StateSummary): string {
    const count = filteredCount(state);
    const raw = `${state.name}: ${exactValue(count)} ${partyCountLabel(count)}`;
    const normalized = normalizedValue(state);
    const partyDetail = colorMode === 'contribution'
      ? ` · Democratic ${exactValue(state.democraticPostCount)} · Republican ${exactValue(state.republicanPostCount)}`
      : '';
    if ((!normalizeByPopulation && !normalizeByLegislators) || normalized === null) return `${raw}${partyDetail}`;
    const denominator = normalizeByLegislators
      ? `${filteredLegislatorCount(state).toLocaleString('en-US')} represented legislators`
      : `${STATE_POPULATION_2025[state.code]?.toLocaleString('en-US')} residents`;
    return `${raw} · ${normalized.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${normalizationUnit()} · ${denominator}${partyDetail}`;
  }

  function scaleMaximumLabel(): string {
    return normalizeByPopulation || normalizeByLegislators
      ? scaleMaximum.toLocaleString('en-US', { maximumFractionDigits: 1 })
      : compact(scaleMaximum);
  }

  function normalizationUnit(): string {
    return normalizeByLegislators
      ? 'posts per represented legislator'
      : 'posts per 100,000 residents';
  }

  function partyCountLabel(value: number): string {
    if (party === 'democratic') return value === 1 ? 'Democratic post' : 'Democratic posts';
    if (party === 'republican') return value === 1 ? 'Republican post' : 'Republican posts';
    return unitLabel(value);
  }

  function stateColor(state: StateSummary): string {
    return colorMode === 'contribution'
      ? contributionColor(state)
      : 'var(--color-seal, #8a5a1a)';
  }

  function stateTint(state: StateSummary): number {
    if (colorMode !== 'contribution') return tintPercentage(state);
    const scores = contributionScores(state);
    const strength = party === 'democratic'
      ? scores.democratic
      : party === 'republican'
        ? scores.republican
        : Math.max(scores.democratic, scores.republican);
    return Number((12 + strength * 54).toFixed(2));
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
    <div class="state-controls">
      <fieldset
        class="sort-toggle"
        aria-label="Sort states"
      >
        <legend>Sort</legend>

        <div class="sort-options">

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
      </fieldset>

    </div>
  {/if}

  {#if
    showLegend &&
    aggregatedStates.length
  }
    <div
      class="scale-legend"
      class:contribution={colorMode === 'contribution'}
      aria-label={colorMode === 'contribution'
        ? 'State hue compares Democratic and Republican contributions after scaling each party independently. Bar length shows the selected volume measure.'
        : `State intensity uses a ${effectiveScale} scale from zero to ${scaleMaximumLabel()} ${
            normalizeByPopulation || normalizeByLegislators ? normalizationUnit() : unitLabel(scaleMaximum)
          }.`}
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
        {#if colorMode === 'contribution'}
          Hue compares each party's independently scaled state contribution
          (blue Democratic, red Republican, purple equal). Bar length shows
          {normalizeByPopulation || normalizeByLegislators ? normalizationUnit() : valueLabel}.
        {:else}
          Darker tint and a longer bar indicate
          {normalizeByPopulation || normalizeByLegislators ? normalizationUnit() : `more ${valueLabel}`}. Scale maximum:
          <strong>{scaleMaximumLabel()}</strong>.
        {/if}
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
            scaleRatio(state)}

          {@const cardStyle =
            `--state-color:${stateColor(state)};--state-tint:${stateTint(state)}%;--state-scale:${ratio}`}

          <li>
            {#if state.href}
              <a
                class:zero={
                  filteredCount(state) === 0
                }
                class="state-card"
                href={state.href}
                style={cardStyle}
                aria-label={stateAccessibleLabel(
                  state
                )}
                title={stateTitle(state)}
              >
                <div class="state-heading">
                  <strong>{state.code}</strong>

                  <data
                    value={String(
                      filteredCount(state)
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
                  filteredCount(state) === 0
                }
                class="state-card static"
                style={cardStyle}
                role="group"
                aria-label={stateAccessibleLabel(
                  state
                )}
                title={stateTitle(state)}
              >
                <div class="state-heading">
                  <strong>{state.code}</strong>

                  <data
                    value={String(
                      filteredCount(state)
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
    display: grid;
    grid-template-columns: auto auto;
    gap: 4px;
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

  .state-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    margin-bottom: 11px;
  }

  .state-controls .sort-toggle {
    margin-bottom: 0;
  }

  .sort-toggle legend {
    float: left;
    display: grid;
    height: 28px;
    padding: 0 6px 0 7px;
    margin: 0;
    place-items: center;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    line-height: 1rem;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .sort-options {
    display: grid;
    grid-template-columns: auto auto;
    gap: 3px;
    align-items: stretch;
  }

  .sort-toggle button {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    min-height: 28px;
    padding: 0 9px;
    color: var(--color-mute, #6b6659);
    font-size: 0.74rem;
    font-weight: 650;
    line-height: 1;
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

  .scale-legend.contribution .legend-swatch.low { background: #b54842; }
  .scale-legend.contribution .legend-swatch.medium { background: #70558b; }
  .scale-legend.contribution .legend-swatch.high { background: #356fa3; }

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
      var(--state-color, var(--color-seal, #8a5a1a))
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
    background: var(--state-color, var(--color-seal, #8a5a1a));
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
