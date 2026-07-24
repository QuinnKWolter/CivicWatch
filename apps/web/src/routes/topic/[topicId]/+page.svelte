<script lang="ts">
  import { env } from '$env/dynamic/public';
  import { onDestroy } from 'svelte';
  import Beeswarm from '$lib/components/Beeswarm.svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import MiniBars from '$lib/components/MiniBars.svelte';
  import PanelHeader from '$lib/components/PanelHeader.svelte';
  import PartyChamberMatrix from '$lib/components/PartyChamberMatrix.svelte';
  import PostExplorer from '$lib/components/PostExplorer.svelte';
  import StateGrid from '$lib/components/StateGrid.svelte';
  import StateNormalizationControl from '$lib/components/StateNormalizationControl.svelte';
  import StatePartyControl from '$lib/components/StatePartyControl.svelte';
  import StateTopicControl from '$lib/components/StateTopicControl.svelte';
  import TimeBars from '$lib/components/TimeBars.svelte';
  import TopicIcon from '$lib/components/TopicIcon.svelte';
  import { compact, pct } from '$lib/format';
  import { appPath } from '$lib/paths';
  import { appendDrilldownContext } from '$lib/drilldown';
  export let data: any;
  let stateNormalizationMode: 'none' | 'population' | 'legislators' = 'none';
  let statePartyMode: 'both' | 'democratic' | 'republican' = 'both';
  let stateColorMode: 'volume' | 'contribution' = 'volume';
  let salienceTopic = String(data.topic.data?.topic ?? 'all');
  let loadedSalienceTopic = salienceTopic;
  let salienceRows = data.salience.data;
  let salienceLoading = false;
  let salienceError = '';
  let salienceController: AbortController | undefined;
  let salienceRequestId = 0;
  const apiBase = (env.PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1').replace(/\/+$/, '');
  $: topic = data.topic.data ?? {};
  $: states = salienceRows.map((row: any) => ({
    state: row.state,
    postCount: row.postCount ?? row.post_count,
    legislatorCount: row.legislatorCount ?? row.legislator_count,
    democraticPostCount: row.democraticPostCount ?? row.democratic_post_count,
    republicanPostCount: row.republicanPostCount ?? row.republican_post_count,
    democraticLegislatorCount: row.democraticLegislatorCount ?? row.democratic_legislator_count,
    republicanLegislatorCount: row.republicanLegislatorCount ?? row.republican_legislator_count
  }));
  $: concentratedLegislators = [...data.beeswarm.data].sort((a: any, b: any) => b.share - a.share);
  $: salienceTopicLabel = salienceTopic === 'all'
    ? 'all topics'
    : data.topics.data.find((item: any) => String(item.topic) === salienceTopic)?.topicLabel ?? 'the selected topic';

  async function selectSalienceTopic(nextTopic: string) {
    const requestId = ++salienceRequestId;
    salienceTopic = nextTopic;
    salienceController?.abort();
    salienceController = new AbortController();
    salienceLoading = true;
    salienceError = '';
    const path = nextTopic === 'all'
      ? '/states'
      : `/topics/${encodeURIComponent(nextTopic)}/state-salience`;
    try {
      const response = await fetch(`${apiBase}${path}`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
        signal: salienceController.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload?.data)) throw new Error('Invalid state response');
      if (requestId !== salienceRequestId) return;
      salienceRows = payload.data;
      loadedSalienceTopic = nextTopic;
    } catch (error) {
      if ((error as Error).name !== 'AbortError' && requestId === salienceRequestId) {
        salienceError = 'Could not update State Salience. Try again.';
        salienceTopic = loadedSalienceTopic;
      }
    } finally {
      if (requestId === salienceRequestId) salienceLoading = false;
    }
  }

  onDestroy(() => salienceController?.abort());
</script>

