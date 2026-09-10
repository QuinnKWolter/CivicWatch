<script lang="ts">
  import { env } from '$env/dynamic/public';
  import { browser } from '$app/environment';
  import { afterNavigate, goto } from '$app/navigation';
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
  import { trackEvent } from '$lib/analytics';
  import { appPath, withoutBase } from '$lib/paths';

  type ActiveFilter = {
    key: string;
    label: string;
    value: string;
  };

  type FilterControl = {
    key: string;
    label: string;
    type: 'search' | 'text' | 'date' | 'number' | 'select';
    value: string;
    placeholder?: string;
    maxLength?: number;
    min?: string | number;
    max?: string | number;
    options?: { value: string; label: string }[];
  };

  type ExportOption = {
    id: string;
    label: string;
    description: string;
    chart: string;
    filters: Record<string, string>;
  };

  type RailContext = {
    routeLabel: string;
    pageSlug: string;
    recordLabel: string;
    includedCount: number | null;
    activeFilters: ActiveFilter[];
    controls: FilterControl[];
    exportOptions: ExportOption[];
    formAction: string;
    clearHref: string;
  };

  const DOWNLOAD_CAP = 5000;
  const DEFAULT_API_BASE =
    env.PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1';
  const IGNORED_PARAMS = new Set(['snap', 'analyst']);
  const FILTER_LABELS: Record<string, string> = {
    q: 'Search',
    state: 'State',
    party: 'Party',
    chamber: 'Chamber',
    topic: 'Topic',
    from: 'From',
    to: 'To',
    date: 'Date',
    width: 'Window',
    bucket: 'Time bucket',
    sort: 'Sort',
    normalize: 'Origin scale',
    color: 'Origin color'
  };

  let open = $state(false);
  let downloadOpen = $state(false);
  let copied = $state(false);
  let status = $state('');
  let selectedExportId = $state('');
  let downloading = $state(false);
  let statusTimer: ReturnType<typeof setTimeout> | undefined;

  const routePath = $derived(withoutBase(page.url.pathname));
  const rail = $derived(buildRailContext(page.data, page.url, routePath));
  const selectedExport = $derived(
    rail.exportOptions.find((option) => option.id === selectedExportId) ??
      rail.exportOptions[0] ??
      null
  );

  $effect(() => {
    if (
      rail.exportOptions.length &&
      !rail.exportOptions.some((option) => option.id === selectedExportId)
    ) {
      selectedExportId = rail.exportOptions[0].id;
    }
  });

  afterNavigate(() => {
    open = false;
    downloadOpen = false;
    copied = false;
  });

  function buildRailContext(
    data: App.PageData,
    url: URL,
    path: string
  ): RailContext {
    const pageData: Record<string, unknown> = isRecord(data) ? data : {};
    const segments = path.split('/').filter(Boolean);
    const params = url.searchParams;
    const topicOptions = topicSelectOptions(pageData);
    const basePath = `/${segments.join('/')}`;
    const formAction = appPath(basePath === '/' ? '/' : basePath);
    const queryFilters = readQueryFilters(params);

    if (segments[0] === 'who' && segments[1]) {
      const lid = decodeURIComponent(segments[1]);
      const profile = envelopeData(pageData.profile);
      const name = cleanString(profile?.name) || `Legislator ${lid}`;
      const filters = filterObject({
        lid,
        topic: params.get('topic') ?? '',
        from: params.get('from') ?? '',
        to: params.get('to') ?? ''
      });

      return {
        routeLabel: name,
        pageSlug: 'legislator',
        recordLabel: 'profile',
        includedCount: null,
        activeFilters: [
          { key: 'lid', label: 'Legislator', value: name },
          ...queryFilters
        ],
        controls: [
          selectControl('topic', 'Topic', params.get('topic') ?? '', topicOptions),
          dateControl('from', 'From', params.get('from') ?? ''),
          dateControl('to', 'To', params.get('to') ?? '')
        ],
        exportOptions: [
          {
            id: 'legislator_posts',
            label: 'Legislator posts',
            description: 'Canonical posts by this legislator using the current topic and date filters.',
            chart: 'legislator_posts',
            filters
          },
          {
            id: 'legislator_posts_engaged',
            label: 'Most engaged posts',
            description: 'The same posts, ordered by likes plus reposts.',
            chart: 'legislator_posts',
            filters: { ...filters, sort: 'engagement' }
          }
        ],
        formAction,
        clearHref: formAction
      };
    }

    if (segments[0] === 'who') {
      const filters = filterObject({
        q: params.get('q') ?? '',
        state: params.get('state') ?? '',
        party: params.get('party') ?? '',
        chamber: params.get('chamber') ?? ''
      });

      return {
        routeLabel: 'Legislators',
        pageSlug: 'legislators',
        recordLabel: 'legislators',
        includedCount: metaTotal(pageData.legislators) ?? envelopeRows(pageData.legislators).length,
        activeFilters: queryFilters,
        controls: [
          textControl('q', 'Search', params.get('q') ?? '', 'Name or handle'),
          textControl('state', 'State', params.get('state') ?? '', 'TX', 2),
          selectControl('party', 'Party', params.get('party') ?? '', partyOptions()),
          selectControl('chamber', 'Chamber', params.get('chamber') ?? '', chamberOptions())
        ],
        exportOptions: [
          {
            id: 'legislators',
            label: 'Legislator records',
            description: 'Public-record legislator rows matching the search, state, party, and chamber filters.',
            chart: 'legislators',
            filters
          }
        ],
        formAction,
        clearHref: formAction
      };
    }

    if (segments[0] === 'place' && segments[1]) {
      const state = decodeURIComponent(segments[1]).toUpperCase();
      const filters = filterObject({
        state,
        topic: params.get('topic') ?? '',
        party: params.get('party') ?? '',
        from: params.get('from') ?? '',
        to: params.get('to') ?? '',
        normalize: params.get('normalize') ?? '',
        color: params.get('color') ?? ''
      });

      return {
        routeLabel: `${state} state profile`,
        pageSlug: `state-${state.toLowerCase()}`,
        recordLabel: 'state profile records',
        includedCount: null,
        activeFilters: [
          { key: 'state-path', label: 'State', value: state },
          ...queryFilters
        ],
        controls: [
          selectControl('topic', 'Topic', params.get('topic') ?? '', topicOptions),
          selectControl('party', 'Party', params.get('party') ?? '', partyOptions()),
          dateControl('from', 'From', params.get('from') ?? ''),
          dateControl('to', 'To', params.get('to') ?? ''),
          selectControl('normalize', 'Origin scale', params.get('normalize') ?? '', normalizationOptions()),
          selectControl('color', 'Origin color', params.get('color') ?? '', colorOptions())
        ],
        exportOptions: [
          {
            id: 'state_topics',
            label: 'State topic mix',
            description: 'Topic totals for this state under the current topic and party filters.',
            chart: 'state_topics',
            filters
          },
          {
            id: 'state_posts',
            label: 'State posts',
            description: 'Canonical posts from this state under the current filters.',
            chart: 'state_posts',
            filters
          }
        ],
        formAction,
        clearHref: formAction
      };
    }

    if (segments[0] === 'place') {
      const filters = filterObject({
        topic: params.get('topic') ?? '',
        party: params.get('party') ?? '',
        normalize: params.get('normalize') ?? '',
        color: params.get('color') ?? ''
      });

      return {
        routeLabel: 'States',
        pageSlug: 'states',
        recordLabel: 'states',
        includedCount: envelopeRows(pageData.states).length,
        activeFilters: queryFilters,
        controls: [
          selectControl('topic', 'Topic', params.get('topic') ?? '', topicOptions),
          selectControl('party', 'Party', params.get('party') ?? '', partyOptions()),
          selectControl('normalize', 'Origin scale', params.get('normalize') ?? '', normalizationOptions()),
          selectControl('color', 'Origin color', params.get('color') ?? '', colorOptions())
        ],
        exportOptions: [
          {
            id: 'states',
            label: 'State summaries',
            description: 'One row per state with post, engagement, and represented-legislator totals.',
            chart: 'states',
            filters
          },
          {
            id: 'state_topics',
            label: 'State-topic table',
            description: 'Topic totals by state under the current filters.',
            chart: 'state_topics',
            filters
          }
        ],
        formAction,
        clearHref: formAction
      };
    }

    if (segments[0] === 'topic' && segments[1]) {
      const topic = decodeURIComponent(segments[1]);
      const topicLabel = topicLabelFromData(pageData) || labelFromSlug(topic);
      const filters = filterObject({
        topic,
        state: params.get('state') ?? '',
        party: params.get('party') ?? '',
        from: params.get('from') ?? '',
        to: params.get('to') ?? '',
        normalize: params.get('normalize') ?? '',
        color: params.get('color') ?? ''
      });

      return {
        routeLabel: topicLabel,
        pageSlug: `topic-${topic}`,
        recordLabel: 'topic records',
        includedCount: null,
        activeFilters: [
          { key: 'topic-path', label: 'Topic', value: topicLabel },
          ...queryFilters
        ],
        controls: [
          textControl('state', 'State', params.get('state') ?? '', 'TX', 2),
          selectControl('party', 'Party', params.get('party') ?? '', partyOptions()),
          dateControl('from', 'From', params.get('from') ?? ''),
          dateControl('to', 'To', params.get('to') ?? ''),
          selectControl('normalize', 'Origin scale', params.get('normalize') ?? '', normalizationOptions()),
          selectControl('color', 'Origin color', params.get('color') ?? '', colorOptions())
        ],
        exportOptions: [
          {
            id: 'topic_posts',
            label: 'Topic posts',
            description: 'Canonical posts for this topic under the current state, party, and date filters.',
            chart: 'topic_posts',
            filters
          },
          {
            id: 'topic_daily',
            label: 'Daily topic activity',
            description: 'Daily aggregate rows for this topic and date range.',
            chart: 'topic_daily',
            filters
          }
        ],
        formAction,
        clearHref: formAction
      };
    }

    if (segments[0] === 'topic') {
      const filters = filterObject({
        from: params.get('from') ?? '',
        to: params.get('to') ?? ''
      });

      return {
        routeLabel: 'Topics',
        pageSlug: 'topics',
        recordLabel: 'topics',
        includedCount: envelopeRows(pageData.topics).length,
        activeFilters: queryFilters,
        controls: [
          dateControl('from', 'From', params.get('from') ?? ''),
          dateControl('to', 'To', params.get('to') ?? '')
        ],
        exportOptions: [
          {
            id: 'topics',
            label: 'Topic summaries',
            description: 'All topic categories and post totals shown on this page.',
            chart: 'topics',
            filters: {}
          },
          {
            id: 'topic_daily',
            label: 'Daily topic activity',
            description: 'Daily aggregate rows for all topics, optionally bounded by date.',
            chart: 'topic_daily',
            filters
          }
        ],
        formAction,
        clearHref: formAction
      };
    }

    if (segments[0] === 'moment') {
      const filters = filterObject({
        date: params.get('date') ?? '',
        width: params.get('width') ?? '',
        from: params.get('from') ?? '',
        to: params.get('to') ?? '',
        topic: params.get('topic') ?? '',
        state: params.get('state') ?? '',
        party: params.get('party') ?? '',
        bucket: params.get('bucket') ?? ''
      });

      return {
        routeLabel: 'Moments',
        pageSlug: 'moments',
        recordLabel: 'window records',
        includedCount: envelopeRows(pageData.daily).length,
        activeFilters: queryFilters,
        controls: [
          dateControl('from', 'From', params.get('from') ?? ''),
          dateControl('to', 'To', params.get('to') ?? ''),
          selectControl('topic', 'Topic', params.get('topic') ?? '', topicOptions),
          textControl('state', 'State', params.get('state') ?? '', 'TX', 2),
          selectControl('party', 'Party', params.get('party') ?? '', partyOptions()),
          selectControl('bucket', 'Time bucket', params.get('bucket') ?? '', [
            { value: '', label: 'Auto/day' },
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' }
          ])
        ],
        exportOptions: [
          {
            id: 'moment_posts',
            label: 'Window posts',
            description: 'Canonical posts in the selected moment window.',
            chart: 'moment_posts',
            filters
          },
          {
            id: 'moment_topics',
            label: 'Window topic mix',
            description: 'Topic totals for the selected moment window.',
            chart: 'moment_topics',
            filters
          },
          {
            id: 'moment_daily',
            label: 'Daily window activity',
            description: 'Daily, weekly, or monthly activity in the selected moment window.',
            chart: 'moment_daily',
            filters
          }
        ],
        formAction,
        clearHref: formAction
      };
    }

    return {
      routeLabel: 'Current view',
      pageSlug: 'current-view',
      recordLabel: 'records',
      includedCount: null,
      activeFilters: queryFilters,
      controls: [],
      exportOptions: [],
      formAction,
      clearHref: formAction
    };
  }

  function readQueryFilters(params: URLSearchParams): ActiveFilter[] {
    const filters: ActiveFilter[] = [];

    for (const [key, rawValue] of params.entries()) {
      if (IGNORED_PARAMS.has(key) || !rawValue) continue;
      filters.push({
        key,
        label: FILTER_LABELS[key] ?? humanize(key),
        value: formatFilterValue(key, rawValue)
      });
    }

    return dedupeFilters(filters);
  }

  function applyFilterForm(event: SubmitEvent): void {
    if (!browser) return;
    event.preventDefault();

    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const params = new URLSearchParams();

    for (const [key, value] of data.entries()) {
      const text = String(value).trim();
      if (text) params.set(key, text);
    }

    const target = `${form.action}${params.size ? `?${params.toString()}` : ''}`;
    trackEvent('filters_applied', {
      page: rail.pageSlug,
      controls: rail.controls.length,
      activeFilters: params.size
    });
    void goto(target);
  }

  async function copyLink(): Promise<void> {
    if (!browser) return;

    const link = currentShareLink();

    try {
      await navigator.clipboard.writeText(link);
      copied = true;
      showStatus('Filtered link copied.');
      trackEvent('copy_link', {
        page: rail.pageSlug,
        activeFilters: rail.activeFilters.length
      });
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
      trackEvent('copy_link', {
        page: rail.pageSlug,
        activeFilters: rail.activeFilters.length,
        fallback: true
      });
    }
  }

  async function download(format: 'csv' | 'json'): Promise<void> {
    if (!browser || !selectedExport) return;

    downloading = true;

    try {
      const base = DEFAULT_API_BASE.replace(/\/+$/, '');
      trackEvent('download_started', {
        page: rail.pageSlug,
        dataset: selectedExport.id,
        format,
        activeFilters: Object.keys(selectedExport.filters).length
      });
      const response = await fetch(`${base}/exports/${format}`, {
        method: 'POST',
        headers: {
          accept: format === 'json' ? 'application/json' : 'text/csv',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          chart: selectedExport.chart,
          filters: selectedExport.filters,
          limit: DOWNLOAD_CAP
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = exportFilename(format);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      downloadOpen = false;
      showStatus(`${format.toUpperCase()} download prepared.`);
      trackEvent('download_completed', {
        page: rail.pageSlug,
        dataset: selectedExport.id,
        format
      });
    } catch {
      showStatus('Download could not be prepared. Try again in a moment.');
      trackEvent('download_failed', {
        page: rail.pageSlug,
        dataset: selectedExport.id,
        format
      });
    } finally {
      downloading = false;
    }
  }

  function exportFilename(format: 'csv' | 'json'): string {
    const date = new Date().toISOString().slice(0, 10);
    const dataset = selectedExport ? selectedExport.id : 'export';
    return `civicwatch_${slugify(rail.pageSlug)}_${slugify(dataset)}_${date}.${format}`;
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

  function textControl(
    key: string,
    label: string,
    value: string,
    placeholder = '',
    maxLength?: number
  ): FilterControl {
    return { key, label, type: key === 'q' ? 'search' : 'text', value, placeholder, maxLength };
  }

  function dateControl(key: string, label: string, value: string): FilterControl {
    return { key, label, type: 'date', value, min: '2020-01-01', max: '2025-01-04' };
  }

  function selectControl(
    key: string,
    label: string,
    value: string,
    options: { value: string; label: string }[]
  ): FilterControl {
    return { key, label, type: 'select', value, options };
  }

  function partyOptions() {
    return [
      { value: '', label: 'All parties' },
      { value: 'Democratic', label: 'Democratic' },
      { value: 'Republican', label: 'Republican' },
      { value: 'Independent', label: 'Independent' },
      { value: '__unknown', label: 'Unknown' }
    ];
  }

  function chamberOptions() {
    return [
      { value: '', label: 'All chambers' },
      { value: 'HOUSE', label: 'House' },
      { value: 'SENATE', label: 'Senate' },
      { value: '__unknown', label: 'Unknown' }
    ];
  }

  function normalizationOptions() {
    return [
      { value: '', label: 'None' },
      { value: 'population', label: 'State population' },
      { value: 'legislators', label: 'Represented legislators' }
    ];
  }

  function colorOptions() {
    return [
      { value: '', label: 'Post volume' },
      { value: 'contribution', label: 'Party contribution' }
    ];
  }

  function topicSelectOptions(data: Record<string, unknown>) {
    const rows = envelopeRows(data.topics);
    const options = rows.map((row) => ({
      value: cleanString(row.topic),
      label: cleanString(row.topicLabel ?? row.topic_label) || `Topic ${cleanString(row.topic)}`
    }));

    return [{ value: '', label: 'All topics' }, ...options.filter((option) => option.value)];
  }

  function topicLabelFromData(data: Record<string, unknown>): string {
    const topic = envelopeData(data.topic);
    return cleanString(topic?.topicLabel ?? topic?.topic_label);
  }

  function envelopeData(value: unknown): Record<string, unknown> | null {
    if (!isRecord(value)) return null;
    if (isRecord(value.data)) return value.data;
    return value;
  }

  function envelopeRows(value: unknown): Record<string, unknown>[] {
    if (Array.isArray(value)) return value.filter(isRecord);
    if (!isRecord(value)) return [];
    if (Array.isArray(value.data)) return value.data.filter(isRecord);
    if (Array.isArray(value.rows)) return value.rows.filter(isRecord);
    return [];
  }

  function metaTotal(value: unknown): number | null {
    if (!isRecord(value) || !isRecord(value.meta)) return null;
    const total = Number(value.meta.total);
    return Number.isFinite(total) ? total : null;
  }

  function filterObject(input: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(input).filter(([, value]) => cleanString(value))
    );
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  function formatFilterValue(key: string, value: string): string {
    if (value === '__unknown') return 'Unknown';
    if (key === 'topic' && value === '999') return 'Uncategorized';
    if (key === 'width') return `${value} days`;
    if (key === 'normalize') {
      return value === 'population'
        ? 'State population'
        : value === 'legislators'
          ? 'Represented legislators'
          : value;
    }
    if (key === 'color' && value === 'contribution') return 'Party contribution';
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
    <strong>{rail.activeFilters.length}</strong>
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
          <h2>{rail.routeLabel}</h2>
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

      {#if rail.activeFilters.length}
        <div class="filter-list" aria-label="Current filters">
          {#each rail.activeFilters as filter (`${filter.key}:${filter.value}`)}
            <span class="filter-chip">
              <span>{filter.label}</span>
              <strong>{filter.value}</strong>
            </span>
          {/each}
        </div>
      {:else}
        <p class="quiet">No active filters are applied to this view.</p>
      {/if}

      {#if rail.controls.length}
        <form class="filter-form" method="get" action={rail.formAction} onsubmit={applyFilterForm}>
          <div class="control-grid">
            {#each rail.controls as control (control.key)}
              <label>
                <span>{control.label}</span>
                {#if control.type === 'select'}
                  <select class="field" name={control.key} value={control.value}>
                    {#each control.options ?? [] as option}
                      <option value={option.value} selected={option.value === control.value}>{option.label}</option>
                    {/each}
                  </select>
                {:else}
                  <input
                    class="field"
                    type={control.type}
                    name={control.key}
                    value={control.value}
                    placeholder={control.placeholder ?? ''}
                    maxlength={control.maxLength}
                    min={control.min}
                    max={control.max}
                  />
                {/if}
              </label>
            {/each}
          </div>

          <div class="form-actions">
            <button type="submit" class="action-button">Apply</button>
            <a class="action-button secondary" href={rail.clearHref}>Clear</a>
          </div>
        </form>
      {/if}

      <div class="record-summary">
        <div>
          <span class="summary-number">{rail.includedCount === null ? '—' : rail.includedCount.toLocaleString()}</span>
          <span>{rail.recordLabel} included</span>
        </div>

        <p>
          Choose the dataset that matches what you want from this page, then download CSV or JSON.
        </p>
      </div>

      {#if rail.exportOptions.length}
        <fieldset class="download-options">
          <legend>Download data</legend>
          {#each rail.exportOptions as option (option.id)}
            <label class:active={selectedExport?.id === option.id}>
              <input
                type="radio"
                name="download-option"
                value={option.id}
                bind:group={selectedExportId}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          {/each}
        </fieldset>
      {/if}

      <div class="actions">
        <button type="button" class="action-button" onclick={copyLink}>
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
            disabled={!selectedExport || downloading}
            onclick={() => (downloadOpen = !downloadOpen)}
          >
            <Download size={16} strokeWidth={1.9} aria-hidden="true" />
            {downloading ? 'Preparing' : 'Download'}
          </button>

          {#if downloadOpen && selectedExport}
            <div class="download-menu" role="menu" aria-label="Download format">
              <button type="button" role="menuitem" onclick={() => download('csv')} disabled={downloading}>
                <FileSpreadsheet size={15} strokeWidth={1.8} aria-hidden="true" />
                CSV
              </button>
              <button type="button" role="menuitem" onclick={() => download('json')} disabled={downloading}>
                <FileJson size={15} strokeWidth={1.8} aria-hidden="true" />
                JSON
              </button>
            </div>
          {/if}
        </div>
      </div>

      <p class="cap-note">
        Downloads are capped at {DOWNLOAD_CAP.toLocaleString()} records.
        For larger extracts, <a href={appPath('/about')}>contact us through the About page</a>.
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
    width: min(460px, calc(100vw - 24px));
    max-height: min(78vh, 720px);
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

  .filter-form {
    display: grid;
    gap: 10px;
    margin-bottom: 11px;
    padding: 10px;
    border: 1px solid var(--color-rule);
    border-radius: 7px;
    background: color-mix(in srgb, var(--color-elevated), transparent 18%);
  }

  .control-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .control-grid label {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .control-grid label span,
  .download-options legend {
    color: var(--color-mute);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.055em;
    line-height: 1rem;
    text-transform: uppercase;
  }

  .control-grid .field {
    width: 100%;
    min-width: 0;
    min-height: 36px;
    margin: 0;
    padding: 7px 9px;
  }

  .form-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .quiet,
  .cap-note,
  .record-summary p,
  .status,
  .download-options small {
    color: var(--color-mute);
    font-size: 0.84rem;
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
  }

  .download-options {
    display: grid;
    gap: 7px;
    margin: 0 0 11px;
    padding: 0;
    border: 0;
  }

  .download-options label {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 8px;
    align-items: start;
    padding: 8px;
    border: 1px solid var(--color-rule);
    border-radius: 7px;
    background: var(--color-elevated);
    cursor: pointer;
  }

  .download-options label.active {
    border-color: color-mix(in srgb, var(--color-seal) 55%, var(--color-rule));
    background: color-mix(in srgb, var(--color-seal) 10%, var(--color-elevated));
  }

  .download-options input {
    margin-top: 3px;
  }

  .download-options span {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .download-options strong {
    font-size: 0.88rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .action-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 0.86rem;
    box-shadow: none;
    text-decoration: none;
  }

  .action-button.secondary {
    color: var(--color-mute);
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
      max-height: 74vh;
    }

    .control-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
