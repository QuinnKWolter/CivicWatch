<script lang="ts">
  import '../app.css';

  import { browser } from '$app/environment';
  import { afterNavigate, onNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount, type Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import {
    HelpCircle,
    Menu,
    X
  } from 'lucide-svelte';

  import AnalystRail from '$lib/components/AnalystRail.svelte';
  import GlobalSearch from '$lib/components/GlobalSearch.svelte';
  import HelpOverlay from '$lib/components/HelpOverlay.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

  interface Props {
    data?: unknown;
    children: Snippet;
  }

  interface NavigationItem {
    href: string;
    label: string;
    description: string;
  }

  type ViewTransitionDocument = Document & {
    startViewTransition?: (
      callback: () => void | Promise<void>
    ) => unknown;
  };

  let {
    data = null,
    children
  }: Props = $props();

  const instanceId = $props.id();
  const navigationId = `${instanceId}-primary-navigation`;

  const fallbackSnapshotId =
    'cw_2026_07_02_full';

  const navigationItems: NavigationItem[] = [
    {
      href: '/who',
      label: 'Legislators',
      description:
        'Find individual state legislators'
    },
    {
      href: '/place',
      label: 'States',
      description:
        'Explore activity by state and chamber'
    },
    {
      href: '/topic',
      label: 'Topics',
      description:
        'Browse policy and political topics'
    },
    {
      href: '/moment',
      label: 'Moments',
      description:
        'Examine activity across time'
    },
    {
      href: '/compare',
      label: 'Compare',
      description:
        'Compare legislators and groups'
    },
    {
      href: '/methods',
      label: 'Methods',
      description:
        'Review sources, definitions, and methods'
    }
  ];

  let helpOpen = $state(false);
  let menuOpen = $state(false);
  let useFallbackRouteMotion = $state(true);

  let siteHeader: HTMLElement | null = null;
  let menuButton: HTMLButtonElement | null = null;

  const metadata = $derived.by(() =>
    extractMetadata(data)
  );

  const snapshotId = $derived(
    cleanText(
      firstValue([
        metadata.snapshotId,
        metadata.snapshot_id,
        metadata.snapshot,
        metadata.id
      ])
    ) ?? fallbackSnapshotId
  );

  const coverageEnd = $derived(
    formatCoverageDate(
      firstValue([
        metadata.coverageEnd,
        metadata.coverage_end,
        metadata.endDate,
        metadata.end_date,
        metadata.maxDate,
        metadata.max_date,
        extractNestedValue(
          metadata.coverage,
          [
            'end',
            'endDate',
            'end_date',
            'maxDate',
            'max_date'
          ]
        ),
        extractNestedValue(
          metadata.dateRange,
          [
            'end',
            'endDate',
            'end_date'
          ]
        ),
        extractNestedValue(
          metadata.date_range,
          [
            'end',
            'endDate',
            'end_date'
          ]
        )
      ])
    ) ?? 'December 2024'
  );

  const pageDescription = $derived(
    `Explore public posts from U.S. state legislators, with data through ${coverageEnd}.`
  );

  afterNavigate(() => {
    menuOpen = false;
    helpOpen = false;
  });

  onNavigate((navigation) => {
    if (!browser) {
      return;
    }

    if (
      window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches
    ) {
      return;
    }

    const viewTransitionDocument =
      document as ViewTransitionDocument;

    const startViewTransition =
      viewTransitionDocument.startViewTransition;

    if (!startViewTransition) {
      return;
    }

    return new Promise<void>((resolve) => {
      startViewTransition.call(
        document,
        async () => {
          resolve();
          await navigation.complete;
        }
      );
    });
  });

  onMount(() => {
    const desktopMedia = window.matchMedia(
      '(min-width: 901px)'
    );

    const reducedMotionMedia =
      window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      );

    const supportsViewTransitions =
      'startViewTransition' in document;

    const syncMotionPreference = () => {
      useFallbackRouteMotion =
        !supportsViewTransitions &&
        !reducedMotionMedia.matches;
    };

    const handleDesktopChange = (
      event: MediaQueryListEvent
    ) => {
      if (event.matches) {
        menuOpen = false;
      }
    };

    const handleKeydown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key !== 'Escape' ||
        !menuOpen
      ) {
        return;
      }

      menuOpen = false;
      menuButton?.focus();
    };

    const handleOutsidePointer = (
      event: PointerEvent
    ) => {
      if (!menuOpen) {
        return;
      }

      const target = event.target;

      if (
        target instanceof Node &&
        siteHeader?.contains(target)
      ) {
        return;
      }

      menuOpen = false;
    };

    syncMotionPreference();

    desktopMedia.addEventListener(
      'change',
      handleDesktopChange
    );

    reducedMotionMedia.addEventListener(
      'change',
      syncMotionPreference
    );

    document.addEventListener(
      'keydown',
      handleKeydown
    );

    document.addEventListener(
      'pointerdown',
      handleOutsidePointer
    );

    return () => {
      desktopMedia.removeEventListener(
        'change',
        handleDesktopChange
      );

      reducedMotionMedia.removeEventListener(
        'change',
        syncMotionPreference
      );

      document.removeEventListener(
        'keydown',
        handleKeydown
      );

      document.removeEventListener(
        'pointerdown',
        handleOutsidePointer
      );
    };
  });

  function isRecord(
    value: unknown
  ): value is Record<string, unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    );
  }

  function toRecord(
    value: unknown
  ): Record<string, unknown> {
    return isRecord(value) ? value : {};
  }

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
      /^(?:nan|na|n\/a|null|none|undefined)$/i.test(
        text
      )
    ) {
      return null;
    }

    return text;
  }

  function firstValue(
    values: unknown[]
  ): unknown {
    for (const value of values) {
      if (
        value !== null &&
        value !== undefined &&
        value !== ''
      ) {
        return value;
      }
    }

    return null;
  }

  function extractMetadata(
    value: unknown
  ): Record<string, unknown> {
    const root = toRecord(value);
    const meta = toRecord(root.meta);
    const nestedData = toRecord(meta.data);

    if (
      Object.keys(nestedData).length > 0
    ) {
      return nestedData;
    }

    if (Object.keys(meta).length > 0) {
      return meta;
    }

    return toRecord(root.metadata);
  }

  function extractNestedValue(
    source: unknown,
    keys: string[]
  ): unknown {
    const record = toRecord(source);

    return firstValue(
      keys.map((key) => record[key])
    );
  }

  function formatCoverageDate(
    value: unknown
  ): string | null {
    const text = cleanText(value);

    if (!text) {
      return null;
    }

    const normalized =
      /^\d{4}-\d{2}$/.test(text)
        ? `${text}-01T00:00:00.000Z`
        : /^\d{4}-\d{2}-\d{2}$/.test(
              text
            )
          ? `${text}T00:00:00.000Z`
          : text;

    const timestamp = Date.parse(normalized);

    if (!Number.isFinite(timestamp)) {
      return text;
    }

    return new Intl.DateTimeFormat(
      'en-US',
      {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      }
    ).format(new Date(timestamp));
  }

  function routeIsActive(
    href: string
  ): boolean {
    const pathname = page.url.pathname;

    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  }

  function toggleMenu(): void {
    menuOpen = !menuOpen;
  }

  function closeMenu(): void {
    menuOpen = false;
  }

  function openHelp(): void {
    menuOpen = false;
    helpOpen = true;
  }
