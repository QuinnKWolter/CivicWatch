<script lang="ts">
  import { replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import { tick, untrack } from 'svelte';
  import { ArrowLeft, X } from 'lucide-svelte';
  import ClaimNetworkGraph from './ClaimNetworkGraph.svelte';
  import FactCheckList from './FactCheckList.svelte';
  import PanelHeader from './PanelHeader.svelte';
  import TopicIcon from './TopicIcon.svelte';
  import { appPath } from '$lib/paths';
  import {
    PARTY_COLOR,
    PARTY_INITIAL,
    PARTY_NAME,
    PARTY_ORDER,
    PARTY_PLURAL,
    STANCES,
    STANCE_LABEL,
    STANCE_VERB,
    TOP_N,
    breakdown,
    claimRing,
    dateText,
    filterPosts,
    fullRangeLabel,
    isPeriod,
    legislatorRing,
    partyCode,
    partyRing,
    periodLabel,
    periodOptions,
    plural,
    tally,
    tallyByCluster,
    tallyByLegislator,
    type ClaimNetworkData,
    type GraphNode,
    type PartyCode
  } from '$lib/claims';

  type View = 'claim' | 'legislator';
  type Layout = 'top' | 'party';
  type Scope = 'all' | 'period';

  interface Props {
    data: ClaimNetworkData;
    initialClaim?: string | null;
    initialLid?: string | null;
    initialPeriod?: string | null;
  }

  let { data, initialClaim = null, initialLid = null, initialPeriod = null }: Props = $props();

  const uid = $props.id();
  const PARTY_CLASS: Record<PartyCode, string> = {
    D: 'party-Democratic',
    R: 'party-Republican',
    I: 'party-Independent',
    U: 'party-unknown'
  };

  const clusters = $derived(new Map(data.clusters.map((cluster) => [cluster.clusterId, cluster])));
  const legislators = $derived(new Map(data.legislators.map((legislator) => [legislator.lid, legislator])));
  const topics = $derived(
    [...new Set(data.clusters.map((cluster) => cluster.topic))].map((topic) => ({
      topic,
      clusters: data.clusters.filter((cluster) => cluster.topic === topic)
    }))
  );
  const allLabel = $derived(fullRangeLabel(data.posts));

  const start = untrack(() => {
    const lid = initialLid && legislators.has(initialLid) ? initialLid : null;
    const ownTop = lid ? tallyByCluster(data.posts.filter((post) => post.lid === lid))[0]?.clusterId : undefined;
    const clusterId =
      (initialClaim && clusters.has(initialClaim) ? initialClaim : ownTop) ?? data.clusters[0]?.clusterId ?? '';
    return { lid, clusterId, period: isPeriod(initialPeriod) ? initialPeriod : 'all' };
  });

  let clusterId = $state(start.clusterId);
  let view = $state<View>(start.lid ? 'legislator' : 'claim');
  let lid = $state<string | null>(start.lid);
  let period = $state(start.period);
  let legScope = $state<Scope>('all');
  let layout = $state<Layout>('top');
  let party = $state<PartyCode | null>(null);
  let edge = $state<{ key: string; clusterId: string; lid: string } | null>(null);
  let includeNeutral = $state(false);
  let showAllLegislators = $state(false);

  let graphCard = $state<HTMLElement | null>(null);
  let edgeSection = $state<HTMLElement | null>(null);
  let legislatorSection = $state<HTMLElement | null>(null);

  const cluster = $derived(clusters.get(clusterId) ?? data.clusters[0]);
  const legislator = $derived(lid ? (legislators.get(lid) ?? null) : null);
  const legislatorParty = $derived(partyCode(legislator?.party));

  const claimPosts = $derived(filterPosts(data.posts, { clusterId, period, includeNeutral }));
  const claimRows = $derived(tallyByLegislator(claimPosts, legislators));
  const claimTally = $derived(tally(claimPosts));
  const claimPeriodLabel = $derived(periodLabel(period, allLabel));

  const legPeriod = $derived(legScope === 'period' ? period : 'all');
  const legPosts = $derived(lid ? filterPosts(data.posts, { lid, period: legPeriod, includeNeutral }) : []);
  const legTally = $derived(tally(legPosts));

  const periodBase = $derived(
    view === 'claim'
      ? data.posts.filter((post) => post.clusterId === clusterId)
      : data.posts.filter((post) => post.lid === lid)
  );
  const periods = $derived(periodOptions(periodBase, allLabel));
  const periodMissing = $derived(
    period !== 'all' && ![...periods.years, ...periods.months].some((option) => option.value === period)
  );

  const graph = $derived.by((): { nodes: GraphNode[]; more: GraphNode | null; empty: [string, string] | null } => {
    if (view === 'legislator' && lid) {
      if (!legPosts.length) {
        return {
          nodes: [],
          more: null,
          empty: [`${legislator?.name ?? 'This legislator'} has no posts in ${periodLabel(legPeriod, allLabel)}.`, `Switch to ${allLabel}.`]
        };
      }
      return { nodes: claimRing(lid, legislatorParty, tallyByCluster(legPosts), clusters), more: null, empty: null };
    }
    if (!claimRows.length) {
      return { nodes: [], more: null, empty: [`No posts on this claim in ${claimPeriodLabel}.`, 'Pick another period.'] };
    }
    if (layout === 'party' && !party) return { nodes: partyRing(claimRows), more: null, empty: null };
    return { ...legislatorRing(clusterId, claimRows, party), empty: null };
  });

  const graphTitle = $derived(
    view === 'legislator'
      ? `${legislator?.name ?? 'Legislator'}: claims posted about`
      : `${cluster?.label}: ${plural(claimRows.length, 'legislator')}, ${claimPeriodLabel}`
  );

  const edgePeriod = $derived(view === 'legislator' ? legPeriod : period);
  const edgePosts = $derived(
    edge
      ? filterPosts(data.posts, { clusterId: edge.clusterId, lid: edge.lid, period: edgePeriod, includeNeutral }).sort(
          (a, b) => a.date.localeCompare(b.date)
        )
      : []
  );
  const edgeParty = $derived(edge ? partyCode(legislators.get(edge.lid)?.party) : 'U');

  const visibleRows = $derived(showAllLegislators ? claimRows : claimRows.slice(0, TOP_N));

  function scrollTo(element: HTMLElement | null) {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }

  // When the control that was clicked disappears with the old view, keep focus on the chart
  // instead of letting it fall back to the top of the page.
  async function keepFocus() {
    await tick();
    if (!document.activeElement || document.activeElement === document.body) graphCard?.focus({ preventScroll: true });
  }

  function syncUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set('claim', clusterId);
    if (view === 'legislator' && lid) url.searchParams.set('lid', lid);
    else url.searchParams.delete('lid');
    if (period !== 'all') url.searchParams.set('period', period);
    else url.searchParams.delete('period');
    if (url.href !== window.location.href) replaceState(url, page.state);
  }

  function openClaim(next: string) {
    const target = clusters.get(next);
    if (!target) return;
    clusterId = next;
    view = 'claim';
    party = null;
    edge = null;
    showAllLegislators = false;
    syncUrl();
  }

  function openLegislator(next: string) {
    view = 'legislator';
    lid = next;
    edge = null;
    syncUrl();
  }

  function selectLayout(next: Layout) {
    layout = next;
    party = null;
    edge = null;
  }

  function selectParty(next: PartyCode | null) {
    party = next;
    edge = null;
  }

  function selectPeriod(next: string) {
    period = next;
    edge = null;
    syncUrl();
  }

  function selectScope(next: Scope) {
    legScope = next;
    edge = null;
  }

  function setNeutral(next: boolean) {
    includeNeutral = next;
    edge = null;
  }

  async function openEdge(node: GraphNode) {
    if (!node.lid || !node.clusterId) return;
    edge = { key: node.key, clusterId: node.clusterId, lid: node.lid };
    await tick();
    scrollTo(edgeSection);
  }

  async function showMoreLegislators() {
    showAllLegislators = true;
    await tick();
    scrollTo(legislatorSection);
  }

  function handleNode(node: GraphNode) {
    if (node.kind === 'legislator' && node.lid) openLegislator(node.lid);
    else if (node.kind === 'party' && node.party) selectParty(node.party);
    else if (node.kind === 'claim' && node.clusterId) openClaim(node.clusterId);
    void keepFocus();
  }

  function handleEdge(node: GraphNode) {
    if (node.kind === 'party' && node.party) {
      selectParty(node.party);
      void keepFocus();
    } else void openEdge(node);
  }

  function goBack() {
    if (view === 'legislator') openClaim(clusterId);
    else selectParty(null);
    void keepFocus();
  }

  const postText = (text: string) => text.replace(/^RT @[A-Za-z0-9_]+: /, '');
