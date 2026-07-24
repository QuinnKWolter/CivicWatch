<script lang="ts">
  interface Props {
    topics?: any[];
    value?: string;
    loading?: boolean;
    onselect?: (value: string) => void;
  }

  let {
    topics = [],
    value = $bindable('all'),
    loading = false,
    onselect
  }: Props = $props();

  function selectTopic(event: Event) {
    value = (event.currentTarget as HTMLSelectElement).value;
    onselect?.(value);
  }
</script>

<label class="topic-control">
  <span>Topic:</span>
  <select value={value} onchange={selectTopic} disabled={loading} aria-label="Filter states by topic">
    <option value="all">All topics</option>
    {#each topics as topic (topic.topic)}
      <option value={String(topic.topic)}>{topic.topicLabel ?? topic.topic_label ?? topic.topic}</option>
    {/each}
  </select>
  {#if loading}<small role="status">Updating…</small>{/if}
</label>

<style>
  .topic-control {
    display: inline-flex;
    gap: 7px;
    align-items: center;
    width: fit-content;
    max-width: 100%;
    margin: 0;
    color: var(--color-mute, #6b6659);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.035em;
    line-height: 1;
  }
  select {
    width: auto;
    min-width: min(230px, 66vw);
    max-width: 100%;
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
  select:disabled { cursor: progress; opacity: 0.72; }
  small { color: var(--color-mute, #6b6659); font-size: 0.66rem; font-weight: 500; }
</style>
