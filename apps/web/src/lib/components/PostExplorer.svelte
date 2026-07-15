<script lang="ts">
  import { env } from '$env/dynamic/public';
  import { onDestroy, untrack } from 'svelte';
  import { Clock3, Plus, Shuffle, TrendingUp } from 'lucide-svelte';
  import AsyncSampler from './AsyncSampler.svelte';
  import PanelHeader from './PanelHeader.svelte';
  import PostCard from './PostCard.svelte';

  type FilterValue =
    | string
    | number
    | boolean
    | string[]
    | null
    | undefined;

  interface Props {
    title?: string;
    caption?: string;
    source?: string;
    initialTopPosts?: any[];
    initialRecentPosts?: any[];
    initialRecentCursor?: string | number | null;
    filters?: Record<string, FilterValue>;
    apiBase?: string;
    sampleSize?: number;
    pageSize?: number;
  }

  const DEFAULT_API_BASE =
    env.PUBLIC_API_BASE_URL ??
    'http://127.0.0.1:4000/api/v1';

  const {
    title = 'Post explorer',
    caption = 'Move between high-engagement examples, all posts by recency, and representative samples.',
    source = 'posts',
    initialTopPosts = [],
    initialRecentPosts = [],
    initialRecentCursor = null,
    filters = {},
    apiBase = DEFAULT_API_BASE,
    sampleSize = 6,
    pageSize = 8
  }: Props = $props();

  const componentId = $props.id();
  const statusId = `${componentId}-status`;

  let mode = $state<'top' | 'recent' | 'sample'>('top');
  let recentPosts = $state<any[]>(
    untrack(() => Array.isArray(initialRecentPosts) ? [...initialRecentPosts] : [])
  );
  let recentCursor = $state<string | number | null>(
    untrack(() => initialRecentCursor ?? null)
  );
  let recentLoaded = $state(untrack(() => Array.isArray(initialRecentPosts) && initialRecentPosts.length > 0));
  let loading = $state(false);
  let error = $state('');

  let controller: AbortController | undefined;
  let requestSequence = 0;

  const safePageSize = $derived(
    Number.isFinite(pageSize)
      ? Math.min(24, Math.max(1, Math.trunc(pageSize)))
      : 8
  );

  const safeSampleSize = $derived(
    Number.isFinite(sampleSize)
      ? Math.min(12, Math.max(1, Math.trunc(sampleSize)))
      : 6
  );

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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

    if (value === null || value === undefined || value === '') return;

    params.set(key, String(value));
  }

  function buildParams(cursor: string | number | null): URLSearchParams {
    const params = new URLSearchParams({
      limit: String(safePageSize)
    });

    if (cursor !== null && cursor !== '') {
      params.set('cursor', String(cursor));
    }

    for (const [key, value] of Object.entries(filters)) {
      appendFilter(params, key, value);
    }

    return params;
  }

  function extractRows(payload: unknown): any[] {
    if (!isRecord(payload) || !Array.isArray(payload.data)) {
      throw new Error('INVALID_RESPONSE');
    }

    return payload.data;
  }

  function extractCursor(payload: unknown): string | number | null {
    if (!isRecord(payload) || !isRecord(payload.meta)) return null;
    const cursor = payload.meta.nextCursor;
    return typeof cursor === 'string' || typeof cursor === 'number'
      ? cursor
      : null;
  }

  function errorMessage(status: number): string {
    if (status === 429) {
      return 'The post explorer is receiving too many requests. Try again shortly.';
    }

    if (status >= 500) {
      return 'The post explorer is temporarily unavailable. Current posts remain visible.';
    }

    return `The post explorer could not be updated (${status}).`;
  }

  async function loadRecent(reset = false): Promise<void> {
    if (loading) return;

    const currentRequest = ++requestSequence;
    controller?.abort();
    controller = new AbortController();
    loading = true;
    error = '';

    try {
      const base = apiBase.replace(/\/+$/, '');
      const params = buildParams(reset ? null : recentCursor);
      const response = await fetch(
        `${base}/posts/explore?${params.toString()}`,
        {
          method: 'GET',
          headers: { accept: 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      const payload: unknown = await response.json();
      const rows = extractRows(payload);
      const nextCursor = extractCursor(payload);

      if (currentRequest !== requestSequence) return;

      recentPosts = reset ? rows : [...recentPosts, ...rows];
      recentCursor = nextCursor;
      recentLoaded = true;
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') {
        return;
      }

      if (currentRequest !== requestSequence) return;

      const match =
        cause instanceof Error
          ? /^HTTP_(\d+)$/.exec(cause.message)
          : null;

      error = match
        ? errorMessage(Number(match[1]))
        : cause instanceof Error && cause.message === 'INVALID_RESPONSE'
          ? 'The post explorer returned an unexpected response.'
          : 'The post explorer could not be updated. Check your connection and try again.';
    } finally {
      if (currentRequest === requestSequence) {
        loading = false;
      }
    }
  }

  function selectMode(nextMode: 'top' | 'recent' | 'sample'): void {
    mode = nextMode;

    if (nextMode === 'recent' && !recentLoaded) {
      void loadRecent(true);
    }
  }

  onDestroy(() => {
    controller?.abort();
  });
</script>

<section class="post-explorer" aria-busy={loading}>
  <PanelHeader
    {title}
    {caption}
    {source}
    count={mode === 'recent' ? recentPosts.length : initialTopPosts.length}
  >
    <div slot="tools" class="mode-switch" aria-label="Post explorer mode">
      <button
        type="button"
        class:active={mode === 'top'}
        onclick={() => selectMode('top')}
      >
        <TrendingUp size={15} aria-hidden="true" />
        Most engaged
      </button>
      <button
        type="button"
        class:active={mode === 'recent'}
        onclick={() => selectMode('recent')}
      >
        <Clock3 size={15} aria-hidden="true" />
        All posts
      </button>
      <button
        type="button"
        class:active={mode === 'sample'}
        onclick={() => selectMode('sample')}
      >
        <Shuffle size={15} aria-hidden="true" />
        Sample
      </button>
    </div>
  </PanelHeader>

  <p id={statusId} class="visually-hidden" aria-live="polite">
    {loading ? 'Loading posts.' : error}
  </p>

  {#if error}
    <div class="notice" role="alert">
      <p>{error}</p>
      {#if mode === 'recent'}
        <button type="button" onclick={() => void loadRecent(recentPosts.length === 0)}>
          Try again
        </button>
      {/if}
    </div>
  {/if}

  {#if mode === 'top'}
    <div class="post-grid">
      {#each initialTopPosts as post}
        <PostCard {post} />
      {:else}
        <p class="empty-state">No high-engagement posts are available for this view.</p>
      {/each}
    </div>
  {:else if mode === 'recent'}
    {#if recentPosts.length}
      <div class="post-grid" class:loading>
        {#each recentPosts as post}
          <PostCard {post} />
        {/each}
      </div>
    {:else if loading}
      <div class="post-grid loading">
        {#each Array(Math.min(safePageSize, 4)) as _}
          <div class="skeleton" aria-hidden="true"></div>
        {/each}
      </div>
    {:else}
      <div class="post-grid">
        <p class="empty-state">No posts matched this view.</p>
      </div>
    {/if}

    <div class="explorer-footer">
      <button
        type="button"
        disabled={loading || recentCursor === null}
        onclick={() => void loadRecent(false)}
      >
        <Plus size={16} aria-hidden="true" />
        {loading ? 'Loading' : recentCursor === null && recentLoaded ? 'All loaded' : 'Load more'}
      </button>
    </div>
  {:else}
    <AsyncSampler
      title="Representative sample"
      description="Draw a reproducible sample inside the same filters as this view."
      {filters}
      {apiBase}
      sampleSize={safeSampleSize}
      syncSeedToUrl={false}
    />
  {/if}
</section>

<style>
  .post-explorer {
    min-width: 0;
  }

  .mode-switch {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px;
    border: 1px solid var(--color-rule);
    border-radius: 999px;
    background: var(--color-elevated);
  }

  .mode-switch button {
    min-height: 32px;
    padding: 5px 9px;
    border-radius: 999px;
    box-shadow: none;
  }

  .mode-switch button.active {
    color: var(--color-seal);
    border-color: color-mix(in srgb, var(--color-seal) 45%, var(--color-rule));
    background: color-mix(in srgb, var(--color-seal) 9%, var(--color-card));
  }

  .post-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: 14px;
    min-width: 0;
    transition: opacity 140ms ease;
  }

  .post-grid.loading {
    opacity: 0.72;
  }

  .explorer-footer {
    display: flex;
    justify-content: center;
    margin-top: 14px;
  }

  .notice {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }

  .notice p {
    margin: 0;
  }

  .empty-state {
    margin: 0;
    padding: 18px;
    color: var(--color-mute);
    border: 1px dashed var(--color-rule);
    border-radius: 6px;
  }

  .skeleton {
    min-height: 220px;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 640px) {
    .mode-switch,
    .mode-switch button {
      width: 100%;
    }
  }
</style>
