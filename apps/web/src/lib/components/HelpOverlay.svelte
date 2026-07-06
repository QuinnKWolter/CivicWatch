<script lang="ts">
  import { browser } from '$app/environment';
  import { tick } from 'svelte';
  import {
    Database,
    HelpCircle,
    MousePointer2,
    X
  } from 'lucide-svelte';

  type HelpTab = 'overview' | 'usage' | 'data';

  interface Props {
    open?: boolean;
    initialTab?: HelpTab;
    onClose?: () => void;
    methodsHref?: string | null;
    aboutHref?: string | null;
    feedbackHref?: string | null;
  }

  const tabs: {
    id: HelpTab;
    label: string;
  }[] = [
    {
      id: 'overview',
      label: 'What it is'
    },
    {
      id: 'usage',
      label: 'How to use it'
    },
    {
      id: 'data',
      label: 'Where data comes from'
    }
  ];

  let {
    open = $bindable(false),
    initialTab = 'overview',
    onClose,
    methodsHref = null,
    aboutHref = null,
    feedbackHref = null
  }: Props = $props();

  const componentId = $props.id();
  const dialogId = `${componentId}-dialog`;
  const titleId = `${componentId}-title`;
  const descriptionId = `${componentId}-description`;

  let dialog: HTMLDivElement;
  let activeTab = $state<HelpTab>(initialTab);
  let returnFocus: HTMLElement | null = null;
  let previousBodyOverflow = '';

  const safeMethodsHref = $derived(
    normalizeHref(methodsHref)
  );

  const safeAboutHref = $derived(
    normalizeHref(aboutHref)
  );

  const safeFeedbackHref = $derived(
    normalizeHref(feedbackHref)
  );

  const hasFooterLinks = $derived(
    Boolean(
      safeMethodsHref ||
        safeAboutHref ||
        safeFeedbackHref
    )
  );

  $effect(() => {
    if (!browser || !open) return;

    returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    previousBodyOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    let cancelled = false;

    void tick().then(() => {
      if (!cancelled && open) {
        dialog?.focus({
          preventScroll: true
        });
      }
    });

    return () => {
      cancelled = true;

      document.body.style.overflow =
        previousBodyOverflow;

      const target = returnFocus;
      returnFocus = null;

      if (
        target &&
        document.contains(target)
      ) {
        target.focus({
          preventScroll: true
        });
      }
    };
  });

  function normalizeHref(
    href: string | null
  ): string | null {
    if (typeof href !== 'string') {
      return null;
    }

    const value = href.trim();

    if (!value) return null;

    const compact = value.replace(
      /[\u0000-\u0020\u007f]+/g,
      ''
    );

    if (
      /^(?:javascript|data|vbscript):/i.test(
        compact
      )
    ) {
      return null;
    }

    return value;
  }

  function tabId(tab: HelpTab): string {
    return `${componentId}-tab-${tab}`;
  }

  function panelId(tab: HelpTab): string {
    return `${componentId}-panel-${tab}`;
  }

  function close(): void {
    if (!open) return;

    open = false;
    onClose?.();
  }

  function selectTab(tab: HelpTab): void {
    activeTab = tab;
  }

  function handleTabKeydown(
    event: KeyboardEvent,
    currentTab: HelpTab
  ): void {
    const currentIndex = tabs.findIndex(
      (tab) => tab.id === currentTab
    );

    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft':
        nextIndex =
          currentIndex === 0
            ? tabs.length - 1
            : currentIndex - 1;
        break;

      case 'ArrowRight':
        nextIndex =
          currentIndex === tabs.length - 1
            ? 0
            : currentIndex + 1;
        break;

      case 'Home':
        nextIndex = 0;
        break;

      case 'End':
        nextIndex = tabs.length - 1;
        break;

      default:
        return;
    }

    event.preventDefault();

    const nextTab = tabs[nextIndex].id;
    activeTab = nextTab;

    void tick().then(() => {
      document
        .getElementById(tabId(nextTab))
        ?.focus();
    });
  }

  function getFocusableElements(): HTMLElement[] {
    if (!dialog) return [];

    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    return Array.from(
      dialog.querySelectorAll<HTMLElement>(
        selector
      )
    ).filter(
      (element) =>
        !element.hasAttribute('hidden') &&
        element.getAttribute('aria-hidden') !==
          'true' &&
        element.offsetParent !== null
    );
  }

  function trapFocus(
    event: KeyboardEvent
  ): void {
    const focusable = getFocusableElements();

    if (!focusable.length) {
      event.preventDefault();
      dialog?.focus();
      return;
    }

    const first = focusable[0];
    const last =
      focusable[focusable.length - 1];

    const active =
      document.activeElement;

    if (
      event.shiftKey &&
      (active === first || active === dialog)
    ) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (
      !event.shiftKey &&
      active === last
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleDialogKeydown(
    event: KeyboardEvent
  ): void {
    if (event.key === 'Tab') {
      trapFocus(event);
    }
  }

  function handleWindowKeydown(
    event: KeyboardEvent
  ): void {
    if (!open || event.key !== 'Escape') {
      return;
    }

    event.preventDefault();
    close();
  }
</script>

<svelte:window
    onkeydown={handleWindowKeydown}
/>

{#if open}
  <div class="help-layer">
    <button
      type="button"
      class="help-backdrop"
      tabindex="-1"
      aria-label="Close help"
      onclick={close}
    ></button>

    <div
      bind:this={dialog}
      id={dialogId}
      class="help"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      tabindex="-1"
      onkeydown={handleDialogKeydown}
    >
      <header class="dialog-header">
        <div class="heading-copy">
          <p class="eyebrow">
            <HelpCircle
              size={14}
              strokeWidth={1.8}
              aria-hidden="true"
            />

            Help
          </p>

          <h2 id={titleId}>
            Using CivicWatch
          </h2>

          <p
            id={descriptionId}
            class="dialog-description"
          >
            A quick guide to exploring public
            legislative communication.
          </p>
        </div>

        <button
          type="button"
          class="close-button"
          aria-label="Close help"
          onclick={close}
        >
          <X
            size={19}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </button>
      </header>

      <div
        class="tabs"
        role="tablist"
        aria-label="Help sections"
      >
        {#each tabs as tab (tab.id)}
          <button
            id={tabId(tab.id)}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={panelId(tab.id)}
            tabindex={activeTab === tab.id
              ? 0
              : -1}
            onclick={() =>
              selectTab(tab.id)}
            onkeydown={(event) =>
              handleTabKeydown(
                event,
                tab.id
              )}
          >
            {tab.label}
          </button>
        {/each}
      </div>

      <div class="dialog-body">
        <section
          id={panelId('overview')}
          role="tabpanel"
          aria-labelledby={tabId('overview')}
          tabindex="0"
          hidden={activeTab !== 'overview'}
        >
          <div class="panel-heading">
            <HelpCircle
              size={20}
              strokeWidth={1.6}
              aria-hidden="true"
            />

            <h3>What CivicWatch is</h3>
          </div>

          <p>
            CivicWatch is a read-only,
            public-interest explorer for posts
            published by U.S. state legislators
            between January 2020 and December
            2024.
          </p>

          <p>
            It lets citizens, journalists, and
            researchers examine what legislators
            said, which topics they emphasized,
            and how communication differed across
            states, parties, chambers, and time.
          </p>

          <div class="principle">
            <strong>Real statements, not generated summaries.</strong>

            <span>
              Post cards show the original public
              text and its available metadata.
            </span>
          </div>
        </section>

        <section
          id={panelId('usage')}
          role="tabpanel"
          aria-labelledby={tabId('usage')}
          tabindex="0"
          hidden={activeTab !== 'usage'}
        >
          <div class="panel-heading">
            <MousePointer2
              size={20}
              strokeWidth={1.6}
              aria-hidden="true"
            />

            <h3>How to explore</h3>
          </div>

          <ol class="steps">
            <li>
              <strong>Choose a starting point.</strong>

              <span>
                Look up a legislator, explore a
                state, follow a topic, or revisit
                a moment in time.
              </span>
            </li>

            <li>
              <strong>Open a drilldown.</strong>

              <span>
                Select a person, place, topic, chart
                mark, or post to see the underlying
                detail.
              </span>
            </li>

            <li>
              <strong>Refine the view.</strong>

              <span>
                Analyst mode adds date, party,
                chamber, state, topic, engagement,
                comparison, and export controls.
              </span>
            </li>

            <li>
              <strong>Share or reproduce it.</strong>

              <span>
                Filters are stored in the URL.
                Permalinks can also be pinned to a
                specific data snapshot.
              </span>
            </li>
          </ol>
        </section>

        <section
          id={panelId('data')}
          role="tabpanel"
          aria-labelledby={tabId('data')}
          tabindex="0"
          hidden={activeTab !== 'data'}
        >
          <div class="panel-heading">
            <Database
              size={20}
              strokeWidth={1.6}
              aria-hidden="true"
            />

            <h3>Where the data comes from</h3>
          </div>

          <p>
            Each page is backed by the active
            CivicWatch PostgreSQL snapshot and
            bounded analytical aggregates built
            from the underlying post and legislator
            records.
          </p>

          <p>
            Missing party, district, ideology, or
            other public-record information is
            shown explicitly rather than silently
            dropping the affected legislators.
            Chart captions state the population
            represented whenever coverage is
            incomplete.
          </p>

          <div class="principle">
            <strong>Snapshots preserve reproducibility.</strong>

            <span>
              A pinned view continues to reference
              the same published data version even
              after a newer snapshot becomes
              available.
            </span>
          </div>
        </section>
      </div>

      {#if hasFooterLinks}
        <footer class="dialog-footer">
          <nav aria-label="Additional CivicWatch information">
            {#if safeMethodsHref}
              <a
                href={safeMethodsHref}
                onclick={close}
              >
                Methods
              </a>
            {/if}

            {#if safeAboutHref}
              <a
                href={safeAboutHref}
                onclick={close}
              >
                About
              </a>
            {/if}

            {#if safeFeedbackHref}
              <a
                href={safeFeedbackHref}
                onclick={close}
              >
                Feedback
              </a>
            {/if}
          </nav>
        </footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  .help-layer {
    position: fixed;
    inset: 0;
    z-index: 60;
  }

  .help-backdrop {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    background: var(
      --color-modal-backdrop,
      rgb(26 25 23 / 48%)
    );
    border: 0;
    cursor: default;
  }

  .help {
    position: absolute;
    top: 72px;
    right: 24px;
    bottom: 24px;
    display: grid;
    grid-template-rows:
      auto auto minmax(0, 1fr) auto;
    width: min(
      580px,
      calc(100vw - 48px)
    );
    overflow: hidden;
    color: var(--color-ink, #1a1917);
    background: var(--color-card, #fff);
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 6px;
    box-shadow:
      0 18px 60px rgb(26 25 23 / 20%);
    outline: none;
  }

  .help:focus-visible {
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .dialog-header {
    display: flex;
    gap: 20px;
    align-items: start;
    justify-content: space-between;
    padding: 18px 18px 16px;
    border-bottom: 1px solid
      var(--color-rule, #d9d2c1);
  }

  .heading-copy {
    min-width: 0;
  }

  .eyebrow {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    margin: 0 0 4px;
    color: var(--color-seal, #8a5a1a);
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    margin: 0;
    font-size: clamp(
      1.4rem,
      1.25rem + 0.45vw,
      1.75rem
    );
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  .dialog-description {
    margin: 5px 0 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.84rem;
    line-height: 1.3rem;
  }

  .close-button {
    display: grid;
    width: 40px;
    height: 40px;
    padding: 0;
    place-items: center;
    color: var(--color-mute, #6b6659);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    flex: 0 0 auto;
    transition:
      color 120ms ease,
      background-color 120ms ease,
      border-color 120ms ease;
  }

  .close-button:hover {
    color: var(--color-ink, #1a1917);
    background: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 35%,
      transparent
    );
  }

  .close-button:focus-visible,
  .tabs button:focus-visible,
  [role='tabpanel']:focus-visible,
  .dialog-footer a:focus-visible {
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .tabs {
    display: grid;
    grid-template-columns: repeat(
      3,
      minmax(0, 1fr)
    );
    padding: 0 18px;
    border-bottom: 1px solid
      var(--color-rule, #d9d2c1);
  }

  .tabs button {
    position: relative;
    min-height: 48px;
    padding: 9px 8px;
    color: var(--color-mute, #6b6659);
    font: inherit;
    font-size: 0.78rem;
    font-weight: 500;
    line-height: 1.1rem;
    text-align: center;
    background: transparent;
    border: 0;
    cursor: pointer;
  }

  .tabs button::after {
    position: absolute;
    right: 8px;
    bottom: -1px;
    left: 8px;
    height: 2px;
    content: '';
    background: transparent;
  }

  .tabs button:hover {
    color: var(--color-ink, #1a1917);
  }

  .tabs button[aria-selected='true'] {
    color: var(--color-ink, #1a1917);
    font-weight: 600;
  }

  .tabs button[aria-selected='true']::after {
    background: var(--color-seal, #8a5a1a);
  }

  .dialog-body {
    min-height: 0;
    padding: 20px 18px 24px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  [role='tabpanel'] {
    outline: none;
  }

  [role='tabpanel'][hidden] {
    display: none;
  }

  .panel-heading {
    display: flex;
    gap: 9px;
    align-items: center;
    margin-bottom: 14px;
    color: var(--color-seal, #8a5a1a);
  }

  .panel-heading h3 {
    margin: 0;
    color: var(--color-ink, #1a1917);
    font-size: 1.05rem;
    line-height: 1.4rem;
  }

  [role='tabpanel'] > p {
    margin: 0 0 13px;
    color: var(--color-mute, #6b6659);
    font-size: 0.9rem;
    line-height: 1.5rem;
  }

  .principle {
    display: grid;
    gap: 4px;
    margin-top: 18px;
    padding: 13px 14px;
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 5%,
      var(--color-card, #fff)
    );
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-left: 3px solid
      var(--color-seal, #8a5a1a);
    border-radius: 6px;
  }

  .principle strong {
    font-size: 0.84rem;
    line-height: 1.2rem;
  }

  .principle span {
    color: var(--color-mute, #6b6659);
    font-size: 0.8rem;
    line-height: 1.25rem;
  }

  .steps {
    display: grid;
    gap: 14px;
    padding: 0;
    margin: 0;
    list-style: none;
    counter-reset: help-step;
  }

  .steps li {
    position: relative;
    display: grid;
    gap: 3px;
    min-height: 42px;
    padding-left: 42px;
    counter-increment: help-step;
  }

  .steps li::before {
    position: absolute;
    top: 0;
    left: 0;
    display: grid;
    width: 28px;
    height: 28px;
    place-items: center;
    color: var(--color-seal, #8a5a1a);
    font-family: var(
      --font-data,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.72rem;
    font-weight: 600;
    content: counter(help-step);
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 9%,
      var(--color-card, #fff)
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--color-seal, #8a5a1a) 34%,
        var(--color-rule, #d9d2c1)
      );
    border-radius: 50%;
  }

  .steps strong {
    font-size: 0.88rem;
    line-height: 1.25rem;
  }

  .steps span {
    color: var(--color-mute, #6b6659);
    font-size: 0.82rem;
    line-height: 1.3rem;
  }

  .dialog-footer {
    padding: 11px 18px;
    border-top: 1px solid
      var(--color-rule, #d9d2c1);
  }

  .dialog-footer nav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
  }

  .dialog-footer a {
    min-height: 32px;
    padding-block: 6px;
    color: var(--color-mute, #6b6659);
    font-size: 0.78rem;
    font-weight: 500;
    line-height: 1.1rem;
    text-underline-offset: 3px;
    border-radius: 3px;
  }

  .dialog-footer a:hover {
    color: var(--color-seal, #8a5a1a);
  }

  @media (max-width: 680px) {
    .help {
      top: auto;
      right: 0;
      bottom: 0;
      left: 0;
      width: 100%;
      max-height: calc(
        100dvh - env(safe-area-inset-top, 0px) -
          12px
      );
      border-right: 0;
      border-bottom: 0;
      border-left: 0;
      border-radius: 6px 6px 0 0;
    }

    .dialog-header {
      padding: 16px 14px 14px;
    }

    .tabs {
      padding-inline: 8px;
      overflow-x: auto;
    }

    .tabs button {
      min-width: 110px;
      min-height: 50px;
    }

    .dialog-body {
      padding: 18px 14px
        calc(
          22px +
            env(safe-area-inset-bottom, 0px)
        );
    }

    .dialog-footer {
      padding:
        10px 14px
        calc(
          10px +
            env(safe-area-inset-bottom, 0px)
        );
    }
  }

  @media (max-width: 420px) {
    .dialog-description {
      max-width: 16rem;
    }

    .tabs {
      grid-template-columns: none;
      grid-auto-flow: column;
      grid-auto-columns: max-content;
      justify-content: start;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .close-button {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .help,
    .principle,
    .tabs,
    .dialog-header,
    .dialog-footer {
      color: CanvasText;
      background: Canvas;
      border-color: CanvasText;
    }

    .tabs button[aria-selected='true']::after {
      background: Highlight;
    }

    .close-button:focus-visible,
    .tabs button:focus-visible,
    [role='tabpanel']:focus-visible,
    .dialog-footer a:focus-visible {
      outline-color: Highlight;
    }
  }

  @media print {
    .help-layer {
      display: none;
    }
  }
</style>