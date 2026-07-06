<script lang="ts">
  import { pct } from '$lib/format';

  type SortMode =
    | 'absolute'
    | 'over'
    | 'under'
    | 'topic';

  interface Props {
    rows?: unknown[];

    title?: string;
    caption?: string;
    ariaLabel?: string;

    hrefPrefix?: string | null;
    selectedTopic?: string | number | null;

    limit?: number | null;
    sort?: SortMode;

    /**
     * Optional shared scale maximum.
     *
     * Values are proportions, so 0.1 represents
     * a difference of 10 percentage points.
     */
    maxDeviation?: number | null;

    showLegend?: boolean;
    showSummary?: boolean;
    showTable?: boolean;
    showRank?: boolean;

    emptyMessage?: string;
  }

  interface FingerprintRow {
    key: string;
    topic: string | null;
    topicLabel: string;

    selfShare: number | null;
    partyMedianShare: number | null;
    deviation: number;

    postsInTopic: number | null;

    href: string | null;
    sourceIndex: number;
  }

  let {
    rows = [],
    title = 'Voice fingerprint',
    caption = 'Percentage-point difference between this legislator’s topic share and the party median. Bars left are under-indexed; bars right are over-indexed.',
    ariaLabel = 'Topic deviations from the party median',
    hrefPrefix = '/topic/',
    selectedTopic = null,
    limit = 14,
    sort = 'absolute',
    maxDeviation = null,
    showLegend = true,
    showSummary = true,
    showTable = true,
    showRank = false,
    emptyMessage = 'No topic-comparison data is available.'
  }: Props = $props();

  const instanceId = $props.id();
  const descriptionId = `${instanceId}-description`;

  const collator = new Intl.Collator('en-US', {
    sensitivity: 'base',
    numeric: true
  });

  const percentagePointFormatter =
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });

  const safeRows = $derived(
    Array.isArray(rows) ? rows : []
  );

  const safeHrefPrefix = $derived(
    normalizeHrefPrefix(hrefPrefix)
  );

  const safeLimit = $derived(
    limit === null
      ? Number.POSITIVE_INFINITY
      : Number.isFinite(limit)
        ? Math.max(0, Math.trunc(limit))
        : 14
  );

  const normalizedSelectedTopic = $derived(
    cleanText(selectedTopic)?.toLocaleLowerCase() ??
      null
  );

  const normalizedRows = $derived.by(() =>
    safeRows
      .map((row, index) =>
        normalizeRow(row, index)
      )
      .filter(
        (
          row
        ): row is FingerprintRow =>
          row !== null
      )
  );

  const orderedRows = $derived.by(() => {
    const result = [...normalizedRows];

    result.sort((left, right) => {
      if (sort === 'over') {
        return (
          right.deviation -
            left.deviation ||
          collator.compare(
            left.topicLabel,
            right.topicLabel
          )
        );
      }

      if (sort === 'under') {
        return (
          left.deviation -
            right.deviation ||
          collator.compare(
            left.topicLabel,
            right.topicLabel
          )
        );
      }

      if (sort === 'topic') {
        return collator.compare(
          left.topicLabel,
          right.topicLabel
        );
      }

      return (
        Math.abs(right.deviation) -
          Math.abs(left.deviation) ||
        collator.compare(
          left.topicLabel,
          right.topicLabel
        )
      );
    });

    return result;
  });

  const visibleRows = $derived(
    orderedRows.slice(0, safeLimit)
  );

  const hiddenCount = $derived(
    Math.max(
      0,
      orderedRows.length -
        visibleRows.length
    )
  );

  const observedMaximum = $derived(
    normalizedRows.reduce(
      (maximum, row) =>
        Math.max(
          maximum,
          Math.abs(row.deviation)
        ),
      0
    )
  );

  const scaleMaximum = $derived(
    Math.max(
      0.01,
      observedMaximum,
      finiteAbsolute(maxDeviation)
    )
  );

  const mostDistinctive = $derived.by(
    (): FingerprintRow | null => {
      let result: FingerprintRow | null =
        null;

      for (const row of normalizedRows) {
        if (
          !result ||
          Math.abs(row.deviation) >
            Math.abs(result.deviation)
        ) {
          result = row;
        }
      }

      return result;
    }
  );

  const overIndexedCount = $derived(
    normalizedRows.filter(
      (row) => row.deviation > 0
    ).length
  );

  const underIndexedCount = $derived(
    normalizedRows.filter(
      (row) => row.deviation < 0
    ).length
  );

  const neutralCount = $derived(
    normalizedRows.filter(
      (row) => row.deviation === 0
    ).length
  );

  const invalidRowCount = $derived(
    Math.max(
      0,
      safeRows.length -
        normalizedRows.length
    )
  );

  const chartDescription = $derived.by(() => {
    if (!visibleRows.length) {
      return `${title}. No valid topic-comparison data is available.`;
    }

    const distinctive = mostDistinctive
      ? ` Most distinctive topic: ${mostDistinctive.topicLabel}, ${directionDescription(
          mostDistinctive.deviation
        )}.`
      : '';

    return `${title}. ${visibleRows.length.toLocaleString(
      'en-US'
    )} topics shown on a symmetric scale from ${formatDeviation(
      -scaleMaximum
    )} to ${formatDeviation(
      scaleMaximum
    )}.${distinctive}`;
  });

  function isRecord(
    value: unknown
  ): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    );
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
      /^(?:nan|na|n\/a|null|none|undefined)$/i.test(
        text
      )
    ) {
      return null;
    }

    return text;
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

  function finiteNumber(
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

    return Number.isFinite(number)
      ? number
      : null;
  }

  function finiteAbsolute(
    value: unknown
  ): number {
    const number = finiteNumber(value);

    return number === null
      ? 0
      : Math.abs(number);
  }

  function normalizeCount(
    value: unknown
  ): number | null {
    const number = finiteNumber(value);

    if (number === null) {
      return null;
    }

    return Math.max(
      0,
      Math.trunc(number)
    );
  }

  function normalizeHrefPrefix(
    value: string | null
  ): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const href = value.trim();

    if (!href) {
      return null;
    }

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

    return href;
  }

  function buildHref(
    topic: string | null
  ): string | null {
    if (!safeHrefPrefix || !topic) {
      return null;
    }

    return `${safeHrefPrefix}${encodeURIComponent(
      topic
    )}`;
  }

  function normalizeRow(
    value: unknown,
    sourceIndex: number
  ): FingerprintRow | null {
    if (!isRecord(value)) {
      return null;
    }

    const topic = cleanText(
      firstValue([
        value.topic,
        value.topicId,
        value.topic_id,
        value.slug
      ])
    );

    const topicLabel =
      cleanText(
        firstValue([
          value.topicLabel,
          value.topic_label,
          value.label,
          value.name
        ])
      ) ??
      (topic
        ? `Topic ${topic}`
        : 'Topic unknown');

    const selfShare = finiteNumber(
      firstValue([
        value.selfShare,
        value.self_share,
        value.share,
        value.topicShare,
        value.topic_share
      ])
    );

    const partyMedianShare =
      finiteNumber(
        firstValue([
          value.partyMedianShare,
          value.party_median_share,
          value.medianShare,
          value.median_share
        ])
      );

    const suppliedDeviation =
      finiteNumber(
        firstValue([
          value.deviation,
          value.difference,
          value.delta
        ])
      );

    const deviation =
      suppliedDeviation ??
      (selfShare !== null &&
      partyMedianShare !== null
        ? selfShare -
          partyMedianShare
        : null);

    if (deviation === null) {
      return null;
    }

    const identity =
      topic ??
      topicLabel.toLocaleLowerCase();

    return {
      key: `${identity}:${sourceIndex}`,
      topic,
      topicLabel,
      selfShare,
      partyMedianShare,
      deviation,
      postsInTopic: normalizeCount(
        firstValue([
          value.postsInTopic,
          value.posts_in_topic,
          value.postCount,
          value.post_count,
          value.posts
        ])
      ),
      href: buildHref(topic),
      sourceIndex
    };
  }

  function barScale(
    deviation: number
  ): number {
    if (
      deviation === 0 ||
      scaleMaximum <= 0
    ) {
      return 0;
    }

    return Math.min(
      1,
      Math.abs(deviation) /
        scaleMaximum
    );
  }

  function formatShare(
    value: number | null
  ): string {
    if (value === null) {
      return '—';
    }

    try {
      return pct(value, 1);
    } catch {
      return `${percentagePointFormatter.format(
        value * 100
      )}%`;
    }
  }

  function absolutePercentagePoints(
    value: number
  ): string {
    return `${percentagePointFormatter.format(
      Math.abs(value) * 100
    )} pp`;
  }

  function formatDeviation(
    value: number
  ): string {
    if (value === 0) {
      return '0.0 pp';
    }

    const sign =
      value > 0 ? '+' : '−';

    return `${sign}${absolutePercentagePoints(
      value
    )}`;
  }

  function directionLabel(
    deviation: number
  ): string {
    if (deviation > 0) {
      return 'Over-indexed';
    }

    if (deviation < 0) {
      return 'Under-indexed';
    }

    return 'At median';
  }

  function directionDescription(
    deviation: number
  ): string {
    if (deviation > 0) {
      return `${absolutePercentagePoints(
        deviation
      )} above the party median`;
    }

    if (deviation < 0) {
      return `${absolutePercentagePoints(
        deviation
      )} below the party median`;
    }

    return 'equal to the party median';
  }

  function exactPosts(
    value: number | null
  ): string {
    return value === null
      ? '—'
      : value.toLocaleString('en-US');
  }

  function isSelected(
    row: FingerprintRow
  ): boolean {
    if (!normalizedSelectedTopic) {
      return false;
    }

    return (
      row.topic?.toLocaleLowerCase() ===
        normalizedSelectedTopic ||
      row.topicLabel.toLocaleLowerCase() ===
        normalizedSelectedTopic
    );
  }

  function rowDescription(
    row: FingerprintRow
  ): string {
    const self =
      row.selfShare === null
        ? 'legislator share unavailable'
        : `legislator share ${formatShare(
            row.selfShare
          )}`;

    const median =
      row.partyMedianShare === null
        ? 'party median unavailable'
        : `party median ${formatShare(
            row.partyMedianShare
          )}`;

    const posts =
      row.postsInTopic === null
        ? ''
        : ` Based on ${row.postsInTopic.toLocaleString(
            'en-US'
          )} ${
            row.postsInTopic === 1
              ? 'post'
              : 'posts'
          }.`;

    return `${row.topicLabel}: ${directionDescription(
      row.deviation
    )}; ${self}; ${median}.${posts}`;
  }
