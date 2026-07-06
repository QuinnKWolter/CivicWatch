# CivicWatch — Design Document

*Legislative communication exploration and analytics for the public, journalists, and researchers. Built on the CivicWatch database. This document covers presentation, functionality, order, and visuals in full. A companion technical implementation document will follow.*

---

## 0. Changes since v1

- **Name.** Adopted CivicWatch throughout; retired "The Observatory."
- **Audience.** Reoriented around common citizens as the primary entry, with journalists and political scientists as depth users. The landing sentence, the entry chip order, the copy tone, and the methods page all shift accordingly.
- **Ideology axis.** Left = liberal / Democratic, right = conservative / Republican, following political-science convention and the sign of the underlying MRP scores.
- **Data gaps.** The tool now shows every legislator and every post; missing fields are marked with a small inline no-data indicator rather than hidden. "Profiled" as a term is retired in favor of showing rich data where present and clean placeholders where not.
- **Post display.** Every post is renderable in full. No truncation policy. Framing: these are public statements by public officeholders in the public interest.
- **Compare cap.** Set at 4 slots for v1, easy to iterate.
- **Speech Ticker.** Redesigned as **the Sampler** — static by default (a shuffleable row of real post cards), with an opt-in "play stream" mode for those who want ambient motion. Full spec in §7.
- **Moment annotations.** A curated list of ~35 event markers, 2020–2024, is included inline in §8.

---

## 1. Overview

### 1.1 What we're building

CivicWatch is an exploration and analytics surface for **22 million tweets from 5,927 U.S. state legislators, January 2020 through December 2024**. It opens with a plainly-worded statement of what's here and offers four ways in — a legislator lookup, a place explorer, a topic explorer, and a moment (time) explorer — each of which starts simple, exposes more controls as the visitor engages, and ultimately lets them drill down, compare across dimensions, save views, and export both charts and the underlying data.

Nothing about the product should feel like a business intelligence tool. It reads more like a well-designed newsroom instrument: dense with information, calibrated in its typography and color, honest about what's missing, and built so a citizen can find their own state representative in under thirty seconds while a political scientist can reproduce a topic-mix analysis and take the CSV home.

### 1.2 Audiences and their questions

Three audiences, in priority order:

1. **Citizens.** *Who represents me? What have they said? What are people in my state talking about? What was said around \[a moment I remember]?* Success looks like: they find their legislator, they read a few real posts, they leave with a truer sense of what their statehouse is talking about than they arrived with.

2. **Journalists.** *Which legislators drove the conversation on \[topic] during \[window]? Which states diverge from the national pattern? Give me a chart I can screenshot and a CSV I can cite.* Success: they can build a data-backed lede in a few minutes and cite the tool by name.

3. **Political scientists and researchers.** *What's the topic mix by party across chambers? How does engagement correlate with ideology? Can I reproduce this cut and export it?* Success: they can reproduce, they can export, and they can point students at CivicWatch as a teaching corpus.

### 1.3 The design promise

Three things the product commits to:

- **Sparing with chrome, generous with information.** No filter bar with nine dropdowns above the fold. Density earned progressively.
- **Honest about data.** Every gap is marked; every chart declares its population.
- **Never a "gotcha."** Party is always visible. Names are always the legislator's real name. No withheld details for reveal-style theater.

---

## 2. What the data supports

An honest look at what the database can drive, updated to reflect that we now show all data even where partial. Numbers are from the field catalog dated 2026-07-01.

### 2.1 Full-strength fields

Populated at 90%+, safe to feature without disclaimer.

- **Posts (22.2M rows).** `lid`, `created_at`, `text`, `retweet_count`, `like_count`, `reply_count`, `quote_count`, `topic`, `count_misinfo`. At 96.3%: `tweet_id`, `topic_probability`, `political_score`, `is_political`.
- **Legislators (5,927 rows).** `lid`, `name` at 100%. `handle` at 93.5%.
- **Topics (22 rows).** Complete lookup table.
- **Materialized views.** `topic_engagement_daily`, `topic_party_breakdown`, `topic_state_breakdown` — pre-computed and safe to drive the fast paths in the UI.

### 2.2 Identified vs. unidentified legislators

Roughly **3,649 of 5,927 legislators (61.6%)** have full metadata: `state`, `chamber`, `party`, `gender`, `race`, district information, `yr_elected`, `vote_pct`, `bp_url`. The remaining ~2,278 rows are handle-and-name shells — accounts we scraped as legislator accounts but couldn't match to public records.

**New posture:** every legislator is browsable. A legislator with only a name and a handle gets a profile page like everyone else; the missing fields render as clean inline placeholders (a small **—** in the field, with a hoverable "no public-records match" note where appropriate). Aggregations that require demographic dimensions state their coverage in a small caption line ("*3,649 of 5,927 legislators have party information; 2,278 are unlabeled and appear in aggregate but not in the party breakdown*").

The party mix among the 3,649 with data: **Democratic 53%, Republican 46%, Independent 0.5%.** Chamber: **House 69%, Senate 31%.** All 50 states represented; heaviest coverage in NY, TX, MN, MA, PA.

### 2.3 Ideology signals

Six ideology-adjacent scores are populated for **52–56%** of legislators: `shor_ideo` (Shor–McCarty legislator ideology), `mrp_ideology` and `mrp_ideology_se` (MRP-style estimates with standard errors), `median_chamber`, `dis_median`, `median_party`, `heterogeneity`, `polarization`, and `demshare_pres` (Democratic presidential vote share of their district).

Anywhere we plot legislators along an ideology axis, we cite the covered subset in the chart caption. Citizen-legible framing: "**Voting-record position.** Based on floor votes, from more liberal on the left to more conservative on the right. Available for 3,335 of the 5,927 legislators in the corpus."

### 2.4 What to skip or deprioritize

- **Toxicity.** Only `tox_toxicity` has any values, at 4.5% coverage; siblings all empty. No dedicated view. A small badge may appear on individual post cards when the score exists.
- **Misinformation.** `misinfo_score` is empty; `count_misinfo` is 100% populated but 99.97% zero (only ~6,700 flagged posts out of 22M). No dedicated view. Available as an optional filter facet for researchers only, tucked in analyst mode.
- **`favorite_count`** — 100% zero. Ignore entirely.
- **Reply and quote engagement** — 83% and 94% zero respectively. Engagement analytics lead with likes and retweets. Replies and quotes appear only in secondary "engagement mix" panels.

### 2.5 Topic 999 and "Uncategorized"

Topic 999 is **38.7% of all posts (~8.6M)** — the largest single category by a wide margin. It represents posts the topic model could not confidently assign to any of the 21 substantive CAP-style categories (Macroeconomics, Civil Rights, Health, Agriculture, Labor, Education, Environment, Energy, Immigration, Transportation, Law and Crime, Social Welfare, Housing, Banking and Commerce, Defense, Space/Technology, Foreign Trade, International Affairs, Government Operations, Public Lands, Culture, plus Unclassified/0).

Design rule: **topic 999 is always visible and labeled "Uncategorized," never quietly dropped.** A single toggle in analyst mode lets a researcher exclude it. In topic ribbons, it appears as a muted band at the bottom of the stack rather than fighting for foreground attention.

### 2.6 Coverage summary shown once, on the landing

> **22.2M posts** · **5,927 legislators** (3,649 fully identified) · **50 states** · **22 topic categories** · **Jan 2020 – Dec 2024** · **70% classified as political**

Small, single-line, doesn't repeat.

---

## 3. Design direction: Roll Call

### 3.1 Why Roll Call

The vocabulary of the ballot and the roll-call vote is the visual language of American civic participation. It's familiar to citizens (you filled out one in November), grounded in the subject matter (this is a record of what the people you voted for said in public), and lets us step around three template AI-generated dashboard looks: (a) cream + serif + terracotta, (b) near-black with acid accent, (c) broadsheet columns. Roll Call gives us warm paper, careful hairlines, restrained party color, monospace numerics, and a humanist body voice. Legibility first, personality earned by typography rather than by decoration.

The **one deliberate risk** is now the **Sampler** — a stripped-back post-card row that is fundamentally content-forward instead of chart-forward on the landing page. Details in §7.

### 3.2 Palette

Token names are intentional and should ship as-is rather than being renamed to `--color-blue-500`.

