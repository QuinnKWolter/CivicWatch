<script lang="ts">
  import { browser } from '$app/environment';
  import { env } from '$env/dynamic/public';
  import { replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import { onDestroy, untrack } from 'svelte';
  import { Shuffle } from 'lucide-svelte';
  import PostCard from './PostCard.svelte';

  type FilterValue =
    | string
    | number
    | boolean
    | string[]
    | null
    | undefined;

  interface Props {
    initialPosts?: any[];
    initialSeed?: string;
    apiBase?: string;
    sampleSize?: number;
    filters?: Record<string, FilterValue>;
    syncSeedToUrl?: boolean;
    title?: string;
    description?: string;
  }

  const DEFAULT_API_BASE =
    env.PUBLIC_API_BASE_URL ??
    'http://127.0.0.1:4000/api/v1';

  const {
    initialPosts = [],
    initialSeed = 'landing',
    apiBase = DEFAULT_API_BASE,
    sampleSize = 4,
    filters = {},
    syncSeedToUrl = true,
    title = 'The Sampler',
    description =
      'A handful of real public posts from this view. Shuffle to draw another reproducible sample.'
  }: Props = $props();

  const componentId = $props.id();
  const headingId = `${componentId}-heading`;
  const descriptionId = `${componentId}-description`;
  const gridId = `${componentId}-grid`;
  const statusId = `${componentId}-status`;

  const ALLOWED_FILTERS = [
    'state',
    'party',
    'chamber',
    'topic',
    'from',
    'to',
    'minEngagement',
    'political'
  ] as const;

  let posts = $state<any[]>(
    untrack(() =>
      Array.isArray(initialPosts) ? [...initialPosts] : []
    )
  );

  let seed = $state(
    untrack(() => normalizeSeed(initialSeed) || 'landing')
  );

  let loading = $state(false);
  let error = $state('');
  let status = $state('');
  let renderKey = $state(0);

  let controller: AbortController | undefined;
  let requestSequence = 0;

  const safeSampleSize = $derived(
    Number.isFinite(sampleSize)
      ? Math.min(12, Math.max(1, Math.trunc(sampleSize)))
      : 4
  );

  function normalizeSeed(value: string): string {
    return value.trim().slice(0, 160);
  }

  function isRecord(
    value: unknown
  ): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    );
  }

  function createSeed(): string {
    if (
      browser &&
      typeof crypto?.randomUUID === 'function'
    ) {
      return crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 12)}`;
  }

  function appendFilter(
    params: URLSearchParams,
    key: string,
    value: FilterValue
  ): void {
    if (Array.isArray(value)) {
      value
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => params.append(key, item));

      return;
    }

    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return;
    }

    params.set(key, String(value));
  }

  function addUrlFilters(
    params: URLSearchParams
  ): void {
    if (!browser) return;

    const url = new URL(window.location.href);

    for (const key of ALLOWED_FILTERS) {
      const values = url.searchParams
        .getAll(key)
        .filter(Boolean);

      values.forEach((value) =>
        params.append(key, value)
      );
    }

    const snapshot = url.searchParams.get('snap');

    if (snapshot) {
      params.set('snap', snapshot);
    }

    if (!params.has('state')) {
      const stateMatch =
        /^\/place\/([a-z]{2})\/?$/i.exec(
          url.pathname
        );

      if (stateMatch) {
        params.set(
          'state',
          stateMatch[1].toUpperCase()
        );
      }
    }

    if (!params.has('topic')) {
      const topicMatch =
        /^\/topic\/([^/]+)\/?$/i.exec(
          url.pathname
        );

      if (topicMatch) {
        params.set(
          'topic',
          decodeURIComponent(topicMatch[1])
        );
      }
    }
  }

  function buildParams(
    nextSeed: string
  ): URLSearchParams {
    const params = new URLSearchParams({
      seed: nextSeed,
      n: String(safeSampleSize)
    });

    addUrlFilters(params);

    for (const [key, value] of Object.entries(
      filters
    )) {
      params.delete(key);
      appendFilter(params, key, value);
    }

    return params;
  }

  function extractPosts(payload: unknown): any[] {
    if (!isRecord(payload)) {
      throw new Error('INVALID_RESPONSE');
    }

    if (Array.isArray(payload.data)) {
      return payload.data;
    }

    if (
      isRecord(payload.data) &&
      Array.isArray(payload.data.posts)
    ) {
      return payload.data.posts;
    }

    if (Array.isArray(payload.posts)) {
      return payload.posts;
    }

    throw new Error('INVALID_RESPONSE');
  }

  function extractSeed(
    payload: unknown,
    fallback: string
  ): string {
    if (!isRecord(payload)) {
      return fallback;
    }

    const data = isRecord(payload.data)
      ? payload.data
      : undefined;

    const meta = isRecord(payload.meta)
      ? payload.meta
      : undefined;

    const candidates = [
      data?.seed,
      meta?.seed,
      payload.seed
    ];

    for (const candidate of candidates) {
      if (
        typeof candidate === 'string' &&
        normalizeSeed(candidate)
      ) {
        return normalizeSeed(candidate);
      }
    }

    return fallback;
  }

  function errorMessage(
    statusCode: number
  ): string {
    if (
      statusCode === 400 ||
      statusCode === 422
    ) {
      return 'The current filter combination could not be sampled. Adjust the filters and try again.';
    }

    if (statusCode === 429) {
      return 'The sampler has been shuffled too frequently. Try again shortly.';
    }

    if (statusCode >= 500) {
      return 'The sampler is temporarily unavailable. The current posts remain in place.';
    }

    return `The sampler could not be updated (${statusCode}). The current posts remain in place.`;
  }

  function syncUrl(nextSeed: string): void {
    if (!browser || !syncSeedToUrl) return;

    const url = new URL(window.location.href);
    url.searchParams.set('seed', nextSeed);

    replaceState(
      `${url.pathname}${url.search}${url.hash}`,
      page.state
    );
  }

  async function shuffle(): Promise<void> {
    if (loading) return;

    const nextSeed = createSeed();
    const currentRequest = ++requestSequence;

    controller?.abort();
    controller = new AbortController();

    loading = true;
    error = '';
    status = 'Drawing a new sample.';

    const base = apiBase.replace(/\/+$/, '');
    const params = buildParams(nextSeed);

    try {
      const response = await fetch(
        `${base}/sampler?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            accept: 'application/json'
          },
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error(
          `HTTP_${response.status}`
        );
      }

      const payload: unknown =
        await response.json();

      const nextPosts = extractPosts(payload).slice(
        0,
        safeSampleSize
      );

      const resolvedSeed = extractSeed(
        payload,
        nextSeed
      );

      if (currentRequest !== requestSequence) {
        return;
      }

      posts = nextPosts;
      seed = resolvedSeed;
      renderKey += 1;

      syncUrl(resolvedSeed);

      status = nextPosts.length
        ? `Loaded ${nextPosts.length} new sample ${
            nextPosts.length === 1
              ? 'post'
              : 'posts'
          }.`
        : 'The current filters returned no sample posts.';
    } catch (cause) {
      if (
        cause instanceof DOMException &&
        cause.name === 'AbortError'
      ) {
        return;
      }

      if (currentRequest !== requestSequence) {
        return;
      }

      const match =
        cause instanceof Error
          ? /^HTTP_(\d+)$/.exec(cause.message)
          : null;

      error = match
        ? errorMessage(Number(match[1]))
        : cause instanceof Error &&
            cause.message === 'INVALID_RESPONSE'
          ? 'The sampler returned an unexpected response. The current posts remain in place.'
          : 'The sampler could not be updated. Check your connection and try again.';

      status = error;
    } finally {
      if (currentRequest === requestSequence) {
        loading = false;
      }
    }
  }

  onDestroy(() => {
    controller?.abort();
  });
