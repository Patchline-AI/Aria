---
name: start
description: Bootstrap a new Aria music-project workspace. Use when the user starts planning a new single, EP, album, or campaign and wants AI guidance from idea to launch. Creates `.patchline/` in the current directory, links a Patchline Project Anchor when possible, initializes PROJECT.md + STATE.md grounded in real Patchline artist intelligence, and routes finished-track projects to audio-intake before creative strategy. Invoke via `/aria:start` when available, or from natural language.
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

1. A `.patchline/` directory in the current working directory.
2. `.patchline/PROJECT.md` with artist identity, project scope, Project Anchor, and campaign-intake placeholders.
3. `.patchline/STATE.md` with the lifecycle ledger and Patchline persistence state.
4. `.patchline/artifacts/` as the empty artifact directory.
5. The user routed to `audio-intake` when finished audio exists, otherwise `creative-brief`.

## Supporting Files

- [`../../CLAUDE.md`](../../CLAUDE.md) - plugin-wide voice and MCP grounding rules.
- [`../../reference/state-schema.md`](../../reference/state-schema.md) - canonical STATE.md schema and authority split.

## Security: `$ARGUMENTS` Must Never Reach Bash

`$ARGUMENTS` is user-supplied text. It can only be passed to:

- `mcp__aria__analyze_url` as the `url` argument.
- `mcp__aria__search_artists` as the `query` argument.

Never interpolate `$ARGUMENTS` into Bash, a shell heredoc, or another shell context. If it contains shell metacharacters (`$`, backtick, `;`, `|`, `&`, `>`, `<`), do not pass it anywhere except those MCP tools.

## Step 1: Check For An Existing Workspace

Run `ls .patchline/` via Bash.

- If `.patchline/` does not exist, continue.
- If `.patchline/PROJECT.md` exists, stop. Tell the user a workspace already exists and offer: continue with `/aria:next`, archive it, or delete it intentionally.
- If `.patchline/` exists but `PROJECT.md` is missing, treat it as not-yet-created and continue.

## Step 2: Identify The Artist

If no usable artist input was provided, ask exactly:

> Paste your Spotify artist profile URL. If you don't have one, tell me your artist name.

Prefer the Spotify artist profile because `analyze_url` can parse it immediately and route to the right Patchline intelligence tools.

Do not use Web Search, Fetch, or generic browsing to identify the artist. If Aria MCP tools are unavailable, pause and tell the user: "Aria MCP is not connected yet. Run `/reload-plugins`, then `/mcp` and authenticate `plugin:aria:aria`; after that paste your Spotify artist profile URL again."

### Spotify Artist URL

Call `mcp__aria__analyze_url` with the URL. For Spotify artist URLs it returns URL type, platform ID, clean URL, suggested actions, and a read-only artist-intelligence identity card when available.

If the result is `type: "spotify_artist"`:

1. Do not ask for the artist name again.
2. Immediately call `mcp__aria__add_artist` with `{ "artist_url": cleanUrl }`.
3. Use the returned canonical artist name, Patchline artist ID, streaming-intelligence ID, genres, and enrichment status as the identity source.
4. Call `mcp__aria__get_artist_intelligence` with the canonical artist name returned by `add_artist`.
5. If intelligence is still pending, continue with the canonical identity from `add_artist` and write `Artist enrichment status: pending`. If intelligence is complete but genres are empty, say "artist intelligence returned no genre classification yet" instead of "pending."

This mirrors the Telegram link-handler flow: pasted Spotify artist URL first resolves through Patchline artist intelligence, then Aria asks project questions. Never bounce back with "what is your artist name?" after a valid Spotify artist URL.

### Plain Artist Name

Call `mcp__aria__search_artists` with the string. Prefer a result where `inRoster: true` over a shared-index hit.

Once you have a candidate, call `mcp__aria__get_artist_intelligence` with `artist_name`. Capture:

