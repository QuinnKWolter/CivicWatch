<script lang="ts">
  import { browser } from '$app/environment';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import {
    Check,
    Download,
    FileJson,
    FileSpreadsheet,
    Filter,
    Link2,
    X
  } from 'lucide-svelte';
  import { appPath, withoutBase } from '$lib/paths';

  type Props = {
    snapshotId?: string;
  };

  type ActiveFilter = {
    key: string;
    label: string;
    value: string;
  };

  type ExportView = {
    label: string;
    routeLabel: string;
    rows: Record<string, unknown>[];
    samples: string[];
  };

  const DOWNLOAD_CAP = 5000;

  const FILTER_LABELS: Record<string, string> = {
    q: 'Search',
    query: 'Search',
    state: 'State',
    party: 'Party',
    chamber: 'Chamber',
    topic: 'Topic',
    from: 'From',
    to: 'To',
    date: 'Date',
    width: 'Window',
    window: 'Window',
    bucket: 'Time bucket',
    slots: 'Comparison slots',
    slot: 'Comparison slot',
    sort: 'Sort',
    color: 'Color',
    normalize: 'Scale',
    direction: 'Direction',
    type: 'Interaction type',
    minPosts: 'Minimum posts',
    external: 'Targets'
  };

  const IGNORED_PARAMS = new Set(['snap', 'analyst']);

  let { snapshotId = 'cw_2026_07_02_full' }: Props = $props();

  let open = $state(false);
  let downloadOpen = $state(false);
  let copied = $state(false);
  let status = $state('');
  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  const routePath = $derived(withoutBase(page.url.pathname));
  const activeFilters = $derived(readActiveFilters(page.url, routePath));
  const exportView = $derived(buildExportView(page.data, page.url, routePath));
  const exportRows = $derived(exportView.rows.slice(0, DOWNLOAD_CAP));
  const hasTruncatedDownload = $derived(exportView.rows.length > DOWNLOAD_CAP);
  const downloadableCount = $derived(exportRows.length);
  const downloadableLabel = $derived(
    `${downloadableCount.toLocaleString()} ${pluralize(exportView.label, downloadableCount)}`
  );

  afterNavigate(() => {
    open = false;
    downloadOpen = false;
    copied = false;
  });

  function readActiveFilters(url: URL, path: string): ActiveFilter[] {
    const filters: ActiveFilter[] = [];
    const segments = path.split('/').filter(Boolean);

    if (segments[0] === 'who' && segments[1]) {
      filters.push({
        key: 'legislator',
        label: 'Legislator',
        value: decodeURIComponent(segments[1])
      });
    }

    if (segments[0] === 'place' && segments[1]) {
      filters.push({
        key: 'state-path',
        label: 'State',
        value: decodeURIComponent(segments[1]).toUpperCase()
      });
    }

    if (segments[0] === 'topic' && segments[1]) {
      filters.push({
        key: 'topic-path',
        label: 'Topic',
        value: labelFromSlug(segments[1])
      });
    }

    for (const [key, rawValue] of url.searchParams.entries()) {
      if (IGNORED_PARAMS.has(key) || !rawValue) continue;

      filters.push({
        key,
        label: FILTER_LABELS[key] ?? humanize(key),
        value: formatFilterValue(key, rawValue)
      });
    }

    return dedupeFilters(filters);
  }

  function buildExportView(data: App.PageData, url: URL, path: string): ExportView {
    const pageData: Record<string, unknown> = isRecord(data) ? data : {};
    const segments = path.split('/').filter(Boolean);
    let label = 'records';
    let routeLabel = 'Current view';
    let rows: Record<string, unknown>[] = [];

    if (segments[0] === 'who' && segments[1]) {
      routeLabel = 'Legislator profile';
      label = 'profile records';
      rows = rowsFromFirst(pageData, ['profile', 'posts', 'topPosts', 'fingerprint']);
    } else if (segments[0] === 'who') {
      routeLabel = 'Legislators';
      label = 'legislators';
      rows = filterLegislators(envelopeRows(pageData.legislators), url);
    } else if (segments[0] === 'place' && segments[1]) {
      routeLabel = 'State profile';
      label = 'state records';
      rows = rowsFromFirst(pageData, ['summary', 'topics', 'topPosts', 'chamber', 'trend']);
    } else if (segments[0] === 'place') {
      routeLabel = 'States';
      label = 'states';
      rows = envelopeRows(pageData.states);
    } else if (segments[0] === 'topic' && segments[1]) {
      routeLabel = 'Topic profile';
      label = 'topic records';
      rows = rowsFromFirst(pageData, ['topic', 'salience', 'beeswarm', 'topPosts', 'partyChamber']);
    } else if (segments[0] === 'topic') {
      routeLabel = 'Topics';
      label = 'topics';
      rows = envelopeRows(pageData.topics);
    } else if (segments[0] === 'moment') {
      routeLabel = 'Moments';
      label = 'moment records';
      rows = rowsFromFirst(pageData, ['topPosts', 'window', 'daily', 'events']);
    } else if (segments[0] === 'compare') {
      routeLabel = 'Comparison';
      label = 'comparison records';
      rows = rowsFromFirst(pageData, ['compare']);
    } else {
      routeLabel = 'Overview';
      label = 'records';
      rows = firstArray(pageData);
    }

    const normalizedRows = rows.map((row) => normalizeRow(row));

    return {
      label,
      routeLabel,
      rows: normalizedRows,
      samples: normalizedRows.slice(0, 4).map(describeRow).filter(Boolean)
    };
  }

  function rowsFromFirst(
    data: Record<string, unknown>,
    keys: string[]
  ): Record<string, unknown>[] {
    for (const key of keys) {
      const rows = envelopeRows(data[key]);
      if (rows.length) return rows;
    }

    return [];
  }

  function firstArray(value: unknown): Record<string, unknown>[] {
    if (!isRecord(value)) return [];

    for (const candidate of Object.values(value)) {
      const rows = envelopeRows(candidate);
      if (rows.length) return rows;
    }

    return [];
  }

  function envelopeRows(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }

    if (!isRecord(value)) return [];

    if (Array.isArray(value.data)) {
      return value.data.filter(isRecord);
    }

    if (Array.isArray(value.rows)) {
      return value.rows.filter(isRecord);
    }

    if (isRecord(value.data)) {
      return [value.data];
    }

    return [value];
  }

  function filterLegislators(rows: Record<string, unknown>[], url: URL): Record<string, unknown>[] {
    const query = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase();
    const party = url.searchParams.get('party') ?? '';
    const stateParam = url.searchParams.get('state') ?? '';
    const state = stateParam === '__unknown' ? stateParam : stateParam.toUpperCase();
    const chamber = url.searchParams.get('chamber') ?? '';

    return rows.filter((row) => {
      if (query) {
        const haystack = [
          row.name,
          row.displayName,
          row.display_name,
          row.handle,
          row.username,
          row.party,
          row.state,
          row.chamber
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase();

        if (!haystack.includes(query)) return false;
      }

      if (party && !matchesFilter(row.party, party)) return false;
      if (state && !matchesFilter(row.state, state)) return false;
      if (chamber && !matchesFilter(row.chamber, chamber)) return false;

      return true;
    });
  }

  function matchesFilter(value: unknown, filter: string): boolean {
    if (filter === '__unknown') return !cleanString(value);
    return cleanString(value) === filter;
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'function' || value === undefined) continue;
      normalized[key] = serializeCell(value);
    }

    return normalized;
  }

  function serializeCell(value: unknown): unknown {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value;
    }

    if (value instanceof Date) return value.toISOString();

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  function describeRow(row: Record<string, unknown>): string {
    const candidates = [
      row.name,
      row.displayName,
      row.display_name,
      row.topicLabel,
      row.topic_label,
      row.state,
      row.handle,
      row.username,
      row.id,
      row.lid
    ];

    return String(candidates.find((value) => cleanString(value)) ?? '').trim();
  }

  async function copyLink(): Promise<void> {
    if (!browser) return;

    const link = currentShareLink();

    try {
      await navigator.clipboard.writeText(link);
      copied = true;
      showStatus('Filtered link copied.');
    } catch {
      const field = document.createElement('textarea');
      field.value = link;
      field.setAttribute('readonly', 'true');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      document.execCommand('copy');
      field.remove();
      copied = true;
      showStatus('Filtered link copied.');
    }
  }

  function download(format: 'csv' | 'json'): void {
    if (!browser) return;

    const filename = `civicwatch_${slugify(exportView.routeLabel)}_${new Date()
      .toISOString()
      .slice(0, 10)}.${format}`;

    const payload =
      format === 'json'
        ? JSON.stringify(
            {
              snapshotId,
              generatedAt: new Date().toISOString(),
              sourceUrl: currentShareLink(),
              totalMatchingRecords: exportView.rows.length,
              exportedRecords: exportRows.length,
              cap: DOWNLOAD_CAP,
              filters: activeFilters,
              rows: exportRows
            },
            null,
            2
          )
        : toCsv(exportRows);

    const type =
      format === 'json'
        ? 'application/json;charset=utf-8'
        : 'text/csv;charset=utf-8';

    const blob = new Blob([payload], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    downloadOpen = false;
    showStatus(`${format.toUpperCase()} download prepared.`);
  }

  function toCsv(rows: Record<string, unknown>[]): string {
    if (!rows.length) return 'value\n';

    const columns = [
      ...new Set(rows.slice(0, 100).flatMap((row) => Object.keys(row)))
    ];

    return [
      columns.map(csvCell).join(','),
      ...rows.map((row) =>
        columns.map((column) => csvCell(row[column])).join(',')
      )
    ].join('\n');
  }

  function csvCell(value: unknown): string {
    const text = String(value ?? '');
    return /[",\n\r]/.test(text)
      ? `"${text.replaceAll('"', '""')}"`
      : text;
  }

  function showStatus(message: string): void {
    status = message;

    if (statusTimer !== undefined) {
      clearTimeout(statusTimer);
    }

    statusTimer = setTimeout(() => {
      status = '';
      copied = false;
    }, 2600);
  }

  function currentShareLink(): string {
    const url = new URL(window.location.href);
    IGNORED_PARAMS.forEach((key) => url.searchParams.delete(key));
    return url.toString();
  }

  function formatFilterValue(key: string, value: string): string {
    if (key === 'slots' || key === 'slot') {
      return value
        .split(',')
        .map((part) => part.replace(':', ': '))
        .join(', ');
    }

    if (value === '__unknown') return 'Unknown';
    return decodeURIComponent(value).replaceAll('_', ' ');
  }

  function dedupeFilters(filters: ActiveFilter[]): ActiveFilter[] {
    const seen = new Set<string>();

    return filters.filter((filter) => {
      const signature = `${filter.label}:${filter.value}`;
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
  }

  function humanize(value: string): string {
    return value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function labelFromSlug(value: string): string {
    return humanize(decodeURIComponent(value));
  }

  function cleanString(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function pluralize(label: string, count: number): string {
    if (count === 1) {
      return label.replace(/s$/, '');
    }

    return label;
  }

  function slugify(value: string): string {
    return (
      value
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'export'
    );
  }
</script>

<div class="analyst-compact" class:is-open={open}>
  <button
    type="button"
    class="analyst-trigger"
    aria-expanded={open}
    aria-controls="analyst-filter-panel"
    onclick={() => {
      open = !open;
      downloadOpen = false;
    }}
  >
    <Filter size={15} strokeWidth={1.9} aria-hidden="true" />
    <span>Filters</span>
    <strong>{activeFilters.length}</strong>
  </button>

  {#if open}
    <section
      id="analyst-filter-panel"
      class="analyst-panel"
      aria-label="Active filters and downloads"
    >
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Active filters</p>
          <h2>{exportView.routeLabel}</h2>
        </div>

        <button
          type="button"
          class="icon-button"
          aria-label="Close filter notice"
          onclick={() => {
            open = false;
            downloadOpen = false;
          }}
        >
          <X size={16} strokeWidth={1.9} aria-hidden="true" />
        </button>
      </div>

      {#if activeFilters.length}
        <div class="filter-list" aria-label="Current filters">
          {#each activeFilters as filter (`${filter.key}:${filter.value}`)}
            <span class="filter-chip">
              <span>{filter.label}</span>
              <strong>{filter.value}</strong>
            </span>
          {/each}
        </div>
      {:else}
        <p class="quiet">
          No active filters are applied to this view.
        </p>
      {/if}

      <div class="record-summary">
        <div>
          <span class="summary-number">{exportView.rows.length.toLocaleString()}</span>
          <span>{pluralize(exportView.label, exportView.rows.length)} included</span>
        </div>

        {#if exportView.samples.length}
          <p>{exportView.samples.join(' · ')}</p>
        {:else}
          <p>No page records are available for export in this view.</p>
        {/if}
      </div>

      <div class="actions">
        <button
          type="button"
          class="action-button"
          onclick={copyLink}
        >
          {#if copied}
            <Check size={16} strokeWidth={2} aria-hidden="true" />
            Copied
          {:else}
            <Link2 size={16} strokeWidth={1.9} aria-hidden="true" />
            Copy Link
          {/if}
        </button>

        <div class="download-control">
          <button
            type="button"
            class="action-button"
            aria-expanded={downloadOpen}
            onclick={() => (downloadOpen = !downloadOpen)}
          >
            <Download size={16} strokeWidth={1.9} aria-hidden="true" />
            Download
          </button>

          {#if downloadOpen}
            <div class="download-menu" role="menu" aria-label="Download format">
              <button type="button" role="menuitem" onclick={() => download('csv')}>
                <FileSpreadsheet size={15} strokeWidth={1.8} aria-hidden="true" />
                CSV
              </button>
              <button type="button" role="menuitem" onclick={() => download('json')}>
                <FileJson size={15} strokeWidth={1.8} aria-hidden="true" />
                JSON
              </button>
            </div>
          {/if}
        </div>
      </div>

      <p class="cap-note">
        Downloads are capped at {DOWNLOAD_CAP.toLocaleString()} records{hasTruncatedDownload ? `; this file will include ${downloadableLabel}.` : '.'}
        For larger extracts, <a href={appPath('/about')}>contact us through About</a>.
      </p>

      {#if status}
        <p class="status" aria-live="polite">{status}</p>
      {/if}
    </section>
  {/if}
</div>

<style>
  .analyst-compact {
    position: fixed;
    right: clamp(12px, 2vw, 24px);
    bottom: clamp(12px, 2vw, 24px);
    z-index: 35;
    display: grid;
    justify-items: end;
    gap: 8px;
    pointer-events: none;
  }

  .analyst-trigger,
  .analyst-panel,
  .download-menu {
    pointer-events: auto;
  }

  .analyst-trigger {
    min-height: 34px;
    padding: 6px 9px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--color-seal), var(--color-rule) 42%);
    background: color-mix(in srgb, var(--color-card), transparent 5%);
    color: var(--color-ink);
    box-shadow: var(--shadow-md);
    gap: 7px;
    font-size: 0.84rem;
  }

  .analyst-trigger strong {
    display: inline-grid;
    min-width: 22px;
    height: 22px;
    place-items: center;
    border-radius: 999px;
    background: var(--color-seal);
    color: var(--color-paper);
    font-family: var(--type-mono);
    font-size: 0.76rem;
  }

  .analyst-panel {
    width: min(420px, calc(100vw - 24px));
    max-height: min(72vh, 620px);
    overflow: auto;
    border: 1px solid var(--color-rule);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-card), var(--color-paper) 12%);
    color: var(--color-ink);
    box-shadow: var(--shadow-lg);
    padding: 13px;
  }

  .panel-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .eyebrow {
    margin: 0 0 2px;
    color: var(--color-seal);
    font-family: var(--type-mono);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .panel-heading h2 {
    margin: 0;
    font-size: 1.02rem;
    line-height: 1.2;
  }

  .icon-button {
    width: 30px;
    height: 30px;
    min-height: 30px;
    padding: 0;
    border-radius: 999px;
    justify-content: center;
    flex: 0 0 auto;
  }

  .filter-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }

  .filter-chip {
    display: inline-flex;
    min-width: 0;
    max-width: 100%;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--color-rule);
    border-radius: 999px;
    background: var(--color-elevated);
    padding: 4px 8px;
    font-size: 0.78rem;
  }

  .filter-chip span {
    color: var(--color-mute);
  }

  .filter-chip strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 750;
  }

  .quiet,
  .cap-note,
  .record-summary p,
  .status {
    color: var(--color-mute);
    font-size: 0.86rem;
  }

  .quiet {
    margin: 0 0 10px;
  }

  .record-summary {
    border-top: 1px solid var(--color-rule);
    border-bottom: 1px solid var(--color-rule);
    padding-block: 10px;
    margin-bottom: 11px;
  }

  .record-summary > div {
    display: flex;
    align-items: baseline;
    gap: 7px;
    margin-bottom: 4px;
  }

  .summary-number {
    color: var(--color-ink);
    font-family: var(--type-mono);
    font-size: 1.2rem;
    font-weight: 850;
  }

  .record-summary p {
    margin: 0;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .action-button {
    min-height: 34px;
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 0.86rem;
    box-shadow: none;
  }

  .download-control {
    position: relative;
  }

  .download-menu {
    position: absolute;
    right: 0;
    bottom: calc(100% + 8px);
    display: grid;
    gap: 4px;
    min-width: 136px;
    border: 1px solid var(--color-rule);
    border-radius: 8px;
    background: var(--color-card);
    padding: 6px;
    box-shadow: var(--shadow-lg);
  }

  .download-menu button {
    min-height: 32px;
    justify-content: flex-start;
    border-radius: 6px;
    box-shadow: none;
    font-size: 0.86rem;
  }

  .cap-note {
    margin: 10px 0 0;
  }

  .cap-note a {
    color: var(--color-seal);
    font-weight: 750;
  }

  .status {
    margin: 8px 0 0;
  }

  @media (max-width: 640px) {
    .analyst-compact {
      inset-inline: 10px;
      bottom: 10px;
      justify-items: stretch;
    }

    .analyst-trigger {
      justify-self: end;
    }

    .analyst-panel {
      width: 100%;
      max-height: 70vh;
    }
  }
</style>
