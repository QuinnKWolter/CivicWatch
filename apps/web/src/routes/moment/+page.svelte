<script lang="ts">
  import {
    CalendarDays,
    Clock3,
    RotateCcw,
    Search,
    Tag
  } from 'lucide-svelte';
  import PanelHeader from '$lib/components/PanelHeader.svelte';
  import FilterChips from '$lib/components/FilterChips.svelte';
  import MomentTimeline from '$lib/components/MomentTimeline.svelte';
  import PostExplorer from '$lib/components/PostExplorer.svelte';
  import TopicIcon from '$lib/components/TopicIcon.svelte';
  import { appPath } from '$lib/paths';
  export let data: any;
  $: topics = data.window.data.map((row: any) => ({
    topic: row.topic,
    topicLabel: row.topic_label,
    postCount: row.post_count
  }));
  $: categories = Array.from(
    new Set<string>(data.events.data.map((event: any) => String(event.category)))
  );
  let anchorSearch = '';
  let selectedCategory = 'All';
  $: eventRows = data.events.data ?? [];
  $: categoryOptions = ['All', ...categories];
  $: filteredEvents = eventRows.filter((event: any) => {
    const matchesCategory = selectedCategory === 'All' || event.category === selectedCategory;
    const query = anchorSearch.trim().toLocaleLowerCase('en-US');
    const matchesQuery =
      !query ||
      `${event.name} ${event.category} ${event.startDate} ${event.endDate ?? ''} ${event.contextNote ?? ''}`
        .toLocaleLowerCase('en-US')
        .includes(query);
    return matchesCategory && matchesQuery;
  });

  function anchorWindow(event: any) {
    if (!event.endDate) return Math.min(Math.max(Number(data.width ?? 7), 1), 45);

    const start = new Date(`${event.startDate}T00:00:00`);
    const end = new Date(`${event.endDate}T00:00:00`);
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    return Math.min(Math.max(days || Number(data.width ?? 7), 1), 45);
  }

  function anchorHref(event: any) {
    const params = new URLSearchParams({
      from: event.startDate,
      to: event.endDate ?? shiftDate(event.startDate, Math.max(0, anchorWindow(event) - 1))
    });
    if (data.context.topic) params.set('topic', data.context.topic);
    if (data.context.state) params.set('state', data.context.state);
    if (data.context.party) params.set('party', data.context.party);
    return `/moment?${params.toString()}`;
  }

  function dateRange(event: any) {
    return event.endDate && event.endDate !== event.startDate
      ? `${event.startDate} to ${event.endDate}`
      : event.startDate;
  }

  function shiftDate(date: string, days: number) {
    const value = new Date(`${date}T00:00:00`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }

  $: windowWidth = Math.min(Math.max(Number(data.width ?? 7), 1), 45);
  $: windowFilters = {
    from: data.from ?? shiftDate(data.date, -windowWidth),
    to: data.to ?? shiftDate(data.date, windowWidth),
    topic: data.context.topic,
    state: data.context.state,
    party: data.context.party
  };
  $: maxTopicPosts = Math.max(1, ...topics.map((topic: any) => Number(topic.postCount) || 0));
  $: timelineEvents = data.events.data.map((event: any) => ({ ...event, href: anchorHref(event) }));
</script>

<section class="container band">
  <h1>Revisit a moment</h1>
  <p class="muted">Shape a window, trace its daily pulse, and move from a surge to the people and posts that made it.</p>
  <FilterChips filters={data.inheritedFilters} clearHref={appPath(data.clearContextHref)} />
  <form class="moment-controls" method="get" aria-label="Moment window controls">
    <label class="moment-field">
      <span><CalendarDays size={15} aria-hidden="true" /> From</span>
      <input class="field" type="date" name="from" value={windowFilters.from} min="2020-01-01" max="2025-12-31" />
    </label>

    <label class="moment-field">
      <span><Clock3 size={15} aria-hidden="true" /> To</span>
      <input class="field" type="date" name="to" value={windowFilters.to} min="2020-01-01" max="2025-12-31" />
    </label>

    <label class="moment-field"><span>Topic</span><select class="field" name="topic"><option value="">All topics</option>{#each data.topics.data as option}<option value={option.topic} selected={String(option.topic) === data.context.topic}>{option.topicLabel}</option>{/each}</select></label>
    <label class="moment-field compact"><span>State</span><input class="field" name="state" value={data.context.state ?? ''} maxlength="2" placeholder="All" /></label>
    <label class="moment-field"><span>Party</span><select class="field" name="party"><option value="">All parties</option><option value="Democratic" selected={data.context.party === 'Democratic'}>Democratic</option><option value="Republican" selected={data.context.party === 'Republican'}>Republican</option></select></label>

    <button type="submit">
      <RotateCcw size={16} aria-hidden="true" />
      Update
    </button>
  </form>
</section>

<section class="container band">
  <MomentTimeline rows={data.daily.data} featuredPosts={data.topPosts.data} events={timelineEvents} showEvents={data.overview} bucket={data.bucket} context={data.context} />
</section>

<section class="container moment-layout band">
  <div class="card topic-mix-card">
    <PanelHeader title="Window topic mix" caption="Topic counts inside the selected date window." source="posts" count={data.window.data.length} />
    <div class="topic-array">
      {#each topics as item}
        <a href={appPath(`/topic/${item.topic}`)} class="topic-row">
          <TopicIcon label={item.topicLabel} size={20} />
          <span class="topic-copy"><strong>{item.topicLabel}</strong><i><b style={`width:${Math.max(2, Number(item.postCount) / maxTopicPosts * 100)}%`}></b></i></span>
          <span class="topic-count">{Number(item.postCount).toLocaleString()}</span>
        </a>
      {/each}
    </div>
  </div>

  <div class="card anchors-card">
    <PanelHeader title="Curated anchors" caption="Search, filter, and apply an event window." source="events.ts" count={filteredEvents.length} />
    <div class="anchor-tools">
      <label class="anchor-search">
        <Search size={16} aria-hidden="true" />
        <span class="sr-only">Search curated anchors</span>
        <input bind:value={anchorSearch} type="search" placeholder="Search anchors" />
      </label>

      <div class="event-chips" aria-label="Event categories">
        {#each categoryOptions as category}
          <button
            type="button"
            class:active={selectedCategory === category}
            onclick={() => (selectedCategory = category)}
          >
            {#if category !== 'All'}
              <Tag size={13} aria-hidden="true" />
            {/if}
            {category}
          </button>
        {/each}
      </div>
    </div>

    <div class="anchor-list">
      {#each filteredEvents as event}
        <a class:active={event.startDate === data.date} class="anchor-row" href={anchorHref(event)}>
          <span class="anchor-date">{dateRange(event)}</span>
          <span class="anchor-main">
            <strong>{event.name}</strong>
            {#if event.contextNote}
              <span>{event.contextNote}</span>
            {/if}
          </span>
          <span class="anchor-category">{event.category}</span>
        </a>
      {:else}
        <p class="empty-state">No anchors match the current filters.</p>
      {/each}
    </div>
  </div>
</section>

<section class="container band">
  <PostExplorer
    title="Post explorer"
    caption="Browse high-engagement posts, recent posts, and representative samples inside this date window."
    source="posts"
    initialTopPosts={data.topPosts.data}
    filters={windowFilters}
  />
</section>

<style>
  .moment-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: end;
    margin-top: 18px;
  }
  .moment-field.compact { max-width: 90px; }

  .topic-array { display:grid; gap:5px; }
  .topic-row { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:9px; align-items:center; padding:7px 8px; color:inherit; text-decoration:none; border-radius:5px; }
  .topic-row:hover { background:var(--color-hover); }
  .topic-copy { display:grid; gap:5px; min-width:0; }
  .topic-copy strong { overflow:hidden; font-size:.78rem; text-overflow:ellipsis; white-space:nowrap; }
  .topic-copy i { display:block; height:4px; overflow:hidden; background:var(--color-track); border-radius:999px; }
  .topic-copy b { display:block; height:100%; background:var(--color-seal); border-radius:inherit; }
  .topic-count { color:var(--color-mute); font-family:var(--font-mono); font-size:.7rem; font-variant-numeric:tabular-nums; }

  .moment-field {
    display: grid;
    gap: 5px;
    min-width: min(100%, 160px);
    margin: 0;
  }

  .moment-field > span {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    color: var(--color-mute);
    font-size: 0.74rem;
    font-weight: 700;
    letter-spacing: 0.055em;
    line-height: 1rem;
    text-transform: uppercase;
  }

  .moment-field .field {
    width: 100%;
    min-height: 40px;
  }

  .moment-controls button {
    min-height: 40px;
  }

  .moment-layout {
    display: grid;
    grid-template-columns: minmax(260px, 0.8fr) minmax(360px, 1.2fr);
    gap: var(--space-4, 20px);
    align-items: start;
  }

  .topic-mix-card,
  .anchors-card {
    min-width: 0;
  }

  .anchor-tools {
    display: grid;
    gap: 12px;
    margin-bottom: 14px;
  }

  .anchor-search {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 0 12px;
    border: 1px solid var(--color-rule);
    border-radius: 999px;
    color: var(--color-mute);
    background: var(--color-elevated);
  }

  .anchor-search input {
    width: 100%;
    min-width: 0;
    min-height: 40px;
    border: 0;
    outline: 0;
    color: var(--color-text);
    background: transparent;
  }

  .event-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .event-chips button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1px solid var(--color-rule);
    border-radius: 999px;
    padding: 5px 9px;
    color: var(--color-mute);
    background: var(--color-elevated);
    font: inherit;
    font-size: 0.82rem;
    line-height: 1.1;
    cursor: pointer;
    transition:
      border-color 160ms ease,
      color 160ms ease,
      background 160ms ease;
  }

  .event-chips button:hover,
  .event-chips button.active {
    border-color: color-mix(in srgb, var(--color-accent) 55%, var(--color-rule));
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-accent) 12%, var(--color-elevated));
  }

  .anchor-list {
    display: grid;
    gap: 8px;
    max-height: 520px;
    overflow: auto;
    padding-right: 4px;
  }

  .anchor-row {
    display: grid;
    grid-template-columns: minmax(102px, 0.28fr) minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    min-width: 0;
    padding: 12px;
    border: 1px solid var(--color-rule);
    border-radius: 8px;
    color: var(--color-text);
    background: color-mix(in srgb, var(--color-elevated) 78%, transparent);
    text-decoration: none;
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      background 160ms ease;
  }

  .anchor-row:hover,
  .anchor-row.active {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--color-accent) 48%, var(--color-rule));
    background: color-mix(in srgb, var(--color-accent) 10%, var(--color-elevated));
  }

  .anchor-date,
  .anchor-category {
    color: var(--color-mute);
    font-family: var(--font-mono);
    font-size: 0.77rem;
    line-height: 1.25;
  }

  .anchor-main {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .anchor-main strong,
  .anchor-main span {
    overflow-wrap: anywhere;
  }

  .anchor-main span {
    color: var(--color-mute);
    font-size: 0.86rem;
    line-height: 1.35;
  }

  .anchor-category {
    justify-self: end;
    max-width: 140px;
    padding: 4px 7px;
    border: 1px solid var(--color-rule);
    border-radius: 999px;
    background: var(--color-bg);
    text-align: center;
    white-space: normal;
  }

  .empty-state {
    margin: 0;
    padding: 16px;
    border: 1px dashed var(--color-rule);
    border-radius: 8px;
    color: var(--color-mute);
  }

  :global(.sr-only) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 520px) {
    .moment-controls {
      align-items: stretch;
    }

    .moment-field,
    .moment-controls button {
      width: 100%;
    }
  }

  @media (max-width: 900px) {
    .moment-layout {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 640px) {
    .anchor-row {
      grid-template-columns: minmax(0, 1fr);
      gap: 7px;
    }

    .anchor-category {
      justify-self: start;
    }
  }
</style>
