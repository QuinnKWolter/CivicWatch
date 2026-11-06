<script lang="ts">
  import {
    GRAPH_CENTER,
    GRAPH_HEIGHT,
    GRAPH_WIDTH,
    PARTY_COLOR,
    PARTY_INITIAL,
    PARTY_NAME,
    PARTY_ORDER,
    centerBox,
    type GraphNode,
    type GraphTip
  } from '$lib/claims';

  type Center =
    | { kind: 'claim'; label: string }
    | { kind: 'legislator'; name: string; color: string; initial: string };

  interface Props {
    nodes?: GraphNode[];
    more?: GraphNode | null;
    center: Center;
    title: string;
    selectedKey?: string | null;
    empty?: [string, string] | null;
    showNeutral?: boolean;
    onnode?: (node: GraphNode) => void;
    onedge?: (node: GraphNode) => void;
    onmore?: () => void;
  }

  let {
    nodes = [],
    more = null,
    center,
    title,
    selectedKey = null,
    empty = null,
    showNeutral = false,
    onnode,
    onedge,
    onmore
  }: Props = $props();

  const titleId = $props.id();
  let tip = $state<GraphTip | null>(null);
  let shell = $state<HTMLDivElement | null>(null);

  const box = $derived(center.kind === 'claim' ? centerBox(center.label) : null);

  // On narrow screens the chart scrolls sideways; start each new graph centred on the claim.
  $effect(() => {
    void nodes.length;
    if (!shell) return;
    const overflow = shell.scrollWidth - shell.clientWidth;
    if (overflow > 0) shell.scrollLeft = overflow / 2;
  });

  function activate(event: KeyboardEvent, action: () => void) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    action();
  }

  function spokeStroke(node: GraphNode, stance: string) {
    return stance === 'spread' ? node.color : undefined;
  }
</script>