- `name`, `soundchartsId` (internal streaming-intelligence id), `genres`, `countryCode`, `careerStage`.
- Streaming metrics such as monthly listeners and social followers.
- Cached `bio` if present.

If `get_artist_intelligence` returns `found: false` after a successful `add_artist`, do not fabricate and do not ask for the artist name again. Continue with the canonical identity from `add_artist`, write `Artist enrichment status: pending`, and tell the user artist intelligence is still landing. If the user only gave a plain name and no URL, ask for the Spotify artist profile URL so you can add the exact artist safely.

## Step 3: Capture Minimum Project Basics

Ask exactly these three questions, one at a time:

1. "What's the project called?" If they do not have a name, default to `Untitled Project (YYYY-MM-DD)`.
2. "Are you self-releasing or working with a label on this one?" Map to `self_releasing` or `with_label`.
3. "Do you already have the final track audio ready to upload, are you still working from demos, or are you starting from scratch?" Map to:
   - `complete` - final mixes/masters exist and Aria routes to `audio-intake` before creative strategy.
   - `partial` - rough sketches or demos exist, still writing.
   - `writing` - starting from zero, no audio yet.

Default `Type` to `Single` for this MVP unless the user explicitly says EP or album. Do not ask for release date, genre, targets, visuals, or sound description here. Finished-track projects collect compact campaign intake during `audio-intake` while track analysis runs.

## Step 4: Create The Patchline Project Anchor

If you have a real Patchline artist ID, call `mcp__aria__create_project` before writing the local workspace:

```json
{
  "artistId": "<Patchline artist ID>",
  "title": "<project name>",
  "type": "single",
  "distributionMode": "<self_releasing | with_label>",
  "ideaMetadata": {
    "source": "aria_start",
    "compositionStatus": "<complete | partial | writing>",
    "campaignIntake": {
      "status": "pending",
      "capturePhase": "audio-intake"
    }
  }
}
```

If the project is explicitly an EP or album, set `type` to `ep` or `album`; otherwise use `single`. Capture `projectId`, `dashboardUrl`, title, type, status, and distribution mode from the response.

If `create_project` fails, continue locally. Do not retry in a loop. Write `Patchline persistence: error` with the exact MCP error into PROJECT.md and STATE.md.

If the artist is not in the caller's roster and no Patchline artist ID exists, skip `create_project`, continue locally, and write persistence as `pending`.

## Step 5: Create The Workspace

Use Write to create these files in order.

### `.patchline/PROJECT.md`

```markdown
# Project: [project-name]

> Started: YYYY-MM-DD - Distribution: [self_releasing | with_label]

## Project Anchor

- Patchline project ID: [projectId from create_project, or "pending"]
- Dashboard URL: [dashboardUrl from create_project, or "pending"]
- Persistence status: [created | pending | error: <exact MCP error>]

## Artist identity

- Name: [canonical name from MCP]
- Patchline artist ID: [patchlineArtistId if in roster, else "not in roster"]
- Streaming intelligence ID: [soundchartsId]
- Primary genres: [from get_artist_intelligence - first 3]
- Career stage: [careerStage from MCP]
- Country: [countryCode]
- Current monthly listeners (Spotify): [from streaming metrics]
- Artist enrichment status: [pending OR complete OR failed; if complete with empty genres, write "complete - artist intelligence returned no genre classification yet"]

## Project scope

- Type: [Single unless user explicitly said EP or Album]
- Working title: [project-name]
- Distribution: [self_releasing OR with_label]
- Composition status: [complete OR partial OR writing]
- Focus track asset ID: [pending if complete, otherwise not_required]
- Audio status: [required if complete, otherwise not_required]
- Track analysis status: [missing if complete, otherwise not_required]

## Campaign intake

- Target release date: pending
- Marketing goal: pending
- Desired assets: pending
- Visual references: pending
- Notes: pending

## Source of truth

Artifacts for each phase live under `.patchline/artifacts/`. The lifecycle progression is tracked in `STATE.md`. You can hand-edit any file; Aria will respect your edits and regenerate downstream only when you say so.
```

