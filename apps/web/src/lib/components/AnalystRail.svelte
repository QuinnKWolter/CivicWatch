<script lang="ts">
  import { browser } from '$app/environment';
  import { env } from '$env/dynamic/public';
  import { afterNavigate, goto } from '$app/navigation';
  import { onMount, tick } from 'svelte';
  import {
    Bookmark,
    Check,
    Download,
    Image,
    Link2,
    LoaderCircle,
    PanelLeftClose,
    Save,
    SlidersHorizontal,
    Trash2,
    X
  } from 'lucide-svelte';

  type FilterValue = string | string[];
  type BusyAction = 'permalink' | 'csv' | 'png' | null;
  type StatusKind = 'neutral' | 'success' | 'warning' | 'error';

  type Props = {
    snapshotId?: string;
    apiBase?: string;
    exportChart?: string;
    exportFilters?: Record<string, FilterValue>;
  };

  type SavedView = {
    id: string;
    label: string;
    url: string;
    createdAt: string;
    snapshotId?: string;
  };

  type ActiveFilter = {
    key: string;
    label: string;
    displayValue: string;
  };

  const DEFAULT_API_BASE =
    env.PUBLIC_API_BASE_URL ??
    'http://127.0.0.1:4000/api/v1';

  let {
    snapshotId = 'cw_2026_07_02_full',
    apiBase = DEFAULT_API_BASE,
    exportChart,
    exportFilters = {}
  }: Props = $props();

  const ANALYST_KEY = 'cw_analyst';
  const PIN_KEY = 'cw_pin_snapshot';
  const SAVED_KEY = 'cw_saved_views';
  const SAVED_VERSION = 1;
  const MAX_SAVED = 12;
  const MAX_SLOTS = 4;
  const RAIL_ID = 'civicwatch-analyst-rail';

  const FILTER_KEYS = [
    'state',
    'party',
    'chamber',
    'topic',
    'from',
    'to',
    'political',
    'minEngagement',
    'no-uncategorized',
    'date',
    'width',
    'categories'
  ] as const;

  const FILTER_LABELS: Record<string, string> = {
    state: 'State',
    party: 'Party',
    chamber: 'Chamber',
    topic: 'Topic',
    from: 'From',
    to: 'To',
    political: 'Posts',
    minEngagement: 'Minimum engagement',
    'no-uncategorized': 'Uncategorized',
    date: 'Date',
    width: 'Window',
    categories: 'Event category'
  };

  let analyst = $state(false);
  let panelOpen = $state(false);
  let initialized = $state(false);
  let pinSnapshot = $state(false);
  let currentFilters = $state<ActiveFilter[]>([]);
  let comparisonSlots = $state<string[]>([]);
  let saved = $state<SavedView[]>([]);
  let saving = $state(false);
  let saveLabel = $state('');
  let busyAction = $state<BusyAction>(null);
  let status = $state('');
  let statusKind = $state<StatusKind>('neutral');

  let railElement = $state<HTMLElement>();
  let saveInput = $state<HTMLInputElement>();
  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  const comparisonHref = $derived.by(() => {
    const params = new URLSearchParams();
    comparisonSlots.forEach((slot) => params.append('slot', slot));
    return `/compare${params.size ? `?${params}` : ''}`;
  });

  function getStorageValue(storage: Storage, key: string): string | null {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }

  function setStorageValue(storage: Storage, key: string, value: string): boolean {
    try {
      storage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function syncFromLocation() {
    if (!browser) return;

    const url = new URL(window.location.href);
    analyst = url.searchParams.get('analyst') === '1' || getStorageValue(sessionStorage, ANALYST_KEY) === '1';
    currentFilters = readFilters(url.searchParams);
    comparisonSlots = readSlots(url.searchParams);

    if (!initialized) {
      panelOpen = analyst && window.matchMedia('(min-width: 721px)').matches;
      initialized = true;
    } else if (!analyst) {
      panelOpen = false;
    }
  }

  function readFilters(params: URLSearchParams): ActiveFilter[] {
    return FILTER_KEYS.flatMap((key) => {
      const values = parameterValues(params, key);
      if (!values.length) return [];
      return [{ key, label: FILTER_LABELS[key] ?? humanize(key), displayValue: formatValues(key, values) }];
    });
  }

  function parameterValues(params: URLSearchParams, key: string): string[] {
    const splitComma = ['state', 'party', 'topic', 'categories'].includes(key);
    const values = params
      .getAll(key)
      .flatMap((value) => (splitComma ? value.split(',') : [value]))
      .map((value) => value.trim())
      .filter(Boolean);
    return [...new Set(values)];
  }

  function readSlots(params: URLSearchParams): string[] {
    const slots = [
      ...params.getAll('slot'),
      ...params.getAll('compare'),
      ...params.getAll('slots').flatMap((value) => value.split(','))
    ]
      .map((value) => value.trim())
      .filter(Boolean);
    return [...new Set(slots)].slice(0, MAX_SLOTS);
  }

  function formatValues(key: string, values: string[]): string {
    const formatted = values.map((value) => formatValue(key, value));
    return formatted.length <= 3
      ? formatted.join(', ')
      : `${formatted.slice(0, 3).join(', ')} +${formatted.length - 3} more`;
  }

  function formatValue(key: string, value: string): string {
    if (key === 'party') {
      return ({ D: 'Democratic', R: 'Republican', I: 'Independent' } as Record<string, string>)[value] ?? value;
    }
    if (key === 'chamber') return ({ H: 'House', S: 'Senate' } as Record<string, string>)[value] ?? value;
    if (key === 'political') return value === 'true' || value === '1' ? 'Political only' : 'Non-political only';
    if (key === 'no-uncategorized') return value === 'false' || value === '0' ? 'Included' : 'Excluded';
    if (key === 'width' && /^\d+$/.test(value)) return `${value} days`;
    return value;
  }

  function humanize(value: string): string {
    return value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[-_]+/g, ' ')
      .replace(/^./, (character) => character.toUpperCase());
  }

  function formatSlot(value: string): string {
    const [kind, ...identifier] = value.split(':');
    return identifier.length ? `${humanize(kind)} · ${identifier.join(':').replace(/_/g, ' ')}` : value.replace(/_/g, ' ');
  }

  async function togglePanel() {
    if (!analyst) {
      analyst = true;
      panelOpen = true;
      setStorageValue(sessionStorage, ANALYST_KEY, '1');
    } else {
      panelOpen = !panelOpen;
    }

    if (panelOpen) {
      await tick();
      railElement?.focus();
    }
  }

  async function exitAnalystMode() {
    analyst = false;
    panelOpen = false;
    setStorageValue(sessionStorage, ANALYST_KEY, '0');

    const url = new URL(window.location.href);
    if (!url.searchParams.has('analyst')) return;
    url.searchParams.delete('analyst');
    await navigate(url);
  }

  async function removeFilter(key: string) {
    const url = new URL(window.location.href);
    url.searchParams.delete(key);
    await navigate(url);
  }

  async function clearFilters() {
    const url = new URL(window.location.href);
    currentFilters.forEach((filter) => url.searchParams.delete(filter.key));
    await navigate(url);
  }

  async function removeSlot(index: number) {
    const remaining = comparisonSlots.filter((_, slotIndex) => slotIndex !== index);
    const url = new URL(window.location.href);
    ['slot', 'compare', 'slots'].forEach((key) => url.searchParams.delete(key));
    remaining.forEach((slot) => url.searchParams.append('slot', slot));
    await navigate(url);
  }

  async function navigate(url: URL) {
    await goto(`${url.pathname}${url.search}${url.hash}`, {
      replaceState: true,
      keepFocus: true,
      noScroll: true
    });
  }

  function togglePin() {
    pinSnapshot = !pinSnapshot;
    if (!setStorageValue(localStorage, PIN_KEY, pinSnapshot ? '1' : '0')) {
      showStatus('Snapshot preference could not be saved.', 'warning');
    }
  }

  function parseSavedViews(raw: string | null): SavedView[] {
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as unknown;
      const values = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { views?: unknown[] }).views)
          ? (parsed as { views: unknown[] }).views
          : [];

      return values
        .map((value, index) => normalizeSavedView(value, index))
        .filter((value): value is SavedView => value !== null)
        .slice(0, MAX_SAVED);
    } catch {
      showStatus('Saved views could not be read.', 'warning');
      return [];
    }
  }

  function normalizeSavedView(value: unknown, index: number): SavedView | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<SavedView>;
    if (typeof candidate.label !== 'string' || typeof candidate.url !== 'string' || !candidate.url.startsWith('/')) return null;

    return {
      id: typeof candidate.id === 'string' ? candidate.id : `legacy-${index}-${Date.now()}`,
      label: candidate.label.trim().slice(0, 80),
      url: candidate.url,
      createdAt:
        typeof candidate.createdAt === 'string' && !Number.isNaN(Date.parse(candidate.createdAt))
          ? candidate.createdAt
          : new Date().toISOString(),
      snapshotId: typeof candidate.snapshotId === 'string' ? candidate.snapshotId : undefined
    };
  }

  function persistSavedViews(): boolean {
    const payload = JSON.stringify({ version: SAVED_VERSION, views: saved });
    if (setStorageValue(localStorage, SAVED_KEY, payload)) return true;
    showStatus('This browser could not store the saved view.', 'error');
    return false;
  }

  async function openSaveForm() {
    saving = true;
    saveLabel = document.title.replace(/\s*[—|-]\s*CivicWatch\s*$/i, '').trim() || 'CivicWatch view';
    await tick();
    saveInput?.select();
  }

  function saveView(event: SubmitEvent) {
    event.preventDefault();
    const label = saveLabel.trim();
    if (!label) return;

    const view: SavedView = {
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      label: label.slice(0, 80),
      url: sharePath(`${location.pathname}${location.search}${location.hash}`, pinSnapshot, snapshotId),
      createdAt: new Date().toISOString(),
      snapshotId: pinSnapshot ? snapshotId : undefined
    };

    saved = [view, ...saved.filter((item) => item.url !== view.url)].slice(0, MAX_SAVED);
    if (!persistSavedViews()) return;
    saving = false;
    showStatus('View saved in this browser.', 'success');
  }

  function deleteSavedView(id: string) {
    saved = saved.filter((view) => view.id !== id);
    persistSavedViews();
    showStatus('Saved view removed.', 'neutral');
  }

  async function copyCurrentLink() {
    await copyPermalink(`${location.pathname}${location.search}${location.hash}`, snapshotId, pinSnapshot, 'Link copied.');
  }

  async function copySavedLink(view: SavedView) {
    await copyPermalink(view.url, view.snapshotId ?? snapshotId, Boolean(view.snapshotId) || pinSnapshot, `Link copied for “${view.label}”.`);
  }

  async function copyPermalink(source: string, pinId: string, pin: boolean, successMessage: string) {
    if (busyAction) return;
    busyAction = 'permalink';

    try {
      const requested = sharePath(source, pin, pinId);
      let normalized = requested;
      let fallback = false;

      try {
        const response = await fetch(endpoint('exports/permalink'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: requested, pinSnapshot: pin, snapshotId: pin ? pinId : undefined })
        });
        if (!response.ok) throw new Error();
        const json = (await response.json()) as { data?: { permalink?: string }; permalink?: string };
        normalized = json.data?.permalink ?? json.permalink ?? requested;
      } catch {
        fallback = true;
      }

      await copyText(new URL(normalized, location.origin).toString());
      showStatus(fallback ? 'Link copied without server normalization.' : successMessage, fallback ? 'warning' : 'success');
    } catch (error) {
      showStatus(messageFrom(error, 'The link could not be copied.'), 'error');
    } finally {
      busyAction = null;
    }
  }

  function sharePath(source: string, pin: boolean, pinId: string): string {
    const url = new URL(source, location.origin);
    url.searchParams.delete('analyst');
    if (pin) url.searchParams.set('snap', pinId);
    else url.searchParams.delete('snap');
    url.searchParams.sort();
    return `${url.pathname}${url.search}${url.hash}`;
  }

  async function copyText(value: string) {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Clipboard access is unavailable.');
  }

  async function download(kind: 'csv' | 'png') {
    if (busyAction) return;
    busyAction = kind;

    try {
      const chart = exportChart?.trim() || inferChart(location.pathname);
      const filters: Record<string, FilterValue> = { ...collectFilters(), ...exportFilters };
      if (pinSnapshot) filters.snap = snapshotId;

      const response = await fetch(endpoint(`exports/${kind}`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chart, filters })
      });
      if (!response.ok) throw await apiError(response);

      const blob = await response.blob();
      const fallback = `civicwatch_${sanitizeFilename(chart)}_${snapshotId}.${kind}`;
      downloadBlob(blob, responseFilename(response, fallback));
      showStatus(`${kind.toUpperCase()} export downloaded.`, 'success');
    } catch (error) {
      showStatus(messageFrom(error, `${kind.toUpperCase()} export failed.`), 'error');
    } finally {
      busyAction = null;
    }
  }

  function collectFilters(): Record<string, FilterValue> {
    const url = new URL(location.href);
    const filters: Record<string, FilterValue> = {};
    const ignored = new Set(['analyst', 'snap', 'slot', 'slots', 'compare']);

    for (const key of new Set(url.searchParams.keys())) {
      if (ignored.has(key)) continue;
      const values = url.searchParams.getAll(key).filter(Boolean);
      if (values.length) filters[key] = values.length === 1 ? values[0] : values;
    }

    const [section, identifier] = url.pathname.split('/').filter(Boolean);
    if (section === 'place' && identifier && !filters.state) filters.state = identifier.toUpperCase();
    if (section === 'topic' && identifier && !filters.topic) filters.topic = identifier;
    if (section === 'who' && identifier && !filters.lid) filters.lid = identifier;
    return filters;
  }

  function inferChart(pathname: string): string {
    const [section, identifier] = pathname.split('/').filter(Boolean);
    if (section === 'place') return identifier ? 'state-topics' : 'state-small-multiples';
    if (section === 'topic') return 'topic-ribbon';
    if (section === 'who') return identifier ? 'legislator-voice-fingerprint' : 'legislators';
    if (section === 'moment') return 'moment-window';
    if (section === 'compare') return 'comparison';
    return 'chamber';
  }

  function endpoint(path: string): string {
    return `${apiBase.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }

  async function apiError(response: Response): Promise<Error> {
    try {
      const json = (await response.json()) as { error?: { message?: string }; message?: string };
      return new Error(json.error?.message ?? json.message ?? `Request failed with status ${response.status}.`);
    } catch {
      return new Error(`Request failed with status ${response.status}.`);
    }
  }

  function responseFilename(response: Response, fallback: string): string {
    const disposition = response.headers.get('content-disposition') ?? '';
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    return sanitizeFilename(encoded ? decodeURIComponent(encoded) : plain ?? fallback);
  }

  function sanitizeFilename(value: string): string {
    return value.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 180);
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function messageFrom(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  function showStatus(message: string, kind: StatusKind, duration = 2600) {
    status = message;
    statusKind = kind;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      status = '';
      statusKind = 'neutral';
    }, duration);
  }

  function formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    if (saving) saving = false;
    else if (panelOpen) panelOpen = false;
  }

  onMount(() => {
    pinSnapshot = getStorageValue(localStorage, PIN_KEY) === '1';
    saved = parseSavedViews(getStorageValue(localStorage, SAVED_KEY));
    syncFromLocation();

    const syncStorage = (event: StorageEvent) => {
      if (event.key === PIN_KEY) pinSnapshot = event.newValue === '1';
      if (event.key === SAVED_KEY) saved = parseSavedViews(event.newValue);
    };
    window.addEventListener('storage', syncStorage);

    return () => {
      window.removeEventListener('storage', syncStorage);
      if (statusTimer) clearTimeout(statusTimer);
    };
  });

  afterNavigate(syncFromLocation);
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="analyst-shell" class:panel-open={panelOpen}>
  {#if analyst && panelOpen}
    <button class="scrim" type="button" aria-label="Close analyst tools" onclick={() => (panelOpen = false)}></button>
  {/if}

  <div class="rail-toggle">
    <button class:active={analyst} type="button" aria-controls={RAIL_ID} aria-expanded={analyst && panelOpen} onclick={togglePanel}>
      <SlidersHorizontal size={17} strokeWidth={1.8} aria-hidden="true" />
      {analyst ? 'Analyst mode' : 'Refine'}
      {#if analyst}<span class="mode-dot" aria-hidden="true"></span>{/if}
    </button>
  </div>

  {#if analyst && panelOpen}
    <aside id={RAIL_ID} class="rail" aria-label="Analyst tools" tabindex="-1" bind:this={railElement}>
      <header class="rail-header">
        <div>
          <p class="eyebrow">Research tools</p>
          <h2>Analyst mode</h2>
        </div>
        <div class="header-actions">
          <button class="text-button" type="button" onclick={exitAnalystMode}>Exit</button>
          <button class="icon-button" type="button" aria-label="Collapse analyst tools" onclick={() => (panelOpen = false)}>
            <PanelLeftClose size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div class="snapshot-card">
        <div class="snapshot-row"><span>Snapshot</span><code title={snapshotId}>{snapshotId}</code></div>
        <label class="pin-control">
          <input type="checkbox" checked={pinSnapshot} onchange={togglePin} />
          <span>
            <strong>Pin shared links</strong>
            <small>Keep this snapshot in permalinks and saved views.</small>
          </span>
        </label>
      </div>

      <section aria-labelledby="filters-heading">
        <div class="section-heading">
          <div><h3 id="filters-heading">Active filters</h3><span>{currentFilters.length}</span></div>
          {#if currentFilters.length >= 2}<button class="quiet-button" type="button" onclick={clearFilters}>Clear all</button>{/if}
        </div>

        {#if currentFilters.length}
          <div class="filter-list">
            {#each currentFilters as filter (filter.key)}
              <button
                class="filter-chip"
                type="button"
                aria-label={`Remove ${filter.label} filter: ${filter.displayValue}`}
                onclick={() => removeFilter(filter.key)}
              >
                <span><strong>{filter.label}</strong>{filter.displayValue}</span>
                <X size={14} strokeWidth={1.9} aria-hidden="true" />
              </button>
            {/each}
          </div>
        {:else}
          <p class="empty-copy">This view has no active filters.</p>
        {/if}
      </section>

      <section aria-labelledby="comparison-heading">
        <div class="section-heading">
          <div><h3 id="comparison-heading">Comparison</h3><span>{comparisonSlots.length}/{MAX_SLOTS}</span></div>
          {#if comparisonSlots.length}<a class="quiet-link" href={comparisonHref}>Open</a>{/if}
        </div>

        {#if comparisonSlots.length}
          <ol class="slot-list">
            {#each comparisonSlots as slot, index (`${slot}-${index}`)}
              <li>
                <span class="slot-number">{index + 1}</span>
                <span title={slot}>{formatSlot(slot)}</span>
                <button class="icon-button compact" type="button" aria-label={`Remove ${formatSlot(slot)}`} onclick={() => removeSlot(index)}>
                  <X size={14} strokeWidth={1.9} aria-hidden="true" />
                </button>
              </li>
            {/each}
          </ol>
        {:else}
          <p class="empty-copy">Add up to four entities from profile and drilldown pages.</p>
        {/if}
      </section>

      <section aria-labelledby="export-heading">
        <div class="section-heading"><div><h3 id="export-heading">Save and export</h3></div></div>

        {#if saving}
          <form class="save-form" onsubmit={saveView}>
            <label for="saved-view-label">View name</label>
            <div>
              <input id="saved-view-label" bind:this={saveInput} bind:value={saveLabel} maxlength="80" autocomplete="off" />
              <button class="primary-button" type="submit" disabled={!saveLabel.trim()}>Save</button>
              <button class="icon-button" type="button" aria-label="Cancel saving view" onclick={() => (saving = false)}>
                <X size={16} strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
          </form>
        {:else}
          <div class="tool-grid">
            <button type="button" onclick={openSaveForm} disabled={busyAction !== null}>
              <Save size={16} strokeWidth={1.8} aria-hidden="true" /><span>Save view</span>
            </button>
            <button type="button" onclick={copyCurrentLink} disabled={busyAction !== null} aria-busy={busyAction === 'permalink'}>
              {#if busyAction === 'permalink'}<LoaderCircle class="spinner" size={16} aria-hidden="true" />{:else}<Link2 size={16} strokeWidth={1.8} aria-hidden="true" />{/if}
              <span>Copy link</span>
            </button>
            <button type="button" onclick={() => download('csv')} disabled={busyAction !== null} aria-busy={busyAction === 'csv'}>
              {#if busyAction === 'csv'}<LoaderCircle class="spinner" size={16} aria-hidden="true" />{:else}<Download size={16} strokeWidth={1.8} aria-hidden="true" />{/if}
              <span>CSV</span>
            </button>
            <button type="button" onclick={() => download('png')} disabled={busyAction !== null} aria-busy={busyAction === 'png'}>
              {#if busyAction === 'png'}<LoaderCircle class="spinner" size={16} aria-hidden="true" />{:else}<Image size={16} strokeWidth={1.8} aria-hidden="true" />{/if}
              <span>PNG</span>
            </button>
          </div>
        {/if}

        <div class="status" class:visible={Boolean(status)} class:success={statusKind === 'success'} class:warning={statusKind === 'warning'} class:error={statusKind === 'error'} aria-live="polite">
          {#if status}{#if statusKind === 'success'}<Check size={15} aria-hidden="true" />{/if}<span>{status}</span>{/if}
        </div>
      </section>

      <section aria-labelledby="saved-heading">
        <div class="section-heading"><div><h3 id="saved-heading">Saved views</h3><span>{saved.length}</span></div></div>

        {#if saved.length}
          <ul class="saved-list">
            {#each saved as view (view.id)}
              <li>
                <a class="saved-link" href={view.url}>
                  <Bookmark size={15} strokeWidth={1.8} aria-hidden="true" />
                  <span><strong>{view.label}</strong><small>{formatDate(view.createdAt)}{view.snapshotId ? ' · Pinned' : ''}</small></span>
                </a>
                <div class="saved-actions">
                  <button class="icon-button compact" type="button" aria-label={`Copy link for ${view.label}`} onclick={() => copySavedLink(view)} disabled={busyAction !== null}>
                    <Link2 size={14} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                  <button class="icon-button compact destructive" type="button" aria-label={`Delete ${view.label}`} onclick={() => deleteSavedView(view.id)}>
                    <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
                  </button>
                </div>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="empty-copy">Saved views stay in this browser and do not require an account.</p>
        {/if}
      </section>
    </aside>
  {/if}
</div>

<style>
  .analyst-shell {
    --ink: var(--color-ink, #1a1917);
    --paper: var(--color-paper, #f5f1e7);
    --card: var(--color-card, #fff);
    --elevated: var(--color-elevated, #faf8f1);
    --rule: var(--color-rule, #d9d2c1);
    --mute: var(--color-mute, #6b6659);
    --mute-soft: var(--color-mute-soft, #9c9787);
    --seal: var(--color-seal, #8a5a1a);
    --signal: var(--color-signal, #3a6c4c);
    --warn: var(--color-warn, #a86a1f);
    --error: var(--color-error, #8a2a20);
    color: var(--ink);
  }

  button, input { font: inherit; }
  button { cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: .5; }
  h2, h3, p { margin: 0; }

  .rail-toggle { position: fixed; left: 16px; bottom: max(16px, env(safe-area-inset-bottom)); z-index: 42; }
  .rail-toggle button {
    display: inline-flex; min-height: 42px; align-items: center; gap: 8px; padding: 9px 12px;
    border: 1px solid var(--rule); border-radius: 6px; background: var(--card); color: var(--ink);
    box-shadow: 0 4px 16px rgb(26 25 23 / 8%); font-size: .875rem; font-weight: 600;
  }
  .rail-toggle button.active { border-color: color-mix(in srgb, var(--seal) 55%, var(--rule)); }
  .mode-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--seal); }

  .scrim { position: fixed; inset: 0; z-index: 39; display: none; border: 0; background: rgb(26 25 23 / 34%); }
  .rail {
    position: fixed; top: 72px; bottom: 72px; left: 16px; z-index: 41; width: min(336px, calc(100vw - 32px));
    overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding: 18px;
    border: 1px solid var(--rule); border-radius: 6px; background: var(--card); box-shadow: 0 8px 28px rgb(26 25 23 / 10%);
  }
  .rail:focus { outline: none; }
  .rail-header, .header-actions, .snapshot-row, .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .rail-header { padding-bottom: 16px; border-bottom: 1px solid var(--rule); }
  .header-actions { gap: 3px; }
  h2 { font-size: 1.125rem; line-height: 1.35; letter-spacing: -.015em; }
  h3 { font-size: .875rem; line-height: 1.35; }
  .eyebrow { margin-bottom: 2px; color: var(--mute); font-size: .6875rem; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }

  .text-button, .quiet-button, .icon-button { border: 0; background: transparent; color: var(--mute); }
  .text-button, .quiet-button, .quiet-link { padding: 6px; font-size: .75rem; font-weight: 600; }
  .quiet-link { color: var(--seal); text-decoration: none; }
  .icon-button { display: inline-grid; width: 36px; height: 36px; place-items: center; padding: 0; border-radius: 6px; }
  .icon-button.compact { width: 30px; height: 30px; }
  .icon-button.destructive:hover { color: var(--error); }

  .snapshot-card { display: grid; gap: 11px; margin-top: 16px; padding: 12px; border: 1px solid var(--rule); border-radius: 6px; background: var(--elevated); }
  .snapshot-row { align-items: baseline; color: var(--mute); font-size: .75rem; }
  .snapshot-row code { max-width: 70%; overflow: hidden; color: var(--ink); font: .6875rem 'JetBrains Mono', ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
  .pin-control { display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: start; cursor: pointer; }
  .pin-control input { margin: 2px 0 0; accent-color: var(--seal); }
  .pin-control strong, .pin-control small { display: block; }
  .pin-control strong { font-size: .8125rem; line-height: 1.35; }
  .pin-control small { margin-top: 2px; color: var(--mute); font-size: .71875rem; line-height: 1.4; }

  section { padding-top: 18px; }
  section + section { margin-top: 18px; border-top: 1px solid var(--rule); }
  .section-heading { min-height: 28px; margin-bottom: 9px; }
  .section-heading > div { display: flex; align-items: center; gap: 7px; }
  .section-heading span, .slot-number { color: var(--mute-soft); font: .6875rem 'JetBrains Mono', ui-monospace, monospace; }

  .filter-list { display: flex; flex-wrap: wrap; gap: 7px; }
  .filter-chip {
    display: inline-flex; max-width: 100%; min-height: 30px; align-items: center; gap: 7px; padding: 5px 7px 5px 9px;
    border: 1px solid var(--rule); border-radius: 999px; background: var(--elevated); color: var(--mute); font-size: .75rem; text-align: left;
  }
  .filter-chip span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .filter-chip strong { margin-right: 5px; color: var(--ink); }

  .slot-list, .saved-list { padding: 0; margin: 0; list-style: none; }
  .slot-list { display: grid; gap: 6px; }
  .slot-list li { display: grid; grid-template-columns: 24px minmax(0, 1fr) 30px; gap: 8px; align-items: center; min-height: 36px; padding: 3px 3px 3px 7px; border: 1px solid var(--rule); border-radius: 6px; background: var(--elevated); font-size: .78125rem; }
  .slot-list li > span:nth-child(2) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty-copy { color: var(--mute); font-size: .78125rem; line-height: 1.5; }

  .tool-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .tool-grid button, .primary-button {
    display: inline-flex; min-height: 42px; align-items: center; gap: 8px; padding: 9px 10px;
    border: 1px solid var(--rule); border-radius: 6px; background: var(--card); color: var(--ink); font-size: .78125rem; font-weight: 600;
  }
  .tool-grid button:hover, .rail-toggle button:hover, .filter-chip:hover, .slot-list li:hover { border-color: color-mix(in srgb, var(--seal) 48%, var(--rule)); }
  .save-form { display: grid; gap: 6px; }
  .save-form label { font-size: .75rem; font-weight: 600; }
  .save-form > div { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 6px; }
  .save-form input { min-width: 0; min-height: 40px; padding: 8px 10px; border: 1px solid var(--rule); border-radius: 6px; background: var(--card); color: var(--ink); }
  .primary-button { justify-content: center; border-color: var(--seal); background: var(--seal); color: #fff; }
  :global(.spinner) { animation: spin .8s linear infinite; }

  .status { display: flex; min-height: 20px; align-items: center; gap: 6px; margin-top: 8px; color: var(--mute); font-size: .75rem; opacity: 0; }
  .status.visible { opacity: 1; }
  .status.success { color: var(--signal); }
  .status.warning { color: var(--warn); }
  .status.error { color: var(--error); }

  .saved-list li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 5px; align-items: center; padding: 7px 0; border-top: 1px solid var(--rule); }
  .saved-list li:first-child { border-top: 0; }
  .saved-link { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 7px; min-width: 0; padding: 5px 2px; color: var(--ink); text-decoration: none; }
  .saved-link :global(svg) { margin-top: 2px; color: var(--seal); }
  .saved-link strong, .saved-link small { display: block; }
  .saved-link strong { overflow: hidden; font-size: .78125rem; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
  .saved-link small { margin-top: 2px; color: var(--mute); font-size: .6875rem; }
  .saved-actions { display: flex; gap: 2px; }

  button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid var(--seal); outline-offset: 2px; }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 720px) {
    .scrim { display: block; }
    .rail-toggle { right: 12px; bottom: max(12px, env(safe-area-inset-bottom)); left: auto; }
    .panel-open .rail-toggle { visibility: hidden; }
    .rail { top: auto; right: 0; bottom: 0; left: 0; width: 100%; max-height: min(82dvh, 720px); box-sizing: border-box; padding: 18px 16px calc(18px + env(safe-area-inset-bottom)); border-right: 0; border-bottom: 0; border-left: 0; border-radius: 12px 12px 0 0; }
    .rail-header { position: sticky; top: -18px; z-index: 1; margin: -18px -16px 0; padding: 16px; background: var(--card); }
    .tool-grid button { min-height: 46px; }
  }

  @media (max-width: 390px) { .tool-grid { grid-template-columns: 1fr; } }
  @media (prefers-reduced-motion: reduce) { :global(.spinner) { animation-duration: 1.6s; } }
  @media (forced-colors: active) { .rail, .snapshot-card, .filter-chip, .slot-list li, .tool-grid button { border: 1px solid CanvasText; } .mode-dot { background: ButtonText; } }
  @media print { .analyst-shell { display: none !important; } }
</style>
