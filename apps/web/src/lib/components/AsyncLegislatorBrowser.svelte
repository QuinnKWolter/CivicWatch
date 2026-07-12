<script lang="ts">
  import { browser } from '$app/environment';
  import { env } from '$env/dynamic/public';
  import { replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import { onDestroy } from 'svelte';
  import { Search, X } from 'lucide-svelte';
  import LegislatorTable from './LegislatorTable.svelte';
  import NoResultsPanel from './NoResultsPanel.svelte';

  type PartyFilter = '' | 'Democratic' | 'Republican' | 'Independent';

  interface Props {
    initialLegislators?: any[];
    initialQ?: string;
    initialState?: string;
    initialParty?: string;
    initialTotal?: number | null;
    apiBase?: string;
    resultLimit?: number;
    debounceMs?: number;
  }

  interface ActiveFilters {
    q: string;
    state: string;
    party: PartyFilter;
  }

  const DEFAULT_API_BASE =
    env.PUBLIC_API_BASE_URL ??
    'http://127.0.0.1:4000/api/v1';

  const {
    initialLegislators = [],
    initialQ = '',
    initialState = '',
    initialParty = '',
    initialTotal = null,
    apiBase = DEFAULT_API_BASE,
    resultLimit = 80,
    debounceMs = 250
  }: Props = $props();

  const componentId = $props.id();
  const queryId = `${componentId}-query`;
  const partyId = `${componentId}-party`;
  const stateId = `${componentId}-state`;
  const stateHintId = `${componentId}-state-hint`;
  const statusId = `${componentId}-status`;

  const stateCodes = [
    'AL',
    'AK',
    'AZ',
    'AR',
    'CA',
    'CO',
    'CT',
    'DE',
    'FL',
    'GA',
    'HI',
    'ID',
    'IL',
    'IN',
    'IA',
    'KS',
    'KY',
    'LA',
    'ME',
    'MD',
    'MA',
    'MI',
    'MN',
    'MS',
    'MO',
    'MT',
    'NE',
    'NV',
    'NH',
    'NJ',
    'NM',
    'NY',
    'NC',
    'ND',
    'OH',
    'OK',
    'OR',
    'PA',
    'RI',
    'SC',
    'SD',
    'TN',
    'TX',
    'UT',
    'VT',
    'VA',
    'WA',
    'WV',
    'WI',
    'WY'
  ];

  function initialLegislatorRows(): any[] {
    return Array.isArray(initialLegislators)
      ? [...initialLegislators]
      : [];
  }

  function initialTotalCount(rows: any[]): number | null {
    return typeof initialTotal === 'number' &&
      Number.isInteger(initialTotal) &&
      initialTotal >= rows.length
      ? initialTotal
      : rows.length;
  }

  const seededLegislators = initialLegislatorRows();
  const seededQuery = (() => initialQ.slice(0, 120))();
  const seededStateFilter = (() => normalizeState(initialState))();
  const seededParty = (() => normalizeParty(initialParty))();

  let legislators = $state<any[]>(seededLegislators);
  let q = $state(seededQuery);
  let stateFilter = $state(seededStateFilter);
  let party = $state<PartyFilter>(seededParty);
  let loading = $state(false);
  let error = $state('');
  let total = $state<number | null>(
    initialTotalCount(seededLegislators)
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let requestSequence = 0;
  let composing = false;

  const hasFilters = $derived(Boolean(q.trim() || stateFilter || party));
  const stateIncomplete = $derived(stateFilter.length === 1);

  function normalizeState(value: string): string {
    return value
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);
  }

  function normalizeParty(value: string): PartyFilter {
    if (
      value === 'Democratic' ||
      value === 'Republican' ||
      value === 'Independent'
    ) {
      return value;
    }

    return '';
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function getFilters(): ActiveFilters {
    return {
      q: q.trim().slice(0, 120),
      state: normalizeState(stateFilter),
      party: normalizeParty(party)
    };
  }

  function getSafeLimit(): number {
    if (!Number.isFinite(resultLimit)) return 80;
    return Math.min(100, Math.max(1, Math.trunc(resultLimit)));
  }

  function clearScheduledSearch(): void {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  function scheduleSearch(): void {
    clearScheduledSearch();

    if (stateIncomplete) return;

    timer = setTimeout(() => {
      void search();
    }, Math.max(0, debounceMs));
  }

  function handleQueryInput(event: Event): void {
    q = (event.currentTarget as HTMLInputElement).value.slice(0, 120);

    if (!composing) {
      scheduleSearch();
    }
  }

  function handleCompositionEnd(event: CompositionEvent): void {
    composing = false;
    q = (event.currentTarget as HTMLInputElement).value.slice(0, 120);
    scheduleSearch();
  }

  function handlePartyChange(event: Event): void {
    party = normalizeParty((event.currentTarget as HTMLSelectElement).value);
    void search();
  }

  function handleStateInput(event: Event): void {
    stateFilter = normalizeState((event.currentTarget as HTMLInputElement).value);

    if (!stateFilter || stateFilter.length === 2) {
      scheduleSearch();
    } else {
      clearScheduledSearch();
    }
  }

  function clearQuery(): void {
    q = '';
    scheduleSearch();
  }

  function clearFilters(): void {
    clearScheduledSearch();
    q = '';
    stateFilter = '';
    party = '';
    void search();
  }

  function syncUrl(filters: ActiveFilters): void {
    if (!browser) return;

    const url = new URL(window.location.href);

    setOrDelete(url.searchParams, 'q', filters.q);
    setOrDelete(url.searchParams, 'state', filters.state);
    setOrDelete(url.searchParams, 'party', filters.party);

    url.searchParams.delete('limit');

    replaceState(
      `${url.pathname}${url.search}${url.hash}`,
      page.state
    );
  }

  function setOrDelete(
    params: URLSearchParams,
    key: string,
    value: string
  ): void {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  }

  function extractRows(payload: unknown): any[] {
    if (!isRecord(payload) || !Array.isArray(payload.data)) {
      throw new Error('INVALID_RESPONSE');
    }

    return payload.data;
  }

  function extractTotal(payload: unknown, rowCount: number): number {
    if (!isRecord(payload)) return rowCount;

    const meta = isRecord(payload.meta) ? payload.meta : {};
    const candidates = [
      meta.total,
      meta.totalCount,
      meta.resultCount,
      payload.total
    ];

    for (const candidate of candidates) {
      if (
        typeof candidate === 'number' &&
        Number.isInteger(candidate) &&
        candidate >= rowCount
      ) {
        return candidate;
      }
    }

    return rowCount;
  }

  function errorMessage(status: number): string {
    if (status === 400 || status === 422) {
      return 'The lookup filters were not accepted. Check the search values and try again.';
    }

    if (status === 429) {
      return 'Too many lookup requests were made in a short period. Try again shortly.';
    }

    if (status >= 500) {
      return 'The lookup service is temporarily unavailable. Your current results remain visible.';
    }

    return `The lookup could not be updated (${status}). Your current results remain visible.`;
  }

  function resultSummary(): string {
    if (loading) {
      return legislators.length
        ? 'Updating legislator results.'
        : 'Searching legislators.';
    }

    const shown = legislators.length;

    if (shown === 0) {
      return 'No legislators match the current filters.';
    }

    if (total !== null && total > shown) {
      return `Showing ${shown.toLocaleString()} of ${total.toLocaleString()} matching legislators.`;
    }

    return `${shown.toLocaleString()} matching ${
      shown === 1 ? 'legislator' : 'legislators'
    }.`;
  }

  async function search(): Promise<void> {
    clearScheduledSearch();

    const filters = getFilters();

    if (filters.state && filters.state.length !== 2) {
      error = 'Use a complete two-letter state code, such as PA or TX.';
      return;
    }

    const currentRequest = ++requestSequence;

    controller?.abort();
    controller = new AbortController();

    loading = true;
    error = '';

    const params = new URLSearchParams({
      limit: String(getSafeLimit())
    });

    if (filters.q) params.set('q', filters.q);
    if (filters.state) params.set('state', filters.state);
    if (filters.party) params.set('party', filters.party);

    const base = apiBase.replace(/\/+$/, '');

    try {
      const response = await fetch(`${base}/legislators?${params.toString()}`, {
        headers: {
          accept: 'application/json'
        },
        credentials: 'same-origin',
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      const payload: unknown = await response.json();
      const rows = extractRows(payload);

      if (currentRequest !== requestSequence) return;

      legislators = rows;
      total = extractTotal(payload, rows.length);
      q = filters.q;
      stateFilter = filters.state;
      party = filters.party;

      syncUrl(filters);
    } catch (cause) {
      if (
        cause instanceof DOMException &&
        cause.name === 'AbortError'
      ) {
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
          ? 'The lookup returned an unexpected response. Your current results remain visible.'
          : 'The lookup could not be updated. Check your connection and try again.';
    } finally {
      if (currentRequest === requestSequence) {
        loading = false;
      }
    }
  }

  onDestroy(() => {
    clearScheduledSearch();
    controller?.abort();
  });
</script>

<form
  class="lookup"
  aria-label="Search and filter legislators"
  onsubmit={(event) => {
    event.preventDefault();
    void search();
  }}
>
  <div class="control query-control">
    <label for={queryId}>Legislator</label>

    <div class="field-shell query-shell">
      <span
        class="field-icon"
        aria-hidden="true"
      >
        <Search
          size={18}
          strokeWidth={1.75}
        />
      </span>

      <input
        id={queryId}
        class="field query-field"
        type="search"
        value={q}
        placeholder="Name, handle, district, or state"
        maxlength="120"
        autocomplete="off"
        spellcheck={false}
        aria-describedby={statusId}
        oninput={handleQueryInput}
        oncompositionstart={() => (composing = true)}
        oncompositionend={handleCompositionEnd}
      />

      {#if q}
        <button
          class="clear-field"
          type="button"
          aria-label="Clear legislator search"
          onclick={clearQuery}
        >
          <X size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
      {/if}
    </div>
  </div>

  <div class="control party-control">
    <label for={partyId}>Party</label>

    <select
      id={partyId}
      class="field"
      value={party}
      onchange={handlePartyChange}
    >
      <option value="">All parties and unlabeled</option>
      <option value="Democratic">Democratic</option>
      <option value="Republican">Republican</option>
      <option value="Independent">Independent</option>
    </select>
  </div>

  <div class="control state-control">
    <label for={stateId}>State</label>

    <input
      id={stateId}
      class="field state-field"
      type="text"
      value={stateFilter}
      placeholder="TX"
      maxlength="2"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck={false}
      list={`${componentId}-states`}
      aria-invalid={stateIncomplete}
      aria-describedby={stateIncomplete ? stateHintId : undefined}
      oninput={handleStateInput}
    />

    <datalist id={`${componentId}-states`}>
      {#each stateCodes as code}
        <option value={code}></option>
      {/each}
    </datalist>
  </div>

  <div class="actions">
    <button
      class="search-button"
      type="submit"
      aria-busy={loading}
    >
      <Search size={17} strokeWidth={1.8} aria-hidden="true" />
      <span>{loading ? 'Updating' : 'Search'}</span>
    </button>

    {#if hasFilters}
      <button
        class="reset-button"
        type="button"
        onclick={clearFilters}
      >
        Clear
      </button>
    {/if}
  </div>

  {#if stateIncomplete}
    <p id={stateHintId} class="state-hint">
      Enter one more letter to use a state filter.
    </p>
  {/if}
</form>

<div class="lookup-feedback">
  <p
    id={statusId}
    class="result-summary"
    aria-live="polite"
    aria-atomic="true"
  >
    {resultSummary()}
  </p>

  {#if error}
    <div class="notice" role="alert">
      <p>{error}</p>

      <button
        type="button"
        class="retry-button"
        onclick={() => void search()}
      >
        Retry
      </button>
    </div>
  {/if}
</div>

<section
  class:refreshing={loading}
  class="results"
  aria-label="Legislator results"
  aria-busy={loading}
>
  {#if loading}
    <div class="progress" aria-hidden="true">
      <span></span>
    </div>
  {/if}

  {#if legislators.length}
    <div class="table-wrap">
      <LegislatorTable {legislators} />
    </div>
  {:else if loading}
    <div class="loading-panel" role="status">
      <Search size={20} strokeWidth={1.6} aria-hidden="true" />
      <span>Searching the roll call…</span>
    </div>
  {:else}
    <NoResultsPanel
      title="No legislators match"
      message="Try a broader name or handle, remove the party filter, or use a valid two-letter state code."
    />
  {/if}
</section>

<style>
  .lookup {
    --lookup-control-height: 42px;

    display: grid;
    grid-template-columns:
      minmax(280px, 1.35fr)
      minmax(190px, 0.58fr)
      minmax(96px, 0.24fr)
      auto;
    gap: 12px;
    align-items: end;
    width: 100%;
    margin-block: 24px 12px;
    padding: 14px;
    background: var(--color-card, #fff);
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  .control {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .control > label {
    margin: 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .field-shell {
    position: relative;
    display: grid;
    align-items: center;
    min-width: 0;
  }

  .field {
    appearance: none;
    width: 100%;
    height: var(--lookup-control-height);
    min-height: var(--lookup-control-height);
    box-sizing: border-box;
    margin: 0;
    padding: 9px 11px;
    color: var(--color-ink, #1a1917);
    font: inherit;
    line-height: 1.2;
    background: var(--color-card, #fff);
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 6px;
    outline: none;
    transition:
      border-color 120ms ease,
      box-shadow 120ms ease,
      background-color 120ms ease;
  }

  select.field {
    padding-right: 32px;
    padding-block: 7px;
    line-height: normal;
    background-image:
      linear-gradient(45deg, transparent 50%, currentColor 50%),
      linear-gradient(135deg, currentColor 50%, transparent 50%);
    background-position:
      calc(100% - 16px) 52%,
      calc(100% - 11px) 52%;
    background-repeat: no-repeat;
    background-size: 5px 5px;
  }

  .field:hover {
    border-color: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 45%,
      var(--color-ink, #1a1917)
    );
  }

  .field:focus {
    border-color: var(--color-seal, #8a5a1a);
    box-shadow: 0 0 0 3px
      color-mix(
        in srgb,
        var(--color-seal, #8a5a1a) 18%,
        transparent
      );
  }

  .field[aria-invalid='true'] {
    border-color: var(--color-warn, #a86a1f);
  }

  .query-field {
    padding-inline: 40px 40px;
  }

  .query-field::-webkit-search-cancel-button {
    display: none;
  }

  .field-icon {
    position: absolute;
    inset-block: 0;
    left: 13px;
    z-index: 1;
    display: grid;
    width: 18px;
    place-items: center;
    color: var(--color-mute, #6b6659);
    line-height: 0;
    pointer-events: none;
  }

  .clear-field {
    appearance: none;
    position: absolute;
    top: 50%;
    right: 7px;
    display: grid;
    width: 30px;
    height: 30px;
    padding: 0;
    margin: 0;
    place-items: center;
    color: var(--color-mute, #6b6659);
    background: transparent;
    border: 0;
    border-radius: 4px;
    cursor: pointer;
    transform: translateY(-50%);
    transition:
      color 120ms ease,
      background-color 120ms ease;
  }

  .clear-field:hover {
    color: var(--color-ink, #1a1917);
    background: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 42%,
      transparent
    );
  }

  .clear-field:focus-visible,
  .search-button:focus-visible,
  .reset-button:focus-visible,
  .retry-button:focus-visible {
    outline: 3px solid
      color-mix(
        in srgb,
        var(--color-seal, #8a5a1a) 35%,
        transparent
      );
    outline-offset: 2px;
  }

  .state-field {
    padding-right: 30px;
    font-family: var(
      --font-data,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .actions {
    display: flex;
    gap: 8px;
    align-items: center;
    min-height: var(--lookup-control-height);
  }

  .search-button,
  .reset-button,
  .retry-button {
    appearance: none;
    min-height: var(--lookup-control-height);
    padding: 9px 14px;
    margin: 0;
    font: inherit;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    transition:
      color 120ms ease,
      background-color 120ms ease,
      border-color 120ms ease;
  }

  .search-button {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    color: var(--color-card, #fff);
    background: var(--color-ink, #1a1917);
    border: 1px solid var(--color-ink, #1a1917);
    white-space: nowrap;
  }

  .search-button:hover {
    background: color-mix(
      in srgb,
      var(--color-ink, #1a1917) 88%,
      var(--color-card, #fff)
    );
  }

  .search-button[aria-busy='true'] {
    cursor: progress;
  }

  .reset-button,
  .retry-button {
    color: var(--color-ink, #1a1917);
    background: transparent;
    border: 1px solid var(--color-rule, #d9d2c1);
  }

  .reset-button:hover,
  .retry-button:hover {
    border-color: var(--color-ink, #1a1917);
    background: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 28%,
      transparent
    );
  }

  .state-hint {
    grid-column: 3;
    margin: -5px 0 0;
    color: var(--color-warn, #a86a1f);
    font-size: 0.78rem;
    line-height: 1.15rem;
  }

  .lookup-feedback {
    display: grid;
    gap: 8px;
    margin-bottom: 14px;
  }

  .result-summary {
    min-height: 18px;
    margin: 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.8125rem;
    line-height: 1.125rem;
  }

  .notice {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: space-between;
    padding: 11px 12px;
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
    border-color: currentColor;
    flex: 0 0 auto;
  }

  .results {
    position: relative;
    min-height: 120px;
    overflow: clip;
  }

  .progress {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    z-index: 2;
    height: 2px;
    overflow: hidden;
    background: var(--color-rule, #d9d2c1);
  }

  .progress span {
    display: block;
    width: 34%;
    height: 100%;
    background: var(--color-seal, #8a5a1a);
    animation: lookup-progress 900ms ease-in-out infinite alternate;
  }

  .table-wrap {
    opacity: 1;
    transition: opacity 150ms ease;
  }

  .refreshing .table-wrap {
    opacity: 0.58;
  }

  .loading-panel {
    display: flex;
    gap: 10px;
    min-height: 160px;
    align-items: center;
    justify-content: center;
    color: var(--color-mute, #6b6659);
    background: var(--color-card, #fff);
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 6px;
    font-size: 0.9rem;
  }

  @keyframes lookup-progress {
    from {
      transform: translateX(-5%);
    }

    to {
      transform: translateX(195%);
    }
  }

  @media (max-width: 880px) {
    .lookup {
      grid-template-columns: minmax(0, 1fr) 120px auto;
    }

    .query-control {
      grid-column: 1 / -1;
    }

    .party-control {
      grid-column: 1;
    }

    .state-control {
      grid-column: 2;
    }

    .actions {
      grid-column: 3;
    }

    .state-hint {
      grid-column: 2 / -1;
    }
  }

  @media (max-width: 620px) {
    .lookup {
      grid-template-columns: minmax(0, 1fr) 92px;
      gap: 10px;
      padding: 12px;
    }

    .query-control,
    .party-control {
      grid-column: 1 / -1;
    }

    .state-control {
      grid-column: 1;
    }

    .actions {
      grid-column: 2;
      align-self: end;
    }

    .search-button {
      width: 44px;
      padding-inline: 0;
    }

    .search-button span {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .reset-button {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .state-hint {
      grid-column: 1 / -1;
    }

    .notice {
      align-items: flex-start;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .field,
    .clear-field,
    .search-button,
    .reset-button,
    .retry-button,
    .table-wrap {
      transition: none;
    }

    .progress span {
      width: 100%;
      animation: none;
      transform: none;
    }
  }
</style>
