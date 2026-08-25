<script lang="ts">
  import AsyncLegislatorBrowser from '$lib/components/AsyncLegislatorBrowser.svelte';
  import ChamberView from '$lib/components/ChamberView.svelte';
  import PanelHeader from '$lib/components/PanelHeader.svelte';
  export let data: any;
</script>

<section class="container band">
  <h1>Look up a legislator</h1>
  <p class="muted">Search by name, handle, state, or district — or scroll to browse.</p>
  <AsyncLegislatorBrowser
    initialLegislators={data.legislators.data}
    initialQ={data.q ?? ''}
    initialState={data.state ?? ''}
    initialParty={data.party ?? ''}
    initialChamber={data.chamber ?? ''}
    initialTotal={data.legislators.meta?.total ?? null}
    resultLimit={6000}
    showLookup={false}
    syncTableUrl
  >
    {#snippet afterTable(filteredLegislators)}
      <section class="chamber-rollcall card">
        <PanelHeader
          title="Chamber roll call"
          caption="Roll-call view for the currently filtered legislator table."
          count={filteredLegislators.length}
          compact
        />

        <ChamberView legislators={filteredLegislators} />
      </section>
    {/snippet}
  </AsyncLegislatorBrowser>
  <div class="notice">
    Missing fields are shown as <span class="no-data">—</span>; roughly 2,278 accounts have no public-records match.
  </div>
</section>

<style>
  .notice { margin-bottom: 16px; }

  .chamber-rollcall {
    min-width: 0;
    margin-block: 16px 18px;
    overflow: hidden;
  }
</style>
