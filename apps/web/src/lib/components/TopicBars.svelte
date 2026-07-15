<script lang="ts">
  import { compact } from '$lib/format';
  import { withBase } from '$lib/paths';
  import TopicIcon from './TopicIcon.svelte';

  type SortMode = 'input' | 'count' | 'label';

  interface Props {
    topics?: unknown[];
    hrefPrefix?: string | null;
    sort?: SortMode;
    limit?: number | null;
    maxValue?: number | null;
    selectedTopic?: string | number | null;
    showRank?: boolean;
    showShare?: boolean;
    showSummary?: boolean;
    ariaLabel?: string;
    valueLabel?: string;
    valueLabelSingular?: string;
    emptyMessage?: string;
  }

  interface TopicRow {
    key: string;
    topic: string | null;
    label: string;
    count: number;
    firstIndex: number;
    uncategorized: boolean;
    href: string | null;
  }

  let {
    topics = [],
    hrefPrefix = '/topic/',
    sort = 'input',
    limit = null,
    maxValue = null,
    selectedTopic = null,
    showRank = true,
    showShare = true,
    showSummary = false,
    ariaLabel = 'Topics by post count',
    valueLabel = 'posts',
    valueLabelSingular = 'post',
    emptyMessage = 'No topic data is available.'
  }: Props = $props();

  const collator = new Intl.Collator('en-US', {
    sensitivity: 'base',
    numeric: true
  });

  const safeHrefPrefix = $derived(normalizeHrefPrefix(hrefPrefix));

  const normalizedTopics = $derived.by(() => aggregateTopics(topics));

  const orderedTopics = $derived.by(() => {
    const result = [...normalizedTopics];

    if (sort === 'count') {
      result.sort(
        (left, right) =>
          right.count - left.count ||
          collator.compare(left.label, right.label)
      );
    } else if (sort === 'label') {
      result.sort((left, right) =>
        collator.compare(left.label, right.label)
      );
    } else {
      result.sort((left, right) => left.firstIndex - right.firstIndex);
    }

    return result;
  });

  const safeLimit = $derived(
    limit === null
      ? orderedTopics.length
      : Number.isFinite(limit)
        ? Math.max(0, Math.trunc(limit))
        : orderedTopics.length
  );

  const visibleTopics = $derived(orderedTopics.slice(0, safeLimit));

  const hiddenCount = $derived(
    Math.max(0, orderedTopics.length - visibleTopics.length)
  );

  const totalCount = $derived(
    orderedTopics.reduce((total, topic) => total + topic.count, 0)
  );

  const observedMaximum = $derived(
    visibleTopics.reduce(
      (maximum, topic) => Math.max(maximum, topic.count),
      0
    )
  );

  const scaleMaximum = $derived(
    Math.max(1, observedMaximum, normalizeCount(maxValue))
  );

  const normalizedSelectedTopic = $derived(
    cleanText(selectedTopic)?.toLocaleLowerCase() ?? null
  );

  function isRecord(value: unknown): value is Record<string, unknown> {
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

  function normalizeCount(value: unknown): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }

    const number =
      typeof value === 'number' ? value : Number(value);

    return Number.isFinite(number) ? Math.max(0, number) : 0;
  }

  function isUncategorized(topic: string | null, label: string): boolean {
    return (
      topic === '999' ||
      /^(?:unknown topic(?:\s*\(999\))?|uncategori[sz]ed|unclassified|topic unknown)$/i.test(
        label
      )
    );
  }

  function normalizeHrefPrefix(value: string | null): string | null {
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

    if (/^(?:javascript|data|vbscript):/i.test(compactHref)) {
      return null;
    }

    return withBase(href);
  }

  function buildHref(topic: string | null): string | null {
    if (!safeHrefPrefix || !topic) {
      return null;
    }

    return withBase(`${safeHrefPrefix}${encodeURIComponent(topic)}`);
  }

  function aggregateTopics(input: unknown[]): TopicRow[] {
    if (!Array.isArray(input)) {
      return [];
    }

    const lookup = new Map<
      string,
      {
        topic: string | null;
        label: string;
        count: number;
        firstIndex: number;
        uncategorized: boolean;
      }
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

      const label =
        cleanText(
          firstValue([
            source.topicLabel,
            source.topic_label,
            source.label,
            source.name
          ])
        ) ??
        (topic ? `Topic ${topic}` : 'Uncategorized');

      const count = normalizeCount(
        firstValue([
          source.postCount,
          source.post_count,
          source.count,
          source.value
        ])
      );

      const uncategorized = isUncategorized(topic, label);

      const key = topic
        ? `topic:${topic.toLocaleLowerCase()}`
        : `label:${label.toLocaleLowerCase()}`;

      const existing = lookup.get(key);

      if (existing) {
        existing.count += count;
        return;
      }

      lookup.set(key, {
        topic,
        label,
        count,
        firstIndex: index,
        uncategorized
      });
    });

    return [...lookup.entries()].map(([key, topic]) => ({
      key,
      topic: topic.topic,
      label: topic.uncategorized ? 'Uncategorized' : topic.label,
      count: topic.count,
      firstIndex: topic.firstIndex,
      uncategorized: topic.uncategorized,
      href: topic.uncategorized ? null : buildHref(topic.topic)
    }));
  }

  function barScale(value: number): number {
    if (value <= 0 || scaleMaximum <= 0) {
      return 0;
    }

    return Math.min(1, value / scaleMaximum);
  }

  function exactValue(value: number): string {
    return value.toLocaleString('en-US', {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2
    });
  }

  function displayValue(value: number): string {
    try {
      return compact(value);
    } catch {
      return exactValue(value);
    }
  }

  function unitLabel(value: number): string {
    return value === 1 ? valueLabelSingular : valueLabel;
  }

  function share(value: number): number {
    return totalCount > 0 ? value / totalCount : 0;
  }

  function shareLabel(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      maximumFractionDigits: value > 0 && value < 0.01 ? 1 : 0
    }).format(value);
  }

  function isSelected(topic: TopicRow): boolean {
    if (!normalizedSelectedTopic) {
      return false;
    }

    return (
      topic.topic?.toLocaleLowerCase() === normalizedSelectedTopic ||
      topic.label.toLocaleLowerCase() === normalizedSelectedTopic
    );
  }

  function topicDescription(topic: TopicRow): string {
    const percentage = shareLabel(share(topic.count));

    return `${topic.label}: ${exactValue(topic.count)} ${unitLabel(
      topic.count
    )}, ${percentage} of all displayed topic volume.`;
  }
