---
name: creative-brief
description: "Creative strategy phase after /aria:start, or after audio-intake when the user already has a track. Produces BRIEF.md capturing the artist's identity, release job, audience, success metric, and non-negotiables. Use when STATE.md shows `current phase: creative-brief`."
argument-hint: "[optional — no arguments expected; reads context from .patchline/]"
model: claude-sonnet-4-6
prerequisites:
  - start
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - AskUserQuestion
  - aria
---

## Your Task

Produce `.patchline/artifacts/BRIEF.md` — a one-page creative brief that answers: who is this artist, what is this project, what does success look like. Every factual claim in BRIEF.md must be grounded in either (a) the user's answers during this skill, or (b) MCP-tool output. **No hallucinated metrics, no invented genres, no made-up peer artists.**

You will:
1. Read the workspace context written by `start`
2. Ground yourself in the artist's real Patchline data
3. Conduct a focused 3–5 question interview with the user
4. Produce `BRIEF.md`
5. Update `STATE.md` to mark this phase complete and surface the next one

## Supporting files

- [`../../CLAUDE.md`](../../CLAUDE.md) — voice, workspace contract, MCP grounding rules
- [`../start/SKILL.md`](../start/SKILL.md) — predecessor skill (creates the workspace you're reading)

## Step 1: Read workspace context

Use Read on these files (in order, stop at first miss):

- `.patchline/PROJECT.md` — extract: artist name, project name, distribution mode, genres, career stage, monthly listeners, country, composition status, focus track asset ID
- `.patchline/STATE.md` — confirm `Current phase: creative-brief`. Also read `Composition status`, `Focus track asset ID`, `Audio status`, and `Cynite status`. If it's something else, STOP and tell the user: "STATE.md says we're in phase `<X>`, not creative-brief. Run `/aria:next` to invoke the correct phase, or edit STATE.md if this is intentional."
- `.patchline/artifacts/BRIEF.md` — if it ALREADY exists, ask the user: "A BRIEF.md already exists. Overwrite it, or refine it in place?" Do not silently overwrite.

If `Composition status` is `complete` and `Cynite status` is not `cynite_complete`, STOP. Tell the user: "You said the track exists, but audio-intake has not completed Cynite yet. Run `/aria:next` to route back to audio-intake, or `/aria:audio-intake` directly if STATE.md already points there. I won't ask you to describe the sound while Patchline can analyze it."

## Step 2: Ground in artist data

You already have basic identity from PROJECT.md. Pull fresher context:

### Always call

- `mcp__aria__get_artist_intelligence` with the artist name → re-pulls current streaming metrics, social stats, genres, career stage. Use the freshest values (MCP data may have updated since `/aria:start`).
- `mcp__aria__get_bio` with the artist name → if a cached bio exists, extract 1–2 sentences for the brief. If it returns "no cached bio", don't worry — the `creative-brief` is supposed to GENERATE a short summary; `get_bio` just gives you a head start if one exists.
- If `Focus track asset ID` is not `pending` or `not_required`, call `mcp__aria__get_asset` with that asset ID. Capture Cynite/audio-feature summary for the Data sources section; do not turn it into a subjective sound interview.

### Conditionally call

- If the user's project might build on an existing release (they said "follow-up to X" or mentioned a prior track), call `mcp__aria__catalog_search` with `query: "<project name>"` → check whether this is a sequel/remix/counterpart to existing catalog.
- If the user mentioned a peer artist or a Spotify URL, call `mcp__aria__analyze_url` to canonicalize.

### If MCP returns errors

- `isError: true` on any tool → surface the exact error to the user: "Couldn't pull live [X] — the Patchline intel cache returned: <error message>. Continuing with the data I already have from PROJECT.md. The brief will note the gap."
- Do NOT substitute invented data. A brief that says "monthly listeners: unknown at brief time" is better than a brief that says "monthly listeners: ~50,000" made up from nothing.

## Step 3: Interview (3–5 focused questions)

Ask questions ONE AT A TIME, not as a wall. After each answer, capture the answer in your working memory (you'll use it in Step 4). Skip any question already answered by PROJECT.md or MCP data.

### The four pillars (ask about each, concisely)

1. **"What job does this release need to do for you right now?"** — one sentence. Example answers: "re-engage listeners after a quiet year", "prove this cumbia/boom-bap lane is real", "tee up an EP", "give curators one clean entry point". You want the artist's business/creative intent in their words.

2. **"Who is this for?"** — primary listener. Accept anything: "my existing fans", "club DJs", "sync supervisors", "festival bookers", "playlist curators who love X". Don't push for a demographic — "who" in music is often psychographic or taste-based.

3. **"What's the north-star success metric?"** — one concrete, falsifiable target. Examples: "land on 3 editorial playlists", "100k streams in month 1", "get featured in Mixmag", "be picked up by the label's A&R". If the artist gives a vague answer ("do well"), push once: "Can you pin a number or a specific outcome on that?"

4. **"What cannot be compromised?"** — the must-haves. Could be musical (no ghostwriters, no features), business (publishing retained, self-release only), audience (do not alienate existing listeners), or narrative (don't call it a comeback). One-shot question — take whatever they give you.

### Optional 5th question

If the distribution mode is `with_label`, add: **"Who's the label contact driving this, and what's their timeline?"** — labels set rigid calendars; this surfaces constraints.

If the distribution mode is `self_releasing`, skip.

### Stop signals

If the user gives terse answers, don't interrogate. If they give verbose answers that already cover multiple pillars, don't re-ask the parts they already hit. The goal is enough signal to write a brief, not a complete interview transcript.

## Step 4: Draft BRIEF.md

Use the Write tool to create `.patchline/artifacts/BRIEF.md` with this structure (fill in from Step 2 + Step 3):

```markdown
# Creative Brief: <project-name>

> Generated by `/aria:next` (creative-brief skill) on YYYY-MM-DD · v1
> Grounded in: `get_artist_intelligence` (fetched YYYY-MM-DDThh:mm:ssZ), `get_bio` (cached <date or "no cached bio">), user interview dated YYYY-MM-DD.

## Artist snapshot

**<Artist Name>** — <career stage>, <primary genres>, <country>. <Current monthly-listener count> monthly Spotify listeners as of <MCP fetch timestamp>.

<1–2 sentence bio, from `get_bio` if available, else a concise summary generated from the intelligence data. Mark clearly if generated vs. cached.>

## Project intent

<One tight paragraph, in the artist's voice, answering "what this project is trying to do". Use the user's phrasing from Interview Q1, refined for readability but not sanitized into marketing-speak.>

## Audience

**Primary listener:** <from Interview Q2>

<If the artist gave a psychographic answer, keep it psychographic. If demographic, keep it demographic. Do not invent a persona.>

## North-star success metric

<One concrete target, from Interview Q3. If the artist's answer was vague and they didn't refine, say so honestly: "Loose target — the artist is defining success as <X> with no numeric threshold.">

## Non-negotiables

<Bullet list from Interview Q4. If they said "none", write "None specified".>

## Label / self-release context

<If `with_label`: label name + contact + timeline from Q5. If `self_releasing`: "Self-releasing. No label calendar to accommodate.">

## What this brief does NOT cover

- Sonic direction → `vision-story` phase (`/aria:next`)
- Reference tracks / moodboard → `moodboard` phase
- Playlist targets → `release-plan` phase
- Pitches → `pitch-kit` phase

## Data sources

- Patchline intelligence: `get_artist_intelligence` returned <key fields> at <timestamp>
- Patchline bio: <"cached bio dated <date>" | "no cached bio — generated summary">
- User interview: conducted <date>, <N> questions answered

---

*Edit this file by hand if anything is off. Downstream phases read from this file as their source of truth.*
```

### Grounding-quality checklist (self-check before writing)

Before you Write the file, verify:

- [ ] Every metric in "Artist snapshot" traces to a MCP tool call (note the timestamp)
- [ ] "Project intent" uses the artist's own wording from the interview (you can tighten, not reframe)
- [ ] "North-star success metric" is either concrete (numeric / named outcome) OR explicitly flagged as loose
- [ ] No peer artists are named unless the user named them first or `analyze_url` canonicalized them
- [ ] No genre labels appear that weren't in `get_artist_intelligence` output
- [ ] The "Data sources" section is truthful — don't claim `get_bio` was called if you skipped it

If any check fails, fix it before writing.

## Step 5: Update STATE.md (append-only — do NOT write `Current phase:`)

Use Edit on `.patchline/STATE.md`. Authority split: only `next` writes `Current phase:`; phase skills append to `Completed phases:` and artifact ledgers only.

- `Completed phases:` → append `- creative-brief — completed YYYY-MM-DD, artifact: BRIEF.md`
- `Artifacts:` → append `- BRIEF.md (creative-brief phase, generated YYYY-MM-DD)`
- `Last updated: YYYY-MM-DD by /aria:creative-brief`

Do **not** touch `Current phase:` — `next` will update it on the next `/aria:next` call.

## Step 6: Hand off

Tell the user — ≤3 sentences:

> Brief written to `.patchline/artifacts/BRIEF.md`. It captures your intent (<one-phrase summary of Q1>), audience (<Q2>), and success metric (<Q3>). Read it, edit anything off, then run `/aria:next` to move to the vision-story phase — I'll start sketching sonic direction grounded in your catalog.

## Error handling

- **STATE.md shows a different current phase** → STOP, see Step 1
- **BRIEF.md already exists** → ask user to confirm overwrite vs. refine
- **`get_artist_intelligence` returns `found: false`** → fall back to `analyze_url` if a Spotify URL is available in PROJECT.md; otherwise ask the user to re-check artist name in PROJECT.md and re-invoke
- **All MCP tools return `isError: true`** (likely auth expired) → save the partial brief as `BRIEF.draft.md` with a header note, tell the user to run `/mcp` to reconnect and re-invoke
- **User refuses to answer any questions** → write a minimal brief using only MCP-grounded data, flag all four interview sections as "not provided by user, fill in manually"

## Examples

### Happy path

```
User: /aria:next
You (reads STATE.md, current phase = creative-brief; reads PROJECT.md;
     calls get_artist_intelligence + get_bio):
  Quick read: you're Vintage Culture, mainstream house producer,
  12.4M monthly listeners. I have a cached bio from 2026-03-15.

  Let me ask four short questions to sharpen the brief.

  1/4 — What job does this release need to do for you right now?

User: Introduce the new darker sound I've been working on. Less festival,
      more 2am club.
You: Got it. 2/4 — Who is this for?
User: Club DJs and my existing fans who like the deeper tracks
You: 3/4 — What's the north-star success metric?
User: Land on Spotify's Night Rider editorial playlist
You: Concrete — good. 4/4 — What cannot be compromised?
User: No vocal features. This is a producer statement.
You (writes BRIEF.md with all 4 pillars grounded, updates STATE.md):
  Brief written to .patchline/artifacts/BRIEF.md. It captures your intent
  (darker 2am club direction), audience (club DJs + deep-cut fans), and
  success metric (Night Rider placement). Read it, edit anything off,
  then run /aria:next to move to vision-story.
```

### MCP auth expired

```
You (get_artist_intelligence returns auth error):
  Couldn't pull live Patchline data — the MCP returned "authentication
  required". Run /mcp in Claude Code to reconnect, then re-invoke
  /aria:next. I'll pick up from here.
```

### User gave a vague success metric

```
You: 3/4 — What's the north-star success metric?
User: I want it to do well
You: Can you pin a number or a specific outcome on that? "Do well" is hard
     to measure. Examples: "50k streams month 1", "any editorial
     playlist", "at least 3 sync approaches".
User: Any editorial playlist
You: That's concrete enough, moving on. 4/4 — ...
```

## Common mistakes (don't make these)

- **Writing a "generic pop release" brief** when the artist hasn't told you it's generic or pop. Use THEIR words.
- **Citing genres not in `get_artist_intelligence` output** — e.g. calling them "indie pop" when their profile says "house, tech-house".
- **Padding the brief with aspirational language** ("a landmark release", "a career-defining moment"). Keep it clinical.
- **Skipping the interview because the user seems busy.** The 4 questions are the MINIMUM — the brief without them is a data dump, not a brief.
- **Advancing STATE.md without actually writing BRIEF.md** — check the file exists on disk before updating state.
- **Claiming "cached Patchline bio from March 2026" in the data-sources section** when you didn't actually call `get_bio`. Be truthful about what you ran.
