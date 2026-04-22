---
name: release-plan
description: Release-planning lifecycle phase. Produces RELEASE_PLAN.md and creates app-backed campaign tasks when a Project Anchor exists. Reads campaign intake and artist context before asking questions. Uses get_releases, find_playlists, inspect_playlist, and create_campaign for grounded data; no invented playlist targets.
argument-hint: "[optional - no arguments expected; reads context from .patchline/]"
model: claude-opus-4-7
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

Produce `.patchline/artifacts/RELEASE_PLAN.md`, the load-bearing release plan for downstream rollout, pitch-kit, and smart-link phases.

The plan answers: release date, campaign defaults, distribution action items, target playlists, editorial windows, and next actions. It should not feel like a setup questionnaire.

## Step 1: Read Workspace Context

Use Read:

- `.patchline/PROJECT.md` - artist identity, Project Anchor ID, distribution mode, composition status, campaign intake.
- `.patchline/STATE.md` - confirm `Current phase: release-plan`.
- `.patchline/artifacts/AUDIO_INTAKE.md` - focus track and campaign intake.
- `.patchline/artifacts/BRIEF.md` - intent, audience, success metric, non-negotiables.
- `.patchline/artifacts/VISION.md` - tone and story.
- `.patchline/artifacts/MOODBOARD.md` - anchor track, asset ID, target features, visual mood.
- `.patchline/artifacts/SONGWRITING.md` if present.

If RELEASE_PLAN.md already exists, ask whether to overwrite or refine.

## Step 2: Pull Account/Artist Context

Call `mcp__aria__get_artist_context` with:

```json
{
  "artistId": "<Patchline artist ID if known>",
  "artistName": "<artist name>",
  "projectId": "<Project Anchor ID if known>"
}
```

Use returned context to avoid dumb questions:

- Connected/social data - pass through to rollout automatically. If unknown, rollout will use a baseline multi-channel plan instead of asking the user where they are active.
- Preferred distributor - if unknown, keep distributor `TBD` and add distribution-selection tasks.
- Email list bucket - if unknown, default to `none` and note as an assumption.
- Recent releases - use for collision checks.
- Campaign defaults - territories default global; DSP priority defaults spotify-first.

Unknown data is not an error. Do not ask the user to fill every unknown during this phase.

## Step 3: Resolve Anchor Track

Use the focus track from MOODBOARD.md / AUDIO_INTAKE.md whenever present. Call `mcp__aria__get_asset` with that `assetId`.

If no focus track exists, ask for a catalog asset ID or Spotify track URL to seed playlist matching. Do not guess.

## Step 4: Pull Release History

Call:

- `mcp__aria__get_releases(status: "released", limit: 50)`
- Optionally `mcp__aria__get_releases(status: "submitted", limit: 50)` if the first call shows scheduled/upcoming state is missing.

Use release history and `get_artist_context.recentReleases` to flag releases within +/-14 days of the target date.

## Step 5: Find Playlist Candidates

Call `mcp__aria__find_playlists` with:

- Preferred: `{ "assetId": "<focus asset ID>", "limit": 25 }`
- Fallback: `{ "spotifyUrl": "<spotify track URL>", "limit": 25 }`

The tool accepts only `assetId`, `spotifyUrl`, and `limit`. Do not pass client-side filters such as country, genre, freshness, tier, or budget.

Deepen the top 5-10 candidates with `mcp__aria__inspect_playlist(playlist_url: <spotifyUrl>)`. If inspection fails for a candidate, keep it only as "unverified" or drop it. Do not invent playlist names.

## Step 6: Ask Only Missing Critical Inputs

Use campaign intake first. Ask only what is missing.

Required:

1. Release date - only ask if PROJECT.md/AUDIO_INTAKE.md has `TBD` or blank. If the user still says TBD, choose an internal planning assumption of "minimum 6 weeks from today" and mark it `TBD - recommended earliest planning date: YYYY-MM-DD`.
2. Promo tier - ask if missing. Use `AskUserQuestion` with:
   - `none` - organic only.
   - `modest` - lightweight paid/social/outreach support.
   - `significant` - PR/label/paid support.

Defaults, do not ask unless user already raised them:

- Territories: `global`.
- DSP priority: `spotify-first`.
- Distributor: `TBD` unless known from `get_artist_context` or user already provided it.
- Email list: context bucket, otherwise `none`.
- Social-channel plan: defer to rollout; do not ask release-plan questions about social activity.

Provide distributor options as action items in the plan, not as a mandatory setup question.

## Step 7: Create App Campaign Tasks

If `PROJECT.md` or `STATE.md` contains a Project Anchor ID, call `mcp__aria__create_campaign` after release date and promo tier are resolved:

```json
{
  "projectId": "<Project Anchor ID>",
  "releaseDate": "<resolved date or TBD/recommended date text>",
  "marketingGoal": "<campaign intake or BRIEF.md goal>",
  "goals": ["<known goals>"],
  "targetStreams": <number if known>,
  "budget": <number if known>,
  "promoTier": "<none | modest | significant>",
  "desiredAssets": ["<cover art/flyer/canvas/clips if requested>"],
  "visualReferences": ["<visual references or mood words if known>"],
  "notes": "<free-form campaign notes>",
  "campaignIntake": <structured campaign intake if present>
}
```

Use the result as the app campaign sync source:

- If successful, record task count, degraded/source status, dashboard URL, and the first 3-5 immediate tasks in RELEASE_PLAN.md.
- If successful but `degraded: true`, say app campaign tasks were created from the reliable checklist fallback because model generation was unavailable.
- If it fails, continue with the markdown plan, record the exact MCP error, and mark app campaign sync as `pending/error`.
- If no Project Anchor ID exists, do not call the tool; mark app campaign sync as `local-only - no Project Anchor ID`.

This is the product promise: Aria creates the campaign in Patchline when it can, not only a local document.

## Step 8: Draft RELEASE_PLAN.md

Use Write:

```markdown
# Release Plan: <project-name>

> Generated by `/aria:release-plan` on YYYY-MM-DD - v1
> Grounded in: PROJECT.md campaign intake, BRIEF.md, VISION.md, MOODBOARD.md, get_artist_context, get_asset, get_releases, find_playlists, inspect_playlist, create_campaign.

## Release metadata

- Release date: <date or TBD + recommended earliest planning date>
- Type: <Single | EP | Album>
- Distribution mode: <self_releasing | with_label>
- Distributor: <known value or TBD>
- Territories: global
- DSP priority: spotify-first
- Promo tier: <none | modest | significant>
- Social data status: <known | partial | unknown>
- Email list assumption: <none | small | meaningful | unknown>

## Anchor track

- Track: <title>
- Asset ID: <assetId>
- Core features: <BPM/key/genres/moods from track analysis>
- Visual mood: <from moodboard/campaign intake>

## Distribution action items

<If distributor is TBD, list options as tasks, not questions. Example:>
- Choose distributor: DistroKid, TuneCore, CD Baby, UnitedMasters, Amuse, Symphonic, or existing label pipeline.
- Submit final audio/artwork at least 4 weeks before release; 6 weeks is safer for editorial pitching.
- Confirm ownership/splits before submission.

## Calendar and deadlines

- Recommended latest distributor submission: <release date - 4 weeks, or TBD>
- Editorial pitch window: <release date - 4 weeks, or TBD>
- Curator outreach starts: <release date - 2 weeks, or TBD>
- Release day: <date or TBD>
- First analytics review: <release date + 7 days, or TBD>

## Playlist targets

### Tier 1 - editorial / highest leverage

| Playlist | URL | Type | Followers | Match | Verification | Notes |
|---|---|---|---|---|---|---|

### Tier 2 - curated / reachable

| Playlist | URL | Type | Followers | Match | Verification | Notes |
|---|---|---|---|---|---|---|

### Tier 3 - niche / long tail

| Playlist | URL | Type | Followers | Match | Verification | Notes |
|---|---|---|---|---|---|---|

## Known risks

- Calendar conflicts: <from release history>
- Asset readiness: <from AUDIO_INTAKE.md>
- Distributor TBD: <yes/no>
- Playlist verification gaps: <inspect failures>

## App campaign sync

- Status: <created | degraded | pending/error | local-only>
- Project Anchor ID: <id or missing>
- Dashboard: <dashboard URL if available>
- Campaign task count: <N or unknown>
- Source: <campaign generator source/degraded state, not vendor names>
- Notes: <exact MCP error if failed, otherwise concise sync note>

## Immediate next actions

1. <First app campaign task if available, otherwise highest-priority release action>
2. <Second app campaign task if available, otherwise highest-priority release action>
3. <Third app campaign task if available, otherwise highest-priority release action>

## Data sources

- Artist context: <connected platforms/distributor/email/release history, or unknown>
- Release history: <N releases inspected>
- Playlist matching: <N candidates returned, N inspected>
- App campaign sync: <create_campaign success/degraded/error/skipped>
- User inputs: <campaign intake + any release-plan questions>
```

## Step 9: Update STATE.md

Append only:

- `- release-plan - completed YYYY-MM-DD, artifact: RELEASE_PLAN.md`
- `- RELEASE_PLAN.md (release-plan phase, generated YYYY-MM-DD)`
- `Last updated: YYYY-MM-DD by /aria:release-plan`

Do not touch `Current phase`.

## Step 10: Hand Off

Tell the user in three sentences or fewer: release plan written, app campaign sync status, target date/status, biggest urgent action, and run `/aria:next` for rollout.

## Error Handling

- If `get_artist_context` fails, continue with unknown distributor/social/email context and record the warning in data sources.
- If `get_releases` fails, continue with release-history status unknown and avoid claiming there are no calendar conflicts.
- If `find_playlists` or `inspect_playlist` fails, keep playlist targets empty or marked unverified; do not invent playlist names.
- If `create_campaign` fails, keep the local release plan useful and record app campaign sync as `pending/error` with the exact MCP error.
- If release date is missing and the user says `TBD`, plan around a recommended earliest date instead of blocking.

## Examples

Known context: use the returned distributor/email/platform hints, ask only release date or promo tier if missing, then write RELEASE_PLAN.md.

Unknown context: set distributor to `TBD`, territories to global, DSP priority to spotify-first, and turn distributor options into action items rather than questions.

## Common Mistakes

- Asking which distributor they use when context is unknown; use `TBD` and action items.
- Asking territory/DSP/email/social setup questions by default.
- Writing a local-only release plan when a Project Anchor ID is available; call `mcp__aria__create_campaign`.
- Inventing playlists or pretending unverified targets are verified.
- Calling raw vendor names customer-facing differentiators.
- Compressing release windows below 4 weeks without clearly warning the user.