</script>

<section class="topic-bars" aria-label={ariaLabel}>
  {#if visibleTopics.length}
    <ol class:no-rank={!showRank}>
      {#each visibleTopics as topic, index (topic.key)}
        <li>
          {#if topic.href}
            <a
              class:selected={isSelected(topic)}
              class:uncategorized={topic.uncategorized}
              class="topic-row"
              href={topic.href}
              aria-current={isSelected(topic) ? 'page' : undefined}
              aria-label={topicDescription(topic)}
              title={topicDescription(topic)}
            >
              {#if showRank}
                <span class="rank" aria-hidden="true">
                  {index + 1}
                </span>
              {/if}

              <span class="topic-copy">
                <strong class="topic-title">
                  <TopicIcon label={topic.label} size={13} />
                  <span>{topic.label}</span>
                </strong>

                {#if showShare}
                  <span class="share">
                    {shareLabel(share(topic.count))} of total
                  </span>
                {/if}
              </span>

              <span class="bar" aria-hidden="true">
                <span
                  class="bar-fill"
                  style={`--bar-scale:${barScale(topic.count)}`}
                ></span>
              </span>

              <data class="value" value={String(topic.count)}>
                {displayValue(topic.count)}
              </data>
            </a>
          {:else}
            <div
              class:selected={isSelected(topic)}
              class:uncategorized={topic.uncategorized}
              class="topic-row static"
              role="group"
              aria-label={topicDescription(topic)}
              title={topicDescription(topic)}
            >
              {#if showRank}
                <span class="rank" aria-hidden="true">
                  {index + 1}
                </span>
              {/if}

              <span class="topic-copy">
                <strong class="topic-title">
                  <TopicIcon label={topic.label} size={13} />
                  <span>{topic.label}</span>
                </strong>

                {#if showShare}
                  <span class="share">
                    {shareLabel(share(topic.count))} of total
                  </span>
                {/if}
              </span>

              <span class="bar" aria-hidden="true">
                <span
                  class="bar-fill"
                  style={`--bar-scale:${barScale(topic.count)}`}
                ></span>
              </span>

              <data class="value" value={String(topic.count)}>
                {displayValue(topic.count)}
              </data>
            </div>
          {/if}
        </li>
      {/each}
    </ol>

    {#if showSummary}
      <p class="summary">
        Showing
        <strong>{visibleTopics.length.toLocaleString()}</strong>
        of
        <strong>{orderedTopics.length.toLocaleString()}</strong>
        topic categories

        {#if hiddenCount > 0}
          <span aria-hidden="true">·</span>
          <span>
            {hiddenCount.toLocaleString()} not shown
          </span>
        {/if}

        <span aria-hidden="true">·</span>

        <span>
          {displayValue(totalCount)} {unitLabel(totalCount)} total
        </span>
      </p>
    {/if}
  {:else}
    <p class="empty-state" role="status">
      {emptyMessage}
    </p>
  {/if}
</section>

<style>
  .topic-bars {
    min-width: 0;
    color: var(--color-ink, #1a1917);
  }

  ol {
    display: grid;
    gap: 3px;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  li {
    min-width: 0;
  }

  .topic-row {
    display: grid;
    grid-template-columns:
      30px
      minmax(140px, 1fr)
      minmax(120px, 1.8fr)
      minmax(60px, auto);
    grid-template-areas: 'rank topic bar value';
    gap: 12px;
    align-items: center;
    min-width: 0;
    min-height: 52px;
    padding: 8px 10px;
    color: inherit;
    text-decoration: none;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    transition:
      color 120ms ease,
      background-color 120ms ease,
      border-color 120ms ease;
  }

  ol.no-rank .topic-row {
    grid-template-columns:
      minmax(140px, 1fr)
      minmax(120px, 1.8fr)
      minmax(60px, auto);
    grid-template-areas: 'topic bar value';
  }

  a.topic-row:hover {
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

  a.topic-row:focus-visible {
    outline: 2px solid var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .topic-row.selected {
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 7%,
      var(--color-card, #fff)
    );
    border-color: var(--color-seal, #8a5a1a);
  }

  .topic-row.static {
    cursor: default;
  }

  .rank {
    grid-area: rank;
    color: var(--color-mute-soft, #9c9787);
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.68rem;
    line-height: 1rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .topic-copy {
    display: grid;
    grid-area: topic;
    gap: 1px;
    min-width: 0;
  }

  .topic-title {
    display: flex;
    gap: 7px;
    align-items: center;
    min-width: 0;
    overflow: hidden;
    color: currentColor;
    font-size: 0.86rem;
    font-weight: 600;
    line-height: 1.15rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .topic-title > span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .share {
    color: var(--color-mute, #6b6659);
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.64rem;
    line-height: 0.95rem;
    font-variant-numeric: tabular-nums;
  }

  .bar {
    position: relative;
    display: block;
    grid-area: bar;
    width: 100%;
    height: 9px;
    overflow: hidden;
    background: var(
      --color-track,
      color-mix(
        in srgb,
        var(--color-rule, #d9d2c1) 46%,
        var(--color-card, #fff)
      )
    );
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 2px;
  }

  .bar-fill {
    position: absolute;
    inset: -1px;
    background: var(--color-seal, #8a5a1a);
    border-radius: inherit;
    transform: scaleX(var(--bar-scale));
    transform-origin: left center;
    transition:
      transform 220ms ease-out,
      background-color 120ms ease;
  }

  a.topic-row:hover .bar-fill,
  .topic-row.selected .bar-fill {
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 84%,
      var(--color-ink, #1a1917)
    );
  }

  .topic-row.uncategorized .bar-fill {
    background: var(--color-mute-soft, #9c9787);
  }

  .value {
    grid-area: value;
    min-width: 0;
    color: var(--color-mute, #6b6659);
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.76rem;
    font-weight: 600;
    line-height: 1rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: 3px 7px;
    align-items: center;
    margin: 10px 0 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.72rem;
    line-height: 1.1rem;
  }

  .summary strong {
    color: var(--color-ink, #1a1917);
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .empty-state {
    min-height: 90px;
    padding: 24px 18px;
    margin: 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.84rem;
    line-height: 1.35rem;
    text-align: center;
    background: var(--color-card, #fff);
    border: 1px dashed var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  @media (max-width: 680px) {
    .topic-row {
      grid-template-columns:
        26px minmax(0, 1fr) auto;
      grid-template-areas:
        'rank topic value'
        '. bar bar';
      gap: 6px 9px;
      min-height: 60px;
      padding-block: 9px;
    }

    ol.no-rank .topic-row {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        'topic value'
        'bar bar';
    }

    .topic-title {
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .topic-title > span:last-child {
      white-space: normal;
    }
  }

  @media (max-width: 400px) {
    .topic-row {
      grid-template-columns:
        22px minmax(0, 1fr) auto;
      padding-inline: 7px;
    }

    .share {
      font-size: 0.61rem;
    }

    .value {
      font-size: 0.72rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .topic-row,
    .bar-fill {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .topic-row,
    .bar,
    .empty-state {
      color: CanvasText;
      background: Canvas;
      border-color: CanvasText;
    }

    .bar-fill,
    .topic-row.uncategorized .bar-fill {
      background: Highlight;
    }

    a.topic-row:focus-visible {
      outline-color: Highlight;
    }
  }

  @media print {
    .topic-row {
      color: #000;
      background: transparent;
      border-color: transparent;
      break-inside: avoid;
    }

    .bar {
      border-color: #999;
    }

    .bar-fill {
      background: #555;
      print-color-adjust: exact;
    }
  }
</style>