| Token | Hex | Contrast on paper | Use |
|---|---|---|---|
| `ink` | `#1a1917` | 14.1 : 1 | Primary text, hairlines at higher opacity |
| `paper` | `#f5f1e7` | — | Page background — warm ivory, distinct from the #F4F1EA default |
| `card` | `#ffffff` | — | Elevated card surfaces |
| `rule` | `#d9d2c1` | — | Warm-gray dividers and card borders |
| `mute` | `#6b6659` | 4.7 : 1 | Secondary text (darkened to hit AA on paper) |
| `mute-soft` | `#9c9787` | 2.9 : 1 | Captions on `card` only, never on `paper` |
| `ballot-blue` | `#274b6e` | 7.1 : 1 | Democratic |
| `ballot-red` | `#a13530` | 5.5 : 1 | Republican |
| `independent` | `#7a6a4a` | 4.6 : 1 | Independent, large text and marks only |
| `seal` | `#8a5a1a` | 5.4 : 1 | Warm brass — the one accent; selection state, hover emphasis, topic chips |
| `signal` | `#3a6c4c` | 5.2 : 1 | Muted forest — up/positive-change indicators only |
| `warn` | `#a86a1f` | 4.5 : 1 | Data-caveat notices, never used for errors |
| `error` | `#8a2a20` | 6.2 : 1 | Actual errors (loading failure, network) |

Party colors are deliberately desaturated compared to broadcast red/blue. Ballot Blue reads as Democratic; Ballot Red reads as Republican; neither is fire-engine. The tool takes a research posture, and garish partisan colors would fight the tone.

### 3.3 Typography

Three roles, three faces. Weight range disciplined — regular, medium, and either semibold or bold, no lighter than regular.

- **Display** — a wide-set grotesque with terminal quirks. **Primary candidate:** GT Alpina Wide (if we can license) or Neue Machina (a good open equivalent). **Fallback stack:** `"GT Alpina Wide", "Neue Machina", "Söhne Breit", "Inter Tight", ui-sans-serif, system-ui, sans-serif`. Used at Display XL and Display L only.
- **Body** — humanist sans with character. **Primary:** Instrument Sans (Google Fonts, free, has quiet personality). **Fallback stack:** `"Instrument Sans", "Untitled Sans", "Söhne", ui-sans-serif, system-ui, sans-serif`. Weights 400 and 500.
- **Data** — a monospace with tabular figures. **Primary:** JetBrains Mono. **Fallback stack:** `"JetBrains Mono", "IBM Plex Mono", "Söhne Mono", ui-monospace, monospace`. Always with `font-feature-settings: "tnum" on` for tables and figures.

Type scale — a modest 1.2 ratio.

```
Display XL     56 / 60   -0.02em    Landing hero only
Display L      40 / 44   -0.015em   Section titles
Display M      28 / 34   -0.01em    Sub-section titles
Heading M      22 / 28   -0.005em   Card titles, chart titles
Heading S      17 / 24    0em       Small headers
Body L         17 / 26    0em       Long-form paragraphs
Body           15 / 22    0em       Default UI text
Caption        13 / 18    0.005em   Chart captions, secondary info
Eyebrow        12 / 16    0.08em    UPPERCASE labels, small
Mono S         13 / 18    0em       Numbers in tables
Mono XS        12 / 16    0em       Numbers in cards / sparks
```

### 3.4 Layout system

- **Grid.** 12 columns, 72px wide with 24px gutters at the widest breakpoint. Compresses to 8 columns at tablet, 4 at mobile.
- **Vertical rhythm.** 8px base unit. Common spacings: 8, 12, 16, 24, 32, 48, 64, 96.
- **Container widths.** Max content width 1360px at the widest; landing hero is allowed to breathe to 1440px. Text-heavy pages (methods, about) capped at 720px for readability.
- **Cards.** 1px `rule` border, 6px radius, no shadow at rest. A subtle 0-4-16 shadow at 6% opacity appears only on hover for depth cueing.
- **No gradients. No glassmorphism. No skeuomorphism.** The one texture allowed is the paper background itself (which is a solid color, but the warm ivory reads as paper).

### 3.5 Iconography

A small custom set of ~14 line glyphs, 20px at 1.5px stroke. No emoji. Rough inventory:

- Search, close, back, forward, expand, collapse
- Filter, sort, shuffle
- Download (for CSV), image (for PNG), link (for permalink)
- Compare (a small side-by-side rectangle glyph)
- Bookmark (for saved views)
- Play, pause (for the Sampler stream mode)
- Info (for tooltips)

Each has a solid variant only where semantically necessary (e.g., filled bookmark = saved).

### 3.6 Motion

Restrained. The full motion budget:

1. **The Roll Call reveal.** On landing load, and on filter changes to the Chamber View, the dots settle into position over ~600ms with a light stagger (~2ms per dot). Feels like a chamber settling before a vote.
2. **Sampler transitions.** When the visitor shuffles, cards fade-and-slide 200ms.
3. **Sampler stream mode.** Continuous horizontal drift at 30px/sec — legible reading pace, pauses on hover, disabled entirely under `prefers-reduced-motion`.
4. **Chart morphs.** 240ms ease-out on shape transitions when filters change. No fades.
5. **Hover.** 120ms color/border transitions. No scale.
6. **Focus rings.** Instant, no animation.

Route transitions are hard cuts — faster and less distracting than a fade.

### 3.7 Signature: the Chamber View

The visual most likely to be remembered. Every legislator is a small dot arranged in a hemicycle — the seating shape of an actual legislative chamber. Default arrangement: sorted along the arc by MRP ideology (leftmost most liberal, rightmost most conservative); colored by party.

- **Full population** at the landing: all 5,927 legislators are shown, but only 3,335 have ideology positions; the rest are placed in a shorter secondary row above the arc with a small "not on the ideology axis" caption.
- **Filtering** the population (by state, by chamber, by topic emphasis, by date range) triggers the roll-call reveal — the excluded dots dim and drift to a small "excluded" cluster at the top-left, while the included dots rearrange along the arc.
- **Hover** brings the dot forward and surfaces a compact card near it (name, handle, party, state, chamber, ideology position, post count).
- **Click** opens a side panel with more context and a link to the full profile.

The Chamber View makes the population the picture. Nothing else on the landing does that.

---

## 4. Information architecture and first-time flow

### 4.1 Three tiers of surface

The interface reveals in three tiers, each expanding what's exposed as the visitor engages.

**Tier 1 — Landing (zero configuration).** No filter bar. No exports. No comparison. Just:
- The wordmark and a one-sentence intro.
- The coverage strip.
- The Sampler.
- The Chamber View, unfiltered.
- Four entry paths as large tap-friendly chips.
- Footer with methods and provenance.

**Tier 2 — Explorer views (contextual controls only).** Each entry chip opens a specialized surface (place, topic, legislator, moment). Only the controls native to that surface are exposed. The global filter bar has not appeared.

**Tier 3 — Analyst mode (all controls visible).** Triggered by clicking "Refine" from any Tier 2 explorer, or by opening any drilldown page (legislator profile, state page, topic page). Once entered, sticky for the session. The global filter bar appears across the top; Compare, Export, and Save-view controls become visible.

### 4.2 First-time visitor walkthrough

No forced onboarding. Citizens don't want product tours. Instead, the landing does the work by being clear enough that no explanation is needed.

Concretely, the first-time visitor's path might be:

1. Lands on `/`. Reads the sentence: *Twenty-two million posts from 5,927 U.S. state legislators, January 2020 through December 2024, opened up for anyone to explore.*
2. Reads the coverage strip. Now knows the shape of what's here.
3. Eye drops to the Sampler — sees three real posts. Understands "oh, these are actual things people said."
4. Sees the Chamber View. Understands scale.
5. Reads the four entry chips and picks one — most likely "Look up a legislator" for a citizen, "Follow an issue" for a journalist, "Explore by moment" for someone with a specific event in mind.

If they want help, a small **?** in the top-right opens a Help overlay with three tabs: "What is this?", "How do I use it?", and "Where does the data come from?" — each 2–3 short paragraphs. Otherwise, the tool leaves them alone.

### 4.3 The four paths in, ordered

Ordered by likely citizen priority, then journalist, then researcher.

1. **Look up a legislator** — *Find any of 5,927 profiles, or browse the roll call.*
2. **Explore a state** — *Chamber composition, topic mix, and top voices.*
3. **Follow an issue** — *22 topic areas, from healthcare to defense, tracked over five years.*
4. **Revisit a moment** — *Scrub the timeline to see what was said around any date.*

Each chip is a card with the imperative label as the display type, the short description below it, and a small illustrative micro-visualization on the right (a mini roll-call grid, a mini map, a mini topic stack, a mini timeline). The micro-visuals are drawn from real data so each chip is subtly alive.

### 4.4 Navigation model

