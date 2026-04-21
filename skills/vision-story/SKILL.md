---
name: vision-story
description: "Second lifecycle phase. Produces VISION.md — the project's sonic identity, reference artists (verified via MCP, not invented), narrative positioning, and tonal palette. Builds on BRIEF.md from the creative-brief phase. Grounded in `get_trending_artists` (peer landscape) and `search_artists` (validation of any user-named peers). Use when STATE.md shows `Current phase: vision-story`. Invoked via `/aria:next` after the creative brief is written."
argument-hint: "[optional — no arguments expected; reads context from .patchline/]"
model: claude-sonnet-4-6
prerequisites:
  - creative-brief
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - AskUserQuestion
  - aria
---

## Your Task

Produce `.patchline/artifacts/VISION.md` — a one-page vision document that captures the project's sonic identity and narrative positioning. Every reference artist you name must be (a) named by the user, or (b) surfaced by an MCP tool call. **Never invent peers. Never reach for "sounds like Billie Eilish meets Tame Impala" cliches that the user didn't volunteer.**

You will:
1. Read BRIEF.md + PROJECT.md for context
2. Ground yourself in the peer landscape via MCP
3. Conduct a focused 3–5 question interview about sonic direction, references, story, and tone
4. Validate any user-named reference artists against MCP
5. Produce `VISION.md`
6. Update `STATE.md` to advance to `moodboard`

This phase is descriptive, not prescriptive. You are NOT picking BPMs, keys, or production cues yet — those come in `moodboard`. You are capturing intent + positioning in words.

## Supporting files

- [`../../CLAUDE.md`](../../CLAUDE.md) — voice, workspace contract, MCP grounding rules
- [`../creative-brief/SKILL.md`](../creative-brief/SKILL.md) — predecessor skill; its BRIEF.md is your primary input
- [`../moodboard/SKILL.md`](../moodboard/SKILL.md) — successor skill; your VISION.md feeds its reference-track selection

## Step 1: Read workspace context

Use Read in this order:

- `.patchline/STATE.md` — confirm `Current phase: vision-story`. If it's something else, STOP and tell the user: "STATE.md says we're in phase `<X>`, not vision-story. Run `/aria:next` to invoke the correct phase, or edit STATE.md if this is intentional."
- `.patchline/PROJECT.md` — extract: artist name, genres, career stage, distribution mode
- `.patchline/artifacts/BRIEF.md` — extract: project intent, audience, success metric, non-negotiables. This is the most important input — it sets the brief that VISION.md must extend.
- `.patchline/artifacts/VISION.md` — if it ALREADY exists, ask the user: "A VISION.md already exists. Overwrite it, refine it in place, or cancel?" Do not silently overwrite.

If BRIEF.md is missing, STOP and tell the user: "BRIEF.md is missing from `.patchline/artifacts/`. The creative-brief phase hasn't been completed (or its artifact was deleted). Run `/aria:next` — it will detect the drift and re-run creative-brief."

## Step 2: Ground in the peer landscape

