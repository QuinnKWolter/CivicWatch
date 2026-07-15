<script lang="ts">
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import ChamberView from '$lib/components/ChamberView.svelte';
  import PanelHeader from '$lib/components/PanelHeader.svelte';
  import PostExplorer from '$lib/components/PostExplorer.svelte';
  import TimeBars from '$lib/components/TimeBars.svelte';
  import TopicBars from '$lib/components/TopicBars.svelte';
  import { compact } from '$lib/format';
  export let data: any;
  $: summary = data.summary.data ?? {};
  $: topics = data.topics.data.map((row: any) => ({
    topic: row.topic,
    topicLabel: row.topic_label,
    postCount: row.post_count
  }));
</script>

<section class="container band">
  <Breadcrumbs items={[{ label: 'Places', href: '/place' }, { label: data.state }]} />
  <h1>{summary.stateName ?? data.state}</h1>
  <div class="grid grid-4">
    <div class="card"><span class="caption">Legislators</span><strong class="number">{compact(summary.legislators)}</strong></div>
    <div class="card"><span class="caption">Posts</span><strong class="number">{compact(summary.posts)}</strong></div>
    <div class="card"><span class="caption">Democratic</span><strong class="number">{compact(summary.democratic)}</strong></div>
    <div class="card"><span class="caption">Republican</span><strong class="number">{compact(summary.republican)}</strong></div>
  </div>
  <p class="compare-action"><a class="button" href="/compare?slots=state:{data.state}">Compare with…</a></p>
</section>

<section class="container split band">
  <div class="card">
    <PanelHeader title="Topic mix" caption="State speech by topic, sorted by volume." source="topic_state_breakdown" count={topics.length} />
    <TopicBars {topics} />
  </div>
  <TimeBars rows={data.trend.data} dateKey="month" valueKey="post_count" label="State trend" />
</section>

<section class="container split band">
  <ChamberView legislators={data.chamber.data} />
  <div class="state-posts">
    <PostExplorer
      title="Post explorer"
      caption="Switch between high-engagement posts, recent posts, and representative samples from this state."
      source="posts + legislators"
      initialTopPosts={data.topPosts.data}
      filters={{ state: data.state }}
      pageSize={6}
      sampleSize={4}
    />
  </div>
</section>

<style>
  .number { display: block; font-size: 1.6rem; margin-top: 6px; }
  .state-posts {
    display: grid;
    gap: 12px;
    min-width: min(100%, 340px);
  }
</style>