- **Top bar (persistent):** wordmark on the left, four explorer links in the middle, Search icon + Help + Analyst-mode indicator on the right.
- **Left rail (analyst mode only):** filter chips (see §9.1), saved views, current comparison slots.
- **Breadcrumb (drilldown pages):** e.g., `Places → Texas → State-level view` with each segment clickable.
- **Footer:** methods, about, feedback link, data as-of date, project affiliation.

No hamburger menus on desktop. On mobile, the top bar collapses into a small menu with the four explorer links plus search and help.

---

## 5. Screen inventory

Every screen in the product, described enough to hand to an implementation lead.

### 5.1 Landing (`/`)

**Purpose.** Give a first-time visitor a truthful impression of what's here and an obvious next step.

**Above the fold (desktop, ~900px vertical viewport):**

```
┌───────────────────────────────────────────────────────────────┐
│  CIVICWATCH                                          ?  ⌘K   │  ← top bar
├───────────────────────────────────────────────────────────────┤
│                                                               │
│     Twenty-two million posts from 5,927 U.S. state           │
│     legislators, January 2020 through December 2024,         │
│     opened up for anyone to explore.                         │
│                                                               │
│  22.2M posts · 5,927 legislators · 50 states · 5 years       │  ← coverage strip
│                                                               │
├───────────────────────────────────────────────────────────────┤
│   THE SAMPLER  ↺ shuffle                            play ▶   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Post 1 card │  │ Post 2 card │  │ Post 3 card │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└───────────────────────────────────────────────────────────────┘
```

**Below the fold:**

```
┌───────────────────────────────────────────────────────────────┐
│   THE CHAMBER                                                 │
│                                                               │
│        ·  ·  ·  ·  · · · · · · · · · · · · · · · · ·         │
│      ·  ·  ·  ·  ·  ·  · · · · · · · · · · · · · · ·         │
│    · · · · · · · · · · · · · · · · · · · · · · · · · ·       │
│  · · · · · · · · · · · · · · · · · · · · · · · · · · · ·     │
│                                                               │
│  ← more liberal              (voting record)      more →     │
│                              conservative                     │
│                                                               │
│  Every legislator with voting-record data. Hover a dot.       │
├───────────────────────────────────────────────────────────────┤
│   FOUR WAYS IN                                                │
│  ┌──────────────┐ ┌──────────────┐                            │
│  │ Look up a    │ │ Explore a    │                            │
│  │ legislator   │ │ state        │                            │
│  └──────────────┘ └──────────────┘                            │
│  ┌──────────────┐ ┌──────────────┐                            │
│  │ Follow an    │ │ Revisit a    │                            │
│  │ issue        │ │ moment       │                            │
│  └──────────────┘ └──────────────┘                            │
└───────────────────────────────────────────────────────────────┘
```

**Key copy.**
- Hero: as shown above.
- Sampler helper text: *"A random handful of real posts. Refresh to see more."*
- Chamber caption: *"Every legislator with voting-record data. Hover a dot for a name and party. 3,335 of 5,927 legislators appear here — the rest are still browsable, just without an ideology position."*

**Footer.** *Data through December 2024 · Methods · About · Feedback · [affiliation]*

### 5.2 Look up a legislator (`/who`)

**Purpose.** Two modes: **search** ("I know who I'm looking for") and **browse** ("show me around").

**Layout.**

```
┌───────────────────────────────────────────────────────────────┐
│  ← Home                                                       │
│                                                               │
│   Look up a legislator                                        │
│   Search 5,927 profiles, or browse the roll call.             │
│                                                               │
│   [🔍 Search by name, handle, state, or district ────────]   │
│                                                               │
│   Filter: [Party ▾] [Chamber ▾] [State ▾] [Sort ▾]           │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Card 1   │ │ Card 2   │ │ Card 3   │ │ Card 4   │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Card 5   │ │ Card 6   │ │ Card 7   │ │ Card 8   │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                               │
│    Loading more…                                              │
└───────────────────────────────────────────────────────────────┘
```

**Legislator card content.**

```
┌────────────────────────────────┐
│ • Ken King              [TX-H] │  ← party dot + name + state-chamber tag
│  @KingForTexas                  │
│                                 │
│  2,341 posts   14.2K likes      │  ← headline stats
│  ▁▂▂▃▅▇▆▄▂▂▁▂                  │  ← sparkline of monthly volume
│                                 │
│  Top topic: Government Ops      │
└────────────────────────────────┘
```

**Sort options.** Default *Most active*. Others: *Alphabetical*, *Highest engagement*, *Most recent post*.

**Filter behavior.** Filters are chips that appear below the search bar when active, each dismissible. Party is a three-state chip (D / R / I / any). Chamber is two-state (H / S / any). State is a multi-select modal with a search box and a small US map for tap selection.

**No-results state.** *"Nothing matches "vlkjs." Try a name, a handle (without the @), or a state abbreviation."*

**Loading state.** Skeleton cards with a subtle shimmer at 80% opacity for the first eight positions.

### 5.3 Legislator profile (`/who/{lid}`)

**Purpose.** Everything worth knowing about one legislator's public-facing speech during the covered window.

**Layout (top to bottom).**

**5.3.1 Identity header.**

```
┌───────────────────────────────────────────────────────────────┐
│  ← Look up      Compare with…    ⬇ Export     🔗 Copy link   │
│                                                               │
│  Ken King                                        [• REP]      │
│  @KingForTexas · Texas House · District 88                    │
│  Elected 2013 · Voting position: +0.33 (moderate right)       │
│                                                               │
│  Active in this corpus: Jan 2020 – Nov 2024 (1,782 days)      │
└───────────────────────────────────────────────────────────────┘
```

- If ideology position isn't available: *"Voting position: not available — no floor-vote match."*
- If handle is missing: *"@—"* placeholder.
- If state/chamber missing: *"— · —"* with an info tooltip.

**5.3.2 The lifetime numbers.**

```
┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
│ 2,341     │  │ 14,203    │  │ 823,441   │  │ 62%       │
│ posts     │  │ likes     │  │ retweets  │  │ political │
└───────────┘  └───────────┘  └───────────┘  └───────────┘
```

Four large numbers, monospace, tabular-figures. Hover reveals exact figures if the display was abbreviated.

**5.3.3 Voice fingerprint.**

The signature analytical view for this page. A radial or horizontal bar chart with 22 spokes/bars, one per topic. Each shows the legislator's share of posts on that topic **vs.** the median share for their party. See §6.5 for the visualization spec.

Caption: *"Which topics this legislator dwells on, compared to the party median. Bars extend outward when they talk about a topic more than the typical Republican; inward when less."*

**5.3.4 Activity over time.**

A stacked area chart of daily post volume, colored by topic. Below the chart, a topic legend where each row can be clicked to solo that topic. A small brush at the bottom lets the visitor zoom into any window.

**5.3.5 Engagement profile.**

Two panels side by side:
- *Engagement per post over time* — line chart with a rolling 30-day median.
- *Top five posts by engagement* — post cards ranked by likes + retweets.

**5.3.6 All posts, browsable.**

The tail of the page. A paginated list of every post this legislator has made, defaulting to reverse chronological. Filter row above: date range, topic (multi-select), min-engagement, "political only" toggle. Each row is a post card (§13). Load more on scroll; keyboard accessible.

The full list is **exportable as CSV** via the export button in the top bar.

**5.3.7 Related legislators.**

Small strip at the bottom: *"Similar profiles"* — three legislators with the closest voice-fingerprint distance (nearest neighbor over the 22-topic vector). Optional; hide if similarity computation isn't cached.

### 5.4 Place explorer (`/place`)

**Purpose.** Answer the *how does my state compare* question and let the visitor navigate to a state.

**Layout.**

```
┌───────────────────────────────────────────────────────────────┐
│  Explore a state                              Refine ▸        │
│                                                               │
│  Color the map by:                                            │
│  [Post volume] [Median engagement] [Topic diversity]          │
│  [Dem chamber share] [Ideology median]                        │
│                                                               │
│  ┌─────────────────────────────────────────────────┐         │
│  │                                                 │         │
│  │                US CHOROPLETH                    │         │
│  │                                                 │         │
│  └─────────────────────────────────────────────────┘         │
│                                                               │
│   Legend: less ← ──────── → more                              │
├───────────────────────────────────────────────────────────────┤
│  EVERY STATE, EVERY TOPIC                                     │
│  A grid of 50 tiny topic-mix bars, one per state.             │
│                                                               │
│  [50-state small-multiples grid — see §6.4]                   │
└───────────────────────────────────────────────────────────────┘
```

**Metric pills.** Five default metrics, one selected at a time. Each has a one-line tooltip that explains what it means in plain language.

