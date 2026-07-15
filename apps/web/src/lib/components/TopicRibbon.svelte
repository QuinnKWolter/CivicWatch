<script lang="ts">
  import { compact } from '$lib/format';
  import { withBase } from '$lib/paths';

  interface Props {
    rows?: unknown[];

    title?: string;
    caption?: string;
    ariaLabel?: string;

    hrefPrefix?: string | null;
    maxTopics?: number;
    includeOther?: boolean;

    selectedTopic?: string | number | null;

    showLegend?: boolean;
    showSummary?: boolean;
    showTable?: boolean;

    valueLabel?: string;
    valueLabelSingular?: string;
    emptyMessage?: string;
  }

  interface SourceTopic {
    key: string;
    topic: string | null;
    label: string;
    count: number;
    firstIndex: number;
    uncategorized: boolean;
  }

  type DisplayKind =
    | 'topic'
    | 'other'
    | 'uncategorized';

  interface DisplayTopic {
    key: string;
    topic: string | null;
    label: string;
    count: number;
    share: number;
    kind: DisplayKind;
    colorClass: string;
    href: string | null;
    sourceKeys: string[];
    order: number;
  }

  let {
    rows = [],
    title = 'Topic ribbon',
    caption = 'A proportional view of topic composition over the selected period. Uncategorized posts remain visible.',
    ariaLabel = 'Topic composition ribbon',
    hrefPrefix = '/topic/',
    maxTopics = 12,
    includeOther = true,
    selectedTopic = null,
    showLegend = true,
    showSummary = true,
    showTable = true,
    valueLabel = 'posts',
    valueLabelSingular = 'post',
    emptyMessage = 'No topic activity is available.'
  }: Props = $props();

  const UNCATEGORIZED_KEY = '__uncategorized__';
  const OTHER_KEY = '__other__';

  const collator = new Intl.Collator('en-US', {
    sensitivity: 'base',
    numeric: true
  });

  const percentFormatter = new Intl.NumberFormat('en-US', {
    style: 'percent',
    maximumFractionDigits: 1
  });

  const safeRows = $derived(
    Array.isArray(rows) ? rows : []
  );

  const safeHrefPrefix = $derived(
    normalizeHrefPrefix(hrefPrefix)
  );

  const safeMaxTopics = $derived(
    Number.isFinite(maxTopics)
      ? Math.min(
          24,
          Math.max(3, Math.trunc(maxTopics))
        )
      : 12
  );

  const normalizedSelectedTopic = $derived(
    cleanText(selectedTopic)?.toLocaleLowerCase() ??
      null
  );

  const aggregatedTopics = $derived.by(() =>
    aggregateTopics(safeRows)
  );

  const orderedTopics = $derived.by(() =>
    [...aggregatedTopics].sort(compareTopics)
  );

  const totalCount = $derived(
    orderedTopics.reduce(
      (total, topic) => total + topic.count,
      0
    )
  );

  const displayTopics = $derived.by(() =>
    buildDisplayTopics(
      orderedTopics,
      safeMaxTopics,
      includeOther,
      totalCount
    )
  );

  const positiveRibbonTopics = $derived(
    displayTopics.filter(
      (topic) => topic.count > 0
    )
  );

  const visibleSourceKeys = $derived(
    new Set(
      displayTopics
        .filter((topic) => topic.kind !== 'other')
        .flatMap((topic) => topic.sourceKeys)
    )
  );

  const otherSourceKeys = $derived(
    new Set(
      displayTopics.find(
        (topic) => topic.kind === 'other'
      )?.sourceKeys ?? []
    )
  );

  const groupedTopicCount = $derived(
    displayTopics.find(
      (topic) => topic.kind === 'other'
    )?.sourceKeys.length ?? 0
  );

  const uncategorizedTopic = $derived(
    orderedTopics.find(
      (topic) => topic.uncategorized
    ) ?? null
  );

  const leadingTopic = $derived(
    orderedTopics.find(
      (topic) => topic.count > 0
    ) ?? null
  );

  const sourceRowCount = $derived(
    safeRows.filter(isRecord).length
  );

  const omittedRowCount = $derived(
    Math.max(
      0,
      safeRows.length - sourceRowCount
    )
  );

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

  function normalizeCount(
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

    return withBase(href);
  }

  function buildHref(
    topic: string | null
  ): string | null {
    if (!safeHrefPrefix || !topic) {
      return null;
    }

    return withBase(`${safeHrefPrefix}${encodeURIComponent(
      topic
    )}`);
  }

  function isUncategorized(
    topic: string | null,
    label: string
  ): boolean {
    return (
      topic === '999' ||
      /^(?:unknown topic(?:\s*\(999\))?|uncategori[sz]ed|unclassified|topic unknown)$/i.test(
        label.trim()
      )
    );
  }

  function aggregateTopics(
    input: unknown[]
  ): SourceTopic[] {
    const lookup = new Map<
      string,
      SourceTopic
    >();

    input.forEach((source, index) => {
      if (!isRecord(source)) {
        return;
      }

      const topic = cleanText(
        firstValue([
          source.topic,
          source.topicId,
          source.topic_id,
          source.slug
        ])
      );

      const suppliedLabel = cleanText(
        firstValue([
          source.topicLabel,
          source.topic_label,
          source.label,
          source.name
        ])
      );

      const provisionalLabel =
        suppliedLabel ??
        (topic
          ? `Topic ${topic}`
          : 'Uncategorized');

      const uncategorized = isUncategorized(
        topic,
        provisionalLabel
      );

      const label = uncategorized
        ? 'Uncategorized'
        : provisionalLabel;

      const key = uncategorized
        ? UNCATEGORIZED_KEY
        : topic
          ? `topic:${topic.toLocaleLowerCase()}`
          : `label:${label.toLocaleLowerCase()}`;

      const count = normalizeCount(
        firstValue([
          source.postCount,
          source.post_count,
          source.count,
          source.value
        ])
      );

      const existing = lookup.get(key);

      if (existing) {
        existing.count += count;

        if (!existing.topic && topic) {
          existing.topic = topic;
        }

        return;
      }

      lookup.set(key, {
        key,
        topic,
        label,
        count,
        firstIndex: index,
        uncategorized
      });
    });

    return [...lookup.values()];
  }

  function compareTopics(
    left: SourceTopic,
    right: SourceTopic
  ): number {
    return (
      right.count - left.count ||
      collator.compare(
        left.label,
        right.label
      ) ||
      left.firstIndex - right.firstIndex
    );
  }

  function stableHash(
    value: string
  ): number {
    let hash = 2166136261;

    for (
      let index = 0;
      index < value.length;
      index += 1
    ) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return Math.abs(hash >>> 0);
  }

  function topicColorClass(
    key: string
  ): string {
    return `tone-${stableHash(key) % 8}`;
  }

  function buildDisplayTopics(
    allTopics: SourceTopic[],
    limit: number,
    shouldIncludeOther: boolean,
    total: number
  ): DisplayTopic[] {
    if (!allTopics.length) {
      return [];
    }

    const uncategorized =
      allTopics.find(
        (topic) => topic.uncategorized
      ) ?? null;

    const categorized = allTopics.filter(
      (topic) => !topic.uncategorized
    );

    let selected: Array<{
      source: SourceTopic | null;
      kind: DisplayKind;
      label: string;
      count: number;
      sourceKeys: string[];
    }> = [];

    if (allTopics.length <= limit) {
      selected = allTopics.map(
        (topic) => ({
          source: topic,
          kind: topic.uncategorized
            ? 'uncategorized'
            : 'topic',
          label: topic.label,
          count: topic.count,
          sourceKeys: [topic.key]
        })
      );
    } else if (shouldIncludeOther) {
      const reservedSlots =
        1 + (uncategorized ? 1 : 0);

      const visibleCategoryCount =
        Math.max(
          1,
          limit - reservedSlots
        );

      const leadingCategories =
        categorized.slice(
          0,
          visibleCategoryCount
        );

      const remainder = categorized.slice(
        visibleCategoryCount
      );

      selected = leadingCategories.map(
        (topic) => ({
          source: topic,
          kind: 'topic',
          label: topic.label,
          count: topic.count,
          sourceKeys: [topic.key]
        })
      );

      if (remainder.length) {
        selected.push({
          source: null,
          kind: 'other',
          label: 'Other topics',
          count: remainder.reduce(
            (sum, topic) =>
              sum + topic.count,
            0
          ),
          sourceKeys: remainder.map(
            (topic) => topic.key
          )
        });
      }

      if (uncategorized) {
        selected.push({
          source: uncategorized,
          kind: 'uncategorized',
          label: 'Uncategorized',
          count: uncategorized.count,
          sourceKeys: [
            uncategorized.key
          ]
        });
      }
    } else {
      const visibleCategoryCount =
        limit - (uncategorized ? 1 : 0);

      selected = categorized
        .slice(
          0,
          Math.max(
            1,
            visibleCategoryCount
          )
        )
        .map((topic) => ({
          source: topic,
          kind: 'topic',
          label: topic.label,
          count: topic.count,
          sourceKeys: [topic.key]
        }));

      if (uncategorized) {
        selected.push({
          source: uncategorized,
          kind: 'uncategorized',
          label: 'Uncategorized',
          count: uncategorized.count,
          sourceKeys: [
            uncategorized.key
          ]
        });
      }
    }

    return selected
      .sort(
        (left, right) =>
          right.count - left.count ||
          collator.compare(
            left.label,
            right.label
          )
      )
      .map(
        (
          entry,
          index
        ): DisplayTopic => {
          const key =
            entry.kind === 'other'
              ? OTHER_KEY
              : entry.source?.key ??
                `display:${index}`;

          return {
            key,
            topic:
              entry.source?.topic ?? null,
            label: entry.label,
            count: entry.count,
            share:
              total > 0
                ? entry.count / total
                : 0,
            kind: entry.kind,
            colorClass:
              entry.kind ===
              'uncategorized'
                ? 'uncategorized'
                : entry.kind === 'other'
                  ? 'other'
                  : topicColorClass(key),
            href:
              entry.kind === 'other'
                ? null
                : buildHref(
                    entry.source?.topic ??
                      null
                  ),
            sourceKeys:
              entry.sourceKeys,
            order: index + 1
          };
        }
      );
  }

  function exactValue(
    value: number
  ): string {
    return value.toLocaleString('en-US', {
      maximumFractionDigits:
        Number.isInteger(value) ? 0 : 2
    });
  }

  function compactValue(
    value: number
  ): string {
    try {
      return compact(value);
    } catch {
      return exactValue(value);
    }
  }

  function unitLabel(
    value: number
  ): string {
    return value === 1
      ? valueLabelSingular
      : valueLabel;
  }

  function shareLabel(
    share: number
  ): string {
    return percentFormatter.format(share);
  }

  function segmentDescription(
    topic: DisplayTopic
  ): string {
    const grouped =
      topic.kind === 'other'
        ? ` across ${topic.sourceKeys.length.toLocaleString(
            'en-US'
          )} additional topic categories`
        : '';

    return `${topic.label}: ${exactValue(
      topic.count
    )} ${unitLabel(
      topic.count
    )}, ${shareLabel(
      topic.share
    )} of all posts${grouped}.`;
  }

  function isSelected(
    topic: {
      topic: string | null;
      label: string;
    }
  ): boolean {
    if (!normalizedSelectedTopic) {
      return false;
    }

    return (
      topic.topic?.toLocaleLowerCase() ===
        normalizedSelectedTopic ||
      topic.label.toLocaleLowerCase() ===
        normalizedSelectedTopic
    );
  }

  function segmentSizeClass(
    share: number
  ): string {
    if (share >= 0.16) {
      return 'wide';
    }

    if (share >= 0.075) {
      return 'medium';
    }

    if (share >= 0.025) {
      return 'narrow';
    }

    return 'micro';
  }

  function tablePlacement(
    topic: SourceTopic
  ): string {
    if (visibleSourceKeys.has(topic.key)) {
      return 'Shown separately';
    }

    if (otherSourceKeys.has(topic.key)) {
      return 'Grouped into Other';
    }

    return 'Not shown in ribbon';
  }