</script>

<div class="claim-network">
  <section class="card picker" aria-label="Choose a claim">
    {#each topics as group, index (group.topic)}
      <div class="picker-row">
        <span class="picker-topic" id={`${uid}-topic-${index}`}>
          <TopicIcon label={group.topic} size={15} />
          {group.topic}
        </span>
        <div class="chips" role="group" aria-labelledby={`${uid}-topic-${index}`}>
          {#each group.clusters as item (item.clusterId)}
            {@const active = view === 'claim' && item.clusterId === clusterId}
            <button type="button" class="chip-button" class:active aria-pressed={active} title={item.label} onclick={() => openClaim(item.clusterId)}>
              {item.shortLabel}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </section>

  <div class="split">
    <section class="card graph-card" bind:this={graphCard} tabindex="-1" aria-label="Claim network">
      {#if view === 'legislator' || (layout === 'party' && party)}
        <button type="button" class="back" onclick={goBack}>
          <ArrowLeft size={14} aria-hidden="true" />
          {view === 'legislator' ? cluster?.shortLabel : 'All parties'}
        </button>
      {/if}
      {#if view === 'legislator'}
        <PanelHeader
          eyebrow="Claim network"
          title={`Claims ${legislator?.name ?? 'this legislator'} posted about`}
          caption="Select a claim to see everyone who posted about it, or a line to read the posts."
          count={graph.nodes.length}
          countLabel="claims"
          countSingular="claim"
          compact
        />
      {:else}
        <PanelHeader
          eyebrow="Claim network"
          title={party ? `${PARTY_PLURAL[party]} who posted about this claim` : 'Legislators who posted about this claim'}
          caption="Select a legislator to see their other claims, or a line to read the posts."
          count={claimRows.length}
          countLabel="legislators"
          countSingular="legislator"
          compact
        />
      {/if}
      <div class="graph-tools">
        <label class="tool">
          <span>Period:</span>
          <select value={period} onchange={(event) => selectPeriod(event.currentTarget.value)}>
            <option value="all">{periods.all.label}</option>
            <optgroup label="Year">
              {#each periods.years as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </optgroup>
            <optgroup label="Month">
              {#each periods.months as option (option.value)}
                <option value={option.value}>{option.label}</option>
              {/each}
            </optgroup>
            {#if periodMissing}
              <option value={period}>{periodLabel(period, allLabel)} (0)</option>
            {/if}
          </select>
        </label>
        {#if view === 'claim'}
          <div class="tool">
            <span id={`${uid}-show`}>Show:</span>
            <div class="segmented" role="group" aria-labelledby={`${uid}-show`}>
              <button type="button" class:active={layout === 'top'} aria-pressed={layout === 'top'} onclick={() => selectLayout('top')}>
                Top {TOP_N}
              </button>
              <button type="button" class:active={layout === 'party'} aria-pressed={layout === 'party'} onclick={() => selectLayout('party')}>
                By party
              </button>
            </div>
          </div>
        {:else if period !== 'all'}
          <div class="tool">
            <span id={`${uid}-scope`}>Posts:</span>
            <div class="segmented" role="group" aria-labelledby={`${uid}-scope`}>
              <button type="button" class:active={legScope === 'all'} aria-pressed={legScope === 'all'} onclick={() => selectScope('all')}>
                {allLabel}
              </button>
              <button type="button" class:active={legScope === 'period'} aria-pressed={legScope === 'period'} onclick={() => selectScope('period')}>
                Only {claimPeriodLabel}
              </button>
            </div>
          </div>
        {/if}
        <label class="tool check">
          <input type="checkbox" checked={includeNeutral} onchange={(event) => setNeutral(event.currentTarget.checked)} />
          Neutral posts
        </label>
      </div>
      <ClaimNetworkGraph
        nodes={graph.nodes}
        more={graph.more}
        empty={graph.empty}
        title={graphTitle}
        center={view === 'legislator'
          ? { kind: 'legislator', name: legislator?.name ?? '', color: PARTY_COLOR[legislatorParty], initial: PARTY_INITIAL[legislatorParty] }
          : { kind: 'claim', label: cluster?.label ?? '' }}
        selectedKey={edge?.key ?? null}
        showNeutral={includeNeutral}
        onnode={handleNode}
        onedge={handleEdge}
        onmore={showMoreLegislators}
      />
    </section>

    <aside class="card side" aria-label="Claim details">
      {#if view === 'claim' && cluster}
        <div aria-live="polite">
          <PanelHeader eyebrow={`Claim · ${cluster.topic}`} title={cluster.label} caption={claimPeriodLabel} compact />
        </div>
        <dl class="stats">
          <dt>Legislators</dt><dd>{claimRows.length}</dd>
          <dt>Posts</dt><dd>{claimTally.n} ({claimTally.retweets} retweets)</dd>
          {#each STANCES as stance (stance)}
            {#if stance !== 'neutral' || includeNeutral}
              <dt>{STANCE_LABEL[stance]}</dt><dd>{claimTally[stance]}</dd>
            {/if}
          {/each}
          {#each PARTY_ORDER as code (code)}
            {@const count = claimRows.filter((row) => row.party === code).length}
            {#if count}
              <dt>{PARTY_PLURAL[code]}</dt><dd>{count}</dd>
            {/if}
          {/each}
        </dl>
      {:else if legislator}
        <div aria-live="polite">
          <PanelHeader
            eyebrow={legislator.synthetic ? 'Legislator · synthetic' : 'Legislator'}
            title={legislator.name}
            caption={[PARTY_NAME[legislatorParty], legislator.state, legislator.chamber].filter(Boolean).join(', ')}
            compact
          />
        </div>
        <dl class="stats">
          <dt>Claims posted about</dt><dd>{new Set(legPosts.map((post) => post.clusterId)).size}</dd>
          <dt>Posts</dt><dd>{legTally.n} ({legTally.retweets} retweets)</dd>
          {#each STANCES as stance (stance)}
            {#if stance !== 'neutral' || includeNeutral}
              <dt>{STANCE_LABEL[stance]}</dt><dd>{legTally[stance]}</dd>
            {/if}
          {/each}
        </dl>
        {#if !legislator.synthetic}
          <a class="profile-link" href={appPath(`/who/${encodeURIComponent(legislator.lid)}`)}>Open full profile</a>
        {/if}
      {/if}

      {#if edge}
        {@const edgeCluster = clusters.get(edge.clusterId)}
        <section class="section" bind:this={edgeSection} aria-labelledby={`${uid}-edge`}>
          <div class="section-head">
            <h3 id={`${uid}-edge`}>{legislators.get(edge.lid)?.name} on “{edgeCluster?.shortLabel}”</h3>
            <button type="button" class="close" aria-label="Close posts" title="Close posts" onclick={() => (edge = null)}>
              <X size={15} />
            </button>
          </div>
          <p class="section-caption">
            {plural(edgePosts.length, 'post')}, {periodLabel(edgePeriod, allLabel)}: {breakdown(tally(edgePosts))}
          </p>
          <ul class="posts" style={`--stance-color:${PARTY_COLOR[edgeParty]}`}>
            {#each edgePosts as post (post.postId)}
              <li>
                <p class="post-meta">
                  <span class={`stance ${post.stance}`}>{STANCE_LABEL[post.stance]}</span>
                  <time datetime={post.date}>{dateText(post.date)}</time>
                  <span>{post.isRetweet ? `Retweet of ${post.retweetOf ?? 'another account'}` : 'Own post'}</span>
                </p>
                <p class="post-text">{postText(post.text)}</p>
              </li>
            {/each}
          </ul>
        </section>
      {:else if view === 'legislator'}
        <p class="hint">Select a line to read the posts. Select a claim to see everyone who posted about it.</p>
      {/if}

      {#if view === 'claim' && cluster}
        {#key cluster.clusterId}
          <FactCheckList factChecks={cluster.factChecks} />
        {/key}

        {#if claimRows.length}
          <section class="section" bind:this={legislatorSection} aria-labelledby={`${uid}-legislators`}>
            <h3 id={`${uid}-legislators`}>
              {showAllLegislators || claimRows.length <= TOP_N
                ? `All ${claimRows.length} legislators`
                : `Top legislators (${claimRows.length} in total)`}
            </h3>
            <ul class="legislators">
              {#each visibleRows as row (row.lid)}
                <li>
                  <button type="button" class="legislator-row" onclick={() => openLegislator(row.lid)}>
                    <span class={`party-dot ${PARTY_CLASS[row.party]}`} aria-hidden="true">{PARTY_INITIAL[row.party]}</span>
                    <span class="visually-hidden">{PARTY_NAME[row.party]},</span>
                    <span class="name">{row.name}{row.state ? `, ${row.state}` : ''}</span>
                    <span class="n">{row.n} ({STANCE_VERB[row.main]})</span>
                  </button>
                </li>
              {/each}
            </ul>
            {#if !showAllLegislators && claimRows.length > TOP_N}
              <button type="button" class="more" onclick={() => (showAllLegislators = true)}>Show all {claimRows.length}</button>
            {/if}
          </section>
        {/if}
      {/if}
    </aside>
  </div>
</div>

<style>
  .claim-network {
    display: grid;
    gap: 12px;
    min-width: 0;
  }

  .picker {
    display: grid;
    gap: 2px;
    padding: 6px 14px;
    margin: 0;
  }

  .picker-row {
    display: grid;
    grid-template-columns: 13rem minmax(0, 1fr);
    gap: 6px 12px;
    align-items: center;
    padding-block: 6px;
  }

  .picker-row + .picker-row {
    border-top: 1px solid var(--color-rule);
  }

  .picker-topic {
    display: inline-flex;
    gap: 8px;
    align-items: center;
    color: var(--color-mute);
    font-size: 0.8rem;
    font-weight: 650;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    box-shadow: none;
  }

  .chip-button,
  .back,
  .segmented button {
    flex: 0 0 auto;
    width: auto;
    min-height: 30px;
    padding: 3px 12px;
    margin: 0;
    color: var(--color-ink);
    font-size: 0.82rem;
    border-radius: 999px;
    box-shadow: none;
  }

  .chip-button:hover,
  .back:hover,
  .segmented button:hover {
    box-shadow: none;
    transform: none;
  }

  .chip-button.active,
  .segmented button.active {
    color: var(--color-seal);
    background: color-mix(in srgb, var(--color-seal) 9%, var(--color-card));
    border-color: color-mix(in srgb, var(--color-seal) 45%, var(--color-rule));
  }

  .back {
    gap: 6px;
    margin-bottom: 10px;
    color: var(--color-mute);
  }

  .graph-tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 18px;
    align-items: center;
    margin: 0 0 12px;
  }

  .tool {
    display: inline-flex;
    gap: 7px;
    align-items: center;
    margin: 0;
    color: var(--color-mute);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.035em;
    line-height: 1;
    white-space: nowrap;
  }

  .tool select {
    width: auto;
    height: 30px;
    min-height: 30px;
    padding: 0 30px 0 9px;
    margin: 0;
    color: var(--color-ink);
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1;
    background-color: var(--color-card);
    border: 1px solid var(--color-rule);
    border-radius: 5px;
    box-shadow: none;
  }

  .tool select:hover {
    border-color: var(--color-seal);
  }

  .tool select:focus-visible {
    outline: 2px solid var(--color-seal);
    outline-offset: 2px;
  }

  .segmented {
    display: inline-flex;
    gap: 4px;
    width: auto;
    margin: 0;
    box-shadow: none;
  }

  .segmented button {
    min-height: 30px;
    padding: 3px 10px;
    font-size: 0.78rem;
    font-weight: 400;
    letter-spacing: normal;
  }

  .check {
    cursor: pointer;
  }

  /* The base layer's `background` shorthand wipes Pico's checked state, so restore it here. */
  .check input {
    width: 16px;
    height: 16px;
    margin: 0;
    background-color: var(--color-card);
    border-radius: var(--radius-chip);
  }

  .check input:checked {
    background-color: var(--color-seal);
    background-image: var(--pico-icon-checkbox);
    background-position: center;
    background-repeat: no-repeat;
    background-size: 12px auto;
    border-color: var(--color-seal);
  }

  .graph-card,
  .side {
    min-width: 0;
  }

  .graph-card:focus {
    outline: none;
  }

  .side {
    padding: 18px;
  }

  .stats {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 5px 14px;
    margin: 0;
    font-size: 0.86rem;
  }

  .stats dt {
    color: var(--color-mute);
  }

  .stats dd {
    margin: 0;
    font-family: var(--type-mono);
    font-variant-numeric: tabular-nums;
  }

  .profile-link {
    display: inline-block;
    margin-top: 12px;
    font-size: 0.86rem;
    font-weight: 600;
  }

  .section {
    padding-top: 14px;
    margin-top: 16px;
    border-top: 1px solid var(--color-rule);
  }

  .section h3 {
    margin: 0 0 6px;
    font-size: 0.95rem;
  }

  .section-head {
    display: flex;
    gap: 10px;
    align-items: start;
    justify-content: space-between;
  }

  .close {
    display: inline-grid;
    flex: 0 0 auto;
    place-items: center;
    width: 30px;
    min-height: 30px;
    height: 30px;
    padding: 0;
    border-radius: 999px;
    box-shadow: none;
  }

  .close:hover {
    box-shadow: none;
    transform: none;
  }

  .section-caption,
  .hint {
    margin: 0 0 8px;
    color: var(--color-mute);
    font-size: 0.82rem;
  }

  .hint {
    margin-top: 16px;
  }

  .posts,
  .legislators {
    padding: 0;
    margin: 0;
    overflow: auto;
    list-style: none;
  }

  .posts {
    max-height: 340px;
  }

  .posts li {
    padding: 9px 0;
    margin: 0;
    border-bottom: 1px solid var(--color-rule);
  }

  .legislators li {
    padding: 0;
    margin: 0;
  }

  .posts li:last-child {
    border-bottom: 0;
  }

  .post-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 10px;
    align-items: center;
    margin: 0 0 3px;
    color: var(--color-mute);
    font-size: 0.74rem;
  }

  .post-meta time {
    font-family: var(--type-mono);
  }

  .stance {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    color: var(--color-ink);
    font-weight: 650;
  }

  .stance::before {
    width: 16px;
    content: '';
    border-top: 3px solid var(--stance-color);
  }

  .stance.debunk::before {
    border-top-style: dashed;
    border-top-color: var(--color-mute);
  }

  .stance.neutral::before {
    border-top-width: 2px;
    border-top-color: var(--color-rule-strong);
  }

  .post-text {
    margin: 0;
    font-size: 0.86rem;
    line-height: 1.45;
  }

  .legislators {
    max-height: 300px;
  }

  .legislator-row {
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;
    min-height: 34px;
    padding: 4px 6px;
    margin: 0;
    color: inherit;
    font-size: 0.86rem;
    text-align: left;
    background: none;
    border: 0;
    border-radius: 5px;
    box-shadow: none;
  }

  .legislator-row:hover {
    color: inherit;
    background: var(--color-hover);
    box-shadow: none;
    transform: none;
  }

  .legislator-row .party-dot {
    flex: 0 0 auto;
  }

  .legislator-row .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .legislator-row .n {
    margin-left: auto;
    color: var(--color-mute);
    font-family: var(--type-mono);
    font-size: 0.76rem;
    white-space: nowrap;
  }

  .more {
    min-height: 32px;
    padding: 4px 10px;
    margin-top: 8px;
    font-size: 0.8rem;
    box-shadow: none;
  }

  .more:hover {
    box-shadow: none;
    transform: none;
  }

  @media (max-width: 640px) {
    .picker-row {
      grid-template-columns: minmax(0, 1fr);
    }

    .graph-tools {
      gap: 8px 14px;
    }
  }
</style>
