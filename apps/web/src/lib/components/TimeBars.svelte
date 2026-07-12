<script lang="ts">
  import { compact } from '$lib/format';

  type Row = Record<string, unknown>;

  interface Props {
    rows?: unknown[];
    dateKey?: string;
    valueKey?: string;
    label?: string;
    maxBars?: number;

    caption?: string;
    valueLabel?: string;
    valueLabelSingular?: string;
    maxValue?: number | null;
    showSummary?: boolean;
    showAxis?: boolean;
    showTable?: boolean;
    emptyMessage?: string;
  }

  interface DatePoint {
    key: string;
    raw: string;
    timestamp: number | null;
    precision: 'month' | 'day' | 'datetime' | 'text';
    label: string;
    shortLabel: string;
  }

  interface AggregatedPoint {
    key: string;
    date: DatePoint;
    value: number;
    sourceRows: number;
  }

  interface PlotInterval {
    key: string;
    start: DatePoint;
    end: DatePoint;
    label: string;
    shortLabel: string;
    value: number;
    sourceRows: number;
    sourceIntervals: number;
  }

  let {
    rows = [],
    dateKey = 'date',
    valueKey = 'post_count',
    label = 'Posts over time',
    maxBars = 72,
    caption = '',
    valueLabel = 'posts',
    valueLabelSingular = 'post',
    maxValue = null,
    showSummary = true,
    showAxis = true,
    showTable = true,
    emptyMessage = 'No dated activity is available.'
  }: Props = $props();

  const monthFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });

  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });

  const shortDayFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
    timeZone: 'UTC'
  });

  const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC'
  });

  const safeRows = $derived(Array.isArray(rows) ? rows : []);

  const safeDateKey = $derived(cleanText(dateKey) ?? 'date');
  const safeValueKey = $derived(cleanText(valueKey) ?? 'post_count');

  const safeMaxBars = $derived(
    Number.isFinite(maxBars)
      ? Math.min(365, Math.max(1, Math.trunc(maxBars)))
      : 72
  );

  const series = $derived.by(() =>
    aggregateRows(safeRows, safeDateKey, safeValueKey)
  );

  const plotted = $derived.by(() =>
    createPlotIntervals(series, safeMaxBars)
  );

  const validSourceRows = $derived(
    series.reduce((total, point) => total + point.sourceRows, 0)
  );

  const omittedRows = $derived(
    Math.max(0, safeRows.length - validSourceRows)
  );

  const totalValue = $derived(
    plotted.reduce((total, interval) => total + interval.value, 0)
  );

  const observedMaximum = $derived(
    plotted.reduce(
      (maximum, interval) => Math.max(maximum, interval.value),
      0
    )
  );

  const scaleMaximum = $derived(
    Math.max(1, observedMaximum, normalizeValue(maxValue))
  );

  const peakInterval = $derived.by(() => {
    let peak: PlotInterval | null = null;

    for (const interval of plotted) {
      if (!peak || interval.value > peak.value) {
        peak = interval;
      }
    }

    return peak;
  });

  const firstInterval = $derived(plotted[0] ?? null);

  const middleInterval = $derived(
    plotted.length > 2
      ? plotted[Math.floor((plotted.length - 1) / 2)]
      : null
  );

  const lastInterval = $derived(
    plotted.length > 1 ? plotted[plotted.length - 1] : null
  );

  const wasCondensed = $derived(series.length > plotted.length);

  const generatedCaption = $derived.by(() => {
    const intervalText = wasCondensed
      ? `${series.length.toLocaleString()} intervals combined into ${plotted.length.toLocaleString()} contiguous bins`
      : `${plotted.length.toLocaleString()} plotted ${
          plotted.length === 1 ? 'interval' : 'intervals'
        }`;

    const sourceText = `${validSourceRows.toLocaleString()} dated source ${
      validSourceRows === 1 ? 'row' : 'rows'
    }`;

    const omittedText =
      omittedRows > 0
        ? `; ${omittedRows.toLocaleString()} ${
            omittedRows === 1 ? 'row was' : 'rows were'
          } omitted because no usable date was available`
        : '';

    return `${intervalText} from ${sourceText}${omittedText}.`;
  });

  const displayedCaption = $derived(
    cleanText(caption) ?? generatedCaption
  );

  const chartDescription = $derived.by(() => {
    if (!plotted.length) {
      return `${label}. No dated activity is available.`;
    }

    const range =
      firstInterval && lastInterval
        ? `${firstInterval.start.label} through ${lastInterval.end.label}`
        : firstInterval?.label ?? 'unknown dates';

    const peak = peakInterval
      ? ` Peak interval: ${peakInterval.label}, ${exactValue(
          peakInterval.value
        )} ${unitLabel(peakInterval.value)}.`
      : '';

    return `${label}. ${exactValue(totalValue)} ${unitLabel(
      totalValue
    )} from ${range}.${peak}`;
  });

  function isRow(value: unknown): value is Row {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    );
  }

  function cleanText(value: unknown): string | null {
    if (typeof value !== 'string' && typeof value !== 'number') {
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
      if (value !== null && value !== undefined && value !== '') {
        return value;
      }
    }

    return null;
  }

  function normalizeValue(value: unknown): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const number =
      typeof value === 'number' ? value : Number(value);

    return Number.isFinite(number) ? Math.max(0, number) : 0;
  }

  function parseDate(value: unknown): DatePoint | null {
    const raw = cleanText(value);

    if (!raw) {
      return null;
    }

    let timestamp: number | null = null;
    let precision: DatePoint['precision'] = 'text';

    if (/^\d{4}-\d{2}$/.test(raw)) {
      precision = 'month';

      const parsed = Date.parse(`${raw}-01T00:00:00.000Z`);
      timestamp = Number.isFinite(parsed) ? parsed : null;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      precision = 'day';

      const parsed = Date.parse(`${raw}T00:00:00.000Z`);
      timestamp = Number.isFinite(parsed) ? parsed : null;
    } else {
      const parsed = Date.parse(raw);

      if (Number.isFinite(parsed)) {
        timestamp = parsed;
        precision = /T|\d{1,2}:\d{2}/.test(raw)
          ? 'datetime'
          : 'day';
      }
    }

    const date =
      timestamp === null ? null : new Date(timestamp);

    let fullLabel = raw;
    let shortLabel = raw;

    if (date) {
      if (precision === 'month') {
        fullLabel = monthFormatter.format(date);
        shortLabel = fullLabel;
      } else if (precision === 'datetime') {
        fullLabel = dateTimeFormatter.format(date);
        shortLabel = shortDayFormatter.format(date);
      } else {
        fullLabel = dayFormatter.format(date);
        shortLabel = shortDayFormatter.format(date);
      }
    }

    return {
      key:
        timestamp === null
          ? `text:${raw.toLocaleLowerCase()}`
          : `${precision}:${timestamp}`,
      raw,
      timestamp,
      precision,
      label: fullLabel,
      shortLabel
    };
  }

  function aggregateRows(
    input: unknown[],
    dateField: string,
    valueField: string
  ): AggregatedPoint[] {
    const grouped = new Map<string, AggregatedPoint>();

    for (const source of input) {
      if (!isRow(source)) {
        continue;
      }

      const date = parseDate(
        firstValue([
          source[dateField],
          source.month,
          source.date,
          source.period,
          source.createdAt,
          source.created_at
        ])
      );

      if (!date) {
        continue;
      }

      const value = normalizeValue(
        firstValue([
          source[valueField],
          source.post_count,
          source.postCount,
          source.count,
          source.value
        ])
      );

      const existing = grouped.get(date.key);

      if (existing) {
        existing.value += value;
        existing.sourceRows += 1;
      } else {
        grouped.set(date.key, {
          key: date.key,
          date,
          value,
          sourceRows: 1
        });
      }
    }

    return [...grouped.values()].sort(comparePoints);
  }

  function comparePoints(
    left: AggregatedPoint,
    right: AggregatedPoint
  ): number {
    if (
      left.date.timestamp !== null &&
      right.date.timestamp !== null
    ) {
      return (
        left.date.timestamp - right.date.timestamp ||
        left.date.raw.localeCompare(right.date.raw)
      );
    }

    if (left.date.timestamp !== null) {
      return -1;
    }

    if (right.date.timestamp !== null) {
      return 1;
    }

    return left.date.raw.localeCompare(right.date.raw);
  }

  function intervalLabel(
    start: DatePoint,
    end: DatePoint,
    short = false
  ): string {
    const startLabel = short ? start.shortLabel : start.label;
    const endLabel = short ? end.shortLabel : end.label;

    return start.key === end.key
      ? startLabel
      : `${startLabel}–${endLabel}`;
  }

  function makeInterval(
    points: AggregatedPoint[],
    index: number
  ): PlotInterval {
    const first = points[0];
    const last = points[points.length - 1];

    return {
      key: `${first.key}:${last.key}:${index}`,
      start: first.date,
      end: last.date,
      label: intervalLabel(first.date, last.date),
      shortLabel: intervalLabel(first.date, last.date, true),
      value: points.reduce((total, point) => total + point.value, 0),
      sourceRows: points.reduce(
        (total, point) => total + point.sourceRows,
        0
      ),
      sourceIntervals: points.length
    };
  }

  function createPlotIntervals(
    input: AggregatedPoint[],
    limit: number
  ): PlotInterval[] {
    if (!input.length) {
      return [];
    }

    if (input.length <= limit) {
      return input.map((point, index) =>
        makeInterval([point], index)
      );
    }

    const result: PlotInterval[] = [];

    for (let index = 0; index < limit; index += 1) {
      const start = Math.floor((index * input.length) / limit);
      const end = Math.floor(((index + 1) * input.length) / limit);
      const points = input.slice(start, Math.max(start + 1, end));

      if (points.length) {
        result.push(makeInterval(points, index));
      }
    }

    return result;
  }

  function barHeight(value: number): number {
    if (value <= 0 || scaleMaximum <= 0) {
      return 0;
    }

    return Math.min(100, (value / scaleMaximum) * 100);
  }

  function exactValue(value: number): string {
    return value.toLocaleString('en-US', {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2
    });
  }

  function compactValue(value: number): string {
    try {
      return compact(value);
    } catch {
      return exactValue(value);
    }
  }

  function unitLabel(value: number): string {
    return value === 1 ? valueLabelSingular : valueLabel;
  }

  function intervalDescription(interval: PlotInterval): string {
    const aggregation =
      interval.sourceIntervals > 1
        ? ` Aggregates ${interval.sourceIntervals.toLocaleString()} adjacent intervals.`
        : '';

    return `${interval.label}: ${exactValue(
      interval.value
    )} ${unitLabel(interval.value)}.${aggregation}`;
  }