</script>

<section
  class="sampler"
  aria-labelledby={headingId}
  aria-describedby={descriptionId}
  aria-busy={loading}
>
  <header class="section-head">
    <div class="heading-copy">
      <p class="eyebrow">Public statements</p>

      <h2 id={headingId}>{title}</h2>

      <p id={descriptionId} class="caption">
        {description}
      </p>
    </div>

    <button
      class="shuffle-button"
      type="button"
      aria-controls={gridId}
      aria-describedby={statusId}
      aria-busy={loading}
      disabled={loading}
      onclick={() => void shuffle()}
    >
      <Shuffle
        size={17}
        strokeWidth={1.75}
        aria-hidden="true"
      />

      <span>
        {loading ? 'Shuffling' : 'Shuffle'}
      </span>
    </button>
  </header>

  <p
    id={statusId}
    class="visually-hidden"
    aria-live="polite"
    aria-atomic="true"
  >
    {status}
  </p>

  {#if error}
    <div class="notice" role="alert">
      <p>{error}</p>

      <button
        type="button"
        class="retry-button"
        onclick={() => void shuffle()}
      >
        Try again
      </button>
    </div>
  {/if}

  <div class="sample-stage">
    {#if loading}
      <div
        class="progress"
        aria-hidden="true"
      >
        <span></span>
      </div>
    {/if}

    {#if posts.length}
      {#key renderKey}
        <ul
          id={gridId}
          class:refreshing={loading}
          class="sampler-grid"
          aria-label="Sample posts"
        >
          {#each posts as post, index (`${seed}-${index}`)}
            <li
              class="sampler-item"
              style={`--sample-index: ${index}`}
            >
              <PostCard {post} />
            </li>
          {/each}
        </ul>
      {/key}
    {:else if loading}
      <div
        id={gridId}
        class="sampler-grid skeleton-grid"
        aria-label="Loading sample posts"
      >
        {#each Array(safeSampleSize) as _, index}
          <div
            class="skeleton"
            aria-hidden="true"
            style={`--sample-index: ${index}`}
          >
            <span
              class="skeleton-line skeleton-meta"
            ></span>

            <span class="skeleton-line"></span>
            <span class="skeleton-line"></span>

            <span
              class="skeleton-line skeleton-short"
            ></span>
          </div>
        {/each}
      </div>
    {:else}
      <div
        id={gridId}
        class="empty-state"
        role="status"
      >
        <h3>No posts in this sample</h3>

        <p>
          The current filters did not return any
          posts. Broaden the view or draw another
          sample.
        </p>

        <button
          type="button"
          class="empty-action"
          onclick={() => void shuffle()}
        >
          <Shuffle
            size={16}
            strokeWidth={1.75}
            aria-hidden="true"
          />

          Draw another sample
        </button>
      </div>
    {/if}
  </div>
</section>

<style>
  .sampler {
    min-width: 0;
  }

  .section-head {
    display: flex;
    gap: 24px;
    align-items: end;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .heading-copy {
    min-width: 0;
    max-width: 760px;
  }

  .eyebrow {
    margin: 0 0 4px;
    color: var(--color-seal, #8a5a1a);
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    color: var(--color-ink, #1a1917);
    font-size: clamp(
      1.5rem,
      1.3rem + 0.7vw,
      1.875rem
    );
    line-height: 1.18;
    letter-spacing: -0.01em;
  }

  .caption {
    margin: 6px 0 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.875rem;
    line-height: 1.35rem;
  }

  .shuffle-button,
  .retry-button,
  .empty-action {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    min-height: 42px;
    padding: 8px 13px;
    color: var(--color-ink, #1a1917);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    background: var(--color-card, #fff);
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
    cursor: pointer;
    transition:
      border-color 120ms ease,
      background-color 120ms ease,
      color 120ms ease;
  }

  .shuffle-button:hover:not(:disabled),
  .retry-button:hover,
  .empty-action:hover {
    border-color: var(--color-seal, #8a5a1a);
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 7%,
      var(--color-card, #fff)
    );
  }

  .shuffle-button:focus-visible,
  .retry-button:focus-visible,
  .empty-action:focus-visible {
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .shuffle-button:disabled {
    cursor: progress;
    opacity: 0.68;
  }

  .notice {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding: 10px 12px;
    color: var(--color-error, #8a2a20);
    background: color-mix(
      in srgb,
      var(--color-error, #8a2a20) 6%,
      var(--color-card, #fff)
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--color-error, #8a2a20) 30%,
        var(--color-rule, #d9d2c1)
      );
    border-radius: 6px;
  }

  .notice p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.3rem;
  }

  .retry-button {
    min-height: 34px;
    padding: 5px 10px;
    color: inherit;
    background: transparent;
    border-color: currentColor;
    flex: 0 0 auto;
  }

  .sample-stage {
    position: relative;
    min-height: 220px;
  }

  .progress {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    z-index: 3;
    height: 2px;
    overflow: hidden;
    background: var(
      --color-rule,
      #d9d2c1
    );
  }

  .progress span {
    display: block;
    width: 34%;
    height: 100%;
    background: var(
      --color-seal,
      #8a5a1a
    );
    animation: sampler-progress 900ms
      ease-in-out infinite alternate;
  }

  .sampler-grid {
    display: grid;
    grid-template-columns: repeat(
      4,
      minmax(0, 1fr)
    );
    gap: 16px;
    min-height: 220px;
    padding: 0;
    margin: 0;
    list-style: none;
    transition: opacity 120ms ease;
  }

  .sampler-grid.refreshing {
    opacity: 0.58;
  }

  .sampler-item {
    min-width: 0;
    list-style: none;
    animation: sample-enter 200ms ease-out both;
    animation-delay: calc(
      var(--sample-index) * 28ms
    );
  }

  .sampler-item::marker {
    content: '';
  }

  .skeleton-grid {
    opacity: 1;
  }

  .skeleton {
    min-height: 220px;
    padding: 16px;
    background: var(--color-card, #fff);
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  .skeleton-line {
    display: block;
    width: 100%;
    height: 12px;
    margin-bottom: 12px;
    background: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 68%,
      var(--color-card, #fff)
    );
    border-radius: 2px;
  }

  .skeleton-meta {
    width: 46%;
    height: 10px;
    margin-bottom: 24px;
  }

  .skeleton-short {
    width: 68%;
  }

  .empty-state {
    display: grid;
    min-height: 220px;
    padding: 32px;
    place-items: center;
    align-content: center;
    text-align: center;
    background: var(--color-card, #fff);
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  .empty-state h3 {
    margin: 0;
    color: var(--color-ink, #1a1917);
    font-size: 1.0625rem;
    line-height: 1.45rem;
  }

  .empty-state p {
    max-width: 520px;
    margin: 6px 0 16px;
    color: var(--color-mute, #6b6659);
    font-size: 0.875rem;
    line-height: 1.35rem;
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

  @keyframes sample-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes sampler-progress {
    from {
      transform: translateX(-10%);
    }

    to {
      transform: translateX(205%);
    }
  }

  @media (max-width: 1080px) {
    .sampler-grid {
      grid-template-columns: repeat(
        2,
        minmax(0, 1fr)
      );
    }
  }

  @media (max-width: 680px) {
    .section-head {
      gap: 16px;
      align-items: start;
    }

    .shuffle-button {
      width: 42px;
      padding-inline: 0;
      flex: 0 0 42px;
    }

    .shuffle-button span {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .sampler-grid {
      grid-template-columns: none;
      grid-auto-flow: column;
      grid-auto-columns: minmax(
        280px,
        min(84vw, 340px)
      );
      gap: 12px;
      padding: 2px 2px 10px;
      overflow-x: auto;
      overscroll-behavior-inline: contain;
      scroll-snap-type: inline proximity;
      scrollbar-width: thin;
    }

    .sampler-item,
    .skeleton {
      scroll-snap-align: start;
    }

    .notice {
      align-items: flex-start;
    }
  }

  @media (max-width: 380px) {
    .sampler-grid {
      grid-auto-columns: calc(
        100vw - 40px
      );
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .shuffle-button,
    .retry-button,
    .empty-action,
    .sampler-grid {
      transition: none;
    }

    .sampler-item {
      animation: none;
    }

    .progress span {
      width: 100%;
      animation: none;
      transform: none;
    }
  }
</style>
