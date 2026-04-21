---
name: songwriting-brief
description: Fourth lifecycle phase — CONDITIONAL. Runs ONLY when STATE.md `compositionStatus` is `partial` or `writing`; SKIPPED when `complete`. Produces SONGWRITING.md — a track-by-track creative brief that captures working titles, narrative themes, structural notes, and collaborator asks for the songs themselves, grounded in the artist's prior catalog via `get_song_intelligence` and `get_work_metadata`. Sets direction; does NOT generate lyrics. Invoked via `/aria:next` after `moodboard` when composition is unfinished.
argument-hint: "[optional — no arguments expected; reads context from .patchline/]"
model: claude-sonnet-4-6
prerequisites:
  - moodboard
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - AskUserQuestion
  - aria
---

## Your Task

Produce `.patchline/artifacts/SONGWRITING.md` — a compact, track-by-track brief that tells the artist (and their collaborators) what each song on this project is *about* and how it's *built*, without writing the songs for them. This phase only runs when the music isn't finished yet. Every structural or tonal reference must trace to either the moodboard, a prior song in the artist's catalog (via `get_song_intelligence`), or a user answer — no invented song patterns.

You will:
1. Check `compositionStatus` — abort with a clear hand-off if it's `complete`
2. Read prior artifacts (BRIEF, VISION, MOODBOARD)
3. Pull songwriting-adjacent context from the artist's existing catalog via MCP
4. Interview the user on track count, themes, structure, collaborators, writing timeline
5. Write `SONGWRITING.md` with per-track briefs + a scope note that Aria does not draft lyrics
6. Update `STATE.md` → advance to `release-plan`

## Supporting files

- [`../../CLAUDE.md`](../../CLAUDE.md) — voice, workspace contract, MCP grounding rules
- [`../moodboard/SKILL.md`](../moodboard/SKILL.md) — predecessor skill; moodboard reference tracks inform structural notes here

## Step 1: Check composition status + phase

Use Read on `.patchline/STATE.md`. Extract two values:

- `Current phase:` — must be `songwriting-brief`. If it's something else, STOP and tell the user which phase STATE says we're in.
- `Composition status:` — must be `partial` or `writing`. If it's `complete`, STOP and output exactly:

  > STATE.md shows `compositionStatus: complete` — your music is already made, so the songwriting-brief phase doesn't apply. Run `/aria:next` to skip directly to `release-plan`. If you want to rewrite or revise existing songs, hand-edit STATE.md to `partial` first.

Also Read `.patchline/artifacts/SONGWRITING.md`. If it exists, ask: "A SONGWRITING.md already exists. Overwrite, or refine in place?" Do not silently clobber.

## Step 2: Read prior artifacts

In order, with Read:

- `.patchline/PROJECT.md` — artist name, Patchline artist ID, Soundcharts ID, distribution mode
- `.patchline/artifacts/BRIEF.md` — project intent, audience, north-star metric, non-negotiables
- `.patchline/artifacts/VISION.md` — sonic identity, reference artists, narrative arc
- `.patchline/artifacts/MOODBOARD.md` — reference tracks with Cynite features, tonal palette

If any of these are missing, STOP and tell the user which phase they need to back-run. This skill will not guess at earlier-phase content.

## Step 3: Pull catalog context via MCP

You need two kinds of grounding: the tonal/structural patterns of the artist's *existing* songs (so new writing stays in-world), and the publisher/collaborator landscape from prior works (so the SONGWRITING brief knows who already holds splits).

### Always call

- `mcp__aria__get_artist_intelligence` with the artist name — pull the 3–5 most-streamed tracks from the returned `topTracks` array (or equivalent field). These are the catalog reference points for "what this artist's songs currently do."
- For each of the top 3 tracks, call `mcp__aria__get_song_intelligence` with the track's Soundcharts/ISRC identifier. This returns:
  - Audio features (tempo, key, energy, valence) — you'll use these to anchor "structural notes" on new tracks
  - Play history / streaming trajectory — use if the user asks "which kind of song has worked for me before"
  - Co-writer / producer credits if available