**Hover the map.** A floating tooltip shows the state name, the metric value, and the state's top three topics.

**Click a state.** Navigates to `/place/{state}`.

**Small multiples grid.** 50 mini-charts arranged 5 × 10 (or 10 × 5 depending on breakpoint). Each cell shows the state abbreviation and a horizontal stacked bar of topic mix. Uncategorized (topic 999) is the muted last segment. Click any cell to navigate to that state.

### 5.5 State drilldown (`/place/{state}`)

**Purpose.** Everything worth knowing about one state.

**Layout.**

**5.5.1 Header.**

```
Texas · 145 legislators · House 108 R / 42 D · Senate 20 R / 11 D
2.34M posts · Median post gets 12 likes, 3 retweets
```

**5.5.2 State Chamber View.** Same as the landing Chamber View, filtered to just this state. Shows the ideological spread of that state's legislators.

**5.5.3 Topic mix panel.** A single stacked horizontal bar showing the state's topic distribution, next to a legend that shows the party skew (a small D-vs-R marker) for each topic.

**5.5.4 Voices.** Top ten legislators in the state by post volume, each as a card (§5.2 card format), with a "see more →" link to the full state roll call.

**5.5.5 Trend.** A time-series of daily post volume for the state, banded by party, over the covered window. Notable statewide events (e.g., Uvalde for Texas) appear as vertical annotation ticks.

**5.5.6 Top posts.** A sortable list of highest-engagement posts from the state, defaulting to top-10 by likes+retweets. Filter row: topic, date, party.

### 5.6 Topic explorer (`/topic`)

**Purpose.** Show the 22 topics at once, with enough detail to pick one to drill into.

**Layout.**

**5.6.1 The Topic Ribbon.** A full-width stream graph showing the 22 topics as bands, each band's height at each date representing that topic's share of all posts that day. Uncategorized as a muted band at the bottom. Time on the x-axis, share on the y-axis. See §6.2 for the spec.

**5.6.2 Below the ribbon: topic tiles.** A 4 × 6 grid (or similar, depending on breakpoint) of 22 tiles, one per topic. Each tile shows:

```
┌────────────────────────────────┐
│ HEALTH                          │
│                                 │
│  1.14M posts · 5.1%             │
│  ▁▂▃▄▅▄▃▂▂▃▄▄  (spark)          │
│  ● 58%    ● 42%                 │  ← D/R composition
│                                 │
│  Engagement lift: +12%          │
└────────────────────────────────┘
```

Click a tile → navigate to `/topic/{id}`.

Tiles are sortable: default *by volume*, alternatives *by D/R skew*, *by engagement lift*, *by growth rate over the window*.

### 5.7 Topic drilldown (`/topic/{id}`)

**Purpose.** Everything worth knowing about one topic.

**Layout.**

**5.7.1 Header.** Topic name, total posts, share of the corpus, D/R skew, engagement compared to average.

**5.7.2 Volume over time.** Daily post count on this topic. Curated event markers relevant to the topic appear as annotations (e.g., Dobbs for Civil Rights, Uvalde for Law and Crime).

**5.7.3 State salience map.** A US choropleth colored by *what share of each state's speech was on this topic*. So the Texas cell for the Law-and-Crime topic might be dark; Vermont's might be pale.

**5.7.4 Party × chamber matrix.** A small 2×2 matrix: (D, R) × (House, Senate). Each cell shows post count, share of that group's total speech, and median engagement.

**5.7.5 Adjacent topics.** Which other topics tend to be discussed by the same legislators? A small horizontal bar of the top five co-occurring topics.

**5.7.6 Top posts on this topic.** Sortable, filterable by state and party.

**5.7.7 Beeswarm on ideology.** One dot per legislator with an ideology score, sized by the number of posts they made on this topic, positioned along the ideology axis. Immediately shows whether a topic skews left, right, or bipartisan — without letting a single prolific legislator dominate the picture. Legislators without an ideology score appear in a small strip labeled *"not scored"* below the axis.

### 5.8 Moment explorer (`/moment`)

**Purpose.** Let the visitor scrub through time and see what was being said around any date.

**Layout.**

**5.8.1 The timeline scrubber.** Full-width, spans Jan 2020 to Dec 2024. Below the scrubber, colored ticks mark curated events (see §8), grouped into categories that can be filtered on/off with small chips: *Elections*, *SCOTUS*, *Mass violence*, *Legislation*, *Crises*, *Legislative institution*.

**5.8.2 Window control.** A width control (7 days / 30 days / 90 days) determines how wide a slice around the scrubber position is analyzed.

**5.8.3 What was said.** For the current window:
- **Topic mix** — a single stacked bar showing topic distribution during the window.
- **Biggest movers** — three "up" and three "down" topics compared to the trailing 30-day baseline before the window.
- **Sampler window** — the Sampler component (§7) is filtered to posts inside the window.
- **Top posts** — five highest-engagement posts in the window.

**5.8.4 Event pinning.** Click any event tick to snap the scrubber to that date and the window centers around it. A small event card appears with the event name, category, and a link to relevant contextual reading.

### 5.9 Compare (`/compare`)

**Purpose.** Structured side-by-side of up to four entities.

**Layout.**

Four vertical columns (three on smaller breakpoints, one column stacked view on mobile). Each column holds a slot; a slot can hold: a legislator, a state, a party, a chamber, a topic, or a time window. Adding an entity to a slot is done via a small *"+ Add"* button that opens a picker with tabs for each entity type.

**Below the header row:** shared analytical panels that render one row per entity being compared. Panels available:

- *Topic mix* — 22-category bar per entity, on the same axis.
- *Volume over time* — time-series per entity, on the same axis with a shared date range.
- *Engagement per post* — a distribution comparison (e.g., box plots or ridge plots for four entities).
- *Ideology distribution* — only if two or more entities have ideology-scored populations.
- *Top posts* — top-3 per entity.

**Export the whole comparison.** One PNG of the current comparison, one CSV of the underlying rows.

### 5.10 Search (global)

**Purpose.** Universal find. Accessible from any screen via ⌘K / Ctrl-K or the search icon in the top bar.

**Behavior.**
- Modal overlay, centered.
- Input focused immediately.
- Results grouped in three sections: **Legislators**, **States**, **Topics**.
- Legislators: fuzzy match on name and handle; ranks by name-match strength then post volume.
- States: exact match on name or two-letter abbreviation.
- Topics: fuzzy match on the topic label.
- Each result is a single row with an icon indicating the entity type. Arrow keys navigate, Enter selects.

**Placeholder.** *"Search legislators, states, or topics"*

**When empty.** *"Try a name (Ken King), a handle (KingForTexas), a state (TX), or a topic (health)."*

### 5.11 Methods (`/methods`)

**Purpose.** Explain, honestly, what the data is and how it was processed. Two audiences on one page.

**Structure.**

**5.11.1 Plain language, at the top (500 words max).**

*What is this data?* Public tweets from state legislator accounts.
*How were the topics assigned?* A topic model tagged each tweet with one of 21 substantive categories or "Uncategorized."
*Why are some legislators missing information?* We matched accounts to a public database of officeholders. About 39% didn't cleanly match, so those legislators appear in the corpus by name and handle but without demographic or district information.
*What does "voting position" mean?* It's a measure of how liberal or conservative a lawmaker's floor votes are, on a scale from about −3 to +3.
*Are these tweets verified?* They're archived from public accounts. Some accounts have since been deleted or made private, but the archived text is preserved here.
*What's not in this data?* Toxicity, misinformation flagging, and reply/quote engagement are either too sparse or not present in the source.

**5.11.2 For researchers (below the plain-language section).**

Full field-level provenance: which columns exist, which are populated at what rates, what the topic codes correspond to (CAP-adjacent classification), what the ideology scores are (Shor–McCarty and MRP references with citations), how the political classification score was derived, and known gaps. This section can cite academic references and use jargon freely.

**5.11.3 Change log.**

A short list of updates, versions, and the current data cutoff date, so a research citation can pin to a specific snapshot.

### 5.12 About (`/about`)

**Purpose.** Say what CivicWatch is, who built it, why, and how to contact them.

**Content (short).**
- *What CivicWatch is.* One paragraph.
- *Who built it.* A line about the group / lab / affiliation.
- *Why.* One paragraph — democratic accountability, open data, public interest framing.
- *How to get involved.* Link to feedback, link to the repository (if public), link to related publications.
- *Data acknowledgments.* Ballotpedia, X archive, topic model authors, ideology score authors.

---

## 6. Visualization catalog

Concrete specs for the visualizations named in the screen inventory.

### 6.1 Chamber View

