<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Search,
    X
  } from 'lucide-svelte';
  import { compact, partyInitial } from '$lib/format';

  type SortKey =
    | 'name'
    | 'party'
    | 'state'
    | 'chamber'
    | 'totalPosts';

  type SortDirection = 'asc' | 'desc';

  interface Props {
    legislators?: any[];
    caption?: string;
    profileBase?: string;
    initialSort?: SortKey;
    initialDirection?: SortDirection;
    initialPageSize?: number;
    pageSize?: number;

    /**
     * Indicates that the API has another cursor page available.
     */
    hasMore?: boolean;

    /**
     * Optional external loading state when the parent owns pagination.
     */
    loadingMore?: boolean;

    /**
     * Optional cursor-loading hook.
     *
     * It may:
     * 1. Return the next rows, which this component appends locally, or
     * 2. Update the parent `legislators` prop and return void.
     *
     * TODO(api-integration):
     * Connect this to GET /api/v1/legislators using the endpoint's
     * returned cursor once the parent page exposes that cursor.
     */
    loadMore?: (() => Promise<any[] | void>) | null;
  }

  interface LegislatorRow {
    key: string;
    lid: string | null;
    name: string;
    handle: string | null;
    party: string | null;
    state: string | null;
    chamber: string | null;
    totalPosts: number;
    raw: any;
  }

  let {
    legislators = [],
    caption = 'Legislators matching the current lookup and filters',
    profileBase = '/who',
    initialSort = 'totalPosts',
    initialDirection = 'desc',
    initialPageSize = 40,
    pageSize = 40,
    hasMore = false,
    loadingMore = false,
    loadMore = null
  }: Props = $props();

  const componentId = $props.id();
  const queryId = `${componentId}-table-query`;
  const partyId = `${componentId}-table-party`;
  const stateId = `${componentId}-table-state`;
  const chamberId = `${componentId}-table-chamber`;
  const statusId = `${componentId}-table-status`;

  const collator = new Intl.Collator('en-US', {
    sensitivity: 'base',
    numeric: true
  });

  let query = $state('');
  let partyFilter = $state('');
  let stateFilter = $state('');
  let chamberFilter = $state('');

  let sortKey = $state<SortKey>(
    untrack(() => initialSort)
  );

  let sortDirection = $state<SortDirection>(
    untrack(() => initialDirection)
  );

  let renderedCount = $state(
    untrack(() =>
      normalizePageSize(initialPageSize, 40)
    )
  );

  let appendedRows = $state<any[]>([]);
  let internalLoading = $state(false);
  let loadError = $state('');
  let sentinel: HTMLDivElement;

  let sourceSignature = '';
  let viewSignature = '';
  let observer: IntersectionObserver | null = null;

  const safeInitialPageSize = $derived(
    normalizePageSize(initialPageSize, 40)
  );

  const safePageSize = $derived(
    normalizePageSize(pageSize, 40)
  );

  const normalizedRows = $derived.by(() => {
    const seen = new Set<string>();
    const rows: LegislatorRow[] = [];

    [...legislators, ...appendedRows].forEach(
      (legislator, index) => {
        const row = normalizeLegislator(
          legislator,
          index
        );

        if (!row || seen.has(row.key)) return;

        seen.add(row.key);
        rows.push(row);
      }
    );

    return rows;
  });

  const partyOptions = $derived(
    uniqueValues(
      normalizedRows
        .map((row) => row.party)
        .filter(
          (value): value is string =>
            value !== null
        )
    )
  );

  const stateOptions = $derived(
    uniqueValues(
      normalizedRows
        .map((row) => row.state)
        .filter(
          (value): value is string =>
            value !== null
        )
    )
  );

  const chamberOptions = $derived(
    uniqueValues(
      normalizedRows
        .map((row) => row.chamber)
        .filter(
          (value): value is string =>
            value !== null
        )
    )
  );

  const hasFilters = $derived(
    Boolean(
      query.trim() ||
        partyFilter ||
        stateFilter ||
        chamberFilter
    )
  );

  const filteredRows = $derived.by(() => {
    const normalizedQuery =
      query.trim().toLocaleLowerCase();

    return normalizedRows.filter((row) => {
      if (normalizedQuery) {
        const searchable = [
          row.name,
          row.handle,
          row.party,
          row.state,
          row.chamber
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase();

        if (!searchable.includes(normalizedQuery)) {
          return false;
        }
      }

      if (
        partyFilter === '__unknown' &&
        row.party !== null
      ) {
        return false;
      }

      if (
        partyFilter &&
        partyFilter !== '__unknown' &&
        row.party !== partyFilter
      ) {
        return false;
      }

      if (
        stateFilter === '__unknown' &&
        row.state !== null
      ) {
        return false;
      }

      if (
        stateFilter &&
        stateFilter !== '__unknown' &&
        row.state !== stateFilter
      ) {
        return false;
      }

      if (
        chamberFilter === '__unknown' &&
        row.chamber !== null
      ) {
        return false;
      }

      if (
        chamberFilter &&
        chamberFilter !== '__unknown' &&
        row.chamber !== chamberFilter
      ) {
        return false;
      }

      return true;
    });
  });

  const sortedRows = $derived.by(() => {
    const rows = [...filteredRows];

    rows.sort((a, b) => {
      const comparison = compareRows(
        a,
        b,
        sortKey
      );

      if (comparison !== 0) {
        return sortDirection === 'asc'
          ? comparison
          : -comparison;
      }

      return collator.compare(a.name, b.name);
    });

    return rows;
  });

  const visibleRows = $derived(
    sortedRows.slice(0, renderedCount)
  );

  const hasLocalMore = $derived(
    visibleRows.length < sortedRows.length
  );

  const canLoadMore = $derived(
    hasLocalMore ||
      Boolean(hasMore && loadMore)
  );

  const isLoadingMore = $derived(
    internalLoading || loadingMore
  );

  const resultSummary = $derived.by(() => {
    const total = sortedRows.length;
    const shown = visibleRows.length;

    if (total === 0) {
      return hasFilters
        ? 'No legislators match the table filters.'
        : 'No legislators are available.';
    }

    if (shown < total) {
      return `Showing ${shown.toLocaleString()} of ${total.toLocaleString()} matching legislators.`;
    }

    return `${total.toLocaleString()} matching ${
      total === 1 ? 'legislator' : 'legislators'
    }.`;
  });

  $effect(() => {
    const signature = createSourceSignature(
      legislators
    );

    if (signature !== sourceSignature) {
      sourceSignature = signature;
      appendedRows = [];
      renderedCount = safeInitialPageSize;
      loadError = '';
    }
  });

  $effect(() => {
    const signature = [
      query.trim().toLocaleLowerCase(),
      partyFilter,
      stateFilter,
      chamberFilter,
      sortKey,
      sortDirection
    ].join('|');

    if (signature !== viewSignature) {
      viewSignature = signature;
      renderedCount = safeInitialPageSize;
    }
  });

  function normalizePageSize(
    value: number,
    fallback: number
  ): number {
    if (!Number.isFinite(value)) return fallback;

    return Math.min(
      250,
      Math.max(10, Math.trunc(value))
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
      /^(?:nan|na|n\/a|null|none)$/i.test(text)
    ) {
      return null;
    }

    return text;
  }

  function numericValue(
    value: unknown
  ): number {
    const number =
      typeof value === 'number'
        ? value
        : Number(value);

    return Number.isFinite(number)
      ? Math.max(0, number)
      : 0;
  }

  function normalizeChamber(
    value: unknown
  ): string | null {
    const chamber = cleanText(value);

    if (!chamber) return null;

    if (chamber === 'H') return 'House';
    if (chamber === 'S') return 'Senate';

    return chamber;
  }

  function normalizeLegislator(
    legislator: any,
    index: number
  ): LegislatorRow | null {
    if (
      !legislator ||
      typeof legislator !== 'object'
    ) {
      return null;
    }

    const lid =
      cleanText(legislator.lid) ??
      cleanText(legislator.id);

    const handle =
      cleanText(legislator.handle) ??
      cleanText(legislator.username);

    const name =
      cleanText(legislator.name) ??
      cleanText(legislator.displayName) ??
      cleanText(legislator.display_name) ??
      (handle ? `@${handle}` : null) ??
      'Unnamed legislator';

    const party = cleanText(
      legislator.party
    );

    const state =
      cleanText(legislator.state)
        ?.toUpperCase()
        .slice(0, 2) ?? null;

    const chamber = normalizeChamber(
      legislator.chamber
    );

    const totalPosts =
      numericValue(legislator.totalPosts) ||
      numericValue(legislator.total_posts) ||
      numericValue(legislator.postCount) ||
      numericValue(legislator.posts);

    const identity =
      lid ??
      [
        name,
        handle ?? '',
        party ?? '',
        state ?? '',
        chamber ?? ''
      ].join('|');

    return {
      key: identity || `row-${index}`,
      lid,
      name,
      handle,
      party,
      state,
      chamber,
      totalPosts,
      raw: legislator
    };
  }

  function uniqueValues(
    values: string[]
  ): string[] {
    return [...new Set(values)].sort(
      collator.compare
    );
  }

  function createSourceSignature(
    rows: any[]
  ): string {
    let hash = 2166136261;

    rows.forEach((row, index) => {
      const identity =
        cleanText(row?.lid) ??
        cleanText(row?.id) ??
        `${cleanText(row?.name) ?? ''}-${index}`;

      for (
        let character = 0;
        character < identity.length;
        character += 1
      ) {
        hash ^= identity.charCodeAt(character);
        hash = Math.imul(hash, 16777619);
      }
    });

    return `${rows.length}:${hash >>> 0}`;
  }

  function compareNullableText(
    left: string | null,
    right: string | null
  ): number {
    if (left === null && right === null) {
      return 0;
    }

    if (left === null) return 1;
    if (right === null) return -1;

    return collator.compare(left, right);
  }

  function compareRows(
    left: LegislatorRow,
    right: LegislatorRow,
    key: SortKey
  ): number {
    switch (key) {
      case 'name':
        return collator.compare(
          left.name,
          right.name
        );

      case 'party':
        return compareNullableText(
          left.party,
          right.party
        );

      case 'state':
        return compareNullableText(
          left.state,
          right.state
        );

      case 'chamber':
        return compareNullableText(
          left.chamber,
          right.chamber
        );

      case 'totalPosts':
        return left.totalPosts - right.totalPosts;
    }
  }

  function sortBy(key: SortKey): void {
    if (sortKey === key) {
      sortDirection =
        sortDirection === 'asc'
          ? 'desc'
          : 'asc';

      return;
    }

    sortKey = key;
    sortDirection =
      key === 'totalPosts' ? 'desc' : 'asc';
  }

  function ariaSort(
    key: SortKey
  ): 'ascending' | 'descending' | 'none' {
    if (sortKey !== key) return 'none';

    return sortDirection === 'asc'
      ? 'ascending'
      : 'descending';
  }

  function sortLabel(
    label: string,
    key: SortKey
  ): string {
    if (sortKey !== key) {
      return `Sort by ${label}`;
    }

    return `Sort by ${label} ${
      sortDirection === 'asc'
        ? 'descending'
        : 'ascending'
    }`;
  }

  function profileHref(
    row: LegislatorRow
  ): string | null {
    if (!row.lid) return null;

    const base = profileBase.startsWith('/')
      ? profileBase.replace(/\/+$/, '')
      : '/who';

    return `${base}/${encodeURIComponent(
      row.lid
    )}`;
  }

  function partyClass(
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

    return 'unknown';
  }

  function clearFilters(): void {
    query = '';
    partyFilter = '';
    stateFilter = '';
    chamberFilter = '';
  }

  async function showMore(): Promise<void> {
    if (isLoadingMore) return;

    if (hasLocalMore) {
      renderedCount += safePageSize;
      return;
    }

    if (!hasMore || !loadMore) return;

    internalLoading = true;
    loadError = '';

    try {
      const nextRows = await loadMore();

      if (Array.isArray(nextRows)) {
        appendedRows = [
          ...appendedRows,
          ...nextRows
        ];
      }

      renderedCount += safePageSize;
    } catch {
      loadError =
        'More legislators could not be loaded. The current results remain available.';
    } finally {
      internalLoading = false;
    }
  }

  function handleQueryInput(
    event: Event
  ): void {
    query = (
      event.currentTarget as HTMLInputElement
    ).value.slice(0, 120);
  }

  onMount(() => {
    if (
      typeof IntersectionObserver ===
      'undefined'
    ) {
      return;
    }

    observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some(
            (entry) => entry.isIntersecting
          )
        ) {
          void showMore();
        }
      },
      {
        rootMargin: '280px 0px'
      }
    );

    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => {
      observer?.disconnect();
      observer = null;
    };
  });
