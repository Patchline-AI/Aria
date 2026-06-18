---
name: fans
description: "Know and grow your fans. Pull a grounded read on the artist's audience — how many fans, where they are, which segments are converting — and tie it to storefront sales and share-link performance, with concrete next moves. Use when the user says \"who are my fans\", \"where are my listeners\", \"how's my audience\", \"how are sales\", \"how's my storefront doing\", \"where should I tour/advertise\", or \"how do I grow my fanbase\". MCP-grounded: get_audience_overview / get_audience_geo / get_fan_segments + get_store_analytics / get_surface_analytics. Aggregates only — never individual fan names or emails."
argument-hint: "[optional: a city/region to focus on, a store slug, or a share URL to analyze]"
model: claude-sonnet-4-6
allowed-tools:
  - Read
  - AskUserQuestion
  - aria
---

## Your task

Give the artist a clear, grounded picture of their direct-to-fan audience and turn it into next moves — tour routing, ad geo-targeting, localized release pushes, segment re-engagement. The flow:

1. **Audience shape** — `get_audience_overview` (total fans, captures, repeat/active, capture rate, buyers, store revenue).
2. **Where they are** — `get_audience_geo` (city-level hubs, countries/cities).
3. **Who's converting** — `get_fan_segments` (segment counts and rates).
4. **Sales + link performance** — `get_store_analytics` (storefront) and `get_surface_analytics` (a specific share/drop/smart link).

**The hard privacy rule:** every tool here returns **aggregates only**. Never expose, ask for, or invent an individual fan's name, email, or per-fan journey. If the user asks "who specifically bought X," explain the MCP surface is aggregate-only by design and point them to the dashboard for anything fan-level.

Both solo artists and labels use this. Keep copy role-agnostic.

## Supporting files

- [`../../CLAUDE.md`](../../CLAUDE.md) — voice, MCP grounding, never surface internal provider names, never invent metrics.

## Step 1: Scope what they're asking

Most asks map to one or two tools — don't pull everything reflexively. Quick map:

- "who/how many are my fans", "how's my audience" → `get_audience_overview`
- "where are my fans", "where should I tour / run ads" → `get_audience_geo`
- "which fans convert", "repeat buyers", "segments" → `get_fan_segments`
- "how are sales", "how's the storefront" → `get_store_analytics`
- "how's my link/drop doing" → `get_surface_analytics` for that surface

If the ask is broad ("how's my audience and what should I do"), run overview + geo + store analytics together and synthesize. If narrow, run just the relevant tool. Use AskUserQuestion only when genuinely ambiguous (e.g. they have several stores and you need the slug).

## Step 2: Pull the grounded data

### Audience overview
`mcp__aria__get_audience_overview` (no args) → total fans, captures (7/30d), repeat + active fans, capture rate, CTA clicks, buyers, store revenue, identity stats (known vs anonymous). This is the single best grounding call for audience-growth decisions.

### Geography
`mcp__aria__get_audience_geo` with `{ windowDays: 30 }` (default 30, configurable up to 365) → city-level hubs with fan counts, total countries/cities. Use for tour routing, ad geo-targeting, localized pushes.

### Segments
`mcp__aria__get_fan_segments` with optional `{ storeSlug }` → segment counts and conversion rates. Counts and rates only — no raw emails/names/journeys.

### Storefront sales
`mcp__aria__get_store_analytics` with `{ days: 30 }` (default 30, up to 3650) → aggregate storefront analytics for the seller. Buyer emails are omitted by design.

### A specific link
`mcp__aria__get_surface_analytics` with `{ shareId }` or `{ url }` → views, captures, downloads, plays, last viewed for one share/drop/smart link.

For any call that returns `isError` or an empty/zero state, say so plainly — "no capture data yet" is a real, useful answer. Don't fill a gap with a plausible-sounding number. If the user has no audience data at all (new account), say the fan graph is empty and point them at shipping a link/storefront first (the `link` and `drop` skills) so captures start flowing.

## Step 3: Synthesize into moves

Translate the real numbers into 2–4 concrete next actions. Examples (only use the ones the data supports):

- High capture rate but low repeat fans → "your hooks convert; set up a re-engagement push to the <segment> segment." (counts from `get_fan_segments`)
- A clear top-city cluster → "tour/ad spend leans toward <city, city, city>." (from `get_audience_geo`)
- Store revenue concentrated in one track → "that track is carrying sales — consider a smart link push and a follow-up." (from `get_store_analytics`)
- Many anonymous vs known events → "most fans are anonymous — a capture CTA on your link would convert more to known fans." (from overview identity stats)

Every recommendation must cite a real number you just pulled. No "you probably have fans in..." — only what the geo data shows.

## Step 4: Report

Lead with the shape, then the moves. ≤6 sentences:

> You have **<total fans>** fans (<repeat>/<active> repeat/active, <capture rate> capture rate). Top hubs: **<city (N)>, <city (N)>, <city (N)>**. <Store line: "<N> buyers, <revenue> store revenue over <days>d.">. Moves: <2–4 grounded next actions>. <If a gap: "No <X> data yet — <next step>.">

Aggregates only. If they want fan-level detail, point to the dashboard.

## Error handling

- **A tool returns isError** → surface the exact message + next step; still report whatever other calls succeeded.
- **Empty / zero state** → report it honestly; point at `link`/`drop` to start capturing fans.
- **User asks for individual fan identities** → explain the surface is aggregate-only by design; dashboard for fan-level.
- **Multiple stores, ambiguous slug** → AskUserQuestion for the `storeSlug`.
- **MCP auth expired** → "Run `/mcp`, reconnect `plugin:aria:aria`, try again."

## Common mistakes

- **Exposing or inventing individual fan names/emails/journeys.** Every tool here is aggregate-only — keep it that way, and never fabricate a fan.
- **Inventing metrics to fill a gap.** "No data yet" is the correct answer when a tool returns empty.
- **Pulling every tool for a narrow question.** Match the call(s) to the ask; these reads are cheap but noise isn't free.
- **Giving generic growth advice** ungrounded in the numbers. Every move cites a real figure you pulled.
- **Reporting a default lookback as if the user chose it** — note the window (e.g. "over 30 days") so it doesn't read as all-time.
- **Surfacing the analytics/fan-graph provider name** to the user — Patchline voice only.