<section class="container band">
  <Breadcrumbs items={[{ label: 'Topics', href: '/topic' }, { label: topic.topicLabel }]} />
  <h1 class="topic-heading">
    <TopicIcon label={topic.topicLabel} size={32} />
    <span>{topic.topicLabel}</span>
  </h1>
  <div class="grid grid-3">
    <div class="card"><span class="caption">Posts in party-labeled aggregate</span><strong class="number">{compact(topic.postCount)}</strong></div>
    <div class="card"><span class="caption">Engagement</span><strong class="number">{compact(topic.totalEngagement)}</strong></div>
    <div class="card"><span class="caption">Ideology dots</span><strong class="number">{compact(data.beeswarm.data.length)}</strong></div>
  </div>
  <p class="compare-action"><a class="button" href={appPath(`/compare?slots=topic:${topic.topic}`)}>Compare with…</a></p>
</section>

<section class="container split band">
  <TimeBars rows={data.ribbon.data} dateKey="date" valueKey="post_count" label="Topic volume over time" drilldownContext={{ topic: String(topic.topic) }} />
  <div class="card">
    <PanelHeader title="State salience" caption={`Where ${salienceTopicLabel} appears most often across states, measured by post counts.`} />
    <div class="salience-normalization">
      <StateTopicControl
        topics={data.topics.data}
        bind:value={salienceTopic}
        loading={salienceLoading}
        onselect={selectSalienceTopic}
      />
      <StateNormalizationControl bind:value={stateNormalizationMode} compact />
      <StatePartyControl bind:party={statePartyMode} bind:colorMode={stateColorMode} compact />
    </div>
    <StateGrid
      {states}
      maxBlockSize="360px"
      normalizeByPopulation={stateNormalizationMode === 'population'}
      normalizeByLegislators={stateNormalizationMode === 'legislators'}
      party={statePartyMode}
      colorMode={stateColorMode}
      drilldownContext={{
        topic: salienceTopic === 'all' ? undefined : salienceTopic,
        party: statePartyMode === 'democratic' ? 'Democratic' : statePartyMode === 'republican' ? 'Republican' : undefined,
        normalize: stateNormalizationMode === 'none' ? undefined : stateNormalizationMode,
        color: stateColorMode === 'contribution' ? 'contribution' : undefined
      }}
    />
    {#if salienceError}<p class="salience-error" role="alert">{salienceError}</p>{/if}
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
  <Beeswarm rows={data.beeswarm.data} drilldownContext={{ topic: String(topic.topic) }} />
</section>

<section class="container band">
  <div class="card">
    <PanelHeader title="Most concentrated voices" caption="Legislators with the largest share of their posts on this topic." source="app_legislator_topic" count={concentratedLegislators.length} />
    <DataTable rows={concentratedLegislators} columns={[
      { key: 'name', label: 'Legislator', href: (row: any) => appPath(appendDrilldownContext(`/who/${row.lid}`, { topic: String(topic.topic) })) },
      { key: 'party', label: 'Party' },
      { key: 'mrpIdeology', label: 'Ideology', numeric: true, format: (value: any) => Number(value).toFixed(3) },
      { key: 'share', label: 'Share', numeric: true, format: (value: any) => pct(value, 1) }
    ]} caption={`Legislators concentrated on ${topic.topicLabel}`} initialSort="share" initialDirection="desc" />
  </div>
</section>

<section class="container band">
  <PostExplorer
    title="Post explorer"
    caption="Browse high-engagement posts, recent posts, and representative samples assigned to this topic."
    source="posts"
    initialTopPosts={data.topPosts.data}
    filters={{ topic: topic.topic }}
  />
</section>

<style>
  .number { display: block; font-size: 1.6rem; margin-top: 6px; }
  .topic-heading {
    display: flex;
    gap: 14px;
    align-items: center;
  }
  .salience-normalization {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    min-width: 0;
    max-width: 100%;
    margin: -2px 0 10px;
    overflow: hidden;
  }
  .salience-normalization :global(.topic-control),
  .salience-normalization :global(.normalization-control),
  .salience-normalization :global(.party-controls) { min-width: 0; max-width: 100%; }
  .salience-normalization :global(label) { flex-wrap: wrap; min-width: 0; max-width: 100%; }
  .salience-normalization :global(select) { min-width: 0; max-width: 100%; }
  .salience-normalization :global(small) { min-width: 0; max-width: 100%; overflow-wrap: anywhere; }
  .salience-error { margin: 8px 0 0; color: var(--color-danger, #9d332f); font-size: 0.72rem; }
</style>
