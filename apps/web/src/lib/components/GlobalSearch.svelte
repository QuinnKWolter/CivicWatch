<script lang="ts">
  import { browser } from '$app/environment';
  import { env } from '$env/dynamic/public';
  import { onMount, tick } from 'svelte';
  import {
    Clock3,
    Search,
    Trash2,
    X
  } from 'lucide-svelte';

  interface Props {
    apiBase?: string;
    debounceMs?: number;
    minQueryLength?: number;
    recentLimit?: number;
    groupLimit?: number;
    enableShortcuts?: boolean;
  }

  interface LegislatorResult {
    key: string;
    lid: string;
    name: string;
    handle: string | null;
    party: string | null;
    state: string | null;
    chamber: string | null;
  }

  interface StateResult {
    key: string;
    code: string;
    name: string;
  }

  interface TopicResult {
    key: string;
    topic: string;
    label: string;
  }

  interface SearchResults {
    legislators: LegislatorResult[];
    states: StateResult[];
    topics: TopicResult[];
  }

  const DEFAULT_API_BASE =
    env.PUBLIC_API_BASE_URL ??
    'http://127.0.0.1:4000/api/v1';

  let {
    apiBase = DEFAULT_API_BASE,
    debounceMs = 240,
    minQueryLength = 2,
    recentLimit = 5,
    groupLimit = 8,
    enableShortcuts = true
  }: Props = $props();

  const componentId = $props.id();
  const dialogId = `${componentId}-dialog`;
  const titleId = `${componentId}-title`;
  const inputId = `${componentId}-input`;
  const resultsId = `${componentId}-results`;
  const statusId = `${componentId}-status`;

  const EMPTY_RESULTS: SearchResults = {
    legislators: [],
    states: [],
    topics: []
  };

  let open = $state(false);
  let q = $state('');
  let results = $state<SearchResults>(EMPTY_RESULTS);
  let loading = $state(false);
  let error = $state('');
  let status = $state('');
  let recent = $state<string[]>([]);

  let input: HTMLInputElement;
  let dialog: HTMLDivElement;
  let triggerButton: HTMLButtonElement;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let requestSequence = 0;
  let composing = false;
  let previousFocus: HTMLElement | null = null;
  let previousBodyOverflow = '';

  const safeMinimumLength = $derived(
    Number.isFinite(minQueryLength)
      ? Math.min(10, Math.max(1, Math.trunc(minQueryLength)))
      : 2
  );

  const safeRecentLimit = $derived(
    Number.isFinite(recentLimit)
      ? Math.min(12, Math.max(1, Math.trunc(recentLimit)))
      : 5
  );

  const safeGroupLimit = $derived(
    Number.isFinite(groupLimit)
      ? Math.min(20, Math.max(1, Math.trunc(groupLimit)))
      : 8
  );

  const trimmedQuery = $derived(q.trim());

  const queryReady = $derived(
    trimmedQuery.length >= safeMinimumLength
  );

  const resultCount = $derived(
    results.legislators.length +
      results.states.length +
      results.topics.length
  );

  const hasResults = $derived(resultCount > 0);

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

    const cleaned = String(value).trim();

    if (
      !cleaned ||
      /^(?:nan|na|n\/a|null|none)$/i.test(cleaned)
    ) {
      return null;
    }

    return cleaned;
  }

  function normalizeLegislator(
    value: unknown,
    index: number
  ): LegislatorResult | null {
    if (!isRecord(value)) return null;

    const lid =
      cleanText(value.lid) ??
      cleanText(value.id);

    if (!lid) return null;

    const handle =
      cleanText(value.handle) ??
      cleanText(value.username);

    const name =
      cleanText(value.name) ??
      cleanText(value.displayName) ??
      cleanText(value.display_name) ??
      (handle ? `@${handle}` : 'Unnamed legislator');

    return {
      key: `${lid}-${index}`,
      lid,
      name,
      handle,
      party: cleanText(value.party),
      state: cleanText(value.state)?.toUpperCase() ?? null,
      chamber:
        cleanText(value.chamberLabel) ??
        cleanText(value.chamber_label) ??
        cleanText(value.chamber)
    };
  }

  function normalizeState(
    value: unknown,
    index: number
  ): StateResult | null {
    if (!isRecord(value)) return null;

    const rawCode =
      cleanText(value.code) ??
      cleanText(value.state) ??
      cleanText(value.abbreviation);

    if (!rawCode) return null;

    const code = rawCode
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);

    if (code.length !== 2) return null;

    const name =
      cleanText(value.name) ??
      cleanText(value.stateName) ??
      cleanText(value.state_name) ??
      code;

    return {
      key: `${code}-${index}`,
      code,
      name
    };
  }

  function normalizeTopic(
    value: unknown,
    index: number
  ): TopicResult | null {
    if (!isRecord(value)) return null;

    const topic =
      cleanText(value.topic) ??
      cleanText(value.topicId) ??
      cleanText(value.topic_id) ??
      cleanText(value.id);

    if (!topic) return null;

    const label =
      cleanText(value.topicLabel) ??
      cleanText(value.topic_label) ??
      cleanText(value.label) ??
      cleanText(value.name) ??
      `Topic ${topic}`;

    return {
      key: `${topic}-${index}`,
      topic,
      label
    };
  }

  function normalizeResults(
    payload: unknown
  ): SearchResults {
    if (!isRecord(payload)) {
      throw new Error('INVALID_RESPONSE');
    }

    const source = isRecord(payload.data)
      ? payload.data
      : payload;

    const legislators = Array.isArray(source.legislators)
      ? source.legislators
      : [];

    const states = Array.isArray(source.states)
      ? source.states
      : [];

    const topics = Array.isArray(source.topics)
      ? source.topics
      : [];

    return {
      legislators: legislators
        .map(normalizeLegislator)
        .filter(
          (
            item
          ): item is LegislatorResult => item !== null
        )
        .slice(0, safeGroupLimit),

      states: states
        .map(normalizeState)
        .filter(
          (item): item is StateResult => item !== null
        )
        .slice(0, safeGroupLimit),

      topics: topics
        .map(normalizeTopic)
        .filter(
          (item): item is TopicResult => item !== null
        )
        .slice(0, safeGroupLimit)
    };
  }

  function normalizeRecent(
    value: unknown
  ): string[] {
    if (!Array.isArray(value)) return [];

    const unique = new Map<string, string>();

    for (const item of value) {
      if (typeof item !== 'string') continue;

      const query = item.trim().slice(0, 120);

      if (query.length < safeMinimumLength) {
        continue;
      }

      const key = query.toLocaleLowerCase();

      if (!unique.has(key)) {
        unique.set(key, query);
      }
    }

    return [...unique.values()].slice(
      0,
      safeRecentLimit
    );
  }

  function loadRecentSearches(): void {
    if (!browser) return;

    try {
      const stored = sessionStorage.getItem(
        'cw_recent_searches'
      );

      recent = stored
        ? normalizeRecent(JSON.parse(stored))
        : [];
    } catch {
      recent = [];
      sessionStorage.removeItem(
        'cw_recent_searches'
      );
    }
  }

  function saveRecentSearches(): void {
    if (!browser) return;

    try {
      sessionStorage.setItem(
        'cw_recent_searches',
        JSON.stringify(recent)
      );
    } catch {
      // Search remains functional if storage is unavailable.
    }
  }

  function remember(query: string): void {
    const normalized = query.trim().slice(0, 120);

    if (normalized.length < safeMinimumLength) {
      return;
    }

    recent = [
      normalized,
      ...recent.filter(
        (item) =>
          item.toLocaleLowerCase() !==
          normalized.toLocaleLowerCase()
      )
    ].slice(0, safeRecentLimit);

    saveRecentSearches();
  }

  function clearRecent(): void {
    recent = [];

    if (!browser) return;

    try {
      sessionStorage.removeItem(
        'cw_recent_searches'
      );
    } catch {
      // Storage failure does not affect the interface.
    }
  }

  function clearScheduledSearch(): void {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  function cancelRequest(): void {
    controller?.abort();
    controller = undefined;
    requestSequence += 1;
    loading = false;
  }

  function resetResults(): void {
    results = EMPTY_RESULTS;
    error = '';
    status = '';
  }

  function scheduleSearch(): void {
    clearScheduledSearch();

    if (!queryReady) {
      cancelRequest();
      resetResults();
      return;
    }

    timer = setTimeout(() => {
      void runSearch(false);
    }, Math.max(0, debounceMs));
  }

  function handleInput(event: Event): void {
    q = (event.currentTarget as HTMLInputElement)
      .value.slice(0, 120);

    error = '';
    cancelRequest();

    if (!queryReady) {
      resetResults();
      return;
    }

    if (!composing) {
      scheduleSearch();
    }
  }

  function handleCompositionEnd(
    event: CompositionEvent
  ): void {
    composing = false;

    q = (event.currentTarget as HTMLInputElement)
      .value.slice(0, 120);

    scheduleSearch();
  }

  function clearQuery(): void {
    clearScheduledSearch();
    cancelRequest();

    q = '';
    resetResults();

    void tick().then(() => {
      input?.focus();
    });
  }

  function responseError(statusCode: number): string {
    if (
      statusCode === 400 ||
      statusCode === 422
    ) {
      return 'The search query was not accepted. Check the search text and try again.';
    }

    if (statusCode === 429) {
      return 'Search is receiving too many requests. Try again shortly.';
    }

    if (statusCode >= 500) {
      return 'Search is temporarily unavailable. Try again in a moment.';
    }

    return `Search could not be completed (${statusCode}).`;
  }

  async function runSearch(
    rememberQuery = false
  ): Promise<void> {
    clearScheduledSearch();

    const query = trimmedQuery.slice(0, 120);

    if (query.length < safeMinimumLength) {
      cancelRequest();
      resetResults();
      return;
    }

    const currentRequest = ++requestSequence;

    controller?.abort();
    controller = new AbortController();

    loading = true;
    error = '';
    status = `Searching for ${query}.`;

    const base = apiBase.replace(/\/+$/, '');
    const params = new URLSearchParams({
      q: query
    });

    try {
      const response = await fetch(
        `${base}/search?${params.toString()}`,
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
        throw new Error(`HTTP_${response.status}`);
      }

      const payload: unknown =
        await response.json();

      const nextResults =
        normalizeResults(payload);

      if (currentRequest !== requestSequence) {
        return;
      }

      results = nextResults;

      const nextCount =
        nextResults.legislators.length +
        nextResults.states.length +
        nextResults.topics.length;

      status = nextCount
        ? `${nextCount} ${
            nextCount === 1 ? 'result' : 'results'
          } found for ${query}.`
        : `No results found for ${query}.`;

      if (rememberQuery) {
        remember(query);
      }
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
        ? responseError(Number(match[1]))
        : cause instanceof Error &&
            cause.message === 'INVALID_RESPONSE'
          ? 'Search returned an unexpected response.'
          : 'Search could not be completed. Check your connection and try again.';

      status = error;
    } finally {
      if (currentRequest === requestSequence) {
        loading = false;
      }
    }
  }

  function lockPageScroll(): void {
    if (!browser) return;

    previousBodyOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';
  }

  function unlockPageScroll(): void {
    if (!browser) return;

    document.body.style.overflow =
      previousBodyOverflow;
  }

  async function openSearch(): Promise<void> {
    if (!browser || open) return;

    previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : triggerButton ?? null;

    open = true;
    lockPageScroll();

    await tick();

    input?.focus({
      preventScroll: true
    });

    if (q) {
      input?.select();
    }
  }

  async function closeSearch(
    restoreFocus = true
  ): Promise<void> {
    if (!open) return;

    open = false;

    clearScheduledSearch();
    cancelRequest();
    unlockPageScroll();

    await tick();

    if (restoreFocus) {
      previousFocus?.focus({
        preventScroll: true
      });
    }

    previousFocus = null;
  }

  function chooseRecent(query: string): void {
    q = query;
    error = '';

    void runSearch(true);

    void tick().then(() => {
      input?.focus();
      input?.setSelectionRange(
        input.value.length,
        input.value.length
      );
    });
  }

  function handleResultSelection(): void {
    remember(trimmedQuery);
    void closeSearch(false);
  }

  function isEditableTarget(
    target: EventTarget | null
  ): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable
    );
  }

  function getFocusableElements(): HTMLElement[] {
    if (!dialog) return [];

    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    return Array.from(
      dialog.querySelectorAll<HTMLElement>(selector)
    ).filter(
      (element) =>
        !element.hasAttribute('hidden') &&
        element.getAttribute('aria-hidden') !== 'true' &&
        element.offsetParent !== null
    );
  }

  function trapFocus(event: KeyboardEvent): void {
    const focusable = getFocusableElements();

    if (!focusable.length) {
      event.preventDefault();
      dialog?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (
      event.shiftKey &&
      (active === first || active === dialog)
    ) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function navigableItems(): HTMLElement[] {
    if (!dialog) return [];

    return Array.from(
      dialog.querySelectorAll<HTMLElement>(
        '.result-link, .recent-button'
      )
    ).filter(
      (element) => element.offsetParent !== null
    );
  }

  function focusFirstResult(): void {
    navigableItems()[0]?.focus();
  }

  function handleDialogKeydown(
    event: KeyboardEvent
  ): void {
    if (
      event.key !== 'ArrowDown' &&
      event.key !== 'ArrowUp' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return;
    }

    const items = navigableItems();

    if (!items.length) return;

    const currentIndex = items.indexOf(
      document.activeElement as HTMLElement
    );

    let nextIndex = currentIndex;

    if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = items.length - 1;
    } else if (event.key === 'ArrowDown') {
      nextIndex =
        currentIndex < 0
          ? 0
          : Math.min(
              items.length - 1,
              currentIndex + 1
            );
    } else {
      nextIndex =
        currentIndex < 0
          ? items.length - 1
          : Math.max(0, currentIndex - 1);
    }

    event.preventDefault();
    items[nextIndex]?.focus();
  }

  function handleInputKeydown(
    event: KeyboardEvent
  ): void {
    if (
      event.key === 'ArrowDown' &&
      (hasResults || recent.length)
    ) {
      event.preventDefault();
      focusFirstResult();
    }
  }

  function handleWindowKeydown(
    event: KeyboardEvent
  ): void {
    const command = event.ctrlKey || event.metaKey;

    if (!open) {
      if (
        enableShortcuts &&
        command &&
        event.key.toLocaleLowerCase() === 'k'
      ) {
        event.preventDefault();
        void openSearch();
        return;
      }

      if (
        enableShortcuts &&
        event.key === '?' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !isEditableTarget(event.target)
      ) {
        event.preventDefault();
        void openSearch();
      }

      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      void closeSearch();
      return;
    }

    if (event.key === 'Tab') {
      trapFocus(event);
    }
  }

  function legislatorMeta(
    item: LegislatorResult
  ): string {
    return [
      item.handle ? `@${item.handle}` : null,
      item.party ?? 'Party unknown',
      item.state,
      item.chamber === 'H'
        ? 'House'
        : item.chamber === 'S'
          ? 'Senate'
          : item.chamber
    ]
      .filter(Boolean)
      .join(' · ');
  }

  onMount(() => {
    loadRecentSearches();

    return () => {
      clearScheduledSearch();
      controller?.abort();

      if (open) {
        unlockPageScroll();
      }
    };
  });
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<button
  bind:this={triggerButton}
  type="button"
  class="search-trigger"
  aria-label="Search CivicWatch"
  aria-haspopup="dialog"
  aria-expanded={open}
  aria-controls={dialogId}
  onclick={() => void openSearch()}
>
  <Search
    size={17}
    strokeWidth={1.8}
    aria-hidden="true"
  />

  <span>Search</span>
</button>

{#if open}
  <div class="search-layer">
    <button
      type="button"
      class="backdrop"
      tabindex="-1"
      aria-label="Close search"
      onclick={() => void closeSearch()}
    ></button>

    <div
      bind:this={dialog}
      id={dialogId}
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabindex="-1"
      onkeydown={handleDialogKeydown}
    >
      <h2 id={titleId} class="visually-hidden">
        Search CivicWatch
      </h2>

      <form
        class="search-form"
        role="search"
        onsubmit={(event) => {
          event.preventDefault();
          void runSearch(true);
        }}
      >
        <Search
          class="search-icon"
          size={20}
          strokeWidth={1.7}
          aria-hidden="true"
        />

        <label
          for={inputId}
          class="visually-hidden"
        >
          Search legislators, states, or topics
        </label>

        <input
          bind:this={input}
          id={inputId}
          type="search"
          value={q}
          placeholder="Search legislators, states, or topics"
          maxlength="120"
          autocomplete="off"
          spellcheck={false}
          aria-controls={resultsId}
          aria-describedby={statusId}
          aria-expanded={queryReady}
          oninput={handleInput}
          onkeydown={handleInputKeydown}
          oncompositionstart={() => {
            composing = true;
          }}
          oncompositionend={handleCompositionEnd}
        />

        {#if q}
          <button
            type="button"
            class="icon-button clear-query"
            aria-label="Clear search query"
            onclick={clearQuery}
          >
            <X
              size={17}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </button>
        {/if}

        <button
          type="button"
          class="icon-button close-button"
          aria-label="Close search"
          onclick={() => void closeSearch()}
        >
          <X
            size={19}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </button>
      </form>

      <div class="modal-body">
        {#if loading}
          <div
            class="progress"
            aria-hidden="true"
          >
            <span></span>
          </div>
        {/if}

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
              onclick={() => void runSearch(false)}
            >
              Try again
            </button>
          </div>
        {/if}

        {#if !queryReady}
          <section class="search-intro">
            <p>
              Enter at least {safeMinimumLength}
              characters. Try a legislator’s name or
              handle, a two-letter state code, or a
              topic.
            </p>

            {#if recent.length}
              <div class="recent">
                <div class="section-heading">
                  <h3>
                    <Clock3
                      size={15}
                      strokeWidth={1.7}
                      aria-hidden="true"
                    />
                    Recent searches
                  </h3>

                  <button
                    type="button"
                    class="clear-recent"
                    onclick={clearRecent}
                  >
                    <Trash2
                      size={14}
                      strokeWidth={1.7}
                      aria-hidden="true"
                    />
                    Clear
                  </button>
                </div>

                <ul>
                  {#each recent as item (item)}
                    <li>
                      <button
                        type="button"
                        class="recent-button"
                        onclick={() =>
                          chooseRecent(item)}
                      >
                        {item}
                      </button>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
          </section>
        {:else if loading && !hasResults}
          <div class="loading-state" role="status">
            <Search
              size={20}
              strokeWidth={1.6}
              aria-hidden="true"
            />

            <span>
              Searching legislators, states, and
              topics…
            </span>
          </div>
        {:else}
          <div
            id={resultsId}
            class:refreshing={loading}
            class="groups"
            aria-label="Search results"
          >
            <section class="group">
              <div class="group-heading">
                <h3>Legislators</h3>
                <span>
                  {results.legislators.length}
                </span>
              </div>

              {#if results.legislators.length}
                <ul>
                  {#each results.legislators as item (item.key)}
                    <li>
                      <a
                        class="result-link"
                        href={`/who/${encodeURIComponent(item.lid)}`}
                        onclick={handleResultSelection}
                      >
                        <strong>{item.name}</strong>

                        <span>
                          {legislatorMeta(item)}
                        </span>
                      </a>
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="empty-group">
                  No legislator matches
                </p>
              {/if}
            </section>

            <section class="group">
              <div class="group-heading">
                <h3>States</h3>
                <span>{results.states.length}</span>
              </div>

              {#if results.states.length}
                <ul>
                  {#each results.states as item (item.key)}
                    <li>
                      <a
                        class="result-link"
                        href={`/place/${encodeURIComponent(item.code)}`}
                        onclick={handleResultSelection}
                      >
                        <strong>{item.name}</strong>
                        <span>{item.code}</span>
                      </a>
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="empty-group">
                  No state matches
                </p>
              {/if}
            </section>

            <section class="group">
              <div class="group-heading">
                <h3>Topics</h3>
                <span>{results.topics.length}</span>
              </div>

              {#if results.topics.length}
                <ul>
                  {#each results.topics as item (item.key)}
                    <li>
                      <a
                        class="result-link"
                        href={`/topic/${encodeURIComponent(item.topic)}`}
                        onclick={handleResultSelection}
                      >
                        <strong>{item.label}</strong>
                        <span>
                          Topic {item.topic}
                        </span>
                      </a>
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="empty-group">
                  No topic matches
                </p>
              {/if}
            </section>

            {#if !hasResults && !loading}
              <div class="no-results" role="status">
                <h3>No matches found</h3>

                <p>
                  Check the spelling, try a handle
                  without the @ symbol, use a
                  two-letter state code, or broaden
                  the query.
                </p>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .search-trigger {
    appearance: none;
    display: inline-flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    min-width: 116px;
    min-height: 34px;
    padding: 0 13px;
    margin: 0;
    color: var(--color-ink, #17201d);
    font-size: 0.78rem;
    font-weight: 650;
    line-height: 1rem;
    background: color-mix(
      in srgb,
      var(--color-elevated, #fff) 88%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--color-rule, #d9d2c1) 86%,
        transparent
      );
    border-radius: 999px;
    box-shadow: none;
    line-height: 1;
    transition:
      color 140ms ease,
      background-color 140ms ease,
      border-color 140ms ease,
      box-shadow 140ms ease;
  }

  .search-trigger:hover {
    color: var(--color-seal, #336a73);
    background: color-mix(
      in srgb,
      var(--color-seal, #336a73) 8%,
      var(--color-card, #fff)
    );
    border-color: color-mix(
      in srgb,
      var(--color-seal, #336a73) 38%,
      var(--color-rule, #d9d2c1)
    );
    box-shadow: none;
    transform: none;
  }

  .search-trigger:focus-visible {
    outline: 2px solid var(--color-seal, #336a73);
    outline-offset: 2px;
  }

  .search-trigger span {
    white-space: nowrap;
  }

  .search-layer {
    position: fixed;
    inset: 0;
    z-index: 50;
  }

  .backdrop {
    appearance: none;
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
    background: var(
      --color-modal-backdrop,
      rgb(26 25 23 / 48%)
    );
    border: 0;
    cursor: default;
  }

  .modal {
    position: absolute;
    top: clamp(24px, 8vh, 84px);
    left: 50%;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    width: min(760px, calc(100vw - 32px));
    max-height: calc(100dvh - 48px);
    overflow: hidden;
    color: var(--color-ink, #1a1917);
    background: var(--color-card, #fff);
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 6px;
    box-shadow: 0 18px 60px rgb(26 25 23 / 20%);
    outline: none;
    transform: translateX(-50%);
  }

  .modal:focus-visible {
    outline: 2px solid var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .search-form {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) 40px 40px;
    gap: 6px;
    align-items: center;
    min-height: 64px;
    padding: 10px 10px 10px 16px;
    border-bottom: 1px solid
      var(--color-rule, #d9d2c1);
  }

  .search-icon {
    color: var(--color-mute, #6b6659);
  }

  input {
    width: 100%;
    min-width: 0;
    min-height: 42px;
    padding: 7px 4px;
    color: var(--color-ink, #1a1917);
    font: inherit;
    font-size: 1.025rem;
    line-height: 1.4rem;
    background: transparent;
    border: 0;
    outline: 0;
  }

  input::placeholder {
    color: var(--color-mute, #6b6659);
    opacity: 1;
  }

  input::-webkit-search-cancel-button {
    display: none;
  }

  .icon-button {
    appearance: none;
    display: grid;
    width: 40px;
    height: 40px;
    padding: 0;
    margin: 0;
    place-items: center;
    color: var(--color-mute, #6b6659);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    line-height: 1;
    transition:
      color 120ms ease,
      background-color 120ms ease,
      border-color 120ms ease;
  }

  .icon-button:hover {
    color: var(--color-ink, #1a1917);
    background: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 35%,
      transparent
    );
  }

  .icon-button:focus-visible,
  .result-link:focus-visible,
  .recent-button:focus-visible,
  .retry-button:focus-visible,
  .clear-recent:focus-visible {
    outline: 2px solid var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .clear-query {
    grid-column: 3;
  }

  .close-button {
    grid-column: 4;
  }

  .modal-body {
    position: relative;
    min-height: 220px;
    padding: 16px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .progress {
    position: sticky;
    top: -16px;
    right: 0;
    left: 0;
    z-index: 3;
    height: 2px;
    margin: -16px -16px 14px;
    overflow: hidden;
    background: var(--color-rule, #d9d2c1);
  }

  .progress span {
    display: block;
    width: 34%;
    height: 100%;
    background: var(--color-seal, #8a5a1a);
    animation: search-progress 900ms ease-in-out
      infinite alternate;
  }

  .notice {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
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
    font: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
    background: transparent;
    border: 1px solid currentColor;
    border-radius: 4px;
    cursor: pointer;
  }

  .search-intro > p {
    max-width: 620px;
    margin: 2px 0 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.9rem;
    line-height: 1.45rem;
  }

  .recent {
    margin-top: 24px;
  }

  .section-heading,
  .group-heading {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  .section-heading h3,
  .group-heading h3 {
    margin: 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .section-heading h3 {
    display: inline-flex;
    gap: 7px;
    align-items: center;
  }

  .clear-recent {
    display: inline-flex;
    gap: 5px;
    align-items: center;
    min-height: 32px;
    padding: 4px 7px;
    color: var(--color-mute, #6b6659);
    font: inherit;
    font-size: 0.75rem;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
  }

  .clear-recent:hover {
    color: var(--color-error, #8a2a20);
    border-color: var(--color-rule, #d9d2c1);
  }

  .recent ul,
  .group ul {
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .recent ul {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }

  .recent-button {
    min-height: 36px;
    max-width: min(19rem, 72vw);
    padding: 6px 10px;
    overflow: hidden;
    color: var(--color-ink, #1a1917);
    font: inherit;
    font-size: 0.8125rem;
    line-height: 1.1rem;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: var(
      --color-elevated,
      var(--color-card, #fff)
    );
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 999px;
    cursor: pointer;
  }

  .recent-button:hover {
    color: var(--color-seal, #8a5a1a);
    border-color: var(--color-seal, #8a5a1a);
  }

  .loading-state {
    display: flex;
    gap: 10px;
    min-height: 180px;
    align-items: center;
    justify-content: center;
    color: var(--color-mute, #6b6659);
    font-size: 0.875rem;
  }

  .groups {
    display: grid;
    grid-template-columns: repeat(
      3,
      minmax(0, 1fr)
    );
    gap: 14px;
    align-items: start;
    transition: opacity 120ms ease;
  }

  .groups.refreshing {
    opacity: 0.56;
  }

  .group {
    display: grid;
    gap: 8px;
    min-width: 0;
    align-content: start;
  }

  .group-heading {
    min-height: 24px;
  }

  .group-heading span {
    color: var(--color-mute-soft, #9c9787);
    font-family: var(
      --font-data,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
  }

  .group ul {
    display: grid;
    gap: 6px;
  }

  .result-link {
    display: grid;
    gap: 3px;
    min-width: 0;
    min-height: 54px;
    padding: 9px 10px;
    color: var(--color-ink, #1a1917);
    text-decoration: none;
    background: var(--color-card, #fff);
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 6px;
    transition:
      color 120ms ease,
      background-color 120ms ease,
      border-color 120ms ease;
  }

  .result-link:hover {
    color: var(--color-seal, #8a5a1a);
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 6%,
      var(--color-card, #fff)
    );
    border-color: var(--color-seal, #8a5a1a);
  }

  .result-link strong,
  .result-link span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .result-link strong {
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.2rem;
  }

  .result-link span {
    color: var(--color-mute, #6b6659);
    font-size: 0.75rem;
    line-height: 1rem;
  }

  .empty-group {
    min-height: 54px;
    padding: 10px;
    margin: 0;
    color: var(--color-mute-soft, #9c9787);
    font-size: 0.78rem;
    line-height: 1.15rem;
    border: 1px dashed var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  .no-results {
    grid-column: 1 / -1;
    padding: 28px 18px;
    text-align: center;
    border-top: 1px solid var(--color-rule, #d9d2c1);
  }

  .no-results h3 {
    margin: 0;
    font-size: 1rem;
    line-height: 1.35rem;
  }

  .no-results p {
    max-width: 520px;
    margin: 6px auto 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.85rem;
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

  @keyframes search-progress {
    from {
      transform: translateX(-10%);
    }

    to {
      transform: translateX(205%);
    }
  }

  @media (max-width: 760px) {
    .modal {
      top: auto;
      right: 0;
      bottom: 0;
      left: 0;
      width: 100%;
      max-height: calc(100dvh - 16px);
      border-right: 0;
      border-bottom: 0;
      border-left: 0;
      border-radius: 6px 6px 0 0;
      transform: none;
    }

    .groups {
      grid-template-columns: 1fr;
      gap: 18px;
    }

    .group ul {
      gap: 7px;
    }

    .result-link {
      min-height: 58px;
    }

    .empty-group {
      min-height: auto;
    }
  }

  @media (max-width: 520px) {
    .search-trigger {
      width: 34px;
      min-width: 34px;
      min-height: 34px;
      padding: 0;
      border-radius: 999px;
    }

    .search-trigger span {
      display: none;
    }

    .search-form {
      grid-template-columns:
        22px minmax(0, 1fr) 38px 38px;
      min-height: 60px;
      padding-left: 12px;
    }

    input {
      font-size: 1rem;
    }

    .modal-body {
      padding: 14px 12px 20px;
    }

    .progress {
      top: -14px;
      margin: -14px -12px 12px;
    }

    .notice {
      align-items: flex-start;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .icon-button,
    .groups,
    .result-link {
      transition: none;
    }

    .progress span {
      width: 100%;
      animation: none;
      transform: none;
    }
  }

  @media (forced-colors: active) {
    .modal,
    .result-link,
    .recent-button,
    .empty-group,
    .notice {
      color: CanvasText;
      background: Canvas;
      border-color: CanvasText;
    }

    .backdrop {
      background: rgb(0 0 0 / 60%);
    }

    .result-link:focus-visible,
    .recent-button:focus-visible,
    .icon-button:focus-visible {
      outline-color: Highlight;
    }
  }
</style>