</script>

<section
  class="legislator-table"
  aria-labelledby={statusId}
>
  <div class="table-controls">
    <div class="query-control">
      <label for={queryId}>
        Filter results
      </label>

      <div class="query-shell">
        <span
          class="query-icon"
          aria-hidden="true"
        >
          <Search
            size={17}
            strokeWidth={1.75}
          />
        </span>

        <input
          id={queryId}
          type="search"
          value={query}
          placeholder="Name, handle, state, or party"
          maxlength="120"
          autocomplete="off"
          spellcheck={false}
          oninput={handleQueryInput}
        />

        {#if query}
          <button
            type="button"
            class="clear-query"
            aria-label="Clear table search"
            onclick={() => {
              query = '';
            }}
          >
            <X
              size={15}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </button>
        {/if}
      </div>
    </div>

    <div class="select-control">
      <label for={partyId}>Party</label>

      <select
        id={partyId}
        bind:value={partyFilter}
      >
        <option value="">All parties</option>

        {#each partyOptions as party}
          <option value={party}>
            {party}
          </option>
        {/each}

        <option value="__unknown">
          Party unknown
        </option>
      </select>
    </div>

    <div class="select-control">
      <label for={stateId}>State</label>

      <select
        id={stateId}
        bind:value={stateFilter}
      >
        <option value="">All states</option>

        {#each stateOptions as state}
          <option value={state}>
            {state}
          </option>
        {/each}

        <option value="__unknown">
          State unknown
        </option>
      </select>
    </div>

    <div class="select-control">
      <label for={chamberId}>Chamber</label>

      <select
        id={chamberId}
        bind:value={chamberFilter}
      >
        <option value="">
          Both chambers
        </option>

        {#each chamberOptions as chamber}
          <option value={chamber}>
            {chamber}
          </option>
        {/each}

        <option value="__unknown">
          Chamber unknown
        </option>
      </select>
    </div>

    {#if hasFilters}
      <button
        type="button"
        class="clear-filters"
        onclick={clearFilters}
      >
        Clear filters
      </button>
    {/if}
  </div>

  <div class="table-meta">
    <p
      id={statusId}
      aria-live="polite"
      aria-atomic="true"
    >
      {resultSummary}
    </p>

    <p class="scroll-hint">
      Scroll horizontally to see all columns.
    </p>
  </div>

  {#if sortedRows.length}
    <div class="table-wrap">
      <table>
        <caption class="visually-hidden">
          {caption}
        </caption>

        <thead>
          <tr>
            <th
              scope="col"
              aria-sort={ariaSort('name')}
              class="sticky-column"
            >
              <button
                type="button"
                aria-label={sortLabel(
                  'legislator',
                  'name'
                )}
                onclick={() => sortBy('name')}
              >
                Legislator

                {#if sortKey === 'name'}
                  {#if sortDirection === 'asc'}
                    <ArrowUp
                      size={14}
                      aria-hidden="true"
                    />
                  {:else}
                    <ArrowDown
                      size={14}
                      aria-hidden="true"
                    />
                  {/if}
                {:else}
                  <ArrowUpDown
                    size={14}
                    aria-hidden="true"
                  />
                {/if}
              </button>
            </th>

            <th
              scope="col"
              aria-sort={ariaSort('party')}
            >
              <button
                type="button"
                aria-label={sortLabel(
                  'party',
                  'party'
                )}
                onclick={() => sortBy('party')}
              >
                Party

                {#if sortKey === 'party'}
                  {#if sortDirection === 'asc'}
                    <ArrowUp
                      size={14}
                      aria-hidden="true"
                    />
                  {:else}
                    <ArrowDown
                      size={14}
                      aria-hidden="true"
                    />
                  {/if}
                {:else}
                  <ArrowUpDown
                    size={14}
                    aria-hidden="true"
                  />
                {/if}
              </button>
            </th>

            <th
              scope="col"
              aria-sort={ariaSort('state')}
            >
              <button
                type="button"
                aria-label={sortLabel(
                  'state',
                  'state'
                )}
                onclick={() => sortBy('state')}
              >
                State

                {#if sortKey === 'state'}
                  {#if sortDirection === 'asc'}
                    <ArrowUp
                      size={14}
                      aria-hidden="true"
                    />
                  {:else}
                    <ArrowDown
                      size={14}
                      aria-hidden="true"
                    />
                  {/if}
                {:else}
                  <ArrowUpDown
                    size={14}
                    aria-hidden="true"
                  />
                {/if}
              </button>
            </th>

            <th
              scope="col"
              aria-sort={ariaSort('chamber')}
            >
              <button
                type="button"
                aria-label={sortLabel(
                  'chamber',
                  'chamber'
                )}
                onclick={() =>
                  sortBy('chamber')}
              >
                Chamber

                {#if sortKey === 'chamber'}
                  {#if sortDirection === 'asc'}
                    <ArrowUp
                      size={14}
                      aria-hidden="true"
                    />
                  {:else}
                    <ArrowDown
                      size={14}
                      aria-hidden="true"
                    />
                  {/if}
                {:else}
                  <ArrowUpDown
                    size={14}
                    aria-hidden="true"
                  />
                {/if}
              </button>
            </th>

            <th
              scope="col"
              aria-sort={ariaSort(
                'totalPosts'
              )}
              class="numeric"
            >
              <button
                type="button"
                aria-label={sortLabel(
                  'post count',
                  'totalPosts'
                )}
                onclick={() =>
                  sortBy('totalPosts')}
              >
                Posts

                {#if sortKey === 'totalPosts'}
                  {#if sortDirection === 'asc'}
                    <ArrowUp
                      size={14}
                      aria-hidden="true"
                    />
                  {:else}
                    <ArrowDown
                      size={14}
                      aria-hidden="true"
                    />
                  {/if}
                {:else}
                  <ArrowUpDown
                    size={14}
                    aria-hidden="true"
                  />
                {/if}
              </button>
            </th>
          </tr>
        </thead>

        <tbody>
          {#each visibleRows as legislator (legislator.key)}
            {@const href =
              profileHref(legislator)}

            <tr>
              <th
                scope="row"
                class="sticky-column"
              >
                {#if href}
                  <a href={href}>
                    {legislator.name}
                  </a>
                {:else}
                  <span>
                    {legislator.name}
                  </span>
                {/if}

                <span class="handle">
                  {legislator.handle
                    ? `@${legislator.handle}`
                    : 'Handle unavailable'}
                </span>
              </th>

              <td>
                <span class="party-cell">
                  <span
                    class={`party-mark ${partyClass(legislator.party)}`}
                    aria-hidden="true"
                  ></span>

                  <span>
                    <span
                      class="party-initial"
                      aria-hidden="true"
                    >
                      {partyInitial(
                        legislator.party
                      )}
                    </span>

                    {legislator.party ??
                      'Party unknown'}
                  </span>
                </span>
              </td>

              <td>
                {legislator.state ?? '—'}
              </td>

              <td>
                {legislator.chamber ?? '—'}
              </td>

              <td class="mono numeric">
                {compact(
                  legislator.totalPosts
                )}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="empty-state" role="status">
      <h3>No legislators match</h3>

      <p>
        Try a broader table search or remove one
        of the party, state, or chamber filters.
      </p>

      {#if hasFilters}
        <button
          type="button"
          onclick={clearFilters}
        >
          Clear table filters
        </button>
      {/if}
    </div>
  {/if}

  {#if loadError}
    <div class="load-error" role="alert">
      <p>{loadError}</p>

      <button
        type="button"
        onclick={() => void showMore()}
      >
        Retry
      </button>
    </div>
  {/if}

  <div
    bind:this={sentinel}
    class="load-sentinel"
    aria-hidden="true"
  ></div>

  {#if canLoadMore || isLoadingMore}
    <div class="load-more">
      <button
        type="button"
        disabled={isLoadingMore}
        aria-busy={isLoadingMore}
        onclick={() => void showMore()}
      >
        {#if isLoadingMore}
          Loading more…
        {:else if hasLocalMore}
          Show more results
        {:else}
          Load more legislators
        {/if}
      </button>

      {#if hasLocalMore}
        <span>
          {(
            sortedRows.length -
            visibleRows.length
          ).toLocaleString()}
          remaining locally
        </span>
      {/if}
    </div>
  {/if}
</section>

<style>
  .legislator-table {
    min-width: 0;
  }

  .table-controls {
    --table-control-height: 42px;

    display: grid;
    grid-template-columns:
      minmax(240px, 1fr)
      minmax(150px, 0.32fr)
      minmax(110px, 0.2fr)
      minmax(140px, 0.24fr)
      auto;
    gap: 10px;
    align-items: end;
    margin-bottom: 12px;
  }

  .query-control,
  .select-control {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  label {
    color: var(--color-mute, #6b6659);
    font-size: 0.71rem;
    font-weight: 600;
    line-height: 1rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .query-shell {
    position: relative;
    display: grid;
    align-items: center;
    min-width: 0;
  }

  .query-icon {
    position: absolute;
    inset-block: 0;
    left: 12px;
    display: grid;
    width: 17px;
    place-items: center;
    color: var(--color-mute, #6b6659);
    line-height: 0;
    pointer-events: none;
  }

  input,
  select {
    appearance: none;
    width: 100%;
    height: var(--table-control-height);
    min-height: var(--table-control-height);
    margin: 0;
    padding: 8px 10px;
    color: var(--color-ink, #1a1917);
    font: inherit;
    font-size: 0.84rem;
    background: var(--color-card, #fff);
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
    outline: 0;
    transition:
      border-color 120ms ease,
      box-shadow 120ms ease;
  }

  input {
    padding-inline: 38px;
  }

  select {
    padding-right: 32px;
    background-image:
      linear-gradient(45deg, transparent 50%, currentColor 50%),
      linear-gradient(135deg, currentColor 50%, transparent 50%);
    background-position:
      calc(100% - 16px) 52%,
      calc(100% - 11px) 52%;
    background-repeat: no-repeat;
    background-size: 5px 5px;
  }

  input::-webkit-search-cancel-button {
    display: none;
  }

  input:hover,
  select:hover {
    border-color: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 45%,
      var(--color-ink, #1a1917)
    );
  }

  input:focus,
  select:focus {
    border-color: var(--color-seal, #8a5a1a);
    box-shadow: 0 0 0 3px
      color-mix(
        in srgb,
        var(--color-seal, #8a5a1a) 17%,
        transparent
      );
  }

  .clear-query {
    appearance: none;
    position: absolute;
    top: 50%;
    right: 7px;
    display: grid;
    width: 28px;
    height: 28px;
    padding: 0;
    margin: 0;
    place-items: center;
    color: var(--color-mute, #6b6659);
    background: transparent;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
    transform: translateY(-50%);
  }

  .clear-query:hover {
    color: var(--color-ink, #1a1917);
    background: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 35%,
      transparent
    );
  }

  .clear-filters {
    appearance: none;
    min-height: var(--table-control-height);
    padding: 8px 10px;
    margin: 0;
    color: var(--color-mute, #6b6659);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 500;
    white-space: nowrap;
    background: transparent;
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
    cursor: pointer;
  }

  .clear-filters:hover {
    color: var(--color-error, #8a2a20);
    border-color: currentColor;
  }

  .clear-query:focus-visible,
  .clear-filters:focus-visible,
  thead button:focus-visible,
  tbody a:focus-visible,
  .load-more button:focus-visible,
  .empty-state button:focus-visible,
  .load-error button:focus-visible {
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .table-meta {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    min-height: 24px;
    margin-bottom: 7px;
  }

  .table-meta p {
    margin: 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.75rem;
    line-height: 1.1rem;
  }

  .scroll-hint {
    display: none;
  }

  .table-wrap {
    max-width: 100%;
    overflow-x: auto;
    background: var(--color-card, #fff);
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
    overscroll-behavior-inline: contain;
    scrollbar-width: thin;
  }

  table {
    width: 100%;
    min-width: 760px;
    border-spacing: 0;
    border-collapse: separate;
    font-size: 0.82rem;
    line-height: 1.2rem;
  }

  th,
  td {
    padding: 11px 12px;
    text-align: left;
    vertical-align: middle;
    background: var(--color-card, #fff);
    border-bottom: 1px solid
      var(--color-rule, #d9d2c1);
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 3;
    padding: 0;
    color: var(--color-mute, #6b6659);
    background: var(--color-card, #fff);
  }

  thead button {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    width: 100%;
    min-height: 44px;
    padding: 10px 12px;
    color: inherit;
    font: inherit;
    font-size: 0.7rem;
    font-weight: 600;
    line-height: 1rem;
    letter-spacing: 0.055em;
    text-align: left;
    text-transform: uppercase;
    background: transparent;
    border: 0;
    cursor: pointer;
  }

  thead button:hover {
    color: var(--color-ink, #1a1917);
    background: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 20%,
      transparent
    );
  }

  tbody tr:last-child th,
  tbody tr:last-child td {
    border-bottom: 0;
  }

  tbody tr:hover th,
  tbody tr:hover td {
    background: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 18%,
      var(--color-card, #fff)
    );
  }

  tbody th {
    min-width: 240px;
    font-weight: 600;
  }

  tbody a {
    color: var(--color-ink, #1a1917);
    text-decoration-thickness: 1px;
    text-decoration-color: transparent;
    text-underline-offset: 3px;
  }

  tbody a:hover {
    color: var(--color-seal, #8a5a1a);
    text-decoration-color: currentColor;
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

  .handle {
    display: block;
    max-width: 240px;
    margin-top: 2px;
    overflow: hidden;
    color: var(--color-mute, #6b6659);
    font-size: 0.72rem;
    font-weight: 400;
    line-height: 1rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .party-cell {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }

  .party-mark {
    display: inline-block;
    width: 9px;
    height: 9px;
    background: var(--color-mute-soft, #9c9787);
    flex: 0 0 auto;
  }

  .party-mark.democratic {
    background: var(--color-ballot-blue, #274b6e);
    border-radius: 50%;
  }

  .party-mark.republican {
    background: var(--color-ballot-red, #a13530);
  }

  .party-mark.independent {
    background: var(--color-independent, #7a6a4a);
    transform: rotate(45deg);
  }

  .party-mark.unknown {
    background: transparent;
    border: 1px solid
      var(--color-mute-soft, #9c9787);
    border-radius: 50%;
  }

  .party-initial {
    margin-right: 4px;
    color: var(--color-mute, #6b6659);
    font-family: var(
      --font-data,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.7rem;
  }

  .mono {
    font-family: var(
      --font-data,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-variant-numeric: tabular-nums;
  }

  .numeric,
  th.numeric button {
    text-align: right;
  }

  th.numeric button {
    justify-content: flex-end;
  }

  .empty-state {
    display: grid;
    min-height: 180px;
    padding: 28px;
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
    font-size: 1rem;
    line-height: 1.35rem;
  }

  .empty-state p {
    max-width: 500px;
    margin: 6px 0 14px;
    color: var(--color-mute, #6b6659);
    font-size: 0.84rem;
    line-height: 1.35rem;
  }

  .empty-state button,
  .load-error button,
  .load-more button {
    min-height: 38px;
    padding: 7px 11px;
    color: var(--color-ink, #1a1917);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    background: var(--color-card, #fff);
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
    cursor: pointer;
  }

  .empty-state button:hover,
  .load-error button:hover,
  .load-more button:hover:not(:disabled) {
    color: var(--color-seal, #8a5a1a);
    border-color: var(--color-seal, #8a5a1a);
  }

  .load-sentinel {
    height: 1px;
  }

  .load-more {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: center;
    padding-top: 14px;
  }

  .load-more button:disabled {
    cursor: progress;
    opacity: 0.65;
  }

  .load-more span {
    color: var(--color-mute, #6b6659);
    font-size: 0.72rem;
  }

  .load-error {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
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

  .load-error p {
    margin: 0;
    font-size: 0.82rem;
    line-height: 1.25rem;
  }

  .load-error button {
    min-height: 34px;
    padding: 5px 9px;
    color: inherit;
    background: transparent;
    border-color: currentColor;
    flex: 0 0 auto;
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

  @media (max-width: 960px) {
    .table-controls {
      grid-template-columns:
        minmax(240px, 1fr)
        repeat(3, minmax(120px, auto));
    }

    .query-control {
      grid-column: 1 / -1;
    }

    .clear-filters {
      grid-column: 1 / -1;
      justify-self: start;
      min-height: 36px;
    }
  }

  @media (max-width: 680px) {
    .table-controls {
      grid-template-columns:
        minmax(0, 1fr)
        minmax(0, 1fr);
    }

    .query-control {
      grid-column: 1 / -1;
    }

    .select-control:last-of-type {
      grid-column: 1 / -1;
    }

    .table-meta {
      align-items: flex-start;
    }

    .scroll-hint {
      display: block;
      text-align: right;
    }

    table {
      min-width: 680px;
    }

    tbody th {
      min-width: 205px;
    }

    .handle {
      max-width: 190px;
    }
  }

  @media (max-width: 440px) {
    .table-controls {
      grid-template-columns: 1fr;
    }

    .query-control,
    .select-control,
    .select-control:last-of-type,
    .clear-filters {
      grid-column: 1;
    }

    .table-meta {
      display: grid;
      gap: 3px;
    }

    .scroll-hint {
      text-align: left;
    }

    .load-more {
      align-items: stretch;
      flex-direction: column;
      text-align: center;
    }

    .load-error {
      align-items: flex-start;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    input,
    select,
    thead button,
    tbody tr {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .table-wrap,
    input,
    select,
    .empty-state,
    .load-error,
    .load-more button {
      color: CanvasText;
      background: Canvas;
      border-color: CanvasText;
    }

    .party-mark {
      background: CanvasText;
      border-color: CanvasText;
    }
  }

  @media print {
    .table-controls,
    .scroll-hint,
    .load-more,
    .load-error {
      display: none;
    }

    .table-wrap {
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
  }
</style>