- **Geometry.** Hemicycle spanning ~180° across the top of the frame. Legislators are 6-radius dots on desktop, 4 on tablet, 3 on mobile.
- **Positioning.** Along the arc by MRP ideology (−2.5 to +2.5 approximate range). Radial layers separate high-post-count legislators (closer to the center) from lower-volume ones (further out).
- **Coloring.** `ballot-blue`, `ballot-red`, `independent`, or `mute-soft` for unknown party.
- **Legislators without ideology position.** Rendered as a shorter secondary row above the arc, in party colors, sorted alphabetically. Labeled clearly.
- **Interaction.** Hover for a tooltip; click for a side panel; double-click to navigate to the profile.
- **Rendering.** Canvas at 3,000+ dots for performance; SVG below 500 for accessibility. Automatic switch based on population size.
- **Accessibility.** Full population list also available as a linked HTML table for screen readers.

### 6.2 Topic Ribbon

- **Type.** Stream graph — 22 bands over time, y-values sum to 100% (share of daily posts).
- **Ordering of bands.** Stable order across time (not by volume, which produces distracting wiggle). Recommended order: Government Operations, Health, Law and Crime, Civil Rights, Education, Environment, Energy, Macroeconomics, Housing, Banking and Commerce, Labor, Social Welfare, Agriculture, Transportation, Defense, Foreign Trade, International Affairs, Immigration, Space/Tech, Public Lands, Culture, plus Unclassified. Uncategorized (999) at the bottom in `mute-soft`.
- **Color.** A 22-value custom categorical palette that avoids party colors (so party and topic never collide). Uses tints of `seal`, `signal`, `ballot-blue`, `ballot-red`, `independent`, and a few in-between hues; details in appendix palette.
- **Interaction.** Hover to highlight one band; click to solo it (dims all others). A small time cursor snaps to daily granularity.

### 6.3 US Choropleth

- **Projection.** Albers USA (standard for U.S. state-level maps, includes Alaska and Hawaii insets).
- **Coloring.** Sequential scale in either `seal` or `ballot-blue` depending on metric; diverging scale in `ballot-red`/`ballot-blue` for signed metrics (e.g., "Dem chamber share centered at 50%").
- **Legend.** Below the map, small and unobtrusive; hoverable to snap the color scale to specific value ranges.
- **Missing data.** States with zero coverage (rare in this corpus) rendered in `rule` with a diagonal hatch pattern.

### 6.4 50-state small multiples

