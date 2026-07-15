<script lang="ts">
  import { withBase } from '$lib/paths';

  type LegislatorRow = {
    lid?: unknown;
    name?: unknown;
    party?: unknown;
    mrpIdeology?: unknown;
    topicPosts?: unknown;
  };

  type NormalizedRow = {
    key: string;
    sourceIndex: number;
    lid: string;
    href: string | null;
    name: string;
    party: string | null;
    ideology: number;
    posts: number;
  };

  type PositionedRow = NormalizedRow & {
    x: number;
    y: number;
    radius: number;
    fill: string;
    tooltip: string;
    ariaLabel: string;
  };

  type RawPosition = NormalizedRow & {
    x: number;
    yOffset: number;
    radius: number;
  };

  type Tick = {
    value: number;
    x: number;
    label: string;
  };

  export let rows: LegislatorRow[] = [];

  const WIDTH = 960;
  const HEIGHT = 330;

  const PLOT_LEFT = 58;
  const PLOT_RIGHT = WIDTH - 58;
  const SWARM_TOP = 26;
  const SWARM_BOTTOM = 238;
  const AXIS_Y = 266;

  const DOMAIN_MIN = -2;
  const DOMAIN_MAX = 2;
  const MAX_POINTS = 5000;

  const MIN_RADIUS = 2.2;
  const MAX_RADIUS = 6.2;
  const COLLISION_GAP = 0.8;

  $: normalizedRows = normalizeRows(rows);
  $: partyOptions = createPartyOptions(normalizedRows);
  let selectedParty = 'All';
  let zoom = 1.15;
  let chartScroller: HTMLDivElement | null = null;
  let isPanning = false;
  let activePointerId: number | null = null;
  let dragStartX = 0;
  let dragStartScrollLeft = 0;
  let pinchStartDistance = 0;
  let pinchStartZoom = 1;
  let pinchAnchorX = 0;
  const activePointers = new Map<number, { x: number; y: number }>();
  $: filteredRows =
    selectedParty === 'All'
      ? normalizedRows
      : normalizedRows.filter((row) => (row.party ?? 'Unknown') === selectedParty);
  $: layout = buildLayout(filteredRows);
  $: tableRows = [...layout.points].sort(
    (a, b) => a.ideology - b.ideology || a.name.localeCompare(b.name)
  );
  $: summary = summarize(layout.points);
  $: chartWidth = Math.round(WIDTH * Number(zoom || 1));

  function normalizeRows(input: LegislatorRow[]): NormalizedRow[] {
    if (!Array.isArray(input)) return [];

    const normalized: NormalizedRow[] = [];

    for (let sourceIndex = 0; sourceIndex < input.length; sourceIndex += 1) {
      if (normalized.length >= MAX_POINTS) break;

      const row = input[sourceIndex];

      if (!row || typeof row !== 'object') continue;

      const ideology = finiteNumber(row.mrpIdeology);
      const rawPosts = finiteNumber(row.topicPosts);

      if (ideology === null || rawPosts === null || rawPosts <= 0) continue;

      const posts = Math.max(1, Math.trunc(rawPosts));
      const lid = stringValue(row.lid);
      const name = stringValue(row.name) || `Legislator ${sourceIndex + 1}`;
      const party = stringValue(row.party) || null;

      normalized.push({
        key: `${lid || name}-${sourceIndex}`,
        sourceIndex,
        lid,
        href: lid ? withBase(`/who/${encodeURIComponent(lid)}`) : null,
        name,
        party,
        ideology,
        posts
      });
    }

    return normalized;
  }

  function buildLayout(source: NormalizedRow[]): {
    points: PositionedRow[];
    ticks: Tick[];
  } {
    if (source.length === 0) {
      return {
        points: [],
        ticks: createTicks(DOMAIN_MIN, DOMAIN_MAX)
      };
    }

    const minX = Math.min(DOMAIN_MIN, ...source.map((row) => row.ideology));
    const maxX = Math.max(DOMAIN_MAX, ...source.map((row) => row.ideology));
    const maxPosts = Math.max(...source.map((row) => row.posts));

    const seeds = source
      .map((row) => ({
        ...row,
        x: scaleX(row.ideology, minX, maxX),
        radius: radiusFor(row.posts, maxPosts)
      }))
      .sort(
        (a, b) =>
          a.x - b.x ||
          b.radius - a.radius ||
          a.sourceIndex - b.sourceIndex
      );

    const placed: RawPosition[] = [];
    let activeStart = 0;

    for (const seed of seeds) {
      while (
        activeStart < placed.length &&
        seed.x - placed[activeStart].x >
          seed.radius + MAX_RADIUS + COLLISION_GAP
      ) {
        activeStart += 1;
      }

      const neighbors = placed.slice(activeStart);
      const candidates = [0];

      for (const neighbor of neighbors) {
        const dx = seed.x - neighbor.x;
        const minimumDistance =
          seed.radius + neighbor.radius + COLLISION_GAP;
        const remaining =
          minimumDistance * minimumDistance - dx * dx;

        if (remaining <= 0) continue;

        const dy = Math.sqrt(remaining);
        candidates.push(neighbor.yOffset - dy, neighbor.yOffset + dy);
      }

      candidates.sort(
        (a, b) => Math.abs(a) - Math.abs(b) || a - b
      );

      let yOffset = candidates.find((candidate) =>
        neighbors.every((neighbor) => {
          const dx = seed.x - neighbor.x;
          const dy = candidate - neighbor.yOffset;
          const minimumDistance =
            seed.radius + neighbor.radius + COLLISION_GAP;

          return (
            dx * dx + dy * dy >=
            minimumDistance * minimumDistance - 0.01
          );
        })
      );

      if (yOffset === undefined) {
        const top = Math.min(
          0,
          ...neighbors.map(
            (neighbor) => neighbor.yOffset - neighbor.radius
          )
        );

        const bottom = Math.max(
          0,
          ...neighbors.map(
            (neighbor) => neighbor.yOffset + neighbor.radius
          )
        );

        const above = top - seed.radius - COLLISION_GAP;
        const below = bottom + seed.radius + COLLISION_GAP;

        yOffset = Math.abs(above) <= Math.abs(below) ? above : below;
      }

      placed.push({
        ...seed,
        yOffset
      });
    }

    const offsets = placed.map((point) => point.yOffset);
    const minimumOffset = Math.min(...offsets);
    const maximumOffset = Math.max(...offsets);
    const offsetSpan = maximumOffset - minimumOffset;
    const plotHeight = SWARM_BOTTOM - SWARM_TOP;
    const plotCenter = (SWARM_TOP + SWARM_BOTTOM) / 2;
    const usableCenterHeight = plotHeight - MAX_RADIUS * 2;

    const scaleY =
      offsetSpan > usableCenterHeight && offsetSpan > 0
        ? usableCenterHeight / offsetSpan
        : 1;

    const offsetCenter = (minimumOffset + maximumOffset) / 2;

    const points = placed
      .map<PositionedRow>((point) => {
        const party = point.party ?? 'party unknown';
        const postLabel = point.posts === 1 ? 'post' : 'posts';
        const tooltip =
          `${point.name} · ${party} · ` +
          `${formatCount(point.posts)} topic ${postLabel} · ` +
          `ideology ${point.ideology.toFixed(3)}`;

        return {
          ...point,
          y: plotCenter + (point.yOffset - offsetCenter) * scaleY,
          fill: partyFill(point.party),
          tooltip,
          ariaLabel: tooltip
        };
      })
      .sort(
        (a, b) =>
          b.radius - a.radius ||
          a.sourceIndex - b.sourceIndex
      );

    return {
      points,
      ticks: createTicks(minX, maxX)
    };
  }

  function createPartyOptions(source: NormalizedRow[]): string[] {
    return [
      'All',
      ...Array.from(new Set(source.map((row) => row.party ?? 'Unknown'))).sort()
    ];
  }

  function summarize(points: PositionedRow[]) {
    const sorted = [...points].sort((a, b) => a.ideology - b.ideology);
    const midpoint = Math.floor(sorted.length / 2);
    const median =
      sorted.length === 0
        ? null
        : sorted.length % 2
          ? sorted[midpoint].ideology
          : (sorted[midpoint - 1].ideology + sorted[midpoint].ideology) / 2;
    const totalPosts = points.reduce((sum, point) => sum + point.posts, 0);
    const topVoice = [...points].sort((a, b) => b.posts - a.posts)[0] ?? null;

    return {
      median,
      totalPosts,
      topVoice
    };
  }

  function resetView() {
    selectedParty = 'All';
    zoom = 1.15;
    activePointers.clear();
    isPanning = false;
    activePointerId = null;
    if (chartScroller) {
      chartScroller.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }

  function clampZoom(value: number): number {
    return Math.min(4, Math.max(1, Number.isFinite(value) ? value : 1));
  }

  function zoomAround(nextZoom: number, clientX: number | null = null) {
    const scroller = chartScroller;
    const previousWidth = Math.max(chartWidth, WIDTH);
    const safeZoom = clampZoom(nextZoom);

    if (!scroller) {
      zoom = safeZoom;
      return;
    }

    const rect = scroller.getBoundingClientRect();
    const anchorX =
      clientX === null
        ? rect.width / 2
        : Math.min(rect.width, Math.max(0, clientX - rect.left));
    const anchorRatio = (scroller.scrollLeft + anchorX) / previousWidth;

    zoom = safeZoom;

    requestAnimationFrame(() => {
      if (!chartScroller) return;
      chartScroller.scrollLeft = Math.max(
        0,
        anchorRatio * Math.max(chartWidth, WIDTH) - anchorX
      );
    });
  }

  function handleWheel(event: WheelEvent) {
    if (!chartScroller) return;

    event.preventDefault();

    const delta = event.deltaY || event.deltaX;
    const speed = event.shiftKey ? 0.0028 : 0.0015;
    const factor = Math.exp(-delta * speed);

    zoomAround(Number(zoom) * factor, event.clientX);
  }

  function pointerValues() {
    return [...activePointers.values()];
  }

  function pointerDistance(points = pointerValues()): number {
    if (points.length < 2) return 0;

    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  function pointerCenterX(points = pointerValues()): number | null {
    if (points.length === 0) return null;

    return points.reduce((sum, point) => sum + point.x, 0) / points.length;
  }

  function handlePointerDown(event: PointerEvent) {
    const target = event.target instanceof Element ? event.target : null;
    activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    });

    if (activePointers.size === 2) {
      const points = pointerValues();
      pinchStartDistance = pointerDistance(points);
      pinchStartZoom = Number(zoom);
      pinchAnchorX = pointerCenterX(points) ?? event.clientX;
      isPanning = false;
      activePointerId = null;
      chartScroller?.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (target?.closest('a')) return;

    isPanning = true;
    activePointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartScrollLeft = chartScroller?.scrollLeft ?? 0;
    chartScroller?.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent) {
    if (!activePointers.has(event.pointerId)) return;

    activePointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY
    });

    if (activePointers.size >= 2 && pinchStartDistance > 0) {
      const nextDistance = pointerDistance();

      if (nextDistance > 0) {
        event.preventDefault();
        zoomAround(
          pinchStartZoom * (nextDistance / pinchStartDistance),
          pointerCenterX() ?? pinchAnchorX
        );
      }

      return;
    }

    if (isPanning && event.pointerId === activePointerId && chartScroller) {
      event.preventDefault();
      chartScroller.scrollLeft = dragStartScrollLeft - (event.clientX - dragStartX);
    }
  }

  function handlePointerUp(event: PointerEvent) {
    activePointers.delete(event.pointerId);

    if (event.pointerId === activePointerId) {
      isPanning = false;
      activePointerId = null;
    }

    if (activePointers.size < 2) {
      pinchStartDistance = 0;
    }
  }

  function createTicks(min: number, max: number): Tick[] {
    const range = Math.max(max - min, 0.1);
    const roughStep = range / 5;
    const magnitude = 10 ** Math.floor(Math.log10(roughStep));
    const normalizedStep = roughStep / magnitude;

    const multiplier =
      normalizedStep >= 5
        ? 5
        : normalizedStep >= 2.5
          ? 2.5
          : normalizedStep >= 2
            ? 2
            : 1;

    const step = multiplier * magnitude;
    const first = Math.ceil(min / step) * step;
    const decimals = step < 1
      ? Math.min(3, Math.ceil(-Math.log10(step)))
      : 0;

    const ticks: Tick[] = [];

    for (
      let value = first;
      value <= max + step * 0.001 && ticks.length < 12;
      value += step
    ) {
      const normalizedValue = Math.abs(value) < step * 0.001 ? 0 : value;

      ticks.push({
        value: normalizedValue,
        x: scaleX(normalizedValue, min, max),
        label: normalizedValue.toFixed(decimals)
      });
    }

    return ticks;
  }

  function scaleX(value: number, min: number, max: number): number {
    const range = Math.max(max - min, 0.1);

    return (
      PLOT_LEFT +
      ((value - min) / range) * (PLOT_RIGHT - PLOT_LEFT)
    );
  }

  function radiusFor(posts: number, maxPosts: number): number {
    if (maxPosts <= 0) return MIN_RADIUS;

    return (
      MIN_RADIUS +
      Math.sqrt(posts / maxPosts) * (MAX_RADIUS - MIN_RADIUS)
    );
  }

  function partyFill(party: string | null): string {
    const normalized = party?.trim().toLowerCase();

    if (normalized === 'democratic' || normalized === 'democrat') {
      return 'var(--color-ballot-blue, #2563eb)';
    }

    if (normalized === 'republican') {
      return 'var(--color-ballot-red, #dc2626)';
    }

    if (normalized === 'independent') {
      return 'var(--color-independent, #7c3aed)';
    }

    return 'var(--color-mute-soft, #94a3b8)';
  }

  function finiteNumber(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== 'string' || value.trim() === '') {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
  }

  function stringValue(value: unknown): string {
    if (typeof value === 'string') return value.trim();

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }

    return '';
  }

  function formatCount(value: number): string {
    return value.toLocaleString('en-US');
  }
