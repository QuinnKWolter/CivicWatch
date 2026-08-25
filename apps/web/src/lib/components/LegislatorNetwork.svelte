<script lang="ts">
  import { browser } from '$app/environment';
  import { env } from '$env/dynamic/public';
  import { onDestroy, tick } from 'svelte';
  import {
    ArrowDownLeft,
    ArrowUpRight,
    Check,
    Crosshair,
    FileText,
    Filter,
    Maximize2,
    MousePointer2,
    RadioTower,
    RotateCcw,
    Search,
    UsersRound,
    X
  } from 'lucide-svelte';
  import { compact, integer, partyInitial } from '$lib/format';
  import { appPath } from '$lib/paths';
  import PostExplorer from './PostExplorer.svelte';

  type NetworkLink = {
    id: string;
    direction: 'incoming' | 'outgoing' | string;
    source: string | null;
    target: string | null;
    neighborKey: string | null;
    neighbor: {
      lid: string | null;
      name: string | null;
      handle: string | null;
      state: string | null;
      chamber: string | null;
      party: string | null;
      ideology: number | null;
      external: boolean;
    };
    targetHandle: string | null;
    interactionType: 'mention' | 'retweet' | string;
    topic: string | null;
    topicLabel: string | null;
    postCount: number;
    engagement: number;
    rawInteractionCount?: number | null;
    rawEngagement?: number | null;
    canonicalPostCount?: number | null;
    canonicalEngagement?: number | null;
    firstSeen: string | null;
    lastSeen: string | null;
    samplePostId: number | null;
    confidence: string | null;
  };

  type NetworkPayload = {
    data?: {
      center?: {
        lid: string | null;
        name: string | null;
        handle: string | null;
        state: string | null;
        chamber: string | null;
        party: string | null;
        ideology: number | null;
      };
      links?: NetworkLink[];
      facets?: {
        topics?: Array<{ topic: string | null; topicLabel: string | null; postCount: number }>;
        parties?: Array<{ party: string | null; postCount: number }>;
        states?: Array<{ state: string | null; postCount: number }>;
      };
      summary?: {
        linkRows?: number;
        totalPosts?: number;
        totalEngagement?: number;
        knownLegislatorLinks?: number;
        externalLinks?: number;
      };
    };
    meta?: Record<string, unknown>;
  };

  type GraphNode = {
    key: string;
    label: string;
    sublabel: string;
    handle: string | null;
    lid: string | null;
    party: string | null;
    state: string | null;
    chamber: string | null;
    ideology: number | null;
    external: boolean;
    center: boolean;
    x: number;
    y: number;
    radius: number;
    postCount: number;
    engagement: number;
    incoming: number;
    outgoing: number;
  };

  type GraphLink = NetworkLink & {
    graphKey: string;
    sourceKey: string;
    targetKey: string;
    sourceNode: GraphNode;
    targetNode: GraphNode;
    width: number;
    opacity: number;
  };

  export let network: NetworkPayload;
  export let title = 'Interaction network';
  export let caption = 'Mentions and retweets parsed from this legislator’s posts and known legislator handles.';
  export let apiBase = env.PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1';

  const width = 1180;
  const height = 680;
  const centerX = width / 2;
  const centerY = height / 2;

  let direction = 'all';
  let interactionType = 'all';
  let topic = 'all';
  let party = 'all';
  let state = 'all';
  let targetScope = 'known';
  let search = '';
  let minPosts = 1;
  let maxNodes = 72;

  let draftDirection = direction;
  let draftInteractionType = interactionType;
  let draftTopic = topic;
  let draftParty = party;
  let draftState = state;
  let draftTargetScope = targetScope;
  let draftSearch = search;
  let draftMinPosts = minPosts;
  let appliedFilterVersion = 0;

  let activeNetwork: NetworkPayload = {
    data: {
      links: [],
      facets: { topics: [], parties: [], states: [] },
      summary: {}
    }
  };
  let loadingNetwork = false;
  let networkFetchError = '';
  let selectedEdge: GraphLink | null = null;
  let transform = { x: 0, y: 0, scale: 1 };
  let hover: GraphNode | GraphLink | null = null;
  let dragging = false;
  let dragStart = { x: 0, y: 0 };
  let transformStart = { x: 0, y: 0, scale: 1 };

  let fetchTimer: number | undefined;
  let controller: AbortController | undefined;
  let lastNetworkQuery = '';
  let previousBodyOverflow: string | null = null;
  let previousBodyPaddingRight: string | null = null;
  let edgeDialog: HTMLDialogElement | null = null;
  let dialogSyncing = false;

  $: if (network && network !== activeNetwork && !lastNetworkQuery) {
    activeNetwork = network;
  }
  $: center = activeNetwork?.data?.center ?? network?.data?.center ?? null;
  $: centerLid = network?.data?.center?.lid ?? activeNetwork?.data?.center?.lid ?? null;
  $: rawLinks = activeNetwork?.data?.links ?? [];
  $: topics = activeNetwork?.data?.facets?.topics ?? [];
  $: parties = activeNetwork?.data?.facets?.parties ?? [];
  $: states = activeNetwork?.data?.facets?.states ?? [];
  $: networkError = networkFetchError || (typeof activeNetwork?.meta?.networkError === 'string' ? activeNetwork.meta.networkError : '');
  $: serverQuery = buildNetworkQuery();
  $: if (browser && centerLid && serverQuery !== lastNetworkQuery) {
    scheduleNetworkFetch(serverQuery);
  }
  $: selectedEdgeKey = selectedEdge?.graphKey ?? '';
  $: if (browser) {
    void syncEdgeDialog(selectedEdgeKey);
  }
  $: appliedFilterKey = JSON.stringify({
    direction,
    interactionType,
    topic,
    party,
    state,
    targetScope,
    search: search.trim(),
    minPosts,
    appliedFilterVersion
  });
  $: filteredLinks = filterLinks(rawLinks, appliedFilterKey);
  $: graph = buildGraph(filteredLinks);
  $: selectedSummary = summarize(filteredLinks, graph.nodes);
  $: filtersDirty =
    draftDirection !== direction ||
    draftInteractionType !== interactionType ||
    draftTopic !== topic ||
    draftParty !== party ||
    draftState !== state ||
    draftTargetScope !== targetScope ||
    draftSearch !== search ||
    draftMinPosts !== minPosts;

  function buildNetworkQuery() {
    const params = new URLSearchParams();
    params.set('limit', 'all');
    params.set('external', targetScope === 'known' ? 'false' : 'true');
    params.set('minPosts', String(minPosts));
    if (direction !== 'all') params.set('direction', direction);
    if (interactionType !== 'all') params.set('type', interactionType);
    if (topic !== 'all') params.set('topic', topic);
    return params.toString();
  }

  function scheduleNetworkFetch(query: string) {
    if (query === lastNetworkQuery) return;
    window.clearTimeout(fetchTimer);
    fetchTimer = window.setTimeout(() => {
      void fetchNetwork(query);
    }, 160);
  }

  async function fetchNetwork(query: string) {
    if (!centerLid) return;
    const requestQuery = query;
    lastNetworkQuery = requestQuery;
    controller?.abort();
    controller = new AbortController();
    loadingNetwork = true;
    networkFetchError = '';

    try {
      const base = apiBase.replace(/\/+$/, '');
      const response = await fetch(
        `${base}/legislators/${encodeURIComponent(centerLid)}/network?${requestQuery}`,
        {
          method: 'GET',
          headers: { accept: 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error(`Network request failed (${response.status})`);
      }

      activeNetwork = await response.json();
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      networkFetchError = cause instanceof Error ? cause.message : 'Network request failed.';
    } finally {
      loadingNetwork = false;
    }
  }

  function filterLinks(links: NetworkLink[], _filterKey = '') {
    const q = search.trim().toLocaleLowerCase();

    return links.filter((link) => {
      const n = link.neighbor;
      if (direction !== 'all' && link.direction !== direction) return false;
      if (interactionType !== 'all' && link.interactionType !== interactionType) return false;
      if (topic !== 'all' && link.topic !== topic) return false;
      if (party !== 'all' && (n.party ?? 'External') !== party) return false;
      if (state !== 'all' && (n.state ?? 'External') !== state) return false;
      if (targetScope === 'known' && n.external) return false;
      if (targetScope === 'external' && !n.external) return false;
      if (link.postCount < minPosts) return false;
      if (!q) return true;
      return [n.name, n.handle, n.state, n.party, link.topicLabel, link.interactionType]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(q);
    });
  }

  function buildGraph(links: NetworkLink[]) {
    const centerKey = center?.lid ?? 'center';
    const nodeMap = new Map<string, GraphNode>();
    nodeMap.set(centerKey, {
      key: centerKey,
      label: center?.name ?? 'Selected legislator',
      sublabel: [center?.party, center?.state, center?.chamber].filter(Boolean).join(' · '),
      handle: center?.handle ?? null,
      lid: center?.lid ?? null,
      party: center?.party ?? null,
      state: center?.state ?? null,
      chamber: center?.chamber ?? null,
      ideology: center?.ideology ?? null,
      external: false,
      center: true,
      x: centerX,
      y: centerY,
      radius: 28,
      postCount: 0,
      engagement: 0,
      incoming: 0,
      outgoing: 0
    });

    for (const link of links) {
      const key = link.neighborKey ?? `external:${link.targetHandle ?? link.id}`;
      const existing = nodeMap.get(key);
      const postCount = Number(link.postCount ?? 0);
      const engagement = Number(link.engagement ?? 0);

      if (existing) {
        existing.postCount += postCount;
        existing.engagement += engagement;
        if (link.direction === 'incoming') existing.incoming += postCount;
        else existing.outgoing += postCount;
      } else {
        nodeMap.set(key, {
          key,
          label: link.neighbor.name ?? link.neighbor.handle ?? key.replace(/^external:/, '@'),
          sublabel: link.neighbor.external
            ? 'External handle'
            : [link.neighbor.party, link.neighbor.state, link.neighbor.chamber].filter(Boolean).join(' · '),
          handle: link.neighbor.handle,
          lid: link.neighbor.lid,
          party: link.neighbor.party,
          state: link.neighbor.state,
          chamber: link.neighbor.chamber,
          ideology: link.neighbor.ideology,
          external: link.neighbor.external,
          center: false,
          x: 0,
          y: 0,
          radius: 10,
          postCount,
          engagement,
          incoming: link.direction === 'incoming' ? postCount : 0,
          outgoing: link.direction === 'outgoing' ? postCount : 0
        });
      }
    }

    const neighbors = Array.from(nodeMap.values())
      .filter((node) => !node.center)
      .sort((a, b) => b.postCount - a.postCount || a.label.localeCompare(b.label))
      .slice(0, maxNodes);
    const allowed = new Set([centerKey, ...neighbors.map((node) => node.key)]);
    const maxPostCount = Math.max(1, ...neighbors.map((node) => node.postCount));

    neighbors.forEach((node, index) => {
      const ring = index < 20 ? 1 : index < 48 ? 2 : 3;
      const ringIndex = ring === 1 ? index : ring === 2 ? index - 20 : index - 48;
      const ringCount = ring === 1 ? Math.min(20, neighbors.length) : ring === 2 ? Math.min(28, Math.max(neighbors.length - 20, 1)) : Math.max(neighbors.length - 48, 1);
      const angle = (ringIndex / Math.max(ringCount, 1)) * Math.PI * 2 - Math.PI / 2 + ring * 0.18;
      const radius = ring === 1 ? 178 : ring === 2 ? 254 : 318;
      const weight = Math.sqrt(node.postCount / maxPostCount);
      node.radius = 8 + weight * 20;
      node.x = centerX + Math.cos(angle) * radius;
      node.y = centerY + Math.sin(angle) * radius;
    });

    const centerNode = nodeMap.get(centerKey)!;
    const graphLinks = links
      .filter((link) => allowed.has(link.neighborKey ?? '') || allowed.has(`external:${link.targetHandle}`))
      .map((link, index): GraphLink | null => {
        const neighborKey = link.neighborKey ?? `external:${link.targetHandle ?? link.id}`;
        const neighborNode = nodeMap.get(neighborKey);
        if (!neighborNode) return null;
        const outgoing = link.direction === 'outgoing';
        const sourceNode = outgoing ? centerNode : neighborNode;
        const targetNode = outgoing ? neighborNode : centerNode;
        return {
          ...link,
          graphKey: [
            link.id,
            link.targetHandle ?? '',
            link.samplePostId ?? '',
            index
          ].join(':'),
          sourceKey: sourceNode.key,
          targetKey: targetNode.key,
          sourceNode,
          targetNode,
          width: Math.max(1.2, Math.min(9, 1 + Math.sqrt(link.postCount) * 0.18)),
          opacity: Math.max(0.28, Math.min(0.82, 0.24 + Math.sqrt(link.postCount) * 0.045))
        };
      })
      .filter(Boolean) as GraphLink[];

    return { nodes: [centerNode, ...neighbors], links: graphLinks };
  }

  function summarize(links: NetworkLink[], nodes: GraphNode[]) {
    return {
      links: links.length,
      nodes: Math.max(0, nodes.length - 1),
      posts: links.reduce((sum, link) => sum + Number(link.postCount ?? 0), 0),
      engagement: links.reduce((sum, link) => sum + Number(link.engagement ?? 0), 0),
      incoming: links.filter((link) => link.direction === 'incoming').reduce((sum, link) => sum + link.postCount, 0),
      outgoing: links.filter((link) => link.direction === 'outgoing').reduce((sum, link) => sum + link.postCount, 0)
    };
  }

  function linkPath(link: GraphLink) {
    const sx = link.sourceNode.x;
    const sy = link.sourceNode.y;
    const tx = link.targetNode.x;
    const ty = link.targetNode.y;
    const dx = tx - sx;
    const dy = ty - sy;
    const curve = link.interactionType === 'retweet' ? 0.18 : -0.18;
    const cx = (sx + tx) / 2 - dy * curve;
    const cy = (sy + ty) / 2 + dx * curve;
    return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
  }

  function nodeColor(node: GraphNode) {
    if (node.center) return 'var(--color-seal)';
    if (node.external) return 'var(--color-mute-soft)';
    if (node.party === 'Democratic') return 'var(--color-ballot-blue)';
    if (node.party === 'Republican') return 'var(--color-ballot-red)';
    if (node.party === 'Independent') return 'var(--color-independent)';
    return 'var(--color-mute)';
  }

  function linkColor(link: GraphLink) {
    if (link.interactionType === 'retweet') return 'var(--color-seal)';
    return link.direction === 'incoming' ? 'var(--color-ballot-blue)' : 'var(--color-ballot-red)';
  }

  function isGraphLink(item: GraphNode | GraphLink | null): item is GraphLink {
    return Boolean(item && 'sourceNode' in item);
  }

  function linkDimmed(link: GraphLink) {
    if (!hover) return false;
    if (isGraphLink(hover)) return hover.id !== link.id;
    return hover.key !== link.sourceKey && hover.key !== link.targetKey;
  }

  function nodeDimmed(node: GraphNode) {
    if (!hover) return false;
    if (isGraphLink(hover)) return hover.sourceKey !== node.key && hover.targetKey !== node.key;
    return hover.key !== node.key;
  }

  function applyFilters() {
    direction = draftDirection;
    interactionType = draftInteractionType;
    topic = draftTopic;
    party = draftParty;
    state = draftState;
    targetScope = draftTargetScope;
    search = draftSearch.trim();
    draftSearch = search;
    minPosts = draftMinPosts;
    hover = null;
    selectedEdge = null;
    appliedFilterVersion += 1;

    if (browser && centerLid) {
      const nextQuery = buildNetworkQuery();
      if (nextQuery !== lastNetworkQuery) {
        window.clearTimeout(fetchTimer);
        void fetchNetwork(nextQuery);
      }
    }
  }

  function resetFilters() {
    direction = 'all';
    interactionType = 'all';
    topic = 'all';
    party = 'all';
    state = 'all';
    targetScope = 'known';
    search = '';
    minPosts = 1;
    draftDirection = direction;
    draftInteractionType = interactionType;
    draftTopic = topic;
    draftParty = party;
    draftState = state;
    draftTargetScope = targetScope;
    draftSearch = search;
    draftMinPosts = minPosts;
    hover = null;
    selectedEdge = null;
    appliedFilterVersion += 1;

    if (browser && centerLid) {
      const nextQuery = buildNetworkQuery();
      if (nextQuery !== lastNetworkQuery) {
        window.clearTimeout(fetchTimer);
        void fetchNetwork(nextQuery);
      }
    }
  }

  function resetView() {
    transform = { x: 0, y: 0, scale: 1 };
  }

  function zoomBy(amount: number) {
    const next = Math.max(0.45, Math.min(2.6, transform.scale + amount));
    transform = { ...transform, scale: next };
  }

  function handleWheel(event: WheelEvent) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    zoomBy(delta);
  }

  function pointerDown(event: PointerEvent) {
    if ((event.target as Element | null)?.closest?.('[data-network-action]')) return;
    dragging = true;
    dragStart = { x: event.clientX, y: event.clientY };
    transformStart = { ...transform };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent) {
    if (!dragging) return;
    transform = {
      ...transform,
      x: transformStart.x + event.clientX - dragStart.x,
      y: transformStart.y + event.clientY - dragStart.y
    };
  }

  function pointerUp(event: PointerEvent) {
    dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  function linkTitle(link: GraphLink) {
    const verb = link.interactionType === 'retweet' ? 'Retweets' : 'Mentions';
    const dir = link.direction === 'incoming' ? 'from' : 'to';
    return `${verb} ${dir} ${link.neighbor.name ?? link.targetHandle}: ${integer(link.postCount)} unique posts`;
  }

  function rawInteractionLabel(link: GraphLink) {
    const raw = Number(link.rawInteractionCount ?? link.postCount);
    if (!Number.isFinite(raw) || raw <= link.postCount) return '';
    return `${integer(raw)} raw rows`;
  }

  function nodeHref(node: GraphNode) {
    return node.lid && !node.center ? appPath(`/who/${encodeURIComponent(node.lid)}`) : null;
  }

  function edgeSourceLid(link: GraphLink) {
    return link.direction === 'outgoing'
      ? center?.lid ?? null
      : link.neighbor.lid;
  }

  function edgeTargetLid(link: GraphLink) {
    return link.direction === 'outgoing'
      ? link.neighbor.lid
      : center?.lid ?? null;
  }

  function edgeFilters(link: GraphLink) {
    const targetLid = edgeTargetLid(link);

    return {
      edgeSourceLid: edgeSourceLid(link),
      edgeTargetLid: targetLid,
      edgeTargetHandle: targetLid ? null : link.targetHandle,
      edgeType: link.interactionType,
      edgeTopic: link.topic
    };
  }

  function edgeModalTitle(link: GraphLink) {
    const source = link.direction === 'outgoing'
      ? center?.name ?? 'Selected legislator'
      : link.neighbor.name ?? link.neighbor.handle ?? 'Legislator';
    const target = link.direction === 'outgoing'
      ? link.neighbor.name ?? link.neighbor.handle ?? 'Legislator'
      : center?.name ?? 'Selected legislator';
    const verb = link.interactionType === 'retweet' ? 'retweeted' : 'mentioned';
    return `${source} ${verb} ${target}`;
  }

  function openEdge(event: Event, link: GraphLink) {
    event.stopPropagation();
    selectedEdge = link;
  }

  function closeEdgeModal() {
    selectedEdge = null;
    if (browser && edgeDialog?.open) {
      edgeDialog.close();
    }
  }

  async function syncEdgeDialog(_selectedEdgeKey: string) {
    if (dialogSyncing) return;
    dialogSyncing = true;

    try {
      await tick();

      if (!edgeDialog) return;

      if (selectedEdge && !edgeDialog.open) {
        edgeDialog.showModal();
        setModalScrollLock(true);
        edgeDialog.focus();
        return;
      }

      if (!selectedEdge && edgeDialog.open) {
        edgeDialog.close();
      }
    } finally {
      dialogSyncing = false;
    }
  }

  function handleDialogCancel(event: Event) {
    event.preventDefault();
    closeEdgeModal();
  }

  function handleDialogClose() {
    setModalScrollLock(false);
    if (selectedEdge) {
      selectedEdge = null;
    }
  }

  function setModalScrollLock(locked: boolean) {
    if (!browser) return;

    if (locked && previousBodyOverflow === null) {
      previousBodyOverflow = document.body.style.overflow;
      previousBodyPaddingRight = document.body.style.paddingRight;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      document.body.style.overflow = 'hidden';
      return;
    }

    if (!locked && previousBodyOverflow !== null) {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.paddingRight = previousBodyPaddingRight ?? '';
      previousBodyOverflow = null;
      previousBodyPaddingRight = null;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && selectedEdge) {
      closeEdgeModal();
    }
  }

  onDestroy(() => {
    if (browser) window.clearTimeout(fetchTimer);
    controller?.abort();
    setModalScrollLock(false);
  });
</script>

<svelte:window on:keydown={handleKeydown} />

<section class="network card" aria-labelledby="network-title">
  <div class="network-head">
    <div>
      <div class="eyebrow"><RadioTower size={15} /> Derived interaction graph</div>
      <h2 id="network-title">{title}</h2>
      <p class="muted">{caption}</p>
    </div>
    <div class="network-stats" aria-label="Selected network summary">
      {#if loadingNetwork}
        <span><RadioTower size={14} /> Updating</span>
      {/if}
      <span><UsersRound size={14} /> {integer(selectedSummary.nodes)} nodes</span>
      <span><MousePointer2 size={14} /> {integer(selectedSummary.links)} links</span>
      <span><ArrowUpRight size={14} /> {compact(selectedSummary.outgoing)} out</span>
      <span><ArrowDownLeft size={14} /> {compact(selectedSummary.incoming)} in</span>
    </div>
  </div>

  <div class="controls" aria-label="Network filters">
    <label class="search-control">
      <span class="visually-hidden">Search network</span>
      <span class="search-field-wrap">
        <span class="search-field-icon" aria-hidden="true">
          <Search size={15} />
        </span>
        <input
          class="field search-field"
          bind:value={draftSearch}
          placeholder="Search"
          aria-label="Search network"
          on:keydown={(event) => {
            if (event.key === 'Enter' && filtersDirty) applyFilters();
          }}
        />
      </span>
    </label>
    <label>
      <span>Direction</span>
      <select class="field" bind:value={draftDirection}>
        <option value="all">Both</option>
        <option value="outgoing">Outgoing</option>
        <option value="incoming">Incoming</option>
      </select>
    </label>
    <label>
      <span>Type</span>
      <select class="field" bind:value={draftInteractionType}>
        <option value="all">Mentions + retweets</option>
        <option value="mention">Mentions</option>
        <option value="retweet">Retweets</option>
      </select>
    </label>
    <label>
      <span>Topic</span>
      <select class="field" bind:value={draftTopic}>
        <option value="all">All topics</option>
        {#each topics.slice(0, 22) as item}
          <option value={item.topic}>{item.topicLabel ?? `Topic ${item.topic}`} ({compact(item.postCount)})</option>
        {/each}
      </select>
    </label>
    <label>
      <span>Party</span>
      <select class="field" bind:value={draftParty}>
        <option value="all">All parties</option>
        {#each parties as item}
          <option value={item.party ?? 'External'}>{item.party ?? 'External'} ({compact(item.postCount)})</option>
        {/each}
      </select>
    </label>
    <label>
      <span>State</span>
      <select class="field" bind:value={draftState}>
        <option value="all">All states</option>
        {#each states.slice(0, 52) as item}
          <option value={item.state ?? 'External'}>{item.state ?? 'External'} ({compact(item.postCount)})</option>
        {/each}
      </select>
    </label>
    <label>
      <span>Targets</span>
      <select class="field" bind:value={draftTargetScope}>
        <option value="all">Known + external</option>
        <option value="known">Known legislators</option>
        <option value="external">External handles</option>
      </select>
    </label>
    <label class="range">
      <span>Minimum posts: {draftMinPosts}</span>
      <input
        type="range"
        min="1"
        max="50"
        step="1"
        value={draftMinPosts}
        on:input={(event) => (draftMinPosts = Number((event.currentTarget as HTMLInputElement).value))}
      />
    </label>
    <button
      type="button"
      class="icon-button apply-button"
      class:pending={filtersDirty}
      disabled={!filtersDirty || loadingNetwork}
      on:click={applyFilters}
      title={filtersDirty ? 'Apply network filter changes' : 'Filters are applied'}
    >
      <Check size={15} /> {loadingNetwork ? 'Updating' : filtersDirty ? 'Apply' : 'Applied'}
    </button>
    <button type="button" class="icon-button" on:click={resetFilters} title="Clear network filters">
      <Filter size={15} /> Clear
    </button>
  </div>

  <div class="viz-shell">
    <div class="viz-toolbar">
      <button type="button" class="zoom-button" on:click={() => zoomBy(0.16)} title="Zoom in" aria-label="Zoom in">+</button>
      <button type="button" class="zoom-button" on:click={() => zoomBy(-0.16)} title="Zoom out" aria-label="Zoom out">−</button>
      <button type="button" class="toolbar-button" on:click={resetView} title="Reset view"><RotateCcw size={14} /> Reset</button>
      <span class="toolbar-help"><Maximize2 size={13} /> Wheel to zoom · drag to pan</span>
    </div>

    {#if graph.links.length === 0}
      <div class="empty">
        <Crosshair size={24} />
        {#if networkError}
          <strong>Interaction network could not be loaded</strong>
          <span>{networkError}</span>
        {:else}
          <strong>No interactions match these filters</strong>
          <span>Clear filters or lower the minimum-post threshold.</span>
        {/if}
      </div>
    {:else}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Interactive legislator interaction network"
        on:wheel={handleWheel}
        on:pointerdown={pointerDown}
        on:pointermove={pointerMove}
        on:pointerup={pointerUp}
        on:pointercancel={pointerUp}
      >
        <defs>
          <filter id="network-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="var(--color-shadow)" flood-opacity="0.22" />
          </filter>
        </defs>
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
          <g class="links">
            {#each graph.links as link (link.graphKey)}
              <g
                role="button"
                data-network-action
                tabindex="0"
                on:mouseenter={() => (hover = link)}
                on:mouseleave={() => (hover = null)}
                on:click={(event) => openEdge(event, link)}
                on:keydown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') openEdge(event, link);
                }}
              >
                <path
                  class:muted-link={linkDimmed(link)}
                  d={linkPath(link)}
                  stroke={linkColor(link)}
                  stroke-width={link.width}
                  opacity={link.opacity}
                >
                  <title>{linkTitle(link)}</title>
                </path>
              </g>
            {/each}
          </g>
          <g class="nodes">
            {#each graph.nodes as node (node.key)}
              <g
                role="graphics-symbol"
                class:center-node={node.center}
                class:external-node={node.external}
                class:dimmed={nodeDimmed(node)}
                transform={`translate(${node.x} ${node.y})`}
                on:mouseenter={() => (hover = node)}
                on:mouseleave={() => (hover = null)}
              >
                {#if nodeHref(node)}
                  <a href={nodeHref(node) ?? undefined} aria-label={`Open ${node.label}`}>
                    <circle data-network-action r={node.radius + 6} fill="transparent" />
                    <circle r={node.radius} fill={nodeColor(node)} filter="url(#network-glow)" />
                  </a>
                {:else}
                  <circle r={node.radius} fill={nodeColor(node)} filter="url(#network-glow)" />
                {/if}
                <text y={node.center ? 4 : node.radius + 18} text-anchor="middle" class:center-label={node.center}>
                  {node.center ? partyInitial(node.party) : node.external ? '@' : partyInitial(node.party)}
                </text>
              </g>
            {/each}
          </g>
        </g>
      </svg>
    {/if}

    {#if hover}
      <aside class="tooltip">
        {#if 'sourceNode' in hover}
          <span class="caption">{hover.direction} · {hover.interactionType} · {hover.topicLabel}</span>
          <strong>{hover.neighbor.name ?? hover.targetHandle}</strong>
          <span class="tooltip-metric">
            {integer(hover.postCount)} unique posts · {compact(hover.engagement)} engagement
            {#if rawInteractionLabel(hover)}
              · {rawInteractionLabel(hover)}
            {/if}
          </span>
          <span class="tooltip-dates">
            <time>{hover.firstSeen ?? 'Unknown start'}</time>
            <span aria-hidden="true">to</span>
            <time>{hover.lastSeen ?? 'Unknown end'}</time>
          </span>
        {:else}
          <span class="caption">{hover.center ? 'Selected legislator' : hover.external ? 'External handle' : 'Legislator'}</span>
          <strong>{hover.label}</strong>
          <span class="tooltip-metric">{hover.sublabel || hover.handle || 'No public metadata'}</span>
          <span class="tooltip-metric">{integer(hover.postCount)} selected posts · {compact(hover.engagement)} engagement</span>
        {/if}
      </aside>
    {/if}
  </div>

  <dialog
    bind:this={edgeDialog}
    class="edge-dialog"
    aria-labelledby="edge-modal-title"
    on:cancel={handleDialogCancel}
    on:close={handleDialogClose}
    on:click={(event) => {
      if (event.target === event.currentTarget) closeEdgeModal();
    }}
  >
    {#if selectedEdge}
      <div
        class="edge-modal"
        tabindex="-1"
      >
        <header class="edge-modal-head">
          <div>
            <div class="eyebrow"><FileText size={15} /> Edge post explorer</div>
            <h3 id="edge-modal-title">{edgeModalTitle(selectedEdge)}</h3>
            <p class="muted">
              {integer(selectedEdge.postCount)} unique posts · {compact(selectedEdge.engagement)} engagement · {selectedEdge.topicLabel}
              {#if rawInteractionLabel(selectedEdge)}
                · {rawInteractionLabel(selectedEdge)}
              {/if}
            </p>
          </div>
          <button type="button" class="close-button" on:click={closeEdgeModal} aria-label="Close edge posts">
            <X size={17} />
          </button>
        </header>

        {#key selectedEdge.graphKey}
          <div class="edge-modal-body">
            <PostExplorer
              title="Posts behind this edge"
              caption="Unique canonical posts behind this interaction edge; duplicate raw rows are collapsed."
              source="app_post_interactions"
              filters={edgeFilters(selectedEdge)}
              {apiBase}
              pageSize={18}
              sampleSize={6}
              initialMode="top"
              showSample={false}
              compact={true}
            />
          </div>
        {/key}
      </div>
    {/if}
  </dialog>
</section>

<style>
  .network {
    padding: 18px;
    overflow: hidden;
  }

  .network-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 14px;
  }

  .network-head h2 {
    margin-bottom: 6px;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-seal);
    font-family: var(--type-mono);
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 8px;
  }

  .network-stats,
  .viz-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 7px;
  }

  .network-stats span,
  .viz-toolbar span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 34px;
    border: 1px solid var(--color-rule);
    border-radius: 999px;
    padding: 6px 10px;
    background: var(--color-elevated);
    color: var(--color-mute);
    font-size: 0.82rem;
    line-height: 1;
    white-space: nowrap;
  }

  .viz-toolbar .toolbar-help {
    cursor: default;
    pointer-events: none;
    user-select: none;
  }

  .controls {
    display: grid;
    grid-template-columns:
      repeat(7, minmax(112px, 1fr))
      auto
      auto;
    gap: 8px;
    align-items: end;
    padding: 9px;
    border: 1px solid var(--color-rule);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-elevated), transparent 16%);
  }

  .search-control {
    grid-column: 1 / -1;
    min-width: 0;
  }

  .range {
    min-width: min(100%, 170px);
  }

  label {
    display: grid;
    gap: 4px;
    margin: 0;
  }

  label span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--color-mute);
    font-size: 0.74rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .field,
  select.field,
  input.field {
    width: 100%;
    height: 38px;
    min-height: 38px;
    padding: 7px 10px;
    margin: 0;
    overflow: hidden;
    font-size: 0.88rem;
    line-height: 1.1;
    text-overflow: ellipsis;
  }

  .search-field-wrap {
    position: relative;
    display: block;
    min-width: 0;
  }

  .search-field-icon {
    position: absolute;
    top: 50%;
    left: 11px;
    display: inline-flex;
    color: var(--color-mute);
    pointer-events: none;
    transform: translateY(-50%);
  }

  input.search-field {
    padding-left: 34px;
  }

  .range input {
    width: 100%;
    height: 38px;
    margin: 0;
    accent-color: var(--color-seal);
    cursor: pointer;
  }

  .range input[type='range'] {
    appearance: none;
    background: transparent;
  }

  .range input[type='range']::-webkit-slider-runnable-track {
    height: 6px;
    border: 1px solid color-mix(in srgb, var(--color-seal) 36%, var(--color-rule));
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-seal) 22%, var(--color-card));
  }

  .range input[type='range']::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    margin-top: -7px;
    border: 2px solid var(--color-card);
    border-radius: 999px;
    background: var(--color-seal);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-seal) 55%, var(--color-rule));
  }

  .range input[type='range']::-moz-range-track {
    height: 6px;
    border: 1px solid color-mix(in srgb, var(--color-seal) 36%, var(--color-rule));
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-seal) 22%, var(--color-card));
  }

  .range input[type='range']::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-card);
    border-radius: 999px;
    background: var(--color-seal);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-seal) 55%, var(--color-rule));
  }

  .icon-button {
    height: 38px;
    min-height: 38px;
    padding: 7px 10px;
    white-space: nowrap;
  }

  .controls > .icon-button {
    align-self: end;
  }

  .apply-button {
    color: var(--color-mute);
    border-color: var(--color-rule);
    background: color-mix(in srgb, var(--color-elevated), transparent 8%);
  }

  .apply-button.pending {
    color: var(--color-on-accent, #fff);
    border-color: color-mix(in srgb, var(--color-seal) 72%, var(--color-rule));
    background: var(--color-seal);
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--color-seal) 18%, transparent),
      var(--shadow-sm);
  }

  .apply-button:disabled {
    cursor: default;
    opacity: 0.72;
  }

  .apply-button.pending:disabled {
    opacity: 0.9;
  }

  .visually-hidden {
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

  .viz-shell {
    position: relative;
    margin-top: 12px;
    min-height: 520px;
    border: 1px solid var(--color-rule);
    border-radius: 8px;
    overflow: hidden;
    background:
      radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--color-seal), transparent 88%), transparent 32%),
      linear-gradient(180deg, color-mix(in srgb, var(--color-elevated), transparent 18%), var(--color-card));
  }

  .viz-toolbar {
    position: absolute;
    z-index: 2;
    top: 12px;
    left: 12px;
  }

  .viz-toolbar button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    min-height: 34px;
    padding: 0 11px;
    border-radius: 999px;
    font-size: 0.9rem;
    line-height: 1;
  }

  .viz-toolbar .zoom-button {
    width: 34px;
    padding: 0;
    font-size: 1.05rem;
  }

  .viz-toolbar .toolbar-button {
    min-width: 76px;
  }

  svg {
    width: 100%;
    height: min(68vh, 680px);
    min-height: 520px;
    cursor: grab;
    touch-action: none;
  }

  svg:active {
    cursor: grabbing;
  }

  path {
    fill: none;
    stroke-linecap: round;
    cursor: pointer;
    transition: opacity 160ms ease, stroke-width 160ms ease;
  }

  g[role="button"] {
    cursor: pointer;
  }

  g[role="button"]:hover path,
  g[role="button"]:focus-visible path {
    opacity: 0.95;
    outline: none;
    stroke-width: 10;
  }

  .muted-link,
  .dimmed {
    opacity: 0.12;
  }

  circle {
    stroke: var(--color-card);
    stroke-width: 2.5;
    transition: r 160ms ease, opacity 160ms ease, fill 160ms ease;
  }

  .center-node circle {
    stroke-width: 4;
  }

  .external-node circle {
    stroke-dasharray: 3 3;
  }

  text {
    pointer-events: none;
    fill: var(--color-party-label);
    font-family: var(--type-mono);
    font-size: 11px;
    font-weight: 800;
  }

  text:not(.center-label) {
    fill: var(--color-mute);
    font-size: 10px;
  }

  .tooltip {
    position: absolute;
    right: 12px;
    bottom: 12px;
    width: min(340px, calc(100% - 24px));
    display: grid;
    gap: 8px;
    padding: 11px;
    border: 1px solid color-mix(in srgb, var(--color-rule), transparent 12%);
    border-radius: 9px;
    background: color-mix(in srgb, var(--color-card), transparent 2%);
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(12px);
  }

  .tooltip strong {
    color: var(--color-ink);
    font-size: 0.96rem;
    line-height: 1.15;
  }

  .tooltip .caption {
    display: inline-flex;
    width: fit-content;
    max-width: 100%;
    align-items: center;
    padding: 3px 7px;
    overflow: hidden;
    color: var(--color-seal);
    font-family: var(--type-mono);
    font-size: 0.68rem;
    font-weight: 750;
    line-height: 1;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
    background: color-mix(in srgb, var(--color-seal) 9%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-seal) 24%, var(--color-rule));
    border-radius: 999px;
  }

  .tooltip-metric {
    color: var(--color-mute);
    font-size: 0.82rem;
    line-height: 1.25;
  }

  .tooltip-dates {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    align-items: center;
    color: var(--color-mute);
    font-size: 0.74rem;
  }

  .tooltip-dates time {
    display: inline-flex;
    min-height: 24px;
    align-items: center;
    padding: 3px 7px;
    color: var(--color-ink);
    font-family: var(--type-mono);
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
    background: var(--color-elevated);
    border: 1px solid var(--color-rule);
    border-radius: 999px;
  }

  .empty {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 6px;
    text-align: center;
    color: var(--color-mute);
  }

  .edge-dialog {
    width: min(1040px, calc(100vw - 32px));
    max-width: calc(100vw - 32px);
    max-height: calc(100dvh - 32px);
    padding: 0;
    margin: auto;
    color: var(--color-ink);
    background: transparent;
    border: 0;
    overflow: visible;
    overscroll-behavior: contain;
  }

  .edge-dialog[open] {
    display: grid;
    place-items: center;
  }

  .edge-dialog::backdrop {
    background: color-mix(in srgb, var(--color-modal-backdrop, #020617), transparent 20%);
    backdrop-filter: blur(11px);
  }

  .edge-modal {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-height: calc(100dvh - 32px);
    overflow: hidden;
    padding: 12px;
    border: 1px solid var(--color-rule);
    border-radius: 10px;
    background: var(--color-card);
    box-shadow: var(--shadow-lg);
  }

  .edge-modal-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 16px;
    flex: 0 0 auto;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--color-rule);
  }

  .edge-modal-head h3 {
    margin: 0 0 4px;
    font-size: clamp(1.05rem, 1.5vw, 1.35rem);
    line-height: 1.16;
  }

  .edge-modal-body {
    min-height: 0;
    overflow: auto;
    padding: 0 4px 2px 0;
    overscroll-behavior: contain;
  }

  .close-button {
    width: 38px;
    height: 38px;
    min-height: 38px;
    flex: 0 0 auto;
    display: inline-grid;
    place-items: center;
    padding: 0;
    border-radius: 999px;
  }

  @media (max-width: 1180px) {
    .controls {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .search-control {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 760px) {
    .network {
      padding: 12px;
    }

    .network-head {
      display: grid;
    }

    .controls {
      grid-template-columns: 1fr 1fr;
    }

    .controls label:first-child,
    .range {
      grid-column: 1 / -1;
    }

    .viz-shell {
      min-height: 460px;
    }

    svg {
      min-height: 460px;
    }

    .edge-dialog {
      width: calc(100vw - 16px);
      max-width: calc(100vw - 16px);
      max-height: calc(100dvh - 16px);
    }

    .edge-modal {
      max-height: calc(100dvh - 16px);
      padding: 10px;
    }

    .edge-modal-head {
      gap: 10px;
    }

    .edge-modal-head h3 {
      font-size: 1rem;
    }
  }
</style>
