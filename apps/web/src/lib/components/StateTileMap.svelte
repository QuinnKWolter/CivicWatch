<script lang="ts">
  import { compact as compactNumber } from '$lib/format';
  import { appendDrilldownContext, type DrilldownContext } from '$lib/drilldown';
  import { withBase } from '$lib/paths';

  interface Props {
    states?: any[];
    hrefPrefix?: string;
    ariaLabel?: string;
    valueLabel?: string;
    normalizeByPopulation?: boolean;
    normalizeByLegislators?: boolean;
    party?: 'both' | 'democratic' | 'republican';
    colorMode?: 'volume' | 'contribution';
    compact?: boolean;
    showLegend?: boolean;
    showValues?: boolean;
    interactive?: boolean;
    drilldownContext?: DrilldownContext;
  }

  interface StateTile {
    code: string;
    name: string;
    column: number;
    row: number;
    count: number;
    legislatorCount: number;
    democraticPostCount: number;
    republicanPostCount: number;
    democraticLegislatorCount: number;
    republicanLegislatorCount: number;
    available: boolean;
    href: string | null;
  }

  let {
    states = [],
    hrefPrefix = '/place/',
    ariaLabel = 'Geographic tile map of post activity by state',
    valueLabel = 'posts',
    normalizeByPopulation = false,
    normalizeByLegislators = false,
    party = 'both',
    colorMode = 'volume',
    compact = false,
    showLegend = true,
    showValues = true,
    interactive = true,
    drilldownContext = {}
  }: Props = $props();

  const STATE_LAYOUT = [
    ['AK', 'Alaska', 1, 1],
    ['ME', 'Maine', 12, 1],
    ['VT', 'Vermont', 11, 2],
    ['NH', 'New Hampshire', 12, 2],
    ['WA', 'Washington', 1, 3],
    ['ID', 'Idaho', 2, 3],
    ['MT', 'Montana', 3, 3],
    ['ND', 'North Dakota', 4, 3],
    ['MN', 'Minnesota', 5, 3],
    ['WI', 'Wisconsin', 6, 3],
    ['MI', 'Michigan', 7, 3],
    ['NY', 'New York', 9, 3],
    ['CT', 'Connecticut', 10, 3],
    ['RI', 'Rhode Island', 11, 3],
    ['MA', 'Massachusetts', 12, 3],
    ['OR', 'Oregon', 1, 4],
    ['NV', 'Nevada', 2, 4],
    ['WY', 'Wyoming', 3, 4],
    ['SD', 'South Dakota', 4, 4],
    ['IA', 'Iowa', 5, 4],
    ['IL', 'Illinois', 6, 4],
    ['IN', 'Indiana', 7, 4],
    ['OH', 'Ohio', 8, 4],
    ['PA', 'Pennsylvania', 9, 4],
    ['NJ', 'New Jersey', 10, 4],
    ['DE', 'Delaware', 11, 4],
    ['CA', 'California', 1, 5],
    ['UT', 'Utah', 2, 5],
    ['CO', 'Colorado', 3, 5],
    ['NE', 'Nebraska', 4, 5],
    ['MO', 'Missouri', 5, 5],
    ['KY', 'Kentucky', 6, 5],
    ['WV', 'West Virginia', 7, 5],
    ['VA', 'Virginia', 8, 5],
    ['DC', 'District of Columbia', 9, 5],
    ['MD', 'Maryland', 10, 5],
    ['AZ', 'Arizona', 2, 6],
    ['NM', 'New Mexico', 3, 6],
    ['KS', 'Kansas', 4, 6],
    ['AR', 'Arkansas', 5, 6],
    ['MS', 'Mississippi', 6, 6],
    ['TN', 'Tennessee', 7, 6],
    ['NC', 'North Carolina', 8, 6],
    ['OK', 'Oklahoma', 4, 7],
    ['LA', 'Louisiana', 5, 7],
    ['AL', 'Alabama', 6, 7],
    ['GA', 'Georgia', 7, 7],
    ['SC', 'South Carolina', 8, 7],
    ['HI', 'Hawaii', 1, 8],
    ['TX', 'Texas', 4, 8],
    ['FL', 'Florida', 8, 8]
  ] as const;

  const metricsLookup = $derived.by(() => {
    const lookup = new Map<string, Omit<StateTile, 'name' | 'column' | 'row' | 'available' | 'href'>>();
    for (const state of states) {
      const code = cleanText(
        state?.state ?? state?.stateCode ?? state?.state_code ?? state?.code ?? state?.abbreviation
      )?.toUpperCase();
      if (!code) continue;
      const incoming = {
        code,
        count: metric(state?.postCount ?? state?.post_count ?? state?.count ?? state?.value),
        legislatorCount: metric(state?.legislatorCount ?? state?.legislator_count ?? state?.legislators),
        democraticPostCount: metric(state?.democraticPostCount ?? state?.democratic_post_count),
        republicanPostCount: metric(state?.republicanPostCount ?? state?.republican_post_count),
        democraticLegislatorCount: metric(state?.democraticLegislatorCount ?? state?.democratic_legislator_count),
        republicanLegislatorCount: metric(state?.republicanLegislatorCount ?? state?.republican_legislator_count)
      };
      const existing = lookup.get(code);
      lookup.set(code, existing ? {
        ...incoming,
        count: existing.count + incoming.count,
        democraticPostCount: existing.democraticPostCount + incoming.democraticPostCount,
        republicanPostCount: existing.republicanPostCount + incoming.republicanPostCount,
        legislatorCount: Math.max(existing.legislatorCount, incoming.legislatorCount),
        democraticLegislatorCount: Math.max(existing.democraticLegislatorCount, incoming.democraticLegislatorCount),
        republicanLegislatorCount: Math.max(existing.republicanLegislatorCount, incoming.republicanLegislatorCount)
      } : incoming);
    }
    return lookup;
  });

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

  const tiles = $derived.by((): StateTile[] =>
    STATE_LAYOUT.map(([code, name, column, row]) => {
      const metrics = metricsLookup.get(code);
      const available = Boolean(metrics);
      return {
        code,
        name,
        column,
        row,
        count: metrics?.count ?? 0,
        legislatorCount: metrics?.legislatorCount ?? 0,
        democraticPostCount: metrics?.democraticPostCount ?? 0,
        republicanPostCount: metrics?.republicanPostCount ?? 0,
        democraticLegislatorCount: metrics?.democraticLegislatorCount ?? 0,
        republicanLegislatorCount: metrics?.republicanLegislatorCount ?? 0,
        available,
        href: interactive && available
          ? withBase(appendDrilldownContext(`${hrefPrefix}${encodeURIComponent(code)}`, drilldownContext))
          : null
      };
    })
  );

  const scaleMaximum = $derived.by(() =>
    Math.max(1, ...tiles.map((tile) => visualValue(tile)))
  );
  const democraticMaximum = $derived(Math.max(0, ...tiles.map((tile) => partyMeasure(tile, 'democratic'))));
  const democraticMinimum = $derived(Math.min(...tiles.filter((tile) => tile.available).map((tile) => partyMeasure(tile, 'democratic'))));
  const republicanMaximum = $derived(Math.max(0, ...tiles.map((tile) => partyMeasure(tile, 'republican'))));
  const republicanMinimum = $derived(Math.min(...tiles.filter((tile) => tile.available).map((tile) => partyMeasure(tile, 'republican'))));

  function cleanText(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    const text = String(value).trim();
    return text && !/^(?:nan|na|n\/a|null|none)$/i.test(text) ? text : null;
  }

  function metric(value: unknown): number {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
  }

  function scaleRatio(value: number): number {
    return value > 0 ? Math.sqrt(Math.min(1, value / scaleMaximum)) : 0;
  }

  function normalizedValue(tile: StateTile): number | null {
    const count = filteredCount(tile);
    if (normalizeByLegislators) {
      const legislators = filteredLegislatorCount(tile);
      return legislators > 0
        ? count / legislators
        : null;
    }
    const population = STATE_POPULATION_2025[tile.code];
    return population ? (count / population) * 100_000 : null;
  }

  function visualValue(tile: StateTile): number {
    return normalizeByPopulation || normalizeByLegislators
      ? (normalizedValue(tile) ?? 0)
      : filteredCount(tile);
  }

  function filteredCount(tile: StateTile): number {
    if (party === 'democratic') return tile.democraticPostCount;
    if (party === 'republican') return tile.republicanPostCount;
    return tile.count;
  }

  function filteredLegislatorCount(tile: StateTile): number {
    if (party === 'democratic') return tile.democraticLegislatorCount;
    if (party === 'republican') return tile.republicanLegislatorCount;
    return tile.legislatorCount;
  }

  function contributionScores(tile: StateTile) {
    return {
      democratic: minMaxScore(partyMeasure(tile, 'democratic'), democraticMinimum, democraticMaximum),
      republican: minMaxScore(partyMeasure(tile, 'republican'), republicanMinimum, republicanMaximum)
    };
  }

  function partyMeasure(tile: StateTile, selectedParty: 'democratic' | 'republican'): number {
    const count = selectedParty === 'democratic' ? tile.democraticPostCount : tile.republicanPostCount;
    if (normalizeByPopulation) {
      const population = STATE_POPULATION_2025[tile.code];
      return population ? (count / population) * 100_000 : 0;
    }
    if (normalizeByLegislators) {
      const legislators = selectedParty === 'democratic'
        ? tile.democraticLegislatorCount
        : tile.republicanLegislatorCount;
      return legislators > 0 ? count / legislators : 0;
    }
    return count;
  }

  function minMaxScore(value: number, minimum: number, maximum: number): number {
    return maximum > minimum ? (value - minimum) / (maximum - minimum) : value > 0 ? 1 : 0;
  }

  function contributionColor(tile: StateTile): string {
    const scores = contributionScores(tile);
    const d = party === 'republican' ? 0 : scores.democratic;
    const r = party === 'democratic' ? 0 : scores.republican;
    if (d + r <= 0) {
      return party === 'democratic' ? '#356fa3' : party === 'republican' ? '#b54842' : '#70558b';
    }
    const share = d / (d + r);
    const red = [181, 72, 66], purple = [112, 85, 139], blue = [53, 111, 163];
    const from = share <= 0.5 ? red : purple;
    const to = share <= 0.5 ? purple : blue;
    const t = share <= 0.5 ? share * 2 : (share - 0.5) * 2;
    return `rgb(${from.map((channel, index) => Math.round(channel + (to[index] - channel) * t)).join(' ')})`;
  }

  function tileStyle(tile: StateTile): string {
    const scores = contributionScores(tile);
    const contributionStrength = party === 'democratic'
      ? scores.democratic
      : party === 'republican'
        ? scores.republican
        : Math.max(scores.democratic, scores.republican);
    const tint = colorMode === 'contribution'
      ? 14 + contributionStrength * 58
      : 8 + scaleRatio(visualValue(tile)) * 40;
    const color = colorMode === 'contribution' ? contributionColor(tile) : 'var(--color-seal, #8a5a1a)';
    return `grid-column:${tile.column};grid-row:${tile.row};--tile-color:${color};--tile-tint:${tint.toFixed(2)}%`;
  }

  function exactCount(value: number): string {
    return value.toLocaleString('en-US');
  }

  function accessibleLabel(tile: StateTile): string {
    if (!tile.available) return `${tile.name}: no activity data available.`;
    const normalized = normalizedValue(tile);
    const rate = (normalizeByPopulation || normalizeByLegislators) && normalized !== null
      ? ` ${normalized.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${normalizationUnit()}.`
      : '';
    return `${tile.name}: ${exactCount(filteredCount(tile))} ${partyCountLabel()}.${rate} Open state profile.`;
  }

  function normalizationUnit(): string {
    return normalizeByLegislators
      ? 'posts per represented legislator'
      : 'posts per 100,000 residents';
  }

  function partyCountLabel(): string {
    if (party === 'democratic') return 'Democratic posts';
    if (party === 'republican') return 'Republican posts';
    return valueLabel;
  }
