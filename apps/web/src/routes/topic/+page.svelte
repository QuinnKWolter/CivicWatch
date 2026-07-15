<script lang="ts">
  import PanelHeader from '$lib/components/PanelHeader.svelte';
  import TopicIcon from '$lib/components/TopicIcon.svelte';
  import TopicRibbon from '$lib/components/TopicRibbon.svelte';
  import TopicBars from '$lib/components/TopicBars.svelte';
  import { compact } from '$lib/format';
  export let data: any;
</script>

<section class="container band">
  <h1>Follow an issue</h1>
  <p class="muted">22 categories, five years, one glance. Topic 999 is labeled Uncategorized and remains visible.</p>
  <PanelHeader title="Topic tiles" caption="Sortable-by-volume tiles for all topic categories in the snapshot." source="topic_party_breakdown" count={data.topics.data.length} />
  <div class="grid grid-3">
    {#each data.topics.data as topic}
      <a class="chip" href="/topic/{topic.topic}">
        <strong class="topic-chip-title">
          <TopicIcon label={topic.topicLabel} size={19} />
          <span>{topic.topicLabel}</span>
        </strong>
        <span class="mono">{compact(topic.postCount)} posts</span>
      </a>
    {/each}
  </div>
</section>

<style>
  .topic-chip-title {
    display: flex;
    gap: 10px;
    align-items: center;
    min-width: 0;
  }

  .topic-chip-title > span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>

<section class="container split band">
  <TopicRibbon rows={data.ribbon.data} />
  <div class="card">
    <PanelHeader title="Topic volume" caption="Aggregate topic volume across the corpus." source="topic_party_breakdown" count={data.topics.data.length} />
    <TopicBars topics={data.topics.data} />
  </div>
  <div class="card">
    <PanelHeader title="Daily aggregate sample" caption="First rows from the materialized fast path for the ribbon." source="topic_engagement_daily" count={data.ribbon.data.length} />
    <table>
      <thead><tr><th>Date</th><th>Topic</th><th>Posts</th></tr></thead>
      <tbody>
        {#each data.ribbon.data.slice(0, 80) as row}
          <tr><td>{row.date}</td><td>{row.topic_label}</td><td class="mono">{row.post_count}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