- **Layout.** 5 × 10 grid at wide breakpoints, 10 × 5 at medium.
- **Each cell.** State abbreviation top-left, a horizontal stacked bar of topic mix (using the topic ribbon's color mapping), and total post count below.
- **Cell height.** ~80px. Total component fits in one screenful.
- **Interaction.** Click any cell to navigate to `/place/{state}`. Hover highlights the cell and dims the others slightly.

### 6.5 Voice fingerprint

- **Type.** 22-bar horizontal chart with a party-median reference line. Each bar shows this legislator's share of posts on that topic; the reference tick shows the median share for their party.
- **Deviation encoding.** Bars extending past the party median are colored in the legislator's party color; bars falling short are colored in `mute`. So a Republican who talks about Environment less than the typical Republican gets a short muted bar; a Republican who talks about Government Operations more than typical gets a long red bar.
- **Sort.** By absolute deviation from party median, descending — so the "distinctive" topics rise to the top.
- **Alternative.** A radial version for compact display on profile pages; both variants supported.

### 6.6 Beeswarm on ideology

- **Purpose.** Show the ideological composition of a subset (a topic's speakers, a state's legislators, etc.).
- **Unit.** **One dot per legislator, not per post.** Rendering every post would exaggerate prolific accounts and produce an unreadable mass. Dot size (radius) is proportional to the legislator's post count in the current subset — the analytical weight lives in the mark size, not in mark multiplicity.
- **Layout.** Single horizontal axis (ideology), dots packed vertically where they'd overlap. Party-colored.
- **Density.** For very dense subsets, use a violin or KDE overlay in `rule` behind the beeswarm.
- **Coverage.** Only legislators with an ideology score appear on the axis. Those without a score render in a small strip below the axis labeled *"not scored,"* so no one is silently excluded.
- **Alternative modes** (analyst mode only). *Binned density* view for very large populations; *sampled post dots* only after zooming into a narrow ideology range.

### 6.7 Engagement scatter

- **Axes.** Post count on x (log scale, because volume is heavy-tailed), median engagement per post on y.
- **Dots.** One per legislator, party-colored.
- **Reference lines.** Median post count and median engagement as light `rule` lines to create quadrants ("high volume, high engagement" etc.).

### 6.8 Sparklines

- **Height.** 24px in profile headers, 16px in list rows, 12px in cards.
- **Line weight.** 1.5px.
- **Fill.** None on the smallest; a 10%-opacity fill on the larger variant.
- **No axes, no labels.** Tooltip on hover for the exact value.

### 6.9 What we do not draw

Deliberately not part of the visual vocabulary: pie charts, donut charts, 3D anything, word clouds, gauges, treemaps, network diagrams. When someone reaches for one of these, the answer is: use one of the eight above instead, or don't.

---

## 7. The Sampler

### 7.1 What it is

A row of real post cards drawn from the current filter context. It exists to answer, at every stage of the visit, the question *"but what does the data actually look like?"* — without making the visitor click "top posts" to see it. It grounds the abstract in the actual.

### 7.2 Static default, stream mode opt-in

- **Static (default).** A row of three or four post cards. No motion. A small **↺ Shuffle** button redraws a new sample. Each shuffle uses a server-side sampling endpoint that respects the current filter context.
- **Stream (opt-in).** A **▶ Play** button switches the row to horizontal drift at 30px/second, with new cards fading in on the right and drifting off the left. Speed is slow enough to read comfortably. Pauses on hover. Under `prefers-reduced-motion`, this button is disabled entirely — the option isn't offered.

### 7.3 Context awareness

- **On the landing.** No filter; the sample is drawn from the full 22M posts, weighted slightly toward higher-engagement so the samples are more interesting than raw random.
- **On an explorer.** Filtered to the current explorer's context. On `/place/TX`, the Sampler shows Texas posts. On `/topic/health`, health posts. On `/moment` with the scrubber at May 2022, posts from around that window.
- **On analyst mode.** Filtered to whatever the global filter bar dictates.

### 7.4 Post card anatomy

```
┌────────────────────────────────────────────┐
│  • Ken King @KingForTexas · [TX-H · REP]   │  ← identity line
│  Mar 14, 2022                              │  ← date
│                                             │
│  Standing with our teachers in Austin       │
│  today. Public education is the foundation  │  ← full text
│  of a strong Texas...                       │
│                                             │
│  [Education]                    ↻ 34 · ♡ 187│  ← topic chip + engagement
└────────────────────────────────────────────┘
```

- **Identity line.** Party dot (color-coded), name, handle, chamber-and-state tag, party abbreviation.
- **Date.** Human format ("Mar 14, 2022"), not ISO. Hover reveals the exact timestamp.
- **Text.** Full post text, never truncated. Line-wraps naturally. Any URLs kept as-is (rendered as underlined mute text, not linked, because target may not exist).
- **Topic chip.** The topic label in `seal`-tinted background. Clicking navigates to the topic drilldown. "Uncategorized" chip is `mute-soft`.
- **Engagement.** Retweets and likes with small glyphs. Zero values still shown (not hidden).
- **No avatars.** Twitter avatars are not stored in the database, and fetching them per card would be slow and privacy-fraught. A party-colored dot serves as the identifier.

### 7.5 Interactions

- **Click a card** — opens the legislator's profile.
- **Click the topic chip** — navigates to the topic drilldown.
- **Click the state/chamber tag** — navigates to the state page.
- **Shuffle** — redraws the sample.
- **Play** — starts stream mode; button becomes ⏸ Pause.

### 7.6 Accessibility

- Every card is a real link, tab-focusable.
- The Sampler container has a live-region politeness of `polite`, so screen readers hear new content as it arrives in stream mode without being interrupted mid-sentence.
- Under `prefers-reduced-motion`, only static mode is available and shuffles happen instantly with no fade.
- The row is scrollable with arrow keys when focused.

---

## 8. Moment annotations

A curated list of events with clear legislator-audience salience during the covered window. Each event has: a date (or short date range), a name, a category, and a one-line context note. Categories are filterable in the Moment Explorer.

### 8.1 Categories

- **Elections** — federal general elections and consequential state elections
- **Federal politics** — inaugurations, impeachments, high-profile appointments
- **SCOTUS** — major Supreme Court decisions
- **Mass violence** — mass casualty events and shootings with sustained national attention
- **Legislation** — signed federal legislation with state-level implementation implications
- **Crises** — pandemics, disasters, wars, other sustained national attention events
- **Legislative institution** — events that directly affected state legislative bodies

### 8.2 The list (2020–2024)

**2020**
| Date | Event | Category |
|---|---|---|
| Feb 5 | First Trump impeachment: Senate acquittal | Federal politics |
| Mar 11 – 13 | COVID-19 declared a pandemic; U.S. national emergency | Crises |
| May 25 – Jun 7 | George Floyd killed; nationwide protests | Crises |
| Sep 18 | Justice Ruth Bader Ginsburg dies | Federal politics |
| Oct 26 | Amy Coney Barrett confirmed to SCOTUS | Federal politics |
| Nov 3 | 2020 general election | Elections |
| Dec 14 | First U.S. COVID-19 vaccinations | Crises |

**2021**
| Date | Event | Category |
|---|---|---|
| Jan 6 | Capitol attack | Federal politics |
| Jan 13 | Second Trump impeachment (House) | Federal politics |
| Jan 20 | Biden inauguration | Federal politics |
| Mar 11 | American Rescue Plan Act signed | Legislation |
| Aug 15 – 30 | Kabul falls; U.S. withdrawal from Afghanistan | Crises |
| Sep 1 | Texas SB 8 (abortion) takes effect | Legislation |
| Nov 15 | Infrastructure Investment and Jobs Act signed | Legislation |

**2022**
| Date | Event | Category |
|---|---|---|
| Feb 24 | Russian invasion of Ukraine | Crises |
| May 14 | Buffalo grocery store mass shooting | Mass violence |
| May 24 | Uvalde school shooting | Mass violence |
| Jun 24 | Dobbs decision overturns Roe v. Wade | SCOTUS |
| Jun 25 | Bipartisan Safer Communities Act signed | Legislation |
| Aug 8 | Mar-a-Lago FBI search | Federal politics |
| Aug 16 | Inflation Reduction Act signed | Legislation |
| Nov 8 | 2022 midterm elections | Elections |

**2023**
| Date | Event | Category |
|---|---|---|
| Jan 3 – 7 | Kevin McCarthy speaker vote saga | Federal politics |
| Feb 3 | East Palestine, Ohio train derailment | Crises |
| Mar 27 | Covenant School shooting, Nashville | Mass violence |
| Apr 6 | Tennessee House expels state Reps. Jones and Pearson | Legislative institution |
| Jun 29 | SCOTUS ends race-based college admissions (SFFA) | SCOTUS |
| Aug 8 | Maui / Lahaina wildfires begin | Crises |
| Oct 7 | Hamas attack on Israel | Crises |
| Oct 25 | Lewiston, Maine mass shooting | Mass violence |

**2024**
| Date | Event | Category |
|---|---|---|
| Mar 26 | Baltimore Key Bridge collapse | Crises |
| Jul 1 | SCOTUS presidential immunity ruling (Trump v. United States) | SCOTUS |
| Jul 13 | Trump assassination attempt, Butler, PA | Federal politics |
| Jul 21 | Biden withdraws from presidential race | Federal politics |
| Sep 26 – 30 | Hurricane Helene | Crises |
| Oct 9 | Hurricane Milton | Crises |
| Nov 5 | 2024 general election | Elections |

That's 36 anchors. Enough to orient a visitor scrolling the timeline without cluttering it.

### 8.3 Editorial rules

- Every event on this list must have produced measurable state-legislator social media response (verifiable in the data before shipping the annotation).
- Category tags are exclusive — one category per event, whichever fits best.
- Context notes stay short and neutral: date, name, and factual descriptor only.
- We do not annotate individual legislators' personal moments or state-level controversies unless they made national news.
- The list is versioned. Adding an event later is a change worth logging on the methods page.

---

## 9. Interaction patterns

### 9.1 Filters

Two levels: contextual (per-explorer) and global (analyst mode). The active filter set is always displayed as **chips** rather than dropdowns, because chips make the current filter state visible without opening anything.

**Chip anatomy.**

```
┌─────────────────────────┐
│ State: TX, CA, NY  ✕    │
└─────────────────────────┘
```

- One filter per chip.
- Multi-select values comma-separated; if more than three, truncate to "TX, CA, NY + 2 more."
- **✕** dismisses the chip (clears the filter for that dimension).
- Adding filters is done via a **+ Add filter** button that opens a small popover with the available dimensions.

**Multi-select modals** (state, topic): a searchable list with checkboxes, plus a small map or category grouping where appropriate. Apply / Cancel at the bottom.

**Date range**: a two-thumb slider spanning Jan 2020 – Dec 2024, with preset buttons ("2020", "2021", "2022", "2023", "2024", "Full range"). No calendar picker in the default UI — but analyst mode adds an explicit date input for surgical windows.

**Clear all** appears as a subtle text link when ≥2 chips are active.

### 9.2 Search behavior (as in §5.10)

- ⌘K opens.
- Fuzzy on names and handles; exact on state codes; fuzzy on topic labels.
- Ranks: legislators by name-match strength → post volume; states are exact; topics by match strength.
- Recent searches persisted per session.

### 9.3 Drilldown

The pattern is consistent across visualizations:

- **Hover** — compact tooltip with 3–5 numbers, appears near the pointer, dismisses on mouseleave with a 200ms grace.
- **Click** — either navigates to a drilldown page or opens a side panel, per surface:
  - Map states → drilldown page.
  - Chamber View dots → side panel first (fast), with "Open profile →" for full navigation.
  - Topic ribbon bands → drilldown page.
  - Small-multiple cells → drilldown page.

### 9.4 Compare

- Available from every entity page via a **"Compare with…"** button.
- Slots default to four; three visible on tablet; one at a time (swipeable) on mobile.
- Entities can be mixed types (comparing a state to a party to a topic-restricted subset is valid — the shared panels handle mixed types gracefully).
- Compare state is URL-encoded (permalinkable).

### 9.5 Export

Three exports, all one click:

- **PNG** — high-DPI render of the current chart, with a small caption line at the bottom containing: chart title, active filters, `civicwatch.[domain]`, and the generation date. `paper`-colored border, no watermark.
- **CSV** — the data behind the current chart, downloaded with a filename like `civicwatch_topic_ribbon_2020-01_2024-12_by-party.csv`. Includes a header comment section with the query filters.
- **Permalink** — copies a URL that encodes the current filter state to clipboard, with a small "Link copied" toast. When reproducibility matters (citations, methods sections, screenshots that need to hold up over time), a **"Pin to snapshot"** toggle in the export menu appends the current snapshot ID (`?snap=cw_YYYY_MM_DD_NNN`) so the link resolves to the same data even after the corpus refreshes. Unpinned permalinks always follow the active snapshot.

The permalink is the most important export for a research tool. It lives alongside PNG/CSV and gets equal visual weight.

### 9.6 Save views and permalinks

Analyst mode adds a **"Save view"** button. Saved views store:

- The current filter set
- The current screen and any drilldown context
- A user-provided label

Saved views live in the browser's local storage in v1 (no accounts needed). They appear in the left rail in analyst mode as a small list. Clicking one restores the state.

Users can also export a saved view as a permalink (same URL encoding as regular permalinks) to share with others.

### 9.7 Keyboard

- **⌘K / Ctrl-K** — open global search
- **Escape** — close any open modal, drawer, or side panel
- **Tab / Shift-Tab** — cycle focus through interactive elements, in a coherent visual order
- **Arrow keys** — navigate within the roll-call grid, the small-multiples grid, the Sampler row, and the topic tile grid
- **Enter / Space** — activate the focused element
- **/** — focus the primary search box on `/who`
- **?** — open the Help overlay (any screen)

Focus outlines use `seal` at 2px, always visible on keyboard focus, hidden on mouse focus.

---

## 10. Copy and voice

### 10.1 Register

Direct, specific, quantified. Newsroom voice — Upshot, Bloomberg, FiveThirtyEight — not marketing, not academic. Every headline resolves to a number within one line. Sentence case, active voice, plain verbs.

### 10.2 Reference copy

**Landing hero.** *Twenty-two million posts from 5,927 U.S. state legislators, January 2020 through December 2024, opened up for anyone to explore.*

**Coverage strip.** *22.2M posts · 5,927 legislators · 50 states · 5 years*

**Sampler helper text.** *A random handful of real posts. Refresh to see more.*

**Chamber caption.** *Every legislator with voting-record data. Hover a dot for a name and party.*

**Entry chips.**
1. *Look up a legislator* — *Find any of 5,927 profiles, or browse the roll call.*
2. *Explore a state* — *Chamber composition, topic mix, and top voices.*
3. *Follow an issue* — *22 topic areas, from healthcare to defense, tracked over five years.*
4. *Revisit a moment* — *Scrub the timeline to see what was said around any date.*

**Explorer intro lines.**
- Look up: *Search by name, handle, state, or district — or scroll to browse.*
- Place: *Every state's chamber, colored by whatever you want to see.*
- Topic: *22 categories, five years, one glance.*
- Moment: *Drag the marker across the timeline.*

**Analyst-mode indicator.** *Analyst mode · [Exit]*

**Data caveat strip** (small, `warn`-tinted background, only where relevant). *This view uses 3,335 of 5,927 legislators — the ones with voting-record data. Others are still in the corpus and browsable.*

### 10.3 Numbers and formatting

- **Thousands separators.** Always. *22,190,944*, never *22190944*.
- **Big-number abbreviation.** Above 10,000: *22.2M posts*, *5.9K legislators*. Hover reveals exact.
- **Percentages.** One decimal below 10%, no decimals above. *4.5%*, *39%*.
- **Never bare percentages.** Always with base: *39% of profiled legislators*, not just *39%*.
- **Dates.** Human format for display (*Mar 14, 2022*); ISO in exports and metadata.
- **Ranges.** *Jan 2020 – Dec 2024* with an en-dash and non-breaking spaces around it.
- **Handles.** Rendered without the @ in display (*KingForTexas*), with the @ in searchable/copyable contexts.

### 10.4 Tone by state

- **Empty results.** Direct, actionable. *Nothing matches "vlkjs." Try a name, a handle, or a state code.*
- **Loading.** Silent (skeletons only) for anything under 500ms; a small centered spinner with an explanatory line otherwise. *Fetching 2.3 million posts for this window…*
- **Errors.** Specific and human. Not *An error occurred.* Instead: *We couldn't load the topic breakdown. Try again in a moment, or check the status page.*
- **Data caveats.** Neutral. Not *unfortunately* or *sorry* — just state the coverage.

---

## 11. States and edge conditions

### 11.1 Empty

- **Empty search.** *"Nothing matches [query]. Try a name (Ken King), a handle (KingForTexas), a state code (TX), or a topic name (health)."*
- **Empty filter combination.** *"No posts match this combination. Try widening the date range, or clearing one filter."* Plus a *Clear all* button.
- **Empty legislator (has no posts in the current filter).** *"[Name] has no posts in this window. Try widening the date range."*

### 11.2 Loading

- **<200ms:** No spinner. Just render when ready.
- **200ms – 1s:** Skeleton placeholders in the shape of the target content.
- **>1s:** Skeleton plus a subtle progress indicator (a slow-pulse bar at the top of the affected panel, not a full-page spinner).
- **>10s or streaming:** A specific explanatory line and an animated bar with rough progress percentage where derivable.

### 11.3 Error

- **Network / server error.** Contained to the affected panel, not a whole-page error. *"Couldn't load [thing]. [Retry]"*
- **404 (bad legislator id, bad state code, bad topic id).** Full-page but calm. *"We don't have a record for that. Try searching."* Plus the search modal, pre-opened.
- **Rate limits / quota.** *"Slow down — we're limiting requests briefly. Try again in a moment."*

### 11.4 No-data indicators

Wherever a field is missing on an entity, render a clean placeholder rather than hiding the row:

- **Text field missing.** `—` (em-dash), color `mute-soft`.
- **Number field missing.** `—` (em-dash), color `mute-soft`.
- **Ideology position missing.** *"— (not scored)"* with hover: *"No voting-record match; ideology position unavailable."*
- **Party unknown.** Party dot in `mute-soft` instead of a party color; label *"Party unknown."*

### 11.5 Gaps in coverage

The tool is honest about temporal and demographic coverage. Where a chart plots something over time and the underlying series has gaps (rare, but possible for individual legislators), gaps render as a break in the line rather than a linear interpolation. Where a state's post count is small, the state's tile in small-multiples gets a small "n = 43 posts" caption instead of pretending the tile represents the same evidentiary weight as Texas.

---

## 12. Responsive strategy

### 12.1 Breakpoints

- **≥1280px** — full desktop layout, 12-column grid, side rails visible in analyst mode.
- **960 – 1279px** — primary content compresses; side rails collapse into a top strip; 8-column grid.
- **640 – 959px** — single-column primary, filter chips wrap, small-multiples grid becomes two-row scroll or 5×10 depending on aspect.
- **<640px** — mobile view, described below.

### 12.2 Mobile-first considerations

Most citizens will encounter CivicWatch via a link from a news article or a share. The mobile landing must complete the visitor's whole first minute without asking them to zoom, pinch, or land on desktop-first chrome.

**Mobile landing:**
- Wordmark, then a shorter intro line: *22 million posts from 5,927 state legislators, 2020–2024.*
- Compact coverage strip (may wrap to two rows).
- The Sampler as a **single stacked card**, with a bigger "Shuffle" tap target.
- Four entry paths as full-width stacked buttons, generous tap area (56px min height).
- The Chamber View is de-prioritized on mobile — either not shown, or shown much smaller and further down (under the entry buttons), scaled to fit.
- Footer with methods + about + feedback.

**Mobile explorer views:**
- Filters accessible via a bottom sheet triggered by a **Filter** button in the top bar.
- Charts render at reduced dimensions; some (like the 50-state grid) become a scrollable strip.
- Compare page collapses to a swipeable carousel of the same panels.
- Legislator cards render as full-width single-column list rows.

### 12.3 Tablet

Tablet lives between: not full desktop's 12-column comfort, not mobile's stacked simplicity. The strategy is a compressed desktop rather than an expanded mobile. All the same views work; the small-multiples grid becomes 10×5; the Chamber View compresses horizontally and slightly deepens.

### 12.4 Print / PDF

A print stylesheet exists. It renders any explorer view or drilldown page as a clean printable document:

- Hairline rules only, no card shadows.
- Filters listed at the top as a bulleted line.
- Source and generation-date footer at the bottom of every page.
- Charts render as sharp vector output (SVG).
- Interactive elements (search, filter, tooltips) hidden.

Researchers and journalists paste screenshots and PDFs into slides. This deserves to look right without effort.

---

## 13. Accessibility

### 13.1 Motion

- All motion respects `prefers-reduced-motion`. Under this preference: the Roll Call reveal renders as an instant placement, the Sampler stream mode is disabled entirely, chart morphs use crossfades instead of shape animations, and hover transitions drop from 120ms to 0ms.
- No motion is required to understand any content. Every animated affordance has a static equivalent.

### 13.2 Color and contrast

- **Text on paper**: `ink` on `paper` = 14:1 (AAA).
- **Body on card**: `ink` on `card` = 14.7:1 (AAA).
- **Secondary text**: `mute` on `paper` = 4.7:1 (AA small text, AAA large).
- **Party colors** all pass AA for large text and marks on paper.
- **Color-only signaling is prohibited.** Every color-encoded distinction (party, engagement, topic) has a redundant textual or shape encoding. Party dots have letter labels (D, R, I) at their smallest sizes.

### 13.3 Keyboard

- Full keyboard operability. Every interactive element is tab-focusable.
- Focus visible: 2px `seal` outline with a 2px offset, never removed.
- Skip links at the top of every page: *Skip to main content*, *Skip to filters*.
- Modal focus trap: opening a modal moves focus in and returns focus to the trigger on close.

### 13.4 Screen readers

- Semantic HTML throughout. Headings, landmarks, lists, tables.
- Every chart has:
  - A visible title (an `<h2>` or `<h3>`).
  - A visible caption describing what it shows in words.
  - An `aria-describedby` linking to a longer plain-language summary of the chart's shape and headline numbers.
  - A "View as table" toggle that renders the underlying data as an accessible `<table>`.

### 13.5 Chart accessibility

Each visualization type has a corresponding tabular representation:
- Chamber View → a table of legislators with party, state, chamber, ideology score.
- Topic Ribbon → a matrix of topic by year with share values.
- Choropleths → a state-by-metric table.
- Small multiples → a state-by-topic matrix.
- Voice fingerprint → a topic-by-share table with the party median column.
- Beeswarm → the underlying (legislator, ideology) pairs as a table.
- Scatter → an (x, y, party) table.
- Sparklines → a list of (period, value) pairs.

The table view is not just for screen readers — it's a legitimate power-user view for anyone who wants to read the numbers rather than the picture.

---

## 14. Performance

Design decisions with performance implications, flagged for the technical implementation doc.

### 14.1 Materialized views

Any aggregation exposed in the UI that could be computed against `topic_engagement_daily`, `topic_party_breakdown`, or `topic_state_breakdown` should be. These are pre-computed for exactly this purpose. The materialized views cover the daily-topic time series, the topic × party crosstab, and the topic × state crosstab — which together drive the topic ribbon, party breakdowns on topic tiles, state choropleths (for topic-related metrics), and the 50-state small-multiples grid.

### 14.2 Canvas vs. SVG

- **SVG** for anything with <500 shapes, or where individual accessibility of shapes matters (charts with per-mark hover, small multiples cells, topic tiles).
- **Canvas** for the Chamber View when rendering >1,000 dots. Interaction handled via hit-testing on the canvas.
- **HTML/CSS** for cards, lists, and tabular content.

### 14.3 Sampler streaming

- The Sampler queries a server-side sampling endpoint that respects the current filter context.
- In stream mode, requests are batched — one request returns 12 posts, which then feed the drift for ~40 seconds before the next batch is requested.
- Sampling weighted slightly toward engagement to keep samples interesting; the weighting is disclosed in methods.

### 14.4 Client-side budget

- **JS bundle target:** ≤180KB gzipped for the landing route.
- **Time to interactive on landing:** ≤2s on a mid-tier mobile device on 4G.
- **Chart libraries:** favor small composable primitives (d3-shape, d3-scale, d3-array) over full frameworks. Recharts or Observable Plot considered for prototyping; final choice deferred to the technical doc.
- **Fonts:** display, body, and mono all subset to a Latin-basic + numerics subset for the landing route; extended sets loaded on-demand.

---

## 15. Data update strategy

### 15.1 The snapshot promise

CivicWatch shows a **dated snapshot**, not a live feed. Every page footer displays *"Data through [date]"*. The corpus does not update in-browser; it's refreshed on a cadence (see below) and versioned.

### 15.2 Refresh cadence (proposed)

- **Corpus refresh:** as-needed, when new tweets are added and topic-modeled by the research pipeline. Practically, expect refreshes every few months.
- **Materialized views:** rebuilt as part of every corpus refresh.
- **Legislator metadata:** rebuilt as part of every corpus refresh, using the latest Ballotpedia and voting-record joins.
- **Moment annotation list:** versioned separately, editable between refreshes.

### 15.3 What "cutoff" means

The current corpus covers January 1, 2020 through December 31, 2024. When a citizen visits the Moment Explorer and drags the scrubber past the cutoff, the timeline greys out beyond the cutoff with a note: *"Coverage ends December 2024. The corpus is a snapshot, not live."*

---

## 16. What we are deliberately not doing

Listing again — a good design document names its omissions.

- **No toxicity dashboard.** Source data is too sparse (§2.4).
- **No misinformation feature.** Data is essentially absent.
- **No network / retweet-graph view.** The database doesn't store retweet relationships.
- **No AI-generated summaries of legislator activity.** Quinn's Democratic Audit work is precisely about auditing that — CivicWatch is not going to introduce a new class of AI artifact it can't itself audit.
- **No sentiment scoring beyond what exists in the source.** No inferring new columns.
- **No "trending now."** The corpus has a hard cutoff; "now" framing would be misleading.
- **No engagement leaderboards on the landing.** Ranking legislators by likes at the front door invites clickbait patterns.
- **No party-affiliation reveal as a "gotcha."** Party is always visible.
- **No forced onboarding tour.** Citizens don't want them.
- **No dark mode in v1.** Roll Call is a paper-first design; a dark mode is a design project unto itself.
- **No "share to social" buttons.** Permalink is enough; the tool doesn't need to be a share funnel.
- **No user accounts in v1.** Saved views live in browser storage.

---

## 17. Build order (suggested)

An implementation sequence that keeps the product useful at every milestone.

**Milestone 1 — Foundation and lookup.**
- Design system tokens (colors, type, layout) implemented.
- Landing page (static content, no live data yet — just the layout).
- Legislator search and browse (`/who`).
- Legislator profile page (`/who/{lid}`), including the Voice Fingerprint.
- Basic post card component (§7.4).

Deliverable: a working "look up your state legislator, see everything they said" product. Already useful.

**Milestone 2 — Places.**
- Place explorer (`/place`) with US choropleth and small-multiples grid.
- State drilldown (`/place/{state}`).
- Filter chip system (contextual filters).

Deliverable: adds the "explore your state" story.

**Milestone 3 — Topics.**
- Topic explorer (`/topic`) with Topic Ribbon and topic tiles.
- Topic drilldown (`/topic/{id}`).
- Beeswarm on ideology.

Deliverable: adds the "follow an issue" story.

**Milestone 4 — Moments.**
- Moment explorer (`/moment`) with scrubber, category filter, and window control.
- Curated event annotation list from §8.

Deliverable: full four-path landing is live and coherent.

**Milestone 5 — Analyst mode.**
- Global filter bar.
- Compare page (`/compare`) with up to 4 slots.
- Export (PNG, CSV, permalink).
- Saved views (browser storage).

Deliverable: research-grade depth. Journalists and political scientists can cite.

**Milestone 6 — Polish and integrity.**
- Sampler stream mode (opt-in).
- Full accessibility pass (screen-reader tables, focus, reduced-motion).
- Methods and About pages.
- Print stylesheet.
- Mobile-specific optimizations.

Deliverable: shipping-quality product.

---

## 18. Remaining open questions

Smaller than v1's list, but a few worth naming.

1. **Ideology score labeling.** Show the numeric score on profile headers, or only the qualitative label ("moderate right")? Numeric is honest but jargon; qualitative is legible but loses precision. Draft answer: show both, with the qualitative first and the numeric in a mute smaller line beneath.
2. **Topic tile sort default.** By volume (most posted about) or by growth (biggest movers)? Draft answer: by volume, since it matches citizens' expectations of "what's talked about most."
3. **Sampler weighting.** Uniform random, or engagement-weighted? Draft answer: mild engagement weighting (log-scaled) so samples aren't dominated by zero-engagement posts, but low-engagement posts still appear.
4. **Legislator profile URL format.** `/who/{lid}` vs. `/who/{handle}` vs. `/who/{state}/{lastname}`. `lid` is stable but ugly; `handle` is legible but changeable. Draft answer: canonical URL is `/who/{lid}` with a redirect from `/who/{handle}` when a handle is available.
5. **Public repository.** If the code is public, we can link to it from the footer. If it's private for now, we omit. Decision: awaiting.
6. **Feedback channel.** Email, form, GitHub issues, or a small in-app widget? Draft answer: a mailto link in v1, upgrade later.

---

## 19. Appendix: token reference

**Color tokens** (see §3.2 for use).

```
--ink:           #1a1917
--paper:         #f5f1e7
--card:          #ffffff
--rule:          #d9d2c1
--mute:          #6b6659
--mute-soft:     #9c9787
--ballot-blue:   #274b6e   /* Democratic */
--ballot-red:    #a13530   /* Republican */
--independent:   #7a6a4a
--seal:          #8a5a1a   /* accent */
--signal:        #3a6c4c   /* positive change */
--warn:          #a86a1f   /* data caveat */
--error:         #8a2a20   /* actual error */
```

**Topic band palette** (see §6.2). Two dozen values distinct from party colors — final swatches to be finalized in the implementation doc, but the design principle is: tints of `seal`, `signal`, `ballot-blue` desaturated, `ballot-red` desaturated, `independent`, plus muted mid-tones.

**Typography stacks** (see §3.3).

```
--display: "GT Alpina Wide", "Neue Machina", "Söhne Breit",
           "Inter Tight", ui-sans-serif, system-ui, sans-serif;

--body:    "Instrument Sans", "Untitled Sans", "Söhne",
           ui-sans-serif, system-ui, sans-serif;

--mono:    "JetBrains Mono", "IBM Plex Mono", "Söhne Mono",
           ui-monospace, monospace;
```

**Spacing scale.** 4, 8, 12, 16, 24, 32, 48, 64, 96 (px).

**Radii.** 4 (chips), 6 (cards, buttons), 10 (side panels), 0 (charts, tables).

**Elevation.** Cards use a single elevation on hover: `0 4px 16px rgba(26, 25, 23, 0.06)`.

---

*End of design document.*

*Next: the technical implementation document (`civicwatch_technical_spec.md`) picks up from here — covering the stack (SvelteKit + Fastify + PostgreSQL), materialized-view schemas, API contracts, canvas rendering strategy for the Chamber View, snapshot activation, the deployment topology, and a concrete build order matching §17.*