</script>

<section class="tile-map" class:compact aria-label={ariaLabel}>
  {#if showLegend}
    <div class="map-legend" class:contribution={colorMode === 'contribution'}>
      <div class="legend-scale" aria-hidden="true">
        <span class="low"></span><span class="medium"></span><span class="high"></span>
      </div>
      <p>{colorMode === 'contribution'
        ? 'Hue compares independently scaled Democratic (blue) and Republican (red) state contributions; equal relative contribution is purple.'
        : `Darker cells indicate ${normalizeByPopulation || normalizeByLegislators ? normalizationUnit() : `more ${valueLabel}`}.`}
        Hover or focus for details; select a state to open its profile.</p>
    </div>
  {/if}

  {#if interactive}
    <div class="map-scroll" role="region" aria-label="Scrollable state tile map">
      <div class="map-grid">
        {#each tiles as tile (tile.code)}
          <div class="tile-position" style={tileStyle(tile)}>
            {#if tile.href}
              <a class="state-tile" class:zero={tile.count === 0} href={tile.href} aria-label={accessibleLabel(tile)}>
                <strong>{tile.code}</strong>
                {#if showValues}
                  <span>{normalizeByPopulation || normalizeByLegislators
                    ? `${normalizedValue(tile)?.toLocaleString('en-US', { maximumFractionDigits: 1 }) ?? '—'}${normalizeByLegislators ? ' / leg.' : ' / 100k'}`
                    : compactNumber(filteredCount(tile))}</span>
                {/if}
                <span class="tooltip" role="tooltip">
                  <b>{tile.name}</b>
                  <span>{exactCount(filteredCount(tile))} {valueLabel}</span>
                  {#if colorMode === 'contribution'}
                    <span>Democratic: {exactCount(tile.democraticPostCount)}</span>
                    <span>Republican: {exactCount(tile.republicanPostCount)}</span>
                  {/if}
                  {#if (normalizeByPopulation || normalizeByLegislators) && normalizedValue(tile) !== null}
                    <span>{normalizedValue(tile)?.toLocaleString('en-US', { maximumFractionDigits: 1 })} {normalizationUnit()}</span>
                    {#if normalizeByLegislators}
                      <span>{filteredLegislatorCount(tile).toLocaleString('en-US')} represented legislators</span>
                    {/if}
                  {/if}
                  <small>Open state profile →</small>
                </span>
              </a>
            {:else}
              <div class="state-tile unavailable" aria-label={accessibleLabel(tile)} role="img">
                <strong>{tile.code}</strong>
                {#if showValues}
                  <span>—</span>
                {/if}
                <span class="tooltip" role="tooltip">
                  <b>{tile.name}</b>
                  <span>No activity data available</span>
                </span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <div class="map-scroll" aria-hidden="true">
      <div class="map-grid">
        {#each tiles as tile (tile.code)}
          <div class="tile-position" style={tileStyle(tile)}>
            <div class="state-tile" class:unavailable={!tile.available}>
              <strong>{tile.code}</strong>
              {#if showValues}
                <span>{tile.available
                  ? normalizeByPopulation || normalizeByLegislators
                    ? `${normalizedValue(tile)?.toLocaleString('en-US', { maximumFractionDigits: 1 }) ?? '—'}${normalizeByLegislators ? ' / leg.' : ' / 100k'}`
                    : compactNumber(filteredCount(tile))
                  : '—'}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</section>

<style>
  .tile-map { min-width: 0; color: var(--color-ink, #1a1917); }
  .map-legend { display: flex; gap: 9px; align-items: center; margin-bottom: 12px; color: var(--color-mute, #6b6659); }
  .map-legend p { margin: 0; font-size: 0.72rem; line-height: 1.1rem; }
  .legend-scale { display: inline-flex; flex: 0 0 auto; gap: 2px; }
  .legend-scale span { width: 13px; height: 10px; border: 1px solid var(--color-rule, #d9d2c1); border-radius: 1px; }
  .legend-scale .low { background: color-mix(in srgb, var(--color-seal, #8a5a1a) 10%, var(--color-card, #fff)); }
  .legend-scale .medium { background: color-mix(in srgb, var(--color-seal, #8a5a1a) 28%, var(--color-card, #fff)); }
  .legend-scale .high { background: color-mix(in srgb, var(--color-seal, #8a5a1a) 48%, var(--color-card, #fff)); }
  .map-legend.contribution .legend-scale .low { background: #b54842; }
  .map-legend.contribution .legend-scale .medium { background: #70558b; }
  .map-legend.contribution .legend-scale .high { background: #356fa3; }

  .map-scroll {
    min-width: 0;
    overflow-x: auto;
    padding: 88px 4px 12px;
    margin-top: -60px;
    scrollbar-width: thin;
    overscroll-behavior-inline: contain;
  }
  .map-scroll:focus-visible { outline: 2px solid var(--color-seal, #8a5a1a); outline-offset: 2px; }
  .map-grid {
    display: grid;
    grid-template-columns: repeat(12, minmax(48px, 1fr));
    grid-template-rows: repeat(8, minmax(48px, 1fr));
    gap: clamp(3px, 0.6vw, 7px);
    width: max(720px, 100%);
    max-width: 1040px;
    aspect-ratio: 12 / 8;
    margin-inline: auto;
  }
  .tile-position { position: relative; min-width: 0; min-height: 0; }
  .state-tile {
    display: grid;
    place-content: center;
    gap: 2px;
    width: 100%;
    height: 100%;
    min-height: 46px;
    padding: 4px;
    color: var(--color-ink, #1a1917);
    text-align: center;
    text-decoration: none;
    background: color-mix(in srgb, var(--tile-color, var(--color-seal, #8a5a1a)) var(--tile-tint), var(--color-card, #fff));
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 5px;
    box-shadow: 0 1px 2px rgb(26 25 23 / 4%);
    transition: border-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
  }
  .state-tile strong {
    font-family: var(--font-data, var(--type-mono, ui-monospace, monospace));
    font-size: clamp(0.72rem, 1.2vw, 0.9rem);
    line-height: 1;
    letter-spacing: 0.04em;
  }
  .state-tile > span:not(.tooltip) {
    color: var(--color-mute, #6b6659);
    font-family: var(--font-data, var(--type-mono, ui-monospace, monospace));
    font-size: clamp(0.56rem, 0.9vw, 0.68rem);
    font-variant-numeric: tabular-nums;
  }
  a.state-tile:hover, a.state-tile:focus-visible {
    z-index: 3;
    color: var(--color-seal, #8a5a1a);
    border-color: var(--color-seal, #8a5a1a);
    box-shadow: 0 5px 16px rgb(26 25 23 / 14%);
    transform: translateY(-2px);
  }
  a.state-tile:focus-visible { outline: 2px solid var(--color-seal, #8a5a1a); outline-offset: 2px; }
  .state-tile.unavailable { color: var(--color-mute-soft, #9c9787); background: var(--color-card, #fff); border-style: dashed; }
  .tooltip {
    position: absolute;
    z-index: 20;
    bottom: calc(100% + 8px);
    left: 50%;
    display: grid;
    gap: 2px;
    width: max-content;
    max-width: 190px;
    padding: 8px 10px;
    color: var(--color-ink, #1a1917);
    text-align: left;
    pointer-events: none;
    visibility: hidden;
    opacity: 0;
    background: var(--color-elevated, var(--color-card, #fff));
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 5px;
    box-shadow: var(--shadow-md, 0 8px 24px rgb(26 25 23 / 16%));
    transform: translate(-50%, 4px);
    transition: opacity 100ms ease, transform 100ms ease, visibility 100ms ease;
  }
  .tooltip b { font-size: 0.76rem; line-height: 1.05rem; }
  .tooltip span, .tooltip small { color: var(--color-mute, #6b6659); font-size: 0.68rem; line-height: 0.95rem; }
  .state-tile:hover .tooltip, .state-tile:focus-visible .tooltip { visibility: visible; opacity: 1; transform: translate(-50%, 0); }
  .tile-map.compact .map-scroll {
    overflow: visible;
    padding: 0;
    margin: 0;
  }
  .tile-map.compact .map-grid {
    grid-template-columns: repeat(12, minmax(10px, 1fr));
    grid-template-rows: repeat(8, minmax(10px, 1fr));
    gap: 2px;
    width: 176px;
    min-width: 0;
    max-width: 100%;
    aspect-ratio: 12 / 8;
    margin: 0;
  }
  .tile-map.compact .state-tile {
    min-height: 0;
    padding: 0;
    border-radius: 2px;
    box-shadow: none;
  }
  .tile-map.compact .state-tile strong {
    overflow: hidden;
    max-width: 100%;
    font-size: clamp(0.4rem, 1.5vw, 0.56rem);
    letter-spacing: 0;
    text-overflow: clip;
  }
  .tile-map.compact .tooltip {
    display: none;
  }
  @media (max-width: 760px) {
    .map-scroll { padding-bottom: 8px; }
    .map-grid { margin-inline: 0; }
    .tile-map.compact .map-scroll { padding-bottom: 0; }
  }
  @media (prefers-reduced-motion: reduce) { .state-tile, .tooltip { transition: none; } }
  @media (forced-colors: active) {
    .state-tile, .legend-scale span { color: CanvasText; background: Canvas; border-color: CanvasText; }
    a.state-tile:focus-visible { outline-color: Highlight; }
  }
  @media print {
    .map-scroll { overflow: visible; }
    .map-grid { width: 100%; }
    .state-tile { color: #000; background: transparent; border-color: #999; box-shadow: none; }
    .tooltip { display: none; }
  }
</style>
