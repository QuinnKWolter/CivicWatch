<script lang="ts">
  import MiniBars from '$lib/components/MiniBars.svelte';
  import NoResultsPanel from '$lib/components/NoResultsPanel.svelte';
  import PanelHeader from '$lib/components/PanelHeader.svelte';
  import PostCard from '$lib/components/PostCard.svelte';
  import { compact } from '$lib/format';
  export let data: any;
  const examples = ['topic:20,state:TX', 'topic:20,topic:3,state:CA,state:TX', 'state:NY,state:TX,state:MN'];
</script>

<section class="container band">
  <h1>Compare</h1>
  <p class="muted">Compare supports up to four slots. Use `kind:id`, for example `topic:20,state:TX,legislator:2190582458`.</p>
  <form class="toolbar" method="get">
    <input class="field" name="slots" value={data.slots} size="52" />
    <button>Compare</button>
  </form>
  <div class="examples" aria-label="Comparison examples">
    {#each examples as example}
      <a href="/compare?slots={example}">{example}</a>
    {/each}
  </div>
  {#if data.compare.data.length === 0}
    <NoResultsPanel title="No comparison slots loaded" message="Use kind:id values such as topic:20, state:TX, or legislator:2190582458." href="/compare?slots=topic:20,state:TX" action="Load an example" />
  {/if}
  <div class="grid grid-4 compare-slots">
    {#each data.compare.data as slot}
      <article class="card">
        <p class="caption">{slot.kind}</p>
        <h2><a href={slot.href}>{slot.label}</a></h2>
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
    <div class="grid grid-4">
      {#each data.compare.data as slot}
        <article>
          <h3>{slot.label}</h3>
          <div class="grid">
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
  .examples { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .examples a { border: 1px solid var(--color-rule); border-radius: 999px; padding: 5px 9px; color: var(--color-mute); text-decoration: none; background: var(--color-elevated); font-size: .84rem; }
  .examples a:hover { border-color: var(--color-seal); color: var(--color-seal); }
  dl { display: grid; grid-template-columns: 96px 1fr; gap: 6px 10px; }
  dt { color: var(--color-mute); }
  dd { margin: 0; }
</style>