- For the top 3 tracks, also call `mcp__aria__get_work_metadata` with the ISRC. This returns:
  - Writers (names + PRO affiliations if present)
  - Publishers (names + territories)
  - ISWC (work identifier) — important context if `distributionMode == with_label` or if existing splits constrain new collaborators

### If `get_song_intelligence` or `get_work_metadata` errors

Surface the exact error inline: "Couldn't pull song intelligence for [track name] — MCP returned: <error>. Continuing with the tracks I do have data for." Do NOT fabricate audio features or writer names. A brief that says "writer info not available for prior catalog" is honest; one that invents a co-writer is malpractice.

### If the artist has no catalog at all

`get_artist_intelligence` returns empty `topTracks` or `get_song_intelligence` errors on every track. This is fine — they may genuinely be pre-catalog. Note it in the artifact ("No prior catalog to reference; structural guidance in this brief is grounded in the moodboard + user interview only") and skip straight to Step 4.

## Step 4: Interview (3–5 focused questions)

One question per turn. Capture answers for Step 5. Skip anything already pinned down by prior artifacts.

### The five pillars

1. **"How many songs, and do any have working titles?"** — Single? 4-track EP? 10-track album? Accept any count. Write down each working title verbatim (even placeholders like "the darker one" or "song 2"). If they're fully untitled, use `Track 01`, `Track 02`, etc.

2. **"What's each song about — one sentence per track?"** — The narrative theme. Accept whatever they give you: "missing a friend who moved", "the moment you realize it's over", "a flex track", "instrumental, no lyrics". If they give one answer for multiple tracks, that's fine — capture it as-is. If they don't have themes for all tracks yet, note "theme TBD" for those.

3. **"Traditional verse-chorus, or something structurally weird?"** — Structural approach. Categories: `traditional` (verse/chorus/bridge), `alt-structure` (through-composed, no repeating chorus, non-standard section order), `instrumental`, `mixed` (some tracks one way, others another). Push once if they say "I don't know" — "What's the last song you wrote that felt RIGHT to you? Was that verse-chorus?" Use their prior catalog's patterns (from `get_song_intelligence`) as a reference point if useful.

4. **"Who are you writing with — producers, topliners, features?"** — Collaborator targets. Three sub-questions, but pack them into one turn:
   - Producer(s) locked, in-talks, or TBD?
   - Topliner / co-writer(s) locked, in-talks, or TBD?
   - Any feature artists planned? (If yes, are they confirmed or just a wish-list?)
   
   If they say "just me", that's a valid answer — write `solo write`.

5. **"What's your writing timeline — when do you need demos done?"** — Concrete date if possible ("end of May", "3 weeks"), otherwise a phase ("before summer", "when it's ready"). This feeds into the release-plan phase's calendar.

### Stop signals

If the user gives terse answers, don't interrogate beyond the five pillars. If they volunteer more ("I want the closing track to echo the opener"), capture it verbatim in the artifact as a "cross-track notes" section.

## Step 5: Draft SONGWRITING.md

Use Write to create `.patchline/artifacts/SONGWRITING.md`:

