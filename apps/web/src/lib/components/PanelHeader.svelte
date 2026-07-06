<script lang="ts">
  interface CountInfo {
    display: string;
    machineValue: string | null;
    label: string;
  }

  export let title = '';
  export let caption = '';
  export let source = '';
  export let count: string | number | null = null;

  /**
   * Optional, backward-compatible enhancements.
   */
  export let eyebrow = '';
  export let sourceHref: string | null = null;
  export let countLabel = 'records';
  export let countSingular = 'record';
  export let headingId: string | undefined = undefined;
  export let toolsLabel = 'Panel tools';
  export let provenanceLabel = 'Panel provenance';
  export let compact = false;

  let normalizedTitle = '';
  let normalizedCaption = '';
  let normalizedEyebrow = '';
  let normalizedSource = '';
  let safeSourceHref: string | null = null;
  let countInfo: CountInfo | null = null;
  let hasProvenance = false;

  $: normalizedTitle = cleanText(title) ?? '';
  $: normalizedCaption = cleanText(caption) ?? '';
  $: normalizedEyebrow = cleanText(eyebrow) ?? '';
  $: normalizedSource = cleanText(source) ?? '';
  $: safeSourceHref = normalizeHref(sourceHref);
  $: countInfo = normalizeCount(count);
  $: hasProvenance =
    countInfo !== null || normalizedSource.length > 0;

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

    return href;
  }

  function normalizeCount(
    value: string | number | null
  ): CountInfo | null {
    const plural =
      cleanText(countLabel) ?? 'records';

    const singular =
      cleanText(countSingular) ?? 'record';

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return null;
      }

      const safeValue = Math.max(0, value);

      return {
        display: safeValue.toLocaleString('en-US', {
          maximumFractionDigits:
            Number.isInteger(safeValue) ? 0 : 2
        }),
        machineValue: String(safeValue),
        label: safeValue === 1 ? singular : plural
      };
    }

    const display = cleanText(value);

    if (!display) return null;

    return {
      display,
      machineValue: null,
      label: plural
    };
  }
</script>

<header
  class:compact
  class="panel-header"
>
  <div class="heading-copy">
    {#if normalizedEyebrow}
      <p class="eyebrow">
        {normalizedEyebrow}
      </p>
    {/if}

    {#if normalizedTitle}
      <h2 id={headingId}>
        {normalizedTitle}
      </h2>
    {/if}

    {#if normalizedCaption}
      <p class="caption">
        {normalizedCaption}
      </p>
    {/if}

    {#if hasProvenance}
      <ul
        class="provenance"
        aria-label={provenanceLabel}
      >
        {#if countInfo}
          <li>
            {#if countInfo.machineValue !== null}
              <data
                value={countInfo.machineValue}
              >
                {countInfo.display}
              </data>
            {:else}
              <span>{countInfo.display}</span>
            {/if}

            <span>{countInfo.label}</span>
          </li>
        {/if}

        {#if normalizedSource}
          <li class="source">
            <span class="provenance-key">
              Source:
            </span>

            {#if safeSourceHref}
              <a
                href={safeSourceHref}
                aria-label={`Source: ${normalizedSource}`}
              >
                {normalizedSource}
              </a>
            {:else}
              <span>{normalizedSource}</span>
            {/if}
          </li>
        {/if}
      </ul>
    {/if}
  </div>

  {#if $$slots.tools}
    <div
      class="tools"
      role="group"
      aria-label={toolsLabel}
    >
      <slot name="tools" />
    </div>
  {/if}
</header>

<style>
  .panel-header {
    display: flex;
    gap: 16px 24px;
    align-items: flex-start;
    justify-content: space-between;
    min-width: 0;
    margin-block-end: 14px;
  }

  .panel-header.compact {
    gap: 12px 18px;
    margin-block-end: 10px;
  }

  .heading-copy {
    min-width: 0;
    max-width: 78ch;
    flex: 1 1 auto;
  }

  .eyebrow {
    margin: 0 0 3px;
    color: var(--color-seal, #8a5a1a);
    font-size: 0.7rem;
    font-weight: 600;
    line-height: 1rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    color: var(--color-ink, #1a1917);
    font-size: clamp(
      1.15rem,
      1.06rem + 0.28vw,
      1.4rem
    );
    font-weight: 650;
    line-height: 1.25;
    letter-spacing: -0.01em;
    overflow-wrap: anywhere;
  }

  .compact h2 {
    font-size: 1.05rem;
  }

  .caption {
    max-width: 72ch;
    margin: 4px 0 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.875rem;
    line-height: 1.4rem;
    overflow-wrap: anywhere;
  }

  .compact .caption {
    font-size: 0.8125rem;
    line-height: 1.3rem;
  }

  .provenance {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 0;
    align-items: center;
    padding: 0;
    margin: 7px 0 0;
    color: var(
      --color-mute-soft,
      #9c9787
    );
    font-family: var(
      --font-data,
      var(
        --type-mono,
        'JetBrains Mono',
        ui-monospace,
        monospace
      )
    );
    font-size: 0.72rem;
    line-height: 1.1rem;
    list-style: none;
    font-variant-numeric: tabular-nums;
  }

  .provenance li {
    display: inline-flex;
    gap: 4px;
    align-items: baseline;
    min-width: 0;
  }

  .provenance li + li::before {
    margin-inline: 9px;
    color: var(
      --color-rule-strong,
      var(--color-rule, #d9d2c1)
    );
    content: '·';
  }

  .provenance data {
    color: var(--color-mute, #6b6659);
    font-weight: 600;
  }

  .provenance-key {
    white-space: nowrap;
  }

  .source {
    min-width: 0;
  }

  .source > span:last-child,
  .source a {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .source a {
    color: var(--color-mute, #6b6659);
    text-decoration-line: underline;
    text-decoration-color: color-mix(
      in srgb,
      currentColor 45%,
      transparent
    );
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
    border-radius: 2px;
    transition:
      color 120ms ease,
      text-decoration-color 120ms ease;
  }

  .source a:hover {
    color: var(--color-seal, #8a5a1a);
    text-decoration-color: currentColor;
  }

  .source a:focus-visible {
    color: var(--color-seal, #8a5a1a);
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .tools {
    display: flex;
    flex: 0 1 auto;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
    min-width: 0;
    max-width: min(50%, 34rem);
  }

  @media (max-width: 720px) {
    .panel-header {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
    }

    .heading-copy {
      max-width: none;
    }

    .tools {
      width: 100%;
      max-width: none;
      justify-content: flex-start;
    }
  }

  @media (max-width: 440px) {
    .panel-header {
      margin-block-end: 12px;
    }

    .provenance {
      display: grid;
      gap: 3px;
    }

    .provenance li + li::before {
      display: none;
    }

    .tools {
      gap: 7px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .source a {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    h2,
    .caption,
    .eyebrow,
    .provenance,
    .provenance data,
    .source a {
      color: CanvasText;
    }

    .source a:focus-visible {
      outline-color: Highlight;
    }
  }

  @media print {
    .panel-header {
      break-inside: avoid;
    }

    .tools {
      display: none;
    }

    .source a {
      color: #000;
      text-decoration: none;
    }
  }
</style>