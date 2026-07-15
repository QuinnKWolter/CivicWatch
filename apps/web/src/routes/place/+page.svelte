<script lang="ts">
  import PanelHeader from '$lib/components/PanelHeader.svelte';
  import SmallMultiplesGrid from '$lib/components/SmallMultiplesGrid.svelte';
  import StateGrid from '$lib/components/StateGrid.svelte';
  import TopicBars from '$lib/components/TopicBars.svelte';
  export let data: any;
  $: topRows = data.matrix.data.slice(0, 22).map((row: any) => ({
    topic: row.topic,
    topicLabel: row.topic_label,
    postCount: row.post_count
  }));
</script>

<section class="container band">
  <h1>Explore a state</h1>
  <p class="muted">Every state's chamber, topic mix, and top voices. The grid is shaded by post volume.</p>
  <PanelHeader title="State volume" caption="A choropleth-like state grid using the current state aggregate." />
  <StateGrid states={data.states.data} maxBlockSize="430px" />
</section>

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
