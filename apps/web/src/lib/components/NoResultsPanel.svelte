<script lang="ts">
  import { SearchX } from 'lucide-svelte';
  import { withBase } from '$lib/paths';

  interface Props {
    title?: string;
    message?: string;
    href?: string | null;
    action?: string;
    onAction?: (() => void | Promise<void>) | null;
    busy?: boolean;
    compact?: boolean;
    ariaLabel?: string;
  }

  let {
    title = 'No matches',
    message = 'Try widening the filters or searching for a name, handle, state code, or topic.',
    href = null,
    action = 'Clear filters',
    onAction = null,
    busy = false,
    compact = false,
    ariaLabel = 'No results'
  }: Props = $props();

  const safeTitle = $derived(
    cleanText(title) ?? 'No matches'
  );

  const safeMessage = $derived(
    cleanText(message) ??
      'Try widening the filters or changing the search.'
  );

  const safeAction = $derived(
    cleanText(action) ?? 'Clear filters'
  );

  const safeHref = $derived(
    normalizeHref(href)
  );

  const hasAction = $derived(
    Boolean(safeHref || onAction)
  );

  function cleanText(
    value: unknown
  ): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const text = value.trim();

    return text || null;
  }

  function normalizeHref(
    value: string | null
  ): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const href = value.trim();

    if (!href) return null;

    const compactHref = href.replace(
      /[\u0000-\u0020\u007f]+/g,
      ''
    );

    if (
      /^(?:javascript|data|vbscript):/i.test(
        compactHref
      )
    ) {
      return null;
    }

    return withBase(href);
  }

  async function handleAction(): Promise<void> {
    if (!onAction || busy) return;

    await onAction();
  }
</script>

<section
  class:compact
  class="empty-panel"
  role="status"
  aria-label={ariaLabel}
  aria-live="polite"
  aria-busy={busy}
>
  <span
    class="empty-icon"
    aria-hidden="true"
  >
    <SearchX
      size={compact ? 20 : 24}
      strokeWidth={1.6}
    />
  </span>

  <div class="empty-content">
    <h2>{safeTitle}</h2>

    <p>{safeMessage}</p>

    {#if hasAction}
      <div class="actions">
        {#if safeHref}
          <a
            class="action-button"
            href={safeHref}
            aria-disabled={busy}
            tabindex={busy ? -1 : undefined}
          >
            {safeAction}
          </a>
        {:else if onAction}
          <button
            class="action-button"
            type="button"
            disabled={busy}
            aria-busy={busy}
            onclick={() => void handleAction()}
          >
            {busy ? 'Working…' : safeAction}
          </button>
        {/if}
      </div>
    {/if}
  </div>
</section>

<style>
  .empty-panel {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 14px;
    align-items: start;
    min-width: 0;
    padding: 18px;
    color: var(--color-ink, #1a1917);
    background: var(--color-card, #fff);
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
  }

  .empty-panel.compact {
    gap: 11px;
    padding: 14px;
  }

  .empty-icon {
    display: grid;
    width: 40px;
    height: 40px;
    place-items: center;
    color: var(--color-mute, #6b6659);
    background: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 28%,
      var(--color-card, #fff)
    );
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 50%;
    flex: 0 0 auto;
  }

  .compact .empty-icon {
    width: 34px;
    height: 34px;
  }

  .empty-content {
    min-width: 0;
  }

  h2 {
    margin: 0;
    color: var(--color-ink, #1a1917);
    font-size: 1.0625rem;
    font-weight: 600;
    line-height: 1.4rem;
    letter-spacing: -0.005em;
  }

  .compact h2 {
    font-size: 0.975rem;
    line-height: 1.3rem;
  }

  p {
    max-width: 66ch;
    margin: 5px 0 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.875rem;
    line-height: 1.4rem;
    overflow-wrap: anywhere;
  }

  .compact p {
    font-size: 0.8125rem;
    line-height: 1.3rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 13px;
  }

  .action-button {
    display: inline-flex;
    gap: 7px;
    align-items: center;
    justify-content: center;
    min-height: 38px;
    padding: 7px 12px;
    color: var(--color-ink, #1a1917);
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.1rem;
    text-align: center;
    text-decoration: none;
    background: var(--color-card, #fff);
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
    cursor: pointer;
    transition:
      color 120ms ease,
      background-color 120ms ease,
      border-color 120ms ease;
  }

  .action-button:hover:not(:disabled) {
    color: var(--color-seal, #8a5a1a);
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 6%,
      var(--color-card, #fff)
    );
    border-color: var(--color-seal, #8a5a1a);
  }

  .action-button:focus-visible {
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .action-button:disabled,
  .action-button[aria-disabled='true'] {
    cursor: progress;
    opacity: 0.58;
    pointer-events: none;
  }

  @media (max-width: 520px) {
    .empty-panel {
      grid-template-columns: 1fr;
      gap: 11px;
      padding: 16px;
    }

    .empty-icon {
      width: 36px;
      height: 36px;
    }

    .actions,
    .action-button {
      width: 100%;
    }

    .action-button {
      min-height: 42px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .action-button {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .empty-panel,
    .empty-icon,
    .action-button {
      color: CanvasText;
      background: Canvas;
      border-color: CanvasText;
    }

    .action-button:focus-visible {
      outline-color: Highlight;
    }
  }

  @media print {
    .empty-panel {
      color: #000;
      background: transparent;
      border-color: #999;
      break-inside: avoid;
    }

    .empty-icon {
      color: #000;
      background: transparent;
      border-color: #999;
    }

    .actions {
      display: none;
    }
  }
</style>
