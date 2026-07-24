<script lang="ts">
  import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-svelte';

  export type DataColumn = {
    key: string;
    label: string;
    numeric?: boolean;
    format?: (value: any, row: any) => string;
    href?: (row: any) => string | null;
  };

  interface Props {
    rows?: any[];
    columns: DataColumn[];
    caption?: string;
    initialSort?: string;
    initialDirection?: 'asc' | 'desc';
    pageSize?: number;
  }

  let { rows = [], columns, caption = 'Data table', initialSort = '', initialDirection = 'asc', pageSize = 25 }: Props = $props();
  let query = $state('');
  let sortKey = $state(initialSort || columns[0]?.key || '');
  let direction = $state<'asc' | 'desc'>(initialDirection);
  let page = $state(0);
  const collator = new Intl.Collator('en-US', { sensitivity: 'base', numeric: true });
  const safePageSize = $derived(Math.max(10, Math.min(100, Math.trunc(pageSize || 25))));

  const filtered = $derived.by(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => columns.some((column) => display(column, row).toLocaleLowerCase().includes(needle)));
  });
  const sorted = $derived.by(() => [...filtered].sort((a, b) => {
    const column = columns.find((item) => item.key === sortKey);
    if (!column) return 0;
    const left = a?.[column.key];
    const right = b?.[column.key];
    const comparison = column.numeric
      ? number(left) - number(right)
      : collator.compare(String(left ?? ''), String(right ?? ''));
    return direction === 'asc' ? comparison : -comparison;
  }));
  const pageCount = $derived(Math.max(1, Math.ceil(sorted.length / safePageSize)));
  const visible = $derived(sorted.slice(page * safePageSize, (page + 1) * safePageSize));
  const first = $derived(sorted.length ? page * safePageSize + 1 : 0);
  const last = $derived(Math.min(sorted.length, (page + 1) * safePageSize));

  $effect(() => { query; sortKey; direction; page = 0; });
  $effect(() => { if (page >= pageCount) page = pageCount - 1; });

  function display(column: DataColumn, row: any): string {
    const value = row?.[column.key];
    return column.format ? column.format(value, row) : String(value ?? '—');
  }
  function number(value: any): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
  function sort(column: DataColumn) {
    if (sortKey === column.key) direction = direction === 'asc' ? 'desc' : 'asc';
    else { sortKey = column.key; direction = column.numeric ? 'desc' : 'asc'; }
  }
</script>

<div class="data-table">
  <div class="table-tools">
    <label>
      <Search size={15} aria-hidden="true" />
      <span class="visually-hidden">Filter {caption}</span>
      <input type="search" bind:value={query} placeholder="Filter table…" />
      {#if query}<button type="button" aria-label="Clear table filter" onclick={() => (query = '')}><X size={14} /></button>{/if}
    </label>
    <span aria-live="polite">{first.toLocaleString()}–{last.toLocaleString()} of {sorted.length.toLocaleString()}</span>
  </div>
  <div class="table-scroll">
    <table>
      <caption class="visually-hidden">{caption}</caption>
      <thead><tr>{#each columns as column}<th scope="col" aria-sort={sortKey === column.key ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'} class:numeric={column.numeric}><button type="button" onclick={() => sort(column)}>{column.label}{#if sortKey === column.key}{#if direction === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}{:else}<ArrowUpDown size={14} />{/if}</button></th>{/each}</tr></thead>
      <tbody>{#each visible as row}<tr>{#each columns as column}<td class:numeric={column.numeric}>{#if column.href?.(row)}<a href={column.href(row) ?? undefined}>{display(column, row)}</a>{:else}{display(column, row)}{/if}</td>{/each}</tr>{:else}<tr><td colspan={columns.length} class="empty">No rows match this filter.</td></tr>{/each}</tbody>
    </table>
  </div>
  {#if pageCount > 1}<nav class="pagination" aria-label={`${caption} pages`}><button type="button" disabled={page === 0} onclick={() => page--}>Previous</button><span>Page {(page + 1).toLocaleString()} of {pageCount.toLocaleString()}</span><button type="button" disabled={page + 1 >= pageCount} onclick={() => page++}>Next</button></nav>{/if}
</div>

<style>
  .data-table { display: grid; gap: 9px; min-width: 0; }
  .table-tools { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; justify-content: space-between; color: var(--color-mute); font-size: .72rem; }
  label { position: relative; display: flex; align-items: center; min-width: min(100%, 220px); }
  label > :global(svg) { position: absolute; left: 9px; pointer-events: none; }
  input { width: 100%; min-height: 34px; padding: 6px 32px; margin: 0; border: 1px solid var(--color-rule); border-radius: 5px; background: var(--color-card); color: var(--color-ink); }
  label button { position: absolute; right: 4px; display: grid; width: 27px; height: 27px; padding: 0; place-items: center; border: 0; background: transparent; }
  .table-scroll { min-width: 0; overflow-x: auto; }
  table { min-width: 100%; }
  th button { display: inline-flex; gap: 5px; align-items: center; padding: 0; color: inherit; font: inherit; font-weight: inherit; background: transparent; border: 0; box-shadow: none; }
  th button:hover { color: var(--color-seal); background: transparent; transform: none; box-shadow: none; }
  .numeric { text-align: right; font-variant-numeric: tabular-nums; }
  .numeric button { margin-left: auto; }
  .empty { padding: 28px 12px; text-align: center; color: var(--color-mute); }
  .pagination { display: flex; gap: 10px; align-items: center; justify-content: flex-end; font-size: .72rem; }
  .pagination button { min-height: 32px; padding: 5px 10px; }
  button:focus-visible, input:focus-visible { outline: 2px solid var(--color-seal); outline-offset: 2px; }
</style>
