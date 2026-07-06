# CivicWatch Component Census

Updated after the July 2026 UI runthrough. `Beeswarm.svelte` was intentionally not edited in this pass.

## Status Key

- Present: implemented before this pass and still available.
- Improved: present and materially improved in this pass.
- Added: absent before this pass and implemented now.
- Partial: implemented as a bounded/local version, or backed by current snapshot data but not the full future pipeline.
- Deferred: intentionally not implemented because the current database/API does not yet back it or it is outside v1 scope.

## Application Shell And Navigation

| Item | Status | Notes |
|---|---|---|
| Top bar | Improved | Wordmark, route links, search, Help overlay, theme toggle, and mobile menu are present. |
| Responsive navigation menu | Added | Mobile menu button reveals explorer links instead of squeezing desktop nav. |
| Footer | Partial | Data cutoff, snapshot, Methods, and About are present. Feedback/affiliation links remain content decisions. |
| Breadcrumbs | Added | Reusable `Breadcrumbs.svelte`; wired to legislator, state, and topic drilldowns. |
| Analyst-mode rail | Improved | Saved views, exports, permalink, snapshot pin preference, active URL filters, and comparison slots. |
| Help overlay | Added | Three sections: what CivicWatch is, how to use it, and data source. |
| Coverage strip | Present | `StatStrip.svelte` on landing. |
| Snapshot indicator | Improved | Footer and Analyst rail expose snapshot; pin preference is stored locally. |
| Page header | Partial | Route headers include title/stats/actions; standardized component is still route-level. |
| Panel header | Added | `PanelHeader.svelte` standardizes titles, captions, source, and counts. |

## Search And Discovery

| Item | Status | Notes |
|---|---|---|
| Global search dialog | Improved | Grouped search plus session recent-search list. |
| Legislator lookup input | Present | `AsyncLegislatorBrowser.svelte`. |
| Search result row | Present | Search dialog result cards include context. |
| Recent-search list | Added | Stored in `sessionStorage`. |
| Four-path entry cards | Improved | Landing cards now include microvisual previews. |
| Entry-card microvisual | Added | `EntryMicrovisual.svelte` covers roll-call, state grid, topic stack, and event timeline motifs. |
| No-results panel | Added | Reusable `NoResultsPanel.svelte`; wired to lookup and compare. |

## Filtering And State Capture

| Item | Status | Notes |
|---|---|---|
| Filter chip | Added | `FilterChips.svelte`; wired to `/who` and `/moment`. |
| Add-filter popover | Deferred | Full global filter builder requires broader URL schema work. |
| State multi-select | Partial | State text input exists; full searchable checklist/map is deferred. |
| Topic multi-select | Deferred | Current UI uses links and query routes. |
| Party toggle group | Partial | `/who` party select exists; toggle group styling is not yet universal. |
| Chamber toggle group | Deferred | API supports chamber filtering in places, but UI control is not global yet. |
| Political-only toggle | Deferred | Source fields exist, but current endpoints do not expose this filter. |
| Minimum-engagement control | Deferred | API top-post endpoints sort by engagement; threshold filter not exposed. |
| Date-range slider | Deferred | Moment date/window controls exist; full range slider not implemented. |
| Explicit date inputs | Present | `/moment` date input. |
| Year presets | Deferred | Not yet present. |
| Metric selector | Partial | Place/state views are fixed to volume/topic mix. |
| Sort selector | Partial | Legislator endpoint supports sort internally; UI is basic. |
| Refine control | Present | Analyst rail toggle. |
| Clear-all control | Added | Filter chips support clear links. |
| URL-state serializer | Present | Routes use URL query params; permalink endpoint normalizes URLs. |
| Warnings list | Deferred | Invalid-parameter correction warnings are not yet centralized. |

## Legislator Components

