<script lang="ts">
  type PartyMode = 'both' | 'democratic' | 'republican';
  type ColorMode = 'volume' | 'contribution';

  interface Props {
    party?: PartyMode;
    colorMode?: ColorMode;
    compact?: boolean;
  }

  let {
    party = $bindable<PartyMode>('both'),
    colorMode = $bindable<ColorMode>('volume'),
    compact = false
  }: Props = $props();
</script>

<div class="party-controls" class:compact>
  <label>
    <span>Party:</span>
    <select bind:value={party} aria-label="Filter state posts by party">
      <option value="both">All parties</option>
      <option value="democratic">Democratic</option>
      <option value="republican">Republican</option>
    </select>
  </label>

  <label>
    <span>Color:</span>
    <select bind:value={colorMode} aria-label="Color states by">
      <option value="volume">Volume</option>
      <option value="contribution">Party contribution</option>
    </select>
  </label>

  {#if colorMode === 'contribution'}
    <small>
      Each party is scaled independently; blue = Democratic, red = Republican,
      purple = equal relative contribution.
    </small>
  {/if}
</div>

<style>
  .party-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 7px 10px;
    align-items: center;
    min-width: 0;
  }
  label {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    margin: 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.035em;
    line-height: 1;
    white-space: nowrap;
    min-width: 0;
    max-width: 100%;
  }
  select {
    width: auto;
    min-width: 116px;
    height: 30px;
    min-height: 30px;
    padding: 0 30px 0 9px;
    margin: 0;
    color: var(--color-ink, #1a1917);
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1;
    background-color: var(--color-card, #fff);
    border: 1px solid var(--color-rule, #d9d2c1);
    border-radius: 5px;
    box-shadow: none;
  }
  select:hover { border-color: var(--color-seal, #8a5a1a); }
  select:focus-visible { outline: 2px solid var(--color-seal, #8a5a1a); outline-offset: 2px; }
  small { flex: 1 1 100%; min-width: 0; max-width: 54ch; color: var(--color-mute, #6b6659); font-size: 0.66rem; line-height: 1rem; overflow-wrap: anywhere; }
  .compact select { height: 28px; min-height: 28px; }
  @media (max-width: 480px) {
    label { white-space: normal; }
    select { min-width: 0; max-width: 100%; }
  }
</style>