</script>

<figure class="fingerprint">
  <p
    id={descriptionId}
    class="visually-hidden"
  >
    {chartDescription}
  </p>

  <figcaption>
    <div class="heading-copy">
      <h2>{title}</h2>

      {#if caption}
        <p class="caption">
          {caption}
        </p>
      {/if}

      {#if mostDistinctive}
        <p class="distinctive">
          <span>Most distinctive</span>

          {#if mostDistinctive.href}
            <a href={mostDistinctive.href}>
              {mostDistinctive.topicLabel}
            </a>
          {:else}
            <strong>
              {mostDistinctive.topicLabel}
            </strong>
          {/if}

          <span aria-hidden="true">·</span>

          <span>
            {directionDescription(
              mostDistinctive.deviation
            )}
          </span>
        </p>
      {/if}
    </div>

    {#if showSummary && normalizedRows.length}
      <dl class="summary">
        <div>
          <dt>Topics</dt>
          <dd>
            {normalizedRows.length.toLocaleString(
              'en-US'
            )}
          </dd>
        </div>

        <div>
          <dt>Over</dt>
          <dd>{overIndexedCount}</dd>
        </div>

        <div>
          <dt>Under</dt>
          <dd>{underIndexedCount}</dd>
        </div>
      </dl>
    {/if}
  </figcaption>

  {#if visibleRows.length}
    {#if showLegend}
      <div
        class="legend"
        aria-label="Fingerprint direction legend"
      >
        <span class="legend-item under">
          <span
            class="legend-mark"
            aria-hidden="true"
          ></span>

          Under-indexed
        </span>

        <span class="reference">
          Party median
        </span>

        <span class="legend-item over">
          <span
            class="legend-mark"
            aria-hidden="true"
          ></span>

          Over-indexed
        </span>
      </div>
    {/if}

    <div
      class="chart"
      role="group"
      aria-label={ariaLabel}
      aria-describedby={descriptionId}
    >
      <div
        class:no-rank={!showRank}
        class="chart-heading"
        aria-hidden="true"
      >
        {#if showRank}
          <span></span>
        {/if}

        <span>Topic</span>

        <span class="scale-labels">
          <span>
            {formatDeviation(
              -scaleMaximum
            )}
          </span>

          <span>0</span>

          <span>
            {formatDeviation(
              scaleMaximum
            )}
          </span>
        </span>

        <span>Difference</span>
      </div>

      <ol
        class:no-rank={!showRank}
        class="rows"
      >
        {#each visibleRows as row, index (row.key)}
          <li
            class:selected={isSelected(row)}
            class:positive={row.deviation > 0}
            class:negative={row.deviation < 0}
            class:neutral={row.deviation === 0}
            class="fp-row"
            title={rowDescription(row)}
          >
            {#if showRank}
              <span
                class="rank"
                aria-hidden="true"
              >
                {index + 1}
              </span>
            {/if}

            <span class="topic">
              {#if row.href}
                <a
                  href={row.href}
                  aria-current={isSelected(row)
                    ? 'page'
                    : undefined}
                >
                  {row.topicLabel}
                </a>
              {:else}
                <span>{row.topicLabel}</span>
              {/if}

              <small>
                {directionLabel(
                  row.deviation
                )}
              </small>
            </span>

            <span
              class="axis"
              aria-hidden="true"
            >
              <span class="half negative-half">
                <span
                  class="bar negative-bar"
                  style={`--bar-scale:${
                    row.deviation < 0
                      ? barScale(
                          row.deviation
                        )
                      : 0
                  }`}
                ></span>
              </span>

              <span class="half positive-half">
                <span
                  class="bar positive-bar"
                  style={`--bar-scale:${
                    row.deviation > 0
                      ? barScale(
                          row.deviation
                        )
                      : 0
                  }`}
                ></span>
              </span>

              <span class="center-line"></span>

              {#if row.deviation === 0}
                <span class="zero-mark"></span>
              {/if}
            </span>

            <data
              class="deviation"
              value={String(row.deviation)}
              aria-label={rowDescription(row)}
            >
              {formatDeviation(
                row.deviation
              )}
            </data>
          </li>
        {/each}
      </ol>
    </div>

    <p class="scale-note">
      Bars share a symmetric scale of
      ±{absolutePercentagePoints(
        scaleMaximum
      )}.

      {#if hiddenCount > 0}
        Showing
        {visibleRows.length.toLocaleString(
          'en-US'
        )}
        of
        {orderedRows.length.toLocaleString(
          'en-US'
        )}
        topics under the selected ordering.
      {/if}

      {#if neutralCount > 0}
        {neutralCount.toLocaleString(
          'en-US'
        )}
        {neutralCount === 1
          ? 'topic matches'
          : 'topics match'}
        the party median exactly.
      {/if}

      {#if invalidRowCount > 0}
        {invalidRowCount.toLocaleString(
          'en-US'
        )}
        malformed
        {invalidRowCount === 1
          ? 'row was'
          : 'rows were'}
        omitted.
      {/if}
    </p>

    {#if showTable}
      <details class="data-disclosure">
        <summary>
          View complete comparison table
        </summary>

        <div
          class="table-scroll"
          role="region"
          aria-label={`${title} data table`}
          tabindex="0"
        >
          <table>
            <caption class="visually-hidden">
              Complete topic-share comparison
              with the party median
            </caption>

            <thead>
              <tr>
                <th scope="col">Topic</th>

                <th
                  scope="col"
                  class="numeric"
                >
                  Legislator share
                </th>

                <th
                  scope="col"
                  class="numeric"
                >
                  Party median
                </th>

                <th
                  scope="col"
                  class="numeric"
                >
                  Difference
                </th>

                <th scope="col">
                  Direction
                </th>

                <th
                  scope="col"
                  class="numeric"
                >
                  Posts
                </th>
              </tr>
            </thead>

            <tbody>
              {#each orderedRows as row (row.key)}
                <tr>
                  <th scope="row">
                    {#if row.href}
                      <a href={row.href}>
                        {row.topicLabel}
                      </a>
                    {:else}
                      {row.topicLabel}
                    {/if}
                  </th>

                  <td class="numeric">
                    {formatShare(
                      row.selfShare
                    )}
                  </td>

                  <td class="numeric">
                    {formatShare(
                      row.partyMedianShare
                    )}
                  </td>

                  <td
                    class:positive-value={
                      row.deviation > 0
                    }
                    class:negative-value={
                      row.deviation < 0
                    }
                    class="numeric"
                  >
                    <data
                      value={String(
                        row.deviation
                      )}
                    >
                      {formatDeviation(
                        row.deviation
                      )}
                    </data>
                  </td>

                  <td>
                    {directionLabel(
                      row.deviation
                    )}
                  </td>

                  <td class="numeric">
                    {exactPosts(
                      row.postsInTopic
                    )}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </details>
    {/if}
  {:else}
    <p
      class="empty-state"
      role="status"
    >
      {emptyMessage}
    </p>
  {/if}
</figure>

<style>
  .fingerprint {
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
    display: flex;
    gap: 18px;
    align-items: flex-start;
    justify-content: space-between;
    min-width: 0;
    margin-bottom: 14px;
  }

  .heading-copy {
    min-width: 0;
    max-width: 76ch;
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
    font-size: 0.84rem;
    line-height: 1.35rem;
  }

  .distinctive {
    display: flex;
    flex-wrap: wrap;
    gap: 3px 6px;
    align-items: baseline;
    margin: 7px 0 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.74rem;
    line-height: 1.1rem;
  }

  .distinctive > span:first-child {
    color: var(
      --color-mute-soft,
      #9c9787
    );
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .distinctive a,
  .distinctive strong {
    color: var(--color-ink, #1a1917);
    font-weight: 600;
  }

  .distinctive a {
    text-decoration-line: underline;
    text-decoration-color: transparent;
    text-underline-offset: 3px;
  }

  .distinctive a:hover {
    color: var(--color-seal, #8a5a1a);
    text-decoration-color: currentColor;
  }

  .distinctive a:focus-visible,
  .topic a:focus-visible,
  tbody th a:focus-visible {
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .summary {
    display: flex;
    gap: 18px;
    flex: 0 0 auto;
    padding: 0;
    margin: 0;
  }

  .summary > div {
    display: grid;
    gap: 1px;
    min-width: 42px;
  }

  .summary dt,
  .summary dd {
    margin: 0;
  }

  .summary dt {
    color: var(--color-mute, #6b6659);
    font-size: 0.64rem;
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
    font-size: 0.8rem;
    font-weight: 650;
    line-height: 1.1rem;
    font-variant-numeric: tabular-nums;
  }

  .legend {
    display: grid;
    grid-template-columns:
      1fr auto 1fr;
    gap: 12px;
    align-items: center;
    margin-bottom: 8px;
    color: var(--color-mute, #6b6659);
    font-size: 0.69rem;
    line-height: 1rem;
  }

  .legend-item {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }

  .legend-item.under {
    justify-self: end;
  }

  .legend-item.over {
    justify-self: start;
  }

  .legend-mark {
    display: inline-block;
    width: 18px;
    height: 6px;
    background: var(
      --color-independent,
      #7a6a4a
    );
    border-radius: 1px;
  }

  .legend-item.over .legend-mark {
    background: var(
      --color-ballot-blue,
      #274b6e
    );
  }

  .reference {
    color: var(
      --color-mute-soft,
      #9c9787
    );
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.63rem;
    text-align: center;
    white-space: nowrap;
  }

  .chart {
    min-width: 0;
  }

  .chart-heading,
  .fp-row {
    display: grid;
    grid-template-columns:
      28px
      minmax(140px, 1fr)
      minmax(220px, 2fr)
      minmax(70px, auto);
    gap: 12px;
    align-items: center;
    min-width: 0;
  }

  .chart-heading.no-rank,
  .rows.no-rank .fp-row {
    grid-template-columns:
      minmax(140px, 1fr)
      minmax(220px, 2fr)
      minmax(70px, auto);
  }

  .chart-heading {
    min-height: 28px;
    padding: 0 9px;
    color: var(
      --color-mute-soft,
      #9c9787
    );
    font-size: 0.63rem;
    font-weight: 600;
    line-height: 1rem;
    letter-spacing: 0.045em;
    text-transform: uppercase;
    border-bottom: 1px solid
      var(--color-rule, #d9d2c1);
  }

  .chart-heading > span:last-child {
    text-align: right;
  }

  .scale-labels {
    display: grid;
    grid-template-columns:
      1fr auto 1fr;
    gap: 8px;
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-variant-numeric: tabular-nums;
    letter-spacing: 0;
    text-transform: none;
  }

  .scale-labels span:first-child {
    text-align: left;
  }

  .scale-labels span:nth-child(2) {
    text-align: center;
  }

  .scale-labels span:last-child {
    text-align: right;
  }

  .rows {
    display: grid;
    gap: 0;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .fp-row {
    min-height: 46px;
    padding: 7px 9px;
    border-bottom: 1px solid
      color-mix(
        in srgb,
        var(--color-rule, #d9d2c1) 66%,
        transparent
      );
    border-radius: 4px;
    transition:
      background-color 120ms ease,
      box-shadow 120ms ease;
  }

  .fp-row:last-child {
    border-bottom-color: transparent;
  }

  .fp-row:hover {
    background: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 16%,
      var(--color-card, #fff)
    );
  }

  .fp-row.selected {
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 7%,
      var(--color-card, #fff)
    );
    box-shadow: inset 3px 0 0
      var(--color-seal, #8a5a1a);
  }

  .rank {
    color: var(
      --color-mute-soft,
      #9c9787
    );
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.66rem;
    line-height: 1rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .topic {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .topic > a,
  .topic > span {
    min-width: 0;
    overflow: hidden;
    color: var(--color-ink, #1a1917);
    font-size: 0.8rem;
    font-weight: 600;
    line-height: 1.05rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .topic > a {
    text-decoration-line: underline;
    text-decoration-color: transparent;
    text-underline-offset: 3px;
  }

  .topic > a:hover {
    color: var(--color-seal, #8a5a1a);
    text-decoration-color: currentColor;
  }

  .topic small {
    color: var(--color-mute, #6b6659);
    font-size: 0.64rem;
    line-height: 0.9rem;
  }

  .axis {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
    height: 14px;
    overflow: visible;
    background: color-mix(
      in srgb,
      var(--color-track, #ece8df) 72%,
      transparent
    );
    border-block: 1px solid
      color-mix(
        in srgb,
        var(--color-rule, #d9d2c1) 68%,
        transparent
      );
  }

  .half {
    position: relative;
    display: flex;
    min-width: 0;
    height: 100%;
  }

  .negative-half {
    justify-content: flex-end;
  }

  .positive-half {
    justify-content: flex-start;
  }

  .bar {
    display: block;
    width: 100%;
    height: 100%;
    transform: scaleX(
      var(--bar-scale)
    );
    transition:
      transform 220ms ease-out,
      background-color 120ms ease;
  }

  .negative-bar {
    background: var(
      --color-independent,
      #7a6a4a
    );
    transform-origin: right center;
  }

  .positive-bar {
    background: var(
      --color-ballot-blue,
      #274b6e
    );
    transform-origin: left center;
  }

  .center-line {
    position: absolute;
    top: -4px;
    bottom: -4px;
    left: 50%;
    z-index: 2;
    width: 1px;
    background: var(
      --color-rule-strong,
      var(--color-mute, #6b6659)
    );
    transform: translateX(-0.5px);
  }

  .zero-mark {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 3;
    width: 7px;
    height: 7px;
    background: var(--color-card, #fff);
    border: 2px solid
      var(--color-mute, #6b6659);
    border-radius: 50%;
    transform: translate(-50%, -50%);
  }

  .deviation {
    color: var(--color-ink, #1a1917);
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .positive .deviation {
    color: var(
      --color-ballot-blue,
      #274b6e
    );
  }

  .negative .deviation {
    color: var(
      --color-independent,
      #7a6a4a
    );
  }

  .neutral .deviation {
    color: var(--color-mute, #6b6659);
  }

  .scale-note {
    margin: 9px 0 0;
    color: var(
      --color-mute-soft,
      #9c9787
    );
    font-size: 0.69rem;
    line-height: 1.1rem;
  }

  .data-disclosure {
    margin-top: 13px;
    border-top: 1px solid
      var(--color-rule, #d9d2c1);
  }

  .data-disclosure summary {
    width: fit-content;
    padding: 10px 2px 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1rem;
    cursor: pointer;
    user-select: none;
  }

  .data-disclosure summary:hover {
    color: var(--color-seal, #8a5a1a);
  }

  .data-disclosure summary:focus-visible,
  .table-scroll:focus-visible {
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .table-scroll {
    max-width: 100%;
    margin-top: 10px;
    overflow: auto;
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  table {
    width: 100%;
    min-width: 720px;
    border-spacing: 0;
    border-collapse: separate;
    font-size: 0.76rem;
    line-height: 1.1rem;
  }

  th,
  td {
    padding: 8px 10px;
    text-align: left;
    border-right: 1px solid
      var(--color-rule, #d9d2c1);
    border-bottom: 1px solid
      var(--color-rule, #d9d2c1);
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

  tbody th a {
    color: inherit;
    text-decoration-line: underline;
    text-decoration-color: transparent;
    text-underline-offset: 3px;
  }

  tbody th a:hover {
    color: var(--color-seal, #8a5a1a);
    text-decoration-color: currentColor;
  }

  tbody tr:last-child th,
  tbody tr:last-child td {
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

  .positive-value {
    color: var(
      --color-ballot-blue,
      #274b6e
    );
  }

  .negative-value {
    color: var(
      --color-independent,
      #7a6a4a
    );
  }

  .empty-state {
    min-height: 110px;
    padding: 28px 18px;
    margin: 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.84rem;
    line-height: 1.35rem;
    text-align: center;
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

  @media (max-width: 720px) {
    .fingerprint {
      padding: 14px 12px;
    }

    figcaption {
      display: grid;
      gap: 10px;
    }

    .summary {
      justify-content: flex-start;
    }

    .chart-heading {
      display: none;
    }

    .fp-row {
      grid-template-columns:
        26px minmax(0, 1fr) auto;
      grid-template-areas:
        'rank topic value'
        '. axis axis';
      gap: 6px 9px;
      min-height: 62px;
      padding-block: 9px;
    }

    .rows.no-rank .fp-row {
      grid-template-columns:
        minmax(0, 1fr) auto;
      grid-template-areas:
        'topic value'
        'axis axis';
    }

    .rank {
      grid-area: rank;
    }

    .topic {
      grid-area: topic;
    }

    .axis {
      grid-area: axis;
    }

    .deviation {
      grid-area: value;
    }

    .topic > a,
    .topic > span {
      white-space: normal;
      overflow-wrap: anywhere;
    }
  }

  @media (max-width: 440px) {
    .legend {
      grid-template-columns: 1fr 1fr;
      gap: 7px 10px;
    }

    .reference {
      grid-column: 1 / -1;
      grid-row: 1;
    }

    .legend-item.under,
    .legend-item.over {
      justify-self: stretch;
    }

    .legend-item.over {
      justify-content: flex-end;
    }

    .fp-row {
      padding-inline: 6px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .fp-row,
    .bar {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .fingerprint,
    .axis,
    .fp-row,
    .table-scroll,
    table,
    th,
    td,
    .empty-state {
      color: CanvasText;
      background: Canvas;
      border-color: CanvasText;
    }

    .negative-bar,
    .positive-bar,
    .legend-mark {
      background: Highlight;
    }

    .center-line {
      background: CanvasText;
    }

    .zero-mark {
      background: Canvas;
      border-color: CanvasText;
    }

    .topic a:focus-visible,
    .distinctive a:focus-visible,
    tbody th a:focus-visible,
    .data-disclosure summary:focus-visible,
    .table-scroll:focus-visible {
      outline-color: Highlight;
    }
  }

  @media print {
    .fingerprint {
      color: #000;
      background: transparent;
      border-color: #999;
      break-inside: avoid;
    }

    .negative-bar {
      background: #777;
      print-color-adjust: exact;
    }

    .positive-bar {
      background: #333;
      print-color-adjust: exact;
    }

    .data-disclosure {
      display: none;
    }
  }
</style>