<script lang="ts">
  import { BarChart3, Building2, Landmark, LineChart, Repeat2, Scale, ScrollText, ShieldAlert, Siren, UsersRound, Vote } from 'lucide-svelte';
  import TopicIcon from '$lib/components/TopicIcon.svelte';
  import { appendDrilldownContext, type DrilldownContext } from '$lib/drilldown';
  import { withBase } from '$lib/paths';

  interface Props { rows?: any[]; featuredPosts?: any[]; events?: any[]; showEvents?: boolean; bucket?: 'day' | 'week' | 'month'; context?: DrilldownContext; }
  let { rows = [], featuredPosts = [], events = [], showEvents = false, bucket = 'day', context = {} }: Props = $props();
  let mode = $state<'bar' | 'line'>('bar');
  let metric = $state<'post_count' | 'engagement'>('post_count');
  let active: any = $state(null);
  let activeEvent: any = $state(null);
  const points = $derived(rows.map((row) => ({ date: String(row.date), posts: Number(row.post_count) || 0, engagement: Number(row.engagement) || 0 })));
  const maximum = $derived(Math.max(1, ...points.map((point) => metric === 'post_count' ? point.posts : point.engagement)));
  const width = 1000, height = 300, left = 48, right = 18, top = 22, bottom = 42;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const x = (index: number) => left + (index + .5) * plotWidth / Math.max(1, points.length);
  const value = (point: any) => metric === 'post_count' ? point.posts : point.engagement;
  const y = (point: any) => top + plotHeight * (1 - value(point) / maximum);
  const path = $derived(points.map((point, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(point)}`).join(' '));
  const dayHref = (point: any) => {
    const start = new Date(`${point.date}T00:00:00Z`);
    const end = new Date(start);
    if (bucket === 'week') end.setUTCDate(end.getUTCDate() + 6);
    else if (bucket === 'month') end.setUTCMonth(end.getUTCMonth() + 1, 0);
    else { start.setUTCDate(start.getUTCDate() - 3); end.setUTCDate(end.getUTCDate() + 3); }
    return withBase(appendDrilldownContext(`/moment?from=${start.toISOString().slice(0, 10)}&to=${end.toISOString().slice(0, 10)}`, context));
  };
  const label = (point: any) => `${new Date(`${point.date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}: ${value(point).toLocaleString()} ${metric === 'post_count' ? 'posts' : 'engagements'}`;
  const postDate = (post: any) => String(post.createdAt ?? post.created_at ?? '').slice(0, 10);
  const postName = (post: any) => post.legislator?.name ?? post.name ?? 'Legislator';
  const postText = (post: any) => String(post.text ?? post.fullText ?? 'Post text unavailable').slice(0, 180);
  const shareGroup = (post: any) => post.shareGroup ?? post.share_group ?? null;
  const shareStats = (post: any) => {
    const group = shareGroup(post);
    const postCount = Number(group?.postCount ?? group?.post_count ?? 0) || 0;
    const legislatorCount = Number(group?.legislatorCount ?? group?.legislator_count ?? group?.sharerCount ?? 0) || 0;
    if (postCount <= 1 && legislatorCount <= 1) return null;
    return {
      postCount,
      legislatorCount,
      label: `${postCount.toLocaleString()} duplicate ${postCount === 1 ? 'post' : 'posts'} from ${legislatorCount.toLocaleString()} ${legislatorCount === 1 ? 'legislator' : 'legislators'}`
    };
  };
  const profileHref = (post: any) => {
    const lid = post.legislator?.lid ?? post.lid;
    return lid ? withBase(appendDrilldownContext(`/who/${encodeURIComponent(lid)}`, context)) : null;
  };
  const timelineStart = $derived(points.length ? Date.parse(`${points[0].date}T00:00:00Z`) : 0);
  const timelineEnd = $derived(points.length ? Date.parse(`${points.at(-1)?.date}T00:00:00Z`) : 1);
  const eventMarkers = $derived.by(() => showEvents ? events.map((event, index) => {
    const start = Date.parse(`${event.startDate}T00:00:00Z`);
    const end = Date.parse(`${event.endDate ?? event.startDate}T00:00:00Z`);
    const span = Math.max(1, timelineEnd - timelineStart);
    const left = Math.max(0, Math.min(100, (start - timelineStart) / span * 100));
    const right = Math.max(left, Math.min(100, (end - timelineStart) / span * 100));
    const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
    return { ...event, left, width: Math.max(.3, right - left), lane: index % 4, days };
  }).filter((event) => event.left <= 100 && event.left + event.width >= 0) : []);
</script>

<figure class="timeline">
  <figcaption>
    <div><p class="eyebrow">{bucket === 'day' ? 'Daily' : bucket === 'week' ? 'Weekly' : 'Monthly'} pulse</p><h2>Activity across this moment</h2><p>Resolution adapts to the selected range. Hover for exact values; select a bin to focus it.</p></div>
    <div class="tools">
      <label><span>Measure</span><select bind:value={metric}><option value="post_count">Posts</option><option value="engagement">Engagement</option></select></label>
      <div class="mode" aria-label="Chart type"><button type="button" class:active={mode === 'bar'} onclick={() => mode = 'bar'}><BarChart3 size={15}/> Bars</button><button type="button" class:active={mode === 'line'} onclick={() => mode = 'line'}><LineChart size={15}/> Line</button></div>
    </div>
    {#if featuredPosts.length}
      <div class="story-rail" aria-label="High-engagement posts across this moment">
        {#each featuredPosts.slice(0, 8) as post}
          {@const stats = shareStats(post)}
          <article>
            <time>{postDate(post)}</time>
            <strong>{postName(post)}</strong>
            {#if stats}
              <span class="share-label" aria-label={stats.label} title={stats.label}>
                <span><Repeat2 size={11}/><b>{stats.postCount.toLocaleString()}</b><em>dupes</em></span>
                <span><b>{stats.legislatorCount.toLocaleString()}</b><UsersRound size={11}/></span>
              </span>
            {/if}
            <p>{postText(post)}</p>
            {#if profileHref(post)}<a href={profileHref(post) ?? undefined}>Explore this voice</a>{/if}
          </article>
        {/each}
      </div>
    {/if}
  </figcaption>
  {#if points.length}
    <div class="chart-shell">
      {#if eventMarkers.length}
        <div class="event-layer" aria-label="Curated moments in the archive">
          {#if activeEvent}<span class="event-shade" style={`--event-left:${activeEvent.left}%;--event-width:${activeEvent.width}%`}></span>{/if}
          {#each eventMarkers as event (event.eventId)}
            <a class="event-bracket" href={event.href} style={`--event-left:${event.left}%;--event-width:${event.width}%;--event-lane:${event.lane}`} aria-label={`${event.name}, ${event.startDate}${event.endDate ? ` through ${event.endDate}` : ''}. Select this curated moment.`} onpointerenter={() => activeEvent = event} onpointerleave={() => activeEvent = null} onfocus={() => activeEvent = event} onblur={() => activeEvent = null}>
              <span class="bracket-line"></span><span class="event-glyph">{#if event.category === 'elections'}<Vote size={11}/>{:else if event.category === 'scotus'}<Scale size={11}/>{:else if event.category === 'legislation'}<ScrollText size={11}/>{:else if event.category === 'legislative_institution'}<Building2 size={11}/>{:else if event.category === 'mass_violence'}<ShieldAlert size={11}/>{:else if event.category === 'crises'}<Siren size={11}/>{:else}<Landmark size={11}/>{/if}</span>
              <span class="event-popover"><strong>{event.name}</strong><small>{event.startDate}{event.endDate ? ` – ${event.endDate}` : ''}</small><span><b>{event.category?.replaceAll?.('_', ' ')}</b><i>{event.days} {event.days === 1 ? 'day' : 'days'}</i></span>{#if event.topTopics?.length}<span class="event-topics">{#each event.topTopics as topic}<span title={`${topic.topicLabel}: ${Number(topic.postCount).toLocaleString()} posts`}><TopicIcon label={topic.topicLabel} size={15}/><em>{topic.topicLabel}</em><i>{Number(topic.postCount).toLocaleString()}</i></span>{/each}</span>{/if}</span>
            </a>
          {/each}
        </div>
      {/if}
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily activity timeline">
        <line class="axis" x1={left} x2={width-right} y1={top+plotHeight} y2={top+plotHeight}/>
        <text x={left-8} y={top+4} text-anchor="end">{maximum.toLocaleString()}</text><text x={left-8} y={top+plotHeight+4} text-anchor="end">0</text>
        {#if mode === 'line'}<path class="trend" d={path}/>{/if}
        {#each points as point, index (point.date)}
          <a href={dayHref(point)} aria-label={`${label(point)}. Focus this day.`} onpointerenter={() => active = point} onpointerleave={() => active = null} onfocus={() => active = point} onblur={() => active = null}>
            {#if mode === 'bar'}<rect class="mark" x={x(index)-Math.max(2, plotWidth/points.length*.34)} y={y(point)} width={Math.max(4, plotWidth/points.length*.68)} height={top+plotHeight-y(point)} rx="2"/>
            {:else}<circle class="point" cx={x(index)} cy={y(point)} r="4"/>{/if}
          </a>
        {/each}
        <text x={left} y={height-9}>{points[0].date}</text><text x={width-right} y={height-9} text-anchor="end">{points.at(-1)?.date}</text>
      </svg>
      {#if active}<div class="tooltip"><strong>{active.date}</strong><span>{active.posts.toLocaleString()} posts</span><span>{active.engagement.toLocaleString()} engagements</span></div>{/if}
    </div>
  {:else}<p class="empty">No daily activity matches these filters.</p>{/if}
</figure>

<style>
  .timeline { min-width:0; margin:0; padding:16px; background:var(--color-card); border:1px solid var(--color-rule); border-radius:7px; }
  figcaption { display:flex; flex-wrap:wrap; gap:16px; align-items:end; justify-content:space-between; }
  h2 { margin:0; } figcaption p { margin:4px 0 0; color:var(--color-mute); font-size:.82rem; }
  .eyebrow { color:var(--color-seal); font-size:.65rem; font-weight:750; letter-spacing:.08em; text-transform:uppercase; }
  .tools { display:flex; flex-wrap:wrap; gap:8px; align-items:end; }
  label { display:grid; gap:3px; margin:0; } label span { color:var(--color-mute); font-size:.65rem; font-weight:700; text-transform:uppercase; }
  select { min-height:34px; margin:0; padding-block:4px; }
  .mode { display:flex; gap:3px; padding:3px; border:1px solid var(--color-rule); border-radius:999px; }
  .mode button { display:flex; gap:5px; align-items:center; min-height:28px; padding:4px 9px; border:0; border-radius:999px; background:transparent; box-shadow:none; }
  .mode button.active { color:var(--color-ink); background:var(--color-elevated); box-shadow:0 1px 3px rgb(0 0 0/.1); }
  .chart-shell { position:relative; margin-top:14px; padding-top:12px; overflow-x:auto; }
  svg { display:block; min-width:720px; width:100%; height:auto; }
  .axis { stroke:var(--color-rule); } text { fill:var(--color-mute); font-size:11px; }
  .mark,.point { fill:var(--color-seal); opacity:.75; transition:opacity 120ms ease; }
  .trend { fill:none; stroke:var(--color-seal); stroke-width:2.5; }
  a:hover .mark,a:focus .mark,a:hover .point,a:focus .point { opacity:1; }
  .tooltip { position:absolute; top:12px; right:12px; display:grid; gap:2px; padding:8px 10px; font-size:.7rem; background:color-mix(in srgb,var(--color-card) 96%,transparent); border:1px solid var(--color-rule); border-radius:5px; box-shadow:0 8px 24px rgb(0 0 0/.14); pointer-events:none; }
  .tooltip span { color:var(--color-mute); } .empty { padding:30px; text-align:center; color:var(--color-mute); }
  .event-layer { position:absolute; top:18px; right:1.8%; left:4.8%; z-index:5; height:58px; min-width:650px; overflow:visible; pointer-events:none; }
  .event-shade { position:absolute; top:10px; left:var(--event-left); z-index:-1; width:max(var(--event-width), 5px); height:232px; pointer-events:none; background:linear-gradient(to bottom,color-mix(in srgb,var(--color-seal) 22%,transparent),color-mix(in srgb,var(--color-seal) 5%,transparent)); border-inline:1px solid color-mix(in srgb,var(--color-seal) 42%,transparent); animation:event-in 140ms ease-out; }
  .event-bracket { position:absolute; top:calc(var(--event-lane) * 11px); left:var(--event-left); width:max(var(--event-width), 5px); height:10px; color:var(--color-seal); pointer-events:auto; text-decoration:none; }
  .bracket-line { position:absolute; inset:0; border:1px solid currentColor; border-bottom:0; opacity:.62; }
  .bracket-line::before,.bracket-line::after { position:absolute; top:8px; width:1px; height:230px; content:''; background:linear-gradient(to bottom,currentColor,color-mix(in srgb,currentColor 12%,transparent)); opacity:.36; }
  .bracket-line::before { left:-1px; } .bracket-line::after { right:-1px; }
  .event-glyph { position:absolute; top:-8px; left:50%; display:grid; width:19px; height:19px; place-items:center; color:var(--color-card); background:var(--color-seal); border:2px solid var(--color-card); border-radius:999px; transform:translateX(-50%); box-shadow:0 0 0 1px var(--color-seal); transition:transform 140ms ease,box-shadow 140ms ease,background 140ms ease; }
  .event-popover { position:absolute; top:15px; left:50%; z-index:20; display:none; gap:3px; width:230px; padding:10px; color:var(--color-ink); background:var(--color-card); border:1px solid var(--color-rule); border-radius:6px; box-shadow:0 12px 30px rgb(0 0 0/.18); transform:translateX(-50%); }
  .event-popover strong { font-size:.78rem; line-height:1.05rem; } .event-popover small { color:var(--color-mute); font-family:var(--font-mono); font-size:.62rem; }
  .event-popover > span { display:flex; gap:6px; align-items:center; margin-top:3px; }
  .event-popover b,.event-popover i { padding:3px 6px; font-size:.6rem; font-style:normal; font-weight:650; background:var(--color-elevated); border:1px solid var(--color-rule); border-radius:999px; text-transform:capitalize; }
  .event-topics { display:grid !important; gap:4px !important; }
  .event-topics > span { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:6px; align-items:center; min-width:0; }
  .event-topics em { overflow:hidden; color:var(--color-mute); font-size:.62rem; font-style:normal; text-overflow:ellipsis; white-space:nowrap; }
  .event-topics i { padding:0; border:0; background:transparent; font-family:var(--font-mono); }
  .event-bracket:hover,.event-bracket:focus-visible { z-index:30; color:var(--color-seal); }
  .event-bracket:hover .bracket-line,.event-bracket:focus-visible .bracket-line { border-width:2px; opacity:1; filter:drop-shadow(0 2px 4px color-mix(in srgb,var(--color-seal) 35%,transparent)); }
  .event-bracket:hover .event-glyph,.event-bracket:focus-visible .event-glyph { color:var(--color-card); background:color-mix(in srgb,var(--color-seal) 78%,var(--color-ink)); transform:translateX(-50%) scale(1.3); box-shadow:0 0 0 3px color-mix(in srgb,var(--color-seal) 22%,transparent),0 6px 16px rgb(0 0 0/.24); }
  .event-bracket:hover .event-popover,.event-bracket:focus-visible .event-popover { display:grid; }
  @keyframes event-in { from { opacity:0; } to { opacity:1; } }
  .story-rail { display:grid; grid-auto-columns:minmax(210px, 1fr); grid-auto-flow:column; gap:8px; margin-top:10px; padding-bottom:4px; overflow-x:auto; scroll-snap-type:x proximity; }
  .story-rail article { display:grid; align-content:start; gap:5px; min-height:150px; padding:11px; border:1px solid var(--color-rule); border-radius:6px; background:var(--color-elevated); scroll-snap-align:start; }
  .story-rail time { color:var(--color-seal); font-family:var(--font-mono); font-size:.66rem; }
  .story-rail strong { font-size:.78rem; } .story-rail p { margin:0; color:var(--color-mute); font-size:.72rem; line-height:1.05rem; }
  .share-label { display:inline-flex; width:fit-content; overflow:hidden; color:var(--color-mute); background:color-mix(in srgb,var(--color-card) 72%,transparent); border:1px solid color-mix(in srgb,var(--color-seal) 23%,var(--color-rule)); border-radius:999px; }
  .share-label span { display:inline-flex; gap:3px; align-items:center; min-height:20px; padding:2px 6px; font-size:.6rem; font-weight:700; line-height:.82rem; white-space:nowrap; }
  .share-label span:first-child { color:var(--color-seal); background:color-mix(in srgb,var(--color-seal) 9%,transparent); }
  .share-label span + span { border-left:1px solid color-mix(in srgb,var(--color-seal) 18%,var(--color-rule)); }
  .share-label b { color:var(--color-ink); font-family:var(--font-mono); font-size:.66rem; font-variant-numeric:tabular-nums; }
  .share-label em { font-style:normal; }
  .story-rail a { margin-top:auto; font-size:.7rem; font-weight:700; }
</style>