| Item | Status | Notes |
|---|---|---|
| Legislator card | Partial | Table rows are present; full card grid with sparkline/top topic is deferred. |
| Legislator identity header | Improved | Profile header, party dot, stats, compare action, and breadcrumbs. |
| Party badge or dot | Present | Party dot with text label. |
| State/chamber tag | Partial | Text tags present; dedicated link component deferred. |
| District metadata block | Present | Public-record fields panel. |
| Ideology position label | Partial | Numeric score shown; qualitative label deferred. |
| Lifetime-stat tiles | Present | Profile stat cards. |
| Related-legislator card | Deferred | Similarity aggregate is not fully materialized in current DB. |
| Legislator roll-call grid | Partial | Browse table exists; full card grid/pagination deferred. |
| Legislator side panel | Deferred | Chamber dots link to profiles; side panel not implemented. |

## Post Components

| Item | Status | Notes |
|---|---|---|
| Post card | Improved | Full text, identity, date, topic chip, likes/reposts/replies. |
| Topic chip | Added | Linked topic chip inside `PostCard.svelte`. |
| Engagement line | Improved | Likes/reposts emphasized. |
| Toxicity badge | Deferred | Data coverage is sparse and endpoint does not expose score. |
| Post feed | Partial | Profile/state/topic/moment top post grids exist; full feed pagination deferred. |
| Top-post list | Present | State, topic, moment, and compare pages. |
| Post-feed filter row | Deferred | Requires endpoint/UI filter expansion. |
| Load-more control | Deferred | Cursor API exists for legislator posts; UI not yet wired. |
| Sampler row | Present | `AsyncSampler.svelte`. |
| Sampler shuffle control | Present | Async fetch without page reload. |
| Sampler play/pause control | Deferred | Optional stream mode not implemented. |
| Sampler stream container | Deferred | Optional stream mode not implemented. |

## Core Visualizations

| Item | Status | Notes |
|---|---|---|
| Chamber View | Improved | Landing and state pages; hover no longer resizes marks. |
| Unpositioned-legislator strip | Present | Unscored dots are shown separately in Chamber View. |
| Chamber tooltip | Present | SVG titles show identity context. |
| Chamber table view | Present | Details table included. |
| Topic Ribbon | Improved | Visual plus accessible table. Full streamgraph remains future work. |
| Topic Ribbon cursor | Deferred | Requires richer interactive ribbon. |
| Topic Ribbon solo interaction | Deferred | Requires richer interactive ribbon. |
| Event annotation layer | Partial | Moment event anchors/categories present; chart annotation layer deferred. |
| US choropleth | Partial | StateGrid is a choropleth-like tile grid, not geographic TopoJSON. |
| Choropleth legend | Partial | Captions/tooltips explain scale; formal legend deferred. |
| State-map tooltip | Present | StateGrid title tooltips. |
| Fifty-state small-multiples grid | Added | `SmallMultiplesGrid.svelte` on `/place`. |
| State small-multiple cell | Added | Abbreviation, stacked topic mix, total posts. |
| Voice fingerprint | Improved | Center reference line and more explicit caption. |
| Voice-fingerprint reference ticks | Added | Center reference line represents party median baseline. |
| Voice-fingerprint radial variant | Deferred | Horizontal canonical version remains. |
| Ideology beeswarm | Present | User-updated `Beeswarm.svelte`; not modified. |
| Unscored beeswarm strip | Deferred | Not changed because user asked not to touch Beeswarm. |
| Beeswarm density backdrop | Deferred | Optional; not changed. |
| Engagement scatterplot | Deferred | No current component/API aggregate. |
| Scatterplot quadrant guides | Deferred | Depends on engagement scatterplot. |
| Sparkline | Partial | Microvisuals exist; reusable data sparkline deferred. |
| Stacked activity chart | Partial | `TimeBars.svelte` provides compact time bars, not stacked-by-topic. |
| Time-series brush | Deferred | Requires richer client chart controls. |
| Engagement time series | Deferred | Endpoint exists for legislator engagement, but not wired to UI yet. |
| Topic-mix stacked bar | Present | `MiniBars`, `TopicBars`, small multiples, and compare panels. |
| State trend chart | Added | `TimeBars.svelte` on state drilldown. |
| Party-by-chamber matrix | Added | `PartyChamberMatrix.svelte` on topic drilldown. |
| Adjacent-topic bars | Added | Topic drilldown uses `MiniBars` over `/adjacent`. |
| Biggest-movers display | Deferred | Needs baseline comparison aggregate. |
| Comparison chart row | Present | Compare page aligns equivalent topic panels per slot. |
| Chart table toggle | Improved | Chamber, Voice Fingerprint, Topic Ribbon, and Beeswarm provide tables. |
| Chart-generated summary | Partial | Captions include headline patterns; generated summaries are not centralized. |