</script>

<figure class="ribbon">
  <figcaption>
    <div class="heading-copy">
      <h2>{title}</h2>

      {#if caption}
        <p class="caption">
          {caption}
        </p>
      {/if}
    </div>

    {#if showSummary && orderedTopics.length}
      <dl class="summary">
        <div>
          <dt>Total</dt>
          <dd>
            <data value={String(totalCount)}>
              {compactValue(totalCount)}
            </data>
          </dd>
        </div>

        <div>
          <dt>Topics</dt>
          <dd>
            {orderedTopics.length.toLocaleString(
              'en-US'
            )}
          </dd>
        </div>

        {#if leadingTopic}
          <div>
            <dt>Largest</dt>
            <dd title={leadingTopic.label}>
              {shareLabel(
                totalCount > 0
                  ? leadingTopic.count /
                      totalCount
                  : 0
              )}
            </dd>
          </div>
        {/if}
      </dl>
    {/if}
  </figcaption>

  {#if orderedTopics.length}
    {#if totalCount > 0}
      <ol
        class="bands"
        aria-label={ariaLabel}
      >
        {#each positiveRibbonTopics as topic (topic.key)}
          <li
            class={`band-item ${segmentSizeClass(
              topic.share
            )}`}
            style={`--segment-share:${(
              topic.share * 100
            ).toFixed(6)}%`}
          >
            {#if topic.href}
              <a
                class={`band ${topic.colorClass}`}
                class:selected={isSelected(
                  topic
                )}
                href={topic.href}
                aria-current={isSelected(
                  topic
                )
                  ? 'page'
                  : undefined}
                aria-label={segmentDescription(
                  topic
                )}
                title={segmentDescription(
                  topic
                )}
              >
                <span
                  class="band-number"
                  aria-hidden="true"
                >
                  {topic.order}
                </span>

                <span class="band-copy">
                  <strong>
                    {topic.label}
                  </strong>

                  <span>
                    {compactValue(
                      topic.count
                    )}
                  </span>

                  <span>
                    {shareLabel(
                      topic.share
                    )}
                  </span>
                </span>
              </a>
            {:else}
              <div
                class={`band static ${topic.colorClass}`}
                role="group"
                aria-label={segmentDescription(
                  topic
                )}
                title={segmentDescription(
                  topic
                )}
              >
                <span
                  class="band-number"
                  aria-hidden="true"
                >
                  {topic.order}
                </span>

                <span class="band-copy">
                  <strong>
                    {topic.label}
                  </strong>

                  <span>
                    {compactValue(
                      topic.count
                    )}
                  </span>

                  <span>
                    {shareLabel(
                      topic.share
                    )}
                  </span>
                </span>
              </div>
            {/if}
          </li>
        {/each}
      </ol>
    {:else}
      <div
        class="zero-ribbon"
        role="status"
      >
        Topic categories are present, but all
        reported post counts are zero.
      </div>
    {/if}

    {#if showLegend}
      <ol
        class="legend"
        aria-label="Topic ribbon legend"
      >
        {#each displayTopics as topic (topic.key)}
          <li>
            {#if topic.href}
              <a
                class:selected={isSelected(
                  topic
                )}
                class="legend-item"
                href={topic.href}
                aria-current={isSelected(
                  topic
                )
                  ? 'page'
                  : undefined}
                aria-label={segmentDescription(
                  topic
                )}
              >
                <span
                  class={`legend-number ${topic.colorClass}`}
                  aria-hidden="true"
                >
                  {topic.order}
                </span>

                <span class="legend-copy">
                  <strong>
                    {topic.label}
                  </strong>

                  {#if topic.kind === 'other'}
                    <span>
                      {groupedTopicCount.toLocaleString(
                        'en-US'
                      )}
                      additional categories
                    </span>
                  {:else}
                    <span>
                      {shareLabel(
                        topic.share
                      )}
                      of total
                    </span>
                  {/if}
                </span>

                <data
                  value={String(topic.count)}
                >
                  {compactValue(
                    topic.count
                  )}
                </data>
              </a>
            {:else}
              <div
                class="legend-item static"
                role="group"
                aria-label={segmentDescription(
                  topic
                )}
              >
                <span
                  class={`legend-number ${topic.colorClass}`}
                  aria-hidden="true"
                >
                  {topic.order}
                </span>

                <span class="legend-copy">
                  <strong>
                    {topic.label}
                  </strong>

                  {#if topic.kind === 'other'}
                    <span>
                      {groupedTopicCount.toLocaleString(
                        'en-US'
                      )}
                      additional categories
                    </span>
                  {:else}
                    <span>
                      {shareLabel(
                        topic.share
                      )}
                      of total
                    </span>
                  {/if}
                </span>

                <data
                  value={String(topic.count)}
                >
                  {compactValue(
                    topic.count
                  )}
                </data>
              </div>
            {/if}
          </li>
        {/each}
      </ol>
    {/if}

    <p class="coverage-note">
      {displayTopics.length.toLocaleString(
        'en-US'
      )}
      ribbon
      {displayTopics.length === 1
        ? 'segment'
        : 'segments'}
      represent
      {orderedTopics.length.toLocaleString(
        'en-US'
      )}
      topic
      {orderedTopics.length === 1
        ? 'category'
        : 'categories'}
      from
      {sourceRowCount.toLocaleString(
        'en-US'
      )}
      valid source
      {sourceRowCount === 1
        ? 'row'
        : 'rows'}.

      {#if omittedRowCount > 0}
        {omittedRowCount.toLocaleString(
          'en-US'
        )}
        malformed
        {omittedRowCount === 1
          ? 'row was'
          : 'rows were'}
        ignored.
      {/if}

      {#if uncategorizedTopic}
        Uncategorized accounts for
        {shareLabel(
          totalCount > 0
            ? uncategorizedTopic.count /
                totalCount
            : 0
        )}.
      {/if}
    </p>

    {#if showTable}
      <details class="data-disclosure">
        <summary>
          View complete topic table
        </summary>

        <div
          class="table-scroll"
          role="region"
          aria-label={`${title} data table`}
        >
          <table>
            <caption class="visually-hidden">
              Complete topic totals underlying
              the topic ribbon
            </caption>

            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Topic</th>
                <th
                  scope="col"
                  class="numeric"
                >
                  {valueLabel}
                </th>
                <th
                  scope="col"
                  class="numeric"
                >
                  Share
                </th>
                <th scope="col">
                  Ribbon placement
                </th>
              </tr>
            </thead>

            <tbody>
              {#each orderedTopics as topic, index (topic.key)}
                {@const topicHref =
                  buildHref(topic.topic)}

                <tr>
                  <td class="rank-cell">
                    {index + 1}
                  </td>

                  <th scope="row">
                    {#if topicHref}
                      <a href={topicHref}>
                        {topic.label}
                      </a>
                    {:else}
                      {topic.label}
                    {/if}
                  </th>

                  <td class="numeric">
                    <data
                      value={String(
                        topic.count
                      )}
                    >
                      {exactValue(
                        topic.count
                      )}
                    </data>
                  </td>

                  <td class="numeric">
                    {shareLabel(
                      totalCount > 0
                        ? topic.count /
                            totalCount
                        : 0
                    )}
                  </td>

                  <td>
                    {tablePlacement(topic)}
                  </td>
                </tr>
              {/each}
            </tbody>

            <tfoot>
              <tr>
                <th
                  scope="row"
                  colspan="2"
                >
                  Total
                </th>

                <td class="numeric">
                  <data
                    value={String(
                      totalCount
                    )}
                  >
                    {exactValue(totalCount)}
                  </data>
                </td>

                <td class="numeric">
                  {shareLabel(
                    totalCount > 0 ? 1 : 0
                  )}
                </td>

                <td>
                  {orderedTopics.length.toLocaleString(
                    'en-US'
                  )}
                  categories
                </td>
              </tr>
            </tfoot>
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
  .ribbon {
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
    max-width: 72ch;
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
    min-width: 48px;
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
    overflow: hidden;
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
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bands {
    display: flex;
    width: 100%;
    min-height: 132px;
    padding: 0;
    margin: 0;
    overflow: hidden;
    list-style: none;
    background: var(
      --color-track,
      color-mix(
        in srgb,
        var(--color-rule, #d9d2c1) 44%,
        var(--color-card, #fff)
      )
    );
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  .band-item {
    width: var(--segment-share);
    min-width: 0;
    flex: 0 0 var(--segment-share);
    border-inline-end: 1px solid
      color-mix(
        in srgb,
        var(--color-card, #fff) 72%,
        transparent
      );
  }

  .band-item:last-child {
    border-inline-end: 0;
  }

  .band {
    position: relative;
    display: flex;
    width: 100%;
    height: 100%;
    min-width: 0;
    padding: 10px;
    overflow: hidden;
    color: var(--color-on-accent, #fff);
    text-decoration: none;
    background: var(--color-seal, #8a5a1a);
    isolation: isolate;
    transition:
      filter 120ms ease,
      box-shadow 120ms ease;
  }

  a.band:hover {
    z-index: 2;
    filter: brightness(1.06);
    box-shadow: inset 0 0 0 2px
      color-mix(
        in srgb,
        var(--color-on-accent, #fff) 70%,
        transparent
      );
  }

  a.band:focus-visible {
    z-index: 3;
    outline: 3px solid
      var(--color-card, #fff);
    outline-offset: -4px;
  }

  .band.selected {
    box-shadow:
      inset 0 0 0 3px
        var(--color-card, #fff),
      inset 0 0 0 5px
        var(--color-ink, #1a1917);
  }

  .band.static {
    cursor: default;
  }

  .band-number {
    position: absolute;
    top: 8px;
    left: 8px;
    display: grid;
    width: 22px;
    height: 22px;
    place-items: center;
    color: currentColor;
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.64rem;
    font-weight: 700;
    line-height: 1;
    background: rgb(0 0 0 / 18%);
    border: 1px solid
      rgb(255 255 255 / 38%);
    border-radius: 50%;
    font-variant-numeric: tabular-nums;
  }

  .band-copy {
    display: grid;
    gap: 2px;
    align-content: end;
    min-width: 0;
    margin-top: auto;
  }

  .band-copy strong {
    display: -webkit-box;
    overflow: hidden;
    font-size: 0.78rem;
    font-weight: 650;
    line-height: 1.05rem;
    overflow-wrap: anywhere;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }

  .band-copy > span {
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.65rem;
    line-height: 0.9rem;
    font-variant-numeric: tabular-nums;
  }

  .band-copy > span:last-child {
    opacity: 0.82;
  }

  .band-item.medium .band {
    padding-inline: 7px;
  }

  .band-item.medium .band-copy strong {
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .band-item.medium .band-copy > span:last-child {
    display: none;
  }

  .band-item.narrow .band {
    padding: 6px;
  }

  .band-item.narrow .band-copy {
    display: none;
  }

  .band-item.narrow .band-number {
    top: 7px;
    left: 50%;
    width: 20px;
    height: 20px;
    transform: translateX(-50%);
  }

  .band-item.micro .band {
    padding: 0;
  }

  .band-item.micro .band-copy,
  .band-item.micro .band-number {
    display: none;
  }

  .legend {
    display: grid;
    grid-template-columns:
      repeat(
        auto-fit,
        minmax(220px, 1fr)
      );
    gap: 7px;
    padding: 0;
    margin: 12px 0 0;
    list-style: none;
  }

  .legend li {
    min-width: 0;
  }

  .legend-item {
    display: grid;
    grid-template-columns:
      28px minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    min-width: 0;
    min-height: 46px;
    padding: 6px 8px;
    color: var(--color-ink, #1a1917);
    text-decoration: none;
    background: transparent;
    border: 1px solid
      transparent;
    border-radius: 6px;
    transition:
      color 120ms ease,
      background-color 120ms ease,
      border-color 120ms ease;
  }

  a.legend-item:hover {
    color: var(--color-seal, #8a5a1a);
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 5%,
      var(--color-card, #fff)
    );
    border-color: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 38%,
      var(--color-rule, #d9d2c1)
    );
  }

  a.legend-item:focus-visible {
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .legend-item.selected {
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 7%,
      var(--color-card, #fff)
    );
    border-color: var(--color-seal, #8a5a1a);
  }

  .legend-item.static {
    cursor: default;
  }

  .legend-number {
    display: grid;
    width: 26px;
    height: 26px;
    place-items: center;
    color: var(--color-on-accent, #fff);
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.64rem;
    font-weight: 700;
    line-height: 1;
    background: var(--color-seal, #8a5a1a);
    border-radius: 4px;
    font-variant-numeric: tabular-nums;
  }

  .legend-copy {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .legend-copy strong {
    min-width: 0;
    overflow: hidden;
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1.05rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .legend-copy span {
    color: var(--color-mute, #6b6659);
    font-size: 0.65rem;
    line-height: 0.9rem;
  }

  .legend-item data {
    color: var(--color-mute, #6b6659);
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.7rem;
    font-weight: 600;
    line-height: 1rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .coverage-note {
    margin: 10px 0 0;
    color: var(--color-mute-soft, #9c9787);
    font-size: 0.69rem;
    line-height: 1.1rem;
  }

  .zero-ribbon {
    display: grid;
    min-height: 100px;
    padding: 18px;
    place-items: center;
    color: var(--color-mute, #6b6659);
    font-size: 0.82rem;
    line-height: 1.3rem;
    text-align: center;
    background: var(
      --color-track,
      color-mix(
        in srgb,
        var(--color-rule, #d9d2c1) 35%,
        var(--color-card, #fff)
      )
    );
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
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
    min-width: 620px;
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

  tfoot th,
  tfoot td {
    font-weight: 650;
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 6%,
      var(--color-card, #fff)
    );
    border-top: 1px solid
      var(--color-rule, #d9d2c1);
    border-bottom: 0;
  }

  .numeric,
  .rank-cell {
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .numeric {
    text-align: right;
  }

  .rank-cell {
    color: var(--color-mute-soft, #9c9787);
    text-align: right;
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

  .tone-0 {
    background: var(--color-seal, #8a5a1a);
  }

  .tone-1 {
    background: var(--color-signal, #3a6c4c);
  }

  .tone-2 {
    background: var(--color-independent, #7a6a4a);
  }

  .tone-3 {
    background: var(--color-warn, #a86a1f);
  }

  .tone-4 {
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 64%,
      var(--color-signal, #3a6c4c)
    );
  }

  .tone-5 {
    background: color-mix(
      in srgb,
      var(--color-signal, #3a6c4c) 72%,
      var(--color-ink, #1a1917)
    );
  }

  .tone-6 {
    background: color-mix(
      in srgb,
      var(--color-independent, #7a6a4a) 68%,
      var(--color-seal, #8a5a1a)
    );
  }

  .tone-7 {
    background: var(--color-mute, #6b6659);
  }

  .other {
    background: color-mix(
      in srgb,
      var(--color-mute, #6b6659) 82%,
      var(--color-ink, #1a1917)
    );
  }

  .uncategorized {
    background: var(--color-mute-soft, #9c9787);
  }

  @media (max-width: 720px) {
    .ribbon {
      padding: 14px 12px;
    }

    figcaption {
      display: grid;
      gap: 10px;
    }

    .summary {
      justify-content: flex-start;
    }

    .bands {
      min-height: 108px;
    }

    .band {
      padding: 8px;
    }

    .legend {
      grid-template-columns:
        repeat(
          auto-fit,
          minmax(190px, 1fr)
        );
    }
  }

  @media (max-width: 480px) {
    .bands {
      min-height: 92px;
    }

    .band-number {
      width: 20px;
      height: 20px;
      font-size: 0.6rem;
    }

    .band-copy strong {
      font-size: 0.7rem;
      line-height: 0.95rem;
    }

    .band-copy > span {
      font-size: 0.59rem;
    }

    .legend {
      grid-template-columns: 1fr;
    }

    .legend-item {
      min-height: 44px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .band,
    .legend-item {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .ribbon,
    .bands,
    .band,
    .legend-item,
    .legend-number,
    .zero-ribbon,
    .table-scroll,
    table,
    th,
    td,
    .empty-state {
      color: CanvasText;
      background: Canvas;
      border-color: CanvasText;
    }

    .band,
    .legend-number {
      color: HighlightText;
      background: Highlight;
    }

    a.band:focus-visible,
    a.legend-item:focus-visible,
    .data-disclosure summary:focus-visible,
    .table-scroll:focus-visible {
      outline-color: Highlight;
    }
  }

  @media print {
    .ribbon {
      color: #000;
      background: transparent;
      border-color: #999;
      break-inside: avoid;
    }

    .band,
    .legend-number {
      print-color-adjust: exact;
    }

    .data-disclosure {
      display: none;
    }
  }
</style>