<div class="graph-shell" bind:this={shell}>
  {#if empty}
    <div class="empty" role="status">
      <strong>{empty[0]}</strong>
      <span>{empty[1]}</span>
    </div>
  {:else}
    <svg viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} role="group" aria-labelledby={titleId}>
      <title id={titleId}>{title}</title>

      <g class="spokes" aria-hidden="true">
        {#each nodes as node (node.key)}
          {#each node.spokes as spoke (spoke.stance)}
            <line
              class={`edge ${spoke.stance}`}
              class:dim={selectedKey !== null && selectedKey !== node.key}
              x1={spoke.x1}
              y1={spoke.y1}
              x2={spoke.x2}
              y2={spoke.y2}
              stroke={spokeStroke(node, spoke.stance)}
              stroke-width={spoke.width}
            />
          {/each}
        {/each}
      </g>

      {#each nodes as node (node.key)}
        <g class="item">
          <line
            class="edge-hit"
            x1={GRAPH_CENTER.x}
            y1={GRAPH_CENTER.y}
            x2={node.x}
            y2={node.y}
            role="button"
            tabindex="0"
            aria-label={node.edgeLabel}
            onclick={() => onedge?.(node)}
            onkeydown={(event) => activate(event, () => onedge?.(node))}
            onpointerenter={() => (tip = node.edgeTip)}
            onpointerleave={() => (tip = null)}
            onfocus={() => (tip = node.edgeTip)}
            onblur={() => (tip = null)}
          />
          <circle
            class="node"
            cx={node.x}
            cy={node.y}
            r={node.r}
            fill={node.fill}
            role="button"
            tabindex="0"
            aria-label={node.nodeLabel}
            onclick={() => onnode?.(node)}
            onkeydown={(event) => activate(event, () => onnode?.(node))}
            onpointerenter={() => (tip = node.nodeTip)}
            onpointerleave={() => (tip = null)}
            onfocus={() => (tip = node.nodeTip)}
            onblur={() => (tip = null)}
          />
          {#if node.initial}
            <text class="initial" x={node.x} y={node.y + 3.5} text-anchor="middle" aria-hidden="true">{node.initial}</text>
          {/if}
          <text class="label" text-anchor={node.anchor} aria-hidden="true">
            {#each node.label as line, index (index)}
              <tspan x={node.labelX} y={node.labelY + index * 14}>{line}</tspan>
            {/each}
          </text>
        </g>
      {/each}

      {#if more}
        <g class="item">
          <circle
            class="node more"
            cx={more.x}
            cy={more.y}
            r={more.r}
            role="button"
            tabindex="0"
            aria-label={more.nodeLabel}
            onclick={() => onmore?.()}
            onkeydown={(event) => activate(event, () => onmore?.())}
            onpointerenter={() => (tip = more?.nodeTip ?? null)}
            onpointerleave={() => (tip = null)}
            onfocus={() => (tip = more?.nodeTip ?? null)}
            onblur={() => (tip = null)}
          />
          <text class="initial more-initial" x={more.x} y={more.y + 4} text-anchor="middle" aria-hidden="true">+</text>
          <text class="label" text-anchor={more.anchor} x={more.labelX} y={more.labelY} aria-hidden="true">{more.label[0]}</text>
        </g>
      {/if}

      {#if box}
        <g aria-hidden="true">
          <rect class="center-box" x={box.x} y={box.y} width={box.width} height={box.height} rx="10" />
          {#each box.lines as line, index (index)}
            <text class="center-text" x={GRAPH_CENTER.x} y={line.y} text-anchor="middle">{line.text}</text>
          {/each}
        </g>
      {:else if center.kind === 'legislator'}
        <g aria-hidden="true">
          <circle class="node center-node" cx={GRAPH_CENTER.x} cy={GRAPH_CENTER.y} r="16" fill={center.color} />
          <text class="initial center-initial" x={GRAPH_CENTER.x} y={GRAPH_CENTER.y + 5} text-anchor="middle">{center.initial}</text>
          <text class="label center-name" x={GRAPH_CENTER.x} y={GRAPH_CENTER.y + 38} text-anchor="middle">{center.name}</text>
        </g>
      {/if}
    </svg>

    {#if tip}
      <div class="tooltip" role="status">
        <strong>{tip.title}</strong>
        <span>{tip.body}</span>
      </div>
    {/if}
  {/if}
</div>
{#if !empty}
  <p class="scroll-hint">Scroll sideways to see the whole network.</p>
{/if}

<ul class="legend" aria-label="How to read the network">
  {#each PARTY_ORDER as party (party)}
    <li>
      <span class="legend-dot" style={`background:${PARTY_COLOR[party]}`} aria-hidden="true">{PARTY_INITIAL[party]}</span>
      {PARTY_NAME[party]}
    </li>
  {/each}
  <li>
    <svg class="legend-line" viewBox="0 0 30 10" aria-hidden="true"><line class="edge spread" x1="1" y1="5" x2="29" y2="5" stroke="var(--color-mute)" stroke-width="3" /></svg>
    Spreads (party color)
  </li>
  <li>
    <svg class="legend-line" viewBox="0 0 30 10" aria-hidden="true"><line class="edge debunk" x1="1" y1="5" x2="29" y2="5" stroke-width="3" /></svg>
    Debunks
  </li>
  {#if showNeutral}
    <li>
      <svg class="legend-line" viewBox="0 0 30 10" aria-hidden="true"><line class="edge neutral" x1="1" y1="5" x2="29" y2="5" stroke-width="3" /></svg>
      Neutral
    </li>
  {/if}
  <li>Line width = number of posts</li>
</ul>

<style>
  .graph-shell {
    position: relative;
    min-width: 0;
    overflow-x: auto;
    border: 1px solid var(--color-rule);
    border-radius: 8px;
    background: var(--color-elevated);
  }

  svg {
    display: block;
    width: 100%;
    min-width: 600px;
    height: auto;
  }

  .edge {
    fill: none;
    stroke-linecap: round;
    transition: opacity 120ms ease;
  }

  .edge.spread { opacity: 0.75; }
  .edge.debunk { stroke: var(--color-mute); stroke-dasharray: 7 5; stroke-linecap: butt; opacity: 0.9; }
  .edge.neutral { stroke: var(--color-rule-strong); opacity: 0.9; }
  .edge.dim { opacity: 0.22; }

  .edge-hit {
    stroke: transparent;
    stroke-width: 16;
    cursor: pointer;
    outline: none;
  }

  .edge-hit:hover,
  .edge-hit:focus-visible {
    stroke: color-mix(in srgb, var(--color-seal) 16%, transparent);
  }

  .node {
    stroke: var(--color-elevated);
    stroke-width: 2;
    cursor: pointer;
    outline: none;
    transition: stroke 120ms ease;
  }

  .node:hover,
  .node:focus-visible {
    stroke: var(--color-seal);
    stroke-width: 3;
  }

  .node.more {
    fill: var(--color-card);
    stroke: var(--color-ink);
    stroke-dasharray: 3 3;
  }

  .center-node { cursor: default; }
  .center-node:hover { stroke: var(--color-elevated); stroke-width: 2; }

  .initial {
    fill: var(--color-party-label);
    font-family: var(--type-mono);
    font-size: 10px;
    font-weight: 700;
    pointer-events: none;
  }

  .more-initial { fill: var(--color-ink); font-size: 12px; }
  .center-initial { font-size: 14px; }

  .label {
    fill: var(--color-ink);
    font-family: var(--type-body);
    font-size: 12px;
    paint-order: stroke;
    stroke: var(--color-elevated);
    stroke-width: 3px;
    pointer-events: none;
  }

  .center-name { font-size: 14px; font-weight: 700; }

  .center-box { fill: var(--color-ink); }

  .center-text {
    fill: var(--color-elevated);
    font-family: var(--type-body);
    font-size: 14px;
    font-weight: 600;
  }

  .tooltip {
    position: absolute;
    top: 12px;
    right: 12px;
    display: grid;
    gap: 4px;
    width: min(280px, calc(100% - 24px));
    padding: 10px 11px;
    color: var(--color-ink);
    font-size: 0.8rem;
    line-height: 1.3;
    background: color-mix(in srgb, var(--color-card) 97%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-seal) 28%, var(--color-rule));
    border-radius: 6px;
    box-shadow: var(--shadow-md);
    pointer-events: none;
  }

  .tooltip span { color: var(--color-mute); }

  .empty {
    display: grid;
    gap: 4px;
    place-content: center;
    min-height: 420px;
    padding: 24px;
    color: var(--color-mute);
    text-align: center;
  }

  .empty strong { color: var(--color-ink); }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    align-items: center;
    padding: 0;
    margin: 10px 2px 0;
    color: var(--color-mute);
    font-size: 0.78rem;
    list-style: none;
  }

  .legend li {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    margin: 0;
    white-space: nowrap;
  }

  .legend-dot {
    display: inline-grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 999px;
    color: var(--color-party-label);
    font-family: var(--type-mono);
    font-size: 9px;
    font-weight: 700;
  }

  .legend-line {
    width: 30px;
    min-width: 0;
    height: 10px;
  }

  .scroll-hint {
    display: none;
    margin: 6px 2px 0;
    color: var(--color-mute);
    font-size: 0.74rem;
  }

  @media (max-width: 660px) {
    .scroll-hint { display: block; }
  }

  @media (prefers-reduced-motion: reduce) {
    .edge,
    .node { transition: none; }
  }
</style>
