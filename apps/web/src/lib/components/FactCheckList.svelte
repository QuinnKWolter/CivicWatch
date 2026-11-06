<script lang="ts">
  import { ExternalLink } from 'lucide-svelte';
  import { dateText, truncate, type FactCheck } from '$lib/claims';

  interface Props {
    factChecks?: FactCheck[];
    initialCount?: number;
  }

  let { factChecks = [], initialCount = 4 }: Props = $props();

  const headingId = $props.id();
  let expanded = $state(false);

  const sorted = $derived(
    [...factChecks].sort((a, b) => (a.claimDate || '9999').localeCompare(b.claimDate || '9999'))
  );
  const visible = $derived(expanded ? sorted : sorted.slice(0, initialCount));
</script>

<section class="fact-checks" aria-labelledby={headingId}>
  <h3 id={headingId}>Fact-checks <span class="count">{sorted.length}</span></h3>
  <ul>
    {#each visible as check (check.id)}
      <li>
        <div class="top">
          <span class="publisher">{check.publisher ?? 'Unknown fact-checker'}</span>
          <span class="rating" class:false={check.ratingNorm === 'false'} title={check.rating ?? 'No rating'}>
            {truncate(check.rating ?? 'No rating', 34)}
          </span>
        </div>
        <p class="claim">“{check.claim}”</p>
        <p class="when">{check.claimant ? `${check.claimant}, ` : ''}{dateText(check.claimDate ?? check.reviewDate)}</p>
        {#if check.url}
          <a href={check.url} target="_blank" rel="noopener noreferrer">
            Read the fact-check <ExternalLink size={12} aria-hidden="true" />
          </a>
        {/if}
      </li>
    {/each}
  </ul>
  {#if sorted.length > initialCount}
    <button type="button" class="more" onclick={() => (expanded = !expanded)}>
      {expanded ? 'Show fewer' : `Show all ${sorted.length}`}
    </button>
  {/if}
</section>

<style>
  .fact-checks {
    padding-top: 14px;
    margin-top: 16px;
    border-top: 1px solid var(--color-rule);
  }

  h3 {
    display: flex;
    gap: 8px;
    align-items: baseline;
    margin: 0 0 6px;
    font-size: 0.95rem;
  }

  .count {
    color: var(--color-mute);
    font-family: var(--type-mono);
    font-size: 0.78rem;
    font-weight: 500;
  }

  ul {
    padding: 0;
    margin: 0;
    list-style: none;
  }

  li {
    padding: 10px 0;
    margin: 0;
    font-size: 0.86rem;
    border-bottom: 1px solid var(--color-rule);
  }

  li:last-child { border-bottom: 0; }

  .top {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 8px;
    align-items: baseline;
  }

  .publisher { font-weight: 650; }

  .rating {
    display: inline-block;
    max-width: 100%;
    padding: 1px 8px;
    overflow: hidden;
    color: var(--color-ink);
    font-family: var(--type-mono);
    font-size: 0.68rem;
    font-weight: 700;
    line-height: 1.2rem;
    text-overflow: ellipsis;
    white-space: nowrap;
    border: 1px solid var(--color-ink);
    border-radius: 999px;
  }

  .rating.false {
    color: var(--color-card);
    background: var(--color-ink);
  }

  .claim { margin: 5px 0 3px; line-height: 1.4; }

  .when {
    margin: 0 0 4px;
    color: var(--color-mute);
    font-size: 0.76rem;
  }

  a {
    display: inline-flex;
    gap: 4px;
    align-items: center;
    font-size: 0.8rem;
  }

  .more {
    min-height: 32px;
    padding: 4px 10px;
    font-size: 0.8rem;
    box-shadow: none;
  }

  .more:hover { transform: none; box-shadow: none; }
</style>
