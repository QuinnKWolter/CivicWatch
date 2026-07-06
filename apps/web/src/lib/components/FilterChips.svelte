<script lang="ts">
  interface FilterItem {
    label: string;
    value: string;
    href?: string;
  }

  interface NormalizedFilter {
    label: string;
    value: string;
    href?: string;
  }

  interface Props {
    filters?: FilterItem[];
    clearHref?: string | null;
    ariaLabel?: string;
  }

  let {
    filters = [],
    clearHref = null,
    ariaLabel = 'Active filters'
  }: Props = $props();

  const normalizedFilters = $derived.by(() =>
    filters
      .map(normalizeFilter)
      .filter(
        (
          filter
        ): filter is NormalizedFilter =>
          filter !== null
      )
  );

  const safeClearHref = $derived(
    typeof clearHref === 'string'
      ? normalizeHref(clearHref)
      : undefined
  );

  function normalizeFilter(
    filter: FilterItem
  ): NormalizedFilter | null {
    if (!filter || typeof filter !== 'object') {
      return null;
    }

    const label =
      typeof filter.label === 'string'
        ? filter.label.trim()
        : '';

    const value =
      typeof filter.value === 'string'
        ? filter.value.trim()
        : '';

    if (!label || !value) {
      return null;
    }

    return {
      label,
      value,
      href:
        typeof filter.href === 'string'
          ? normalizeHref(filter.href)
          : undefined
    };
  }

  function normalizeHref(
    href: string
  ): string | undefined {
    const value = href.trim();

    if (!value) return undefined;

    const compact = value.replace(
      /[\u0000-\u0020\u007f]+/g,
      ''
    );

    if (
      /^(?:javascript|data|vbscript):/i.test(
        compact
      )
    ) {
      return undefined;
    }

    return value;
  }
</script>

{#if normalizedFilters.length}
  <div
    class="filter-summary"
    role="group"
    aria-label={ariaLabel}
  >
    <p class="visually-hidden" aria-live="polite">
      {normalizedFilters.length}
      active
      {normalizedFilters.length === 1
        ? 'filter'
        : 'filters'}
    </p>

    <ul class="filter-list">
      {#each normalizedFilters as filter, index (`${filter.label}-${filter.value}-${filter.href ?? ''}-${index}`)}
        <li>
          {#if filter.href}
            <a
              class="filter-chip removable"
              href={filter.href}
              aria-label={`Remove ${filter.label} filter: ${filter.value}`}
              title={`Remove ${filter.label}: ${filter.value}`}
            >
              <span class="filter-label">
                {filter.label}
              </span>

              <strong class="filter-value">
                {filter.value}
              </strong>

              <span
                class="remove-mark"
                aria-hidden="true"
              >
                ×
              </span>
            </a>
          {:else}
            <span
              class="filter-chip static"
              title={`${filter.label}: ${filter.value}`}
            >
              <span class="filter-label">
                {filter.label}
              </span>

              <strong class="filter-value">
                {filter.value}
              </strong>
            </span>
          {/if}
        </li>
      {/each}
    </ul>

    {#if safeClearHref}
      <a
        class="clear-all"
        href={safeClearHref}
        aria-label={`Clear all ${normalizedFilters.length} active filters`}
      >
        Clear all
      </a>
    {/if}
  </div>
{/if}

<style>
  .filter-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    align-items: center;
    min-width: 0;
    margin-block: 12px;
  }

  .filter-list {
    display: flex;
    flex: 1 1 auto;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    min-width: 0;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .filter-list li {
    min-width: 0;
    max-width: 100%;
  }

  .filter-chip {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    max-width: min(100%, 32rem);
    min-height: 36px;
    padding: 6px 10px;
    color: var(--color-ink, #1a1917);
    font-size: 0.8125rem;
    line-height: 1.1rem;
    background: var(
      --color-elevated,
      var(--color-card, #fff)
    );
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 999px;
  }

  a.filter-chip {
    text-decoration: none;
    cursor: pointer;
    transition:
      color 120ms ease,
      background-color 120ms ease,
      border-color 120ms ease;
  }

  .filter-label {
    overflow: hidden;
    color: var(--color-mute, #6b6659);
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 0 1 auto;
  }

  .filter-value {
    min-width: 0;
    overflow: hidden;
    color: var(--color-ink, #1a1917);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 0 1 auto;
  }

  .remove-mark {
    display: grid;
    width: 18px;
    height: 18px;
    margin-right: -3px;
    place-items: center;
    color: var(--color-mute, #6b6659);
    font-size: 1rem;
    font-weight: 400;
    line-height: 1;
    border-radius: 50%;
    flex: 0 0 auto;
    transition:
      color 120ms ease,
      background-color 120ms ease;
  }

  .removable:hover {
    color: var(--color-seal, #8a5a1a);
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 6%,
      var(--color-card, #fff)
    );
    border-color: var(--color-seal, #8a5a1a);
  }

  .removable:hover .filter-value,
  .removable:hover .remove-mark {
    color: var(--color-seal, #8a5a1a);
  }

  .removable:hover .remove-mark {
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 12%,
      transparent
    );
  }

  .removable:focus-visible,
  .clear-all:focus-visible {
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .static {
    cursor: default;
  }

  .clear-all {
    display: inline-flex;
    align-items: center;
    min-height: 36px;
    padding: 6px 4px;
    color: var(--color-mute, #6b6659);
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1.1rem;
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

  .clear-all:hover {
    color: var(--color-error, #8a2a20);
    text-decoration-color: currentColor;
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

  @media (max-width: 640px) {
    .filter-summary {
      align-items: stretch;
    }

    .filter-list {
      flex-basis: 100%;
      gap: 7px;
    }

    .filter-chip {
      max-width: 100%;
      min-height: 40px;
      padding-inline: 11px;
    }

    .filter-label {
      max-width: 9rem;
    }

    .filter-value {
      max-width: min(15rem, 46vw);
    }

    .clear-all {
      min-height: 40px;
      margin-left: 2px;
    }
  }

  @media (max-width: 400px) {
    .filter-list li {
      width: 100%;
    }

    .filter-chip {
      width: 100%;
      border-radius: 6px;
    }

    .filter-label {
      max-width: 40%;
    }

    .filter-value {
      max-width: none;
      flex: 1 1 auto;
    }
  }

  @media (forced-colors: active) {
    .filter-chip,
    .clear-all {
      color: CanvasText;
      background: Canvas;
      border-color: CanvasText;
    }

    .filter-label,
    .filter-value,
    .remove-mark {
      color: CanvasText;
    }

    .removable:hover,
    .removable:focus-visible,
    .clear-all:focus-visible {
      outline-color: Highlight;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    a.filter-chip,
    .remove-mark,
    .clear-all {
      transition: none;
    }
  }

  @media print {
    .filter-summary {
      break-inside: avoid;
    }

    .remove-mark,
    .clear-all {
      display: none;
    }

    .filter-chip {
      color: #000;
      background: transparent;
      border-color: #999;
    }
  }
</style>