You need to know who else is releasing in the same sonic neighborhood right now. This is NOT so you can recommend peers to the artist (don't do that) — it's so you can check the plausibility of peers THEY name, and spot obvious gaps in their framing.

### Always call

- `mcp__aria__get_trending_artists` with the artist's primary genre (from PROJECT.md). Limit to the first 10–15 results. Capture names + career stages — you'll use them to sanity-check user-named references.

### Conditionally call (after the interview)

- `mcp__aria__search_artists` once per user-named reference artist in Step 3 Q2. Confirm the artist exists in Patchline's index. If they don't, surface it — do not silently accept or silently drop them.

### If MCP returns errors

- `get_trending_artists` errors → surface to the user: "Couldn't pull the current trending peers in your genre — the Patchline intel index returned: `<error>`. Continuing without a peer-landscape sanity check; your named references will still be validated via `search_artists`."
- Do not fabricate a peer list from general knowledge. The brief's factual claims must trace to MCP output or the user's words.

## Step 3: Interview (3–5 focused questions)

Ask questions ONE AT A TIME. Skip any question already answered by BRIEF.md — e.g. if Q1 of creative-brief captured "darker 2am club direction", don't re-ask the sonic direction from scratch. Extend it.

### The four pillars

1. **Sonic direction — "When you describe the SOUND of this project in 2–3 sentences to someone who hasn't heard it, what do you say?"**
   - You're looking for descriptive language. "Warm, analog, slow-burning" is useful. "Good" is not.
   - If the brief already captured some of this (e.g. "darker 2am club"), prompt for MORE: "The brief says darker/2am-club — I want the next layer. Is it dub-influenced? Melodic? Percussive? Ambient at the edges?"

2. **Reference artists — "Name 1–3 artists whose current work (last 24 months) feels close to what you're going for. Not the same — close."**
   - One or two is fine. Three max.
   - If they say "nobody, I'm doing my own thing" — respect it. Write "no external references — artist positions as singular" in VISION.md and move on.
   - If they name artists, you'll validate each via `search_artists` in Step 4.

3. **Narrative / story — "What's the one-line story behind this project? Not marketing copy — the real why."**
   - Examples of good answers: "I moved countries and everything I was making before stopped feeling true", "My collaborator died last year and this is what came out of the aftermath", "I got tired of making festival-sized records and wanted to make something you listen to alone".
   - Examples of bad answers (push back once): "It's just a single I'm putting out." Prompt: "What made THIS single happen vs. the last one? Something shifted — what?"

4. **Tonal palette — "Three adjectives for the emotional register. Not the genre — the feeling."**
   - E.g. "melancholic, resolute, spacious". "Gritty, warm, human". "Cold, precise, ecstatic".
   - This will anchor the moodboard phase. Take whatever they give you — do not rephrase into marketing language.

### Optional 5th question

If the distribution mode is `with_label` (from PROJECT.md) AND the brief's Q5 surfaced label-set constraints (e.g. "the label wants something club-leaning"), add: **"Is the label's sonic direction aligned with yours on this one, or are we navigating a compromise?"** — surfaces tension early.

If self-releasing, skip.

### Stop signals

- If the artist is terse, don't interrogate. A 4-line VISION.md grounded in their actual words is better than a 40-line one you padded.
- If they cover multiple pillars in one long answer, don't re-ask the parts they already hit.

## Step 4: Validate named references via MCP

For each reference artist the user named in Q2, call `mcp__aria__search_artists` with the name.

Four cases per reference:

- **Exact match, `inRoster: false`** → normal case. Capture canonical name + Soundcharts ID. Use canonical name in VISION.md (even if user's spelling differed).
- **Exact match, `inRoster: true`** → the user referenced someone in their own Patchline roster. Interesting — call it out: "You named [X] — they're in your roster. Is this a collab reference, or a they-do-what-I-want-to-do reference?"
- **No exact match, fuzzy match suggests** → tell the user: "Couldn't find `<user's spelling>` exactly — did you mean `<top fuzzy match>`?" Let them confirm or correct.
- **No match at all** → surface it: "I couldn't find `<name>` in Patchline's artist index. They may be too underground for Soundcharts' coverage, or the name might be misspelled. Want to drop them from the references, or keep them flagged as unverified?" Respect the user's choice.

Do NOT silently normalize spelling or swap in a different artist. Every reference must be user-confirmed.

## Step 5: Draft VISION.md

Use the Write tool to create `.patchline/artifacts/VISION.md` with this structure:

```markdown
# Vision: <project-name>

> Generated by `/aria:next` (vision-story skill) on YYYY-MM-DD · v1
> Grounded in: BRIEF.md (dated <brief date>), `get_trending_artists` (fetched YYYY-MM-DDThh:mm:ssZ, genre: <genre>), `search_artists` (N references validated), user interview dated YYYY-MM-DD.

## Sonic identity

<2–3 sentences from Q1, lightly tightened. Preserve the artist's specific language — if they said "dub-influenced, slow-burning, a bit broken", don't rewrite to "innovative electronic production". Keep the texture.>

## Reference artists

<If user named 1–3 artists:>

- **<Canonical name from search_artists>** — <1 short phrase on what's referenced: e.g. "their sub-heavy mixdown aesthetic", "the cold-but-emotional chord language on their last EP", "their pacing — 7+ min tracks as a feature not a flaw">
- ...

<If any reference was flagged unverified in Step 4, add:>
*Unverified reference: `<name>` — not found in Patchline's index; user opted to keep as a directional flag.*

<If user said "no external references":>

The artist positions this project as singular — no external peer anchor. Downstream phases will reference-match via catalog + Cynite sonic features rather than artist-to-artist comparison.

## Narrative / story

<One tight paragraph from Q3, in the artist's voice. This is the "why" — keep it unpolished. Marketing copy gets drafted in pitch-kit, not here.>

## Tonal palette

<Three adjectives from Q4, with one sentence of context each. Descriptive, not prescriptive — no BPMs, no keys, no production techniques yet.>

- **<adjective 1>** — <what that means for this project>
- **<adjective 2>** — <what that means>
- **<adjective 3>** — <what that means>

## Peer-landscape context (from Patchline intel)

<Pulled from get_trending_artists. 2–3 sentences max. Example: "Currently trending in <genre>: <3 names from trending list>. The artist's named references (<user's refs>) don't overlap with this trending set, which suggests intentional positioning away from what's dominant right now." OR "The artist's references overlap with the trending set on <name> — indicating positioning within the current moment, not against it." If `get_trending_artists` errored, write: "Peer-landscape check unavailable — `get_trending_artists` returned an error at vision time. Downstream phases should recheck.">

## Label context

<If with_label and Q5 was asked: 2–3 sentences summarizing the alignment-or-compromise answer. If self-releasing: "Self-releasing — no external sonic constraints.">

## What this vision does NOT cover

- Specific reference tracks + audio-feature targets → `moodboard` phase
- Song-level writing direction → `songwriting-brief` phase (skipped if composition is complete)
- Release schedule + playlist targets → `release-plan` phase

## Data sources

- BRIEF.md: dated <brief date>
- Patchline peer landscape: `get_trending_artists` for <genre>, fetched <timestamp>, returned <N> artists
- Reference validation: `search_artists` called <N> times, <M> confirmed + <K> unverified
- User interview: conducted <date>, <N> questions answered

---

*Edit this file by hand if anything is off. The moodboard phase reads from it — your edits there will flow downstream.*
```

### Grounding-quality checklist (self-check before writing)

Before you Write:

- [ ] Every reference artist in the "Reference artists" section is either user-named-and-search_artists-confirmed, user-named-and-flagged-unverified, or explicitly marked "no external references"
- [ ] "Sonic identity" uses the artist's specific language from Q1 — no marketing-speak substitutions
- [ ] "Tonal palette" adjectives are the user's words (Q4), not synonyms you picked
- [ ] "Peer-landscape context" cites real names from `get_trending_artists` output, or honestly states the tool errored
- [ ] "Narrative / story" reads as a human wrote it — not sanitized into press-release voice
- [ ] "Data sources" accurately reflects which MCP tools ran and when

If any check fails, fix before writing.

## Step 6: Update STATE.md (append-only — do NOT write `Current phase:`)

Authority split: only `next` writes `Current phase:`. Phase skills append to `Completed phases:` + artifacts.

- `Completed phases:` → append `- vision-story — completed YYYY-MM-DD, artifact: VISION.md`
- `Artifacts:` → append `- VISION.md (vision-story phase, generated YYYY-MM-DD)`
- `Last updated: YYYY-MM-DD by /aria:vision-story`

Do **not** touch `Current phase:`.

## Step 7: Hand off

Tell the user — ≤3 sentences:

> Vision written to `.patchline/artifacts/VISION.md`. Captured your sonic identity (<one-phrase summary from Q1>), <N> reference artists (<list of canonical names, or "no external references">), and tonal palette (<three adjectives>). Read it, edit anything off, then run `/aria:next` to move into moodboard — I'll ground reference tracks against your catalog + Cynite features.

## Error handling

- **STATE.md shows a different current phase** → Step 1, stop.
- **BRIEF.md missing** → Step 1, tell user to re-run creative-brief via `/aria:next`.
- **VISION.md already exists** → ask user (Step 1): overwrite, refine, or cancel.
- **`get_trending_artists` returns `isError: true`** → note it in VISION.md's peer-landscape-context section, continue with the interview and `search_artists`. Don't block the whole phase on one tool.
- **User names a reference that `search_artists` can't find** → Step 4 case 4, ask user to keep-as-unverified or drop. Never silently substitute.
- **User refuses to name references and has nothing to say about story** → write the thinnest possible VISION.md with explicit "not provided" notes in the affected sections. Don't fabricate to fill space.
- **All MCP tools fail (auth expired)** → save partial as `VISION.draft.md` with a header note, tell user to run `/mcp` and re-invoke.

## Examples

### Happy path — artist names real peers

```
User: /aria:next
You (reads STATE.md — Current phase: vision-story; reads BRIEF.md;
     calls get_trending_artists for "house, tech-house"):
  Brief says darker 2am-club direction. The peer landscape in house
  right now skews festival-bright — your positioning is explicitly
  against that, got it.

  4 quick questions to shape VISION.md.

  1/4 — When you describe the SOUND of this project in 2–3 sentences
  to someone who hasn't heard it, what do you say?

User: Dub-heavy low end, sparse percussion, the kind of thing you hear
      at 4am when the room has thinned out. Not moody for moody's sake
      — restrained.

You: 2/4 — Name 1–3 artists whose CURRENT work (last 24 months) feels
  close. Not the same — close.

User: Bambounou and Shlømo

You (calls search_artists for both — both return exact matches):
  Confirmed both in the index. 3/4 — One-line story behind this
  project. Real why, not marketing.

User: I stopped touring festivals last year and this is what came out.
      Quieter, more stubborn.

You: 4/4 — Three adjectives for the emotional register.

User: Patient, dub-heavy, unromantic

You (writes VISION.md; updates STATE.md):
  Vision written to .patchline/artifacts/VISION.md. Captured your
  sonic identity (dub-heavy, sparse, 4am-room-thinned-out), 2 reference
  artists (Bambounou, Shlømo), and tonal palette (patient, dub-heavy,
  unromantic). Read it, edit anything off, then run /aria:next to
  move into moodboard.
```

### Reference artist not in index

```
You: 2/4 — Name 1–3 artists whose current work feels close.
User: Object Blue and a producer called Sekuoya

You (calls search_artists for both — Object Blue found,
     Sekuoya not found):
  Object Blue confirmed. Couldn't find Sekuoya in Patchline's index —
  spelling might be off, or they may be too underground for Soundcharts'
  coverage. Options: (a) correct the spelling if I got it wrong,
  (b) drop them from references, (c) keep them flagged as unverified.
User: Keep unverified, they're underground on purpose
You: Got it. 3/4 — ...
```

### get_trending_artists errors

```
You (calls get_trending_artists — returns isError: true):
  Heads up — couldn't pull the current peer landscape for house right
  now (intel index returned an error). I'll still validate your named
  references via search_artists, and VISION.md will flag the peer-
  landscape section as unavailable. Continuing.

  1/4 — When you describe the SOUND...
```

### Artist with no external references

```
You: 2/4 — Name 1–3 artists whose current work feels close.
User: Honestly nobody. I don't want to anchor this to anyone else's
      sound.
You: Respect. Writing VISION.md with no external references — the
  moodboard phase will reference-match against your own catalog via
  Cynite features instead. 3/4 — ...
```

## Common mistakes (don't make these)

- **Recommending peer artists to the user.** Your job is to capture THEIR references, not suggest your own. `get_trending_artists` output is a sanity-check input to VISION.md, not a recommendation feed.
- **Silently correcting a user's artist-name spelling.** If they typed "Shlomo" and `search_artists` returned "Shlømo", ask before substituting. The artist might mean a different Shlomo.
- **Translating "dub-heavy, sparse, 4am-room-thinned-out" into "sophisticated electronic production with minimal elements".** The user's texture is the vision. Your translation kills it.
- **Treating `get_trending_artists` as the answer instead of context.** Its output belongs in ONE section of VISION.md (peer-landscape context), not the reference-artists section.
- **Writing a narrative / story section in press-release voice.** The "why" is the artist's — in their words, even if rough. Sanitized copy lives in pitch-kit, generated later.
