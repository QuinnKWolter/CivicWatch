<script lang="ts">
  import { page } from '$app/state';
  import { AlertTriangle, RotateCcw } from 'lucide-svelte';
  import { appPath } from '$lib/paths';

  const status = $derived(page.status);
  const message = $derived(page.error?.message ?? 'Something went wrong.');
  const title = $derived(
    status === 429
      ? 'CivicWatch is busy'
      : status === 404
        ? 'Page not found'
        : status >= 500
          ? 'CivicWatch could not load this view'
          : 'This view could not be loaded'
  );
</script>

<svelte:head>
  <title>{title} | CivicWatch</title>
</svelte:head>

<main class="error-shell container" id="main-content">
  <section class="error-panel" aria-labelledby="error-title">
    <div class="error-icon" aria-hidden="true">
      <AlertTriangle size={22} />
    </div>
    <div>
      <p class="eyebrow">{status}</p>
      <h1 id="error-title">{title}</h1>
      <p>{message}</p>
      {#if status === 429}
        <p class="muted">A short wait and refresh usually clears this.</p>
      {/if}
      <div class="error-actions">
        <a class="button primary" href={appPath('/')}>Return home</a>
        <button type="button" class="button ghost" onclick={() => location.reload()}>
          <RotateCcw size={16} aria-hidden="true" />
          Retry
        </button>
      </div>
    </div>
  </section>
</main>

<style>
  .error-shell {
    min-height: min(68vh, 720px);
    display: grid;
    place-items: center;
    padding-block: 64px;
  }

  .error-panel {
    width: min(100%, 680px);
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 18px;
    padding: clamp(22px, 4vw, 34px);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-lg);
    background: var(--color-card);
    box-shadow: var(--shadow-sm);
  }

  .error-icon {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--color-seal) 45%, transparent);
    border-radius: 999px;
    color: var(--color-seal);
    background: color-mix(in srgb, var(--color-seal) 12%, transparent);
  }

  h1 {
    margin-bottom: 10px;
    font-size: clamp(2rem, 6vw, 3.2rem);
  }

  p {
    max-width: 58ch;
    margin-bottom: 10px;
    color: var(--color-ink-soft);
  }

  .eyebrow {
    margin-bottom: 4px;
    color: var(--color-seal);
    font-family: var(--type-mono);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .error-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 18px;
  }

  .error-actions .button {
    width: auto;
    margin: 0;
  }

  .error-actions button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  @media (max-width: 640px) {
    .error-panel {
      grid-template-columns: 1fr;
    }
  }
</style>