</script>

<svelte:head>
  <title>CivicWatch</title>

  <meta
    name="description"
    content={pageDescription}
  />
</svelte:head>

<a
  class="skip-link"
  href="#main-content"
>
  Skip to main content
</a>

<header
  bind:this={siteHeader}
  class="site-header"
>
  <div class="container header-inner">
    <a
      class="wordmark"
      href="/"
      aria-label="CivicWatch home"
    >
      <span
        class="wordmark-mark"
        aria-hidden="true"
      >
        <img src="/favicon.svg" alt="" />
      </span>

      <span class="wordmark-copy">
        <strong>CivicWatch</strong>
        <small>State legislative speech</small>
      </span>
    </a>

    <nav
      id={navigationId}
      class:open={menuOpen}
      class="primary-navigation"
      aria-label="Primary navigation"
    >
      <div class="navigation-links">
        {#each navigationItems as item (item.href)}
          {@const active =
            routeIsActive(item.href)}

          <a
            class:active
            href={item.href}
            aria-current={active
              ? 'page'
              : undefined}
            onclick={closeMenu}
          >
            <span>{item.label}</span>
            <small>{item.description}</small>
          </a>
        {/each}
      </div>

      <div class="mobile-navigation-meta">
        <span>
          Data through {coverageEnd}
        </span>

        <span aria-hidden="true">·</span>

        <span>
          Snapshot {snapshotId}
        </span>
      </div>
    </nav>

    <div
      class="toolbar"
      aria-label="Site tools"
    >
      <button
        bind:this={menuButton}
        class="icon-button menu-button"
        class:active={menuOpen}
        type="button"
        aria-label={menuOpen
          ? 'Close navigation'
          : 'Open navigation'}
        aria-controls={navigationId}
        aria-expanded={menuOpen}
        title={menuOpen
          ? 'Close navigation'
          : 'Open navigation'}
        onclick={toggleMenu}
      >
        <span
          class="button-icon"
          aria-hidden="true"
        >
          {#if menuOpen}
            <X
              size={18}
              strokeWidth={1.8}
            />
          {:else}
            <Menu
              size={18}
              strokeWidth={1.8}
            />
          {/if}
        </span>
      </button>

      <div class="tool-slot search-slot">
        <GlobalSearch />
      </div>

      <div class="tool-slot theme-slot">
        <ThemeToggle
          showTextLabel={false}
        />
      </div>

      <button
        class="icon-button help-button"
        type="button"
        aria-label="Open CivicWatch help"
        title="Help and keyboard shortcuts"
        onclick={openHelp}
      >
        <span
          class="button-icon"
          aria-hidden="true"
        >
          <HelpCircle
            size={18}
            strokeWidth={1.8}
          />
        </span>
      </button>
    </div>
  </div>
</header>

{#if menuOpen}
  <button
    class="navigation-backdrop"
    type="button"
    aria-label="Close primary navigation"
    onclick={closeMenu}
  ></button>
{/if}

<HelpOverlay bind:open={helpOpen} />

<main
  id="main-content"
  tabindex="-1"
>
  {#key page.url.pathname}
    <div
      class="page-shell"
      in:fly={{
        y: 8,
        duration: useFallbackRouteMotion
          ? 170
          : 0
      }}
      out:fade={{
        duration: useFallbackRouteMotion
          ? 80
          : 0
      }}
    >
      {@render children()}
    </div>
  {/key}
</main>

<AnalystRail {snapshotId} />

<footer class="site-footer">
  <div class="container footer-inner">
    <div class="footer-introduction">
      <a
        class="footer-wordmark"
        href="/"
      >
        CivicWatch
      </a>

      <p>
        A public interface for examining how
        U.S. state legislators communicate,
        what they discuss, and how those
        patterns differ across place, party,
        and time.
      </p>
    </div>

    <nav
      class="footer-navigation"
      aria-label="Footer navigation"
    >
      <a href="/methods">Methods</a>
      <a href="/about">About</a>
      <a href="/who">Legislators</a>
      <a href="/place">States</a>
      <a href="/topic">Topics</a>
    </nav>

    <div class="footer-metadata">
      <span>
        Data through
        <strong>{coverageEnd}</strong>
      </span>

      <span class="metadata-separator">
        ·
      </span>

      <span>
        Snapshot
        <code>{snapshotId}</code>
      </span>
    </div>
  </div>
</footer>

<style>
  :global(html) {
    scroll-padding-top: 84px;
  }

  :global(body) {
    min-width: 320px;
  }

  .skip-link {
    position: fixed;
    top: 8px;
    left: 8px;
    z-index: 1000;
    padding: 9px 12px;
    color: var(
      --color-on-accent,
      #fff
    );
    font-size: 0.78rem;
    font-weight: 650;
    line-height: 1rem;
    text-decoration: none;
    background: var(
      --color-seal,
      #8a5a1a
    );
    border: 1px solid
      var(--color-ink, #1a1917);
    border-radius: 6px;
    transform: translateY(-160%);
    transition: transform 120ms ease;
  }

  .skip-link:focus {
    transform: translateY(0);
    outline: 2px solid
      var(--color-card, #fff);
    outline-offset: 2px;
  }

  .site-header {
    position: sticky;
    top: 0;
    z-index: 60;
    width: 100%;
    max-width: 100vw;
    overflow-x: clip;
    color: var(--color-ink, #1a1917);
    background: var(--color-card, #fff);
    border-bottom: 1px solid
      var(--color-rule, #d9d2c1);
  }

  .header-inner {
    position: relative;
    display: grid;
    grid-template-columns:
      auto minmax(0, 1fr) auto;
    gap: clamp(18px, 3vw, 42px);
    align-items: center;
    min-height: 56px;
  }

  .wordmark {
    display: inline-flex;
    gap: 9px;
    align-items: center;
    min-width: 0;
    color: var(--color-ink, #1a1917);
    text-decoration: none;
  }

  .wordmark:hover {
    color: var(--color-seal, #8a5a1a);
  }

  .wordmark:focus-visible,
  .footer-wordmark:focus-visible,
  .footer-navigation a:focus-visible {
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 3px;
  }

  .wordmark-mark {
    display: grid;
    width: 32px;
    height: 32px;
    flex: 0 0 auto;
    place-items: center;
    overflow: hidden;
    background: var(--color-ink, #101712);
    border: 1px solid color-mix(in srgb, var(--color-rule) 72%, transparent);
    border-radius: 7px;
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 9%);
  }

  .wordmark-mark img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .wordmark-copy {
    display: grid;
    gap: 0;
    min-width: 0;
  }

  .wordmark-copy strong {
    font-size: 0.88rem;
    font-weight: 750;
    line-height: 1rem;
    letter-spacing: 0.065em;
    text-transform: uppercase;
  }

  .wordmark-copy small {
    overflow: hidden;
    color: var(
      --color-mute,
      #6b6659
    );
    font-size: 0.62rem;
    line-height: 0.9rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .primary-navigation {
    min-width: 0;
  }

  .navigation-links {
    display: flex;
    gap: 2px;
    align-items: center;
    justify-content: center;
  }

  .navigation-links a {
    position: relative;
    display: inline-flex;
    min-height: 34px;
    padding: 6px 10px;
    align-items: center;
    color: var(
      --color-mute,
      #6b6659
    );
    font-size: 0.77rem;
    font-weight: 600;
    line-height: 1rem;
    text-decoration: none;
    border: 1px solid transparent;
    border-radius: 6px;
    transition:
      color 120ms ease,
      background-color 120ms ease,
      border-color 120ms ease;
  }

  .navigation-links a small {
    display: none;
  }

  .navigation-links a:hover {
    color: var(
      --color-ink,
      #1a1917
    );
    background: color-mix(
      in srgb,
      var(--color-rule, #d9d2c1) 18%,
      var(--color-card, #fff)
    );
  }

  .navigation-links a.active {
    color: var(
      --color-seal,
      #8a5a1a
    );
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 7%,
      var(--color-card, #fff)
    );
    border-color: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 30%,
      var(--color-rule, #d9d2c1)
    );
  }

  .navigation-links a.active::after {
    position: absolute;
    right: 10px;
    bottom: 4px;
    left: 10px;
    height: 1px;
    content: '';
    background: var(
      --color-seal,
      #8a5a1a
    );
  }

  .navigation-links a:focus-visible {
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .mobile-navigation-meta {
    display: none;
  }

  .toolbar {
    display: flex;
    gap: 4px;
    align-items: center;
    justify-content: flex-end;
    width: auto;
    min-width: 0;
    padding: 2px;
    margin: 0;
    background: color-mix(
      in srgb,
      var(--color-elevated, #fff) 78%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--color-rule, #d8d6cc) 82%,
        transparent
      );
    border-radius: 999px;
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 46%),
      var(--shadow-sm, 0 1px 2px rgb(0 0 0 / 6%));
  }

  .tool-slot {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    margin: 0;
  }

  .icon-button {
    appearance: none;
    display: grid;
    width: 34px;
    height: 34px;
    flex: 0 0 auto;
    padding: 0;
    margin: 0;
    place-items: center;
    color: var(
      --color-mute,
      #6b6659
    );
    background: transparent;
    border: 1px solid transparent;
    border-radius: 999px;
    box-shadow: none;
    cursor: pointer;
    line-height: 1;
    transition:
      color 120ms ease,
      background-color 120ms ease,
      border-color 120ms ease,
      box-shadow 120ms ease;
  }

  .icon-button:hover,
  .icon-button.active {
    color: var(
      --color-seal,
      #8a5a1a
    );
    background: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 6%,
      var(--color-card, #fff)
    );
    border-color: color-mix(
      in srgb,
      var(--color-seal, #8a5a1a) 30%,
      var(--color-rule, #d9d2c1)
    );
    box-shadow: none;
    transform: none;
  }

  .icon-button:focus-visible {
    outline: 2px solid
      var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  .button-icon {
    display: inline-flex;
    line-height: 0;
  }

  .menu-button {
    display: none;
  }

  .navigation-backdrop {
    display: none;
  }

  main {
    position: relative;
    z-index: 1;
    min-height: calc(100dvh - 210px);
    outline: none;
  }

  .page-shell {
    width: 100%;
    min-width: 0;
  }

  .site-footer {
    position: relative;
    z-index: 1;
    margin-top: clamp(
      48px,
      7vw,
      88px
    );
    color: var(
      --color-mute,
      #6b6659
    );
    background: color-mix(
      in srgb,
      var(--color-paper, #f5f1e7) 72%,
      var(--color-card, #fff)
    );
    border-top: 1px solid
      var(--color-rule, #d9d2c1);
  }

  .footer-inner {
    display: grid;
    grid-template-columns:
      minmax(240px, 1.4fr)
      minmax(180px, 0.8fr);
    gap: 28px 48px;
    padding-block: 30px 24px;
  }

  .footer-introduction {
    max-width: 62ch;
  }

  .footer-wordmark {
    color: var(
      --color-ink,
      #1a1917
    );
    font-size: 0.84rem;
    font-weight: 750;
    line-height: 1rem;
    letter-spacing: 0.065em;
    text-decoration: none;
    text-transform: uppercase;
  }

  .footer-wordmark:hover {
    color: var(
      --color-seal,
      #8a5a1a
    );
  }

  .footer-introduction p {
    margin: 7px 0 0;
    font-size: 0.76rem;
    line-height: 1.25rem;
  }

  .footer-navigation {
    display: grid;
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
    gap: 4px 16px;
    align-content: start;
  }

  .footer-navigation a {
    min-height: 30px;
    display: inline-flex;
    align-items: center;
    color: var(
      --color-mute,
      #6b6659
    );
    font-size: 0.74rem;
    font-weight: 550;
    line-height: 1rem;
    text-decoration: none;
  }

  .footer-navigation a:hover {
    color: var(
      --color-seal,
      #8a5a1a
    );
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .footer-metadata {
    display: flex;
    grid-column: 1 / -1;
    gap: 5px 8px;
    align-items: baseline;
    padding-top: 15px;
    color: var(
      --color-mute-soft,
      #9c9787
    );
    font-size: 0.68rem;
    line-height: 1rem;
    border-top: 1px solid
      var(--color-rule, #d9d2c1);
  }

  .footer-metadata strong {
    color: var(
      --color-mute,
      #6b6659
    );
    font-weight: 600;
  }

  .footer-metadata code {
    overflow-wrap: anywhere;
    color: var(
      --color-mute,
      #6b6659
    );
    font-family: var(
      --type-mono,
      'JetBrains Mono',
      ui-monospace,
      monospace
    );
    font-size: 0.66rem;
  }

  @media (max-width: 1120px) {
    .header-inner {
      gap: 18px;
    }

    .wordmark-copy small {
      display: none;
    }

    .navigation-links a {
      padding-inline: 8px;
    }
  }

  @media (max-width: 900px) {
    :global(html) {
      scroll-padding-top: 72px;
    }

    .header-inner {
      grid-template-columns:
        minmax(0, 1fr) auto;
      gap: 12px;
      min-height: 54px;
    }

    .wordmark {
      width: fit-content;
    }

    .wordmark-copy small {
      display: block;
    }

    .primary-navigation {
      position: absolute;
      top: calc(100% + 1px);
      right: 0;
      left: 0;
      z-index: 62;
      display: none;
      padding: 10px;
      background: var(
        --color-card,
        #fff
      );
      border: 1px solid
        var(--color-rule, #d9d2c1);
      border-top: 0;
      border-radius: 0 0 6px 6px;
      box-shadow: 0 14px 30px
        rgb(26 25 23 / 10%);
    }

    .primary-navigation.open {
      display: block;
    }

    .navigation-links {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 5px;
    }

    .navigation-links a {
      display: grid;
      gap: 1px;
      min-height: 58px;
      padding: 9px 10px;
      align-content: center;
      justify-content: stretch;
      border-color: var(
        --color-rule,
        #d9d2c1
      );
    }

    .navigation-links a span {
      font-size: 0.8rem;
      line-height: 1.05rem;
    }

    .navigation-links a small {
      display: block;
      overflow: hidden;
      color: var(
        --color-mute,
        #6b6659
      );
      font-size: 0.64rem;
      font-weight: 450;
      line-height: 0.95rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .navigation-links a.active::after {
      top: 8px;
      right: auto;
      bottom: 8px;
      left: 4px;
      width: 2px;
      height: auto;
    }

    .mobile-navigation-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 3px 7px;
      align-items: baseline;
      padding: 10px 4px 1px;
      color: var(
        --color-mute-soft,
        #9c9787
      );
      font-family: var(
        --type-mono,
        'JetBrains Mono',
        ui-monospace,
        monospace
      );
      font-size: 0.61rem;
      line-height: 0.95rem;
      font-variant-numeric: tabular-nums;
    }

    .toolbar {
      grid-column: 2;
      grid-row: 1;
      gap: 3px;
      padding: 2px;
    }

    .menu-button {
      display: grid;
    }

    .navigation-backdrop {
      position: fixed;
      inset: 0;
      z-index: 55;
      display: block;
      width: 100%;
      height: 100%;
      padding: 0;
      background: rgb(26 25 23 / 24%);
      border: 0;
      cursor: default;
    }

    .site-footer {
      margin-top: 54px;
    }
  }

  @media (max-width: 620px) {
    .header-inner {
      min-height: 52px;
      gap: 8px;
    }

    .wordmark-mark {
      width: 30px;
      height: 30px;
    }

    .wordmark-copy small {
      display: none;
    }

    .navigation-links {
      grid-template-columns: 1fr;
    }

    .navigation-links a {
      min-height: 52px;
    }

    .toolbar {
      gap: 2px;
      padding: 2px;
    }

    .icon-button {
      width: 34px;
      height: 34px;
    }

    .help-button {
      display: none;
    }

    .footer-inner {
      grid-template-columns: 1fr;
      gap: 22px;
      padding-block: 26px 20px;
    }

    .footer-navigation {
      grid-template-columns:
        repeat(3, minmax(0, 1fr));
    }

    .footer-metadata {
      grid-column: auto;
      flex-wrap: wrap;
    }
  }

  @media (max-width: 390px) {
    .wordmark-copy strong {
      font-size: 0.8rem;
    }

    .footer-navigation {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }

    .metadata-separator {
      display: none;
    }

    .footer-metadata {
      display: grid;
      gap: 3px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skip-link,
    .navigation-links a,
    .icon-button {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .site-header,
    .primary-navigation,
    .navigation-links a,
    .icon-button,
    .toolbar,
    .site-footer {
      color: CanvasText;
      background: Canvas;
      border-color: CanvasText;
    }

    .wordmark-mark,
    .skip-link {
      color: HighlightText;
      background: Highlight;
    }

    .wordmark-mark img {
      filter: contrast(1.2);
    }

    .navigation-links a.active,
    .icon-button.active {
      color: Highlight;
      border-color: Highlight;
    }

    .navigation-backdrop {
      background: transparent;
    }

    .wordmark:focus-visible,
    .navigation-links a:focus-visible,
    .icon-button:focus-visible,
    .footer-wordmark:focus-visible,
    .footer-navigation a:focus-visible {
      outline-color: Highlight;
    }
  }

  @media print {
    .site-header,
    .navigation-backdrop,
    .site-footer,
    .skip-link {
      display: none;
    }

    main {
      min-height: auto;
    }
  }
</style>
