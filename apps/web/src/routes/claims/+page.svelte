<script lang="ts">
  import { page } from '$app/state';
  import ClaimNetwork from '$lib/components/ClaimNetwork.svelte';
  import { integer } from '$lib/format';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const network = $derived(data.claims.data);
  const factCheckCount = $derived(network.clusters.reduce((sum, cluster) => sum + cluster.factChecks.length, 0));
  const syntheticLegislators = $derived(network.legislators.some((legislator) => legislator.synthetic));
  const syntheticPosts = $derived(network.posts.some((post) => post.synthetic));
</script>

<svelte:head>
  <title>Fact-checked claims — CivicWatch</title>
</svelte:head>

<section class="container band">
  <h1>Trace a claim</h1>
  <p class="muted lede">
    Fact-checked claims and the legislators who posted about them. Pick a topic and a claim: the claim sits in the
    middle, linked to each legislator who posted about it. Thicker lines mean more posts. Select a legislator to see
    which other claims they posted about, or a line to read the posts.
  </p>
  {#if syntheticLegislators || syntheticPosts}
    <p class="notice">
      <strong>Fact-checks are real; posts and legislators are synthetic.</strong>
      The fact-checks come from the Google Fact Check API. The posts, names and stances were made up to test this
      interface and say nothing about real legislators or parties.
    </p>
  {/if}
  <div class="grid grid-4 stats">
    <div class="card"><span class="caption">Claims</span><strong class="number">{integer(network.clusters.length)}</strong></div>
    <div class="card"><span class="caption">Fact-checks</span><strong class="number">{integer(factCheckCount)}</strong></div>
    <div class="card">
      <span class="caption">Legislators{syntheticLegislators ? ' (synthetic)' : ''}</span>
      <strong class="number">{integer(network.legislators.length)}</strong>
    </div>
    <div class="card">
      <span class="caption">Posts{syntheticPosts ? ' (synthetic)' : ''}</span>
      <strong class="number">{integer(network.posts.length)}</strong>
    </div>
  </div>
</section>

<section class="container band">
  <ClaimNetwork
    data={network}
    initialClaim={page.url.searchParams.get('claim')}
    initialLid={page.url.searchParams.get('lid')}
    initialPeriod={page.url.searchParams.get('period')}
  />
</section>

<section class="container band notes">
  <h2>About this data</h2>
  <p>
    <strong>Fact-checks.</strong> Google Fact Check Tools API, claims dated 2020 to 2021 or undated and rated false or
    misleading, grouped into clusters by keyword rules. Each claim lists every fact-check in its cluster.
  </p>
  {#if syntheticPosts}
    <p>
      <strong>Posts.</strong> Synthetic, 2020 to 2021. In the real version each line will come from legislators' posts
      matched to a claim, with stance labeled as spreading, debunking or neutral.
    </p>
  {/if}
</section>

<style>
  .lede {
    max-width: 78ch;
  }

  .notice {
    max-width: 92ch;
    margin-block: 16px 0;
  }

  .stats {
    margin-top: 20px;
  }

  .number {
    display: block;
    margin-top: 6px;
    font-family: var(--type-mono);
    font-size: 1.6rem;
  }

  .notes {
    color: var(--color-mute);
    font-size: 0.86rem;
  }

  .notes h2 {
    color: var(--color-ink);
    font-size: 1.1rem;
  }

  .notes p {
    max-width: 84ch;
    margin-bottom: 8px;
  }

  @media (max-width: 900px) {
    .stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
