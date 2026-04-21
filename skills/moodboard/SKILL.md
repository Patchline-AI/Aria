---
name: moodboard
description: "Third lifecycle phase. Produces MOODBOARD.md — a concrete sonic reference grounded in the artist's actual catalog and real Cynite audio features. Builds on BRIEF.md + VISION.md. Uses `catalog_search` to find reference tracks in the user's catalog (by vibe / genre term), and `get_song_intelligence` / `get_audio_features` to pull real BPM/key/energy/valence — no invented numbers. Use when STATE.md shows `Current phase: moodboard`. Routes to songwriting-brief or release-plan depending on `Composition status`. Invoked via `/aria:next`."
argument-hint: "[optional — no arguments expected; reads context from .patchline/]"
model: claude-sonnet-4-6
prerequisites:
  - vision-story
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - AskUserQuestion
  - aria
---

## Your Task

Produce `.patchline/artifacts/MOODBOARD.md` — a working moodboard that takes the VISION.md abstractions (sonic identity, tonal palette) and grounds them in concrete sonic references with REAL audio features. Every BPM, key, energy score, valence score MUST come from a Cynite / Soundcharts MCP call. **No invented numbers. No "around 128 BPM" estimates. If Cynite hasn't analyzed a track yet, say so.**

You will:
1. Read BRIEF.md + VISION.md + PROJECT.md + STATE.md
2. Search the user's catalog for tracks that match the vision's vibe keywords via `catalog_search`
3. Pull real audio features for candidate reference tracks via `get_song_intelligence`
4. Offer 3–6 candidates to the user via `AskUserQuestion` (multi-select) — let them confirm / swap
5. Build feature-target ranges (BPM, keys, energy, valence) from the analyzed references only
6. Capture the user's visual-mood direction and production cues in their own words
7. Produce `MOODBOARD.md`
8. Update `STATE.md` — append to `Completed phases:` (do NOT advance `Current phase:` — `next` handles that on the next invocation)

The moodboard is where abstraction meets measurable reality. VISION.md said "patient, dub-heavy, unromantic"; MOODBOARD.md says "references cluster 118–124 BPM, minor keys (A minor + D minor dominant), Cynite energy 0.4–0.55, valence 0.25–0.40, based on tracks <X>, <Y>, <Z> from your catalog".

## Supporting files

- [`../../CLAUDE.md`](../../CLAUDE.md) — voice, workspace contract, MCP grounding rules
- [`../vision-story/SKILL.md`](../vision-story/SKILL.md) — predecessor; VISION.md is your primary input
- [`../songwriting-brief/SKILL.md`](../songwriting-brief/SKILL.md) — successor if `Composition status` is `partial` or `writing`
- [`../release-plan/SKILL.md`](../release-plan/SKILL.md) — successor if `Composition status` is `complete` (skips songwriting-brief)

## Step 1: Read workspace context

Use Read in this order:

- `.patchline/STATE.md` — confirm `Current phase: moodboard`. Capture `Composition status:` (valid values: `complete`, `partial`, `writing`) — you'll need it in Step 8 for the hand-off message. If current phase is something else, STOP and say: "STATE.md says we're in phase `<X>`, not moodboard. Run `/aria:next` to invoke the correct phase, or edit STATE.md if intentional."
- `.patchline/PROJECT.md` — extract: artist name, Patchline artist ID (if in roster), primary genres, `Distribution mode`.
- `.patchline/artifacts/BRIEF.md` — context.
- `.patchline/artifacts/VISION.md` — extract: sonic identity, reference artists (canonical names), tonal palette adjectives. These are your vibe keywords for catalog search.
- `.patchline/artifacts/MOODBOARD.md` — if it ALREADY exists, ask the user: "MOODBOARD.md already exists. Overwrite, refine in place, or cancel?"

If VISION.md is missing, STOP: "VISION.md is missing from `.patchline/artifacts/`. Run `/aria:next` — it will detect the drift and re-run vision-story."

If `Composition status` is missing or unrecognized, STOP: "STATE.md is missing `Composition status:` (valid: `complete`, `partial`, `writing`). Edit STATE.md to set it, then re-invoke."

## Step 2: Search the catalog for reference candidates

