<script lang="ts">
  import { onMount, untrack } from 'svelte';

  interface Props {
    value?: number | null;
    fallback?: string;
    duration?: number;
    compact?: boolean;
  }

  const {
    value = null,
    fallback = '',
    duration = 1800,
    compact = true
  }: Props = $props();

  let displayed = $state(untrack(() => value ?? 0));
  let ready = $state(false);
  let frame: number | null = null;

  const formatted = $derived(formatValue(displayed));

  function formatValue(nextValue: number): string {
    if (value === null || !Number.isFinite(value)) return fallback;

    return new Intl.NumberFormat('en-US', {
      notation: compact && Math.abs(value) >= 10000 ? 'compact' : 'standard',
      maximumFractionDigits: compact && Math.abs(value) >= 10000 ? 1 : 0
    }).format(nextValue);
  }

  onMount(() => {
    if (value === null || !Number.isFinite(value)) {
      ready = true;
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion || duration <= 0) {
      displayed = value;
      ready = true;
      return;
    }

    const start = performance.now();
    const startValue = Math.max(0, value * 0.72);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);

      displayed = Math.round(startValue + (value - startValue) * eased);
      ready = progress >= 0.98;

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        displayed = value;
        ready = true;
      }
    };

    frame = requestAnimationFrame(tick);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  });
</script>

<span class:ready class="animated-number">{formatted}</span>

<style>
  .animated-number {
    display: inline-block;
    min-width: 3.4ch;
    font-variant-numeric: tabular-nums;
    transition:
      color 240ms ease,
      filter 240ms ease;
  }

  .animated-number:not(.ready) {
    color: color-mix(in srgb, currentColor 84%, var(--color-seal));
    filter: saturate(1.08);
  }

  @media (prefers-reduced-motion: reduce) {
    .animated-number {
      transition: none;
    }
  }
</style>
