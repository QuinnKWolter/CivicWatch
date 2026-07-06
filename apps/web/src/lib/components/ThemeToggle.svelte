<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount, tick } from 'svelte';
  import { Moon, Sun } from 'lucide-svelte';

  type Theme = 'light' | 'dark';
  type StoredThemePreference = Theme | 'system';

  interface Props {
    storageKey?: string;
    defaultPreference?: StoredThemePreference;
    ariaLabel?: string;
    showTextLabel?: boolean;

    onChange?: (
      theme: Theme,
      preference: Theme
    ) => void;
  }

  let {
    storageKey = 'cw_theme',
    defaultPreference = 'system',
    ariaLabel = 'Color theme',
    showTextLabel = true,
    onChange
  }: Props = $props();

  const themes: Theme[] = ['light', 'dark'];

  let control: HTMLDivElement;
  let theme = $state<Theme>('light');
  let systemTheme = $state<Theme>('light');
  let announcement = $state('');

  const currentDescription = $derived(
    theme === 'dark' ? 'Dark' : 'Light'
  );

  const nextTheme = $derived(
    theme === 'dark' ? 'light' : 'dark'
  );

  function isTheme(
    value: unknown
  ): value is Theme {
    return (
      value === 'light' ||
      value === 'dark'
    );
  }

  function safeDefaultTheme(): Theme {
    return isTheme(defaultPreference)
      ? defaultPreference
      : systemTheme;
  }

  function readStoredTheme(): Theme {
    if (!browser) {
      return safeDefaultTheme();
    }

    try {
      const saved =
        localStorage.getItem(storageKey);

      if (isTheme(saved)) {
        return saved;
      }

      if (saved !== null) {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // Storage may be blocked or unavailable.
    }

    return safeDefaultTheme();
  }

  function persistTheme(next: Theme): void {
    if (!browser) return;

    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // The theme still works for the current
      // session if persistence is unavailable.
    }
  }

  function applyDocumentTheme(
    next: Theme
  ): void {
    if (!browser) return;

    const root = document.documentElement;

    root.dataset.theme = next;
    root.dataset.themePreference = next;
    root.style.colorScheme = next;
  }

  function emitThemeChange(): void {
    if (!browser) return;

    onChange?.(theme, theme);

    window.dispatchEvent(
      new CustomEvent('cw:themechange', {
        detail: {
          theme,
          preference: theme
        }
      })
    );
  }

  function setTheme(
    next: Theme,
    emit = true
  ): void {
    const changed = next !== theme;

    theme = next;
    persistTheme(next);
    applyDocumentTheme(next);

    if (emit && changed) {
      emitThemeChange();
    }

    announcement = `${currentDescription} theme enabled.`;
  }

  function themeIndex(value: Theme): number {
    return themes.indexOf(value);
  }

  async function focusTheme(
    next: Theme
  ): Promise<void> {
    await tick();

    control
      ?.querySelector<HTMLButtonElement>(
        `[data-value="${next}"]`
      )
      ?.focus();
  }

  function handleOptionKeydown(
    event: KeyboardEvent,
    current: Theme
  ): void {
    const currentIndex =
      themeIndex(current);

    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex =
          currentIndex === 0
            ? themes.length - 1
            : currentIndex - 1;
        break;

      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex =
          currentIndex === themes.length - 1
            ? 0
            : currentIndex + 1;
        break;

      case 'Home':
        nextIndex = 0;
        break;

      case 'End':
        nextIndex = themes.length - 1;
        break;

      default:
        return;
    }

    event.preventDefault();

    const next = themes[nextIndex];

    setTheme(next);
    void focusTheme(next);
  }

  function handleStorageChange(
    event: StorageEvent
  ): void {
    if (event.key !== storageKey) {
      return;
    }

    const next = isTheme(event.newValue)
      ? event.newValue
      : safeDefaultTheme();

    if (next === theme) {
      return;
    }

    theme = next;
    applyDocumentTheme(next);
    emitThemeChange();
  }

  onMount(() => {
    const media = window.matchMedia(
      '(prefers-color-scheme: dark)'
    );

    systemTheme = media.matches
      ? 'dark'
      : 'light';

    theme = readStoredTheme();
    applyDocumentTheme(theme);

    window.addEventListener(
      'storage',
      handleStorageChange
    );

    return () => {
      window.removeEventListener(
        'storage',
        handleStorageChange
      );
    };
  });
</script>

<div
  class="theme-control"
  data-theme={theme}
