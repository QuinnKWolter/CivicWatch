<script lang="ts">
  import { env } from '$env/dynamic/public';
  import { onDestroy } from 'svelte';
  import PanelHeader from '$lib/components/PanelHeader.svelte';
  import SmallMultiplesGrid from '$lib/components/SmallMultiplesGrid.svelte';
  import StateGrid from '$lib/components/StateGrid.svelte';
  import StateNormalizationControl from '$lib/components/StateNormalizationControl.svelte';
  import StatePartyControl from '$lib/components/StatePartyControl.svelte';
  import StateTileMap from '$lib/components/StateTileMap.svelte';
  import StateTopicControl from '$lib/components/StateTopicControl.svelte';
  import TopicBars from '$lib/components/TopicBars.svelte';
  export let data: any;
  let stateView: 'map' | 'grid' = 'map';
  let normalizationMode: 'none' | 'population' | 'legislators' = 'none';
  let partyMode: 'both' | 'democratic' | 'republican' = 'both';
  let colorMode: 'volume' | 'contribution' = 'volume';
  let selectedTopic = 'all';
  let loadedTopic = 'all';
  let stateRows = data.states.data;
  let topicLoading = false;
  let topicError = '';
  let topicController: AbortController | undefined;
  let topicRequestId = 0;
  const apiBase = (env.PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1').replace(/\/+$/, '');
  $: topRows = data.matrix.data.slice(0, 22).map((row: any) => ({
    topic: row.topic,
    topicLabel: row.topic_label,
    postCount: row.post_count
  }));
  $: selectedTopicLabel = selectedTopic === 'all'
    ? 'all topics'
    : data.topics.data.find((topic: any) => String(topic.topic) === selectedTopic)?.topicLabel ?? 'the selected topic';

  async function selectTopic(topic: string) {
    const requestId = ++topicRequestId;
    selectedTopic = topic;
    topicController?.abort();
    topicController = new AbortController();
    topicLoading = true;
    topicError = '';
    const params = new URLSearchParams();
    if (topic !== 'all') params.set('topic', topic);

    try {
      const response = await fetch(`${apiBase}/states${params.size ? `?${params}` : ''}`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
        signal: topicController.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload?.data)) throw new Error('Invalid state response');
      if (requestId !== topicRequestId) return;
      stateRows = payload.data;
      loadedTopic = topic;
    } catch (error) {
      if ((error as Error).name !== 'AbortError' && requestId === topicRequestId) {
        topicError = 'Could not update the state topic filter. Try again.';
        selectedTopic = loadedTopic;
      }
    } finally {
      if (requestId === topicRequestId) topicLoading = false;
    }
  }

  onDestroy(() => topicController?.abort());

</script>

<section class="container band">
  <h1>Explore a state</h1>
  <p class="muted">Every state's chamber, topic mix, and top voices. Cells are shaded by post volume.</p>
  <div class="state-view-heading">
    <PanelHeader
      title="State volume"
      caption={stateView === 'map'
        ? `A geographic tile map of state activity for ${selectedTopicLabel}.`
        : `State activity for ${selectedTopicLabel}, ordered as a sortable card grid.`}
    />
    <div class="view-toggle" aria-label="State volume view">
      <button type="button" class:active={stateView === 'map'} aria-pressed={stateView === 'map'} onclick={() => (stateView = 'map')}>Map</button>
      <button type="button" class:active={stateView === 'grid'} aria-pressed={stateView === 'grid'} onclick={() => (stateView = 'grid')}>Grid</button>
    </div>
  </div>
  <div class="state-data-controls">
    <StateTopicControl
      topics={data.topics.data}
      bind:value={selectedTopic}
      loading={topicLoading}
      onselect={selectTopic}
    />
    <StateNormalizationControl bind:value={normalizationMode} />
    <StatePartyControl bind:party={partyMode} bind:colorMode />
  </div>
  {#if stateView === 'map'}
    <StateTileMap
      states={stateRows}
      normalizeByPopulation={normalizationMode === 'population'}
      normalizeByLegislators={normalizationMode === 'legislators'}
      party={partyMode}
      {colorMode}
    />
  {:else}
    <StateGrid
      states={stateRows}
      maxBlockSize="430px"
      normalizeByPopulation={normalizationMode === 'population'}
      normalizeByLegislators={normalizationMode === 'legislators'}
      party={partyMode}
      {colorMode}
    />
  {/if}
  {#if topicError}<p class="topic-error" role="alert">{topicError}</p>{/if}
</section>

<style>
  .state-view-heading { display: flex; gap: 16px; align-items: flex-start; justify-content: space-between; }
  .view-toggle {
    display: inline-flex;
    flex: 0 0 auto;
    gap: 3px;
    padding: 3px;
    background: color-mix(in srgb, var(--color-elevated, var(--color-card, #fff)) 86%, transparent);
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 999px;
  }
  .view-toggle button {
    display: grid;
    place-items: center;
    height: 28px;
    min-height: 28px;
    padding: 0 11px;
    margin: 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.74rem;
    font-weight: 650;
    line-height: 1;
    background: transparent;
    border: 0;
    border-radius: 999px;
    box-shadow: none;
  }
  .view-toggle button:hover {
    color: var(--color-seal, #8a5a1a);
    background: var(--color-hover, rgb(0 0 0 / 5%));
    box-shadow: none;
    transform: none;
  }
  .view-toggle button.active {
    color: var(--color-ink, #1a1917);
    background: var(--color-card, #fff);
    box-shadow: var(--shadow-sm, 0 1px 2px rgb(0 0 0 / 8%));
  }
  .view-toggle button:focus-visible { outline: 2px solid var(--color-seal, #8a5a1a); outline-offset: 2px; }
  .state-data-controls {
    display: grid;
    gap: 8px;
    padding-block: 2px 12px;
  }
  .topic-error {
    margin: -4px 0 10px;
    color: var(--color-danger, #9d332f);
    font-size: 0.72rem;
  }
  @media (max-width: 620px) { .state-view-heading { display: grid; gap: 8px; } }
</style>

<section class="container band">
  <div class="card">
    <PanelHeader title="Fifty-state topic mix" caption="One compact topic-distribution chart per state; Uncategorized remains part of the stack." source="topic_state_breakdown" count={data.matrix.data.length} />
    <SmallMultiplesGrid rows={data.matrix.data} />
  </div>
</section>

<section class="container split band">
  <div class="card">
    <PanelHeader title="State-by-topic table" caption="The numerical data behind the small multiples." source="topic_state_breakdown" count={data.matrix.data.length} />
    <table>
      <thead><tr><th>State</th><th>Topic</th><th>Posts</th></tr></thead>
      <tbody>
        {#each data.matrix.data.slice(0, 180) as row}
          <tr><td>{row.state}</td><td>{row.topic_label}</td><td class="mono">{row.post_count}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
  <div class="card">
    <PanelHeader title="First state sample" caption="A quick read on the first aggregate slice." />
    <TopicBars topics={topRows} />
  </div>
</section>
