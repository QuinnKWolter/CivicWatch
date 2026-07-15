<script lang="ts">
  import { withBase } from '$lib/paths';

  interface BreadcrumbItem {
    label: string;
    href?: string;
  }

  interface Props {
    items?: BreadcrumbItem[];
    ariaLabel?: string;
  }

  let {
    items = [],
    ariaLabel = 'Breadcrumb'
  }: Props = $props();

  const normalizedItems = $derived(
    items
      .map((item) => ({
        label:
          typeof item?.label === 'string'
            ? item.label.trim()
            : '',
        href:
          typeof item?.href === 'string'
            ? normalizeHref(item.href)
            : undefined
      }))
      .filter((item) => item.label.length > 0)
  );

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

    return withBase(value) ?? undefined;
  }
</script>

{#if normalizedItems.length}
  <nav
    class="breadcrumbs"
    aria-label={ariaLabel}
  >
    <ol>
      {#each normalizedItems as item, index (`${item.label}-${item.href ?? ''}-${index}`)}
        <li>
          {#if index > 0}
            <span
              class="separator"
              aria-hidden="true"
            >
              ›
            </span>
          {/if}

          {#if item.href && index < normalizedItems.length - 1}
            <a
              href={item.href}
              title={item.label}
            >
              {item.label}
            </a>
          {:else}
            <span
              class="current"
              aria-current={index === normalizedItems.length - 1
                ? 'page'
                : undefined}
              title={item.label}
            >
              {item.label}
            </span>
          {/if}
        </li>
      {/each}
    </ol>
  </nav>
{/if}

<style>
  .breadcrumbs {
    min-width: 0;
    margin-block: 0 12px;
    color: var(--color-mute, #6b6659);
    font-size: 0.8125rem;
    line-height: 1.125rem;
  }

  ol {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 6px;
    align-items: center;
    min-width: 0;
    padding: 0;
    margin: 0;
    list-style: none;
  }

  li {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    min-width: 0;
    max-width: 100%;
  }

  .separator {
    color: var(--color-mute-soft, #9c9787);
    font-family: var(
      --font-data,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    line-height: 1;
    user-select: none;
    flex: 0 0 auto;
  }

  a,
  .current {
    display: inline-block;
    min-width: 0;
    max-width: min(28rem, 48vw);
    padding-block: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  a {
    color: var(--color-mute, #6b6659);
    text-decoration-line: underline;
    text-decoration-color: transparent;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
    border-radius: 3px;
    transition:
      color 120ms ease,
      text-decoration-color 120ms ease;
  }

  a:hover {
    color: var(--color-ink, #1a1917);
    text-decoration-color: currentColor;
  }

  a:focus-visible {
    color: var(--color-ink, #1a1917);
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 2px;
    text-decoration-color: transparent;
  }

  .current {
    color: var(--color-ink, #1a1917);
    font-weight: 500;
  }

  @media (max-width: 640px) {
    .breadcrumbs {
      margin-bottom: 10px;
      font-size: 0.78rem;
    }

    ol {
      gap: 2px 4px;
    }

    li {
      gap: 4px;
    }

    a,
    .current {
      max-width: min(17rem, 62vw);
      padding-block: 4px;
    }
  }

  @media (max-width: 380px) {
    a,
    .current {
      max-width: 54vw;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    a {
      transition: none;
    }
  }
</style>