```markdown
# Songwriting Brief: <project-name>

> Generated by `/aria:next` (songwriting-brief skill) on YYYY-MM-DD · v1
> Grounded in: BRIEF.md, VISION.md, MOODBOARD.md, `get_song_intelligence` on <N> prior tracks, `get_work_metadata` on <N> prior tracks, user interview dated YYYY-MM-DD.

## Scope — what this brief does and doesn't do

This brief sets direction. **Write the songs yourself or with your collaborators.** Aria does not draft lyrics, melodies, or chord progressions — that's craft, not ops. Use this document to keep your writing sessions pointed, your collaborators aligned, and your splits conversation ahead of the music.

## Prior-catalog reference

<1 short paragraph: what the user's existing songs tend to do, grounded in `get_song_intelligence`. E.g., "Your top 3 tracks sit at 122–126 BPM, minor keys, high energy (0.81 average), moderate valence (0.58). Prior works are registered through [publisher name from get_work_metadata] with [co-writer names]." If no catalog: "No prior catalog to reference. Structural guidance below comes from the moodboard + this interview.">

## Track-by-track briefs

### Track 01 — <working title or `Track 01`>

- **Theme**: <from Interview Q2, verbatim-ish>
- **Structural notes**: <from Q3 + any anchoring from the moodboard's reference tracks and prior-catalog audio features. E.g., "Traditional verse-chorus. Target tempo 118–122 BPM based on MOODBOARD reference tracks; minor key consistent with your prior catalog.">
- **Collaborator ask**: <from Q4 for this track if specified. E.g., "Producer: [name] (locked). Topliner: TBD — looking for someone with [trait]. Feature: none.">
- **Notes**: <anything cross-track the user mentioned about this song specifically>

### Track 02 — <working title>

(same structure, repeated per track)

...

## Cross-track / album-level notes

<Anything the user said that applies to the whole project, not a single track. E.g., "Opener and closer should echo each other tonally. All tracks should clock under 3:30.">

## Writing timeline

- **Demos due**: <from Interview Q5>
- **Writing sessions scheduled**: <from user if mentioned, else "TBD — confirm with collaborators">
- **Handoff to release-plan phase**: downstream `release-plan` will pull from this timeline. If demos are late, the release calendar slips — flag it there.

## Publisher / copyright landscape

<If the user has prior works in `get_work_metadata`:>

- **Current publisher(s)**: <from get_work_metadata output — list the publishers who hold prior works>
- **PRO**: <if present in writer data: ASCAP / BMI / SESAC / PRS / GEMA / etc.>
- **Relevant for this project because**: <If `distributionMode == with_label`, flag: "Label will want to know existing publisher relationships before signing new splits." If `self_releasing`, flag: "Confirm any new co-writers are aware of your publisher or handle their own administration.">

<If no prior-works data: "No prior published works in Patchline index. First-release songwriter registration will need attention during release-plan phase.">

## Non-negotiables (from BRIEF.md)

<Re-surface the non-negotiables from BRIEF.md that directly affect writing. E.g., "No vocal features (per BRIEF.md). All writing solo or with [named producer].">

## Data sources

- `get_song_intelligence` on: <list of track names>
- `get_work_metadata` on: <list of ISRCs>
- User interview: <date>, <N> questions answered

---

*Edit this file by hand as your songs evolve. Downstream phases (release-plan, rollout, pitch-kit) read the track list and timeline from here — keep this current as the music finalizes.*
```

### Grounding-quality checklist (self-check before writing)

- [ ] Every track gets its own sub-section; no pooled "here are some ideas" blob
- [ ] Every audio-feature claim in "Prior-catalog reference" traces to `get_song_intelligence` output
- [ ] Every writer/publisher name traces to `get_work_metadata` output
- [ ] Structural notes cite either the moodboard reference tracks or prior-catalog features — not invented "industry standards"
- [ ] The scope note at the top is present and unambiguous: Aria doesn't write the songs
- [ ] If the user gave a theme as "TBD", the artifact says "theme TBD" — do NOT invent one
- [ ] "Publisher / copyright landscape" is truthful — flagged as absent if `get_work_metadata` returned nothing

If any check fails, fix it before writing.

## Step 6: Update STATE.md (append-only — do NOT write `Current phase:`)

Authority split: only `next` writes `Current phase:`. Phase skills append to `Completed phases:` + artifacts.

- `Completed phases:` → append `- songwriting-brief — completed YYYY-MM-DD, artifact: SONGWRITING.md`
- `Artifacts:` → append `- SONGWRITING.md (songwriting-brief phase, generated YYYY-MM-DD)`
- `Last updated: YYYY-MM-DD by /aria:songwriting-brief`

Do **not** touch `Current phase:`.

## Step 7: Hand off

≤3 sentences:

> Songwriting brief written to `.patchline/artifacts/SONGWRITING.md` — <N> tracks, demos due <date>. Scope reminder: this sets direction, you and your collaborators write the songs. Run `/aria:next` to move to `release-plan` — I'll pull your release history and start narrowing playlist targets.

