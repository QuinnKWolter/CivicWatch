<script lang="ts">
  import { GitCompareArrows, RotateCcw, X } from 'lucide-svelte';
  import MiniBars from '$lib/components/MiniBars.svelte';
  import NoResultsPanel from '$lib/components/NoResultsPanel.svelte';
  import PanelHeader from '$lib/components/PanelHeader.svelte';
  import PostCard from '$lib/components/PostCard.svelte';
  import { compact } from '$lib/format';
  import { appPath } from '$lib/paths';
  export let data: any;
  const examples = ['topic:20,state:TX', 'topic:20,topic:3,state:CA,state:TX', 'state:NY,state:TX,state:MN'];
</script>

<section class="container band">
  <h1>Compare</h1>
  <p class="muted">Compare supports up to four slots. Use `kind:id`, for example `topic:20,state:TX,legislator:2190582458`.</p>
  <form class="compare-filter" method="get" aria-label="Comparison filters">
    <label class="compare-field">
      <span>Comparison slots</span>
      <span class="input-shell">
        <input class="field" name="slots" value={data.slots} size="52" placeholder="topic:20,state:TX" />
        <a class="clear-action" href={appPath('/compare?slots=')} aria-label="Clear comparison slots">
          <X size={16} aria-hidden="true" />
          <span>Clear</span>
        </a>
      </span>
    </label>
    <div class="compare-actions">
      <button type="submit">
        <GitCompareArrows size={16} aria-hidden="true" />
        Compare
      </button>
    </div>
  </form>
  <div class="example-block" aria-label="Comparison examples">
    <p class="examples-label">
      <RotateCcw size={14} aria-hidden="true" />
      Examples
    </p>
    <div class="examples">
    {#each examples as example}
      <a href={appPath(`/compare?slots=${example}`)}>{example}</a>
    {/each}
    </div>
  </div>
  {#if data.compare.data.length === 0}
    <NoResultsPanel title="No comparison slots loaded" message="Use kind:id values such as topic:20, state:TX, or legislator:2190582458." href={appPath('/compare?slots=topic:20,state:TX')} action="Load an example" />
  {/if}
  <div class="grid grid-4 compare-slots">
    {#each data.compare.data as slot}
      <article class="card">
        <p class="caption">{slot.kind}</p>
        <h2><a href={appPath(slot.href)}>{slot.label}</a></h2>
        <dl>
          <dt>Posts</dt><dd class="mono">{compact(slot.metrics.posts)}</dd>
          <dt>Engagement</dt><dd class="mono">{compact(slot.metrics.engagement)}</dd>
          {#if slot.metrics.party}<dt>Party</dt><dd>{slot.metrics.party}</dd>{/if}
          {#if slot.metrics.state}<dt>State</dt><dd>{slot.metrics.state}</dd>{/if}
        </dl>
      </article>
    {/each}
  </div>

  <section class="band">
    <PanelHeader title="Topic mix" caption="Equivalent topic-mix panels on a shared format for each selected entity." source="compare endpoint" count={data.compare.data.length} />
    <div class="grid grid-4">
      {#each data.compare.data as slot}
        <article class="card">
          <h3>{slot.label}</h3>
          <MiniBars rows={slot.topicMix} hrefPrefix="/topic/" />
        </article>
      {/each}
    </div>
  </section>

  <section class="band">
    <PanelHeader title="Top posts" caption="Per-entity examples of the posts behind each comparison." source="posts" />
    <div class="comparison-post-groups">
      {#each data.compare.data as slot}
        <article class="post-group card">
          <h3>{slot.label}</h3>
          <div class="post-stack">
            {#each slot.topPosts as post}
              <PostCard {post} />
            {/each}
          </div>
        </article>
      {/each}
    </div>
  </section>
</section>

<style>
  .compare-slots { margin-top: 16px; }
  .compare-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: end;
    margin-top: 16px;
  }
  .compare-field {
    display: grid;
    gap: 5px;
    min-width: min(100%, 360px);
    flex: 1 1 520px;
    margin: 0;
  }
  .compare-field span,
  .examples-label {
    color: var(--color-mute);
    font-size: 0.74rem;
    font-weight: 700;
    letter-spacing: 0.055em;
    line-height: 1rem;
    text-transform: uppercase;
  }
  .compare-field .field {
    width: 100%;
    padding-right: 48px;
  }
  .input-shell {
    position: relative;
    display: block;
    min-width: 0;
  }
  .compare-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .clear-action {
    position: absolute;
    top: 50%;
    right: 5px;
    display: inline-flex;
    width: 32px;
    min-height: 30px;
    gap: 6px;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 0 8px;
    color: var(--color-error, #b6332c);
    text-decoration: none;
    background: color-mix(in srgb, var(--color-error, #b6332c) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-error, #b6332c) 26%, transparent);
    border-radius: 999px;
    box-shadow: none;
    transform: translateY(-50%);
    transition:
      width 180ms ease,
      background-color 140ms ease,
      border-color 140ms ease,
      color 140ms ease;
  }
  .clear-action span {
    max-width: 0;
    opacity: 0;
    overflow: hidden;
    white-space: nowrap;
    transition:
      max-width 180ms ease,
      opacity 140ms ease;
  }
  .clear-action:hover,
  .clear-action:focus-visible,
  .clear-action:active {
    width: 82px;
    color: var(--color-error, #b6332c);
    background: color-mix(in srgb, var(--color-error, #b6332c) 14%, var(--color-card));
    border-color: color-mix(in srgb, var(--color-error, #b6332c) 42%, var(--color-rule));
  }
  .clear-action:hover span,
  .clear-action:focus-visible span,
  .clear-action:active span {
    max-width: 46px;
    opacity: 1;
  }
  .example-block {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }
  .examples-label {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    margin: 0;
  }
  .examples { display: flex; flex-wrap: wrap; gap: 8px; }
  .examples a { border: 1px solid var(--color-rule); border-radius: 999px; padding: 5px 9px; color: var(--color-mute); text-decoration: none; background: var(--color-elevated); font-size: .84rem; }
  .examples a:hover { border-color: var(--color-seal); color: var(--color-seal); }
  dl { display: grid; grid-template-columns: 96px 1fr; gap: 6px 10px; }
  dt { color: var(--color-mute); }
  dd { margin: 0; }
  .comparison-post-groups {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
    gap: 16px;
    align-items: start;
  }
  .post-group {
    display: grid;
    gap: 12px;
    min-width: 0;
  }
  .post-group h3 { margin: 0; }
  .post-stack {
    display: grid;
    gap: 12px;
    min-width: 0;
  }
  @media (max-width: 620px) {
    .compare-actions {
      width: 100%;
    }

    .compare-actions > button {
      width: 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .clear-action,
    .clear-action span {
      transition: none;
    }
  }
</style>
