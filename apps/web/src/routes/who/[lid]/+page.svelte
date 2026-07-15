<script lang="ts">
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import PanelHeader from '$lib/components/PanelHeader.svelte';
  import PostExplorer from '$lib/components/PostExplorer.svelte';
  import VoiceFingerprint from '$lib/components/VoiceFingerprint.svelte';
  import { compact, dateLabel, partyInitial } from '$lib/format';
  import { appPath } from '$lib/paths';
  export let data: any;
  $: profile = data.profile.data;
</script>

<svelte:head>
  <title>{profile.name} — CivicWatch</title>
</svelte:head>

<section class="container band">
  <Breadcrumbs items={[{ label: 'Look up', href: '/who' }, { label: profile.name }]} />
  <div class="profile-head">
    <div>
      <h1>{profile.name}</h1>
      <p class="muted">{profile.handle ? `@${profile.handle}` : 'No handle'} · {profile.state ?? '—'} · {profile.chamber ?? '—'}</p>
    </div>
    <span class="party-dot party-{profile.party ?? 'unknown'}">{partyInitial(profile.party)}</span>
  </div>
  <div class="grid grid-4">
    <div class="card"><span class="caption">Posts</span><strong class="number">{compact(profile.totalPosts)}</strong></div>
    <div class="card"><span class="caption">Engagement</span><strong class="number">{compact(profile.totalEngagement)}</strong></div>
    <div class="card"><span class="caption">Voting-record position</span><strong class="number">{profile.mrpIdeology?.toFixed?.(3) ?? '—'}</strong></div>
    <div class="card"><span class="caption">Coverage</span><strong>{dateLabel(profile.firstPostDate)} to {dateLabel(profile.lastPostDate)}</strong></div>
  </div>
  <div class="notice">Voting-record position is available for 3,335 of 5,927 legislators. Missing values are shown, not hidden.</div>
  <p class="compare-action"><a class="button" href={appPath(`/compare?slots=legislator:${profile.lid}`)}>Compare with…</a></p>
</section>

<section class="container split band">
  <VoiceFingerprint rows={data.fingerprint.data} />
  <aside class="card">
    <PanelHeader title="Public-record fields" caption="Unavailable public-record matches stay visible as dashes." source="legislators" />
    <dl>
      <dt>Party</dt><dd>{profile.party ?? '—'}</dd>
      <dt>District</dt><dd>{profile.districtName ?? profile.districtNum ?? '—'}</dd>
      <dt>First elected</dt><dd>{profile.yrElected ?? '—'}</dd>
      <dt>Race</dt><dd>{profile.race ?? '—'}</dd>
      <dt>Gender</dt><dd>{profile.gender ?? '—'}</dd>
    </dl>
  </aside>
</section>

<section class="container band">
  <PostExplorer
    title="Post explorer"
    caption="Switch between this legislator's most-engaged posts, newest posts, and representative samples."
    source="posts"
    initialTopPosts={data.topPosts.data}
    initialRecentPosts={data.posts.data}
    initialRecentCursor={data.posts.meta?.nextCursor ?? null}
    filters={{ lid: profile.lid }}
    pageSize={10}
    sampleSize={6}
  />
</section>

<style>
  .profile-head { display: flex; justify-content: space-between; gap: 16px; align-items: start; }
  .profile-head .party-dot { width: 42px; height: 42px; font-size: 18px; }
  .number { display: block; font-size: 1.6rem; margin-top: 6px; }
  .notice { margin-top: 16px; }
  dl { display: grid; grid-template-columns: 120px 1fr; gap: 8px 12px; }
  dt { color: var(--color-mute); }
  dd { margin: 0; }
</style>
