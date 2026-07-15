<script lang="ts">
  import {
    Banknote,
    BookOpen,
    BriefcaseBusiness,
    Building2,
    CircleHelp,
    Earth,
    GraduationCap,
    HeartPulse,
    Home,
    Landmark,
    Leaf,
    Megaphone,
    Scale,
    Shield,
    Users
  } from 'lucide-svelte';

  interface Props {
    label?: string | null;
    size?: number;
    decorative?: boolean;
  }

  let {
    label = null,
    size = 15,
    decorative = true
  }: Props = $props();

  const kind = $derived(iconKind(label));
  const accessibleLabel = $derived(
    decorative ? undefined : `${label ?? 'Topic'} topic`
  );

  function iconKind(value: string | null): string {
    const text = String(value ?? '').toLocaleLowerCase('en-US');

    if (/civil|rights|justice|law|court|crime|polic/.test(text)) return 'scale';
    if (/health|medic|covid|drug|opioid|mental/.test(text)) return 'health';
    if (/educ|school|student|teacher|college/.test(text)) return 'education';
    if (/econom|job|labor|work|business|tax|budget|fiscal|wage/.test(text)) return 'economy';
    if (/environment|climate|energy|water|agric|farm|land/.test(text)) return 'environment';
    if (/housing|home|rent|homeless|zoning/.test(text)) return 'housing';
    if (/transport|road|bridge|traffic|vehicle|infrastructure/.test(text)) return 'infrastructure';
    if (/election|vote|campaign|democracy|govern|public/.test(text)) return 'government';
    if (/family|child|senior|veteran|welfare|community/.test(text)) return 'people';
    if (/immigration|border|foreign|international/.test(text)) return 'world';
    if (/safety|security|emergency|disaster|fire/.test(text)) return 'shield';
    if (/uncategor|unknown|other/.test(text)) return 'unknown';
    if (/speech|media|communication|press/.test(text)) return 'message';

    return 'policy';
  }
</script>

<span
  class="topic-icon"
  aria-hidden={decorative}
  aria-label={accessibleLabel}
  style={`--topic-icon-size: ${size}px`}
>
  {#if kind === 'scale'}
    <Scale {size} strokeWidth={1.8} />
  {:else if kind === 'health'}
    <HeartPulse {size} strokeWidth={1.8} />
  {:else if kind === 'education'}
    <GraduationCap {size} strokeWidth={1.8} />
  {:else if kind === 'economy'}
    <Banknote {size} strokeWidth={1.8} />
  {:else if kind === 'environment'}
    <Leaf {size} strokeWidth={1.8} />
  {:else if kind === 'housing'}
    <Home {size} strokeWidth={1.8} />
  {:else if kind === 'infrastructure'}
    <Building2 {size} strokeWidth={1.8} />
  {:else if kind === 'government'}
    <Landmark {size} strokeWidth={1.8} />
  {:else if kind === 'people'}
    <Users {size} strokeWidth={1.8} />
  {:else if kind === 'world'}
    <Earth {size} strokeWidth={1.8} />
  {:else if kind === 'shield'}
    <Shield {size} strokeWidth={1.8} />
  {:else if kind === 'message'}
    <Megaphone {size} strokeWidth={1.8} />
  {:else if kind === 'unknown'}
    <CircleHelp {size} strokeWidth={1.8} />
  {:else if kind === 'policy'}
    <BriefcaseBusiness {size} strokeWidth={1.8} />
  {:else}
    <BookOpen {size} strokeWidth={1.8} />
  {/if}
</span>

<style>
  .topic-icon {
    display: inline-grid;
    width: calc(var(--topic-icon-size, 15px) + 10px);
    height: calc(var(--topic-icon-size, 15px) + 10px);
    place-items: center;
    color: var(--color-seal, #8a5a1a);
    background: color-mix(
      in srgb,
      currentColor 9%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        currentColor 22%,
        transparent
      );
    border-radius: 6px;
    flex: 0 0 auto;
  }
</style>