### `.patchline/STATE.md`

```markdown
# State

> Canonical lifecycle ledger. Updated by each skill upon successful completion.

## Current phase

`<audio-intake if composition status is complete, otherwise creative-brief>` - pending. Run `/aria:next` to begin.

## Completed phases

(none yet)

## Artifacts

(none yet - populated under `.patchline/artifacts/` as phases complete)

## Blockers

(none)

## Distribution mode

`<self_releasing OR with_label>` - set at bootstrap, can be changed later via hand-edit.

## Composition status

`<complete OR partial OR writing>` - set at bootstrap. If `complete`, `audio-intake` must run before creative-brief and `songwriting-brief` is skipped later.

## Focus track asset ID

`<pending if complete, otherwise not_required>` - set at bootstrap; `audio-intake` updates this after upload or existing-asset confirmation.

## Audio status

`<required if complete, otherwise not_required>` - valid values: `missing`, `required`, `upload_requested`, `uploaded`, `not_required`.

## Track analysis status

`<missing if complete, otherwise not_required>` - valid values: `missing`, `analysis_pending`, `analysis_complete`, `analysis_failed`, `not_required`.

## Patchline persistence

`<created | pending | error>` - Project Anchor ID: `<projectId from create_project, or pending>`. Dashboard URL: `<dashboardUrl from create_project, or pending>`.

---

Last updated: YYYY-MM-DD by `/aria:start`
```

Important: substitute a single concrete value for every placeholder. Never write option-list placeholders such as `self_releasing | with_label` into the real files.

### `.patchline/artifacts/`

Run `mkdir -p .patchline/artifacts` via Bash.

## Step 6: Route The User

Tell the user in three sentences or fewer.

If `compositionStatus` is `complete`:

> Workspace created at `.patchline/` and linked to Patchline Project `[projectId or "pending"]`. Identified you as **[artist name]** ([career stage], [top genre or "artist intelligence returned no genre classification yet"], [monthly listeners] monthly listeners). Run `/aria:next` to start audio-intake - I will upload the track, collect the campaign basics while analysis runs, and use the track analysis before asking sonic questions.

If `compositionStatus` is `partial` or `writing`:

> Workspace created at `.patchline/` and linked to Patchline Project `[projectId or "pending"]`. Identified you as **[artist name]** ([career stage], [top genre or "artist intelligence returned no genre classification yet"], [monthly listeners] monthly listeners). Run `/aria:next` to start the creative brief - I will ask a few focused project questions and produce `BRIEF.md`.

Do not continue into the next phase automatically. Let the user invoke it explicitly with `/aria:next`.

## Error Handling

- `get_artist_intelligence` returns `found: false` - follow Step 2 fallback rules.
- `analyze_url` returns no useful identity - ask for Spotify artist profile URL or artist name.
- `search_artists` returns empty and the shared index is unavailable - explain that the artist index is temporarily unreachable and ask for a Spotify artist profile URL.
- `create_project` fails - continue locally, persist the exact MCP error in PROJECT.md and STATE.md.
- Write fails - surface the exact filesystem error and stop.
- MCP auth expired - tell the user to run `/mcp`, reconnect `plugin:aria:aria`, then try again.

## Examples

User: `Start Aria for this artist: https://open.spotify.com/artist/...`

Assistant behavior: resolve the Spotify URL through `analyze_url` / `add_artist`, ask only title, release mode, and audio readiness, call `create_project` when an artist ID exists, then create `.patchline/PROJECT.md` and `.patchline/STATE.md`.

## Common Mistakes

- Do not web-search artist identity.
- Do not ask for artist name again after a valid Spotify artist URL resolves.
- Do not ask release strategy questions in `start`; campaign intake belongs in `audio-intake` for finished singles and in `creative-brief` for idea-first projects.
- Do not claim dashboard persistence worked unless `create_project` returned a Project Anchor ID.
