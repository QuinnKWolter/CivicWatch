# CivicWatch Local Build Objectives

1. Restore the full dump into an isolated PostgreSQL 17 cluster on port `55432`, leaving any existing local databases untouched.
2. Keep the restored source schema intact and add only local `app_*` materialized helper views for fast exploration.
3. Implement the specified stack: SvelteKit web, Fastify API, TypeScript, PostgreSQL, and design tokens.
4. Surface the design doc's first-tier and explorer flows: landing, Sampler, Chamber View, legislator lookup/profile, places, topics, moments, compare, methods, and about.
5. Preserve field-catalog awareness: show missing metadata, keep Uncategorized visible, avoid toxicity/misinformation dashboards, and prefer likes plus retweets for primary engagement.
6. Return snapshot-aware API envelopes with source table, query hash, generated time, filters, and coverage metadata where relevant.
7. Verify with row-count checks, API health checks, TypeScript/Svelte checks, and a local runnable dev server.