</script>

<figure class="timebars">
  <figcaption>
    <div class="heading-copy">
      <h2>{label}</h2>
      <p class="caption">{displayedCaption}</p>
    </div>

    {#if showSummary && plotted.length}
      <dl class="summary">
        <div>
          <dt>Total</dt>
          <dd>
            <data value={String(totalValue)}>
              {compactValue(totalValue)}
            </data>
          </dd>
        </div>

        <div>
          <dt>Peak</dt>
          <dd>
            {#if peakInterval}
              <data
                value={String(peakInterval.value)}
                title={intervalDescription(peakInterval)}
              >
                {compactValue(peakInterval.value)}
              </data>
            {:else}
              —
            {/if}
          </dd>
        </div>
      </dl>
    {/if}
  </figcaption>

  {#if plotted.length}
    <div
      class="chart"
      role="img"
      aria-label={chartDescription}
    >
      <div class="plot-layout">
        {#if showAxis}
          <div class="y-axis" aria-hidden="true">
            <span>{compactValue(scaleMaximum)}</span>
            <span>{compactValue(scaleMaximum / 2)}</span>
            <span>0</span>
          </div>
        {/if}

        <div class="plot">
          <span class="guide top" aria-hidden="true"></span>
          <span class="guide middle" aria-hidden="true"></span>
          <span class="guide baseline" aria-hidden="true"></span>

          <div
            class="bars"
            style={`--bar-count:${plotted.length}`}
            aria-hidden="true"
          >
            {#each plotted as interval (interval.key)}
              <span
                class="bar-slot"
                class:zero={interval.value === 0}
                class:peak={
                  interval.value === observedMaximum &&
                  observedMaximum > 0
                }
                title={intervalDescription(interval)}
              >
                <span
                  class="bar-fill"
                  style={`--bar-height:${barHeight(interval.value)}%`}
                ></span>
              </span>
            {/each}
          </div>
        </div>
      </div>

      {#if showAxis}
        <div
          class="x-axis"
          class:single={plotted.length === 1}
          aria-hidden="true"
        >
          {#if firstInterval}
            <span>{firstInterval.start.shortLabel}</span>
          {/if}

          {#if middleInterval}
            <span>{middleInterval.shortLabel}</span>
          {/if}

          {#if lastInterval}
            <span>{lastInterval.end.shortLabel}</span>
          {/if}
        </div>
      {/if}
    </div>

    {#if wasCondensed}
      <p class="aggregation-note">
        Adjacent intervals were combined into contiguous bins.
        No post counts were discarded.
      </p>
    {/if}

    {#if showTable}
      <details class="data-disclosure">
        <summary>View plotted data</summary>

        <div
          class="table-scroll"
          role="region"
          aria-label={`${label} data table`}
        >
          <table>
            <caption class="visually-hidden">
              Exact plotted values for {label}
            </caption>

            <thead>
              <tr>
                <th scope="col">Interval</th>
                <th scope="col" class="numeric">{valueLabel}</th>
                <th scope="col" class="numeric">Source intervals</th>
                <th scope="col" class="numeric">Source rows</th>
              </tr>
            </thead>

            <tbody>
              {#each plotted as interval (interval.key)}
                <tr>
                  <th scope="row">{interval.label}</th>
                  <td class="numeric">
                    <data value={String(interval.value)}>
                      {exactValue(interval.value)}
                    </data>
                  </td>
                  <td class="numeric">
                    {interval.sourceIntervals.toLocaleString()}
                  </td>
                  <td class="numeric">
                    {interval.sourceRows.toLocaleString()}
                  </td>
                </tr>
              {/each}
            </tbody>

            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td class="numeric">{exactValue(totalValue)}</td>
                <td class="numeric">{series.length.toLocaleString()}</td>
                <td class="numeric">{validSourceRows.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>
    {/if}
  {:else}
    <p class="empty-state" role="status">
      {emptyMessage}
    </p>
  {/if}
</figure>

<style>
  .timebars {
    min-width: 0;
    padding: 16px;
    margin: 0;
    color: var(--color-ink, #1a1917);
    background: var(--color-card, #fff);
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  figcaption {
    display: flex;
    gap: 18px;
    align-items: flex-start;
    justify-content: space-between;
    min-width: 0;
    margin-bottom: 16px;
  }

  .heading-copy {
    min-width: 0;
    max-width: 72ch;
  }

  h2 {
    margin: 0;
    font-size: clamp(1.15rem, 1.06rem + 0.28vw, 1.4rem);
    line-height: 1.25;
    letter-spacing: -0.01em;
  }

  .caption {
    margin: 4px 0 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.82rem;
    line-height: 1.3rem;
  }

  .summary {
    display: flex;
    gap: 18px;
    flex: 0 0 auto;
    margin: 0;
  }

  .summary > div {
    display: grid;
    gap: 1px;
    min-width: 52px;
  }

  .summary dt,
  .summary dd {
    margin: 0;
  }

  .summary dt {
    color: var(--color-mute, #6b6659);
    font-size: 0.65rem;
    font-weight: 600;
    line-height: 0.95rem;
    letter-spacing: 0.055em;
    text-transform: uppercase;
  }

  .summary dd {
    color: var(--color-ink, #1a1917);
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.82rem;
    font-weight: 650;
    line-height: 1.1rem;
    font-variant-numeric: tabular-nums;
  }

  .chart {
    min-width: 0;
  }

  .plot-layout {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 8px;
    min-width: 0;
  }

  .y-axis {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding-bottom: 1px;
    color: var(--color-mute-soft, #9c9787);
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.62rem;
    line-height: 1;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .plot {
    position: relative;
    min-width: 0;
    height: 168px;
    border-left: 1px solid var(--color-rule, #d9d2c1);
  }

  .guide {
    position: absolute;
    right: 0;
    left: 0;
    z-index: 0;
    height: 1px;
    background: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 72%,
      transparent
    );
    pointer-events: none;
  }

  .guide.top {
    top: 0;
  }

  .guide.middle {
    top: 50%;
  }

  .guide.baseline {
    bottom: 0;
    background: var(--color-rule, #d9d2c1);
  }

  .bars {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(
      var(--bar-count),
      minmax(2px, 1fr)
    );
    gap: clamp(1px, 0.2vw, 3px);
    align-items: end;
    padding-inline: 3px;
  }

  .bar-slot {
    display: flex;
    align-items: flex-end;
    width: 100%;
    height: 100%;
    min-width: 0;
    background: color-mix(
      in srgb,
      var(--color-track, #ece8df) 44%,
      transparent
    );
    border-radius: 2px 2px 0 0;
  }

  .bar-slot:hover {
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 8%,
      var(--color-card, #fff)
    );
  }

  .bar-fill {
    width: 100%;
    height: var(--bar-height);
    min-height: 1px;
    background: var(--color-seal, #8a5a1a);
    border-radius: 2px 2px 0 0;
    transition:
      height 220ms ease-out,
      background-color 120ms ease;
  }

  .bar-slot:hover .bar-fill {
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 82%,
      var(--color-ink, #1a1917)
    );
  }

  .bar-slot.zero .bar-fill {
    height: 0;
    min-height: 0;
  }

  .bar-slot.peak .bar-fill {
    box-shadow: inset 0 2px 0
      color-mix(
        in srgb,
        var(--color-ink, #1a1917) 35%,
        transparent
      );
  }

  .x-axis {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 8px;
    min-width: 0;
    padding-top: 7px;
    margin-left: 37px;
    color: var(--color-mute, #6b6659);
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.63rem;
    line-height: 1rem;
    font-variant-numeric: tabular-nums;
  }

  .x-axis span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .x-axis span:first-child {
    text-align: left;
  }

  .x-axis span:nth-child(2) {
    text-align: center;
  }

  .x-axis span:last-child {
    text-align: right;
  }

  .x-axis.single {
    display: block;
  }

  .aggregation-note {
    margin: 8px 0 0;
    color: var(--color-mute-soft, #9c9787);
    font-size: 0.7rem;
    line-height: 1.1rem;
  }

  .data-disclosure {
    margin-top: 13px;
    border-top: 1px solid var(--color-rule, #d9d2c1);
  }

  .data-disclosure summary {
    width: fit-content;
    padding: 10px 2px 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
  }

  .data-disclosure summary:hover {
    color: var(--color-seal, #8a5a1a);
  }

  .data-disclosure summary:focus-visible,
  .table-scroll:focus-visible {
    outline: 2px solid var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .table-scroll {
    max-width: 100%;
    margin-top: 10px;
    overflow: auto;
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  table {
    width: 100%;
    min-width: 520px;
    border-spacing: 0;
    border-collapse: separate;
    font-size: 0.76rem;
    line-height: 1.1rem;
  }

  th,
  td {
    padding: 8px 10px;
    text-align: left;
    border-right: 1px solid var(--color-rule, #d9d2c1);
    border-bottom: 1px solid var(--color-rule, #d9d2c1);
  }

  th:last-child,
  td:last-child {
    border-right: 0;
  }

  thead th {
    color: var(--color-mute, #6b6659);
    font-size: 0.66rem;
    font-weight: 600;
    letter-spacing: 0.045em;
    text-transform: uppercase;
    background: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 16%,
      var(--color-card, #fff)
    );
  }

  tbody th {
    font-weight: 500;
  }

  tbody tr:last-child th,
  tbody tr:last-child td {
    border-bottom: 0;
  }

  tfoot th,
  tfoot td {
    font-weight: 650;
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 6%,
      var(--color-card, #fff)
    );
    border-top: 1px solid var(--color-rule, #d9d2c1);
    border-bottom: 0;
  }

  .numeric {
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-variant-numeric: tabular-nums;
    text-align: right;
    white-space: nowrap;
  }

  .empty-state {
    min-height: 100px;
    padding: 28px 18px;
    margin: 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.84rem;
    line-height: 1.35rem;
    text-align: center;
    border: 1px dashed var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 640px) {
    .timebars {
      padding: 14px 12px;
    }

    figcaption {
      display: grid;
      gap: 10px;
    }

    .plot {
      height: 150px;
    }

    .x-axis {
      grid-template-columns: 1fr 1fr;
      margin-left: 33px;
    }

    .x-axis span:nth-child(2) {
      display: none;
    }
  }

  @media (max-width: 400px) {
    .plot {
      height: 138px;
    }

    .bars {
      gap: 1px;
      padding-inline: 2px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .bar-fill {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .timebars,
    .table-scroll,
    th,
    td,
    .bar-slot,
    .empty-state {
      color: CanvasText;
      background: Canvas;
      border-color: CanvasText;
    }

    .guide {
      background: CanvasText;
    }

    .bar-fill {
      background: Highlight;
    }

    .data-disclosure summary:focus-visible,
    .table-scroll:focus-visible {
      outline-color: Highlight;
    }
  }

  @media print {
    .timebars {
      color: #000;
      background: transparent;
      border-color: #999;
      break-inside: avoid;
    }

    .plot {
      height: 130px;
    }

    .bar-fill {
      background: #555;
      print-color-adjust: exact;
    }

    .data-disclosure {
      display: none;
    }
  }
</style>
