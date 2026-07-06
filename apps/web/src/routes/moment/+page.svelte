<script lang="ts">
  import FilterChips from '$lib/components/FilterChips.svelte';
  import PanelHeader from '$lib/components/PanelHeader.svelte';
  import PostCard from '$lib/components/PostCard.svelte';
  import TimeBars from '$lib/components/TimeBars.svelte';
  import TopicBars from '$lib/components/TopicBars.svelte';
  export let data: any;
  $: topics = data.window.data.map((row: any) => ({
    topic: row.topic,
    topicLabel: row.topic_label,
    postCount: row.post_count
  }));
  $: categories = [...new Set(data.events.data.map((event: any) => event.category))];
  $: filters = [{ label: 'Date', value: data.date }, { label: 'Window', value: `${data.width} days` }];
</script>

<section class="container band">
  <h1>Revisit a moment</h1>
  <p class="muted">Drag the marker across the timeline. For this local build, date and window are URL-driven and server-rendered.</p>
  <FilterChips {filters} clearHref="/moment" />
  <form class="toolbar" method="get">
    <input class="field" type="date" name="date" value={data.date} min="2020-01-01" max="2024-12-31" />
    <input class="field" type="number" name="width" value={data.width} min="1" max="45" />
    <button>Update</button>
  </form>
</section>

<section class="container split band">
  <div class="card">
    <PanelHeader title="Window topic mix" caption="Topic counts inside the selected date window." source="posts" count={data.window.data.length} />
    <TopicBars {topics} />
  </div>
  <div class="card">
    <PanelHeader title="Curated anchors" caption="Event context available for timeline and window interpretation." source="events.ts" count={data.events.data.length} />
    <div class="event-chips" aria-label="Event categories">
      {#each categories as category}
        <span>{category}</span>
      {/each}
    </div>
    <table>
      <thead><tr><th>Date</th><th>Event</th><th>Category</th></tr></thead>
      <tbody>
        {#each data.events.data as event}
          <tr><td>{event.startDate}</td><td>{event.name}</td><td>{event.category}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<section class="container band">
  <TimeBars rows={data.window.data} dateKey="topic" valueKey="post_count" label="Window volume by topic" />
</section>

<section class="container band">
  <PanelHeader title="Top posts in window" caption="Highest-engagement posts near the selected date." source="posts" count={data.topPosts.data.length} />
  <div class="grid grid-2">
    {#each data.topPosts.data as post}
      <PostCard {post} />
    {/each}
  </div>
</section>

<style>
  .event-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .event-chips span {
    border: 1px solid var(--color-rule);
    border-radius: 999px;
    padding: 4px 8px;
    color: var(--color-mute);
    background: var(--color-elevated);
    font-size: .82rem;
  }
</style>
