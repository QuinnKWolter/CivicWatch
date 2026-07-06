<script lang="ts">
  type ExplorerKind =
    | 'legislator'
    | 'state'
    | 'topic'
    | 'moment';

  type PartyMark =
    | 'democratic'
    | 'republican'
    | 'independent'
    | 'unknown';

  interface Props {
    kind?: ExplorerKind;
    label?: string;

    /**
     * Optional normalized or raw numeric values.
     *
     * state:  up to 12 state-intensity values
     * topic:  up to 5 topic-volume values
     * moment: up to 9 timeline activity values
     *
     * Values are normalized within the component.
     */
    values?: number[];

    /**
     * Optional party sequence for the 24 roll-call marks.
     */
    parties?: PartyMark[];

    /**
     * Zero-based positions of event markers on the
     * nine-point moment timeline.
     */
    eventIndexes?: number[];

    /**
     * Entry-card microvisuals are decorative by default because
     * the surrounding card already provides their meaning.
     */
    decorative?: boolean;
  }

  interface Point {
    x: number;
    y: number;
  }

  interface StateCell {
    x: number;
    y: number;
  }

  let {
    kind = 'legislator',
    label = '',
    values = [],
    parties = [],
    eventIndexes = [],
    decorative = true
  }: Props = $props();

  const DEFAULT_VALUES: Record<
    Exclude<ExplorerKind, 'legislator'>,
    number[]
  > = {
    state: [
      0.24,
      0.48,
      0.72,
      0.42,
      0.88,
      0.61,
      0.33,
      0.56,
      0.79,
      0.38,
      0.66,
      0.51
    ],
    topic: [0.88, 0.59, 0.76, 0.43, 0.67],
    moment: [
      0.18,
      0.27,
      0.72,
      0.36,
      0.31,
      0.86,
      0.48,
      0.76,
      0.39
    ]
  };

  const DEFAULT_EVENT_INDEXES = [2, 5, 7];

  const STATE_CELLS: StateCell[] = [
    { x: 8, y: 28 },
    { x: 19, y: 22 },
    { x: 30, y: 22 },
    { x: 41, y: 16 },
    { x: 52, y: 16 },
    { x: 63, y: 21 },
    { x: 74, y: 21 },
    { x: 85, y: 27 },
    { x: 25, y: 33 },
    { x: 40, y: 29 },
    { x: 55, y: 29 },
    { x: 70, y: 34 }
  ];

  const HEMICYCLE_POINTS = buildHemicyclePoints();

  const resolvedKind = $derived(
    isExplorerKind(kind) ? kind : 'legislator'
  );

  const resolvedLabel = $derived(
    label.trim() || defaultLabel(resolvedKind)
  );

  const resolvedValues = $derived.by(() => {
    if (resolvedKind === 'legislator') {
      return [];
    }

    const requiredLength =
      resolvedKind === 'state'
        ? 12
        : resolvedKind === 'moment'
          ? 9
          : 5;

    const defaults = DEFAULT_VALUES[resolvedKind];
    const source = values.length ? values : defaults;

    const finiteValues = Array.from(
      { length: requiredLength },
      (_, index) => {
        const value = Number(source[index]);

        return Number.isFinite(value)
          ? value
          : defaults[index] ?? 0;
      }
    );

    return normalizeSeries(finiteValues);
  });

  const resolvedParties = $derived.by(() =>
    HEMICYCLE_POINTS.map((point, index) => {
      const supplied = normalizeParty(parties[index]);

      return supplied ?? defaultParty(point, index);
    })
  );

  const resolvedEvents = $derived.by(() => {
    const source = eventIndexes.length
      ? eventIndexes
      : DEFAULT_EVENT_INDEXES;

    return [
      ...new Set(
        source
          .map((index) => Math.trunc(index))
          .filter((index) => index >= 0 && index < 9)
      )
    ];
  });

  const momentPoints = $derived(
    resolvedValues
      .map((value, index) => {
        const x = 8 + index * 10;
        const y = 35 - value * 23;

        return `${x},${y}`;
      })
      .join(' ')
  );

  function isExplorerKind(
    value: unknown
  ): value is ExplorerKind {
    return (
      value === 'legislator' ||
      value === 'state' ||
      value === 'topic' ||
      value === 'moment'
    );
  }

  function defaultLabel(
    value: ExplorerKind
  ): string {
    switch (value) {
      case 'legislator':
        return 'Miniature legislative roll call';

      case 'state':
        return 'Miniature state comparison';

      case 'topic':
        return 'Miniature topic distribution';

      case 'moment':
        return 'Miniature event timeline';
    }
  }

  function normalizeParty(
    value: unknown
  ): PartyMark | null {
    if (
      value === 'democratic' ||
      value === 'republican' ||
      value === 'independent' ||
      value === 'unknown'
    ) {
      return value;
    }

    return null;
  }

  function normalizeSeries(
    source: number[]
  ): number[] {
    if (!source.length) return [];

    const minimum = Math.min(...source);
    const maximum = Math.max(...source);
    const range = maximum - minimum;

    if (!Number.isFinite(range) || range === 0) {
      return source.map(() => 0.55);
    }

    return source.map((value) =>
      clamp((value - minimum) / range, 0, 1)
    );
  }

  function clamp(
    value: number,
    minimum: number,
    maximum: number
  ): number {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function buildHemicyclePoints(): Point[] {
    const centerX = 48;
    const centerY = 45;

    const rings = [
      { radius: 14, count: 6 },
      { radius: 22, count: 8 },
      { radius: 30, count: 10 }
    ];

    const points: Point[] = [];

    for (const ring of rings) {
      for (
        let index = 0;
        index < ring.count;
        index += 1
      ) {
        const angle =
          Math.PI -
          ((index + 0.5) / ring.count) * Math.PI;

        points.push({
          x:
            centerX +
            Math.cos(angle) * ring.radius,
          y:
            centerY -
            Math.sin(angle) * ring.radius
        });
      }
    }

    return points.sort(
      (a, b) => a.x - b.x || a.y - b.y
    );
  }

  function defaultParty(
    point: Point,
    index: number
  ): PartyMark {
    if (point.x < 43) {
      return 'democratic';
    }

    if (point.x > 53) {
      return 'republican';
    }

    return index % 3 === 0
      ? 'unknown'
      : 'independent';
  }
</script>

<span
  class="micro"
  data-kind={resolvedKind}
  data-label={resolvedLabel}
  role={decorative ? undefined : 'img'}
  aria-hidden={decorative ? 'true' : undefined}
  aria-label={decorative ? undefined : resolvedLabel}
>
  <svg
    viewBox="0 0 96 48"
    aria-hidden="true"
    focusable="false"
  >
    {#if resolvedKind === 'legislator'}
      <path
        class="chamber-guide"
        d="M10 44 A38 34 0 0 1 86 44"
      ></path>

      {#each HEMICYCLE_POINTS as point, index}
        {@const party = resolvedParties[index]}

        {#if party === 'democratic'}
          <circle
            class="legislator-mark democratic"
            cx={point.x}
            cy={point.y}
            r="2.05"
          ></circle>
        {:else if party === 'republican'}
          <rect
            class="legislator-mark republican"
            x={point.x - 1.85}
            y={point.y - 1.85}
            width="3.7"
            height="3.7"
            rx="0.45"
          ></rect>
        {:else if party === 'independent'}
          <rect
            class="legislator-mark independent"
            x={point.x - 1.65}
            y={point.y - 1.65}
            width="3.3"
            height="3.3"
            rx="0.35"
            transform={`rotate(45 ${point.x} ${point.y})`}
          ></rect>
        {:else}
          <circle
            class="legislator-mark unknown"
            cx={point.x}
            cy={point.y}
            r="1.8"
          ></circle>
        {/if}
      {/each}

    {:else if resolvedKind === 'state'}
      <path
        class="state-guide"
        d="M6 41 H90"
      ></path>

      {#each STATE_CELLS as cell, index}
        <rect
          class="state-cell"
          x={cell.x}
          y={cell.y}
          width="8"
          height="7"
          rx="1.2"
          opacity={0.24 + resolvedValues[index] * 0.68}
        ></rect>
      {/each}

    {:else if resolvedKind === 'topic'}
      <path
        class="topic-baseline"
        d="M6 43 H90"
      ></path>

      {#each resolvedValues as value, index}
        {@const x = 8 + index * 17}
        {@const totalHeight = 13 + value * 27}
        {@const lowerHeight = totalHeight * 0.52}
        {@const middleHeight = totalHeight * 0.29}
        {@const upperHeight =
          totalHeight -
          lowerHeight -
          middleHeight}

        <g>
          <rect
            class="topic-segment topic-primary"
            x={x}
            y={43 - lowerHeight}
            width="11"
            height={lowerHeight}
            rx="0.8"
          ></rect>

          <rect
            class="topic-segment topic-secondary"
            x={x}
            y={43 - lowerHeight - middleHeight}
            width="11"
            height={middleHeight}
            rx="0.8"
          ></rect>

          <rect
            class="topic-segment topic-tertiary"
            x={x}
            y={43 - totalHeight}
            width="11"
            height={upperHeight}
            rx="0.8"
          ></rect>
        </g>
      {/each}

    {:else}
      <line
        class="moment-baseline"
        x1="6"
        y1="36"
        x2="90"
        y2="36"
      ></line>

      {#each resolvedEvents as eventIndex}
        {@const eventX = 8 + eventIndex * 10}

        <line
          class="event-marker"
          x1={eventX}
          y1="8"
          x2={eventX}
          y2="36"
        ></line>

        <circle
          class="event-head"
          cx={eventX}
          cy="8"
          r="1.8"
        ></circle>
      {/each}

      <polyline
        class="moment-trend"
        points={momentPoints}
      ></polyline>

      {#each resolvedValues as value, index}
        <circle
          class="moment-point"
          cx={8 + index * 10}
          cy={35 - value * 23}
          r="1.45"
        ></circle>
      {/each}
    {/if}
  </svg>
</span>

<style>
  .micro {
    display: block;
    width: clamp(72px, 7vw, 96px);
    min-width: 72px;
    aspect-ratio: 2 / 1;
    align-self: center;
    overflow: visible;
    color: var(--color-ink, #1a1917);
    opacity: 0.96;
    pointer-events: none;
    flex: 0 0 auto;
  }

  svg {
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
    shape-rendering: geometricPrecision;
  }

  .chamber-guide,
  .state-guide,
  .topic-baseline,
  .moment-baseline {
    fill: none;
    stroke: var(--color-rule, #d9d2c1);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .legislator-mark {
    vector-effect: non-scaling-stroke;
  }

  .legislator-mark.democratic {
    fill: var(--color-ballot-blue, #274b6e);
  }

  .legislator-mark.republican {
    fill: var(--color-ballot-red, #a13530);
  }

  .legislator-mark.independent {
    fill: var(--color-independent, #7a6a4a);
  }

  .legislator-mark.unknown {
    fill: var(--color-card, #fff);
    stroke: var(--color-mute-soft, #9c9787);
    stroke-width: 1;
  }

  .state-cell {
    fill: var(--color-seal, #8a5a1a);
    stroke: var(--color-rule, #d9d2c1);
    stroke-width: 0.75;
    vector-effect: non-scaling-stroke;
  }

  .state-guide {
    opacity: 0.55;
  }

  .topic-segment {
    vector-effect: non-scaling-stroke;
  }

  .topic-primary {
    fill: var(--color-seal, #8a5a1a);
  }

  .topic-secondary {
    fill: var(--color-signal, #3a6c4c);
  }

  .topic-tertiary {
    fill: var(--color-ballot-blue, #274b6e);
  }

  .moment-baseline {
    stroke-width: 1.2;
  }

  .event-marker {
    stroke: var(--color-seal, #8a5a1a);
    stroke-width: 1;
    stroke-dasharray: 2 2;
    opacity: 0.72;
    vector-effect: non-scaling-stroke;
  }

  .event-head {
    fill: var(--color-seal, #8a5a1a);
  }

  .moment-trend {
    fill: none;
    stroke: var(--color-ink, #1a1917);
    stroke-width: 1.4;
    stroke-linecap: round;
    stroke-linejoin: round;
    vector-effect: non-scaling-stroke;
  }

  .moment-point {
    fill: var(--color-card, #fff);
    stroke: var(--color-ink, #1a1917);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  @media (max-width: 760px) {
    .micro {
      width: 72px;
      min-width: 64px;
    }
  }

  @media (forced-colors: active) {
    .chamber-guide,
    .state-guide,
    .topic-baseline,
    .moment-baseline,
    .event-marker,
    .moment-trend,
    .moment-point,
    .legislator-mark.unknown {
      stroke: CanvasText;
    }

    .legislator-mark.democratic,
    .legislator-mark.republican,
    .legislator-mark.independent,
    .state-cell,
    .topic-segment,
    .event-head {
      fill: CanvasText;
    }

    .moment-point,
    .legislator-mark.unknown {
      fill: Canvas;
    }
  }

  @media print {
    .micro {
      opacity: 1;
    }
  }
</style>