</script>

<figure class="beeswarm">
  <figcaption>
    <h2>Ideology distribution</h2>
    <p class="caption">
      One dot per legislator with voting-record data. Dot size represents
      posts on this topic.
      {#if layout.points.length > 0}
        {formatCount(layout.points.length)}
        {layout.points.length === 1 ? 'legislator' : 'legislators'}
        shown.
      {/if}
    </p>
  </figcaption>

  {#if layout.points.length > 0}
    <div class="summary-strip" aria-label="Ideology distribution summary">
      <div>
        <span>Visible</span>
        <strong>{formatCount(layout.points.length)}</strong>
      </div>
      <div>
        <span>Median ideology</span>
        <strong>{summary.median === null ? '—' : summary.median.toFixed(3)}</strong>
      </div>
      <div>
        <span>Topic posts</span>
        <strong>{formatCount(summary.totalPosts)}</strong>
      </div>
      <div>
        <span>Most active</span>
        <strong>{summary.topVoice ? summary.topVoice.name : '—'}</strong>
      </div>
    </div>

    <div class="chart-tools" aria-label="Ideology chart controls">
      <label>
        <span>Party</span>
        <select bind:value={selectedParty}>
          {#each partyOptions as party}
            <option value={party}>{party}</option>
          {/each}
        </select>
      </label>

      <label class="zoom-control">
        <span>Zoom</span>
        <input type="range" min="1" max="2.6" step="0.1" bind:value={zoom} />
        <output>{Number(zoom).toFixed(1)}x</output>
      </label>

      <button type="button" onclick={resetView}>Reset</button>
    </div>

    <div
      class="chart-container"
      class:panning={isPanning}
      bind:this={chartScroller}
      role="region"
      aria-label="Pan and zoom ideology chart. Use the mouse wheel or pinch to zoom, then drag empty chart space to pan."
      onwheel={handleWheel}
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerUp}
    >
      <svg
        class="chart"
        style={`width:${chartWidth}px;min-width:100%`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Ideology distribution for ${layout.points.length} legislators`}
        preserveAspectRatio="xMidYMid meet"
      >
        {#each layout.ticks as tick (tick.value)}
          <line
            class="gridline"
            class:zero={tick.value === 0}
            x1={tick.x}
            x2={tick.x}
            y1={SWARM_TOP}
            y2={AXIS_Y}
          />

          <text
            class="tick-label"
            x={tick.x}
            y={AXIS_Y + 18}
            text-anchor="middle"
          >
            {tick.label}
          </text>
        {/each}

        <line
          class="axis"
          x1={PLOT_LEFT}
          x2={PLOT_RIGHT}
          y1={AXIS_Y}
          y2={AXIS_Y}
        />

        <text
          class="direction-label"
          x={PLOT_LEFT}
          y={HEIGHT - 10}
        >
          More liberal
        </text>

        <text
          class="direction-label"
          x={PLOT_RIGHT}
          y={HEIGHT - 10}
          text-anchor="end"
        >
          More conservative
        </text>

        {#each layout.points as point (point.key)}
          <a
            href={point.href ?? undefined}
            aria-label={point.ariaLabel}
            aria-disabled={point.href ? undefined : 'true'}
          >
            <circle
              class:unlinked={!point.href}
              cx={point.x}
              cy={point.y}
              r={point.radius}
              fill={point.fill}
              opacity="0.62"
              vector-effect="non-scaling-stroke"
            >
              <title>{point.tooltip}</title>
            </circle>
          </a>
        {/each}
      </svg>
    </div>

    <details>
      <summary>
        View as table
        <span class="summary-count">
          ({formatCount(tableRows.length)})
        </span>
      </summary>

      <div class="table-container">
        <table>
          <caption>
            Legislators shown in the chart, ordered from most liberal to
            most conservative
          </caption>

          <thead>
            <tr>
              <th scope="col">Legislator</th>
              <th scope="col">Party</th>
              <th scope="col" class="numeric">Ideology</th>
              <th scope="col" class="numeric">Topic posts</th>
            </tr>
          </thead>

          <tbody>
            {#each tableRows as point (point.key)}
              <tr>
                <td>
                  {#if point.href}
                    <a href={point.href}>{point.name}</a>
                  {:else}
                    {point.name}
                  {/if}
                </td>
                <td>{point.party ?? '—'}</td>
                <td class="numeric">{point.ideology.toFixed(3)}</td>
                <td class="numeric">{formatCount(point.posts)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </details>
  {:else}
    <div class="empty" role="status">
      No legislators have valid ideology and topic-post data.
    </div>
  {/if}
</figure>

<style>
  .beeswarm {
    box-sizing: border-box;
    margin: 0;
    padding: 16px;
    color: var(--color-text, inherit);
    background: var(--color-card, #ffffff);
    border: 1px solid var(--color-rule, #d7dce2);
    border-radius: 8px;
  }

  figcaption {
    display: grid;
    gap: 4px;
  }

  h2 {
    margin: 0;
    font-size: 1.125rem;
    line-height: 1.3;
  }

  .caption {
    margin: 0;
    color: var(--color-mute, #64748b);
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .chart-container {
    margin-top: 14px;
    padding-top: 8px;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scrollbar-width: thin;
    touch-action: none;
    cursor: grab;
    user-select: none;
    border-top: 1px solid var(--color-rule, #d7dce2);
  }

  .chart-container.panning {
    cursor: grabbing;
  }

  .chart {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .summary-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin-top: 14px;
  }

  .summary-strip > div {
    min-width: 0;
    padding: 10px;
    background: var(--color-elevated, var(--color-card, #fff));
    border: 1px solid var(--color-rule, #d7dce2);
    border-radius: 6px;
  }

  .summary-strip span {
    display: block;
    color: var(--color-mute, #64748b);
    font-size: 0.72rem;
    line-height: 1rem;
  }

  .summary-strip strong {
    display: block;
    min-width: 0;
    overflow: hidden;
    color: var(--color-ink, var(--color-text, #0f172a));
    font-size: 0.9rem;
    line-height: 1.2rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chart-tools {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: end;
    margin-top: 12px;
  }

  .chart-tools label {
    display: grid;
    gap: 4px;
    min-width: min(100%, 150px);
    margin: 0;
  }

  .chart-tools label > span {
    color: var(--color-mute, #64748b);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.055em;
    line-height: 1rem;
    text-transform: uppercase;
  }

  .chart-tools select,
  .chart-tools input {
    min-height: 36px;
  }

  .zoom-control {
    grid-template-columns: minmax(150px, 1fr) auto;
    align-items: end;
  }

  .zoom-control > span {
    grid-column: 1 / -1;
  }

  .zoom-control output {
    color: var(--color-mute, #64748b);
    font-family: var(--type-mono, ui-monospace, monospace);
    font-size: 0.75rem;
  }

  .gridline {
    stroke: var(--color-rule, #d7dce2);
    stroke-width: 1;
    opacity: 0.55;
  }

  .gridline.zero {
    stroke-width: 1.25;
    opacity: 1;
  }

  .axis {
    stroke: var(--color-rule, #d7dce2);
    stroke-width: 1;
  }

  .tick-label,
  .direction-label {
    fill: var(--color-mute, #64748b);
    font-family: inherit;
    font-size: 11px;
    pointer-events: none;
  }

  .direction-label {
    font-size: 12px;
  }

  circle {
    transform-box: fill-box;
    transform-origin: center;
    stroke: color-mix(in srgb, var(--color-card, #fff) 75%, transparent);
    stroke-width: 0.75;
    transition:
      opacity 120ms ease,
      stroke-width 120ms ease,
      transform 120ms ease;
  }

  .chart a[href] {
    cursor: pointer;
  }

  .chart a:hover circle,
  .chart a:focus-visible circle {
    opacity: 1;
    stroke: var(--color-text, #0f172a);
    stroke-width: 1.25;
    transform: scale(1.35);
  }

  .chart a:focus-visible {
    outline: none;
  }

  circle.unlinked {
    cursor: default;
  }

  details {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--color-rule, #d7dce2);
  }

  summary {
    width: fit-content;
    cursor: pointer;
    font-weight: 600;
  }

  .summary-count {
    color: var(--color-mute, #64748b);
    font-weight: 400;
  }

  .table-container {
    max-width: 100%;
    margin-top: 12px;
    overflow-x: auto;
  }

  table {
    width: 100%;
    min-width: 520px;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  caption {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    white-space: nowrap;
    border: 0;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
  }

  th,
  td {
    padding: 8px 10px;
    text-align: left;
    border-bottom: 1px solid var(--color-rule, #d7dce2);
  }

  th {
    font-weight: 600;
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }

  .numeric {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  td a {
    color: inherit;
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
  }

  td a:hover {
    text-decoration-thickness: 2px;
  }

  .empty {
    margin-top: 14px;
    padding: 28px 16px;
    color: var(--color-mute, #64748b);
    text-align: center;
    border-top: 1px solid var(--color-rule, #d7dce2);
  }

  @media (max-width: 560px) {
    .beeswarm {
      padding: 12px;
    }

    .summary-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .tick-label,
    .direction-label {
      font-size: 10px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    circle {
      transition: none;
    }
  }
</style>