>
  <div
    bind:this={control}
    class="theme-toggle"
    data-theme={theme}
    role="radiogroup"
    aria-label={ariaLabel}
  >
    <span
      class:dark={theme === 'dark'}
      class="selection"
      aria-hidden="true"
    ></span>

    <button
      type="button"
      class="theme-option"
      data-value="light"
      role="radio"
      aria-checked={theme === 'light'}
      aria-label="Use light theme"
      title="Light theme"
      tabindex={theme === 'light' ? 0 : -1}
      onclick={() => setTheme('light')}
      onkeydown={(event) =>
        handleOptionKeydown(event, 'light')}
    >
      <span
        class="option-icon"
        aria-hidden="true"
      >
        <Sun
          size={16}
          strokeWidth={1.9}
        />
      </span>
    </button>

    <button
      type="button"
      class="theme-option"
      data-value="dark"
      role="radio"
      aria-checked={theme === 'dark'}
      aria-label="Use dark theme"
      title="Dark theme"
      tabindex={theme === 'dark' ? 0 : -1}
      onclick={() => setTheme('dark')}
      onkeydown={(event) =>
        handleOptionKeydown(event, 'dark')}
    >
      <span
        class="option-icon"
        aria-hidden="true"
      >
        <Moon
          size={15}
          strokeWidth={1.9}
        />
      </span>
    </button>
  </div>

  {#if showTextLabel}
    <button
      type="button"
      class="theme-label"
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      onclick={() => setTheme(nextTheme)}
    >
      <strong>
        {currentDescription}
      </strong>

      <span>theme</span>
    </button>
  {/if}

  <span
    class="visually-hidden"
    aria-live="polite"
    aria-atomic="true"
  >
    {announcement}
  </span>
</div>

<style>
  .theme-control {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
    margin: 0;
    line-height: 1;
  }

  .theme-toggle {
    --segment-width: 34px;
    --toggle-padding: 1px;

    position: relative;
    display: grid;
    grid-template-columns:
      repeat(2, var(--segment-width));
    gap: 0;
    padding: var(--toggle-padding);
    margin: 0;
    overflow: hidden;
    background: color-mix(
      in srgb,
      var(--color-elevated, #fff) 82%,
      var(--color-track, #ece9df)
    );
    border: 1px solid
      var(--color-rule, #d9d2c1);
    border-radius: 999px;
    box-shadow: inset 0 1px 2px
      rgb(23 32 29 / 5%);
    isolation: isolate;
    transition:
      background-color 160ms ease,
      border-color 160ms ease,
      box-shadow 160ms ease;
  }

  .theme-toggle:hover {
    border-color: color-mix(
      in srgb,
      var(--color-seal, #336a73) 48%,
      var(--color-rule, #d9d2c1)
    );
  }

  .selection {
    position: absolute;
    top: var(--toggle-padding);
    bottom: var(--toggle-padding);
    left: var(--toggle-padding);
    z-index: 0;
    width: var(--segment-width);
    background: var(--color-card, #fff);
    border: 1px solid
      color-mix(
        in srgb,
        var(--color-seal, #336a73) 34%,
        var(--color-rule, #d9d2c1)
      );
    border-radius: 999px;
    box-shadow: var(--shadow-sm, 0 1px 2px rgb(0 0 0 / 8%));
    transform: translateX(0);
    transition:
      transform 190ms
        cubic-bezier(0.22, 1, 0.36, 1),
      background-color 160ms ease,
      border-color 160ms ease;
  }

  .selection.dark {
    transform: translateX(100%);
  }

  .theme-option {
    appearance: none;
    position: relative;
    z-index: 1;
    display: grid;
    width: var(--segment-width);
    height: 32px;
    min-height: 0;
    padding: 0;
    margin: 0;
    place-items: center;
    color: var(--color-mute, #58635f);
    background: transparent;
    border: 0;
    border-radius: 999px;
    box-shadow: none;
    cursor: pointer;
    line-height: 1;
    transition:
      color 140ms ease,
      opacity 140ms ease,
      transform 140ms ease;
  }

  .theme-option:hover {
    color: var(--color-ink, #17201d);
    background: transparent;
    box-shadow: none;
    transform: none;
  }

  .theme-option[aria-checked='true'] {
    color: var(--color-seal, #336a73);
  }

  .theme-option:focus-visible {
    outline: 2px solid
      var(--color-seal, #336a73);
    outline-offset: -2px;
  }

  .option-icon {
    display: inline-flex;
    line-height: 0;
  }

  .theme-label {
    appearance: none;
    display: grid;
    gap: 0;
    min-width: 58px;
    min-height: 34px;
    padding: 2px 0;
    margin: 0;
    color: inherit;
    text-align: left;
    background: transparent;
    border: 0;
    box-shadow: none;
    cursor: pointer;
    line-height: 1;
  }

  .theme-label:hover {
    color: var(--color-seal, #336a73);
    background: transparent;
    box-shadow: none;
    transform: none;
  }

  .theme-label strong {
    overflow: hidden;
    color: var(--color-ink, #17201d);
    font-size: 0.75rem;
    font-weight: 650;
    line-height: 1rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .theme-label > span {
    color: var(--color-mute, #58635f);
    font-size: 0.66rem;
    line-height: 0.9rem;
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

  @media (max-width: 720px) {
    .theme-control {
      gap: 0;
    }

    .theme-label {
      display: none;
    }

    .theme-option {
      height: 32px;
    }
  }

  @media (max-width: 620px) {
    .theme-toggle {
      --segment-width: 32px;
    }

    .theme-option {
      height: 30px;
    }
  }

  @media (max-width: 380px) {
    .theme-toggle {
      --segment-width: 30px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .theme-toggle,
    .selection,
    .theme-option {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .theme-toggle,
    .selection {
      color: CanvasText;
      background: Canvas;
      border-color: CanvasText;
      box-shadow: none;
    }

    .theme-option {
      color: CanvasText;
    }

    .theme-option[aria-checked='true'] {
      color: Highlight;
    }

    .theme-option:focus-visible {
      outline-color: Highlight;
    }
  }

  @media print {
    .theme-control {
      display: none;
    }
  }
</style>