Derive search queries from VISION.md:

- A **vibe query**: 2–3 adjectives from the tonal palette + 1 phrase from the sonic identity. Example: `"dub-heavy sparse 4am"`.
- A **genre query** (fallback): a single primary genre from PROJECT.md — e.g. `"tech-house"`, `"ambient"`, `"indie pop"`.

### Always call

- `mcp__aria__catalog_search` with the vibe query. This is an in-memory substring + field-weighted scan across the user's catalog. It accepts `{ query: string, limit?: number }` — there are NO genre / key / BPM filters; all filtering happens via the query tokens. Set `limit: 10`.

### Conditionally call

- **If the vibe query returns fewer than 3 scored hits**, call `mcp__aria__catalog_search` again with the genre query (e.g. `"tech-house"`). This is a wider net that still respects the same schema — just broader tokens.
- **If both queries return zero relevant-looking hits** (common for artists who just joined Patchline or haven't imported yet), call `mcp__aria__browse_catalog` with `{ page: 1, pageSize: 20 }` as an **unfiltered** paging fallback — scan the first page manually and score by eye against the tonal palette. `browse_catalog` ONLY accepts `page` + `pageSize`; do not pass a genre / filter argument.
- **If still nothing clusters around the vision**, tell the user: "Your catalog is thin for this vibe — `catalog_search` surfaced nothing tight, and the first page of `browse_catalog` doesn't cluster either. Options: (a) name external reference tracks (I'll look them up via `catalog_search` on their title / artist, or via `get_audio_features` with a Spotify URL if you have one), (b) skip the reference-track section and build the moodboard from visual/production cues only, (c) pause moodboard, run a catalog import, and resume later." Respect their choice.

### If a tool returns `isError: true`

- Surface the exact error to the user, then try the next fallback in order (vibe → genre → browse → user-named external refs). If ALL paths error, skip the reference-tracks section; build the moodboard from visual/production cues only. Do NOT fabricate candidate tracks.

## Step 3: Pull real audio features for candidates

For each candidate from Step 2 (cap at 6 — more is noise), call `mcp__aria__get_song_intelligence` with the track's `id` field from `catalog_search` / `browse_catalog` output, passed as `{ assetId: "<id>" }`. This returns the complete intelligence bundle: `cyniteMetadata` (BPM, key, energy, valence, danceability, acousticness, moods, genres) + `aiMetadata` + Soundcharts `songIntelligence`.

Fallback:

- If `get_song_intelligence` returns `isError: true` for a specific track, try `mcp__aria__get_audio_features` with the same `{ assetId: "<id>" }` — it's the thinner endpoint and is more tolerant.
- If BOTH return `isError` or `available: false` for a track, mark it `UNANALYZED` in your working list — Cynite hasn't processed it yet.

**Never pass `song_id`.** The real argument name is `assetId`. Other accepted shapes are `isrc` and `spotifyTrackUrl` — use those only for external references that aren't in the user's catalog.

### If Cynite hasn't analyzed a candidate

Common case — metadata-only imports don't have Cynite features yet. Handle per-track:

- Mark the candidate `UNANALYZED`.
- When offering candidates in Step 4, annotate: "Cynite hasn't processed this one — no BPM/key data yet."
- Do NOT invent features. A candidate without real BPM/key data does NOT contribute to the feature-target ranges in Step 5.

## Step 4: Offer candidates via AskUserQuestion

Present 3–6 candidates, ranked by apparent fit. Prefer `AskUserQuestion` (multi-select) so the user can pick two or more anchors in one interaction; fall back to a plain-text numbered list if `AskUserQuestion` is unavailable.

### Preferred — AskUserQuestion (multiSelect)

Call `AskUserQuestion` with:

```
header: "Moodboard"          (max 12 chars — HARD LIMIT)
question: "Which Cynite-analyzed tracks should anchor the moodboard?"
options:
  - label: "<track title>"
    description: "<real BPM> BPM · <real key> · energy <real> · valence <real>"
  - label: "<track title>"
    description: "<real features or 'UNANALYZED — no Cynite data yet'>"
  - label: "<track title>"
    description: "<features or note>"
  ... (3–6 options total)
multiSelect: true
```

Label length: keep each under ~60 chars — track titles usually fit. Description is where you put the concrete feature numbers. UNANALYZED tracks CAN be in the option list (users may still want them as qualitative anchors), but label them clearly in the description.

After the response:

- **One or more selected** → capture those as the confirmed references. Continue to Step 5.
- **None selected / "Other" selected with empty text** → output the single line: "Name the tracks you want as references — yours or external. I'll look them up." STOP and wait for the user's next message.
- **Empty response** → retry once with the same parameters. If still empty, fall through to the plain-text fallback below.

### Fallback — plain-text numbered list

If `AskUserQuestion` is unavailable (older Claude Code version, or the call errors), present:

```
Reference candidates from your catalog:

1. "<track title>" — <real BPM> BPM, <real key>, energy <real>, valence <real>
   Fit: <1 sentence on why it matches the vision>

2. "<track title>" — <features>
   Fit: <...>

3. "<track title>" — UNANALYZED (Cynite pending)

Which 2–4 of these feel right as references? Reply with numbers
(e.g. "1, 3"), or swap any for a track I didn't surface — name it and
I'll look it up.
```

Wait for the user's plain-text reply.

### External references

If the user names a track not in the candidate list:

- If it looks like one of their own tracks, call `mcp__aria__catalog_search` with `{ query: "<title> <artist>" }` → if matched, call `get_song_intelligence` with the returned `assetId`.
- If it's clearly external (different artist, or they hand you a Spotify URL), call `mcp__aria__get_audio_features` with `{ spotifyTrackUrl: "<url>" }` or `{ isrc: "<code>" }`. Note: external refs return streaming intelligence only, NOT Cynite audio features — they won't contribute BPM/key/energy numbers to the feature-target ranges.
- If no match at all, flag it as `unverified external reference — no features` in the moodboard.

## Step 5: Build feature-target ranges

From the confirmed references (analyzed only — skip UNANALYZED and external-streaming-only), compute:

- **BPM range** — `min–max` from the reference set, widened by ±2 BPM on each end.
- **Key preferences** — distinct keys in the references (e.g. "A minor, D minor, F minor"). If all references share a mode (all minor / all major), note it. Do NOT invent a "preferred key" the references don't support.
- **Energy band** — `min–max` Cynite energy, widened by ±0.05.
- **Valence band** — `min–max` Cynite valence, widened by ±0.05.
- **Danceability / acousticness** — only include if the references cluster tightly (e.g. all >0.7 danceability). If scattered, skip — no meaningful target.

**Critical:** if only 1 reference is analyzed, the "range" is that single value ±5%. Say so: "Range based on 1 analyzed reference — widen as you add more."

If no reference was analyzed or confirmed, SKIP the feature-target section entirely. Do not fabricate.

## Step 6: Capture visual mood + production cues

Two short free-form questions — ask them as regular Claude prompts (NOT `AskUserQuestion`; these need open-ended answers, not picks from a list). One at a time:

1. **Visual mood** — "If this project had a visual palette in 3 words, what is it? Colors, texture, imagery."
   - Good answers: "concrete, sodium-orange, humid"; "wet asphalt, neon, cold"; "saturated desert, gold, burnt".
   - Flows into cover-art / canvas decisions later — not here.

2. **Production cues** — "Any specific production moves you want to lean into? Reverbs, rooms, processing, arrangement quirks."
   - Good answers: "Heavy spring reverb on percussion, dry vocal"; "Analog tape saturation throughout"; "Silence as a compositional element".
   - If the user says "no specific cues, just vibe" — fine, write "no specific production cues flagged".

If `get_song_intelligence` surfaced mood-tag / instrument-detection data on the confirmed references, offer a one-line context cue before Q2: "Cynite flagged `<reference>` as featuring prominent synth bass + minimal percussion — any of that carry forward?"

## Step 7: Draft MOODBOARD.md

Use the Write tool to create `.patchline/artifacts/MOODBOARD.md`:

```markdown
# Moodboard: <project-name>

> Generated by `/aria:next` (moodboard skill) on YYYY-MM-DD · v1
> Grounded in: BRIEF.md, VISION.md, `catalog_search` (query: "<query used>"), `get_song_intelligence` / `get_audio_features` (<N> tracks analyzed), user confirmation dated YYYY-MM-DD.

## Reference tracks

<If user confirmed 2+ tracks:>

| Track | BPM | Key | Energy | Valence | Source |
|---|---|---|---|---|---|
| "<title>" | <real BPM> | <real key> | <real energy> | <real valence> | User's catalog |
| "<title>" | <real BPM> | <real key> | <real energy> | <real valence> | External — <artist name>, streaming only (no Cynite features) |
| "<title>" | UNANALYZED | — | — | — | User's catalog — Cynite pending |

<If any reference is UNANALYZED, note below the table:>
*UNANALYZED references will gain feature data once Cynite processes audio. Re-run `/aria:next` (moodboard) to refine the targets after analysis completes.*

<If no reference tracks were confirmed:>

*No reference tracks on this moodboard — the artist is working without a catalog anchor. Downstream phases (songwriting-brief, release-plan) will lean on VISION.md's qualitative direction + tonal palette instead of feature targets.*

## Audio-feature targets

<If ≥1 analyzed reference:>

- **BPM range:** <min>–<max> (based on <N> analyzed references, widened ±2)
- **Key preferences:** <list of keys, e.g. "A minor, D minor">. <If single mode: "All references minor — mode preference clear."> <If scattered: "Keys scattered — no strong mode preference.">
- **Energy:** <min>–<max> (Cynite scale, 0–1)
- **Valence:** <min>–<max>
- <Optional: danceability / acousticness if tight clustering>

<If 0 analyzed references:>

*No feature targets set — no analyzed reference tracks. Fill in by hand after references are chosen and analyzed, or accept that this project will develop without a quantitative sonic anchor.*

## Visual mood

<From Step 6 Q1, verbatim where possible. 1–2 sentences.>

## Production cues

**Artist-flagged cues:**
<bullet list from Q2>

**Cynite-detected on references:**
<If get_song_intelligence returned mood tags / instrument hints, 1–2 lines. Else omit this sub-section.>

## What this moodboard does NOT cover

- Song-level writing direction → `songwriting-brief` phase (if composition is not complete)
- Release schedule + playlist targets → `release-plan` phase
- Cover art / canvas generation → post-launch tooling (not in Aria core chain)

## Data sources

- VISION.md: dated <date>
- `catalog_search` query: "<query>", returned <N> scored hits, <M> selected as candidates
- <if genre-query fallback was used: "`catalog_search` genre-query fallback: `<genre>`, <K> additional hits">
- <if browse_catalog fallback was used: "`browse_catalog` (unfiltered, page 1): <K> results scanned manually">
- `get_song_intelligence` / `get_audio_features`: called on <N> candidates, <M> analyzed, <K> unanalyzed
- User confirmation: <N> references selected, <M> swapped in, <K> candidates rejected

---

*Edit this file by hand if anything is off. Feature targets are a starting point — widen or narrow as the project develops.*
```

### Grounding-quality checklist (self-check before writing)

Before you Write:

- [ ] Every BPM, key, energy, valence, danceability value traces to a specific `get_song_intelligence` or `get_audio_features` call — no estimates, no placeholders
- [ ] Every track in the reference-tracks table is either in the user's catalog (confirmed via `catalog_search` / `browse_catalog`) or an external track whose features were fetched via ISRC / Spotify URL
- [ ] UNANALYZED tracks are labeled UNANALYZED — they contribute NOTHING to the feature-target ranges
- [ ] "Audio-feature targets" reflects the ACTUAL spread of the confirmed references — not a default range (e.g. "house tracks are usually 120–128 BPM" is NOT allowed)
- [ ] Visual mood uses the user's words from Q1 — don't substitute "cinematic" or "atmospheric" if they said "concrete, sodium-orange, humid"
- [ ] Production cues are user-flagged or Cynite-detected — not invented
- [ ] No `song_id` argument anywhere in your trace — you used `assetId` / `isrc` / `spotifyTrackUrl`
- [ ] No `browse_catalog` call passed a genre / filter argument — its schema is `{ page, pageSize }` only

If any check fails, fix before writing.

## Step 8: Update STATE.md

Use Edit on `.patchline/STATE.md`:

- `Completed phases:` — append `- moodboard — completed YYYY-MM-DD, artifact: MOODBOARD.md`
- `Artifacts:` — append `- MOODBOARD.md (moodboard phase, generated YYYY-MM-DD)`
- `Last updated: YYYY-MM-DD by /aria:next (moodboard skill)`

**Do NOT update `Current phase:` here.** In the R2 restructure, phase skills only append to `Completed phases:` — the `next` skill is the sole writer of `Current phase:` on the following invocation. This keeps the composition-status branch (R11) centralized: `next` reads `Composition status` and picks the correct successor (`songwriting-brief` vs `release-plan`).

## Step 9: Hand off

Tell the user — ≤3 sentences. The hand-off wording changes with the captured `Composition status`:

**If `complete`:**
> Moodboard written to `.patchline/artifacts/MOODBOARD.md` — <N> reference tracks, BPM range <X>–<Y>, tonal palette grounded. Composition is marked `complete`, so `next` will skip songwriting-brief; run `/aria:next` to go straight to release-plan, where we'll set the schedule and playlist targets.

**If `partial` or `writing`:**
> Moodboard written to `.patchline/artifacts/MOODBOARD.md` — <N> reference tracks, BPM range <X>–<Y>, tonal palette grounded. Run `/aria:next` to move into songwriting-brief — we'll take the feature targets and translate them into song-level direction for the tracks you're still writing.

## Error handling

- **STATE.md shows a different current phase** → Step 1, stop.
- **VISION.md missing** → Step 1, tell user to re-run vision-story via `/aria:next`.
- **MOODBOARD.md already exists** → Step 1, ask user: overwrite, refine, cancel.
- **`catalog_search` returns `isError: true`** → retry with a simpler / genre-only query. If it still errors, fall back to `browse_catalog` (unfiltered, page 1). If that also errors, skip reference-tracks; build moodboard from visual/production cues only.
- **Catalog has zero relevant tracks** → Step 2 conditional path — ask user for external references or skip the section.
- **`get_song_intelligence` returns `available: false` or `isError` for a candidate** → try `get_audio_features` with the same `assetId`. If that also fails, mark UNANALYZED. Never fabricate features. Never include UNANALYZED tracks in the feature-target ranges.
- **`AskUserQuestion` unavailable or errors** → fall back to the plain-text numbered list described in Step 4.
- **User confirms 0 references** → skip the feature-targets section entirely. Moodboard becomes visual + production cues only. Flag in Data Sources: "no reference tracks confirmed".
- **Missing `Composition status:` in STATE.md** → Step 1, stop.
- **All MCP tools fail (auth expired)** → save partial as `MOODBOARD.draft.md` with a header note, tell user to `/mcp` reconnect and re-invoke.

## Examples

### Happy path — catalog has rich matches, composition complete

```
User: /aria:next
You (reads STATE.md — Current phase: moodboard, Composition status: complete;
     reads VISION.md — "patient, dub-heavy, unromantic";
     calls catalog_search with query="dub-heavy sparse tech-house", limit=10):
  Got 7 scored hits. Pulling Cynite features on the top 4 via
  get_song_intelligence.

You (calls AskUserQuestion):
  header: "Moodboard"
  question: "Which Cynite-analyzed tracks should anchor the moodboard?"
  options:
    - label: "Low Hum"
      description: "120 BPM · D minor · energy 0.48 · valence 0.32"
    - label: "Thinning"
      description: "118 BPM · A minor · energy 0.42 · valence 0.28"
    - label: "Lattice"
      description: "124 BPM · D minor · energy 0.55 · valence 0.38"
    - label: "Dusk Protocol"
      description: "UNANALYZED — Cynite hasn't processed this one"
  multiSelect: true

User picks: "Low Hum", "Thinning", "Lattice"

You: Confirmed. Two more questions.
  Visual mood — 3 words for the palette?
User: Concrete, sodium-orange, humid.
You: Production cues — any specific moves?
User: Heavy spring reverb on percussion, dry vocals, no sidechain.

You (writes MOODBOARD.md with BPM 116–126, keys A/D minor, energy
     0.37–0.60, valence 0.23–0.43, visual + production captured;
     appends to STATE.md Completed phases + Artifacts, does NOT touch
     Current phase):
  Moodboard written to .patchline/artifacts/MOODBOARD.md — 3 reference
  tracks, BPM range 116–126, tonal palette grounded. Composition is
  marked complete, so next will skip songwriting-brief; run /aria:next
  to go straight to release-plan.
```

### Thin catalog — fall through to external references

```
You (catalog_search vibe query returns 1 scored hit, genre query
     returns 2, none strong fits; browse_catalog page 1 doesn't cluster):
  Your catalog is thin for this vibe — catalog_search and browse_catalog
  aren't surfacing tracks that match "dub-heavy sparse". Options:
    (a) Name external reference tracks — I'll look them up via ISRC or
        Spotify URL
    (b) Skip the reference-tracks section, build moodboard from visual
        + production cues only
    (c) Pause moodboard, run a catalog import, resume later

User: (a) — reference Bambounou's "Eosi" (spotify URL) and
      Shlømo's "Mortis" (ISRC: FR9Z21800431)

You (calls get_audio_features with spotifyTrackUrl for Eosi, then
     with isrc for Mortis):
  Eosi — streaming intelligence only (no Cynite features for externals)
  Mortis — streaming intelligence only
  Both confirmed. They'll show in the reference table as "external,
  streaming only" — they won't contribute BPM/key/energy numbers to
  the feature targets. Moving on to visual mood — 3 words?
...
```

### Cynite UNANALYZED for all candidates

```
You (top 4 candidates all return available: false from
     get_song_intelligence; retried via get_audio_features, same result):
  Your top catalog matches haven't been Cynite-analyzed yet — all 4
  come back as metadata-only. Options:
    (a) Proceed without feature targets — moodboard will be qualitative
        (visual + production)
    (b) Pause moodboard, wait for Cynite analysis (typically 1–2 days
        after upload), resume
    (c) Name external reference tracks that ARE in Soundcharts' index

User: (a)

You (skips feature-targets section entirely; flags "no analyzed
     references" in Data Sources; proceeds to Step 6):
  Got it. Visual mood — 3 words for the palette?
...
```

### Composition-status branch — partial → songwriting-brief next

```
You (moodboard written; STATE.md Composition status: writing;
     appended to Completed phases + Artifacts):
  Moodboard written to .patchline/artifacts/MOODBOARD.md — 2 reference
  tracks, BPM range 118–124, tonal palette grounded. Run /aria:next to
  move into songwriting-brief — we'll take the feature targets and
  translate them into song-level direction for the tracks you're still
  writing.
```

## Common mistakes (don't make these)

- **Passing `song_id` to `get_audio_features` or `get_song_intelligence`.** The real argument is `assetId` (for catalog tracks), `isrc` (for external), or `spotifyTrackUrl` (resolved to ISRC). Passing `song_id` is an InputValidationError.
- **Passing a genre / filter argument to `browse_catalog`.** Its schema is `{ page, pageSize }` — nothing else. Filtered discovery belongs to `catalog_search` via the `query` string.
- **Estimating BPM from track title or genre.** If Cynite hasn't analyzed a track, it's UNANALYZED. Not "probably around 124". Not "sounds like it's in the 120s". UNANALYZED.
- **Widening the feature-target range to "sensible defaults" when only 1 track is analyzed.** A single-reference range is a single-reference range ±5%. Don't pad to "118–130 BPM, all minor keys" because that's what house tracks usually are. Ground in the data you have.
- **Writing "heavy-hitting, polished production" in production cues when the user said "dry vocals, no sidechain".** Use their words. Resist the urge to reframe.
- **Including UNANALYZED tracks in the feature-target computation.** They can be listed in the reference-tracks table as qualitative anchors, but they don't get to set numbers.
- **Updating `Current phase:` in STATE.md.** That's `next`'s job in R2 — phase skills only append to `Completed phases:`. Touching `Current phase:` here creates drift between the ledger and the chain router.
- **Using `AskUserQuestion` for the visual-mood / production-cues questions.** Those are free-form; use regular Claude prompts. `AskUserQuestion` is for structural picks — reference-track selection, overwrite-vs-refine decisions, etc.
