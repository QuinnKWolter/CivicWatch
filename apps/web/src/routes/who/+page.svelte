<script lang="ts">
  import AsyncLegislatorBrowser from '$lib/components/AsyncLegislatorBrowser.svelte';
  import FilterChips from '$lib/components/FilterChips.svelte';
  import NoResultsPanel from '$lib/components/NoResultsPanel.svelte';
  import { appPath } from '$lib/paths';
  export let data: any;
  $: filters = [
    ...(data.q ? [{ label: 'Search', value: data.q, href: `/who?state=${data.state ?? ''}&party=${data.party ?? ''}` }] : []),
    ...(data.state ? [{ label: 'State', value: data.state, href: `/who?q=${data.q ?? ''}&party=${data.party ?? ''}` }] : []),
    ...(data.party ? [{ label: 'Party', value: data.party, href: `/who?q=${data.q ?? ''}&state=${data.state ?? ''}` }] : [])
  ];
</script>

<section class="container band">
  <h1>Look up a legislator</h1>
  <p class="muted">Search by name, handle, state, or district — or scroll to browse.</p>
  <FilterChips {filters} clearHref={appPath('/who')} />
  <AsyncLegislatorBrowser
    initialLegislators={data.legislators.data}
    initialQ={data.q ?? ''}
    initialState={data.state ?? ''}
    initialParty={data.party ?? ''}
  />
  {#if data.legislators.data.length === 0}
    <NoResultsPanel
      title="No legislators match"
      message={`Nothing matches this lookup. Try a name, a handle without @, or a two-letter state code.`}
      href={appPath('/who')}
    />
  {/if}
  <div class="notice">
    Missing fields are shown as <span class="no-data">—</span>; roughly 2,278 accounts have no public-records match.
  </div>
</section>

<style>
  .notice { margin-bottom: 16px; }
</style>
