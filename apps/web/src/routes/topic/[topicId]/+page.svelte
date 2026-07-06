<script lang="ts">
  import Beeswarm from '$lib/components/Beeswarm.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import MiniBars from '$lib/components/MiniBars.svelte';
  import PanelHeader from '$lib/components/PanelHeader.svelte';
  import PartyChamberMatrix from '$lib/components/PartyChamberMatrix.svelte';
  import PostCard from '$lib/components/PostCard.svelte';
  import StateGrid from '$lib/components/StateGrid.svelte';
  import TimeBars from '$lib/components/TimeBars.svelte';
  import { compact, pct } from '$lib/format';
  export let data: any;
  $: topic = data.topic.data ?? {};
  $: states = data.salience.data.map((row: any) => ({
    state: row.state,
    postCount: row.post_count
  }));
  $: topLegislators = [...data.beeswarm.data].sort((a: any, b: any) => b.share - a.share).slice(0, 16);
</script>

<section class="container band">
  <Breadcrumbs items={[{ label: 'Topics', href: '/topic' }, { label: topic.topicLabel }]} />
  <h1>{topic.topicLabel}</h1>
  <div class="grid grid-3">
    <div class="card"><span class="caption">Posts in party-labeled aggregate</span><strong class="number">{compact(topic.postCount)}</strong></div>
    <div class="card"><span class="caption">Engagement</span><strong class="number">{compact(topic.totalEngagement)}</strong></div>
    <div class="card"><span class="caption">Ideology dots</span><strong class="number">{compact(data.beeswarm.data.length)}</strong></div>
  </div>
  <p><a class="button" href="/compare?slots=topic:{topic.topic}">Compare with…</a></p>
</section>

<section class="container split band">
  <TimeBars rows={data.ribbon.data} dateKey="date" valueKey="post_count" label="Topic volume over time" />
  <div class="card">
    <PanelHeader title="State salience" caption="State-level post counts for this topic." source="topic_state_breakdown" count={states.length} />
    <StateGrid {states} />
  </div>
</section>

<section class="container split band">
  <PartyChamberMatrix rows={data.partyChamber.data} />
  <div class="card">
    <PanelHeader title="Adjacent topics" caption="Other high-volume topics in the same corpus context." source="topic_party_breakdown" count={data.adjacent.data.length} />
    <MiniBars rows={data.adjacent.data} labelKey="topic_label" valueKey="post_count" hrefPrefix="/topic/" />
  </div>
</section>

<section class="container band">
  <Beeswarm rows={data.beeswarm.data} />
</section>

<section class="container band">
  <div class="card">
    <PanelHeader title="Most concentrated voices" caption="Legislators with the largest share of their posts on this topic." source="app_legislator_topic" count={topLegislators.length} />
    <table>
      <thead><tr><th>Legislator</th><th>Party</th><th>Ideology</th><th>Share</th></tr></thead>
      <tbody>
        {#each topLegislators as row}
          <tr>
            <td><a href="/who/{row.lid}">{row.name}</a></td>
            <td>{row.party ?? '—'}</td>
            <td class="mono">{row.mrpIdeology.toFixed(3)}</td>
            <td class="mono">{pct(row.share, 1)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<section class="container band">
  <PanelHeader title="Top posts" caption="Highest-engagement posts assigned to this topic." source="posts" count={data.topPosts.data.length} />
  <div class="grid grid-2">
    {#each data.topPosts.data as post}
      <PostCard {post} />
    {/each}
  </div>
</section>

<style>
  .number { display: block; font-size: 1.6rem; margin-top: 6px; }
</style>