## Page-Level Compositions

| Page | Status | Notes |
|---|---|---|
| Landing | Improved | Top bar, hero, coverage strip, sampler, Chamber View, entry cards with microvisuals, footer. |
| Legislator explorer | Partial | Async search/filter table and no-results; card grid/pagination remain deferred. |
| Legislator profile | Partial | Identity, stats, voice fingerprint, posts, public-record fields; timelines/similar profiles deferred. |
| Place explorer | Improved | State grid plus 50-state small multiples and data table. |
| State drilldown | Improved | Summary, topic mix, state trend, state-filtered Chamber View, top posts. |
| Topic explorer | Improved | Topic tiles, ribbon, volume bars, aggregate table. |
| Topic drilldown | Improved | Header, topic timeline, state salience, party/chamber matrix, adjacent topics, top posts, Beeswarm. |
| Moment explorer | Improved | Date/window controls, filter chips, topic mix, event categories/anchors, top posts. |
| Compare page | Improved | Four-slot input, examples, slot cards, topic-mix comparisons, top posts. |
| Methods page | Present | Content page exists. |
| About page | Present | Content page exists. |

## Persistence, Comparison, And Export

| Item | Status | Notes |
|---|---|---|
| Compare-with button | Present | Entity pages link to compare routes. |
| Comparison slot | Present | Compare endpoint and cards support up to four slots. |
| Entity picker | Partial | Example shortcuts and `kind:id` input; full picker deferred. |
| Save-view dialog | Present | Analyst rail prompt stores local view labels. |
| Saved-view list | Present | Analyst rail localStorage list. |
| Export menu | Present | Analyst rail CSV, PNG, permalink actions. |
| PNG export | Partial | API returns PNG for supported chart specs; full high-res page export deferred. |
| CSV export | Present | API includes metadata headers. |
| Permalink export | Present | Copies canonical URL. |
| Pin-to-snapshot toggle | Added | Stored locally in Analyst rail. |
| Copy-link toast | Present | Button label switches to Copied. |

## Feedback And Edge States

| Item | Status | Notes |
|---|---|---|
| Skeleton card or panel | Present | Global skeleton class and sampler loading cards. |
| Panel progress bar | Deferred | Not implemented. |
| Contained error panel | Partial | Sampler/lookup notices; reusable error panel deferred. |
| Retry control | Partial | Search/shuffle/update controls reissue requests; generic retry deferred. |
| Full-page not-found state | Deferred | SvelteKit route error pages not customized yet. |
| Rate-limit notice | Deferred | API can rate-limit; UI-specific copy not centralized. |
| Missing-field indicator | Present | Dashes and muted no-data styling. |
| Coverage caption | Improved | Panel headers and chart captions include counts/sources. |
| Unknown-party treatment | Present | Muted party dot and explicit labels. |
| Temporal-gap treatment | Deferred | Rich line charts not implemented yet. |
| Small-sample notice | Partial | Counts shown; explicit n-warning thresholds deferred. |

## Database Backing Notes

Current live data supports the implemented shell, search, post cards, topic/state aggregates, party/chamber topic matrix, state trend, moment windows, compare slots, exports, and saved views.

Deferred items mostly need one of these before they can be honest: richer URL schema, full snapshot-v2 aggregate tables, cursor UI wiring, TopoJSON state geography, or dedicated chart interaction primitives.