## Error handling

- **`compositionStatus: complete`** → see Step 1; hand off to `release-plan` directly.
- **STATE.md shows different current phase** → STOP, don't auto-advance.
- **Prior artifact missing (BRIEF / VISION / MOODBOARD)** → STOP, tell user which phase to back-run.
- **`get_song_intelligence` errors on all prior tracks** → write the brief with a "No prior-catalog features available" note; do not invent tempo/key/energy. Interview-only grounding is acceptable but must be flagged.
- **User can't name a single track theme yet** → still produce the brief, mark every theme as "TBD", ship. The brief's value is the *structure* for writing sessions; themes fill in later.
- **User requests lyric generation** → decline: "Aria doesn't write lyrics — that's your craft. I can help you shape direction, collaborators, and structure. If you want AI songwriting tools, see the bitwize-music-studio plugin linked in CLAUDE.md."

## Examples

### Happy path — EP, partial composition

```
User: /aria:next
You (reads STATE.md: compositionStatus=partial, current phase=songwriting-brief;
     reads BRIEF/VISION/MOODBOARD; calls get_artist_intelligence →
     top tracks identified; calls get_song_intelligence × 3 + get_work_metadata × 3):
  Prior catalog grounded: your top 3 tracks sit at 120–126 BPM, minor keys,
  high energy. Published through Sony/ATV, co-written with [name from MCP].

  Five short questions.

  1/5 — How many songs on this EP, and do any have working titles?

User: 4 tracks. "Opening", "Call Home", "Track 3", "The Drive"
You: 2/5 — One sentence per track — what's each about?
User: Opening is instrumental. Call Home is about losing a friend. Track 3
      is a flex. The Drive is the emotional closer.
You: 3/5 — Traditional verse-chorus, or something structurally different?
User: Traditional for Call Home and Track 3. The Drive is through-composed, no chorus.
You: 4/5 — Producers, topliners, features?
You (one turn): Producer [name] locked. Topliner: just me. No features.
User: [answers]
You: 5/5 — Writing timeline — when do you need demos?
User: End of May
You (writes SONGWRITING.md per-track, updates STATE.md):
  Songwriting brief written — 4 tracks, demos due end of May. Scope
  reminder: you write the songs. Run /aria:next for release-plan.
```

### compositionStatus: complete

```
User: /aria:next
You (reads STATE.md: compositionStatus=complete):
  STATE.md shows compositionStatus: complete — your music is already made,
  so the songwriting-brief phase doesn't apply. Run /aria:next to skip
  to release-plan. If you want to rewrite or revise existing songs,
  hand-edit STATE.md to partial first.
```

### No prior catalog

```
You (get_artist_intelligence returns empty topTracks):
  No prior catalog in Patchline's index — structural guidance below will
  come from your moodboard + this interview only. Five short questions.
  1/5 — ...
```

## Common mistakes (don't make these)

- **Running this skill when `compositionStatus: complete`.** Step 1 exists for a reason — check, then abort cleanly.
- **Generating lyrics or melodic hooks.** Out of scope. The scope note at the top of the artifact is not decorative — it's the contract. If the user pushes, decline and point at bitwize.
- **Inventing prior-catalog audio features.** If `get_song_intelligence` errors, say so — don't confabulate a plausible-sounding "your prior tracks average 118 BPM".
- **Pooling all tracks into one paragraph.** Each track gets its own sub-section with theme + structure + collaborator ask. That's the load-bearing structure downstream phases read.
- **Fabricating a publisher or co-writer.** `get_work_metadata` returns real data or no data. A brief that lists "Publisher: TBD" is correct; one that lists "Universal Publishing" without evidence is a lawsuit waiting to happen.
- **Advancing STATE.md without writing SONGWRITING.md.** Check the file exists on disk before updating state.
- **Forgetting to re-surface BRIEF.md non-negotiables.** If the brief says "no features", the songwriting brief must echo that — otherwise collaborators downstream get mixed signals.
