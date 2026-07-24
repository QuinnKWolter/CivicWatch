<script lang="ts">
  type NormalizationMode = 'none' | 'population' | 'legislators';

  interface Props {
    value?: NormalizationMode;
    compact?: boolean;
  }

  let {
    value = $bindable<NormalizationMode>('none'),
    compact = false
  }: Props = $props();
</script>

<div class="normalization-control" class:compact>
  <label>
    <span>Normalize by:</span>
    <select bind:value aria-label="Normalize state values by">
      <option value="none">None</option>
      <option value="population">State population</option>
      <option value="legislators">Represented legislators</option>
    </select>
  </label>

  {#if value === 'population'}
    <small>
      Posts per 100,000 residents ·
      <a
        href="https://www.census.gov/newsroom/press-kits/2026/national-state-population-estimates.html"
        target="_blank"
        rel="noreferrer"
      >Census 2025</a>
    </small>
  {:else if value === 'legislators'}
    <small>Posts per legislator represented in this CivicWatch snapshot</small>
  {/if}
</div>

<style>
  .normalization-control {
    display: flex;
    flex-wrap: wrap;
    gap: 7px 10px;
    align-items: center;
    min-width: 0;
  }

  label {
    display: inline-flex;
    gap: 7px;
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
    min-width: 158px;
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
  select:focus-visible, a:focus-visible {
    outline: 2px solid var(--color-seal, #8a5a1a);
    outline-offset: 2px;
  }

  small {
    min-width: 0;
    max-width: 100%;
    color: var(--color-mute, #6b6659);
    font-size: 0.66rem;
    line-height: 1rem;
    overflow-wrap: anywhere;
  }

  small a { color: var(--color-seal, #8a5a1a); font-weight: 650; }
  .compact select { min-width: 146px; height: 28px; min-height: 28px; }

  @media (max-width: 480px) {
    label { white-space: normal; }
    select { min-width: 0; max-width: 100%; }
  }
</style>
