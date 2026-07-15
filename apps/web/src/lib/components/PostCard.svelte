<script lang="ts">
  import {
    ExternalLink,
    Heart,
    MessageCircle,
    Repeat2
  } from 'lucide-svelte';

  import {
    dateLabel,
    integer,
    partyInitial,
    titleCasePersonName
  } from '$lib/format';
  import TopicIcon from './TopicIcon.svelte';

  interface Props {
    post?: any;
    profileBase?: string;
    topicBase?: string;
    showTopic?: boolean;
    showEngagement?: boolean;
    showSourceLink?: boolean;
    sourceLabel?: string;
    compact?: boolean;
    ariaLabel?: string | null;
  }

  interface NormalizedPost {
    id: string | null;
    text: string;
    textAvailable: boolean;

    createdAt: unknown;
    createdLabel: string;
    createdDateTime: string | null;

    topicId: string | null;
    topicLabel: string;

    legislatorId: string | null;
    legislatorName: string;
    handle: string | null;
    party: string | null;
    state: string | null;
    chamber: string | null;
    district: string | null;

    likeCount: number | null;
    repostCount: number | null;
    replyCount: number | null;

    sourceHref: string | null;
  }

  let {
    post = null,
    profileBase = '/who',
    topicBase = '/topic',
    showTopic = true,
    showEngagement = true,
    showSourceLink = true,
    sourceLabel = 'View original',
    compact = false,
    ariaLabel = null
  }: Props = $props();

  const normalized = $derived(
    normalizePost(post)
  );

  const profileHref = $derived(
    buildInternalHref(
      profileBase,
      normalized.legislatorId,
      '/who'
    )
  );

  const topicHref = $derived(
    buildInternalHref(
      topicBase,
      normalized.topicId,
      '/topic'
    )
  );

  const sourceIsExternal = $derived(
    isExternalHref(normalized.sourceHref)
  );

  const partyLabel = $derived(
    normalized.party ?? 'Party unknown'
  );

  const partyClass = $derived(
    classifyParty(normalized.party)
  );

  const partyAbbreviation = $derived(
    cleanInlineText(
      partyInitial(normalized.party)
    ) ?? '—'
  );

  const contextParts = $derived.by(() => {
    const parts = [
      partyLabel,
      normalized.state ??
        'State unavailable',
      normalized.chamber,
      normalized.district
        ? `District ${normalized.district}`
        : null
    ];

    return parts.filter(
      (part): part is string =>
        Boolean(part)
    );
  });

  const cardLabel = $derived(
    ariaLabel?.trim() ||
      `${normalized.legislatorName} post about ${normalized.topicLabel}`
  );

  const hasFooter = $derived(
    showEngagement ||
      Boolean(
        showSourceLink &&
          normalized.sourceHref
      )
  );

  function cleanInlineText(
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

  function cleanPostText(
    value: unknown
  ): string | null {
    if (
      typeof value !== 'string' &&
      typeof value !== 'number'
    ) {
      return null;
    }

    const text = String(value)
      .replace(/\r\n?/g, '\n')
      .trim();

    return text || null;
  }

  function normalizeHandle(
    value: unknown
  ): string | null {
    const handle = cleanInlineText(value);

    return handle
      ? handle.replace(/^@+/, '')
      : null;
  }

  function normalizeState(
    value: unknown
  ): string | null {
    const state = cleanInlineText(value);

    if (!state) return null;

    return state.length <= 3
      ? state.toUpperCase()
      : state;
  }

  function normalizeChamber(
    value: unknown
  ): string | null {
    const chamber = cleanInlineText(value);

    if (!chamber) return null;

    const normalizedValue =
      chamber.toLocaleLowerCase();

    if (
      normalizedValue === 'h' ||
      normalizedValue === 'house' ||
      normalizedValue === 'lower' ||
      normalizedValue === 'lower chamber'
    ) {
      return 'House';
    }

    if (
      normalizedValue === 's' ||
      normalizedValue === 'senate' ||
      normalizedValue === 'upper' ||
      normalizedValue === 'upper chamber'
    ) {
      return 'Senate';
    }

    return chamber;
  }

  function normalizeParty(
    value: unknown
  ): string | null {
    const party = cleanInlineText(value);

    if (!party) return null;

    const normalizedValue =
      party.toLocaleLowerCase();

    if (
      normalizedValue === 'd' ||
      normalizedValue === 'dem' ||
      normalizedValue === 'democrat' ||
      normalizedValue === 'democratic'
    ) {
      return 'Democratic';
    }

    if (
      normalizedValue === 'r' ||
      normalizedValue === 'rep' ||
      normalizedValue === 'republican'
    ) {
      return 'Republican';
    }

    if (
      normalizedValue === 'i' ||
      normalizedValue === 'ind' ||
      normalizedValue === 'independent'
    ) {
      return 'Independent';
    }

    if (
      normalizedValue === 'unknown' ||
      normalizedValue === 'unavailable' ||
      normalizedValue === 'unclassified'
    ) {
      return null;
    }

    return party;
  }

  function normalizeCount(
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

    if (!Number.isFinite(number)) {
      return null;
    }

    return Math.max(
      0,
      Math.trunc(number)
    );
  }

  function normalizeSourceHref(
    value: unknown
  ): string | null {
    const href = cleanInlineText(value);

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

    if (
      href.startsWith('/') ||
      href.startsWith('#') ||
      href.startsWith('?') ||
      href.startsWith('//') ||
      /^https?:\/\//i.test(href)
    ) {
      return href;
    }

    return null;
  }

  function safeDateLabel(
    value: unknown
  ): string {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return 'Date unavailable';
    }

    try {
      const formatted = dateLabel(String(value));

      return (
        cleanInlineText(formatted) ??
        'Date unavailable'
      );
    } catch {
      return (
        cleanInlineText(value) ??
        'Date unavailable'
      );
    }
  }

  function dateTimeValue(
    value: unknown
  ): string | null {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return null;
    }

    const timestamp = Date.parse(
      String(value)
    );

    if (!Number.isFinite(timestamp)) {
      return null;
    }

    try {
      return new Date(
        timestamp
      ).toISOString();
    } catch {
      return null;
    }
  }

  function normalizePost(
    value: any
  ): NormalizedPost {
    const source =
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
        ? value
        : {};

    const legislator =
      source.legislator &&
      typeof source.legislator ===
        'object' &&
      !Array.isArray(source.legislator)
        ? source.legislator
        : {};

    const handle =
      normalizeHandle(
        legislator.handle ??
          legislator.username ??
          source.handle
      );

    const rawLegislatorName =
      cleanInlineText(
        legislator.name ??
          legislator.displayName ??
          legislator.display_name ??
          source.legislatorName ??
          source.legislator_name
      );

    const legislatorName =
      rawLegislatorName
        ? titleCasePersonName(rawLegislatorName)
        : (handle ? `@${handle}` : null) ??
          'Unknown legislator';

    const topicId =
      cleanInlineText(
        source.topic ??
          source.topicId ??
          source.topic_id
      );

    const topicLabel =
      cleanInlineText(
        source.topicLabel ??
          source.topic_label
      ) ??
      (topicId
        ? `Topic ${topicId}`
        : 'Topic unknown');

    const text = cleanPostText(
      source.text ??
        source.postText ??
        source.post_text ??
        source.content
    );

    const createdAt =
      source.createdAt ??
      source.created_at ??
      source.postedAt ??
      source.posted_at ??
      source.date;

    /*
     * Add any API-specific canonical URL field here if
     * CivicWatch ultimately exposes a differently named field.
     */
    const sourceHref =
      normalizeSourceHref(
        source.sourceUrl ??
          source.source_url ??
          source.postUrl ??
          source.post_url ??
          source.xUrl ??
          source.x_url ??
          source.permalink ??
          source.url
      );

    return {
      id:
        cleanInlineText(
          source.id ??
            source.postId ??
            source.post_id ??
            source.tweetId ??
            source.tweet_id
        ),

      text:
        text ?? 'Post text unavailable.',

      textAvailable: text !== null,

      createdAt,
      createdLabel:
        safeDateLabel(createdAt),

      createdDateTime:
        dateTimeValue(createdAt),

      topicId,
      topicLabel,

      legislatorId:
        cleanInlineText(
          legislator.lid ??
            legislator.id ??
            source.lid ??
            source.legislatorId ??
            source.legislator_id
        ),

      legislatorName,
      handle,

      party: normalizeParty(
        legislator.party ??
          source.party
      ),

      state: normalizeState(
        legislator.state ??
          source.state
      ),

      chamber: normalizeChamber(
        legislator.chamber ??
          source.chamber
      ),

      district: cleanInlineText(
        legislator.district ??
          legislator.districtLabel ??
          legislator.district_label ??
          source.district
      ),

      likeCount: normalizeCount(
        source.likeCount ??
          source.like_count ??
          source.likes
      ),

      repostCount: normalizeCount(
        source.retweetCount ??
          source.retweet_count ??
          source.repostCount ??
          source.repost_count ??
          source.reposts
      ),

      replyCount: normalizeCount(
        source.replyCount ??
          source.reply_count ??
          source.replies
      ),

      sourceHref
    };
  }

  function buildInternalHref(
    base: string,
    segment: string | null,
    fallbackBase: string
  ): string | null {
    if (!segment) return null;

    const candidate =
      typeof base === 'string'
        ? base.trim()
        : '';

    const safeBase =
      candidate.startsWith('/')
        ? candidate.replace(/\/+$/, '')
        : fallbackBase;

    return `${safeBase}/${encodeURIComponent(
      segment
    )}`;
  }

  function isExternalHref(
    href: string | null
  ): boolean {
    return Boolean(
      href &&
        (href.startsWith('//') ||
          /^https?:\/\//i.test(href))
    );
  }

  function classifyParty(
    party: string | null
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

    if (party === null) {
      return 'unknown';
    }

    return 'other';
  }

  function displayCount(
    value: number | null
  ): string {
    return value === null
      ? '—'
      : integer(value);
  }

  function metricLabel(
    value: number | null,
    singular: string,
    plural: string
  ): string {
    if (value === null) return plural;

    return value === 1
      ? singular
      : plural;
  }
</script>

<article
  class:compact
  class="post-card"
  aria-label={cardLabel}
>
  <header class="post-header">
    <div class="author-region">
      <span
        class={`party-mark ${partyClass}`}
        title={partyLabel}
        aria-hidden="true"
      >
        {partyAbbreviation}
      </span>

      <div class="author-copy">
        <div class="identity-line">
          <h3>
            {#if profileHref}
              <a
                class="author-link"
                href={profileHref}
              >
                {normalized.legislatorName}
              </a>
            {:else}
              {normalized.legislatorName}
            {/if}
          </h3>

          {#if normalized.handle}
            <span class="handle">
              @{normalized.handle}
            </span>
          {/if}
        </div>

        <p class="context">
          {#each contextParts as part, index (part)}
            {#if index > 0}
              <span
                class="separator"
                aria-hidden="true"
              >
                ·
              </span>
            {/if}

            <span>{part}</span>
          {/each}
        </p>
      </div>
    </div>

    <time
      class="post-date"
      datetime={normalized.createdDateTime ??
        undefined}
    >
      {normalized.createdLabel}
    </time>
  </header>

  <p
    class:unavailable={!normalized.textAvailable}
    class="post-text"
  >
    {normalized.text}
  </p>

  {#if showTopic}
    <div
      class="post-taxonomy"
      aria-label="Post topic"
    >
      {#if topicHref}
        <a
          class="topic-chip"
          href={topicHref}
        >
          <TopicIcon label={normalized.topicLabel} size={13} />

          <span>{normalized.topicLabel}</span>
        </a>
      {:else}
        <span
          class="topic-chip static"
        >
          <TopicIcon label={normalized.topicLabel} size={13} />

          <span>{normalized.topicLabel}</span>
        </span>
      {/if}
    </div>
  {/if}

  {#if hasFooter}
    <footer class="post-footer">
      {#if showEngagement}
        <ul
          class="engagement"
          aria-label="Engagement metrics"
        >
          <li
            class:unavailable={
              normalized.likeCount === null
            }
          >
            <Heart
              size={15}
              strokeWidth={1.7}
              aria-hidden="true"
            />

            <data
              value={normalized.likeCount ===
              null
                ? undefined
                : String(
                    normalized.likeCount
                  )}
            >
              {displayCount(
                normalized.likeCount
              )}
            </data>

            <span>
              {metricLabel(
                normalized.likeCount,
                'like',
                'likes'
              )}
            </span>
          </li>

          <li
            class:unavailable={
              normalized.repostCount === null
            }
          >
            <Repeat2
              size={15}
              strokeWidth={1.7}
              aria-hidden="true"
            />

            <data
              value={normalized.repostCount ===
              null
                ? undefined
                : String(
                    normalized.repostCount
                  )}
            >
              {displayCount(
                normalized.repostCount
              )}
            </data>

            <span>
              {metricLabel(
                normalized.repostCount,
                'repost',
                'reposts'
              )}
            </span>
          </li>

          <li
            class:unavailable={
              normalized.replyCount === null
            }
          >
            <MessageCircle
              size={15}
              strokeWidth={1.7}
              aria-hidden="true"
            />

            <data
              value={normalized.replyCount ===
              null
                ? undefined
                : String(
                    normalized.replyCount
                  )}
            >
              {displayCount(
                normalized.replyCount
              )}
            </data>

            <span>
              {metricLabel(
                normalized.replyCount,
                'reply',
                'replies'
              )}
            </span>
          </li>
        </ul>
      {/if}

      {#if
        showSourceLink &&
        normalized.sourceHref
      }
        <a
          class="source-link"
          href={normalized.sourceHref}
          target={sourceIsExternal
            ? '_blank'
            : undefined}
          rel={sourceIsExternal
            ? 'noopener noreferrer'
            : undefined}
          aria-label={sourceIsExternal
            ? `${sourceLabel} in a new tab`
            : sourceLabel}
        >
          <span>{sourceLabel}</span>

          <ExternalLink
            size={14}
            strokeWidth={1.7}
            aria-hidden="true"
          />
        </a>
      {/if}
    </footer>
  {/if}
</article>

<style>
  .post-card {
    container-type: inline-size;
    display: grid;
    gap: 14px;
    width: 100%;
    min-width: 0;
    padding: 16px;
    color: var(--color-ink, #1a1917);
    background: var(--color-card, #fff);
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
    content-visibility: auto;
    contain-intrinsic-block-size: 250px;
    transition:
      border-color 140ms ease,
      box-shadow 140ms ease;
  }

  .post-card:hover {
    border-color: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 42%,
      var(--color-rule, #d9d2c1)
    );
    box-shadow: 0 3px 14px
      rgb(26 25 23 / 5%);
  }

  .post-card:focus-within {
    border-color: var(--color-seal, #8a5a1a);
    box-shadow: 0 0 0 2px
      color-mix(
        in srgb,
        var(--color-seal, #8a5a1a) 18%,
        transparent
      );
  }

  .post-card.compact {
    gap: 11px;
    padding: 13px 14px;
  }

  .post-header {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr) auto;
    gap: 12px 18px;
    align-items: start;
    min-width: 0;
  }

  .author-region {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    min-width: 0;
  }

  .party-mark {
    display: grid;
    width: 34px;
    height: 34px;
    margin-top: 1px;
    place-items: center;
    color: var(--color-card, #fff);
    font-family: var(
      --font-data,
      var(
        --type-mono,
        'JetBrains Mono',
        ui-monospace,
        monospace
      )
    );
    font-size: 0.7rem;
    font-weight: 700;
    line-height: 1;
    background: var(
      --color-mute-soft,
      #9c9787
    );
    border: 1px solid transparent;
    flex: 0 0 auto;
  }

  .compact .party-mark {
    width: 30px;
    height: 30px;
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
    border-radius: 3px;
  }

  .party-mark.independent {
    width: 28px;
    height: 28px;
    margin: 4px 3px 0;
    background: var(
      --color-independent,
      #7a6a4a
    );
    border-radius: 3px;
    transform: rotate(45deg);
  }

  .party-mark.independent {
    color: transparent;
  }

  .party-mark.unknown {
    color: var(--color-mute, #6b6659);
    background: transparent;
    border-color: var(
      --color-mute-soft,
      #9c9787
    );
    border-radius: 50%;
  }

  .party-mark.other {
    background: var(
      --color-mute,
      #6b6659
    );
    border-radius: 50% 4px 50% 4px;
  }

  .author-copy {
    min-width: 0;
  }

  .identity-line {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 8px;
    align-items: baseline;
    min-width: 0;
  }

  h3 {
    min-width: 0;
    margin: 0;
    color: var(--color-ink, #1a1917);
    font-size: 0.95rem;
    font-weight: 650;
    line-height: 1.3rem;
  }

  .author-link {
    overflow-wrap: anywhere;
    color: inherit;
    text-decoration-line: underline;
    text-decoration-color: transparent;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
    border-radius: 2px;
    transition:
      color 120ms ease,
      text-decoration-color 120ms ease;
  }

  .author-link:hover {
    color: var(--color-seal, #8a5a1a);
    text-decoration-color: currentColor;
  }

  .author-link:focus-visible,
  .topic-chip:focus-visible,
  .source-link:focus-visible {
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .handle {
    max-width: 22rem;
    overflow: hidden;
    color: var(--color-mute, #6b6659);
    font-size: 0.78rem;
    line-height: 1.1rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .context {
    display: flex;
    flex-wrap: wrap;
    gap: 1px 5px;
    margin: 2px 0 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.75rem;
    line-height: 1.1rem;
  }

  .separator {
    color: var(
      --color-mute-soft,
      #9c9787
    );
  }

  .post-date {
    padding-top: 2px;
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
    font-size: 0.7rem;
    line-height: 1rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .post-text {
    max-width: 76ch;
    margin: 0;
    color: var(--color-ink, #1a1917);
    font-size: 0.9375rem;
    line-height: 1.52rem;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
    word-break: normal;
  }

  .compact .post-text {
    font-size: 0.875rem;
    line-height: 1.42rem;
  }

  .post-text.unavailable {
    color: var(--color-mute, #6b6659);
    font-style: italic;
  }

  .post-taxonomy {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    align-items: center;
  }

  .topic-chip {
    display: inline-flex;
    gap: 7px;
    align-items: center;
    max-width: 100%;
    min-height: 30px;
    padding: 4px 9px;
    color: var(--color-mute, #6b6659);
    font-size: 0.76rem;
    font-weight: 500;
    line-height: 1.05rem;
    text-decoration: none;
    background: var(
      --color-elevated,
      var(--color-card, #fff)
    );
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 999px;
    transition:
      color 120ms ease,
      background-color 120ms ease,
      border-color 120ms ease;
  }

  .topic-chip > span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  a.topic-chip:hover {
    color: var(--color-seal, #8a5a1a);
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 6%,
      var(--color-card, #fff)
    );
    border-color: var(--color-seal, #8a5a1a);
  }

  .topic-chip.static {
    cursor: default;
  }

  .post-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 16px;
    align-items: center;
    justify-content: space-between;
    min-width: 0;
    padding-top: 11px;
    border-top: 1px solid
      var(--color-rule, #d9d2c1);
  }

  .engagement {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    align-items: center;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .engagement li {
    display: inline-flex;
    gap: 5px;
    align-items: center;
    color: var(--color-mute, #6b6659);
    font-size: 0.72rem;
    line-height: 1rem;
    white-space: nowrap;
  }

  .engagement data {
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

  .engagement li.unavailable {
    color: var(
      --color-mute-soft,
      #9c9787
    );
  }

  .engagement li.unavailable data {
    color: inherit;
  }

  .source-link {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    min-height: 32px;
    padding: 4px 2px;
    color: var(--color-mute, #6b6659);
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1rem;
    text-decoration-line: underline;
    text-decoration-color: transparent;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
    border-radius: 3px;
    white-space: nowrap;
    transition:
      color 120ms ease,
      text-decoration-color 120ms ease;
  }

  .source-link:hover {
    color: var(--color-seal, #8a5a1a);
    text-decoration-color: currentColor;
  }

  @container (max-width: 360px) {
    .post-header {
      grid-template-columns: minmax(0, 1fr);
      gap: 8px;
    }

    .identity-line {
      display: grid;
      gap: 1px;
      align-items: start;
    }

    .handle {
      max-width: 100%;
    }

    .post-date {
      width: fit-content;
      padding-top: 0;
      padding-left: 40px;
    }

    .post-footer {
      align-items: flex-start;
      flex-direction: column;
    }

    .engagement {
      width: 100%;
      gap: 8px 12px;
    }

    .topic-chip {
      width: 100%;
      justify-content: flex-start;
      border-radius: 6px;
    }
  }

  @container (max-width: 260px) {
    .author-region {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 8px;
    }

    .post-date {
      padding-left: 0;
    }

    .engagement {
      display: grid;
      grid-template-columns: 1fr;
    }

    .engagement li {
      white-space: normal;
    }
  }

  @media (max-width: 600px) {
    .post-card {
      gap: 13px;
      padding: 14px;
    }

    .post-header {
      grid-template-columns: minmax(0, 1fr);
      gap: 7px;
    }

    .post-date {
      padding-left: 44px;
    }

    .post-footer {
      align-items: flex-start;
      flex-direction: column;
    }

    .engagement {
      width: 100%;
      gap: 9px 14px;
    }
  }

  @media (max-width: 400px) {
    .party-mark {
      width: 32px;
      height: 32px;
    }

    .author-region {
      gap: 9px;
    }

    .post-date {
      padding-left: 41px;
    }

    .engagement {
      display: grid;
      grid-template-columns:
        repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .engagement li {
      display: grid;
      grid-template-columns: auto auto;
      gap: 1px 5px;
      align-items: center;
    }

    .engagement li > span {
      grid-column: 1 / -1;
      font-size: 0.66rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .post-card,
    .author-link,
    .topic-chip,
    .source-link {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .post-card,
    .topic-chip,
    .party-mark {
      color: CanvasText;
      background: Canvas;
      border-color: CanvasText;
    }

    .party-mark.democratic,
    .party-mark.republican,
    .party-mark.independent,
    .party-mark.other {
      color: Canvas;
      background: CanvasText;
    }

    .author-link:focus-visible,
    .topic-chip:focus-visible,
    .source-link:focus-visible {
      outline-color: Highlight;
    }
  }

  @media print {
    .post-card {
      color: #000;
      background: transparent;
      border-color: #999;
      box-shadow: none;
      content-visibility: visible;
      contain-intrinsic-size: auto;
      break-inside: avoid;
    }

    .source-link {
      color: #000;
      text-decoration: none;
    }
  }
</style>
