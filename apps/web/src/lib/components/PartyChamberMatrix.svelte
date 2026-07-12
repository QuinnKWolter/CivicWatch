<script lang="ts">
  import { compact } from '$lib/format';

  type KnownParty =
    | 'Democratic'
    | 'Republican'
    | 'Independent'
    | 'unknown';

  type KnownChamber =
    | 'H'
    | 'S'
    | 'unknown';

  interface Props {
    rows?: any[];
    title?: string;
    caption?: string;
    valueLabel?: string;
    valueLabelSingular?: string;
    maxValue?: number | null;
    showTotals?: boolean;
    showSummary?: boolean;
    emptyMessage?: string;
    formatValue?: (
      value: number,
      context: {
        party: string;
        chamber: string;
      }
    ) => string;
  }

  interface NormalizedRow {
    party: string;
    chamber: string;
    value: number;
  }

  interface MatrixCell {
    party: string;
    chamber: string;
    value: number;
  }

  interface MatrixRow {
    party: string;
    cells: MatrixCell[];
    total: number;
  }

  let {
    rows = [],
    title = 'Party by chamber',
    caption = 'Post count by party and chamber for this topic. Unknown values remain visible.',
    valueLabel = 'posts',
    valueLabelSingular = 'post',
    maxValue = null,
    showTotals = true,
    showSummary = true,
    emptyMessage = 'No party-by-chamber data is available.',
    formatValue
  }: Props = $props();

  const collator = new Intl.Collator('en-US', {
    sensitivity: 'base',
    numeric: true
  });

  const STANDARD_PARTIES: KnownParty[] = [
    'Democratic',
    'Republican',
    'Independent'
  ];

  const STANDARD_CHAMBERS: KnownChamber[] = [
    'H',
    'S'
  ];

  const normalizedRows = $derived.by(() =>
    rows
      .map(normalizeRow)
      .filter(
        (
          row
        ): row is NormalizedRow => row !== null
      )
  );

  const partyKeys = $derived.by(() => {
    const present = new Set(
      normalizedRows.map((row) => row.party)
    );

    const extras = [...present]
      .filter(
        (party) =>
          !STANDARD_PARTIES.includes(
            party as KnownParty
          ) &&
          party !== 'unknown'
      )
      .sort(collator.compare);

    return [
      ...STANDARD_PARTIES,
      ...extras,
      'unknown'
    ];
  });

  const chamberKeys = $derived.by(() => {
    const present = new Set(
      normalizedRows.map((row) => row.chamber)
    );

    const extras = [...present]
      .filter(
        (chamber) =>
          !STANDARD_CHAMBERS.includes(
            chamber as KnownChamber
          ) &&
          chamber !== 'unknown'
      )
      .sort(collator.compare);

    return [
      ...STANDARD_CHAMBERS,
      ...extras,
      'unknown'
    ];
  });

  const lookup = $derived.by(() => {
    const values = new Map<string, number>();

    for (const row of normalizedRows) {
      const key = cellKey(
        row.party,
        row.chamber
      );

      values.set(
        key,
        (values.get(key) ?? 0) + row.value
      );
    }

    return values;
  });

  const matrixRows = $derived.by(
    (): MatrixRow[] =>
      partyKeys.map((party) => {
        const cells = chamberKeys.map(
          (chamber): MatrixCell => ({
            party,
            chamber,
            value:
              lookup.get(
                cellKey(party, chamber)
              ) ?? 0
          })
        );

        return {
          party,
          cells,
          total: cells.reduce(
            (sum, cell) => sum + cell.value,
            0
          )
        };
      })
  );

  const columnTotals = $derived(
    chamberKeys.map((chamber) =>
      matrixRows.reduce(
        (sum, row) =>
          sum +
          (row.cells.find(
            (cell) =>
              cell.chamber === chamber
          )?.value ?? 0),
        0
      )
    )
  );

  const grandTotal = $derived(
    columnTotals.reduce(
      (sum, value) => sum + value,
      0
    )
  );

  const populatedCellCount = $derived(
    [...lookup.values()].filter(
      (value) => value > 0
    ).length
  );

  const observedMaximum = $derived(
    Math.max(0, ...lookup.values())
  );

  const scaleMaximum = $derived(
    Math.max(
      1,
      observedMaximum,
      finiteNonNegative(maxValue)
    )
  );

  const hasData = $derived(
    normalizedRows.length > 0
  );

  function cellKey(
    party: string,
    chamber: string
  ): string {
    return `${party}\u0000${chamber}`;
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

  function normalizeParty(
    value: unknown
  ): string {
    const party = cleanText(value);

    if (!party) return 'unknown';

    const normalized =
      party.toLocaleLowerCase();

    if (
      normalized === 'd' ||
      normalized === 'dem' ||
      normalized === 'democrat' ||
      normalized === 'democratic'
    ) {
      return 'Democratic';
    }

    if (
      normalized === 'r' ||
      normalized === 'rep' ||
      normalized === 'republican'
    ) {
      return 'Republican';
    }

    if (
      normalized === 'i' ||
      normalized === 'ind' ||
      normalized === 'independent'
    ) {
      return 'Independent';
    }

    if (
      normalized === 'unknown' ||
      normalized === 'unavailable' ||
      normalized === 'unclassified'
    ) {
      return 'unknown';
    }

    return party;
  }

  function normalizeChamber(
    value: unknown
  ): string {
    const chamber = cleanText(value);

    if (!chamber) return 'unknown';

    const normalized =
      chamber.toLocaleLowerCase();

    if (
      normalized === 'h' ||
      normalized === 'house' ||
      normalized === 'lower' ||
      normalized === 'lower chamber'
    ) {
      return 'H';
    }

    if (
      normalized === 's' ||
      normalized === 'senate' ||
      normalized === 'upper' ||
      normalized === 'upper chamber'
    ) {
      return 'S';
    }

    if (
      normalized === 'unknown' ||
      normalized === 'unavailable' ||
      normalized === 'unclassified'
    ) {
      return 'unknown';
    }

    return chamber;
  }

  function normalizeRow(
    row: any
  ): NormalizedRow | null {
    if (
      !row ||
      typeof row !== 'object' ||
      Array.isArray(row)
    ) {
      return null;
    }

    const rawValue =
      row.post_count ??
      row.postCount ??
      row.count ??
      row.value;

    return {
      party: normalizeParty(row.party),
      chamber: normalizeChamber(
        row.chamber
      ),
      value: finiteNonNegative(rawValue)
    };
  }

  function partyLabel(
    party: string
  ): string {
    return party === 'unknown'
      ? 'Party unknown'
      : party;
  }

  function chamberLabel(
    chamber: string
  ): string {
    if (chamber === 'H') return 'House';
    if (chamber === 'S') return 'Senate';

    return chamber === 'unknown'
      ? 'Chamber unknown'
      : chamber;
  }

  function partyClass(
    party: string
  ): string {
    if (party === 'Democratic') {
      return 'democratic';
    }

    if (party === 'Republican') {
      return 'republican';
    }

    if (party === 'Independent') {
      return 'independent';
    }

    if (party === 'unknown') {
      return 'unknown';
    }

    return 'other';
  }

  function barScale(
    value: number
  ): number {
    if (value <= 0) return 0;

    return Math.min(
      1,
      value / scaleMaximum
    );
  }

  function displayValue(
    value: number,
    party: string,
    chamber: string
  ): string {
    if (formatValue) {
      try {
        const formatted = formatValue(
          value,
          {
            party,
            chamber
          }
        );

        if (
          typeof formatted === 'string' &&
          formatted.trim()
        ) {
          return formatted;
        }
      } catch {
        // Fall back to CivicWatch's compact formatter.
      }
    }

    return compact(value);
  }

  function exactValue(
    value: number
  ): string {
    return value.toLocaleString('en-US', {
      maximumFractionDigits:
        Number.isInteger(value) ? 0 : 2
    });
  }

  function unitLabel(
    value: number
  ): string {
    return value === 1
      ? valueLabelSingular
      : valueLabel;
  }

  function cellDescription(
    cell: MatrixCell
  ): string {
    return `${partyLabel(
      cell.party
    )}, ${chamberLabel(
      cell.chamber
    )}: ${exactValue(
      cell.value
    )} ${unitLabel(cell.value)}`;
  }
</script>

<figure class="matrix">
  <figcaption>
    <h2>{title}</h2>

    {#if caption}
      <p class="caption">
        {caption}
      </p>
    {/if}

    {#if showSummary && hasData}
      <p class="summary">
        <span>
          {exactValue(grandTotal)}
          {unitLabel(grandTotal)}
        </span>

        <span aria-hidden="true">·</span>

        <span>
          {populatedCellCount.toLocaleString()}
          populated
          {populatedCellCount === 1
            ? 'combination'
            : 'combinations'}
        </span>
      </p>
    {/if}
  </figcaption>

  {#if hasData}
    <div
      class="table-scroll"
      role="region"
      aria-label="Scrollable party-by-chamber matrix"
    >
      <table>
        <caption class="visually-hidden">
          {title}. {caption}
        </caption>

        <thead>
          <tr>
            <th
              scope="col"
              class="party-heading sticky-column"
            >
              Party
            </th>

            {#each chamberKeys as chamber (chamber)}
              <th scope="col">
                <span class="column-label">
                  {chamberLabel(chamber)}
                </span>
              </th>
            {/each}

            {#if showTotals}
              <th
                scope="col"
                class="total-heading"
              >
                Total
              </th>
            {/if}
          </tr>
        </thead>

        <tbody>
          {#each matrixRows as row (row.party)}
            <tr>
              <th
                scope="row"
                class="sticky-column"
              >
                <span class="party-label">
                  <span
                    class={`party-mark ${partyClass(
                      row.party
                    )}`}
                    aria-hidden="true"
                  ></span>

                  <span>
                    {partyLabel(row.party)}
                  </span>
                </span>
              </th>

              {#each row.cells as cell (cell.chamber)}
                <td
                  aria-label={cellDescription(
                    cell
                  )}
                >
                  <div
                    class:zero={
                      cell.value === 0
                    }
                    class="matrix-cell"
                  >
                    <span
                      class={`cell-track ${partyClass(
                        row.party
                      )}`}
                      aria-hidden="true"
                    >
                      <span
                        class="cell-fill"
                        style={`--cell-scale:${barScale(
                          cell.value
                        )}`}
                      ></span>
                    </span>

                    <data
                      value={String(
                        cell.value
                      )}
                      title={cellDescription(
                        cell
                      )}
                    >
                      {displayValue(
                        cell.value,
                        cell.party,
                        cell.chamber
                      )}
                    </data>
                  </div>
                </td>
              {/each}

              {#if showTotals}
                <td
                  class="total-cell"
                  aria-label={`${partyLabel(
                    row.party
                  )} total: ${exactValue(
                    row.total
                  )} ${unitLabel(row.total)}`}
                >
                  <data value={String(row.total)}>
                    {displayValue(
                      row.total,
                      row.party,
                      'total'
                    )}
                  </data>
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>

        {#if showTotals}
          <tfoot>
            <tr>
              <th
                scope="row"
                class="sticky-column"
              >
                Total
              </th>

              {#each columnTotals as total, index}
                <td
                  aria-label={`${chamberLabel(
                    chamberKeys[index]
                  )} total: ${exactValue(
                    total
                  )} ${unitLabel(total)}`}
                >
                  <data value={String(total)}>
                    {displayValue(
                      total,
                      'total',
                      chamberKeys[index]
                    )}
                  </data>
                </td>
              {/each}

              <td
                class="grand-total"
                aria-label={`Overall total: ${exactValue(
                  grandTotal
                )} ${unitLabel(grandTotal)}`}
              >
                <data
                  value={String(grandTotal)}
                >
                  {displayValue(
                    grandTotal,
                    'total',
                    'total'
                  )}
                </data>
              </td>
            </tr>
          </tfoot>
        {/if}
      </table>
    </div>

    <p class="scale-note">
      Cell bars use a shared scale with a maximum
      of {exactValue(scaleMaximum)}
      {unitLabel(scaleMaximum)}.
    </p>
  {:else}
    <p class="empty-state" role="status">
      {emptyMessage}
    </p>
  {/if}
</figure>

<style>
  .matrix {
    min-width: 0;
    padding: 16px;
    margin: 0;
    color: var(--color-ink, #1a1917);
    background: var(--color-card, #fff);
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  figcaption {
    max-width: 76ch;
    margin-bottom: 14px;
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
    margin: 4px 0 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.875rem;
    line-height: 1.4rem;
  }

  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 8px;
    align-items: center;
    margin: 7px 0 0;
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
  }

  .table-scroll {
    max-width: 100%;
    overflow-x: auto;
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
    outline: none;
    overscroll-behavior-inline: contain;
    scrollbar-width: thin;
  }

  .table-scroll:focus-visible {
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  table {
    width: 100%;
    min-width: 600px;
    border-spacing: 0;
    border-collapse: separate;
    font-size: 0.8125rem;
    line-height: 1.15rem;
  }

  th,
  td {
    min-width: 108px;
    padding: 8px;
    text-align: left;
    vertical-align: middle;
    background: var(--color-card, #fff);
    border-right: 1px solid
      var(--color-rule, #d9d2c1);
    border-bottom: 1px solid
      var(--color-rule, #d9d2c1);
  }

  th:last-child,
  td:last-child {
    border-right: 0;
  }

  tbody tr:last-child th,
  tbody tr:last-child td {
    border-bottom: 0;
  }

  tfoot th,
  tfoot td {
    border-top: 1px solid
      var(--color-rule, #d9d2c1);
    border-bottom: 0;
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 3;
    min-height: 42px;
    color: var(--color-mute, #6b6659);
    font-size: 0.7rem;
    font-weight: 600;
    line-height: 1rem;
    letter-spacing: 0.055em;
    text-transform: uppercase;
  }

  .party-heading,
  tbody th,
  tfoot th {
    min-width: 154px;
  }

  .sticky-column {
    position: sticky;
    left: 0;
    z-index: 2;
    box-shadow: 1px 0 0
      var(--color-rule, #d9d2c1);
  }

  thead .sticky-column {
    z-index: 4;
  }

  .column-label {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .party-label {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }

  .party-label > span:last-child {
    overflow-wrap: anywhere;
  }

  .party-mark {
    display: inline-block;
    width: 9px;
    height: 9px;
    background: var(
      --color-mute-soft,
      #9c9787
    );
    flex: 0 0 auto;
  }

  .party-mark.democratic {
    background: var(
      --color-ballot-blue,
      #274b6e
    );
    border-radius: 50%;
  }

  .party-mark.republican {
    background: var(
      --color-ballot-red,
      #a13530
    );
  }

  .party-mark.independent {
    background: var(
      --color-independent,
      #7a6a4a
    );
    transform: rotate(45deg);
  }

  .party-mark.unknown {
    background: transparent;
    border: 1px solid
      var(--color-mute-soft, #9c9787);
    border-radius: 50%;
  }

  .party-mark.other {
    border-radius: 2px 50% 50% 2px;
  }

  .matrix-cell {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  .cell-track {
    position: relative;
    display: block;
    width: 100%;
    height: 9px;
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

  .cell-fill {
    position: absolute;
    inset: -1px;
    background: var(--color-seal, #8a5a1a);
    border-radius: inherit;
    transform: scaleX(var(--cell-scale));
    transform-origin: left center;
    transition: transform 220ms ease-out;
    will-change: transform;
  }

  .cell-track.democratic .cell-fill {
    background: var(
      --color-ballot-blue,
      #274b6e
    );
  }

  .cell-track.republican .cell-fill {
    background: var(
      --color-ballot-red,
      #a13530
    );
  }

  .cell-track.independent .cell-fill {
    background: var(
      --color-independent,
      #7a6a4a
    );
  }

  .cell-track.unknown .cell-fill {
    background: var(
      --color-mute-soft,
      #9c9787
    );
  }

  .matrix-cell data,
  .total-cell data,
  tfoot data {
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
    font-size: 0.76rem;
    font-variant-numeric: tabular-nums;
  }

  .matrix-cell.zero data {
    color: var(--color-mute-soft, #9c9787);
  }

  .total-heading,
  .total-cell,
  tfoot th,
  tfoot td {
    background: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 18%,
      var(--color-card, #fff)
    );
  }

  .total-cell data,
  tfoot data,
  tfoot th {
    font-weight: 600;
  }

  .grand-total {
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 7%,
      var(--color-card, #fff)
    );
  }

  .scale-note {
    margin: 8px 0 0;
    color: var(
      --color-mute-soft,
      #9c9787
    );
    font-size: 0.7rem;
    line-height: 1.1rem;
  }

  .empty-state {
    min-height: 80px;
    padding: 20px;
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
    .matrix {
      padding: 14px 12px;
    }

    table {
      min-width: 560px;
    }

    th,
    td {
      min-width: 96px;
      padding: 7px;
    }

    .party-heading,
    tbody th,
    tfoot th {
      min-width: 136px;
    }

    .cell-track {
      height: 8px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cell-fill {
      transition: none;
      will-change: auto;
    }
  }

  @media (forced-colors: active) {
    .matrix,
    .table-scroll,
    table,
    th,
    td,
    .cell-track,
    .empty-state {
      color: CanvasText;
      background: Canvas;
      border-color: CanvasText;
    }

    .cell-fill,
    .party-mark {
      background: Highlight;
    }

    .party-mark.unknown {
      background: Canvas;
      border-color: CanvasText;
    }

    .table-scroll:focus-visible {
      outline-color: Highlight;
    }
  }

  @media print {
    .matrix {
      color: #000;
      background: transparent;
      border-color: #999;
      break-inside: avoid;
    }

    .table-scroll {
      overflow: visible;
      border-color: #999;
    }

    table {
      min-width: 0;
    }

    .sticky-column,
    thead th {
      position: static;
      box-shadow: none;
    }

    .cell-fill {
      print-color-adjust: exact;
    }
  }
</style>
