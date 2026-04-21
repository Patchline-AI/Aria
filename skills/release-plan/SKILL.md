---
name: release-plan
description: Fifth lifecycle phase (or fourth if `songwriting-brief` was skipped). Produces RELEASE_PLAN.md — the concrete "who, what, when, where" of the release. Pulls the user's release history via `get_releases` to scan for calendar collisions, then seeds `find_playlists` from the user's focus-track `assetId` (resolved from MOODBOARD.md) and deepens the top candidates via `inspect_playlist`. Hard rule — every playlist in the plan must come from MCP output, no invented names. Invoked via `/aria:next` after `moodboard` (or after `songwriting-brief` when composition is unfinished).
argument-hint: "[optional — no arguments expected; reads context from .patchline/]"
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

Produce `.patchline/artifacts/RELEASE_PLAN.md` — the load-bearing document for this entire project. Downstream phases (`rollout`, `pitch-kit`, `smart-link`) all read from this file. Get it right.

The plan answers: when is this release going out, through what distribution path, to which territories and DSPs, and which playlists are we targeting. **Every playlist target MUST be grounded via `find_playlists` + `inspect_playlist` output.** This is the R7 MCP-grounding trip wire — if you invent a playlist name here, you poison every downstream pitch.

You will:
1. Read all prior artifacts (BRIEF, VISION, MOODBOARD, SONGWRITING if it exists)
2. Resolve the user's anchor track from MOODBOARD.md → confirm `assetId` + Cynite data via `get_asset`
3. Pull user-wide release history via `get_releases(status: "released", limit: 50)` for calendar-collision scanning
4. Call `find_playlists(assetId: <anchor>, limit: 25)` → ranked playlist candidates with `spotifyId` + `spotifyUrl` per row
5. Call `inspect_playlist(playlist_url: <spotifyUrl from step 4>)` on the top 5–10 candidates for deep intel
6. Interview the user on date, territory mix, DSP priority, promo budget tier (multi-choice Qs via `AskUserQuestion`)
7. Write `RELEASE_PLAN.md` with playlist targets grounded ONLY in MCP output
8. Update `STATE.md` — append to `Completed phases:` and `Artifacts:`; do NOT rewrite `Current phase:`

## Supporting files

- [`../../CLAUDE.md`](../../CLAUDE.md) — voice, workspace contract, MCP grounding rules
- [`../moodboard/SKILL.md`](../moodboard/SKILL.md) — predecessor; the anchor track here seeds `find_playlists`
- [`../songwriting-brief/SKILL.md`](../songwriting-brief/SKILL.md) — optional predecessor; if present, its track list + timeline feed into this plan

## Step 1: Read workspace context

Use Read on these files (in order):

- `.patchline/PROJECT.md` — artist identity, `Distribution mode`, `Composition status`
- `.patchline/STATE.md` — confirm `Current phase: release-plan`. If not, STOP and surface the mismatch.
- `.patchline/artifacts/BRIEF.md` — project intent, audience, north-star metric, non-negotiables
- `.patchline/artifacts/VISION.md` — sonic identity, reference artists
- `.patchline/artifacts/MOODBOARD.md` — reference tracks with ISRCs / Cynite features / assetIds. **Find the anchor track.**
- `.patchline/artifacts/SONGWRITING.md` — if present, extract track list + demos-due date; those constrain the release calendar

If `RELEASE_PLAN.md` already exists, ask: "A RELEASE_PLAN.md already exists. Overwrite, or refine in place?" Don't clobber.

## Step 2: Resolve the anchor track

`find_playlists` is seeded from a single catalog track — the "anchor" — whose Cynite signature drives matching. Pick it from MOODBOARD.md:

1. **If MOODBOARD.md designates a closest-to-project reference track with an `assetId`** — that's the anchor. Capture the `assetId`.
2. **If multiple candidate anchor tracks appear in MOODBOARD.md** — use `AskUserQuestion` to let the user pick. Offer each candidate with its BPM, key, and genre as the description so the choice is informed.
3. **If MOODBOARD.md has reference tracks with Spotify URLs but no `assetId` (external refs)** — fall back to the `spotifyUrl` mode of `find_playlists`. Note the fallback in the artifact so the user knows the matching was seeded off an external track rather than their catalog.
4. **If no anchor exists at all** — use `AskUserQuestion` to ask the user: (a) "Pick a catalog track by name — I'll resolve it via `catalog_search`" or (b) "Paste a Spotify track URL to seed off of" or (c) "Upload a reference track first, then re-run this phase". Do NOT guess.

Once you have an `assetId`, call `mcp__aria__get_asset(assetId: <that>)` to confirm:

- The asset exists and is accessible to this user
- It has ISRC + Cynite metadata present (the playlist matcher needs genres from Cynite; aiMetadata genres are a fallback)
- If `get_asset` returns an error or the asset has no Cynite analysis, surface that to the user: "The anchor track `<title>` has no Cynite analysis yet — playlist matching will fall back to aiMetadata genres or fail entirely. Re-run Cynite analysis before this phase, or pick a different anchor."

**Honesty rule:** `find_playlists` does NOT accept tempo / energy / genre / country / tier-preference / freshness-days parameters directly. It takes an `assetId` (or a `spotifyUrl` fallback) and derives sonic + genre features from that seed. Do not pretend the tool accepts client-side filters — filter after you see the ranked results if you need to.

## Step 3: Pull release history + flag collisions

Call `mcp__aria__get_releases(status: "released", limit: 50)`.

This is **user-scoped** — it returns ALL releases under the signed-in user account, not a specific artist's releases. The tool does NOT accept an `artist_id` parameter. For a multi-artist account, manually filter the returned list client-side by `artist` name if you need to scope to a single project.

Response fields per release: `id`, `title`, `artist`, `status`, `releaseDate`, `upc`, `trackCount`, `coverArtUrl`, `createdAt`.

**Capture this data.** You'll use it in two places:
1. "Known conflicts" section of the release plan — any release within ±14 days of the target date gets flagged as a potential cannibalization risk.
2. Interview Q1 context — when you ask about release date, cite existing upcoming releases so the user doesn't accidentally schedule collisions.

If you also need upcoming / scheduled releases, call `get_releases(status: "submitted", limit: 50)` — those are queued drops. For a full sweep, run both and merge.

If `get_releases` errors: surface the exact error, proceed without collision data, and flag the gap in the artifact ("Could not verify against release history — MCP returned: `<error>`. User should eyeball their own calendar before locking a date.").

## Step 4: Find playlist candidates

Call `mcp__aria__find_playlists` with the anchor track:

- **Preferred:** `find_playlists(assetId: <anchor assetId from Step 2>, limit: 25)` — the Lambda pulls the asset's ISRC + Cynite genres + audio features automatically and runs the full match model.
- **Fallback:** `find_playlists(spotifyUrl: <Spotify track URL>, limit: 25)` — only if the user has no catalog anchor. The Lambda calls Soundcharts to resolve genres from the Spotify track ID. Weaker signal, but still grounded.

The tool accepts ONLY these args: `assetId`, `spotifyUrl`, `limit` (max 25). That's it.

**Response structure** (per-playlist fields):
- `rank` — 1 = best match
- `name` — playlist display name
- `followers` — follower count
- `type` — editorial / algorithmic / user-curated
- `matchScore` — numeric match score
- `spotifyId` — 22-char Spotify playlist ID
- `spotifyUrl` — full `https://open.spotify.com/playlist/<id>` URL (USE THIS in Step 5)
- `genres` — playlist genre tags
- `imageUrl` — cover art
- `breakdown` — per-dimension scoring breakdown if the Lambda returned one

Top-level fields: `total`, `candidatesEvaluated`, `cyniteAvailable`, `genresUsed`, `playlists`.

**Capture the top 15–20** for Step 5.

### If `find_playlists` returns empty

- The Lambda requires genres — if the anchor has no Cynite analysis AND Soundcharts can't resolve genres from the Spotify URL, the call will error out with an actionable message. Surface it.
- If the call succeeds but returns 0 playlists, flag in the artifact ("Patchline's playlist index returned no matches for `<anchor title>`'s sonic profile — the release plan below omits a playlist-targets section. User should re-run this phase after uploading a different anchor, or fall back to direct curator outreach.") and skip Step 5.

## Step 5: Deepen intel on top targets

Pick the top 5–10 playlists from Step 4 (by `matchScore`, not follower count alone — a tight match on a 50k-follower playlist beats a loose match on a 500k-follower one).

For each, call `mcp__aria__inspect_playlist(playlist_url: <spotifyUrl from Step 4's response>)`.

**The tool takes `playlist_url`** — a Spotify URL (`https://open.spotify.com/playlist/<22-char-id>`) OR a bare 22-character Spotify playlist ID. It does NOT take a Soundcharts UUID. Use the `spotifyUrl` field straight from the `find_playlists` response.

Optional args (defaults shown):
- `include_tracks: true` — returns current track-roster snapshot
- `include_curator_network: true` — returns sibling playlists from the same curator

Response structure: `spotifyId`, `playlist` (name/type/followers/growthSummary/refresh/trackAge/turnoverPct), `trackSnapshot` (visible tracks, 30-day adds, unique artists, top-repeated artists), `curatorNetwork` (sibling playlists + combined reach), `_raw` (passthrough of any extra Lambda fields).

Capture all of this per playlist. This is what makes the plan pitchable in the next phase — `pitch-kit` reads `inspect_playlist` output to tailor each pitch.

If `inspect_playlist` errors on a specific playlist (e.g. "playlist not found in the Patchline playlist inventory"), drop that playlist from the target list (don't include targets you can't verify). If it errors on all of them, flag the gap and proceed with `find_playlists` output only, clearly marked as "unverified — run `inspect_playlist` before pitching."

## Step 6: Interview (3–5 focused questions)

Use `AskUserQuestion` for multi-choice questions (Q3, Q4, Q5). Use free-form for Q1 (release date — too many valid date shapes) and any narrative follow-ups. One question per turn. Skip anything already answered by PROJECT.md or earlier artifacts.

### The five pillars

1. **Release date — free-form.**

   "What's the target release date?" — Pin a date, YYYY-MM-DD. Push for specifics. If they say "sometime in Q3", push: "Pick a day — you can always shift it, but downstream calendar planning needs an anchor." Once they give a date, compare against `get_releases` output:
   - Any release in ±14 days → flag it: "You already have `<release name>` scheduled `<N>` days `<before/after>` this date. Stacking risks cannibalizing streams — confirm you want both or shift this one."
   - Any industry-known conflict you can detect (major Spotify editorial refresh days, known mega-release dates) — note it but don't veto.

2. **Territories — free-form.**

   "Which territories — global, or specific markets?" — Accept: `global`, a list of country codes (`US, UK, DE, BR`), or "just `<country>`". If `Distribution mode` is `self_releasing`, the user picks freely. If `with_label`, ask: "Is that what the label is doing, or are you overriding?" — labels often restrict territory rollout.

   **Honesty note:** `find_playlists` does NOT filter by territory. The playlist matching happens purely on sonic + genre signal. Territory is a downstream rollout concern (DSP release region, ad targeting) — capture the answer, but do not claim the playlist targets are territory-filtered.

3. **Distributor / label — `AskUserQuestion`.**

   If `Distribution mode == self_releasing`: offer distributor options (DistroKid / TuneCore / CD Baby / UnitedMasters / Amuse / Symphonic / other).

   If `with_label`: switch to free-form — "Which label + who's the A&R / release manager contact driving this?" Names can't be enumerated.

4. **DSP priority — `AskUserQuestion`.**

   Options:
   - `spotify-first` — editorial pitch to Spotify before anyone else; Apple and others follow. Most common for independent and emerging.
   - `apple-first` — priority on Apple Music editorial (heavier in hip-hop, country). Less common but legitimate.
   - `equal` — parallel pitches across DSPs. Requires more coordination in rollout.

   Matters for `pitch-kit` sequencing in the next phase.

5. **Promo budget tier — `AskUserQuestion`.**

   Qualitative only. Do NOT ask for dollar amounts.

   Options:
   - `none` — organic only. No paid ads, no PR retainer, no playlist pitching services.
   - `modest` — some paid social (< $1k-scale), DIY PR, maybe one outreach service.
   - `significant` — paid PR retainer, label marketing budget, ad spend, possibly playlist promotion services.

   This budget tier shapes what the rollout phase can realistically recommend.

### Optional 6th question

If `Distribution mode == with_label`: "What's the label's rollout window — do they own the announce-to-release period, or do you?" — Free-form; labels' contractual windows vary wildly.

### Distribution-mode confirmation

If PROJECT.md somehow lacks `Distribution mode` (drift), use `AskUserQuestion` with options `self_releasing` / `with_label` before proceeding. Don't silently default.

## Step 7: Draft RELEASE_PLAN.md

Use Write to create `.patchline/artifacts/RELEASE_PLAN.md`. Dense, scannable, no hedging:

```markdown
# Release Plan: <project-name>

> Generated by `/aria:next` (release-plan skill) on YYYY-MM-DD · v1
> Grounded in: BRIEF, VISION, MOODBOARD, SONGWRITING (if exists), `get_asset` (anchor `<assetId>`, fetched <timestamp>), `get_releases` (fetched <timestamp>, <N> releases inspected), `find_playlists` (<N> candidates returned from anchor `<anchor title>`), `inspect_playlist` (<N> targets deepened).

## Release metadata

- **Release date**: YYYY-MM-DD (<N> days from today)
- **Type**: <single | EP | album | remix pack>
- **Track count**: <from SONGWRITING.md or user>
- **Territories**: <global | list>
- **DSPs**: <all-major | spotify-first | apple-first | list>
- **Status**: `planning` (will advance to `announced` → `live` as the rollout runs)

## Anchor track

- **Track**: `<title>` by `<artist>`
- **Asset ID**: `<assetId>` (or `spotifyUrl fallback: <url>` if no catalog anchor)
- **ISRC**: `<isrc>` (from `get_asset`)
- **Cynite signature**: BPM `<N>`, key `<X>`, genres `[g1, g2, ...]` (from `get_asset`)
- This is the seed track used by `find_playlists`. All playlist targets below are matched against this track's sonic + genre profile.

## Distribution

<If self_releasing:>
- **Mode**: Self-releasing
- **Distributor**: <from Q3>
- **Publisher**: <from SONGWRITING.md if present, else "TBD / artist-admin">
- **Label contact**: N/A

<If with_label:>
- **Mode**: Label-released
- **Label**: <name>
- **A&R / release manager**: <name + email/handle>
- **Label-owned period**: <from Q6 if asked; else "full cycle">
- **Artist-owned period**: <complement of label-owned period>

## Playlist targets (grounded via `find_playlists` + `inspect_playlist`)

> Every playlist below traces to MCP output. Do not add playlists here by hand without running them through `inspect_playlist` first — downstream pitch-kit fails if targets can't be verified.

### Tier 1 — editorial (highest-reach, hardest to land)

| Playlist | Spotify URL | Curator | Followers | Refresh | Match | Notes |
|---|---|---|---|---|---|---|
| <name> | <spotifyUrl from find_playlists> | Spotify Editorial | <N> | Weekly | <matchScore> | <from inspect_playlist — recent adds, top repeated artists, turnover %> |

<Classify by `type` field from find_playlists response: "editorial" → Tier 1, "algorithmic" or curator-with-large-network → Tier 2, "user-curated" / small indie → Tier 3. Up to 3 editorial rows.>

### Tier 2 — curated (mid-reach, warmer conversion)

| Playlist | Spotify URL | Curator | Followers | Refresh | Match | Notes |
|---|---|---|---|---|---|---|
| (3–5 curated) | | | | | | |

### Tier 3 — independent / niche (lower-reach, easiest to land, high genre-fit)

| Playlist | Spotify URL | Curator | Followers | Refresh | Match | Notes |
|---|---|---|---|---|---|---|
| (3–5 indie) | | | | | | |

### Pitch sequencing

- **Editorial window opens**: <release date minus 4 weeks> (Spotify-for-Artists pitch deadline)
- **Curator outreach starts**: <release date minus 2 weeks>
- **Independent / niche outreach**: <release date, day-of, via direct DM / submission forms>
- **Second wave push**: <release date plus 1 week> for any Tier 2/3 that didn't respond first-time

Each playlist in this table has a dedicated pitch drafted in the `pitch-kit` phase (upcoming). Do not DM curators from this list before the pitch-kit exists.

## Editorial pitch window

- **Spotify-for-Artists pitch deadline**: <release date minus 4 weeks> (Spotify's recommended minimum; `with_label` may have label-handled pitch paths)
- **Apple Music editorial submission**: via distributor <N> weeks out
- **Amazon Music, Deezer, TIDAL**: distributor-dependent; confirm with <distributor> or label

## Radio / sync strategy

<If BRIEF.md mentions radio or sync as non-negotiable or north-star:>
- **Radio**: <specific station type — college, community, tastemaker BBC Introducing, etc. — grounded in what the user mentioned>
- **Sync**: <music supervisor targets if named in BRIEF, else "none pre-identified — flag for pitch-kit phase">

<If neither mentioned:>
- Not prioritized for this release. Skipped.

## Known calendar conflicts

<From `get_releases` output, flag any release within ±14 days of the target date:>

- `<release name>` scheduled for `<date>`, <N> days <before/after> this release. Risk: <cannibalization of listener attention, shared editorial slots, duplicate pitch pipeline>.
- <additional conflicts if any>

<If no conflicts:>
- No scheduling conflicts detected in user's upcoming release calendar.

<If get_releases errored:>
- Could not verify against release history (MCP error: `<quoted error>`). **User must eyeball own calendar before locking the date.**

## Promo budget tier

**`<none | modest | significant>`** — from Interview Q5. Rollout phase will scope its recommendations to match this tier. Do NOT recommend paid PR retainers in a `none` tier, etc.

## Non-negotiables (from BRIEF.md)

<Re-surface BRIEF non-negotiables that affect the release. E.g., "No paid playlist placement (BRIEF non-neg #2). All pitch activity organic only.">

## Data sources

- `get_asset` on anchor `<assetId>` returned <ISRC / Cynite presence / genres> at <timestamp>
- `get_releases` returned <N> items at <timestamp>, status filter `<released | submitted | null>`
- `find_playlists` returned <N> candidates at <timestamp>, seeded from anchor `<assetId | spotifyUrl>`; Lambda used genres `[...]`; `cyniteAvailable: <true|false>`
- `inspect_playlist` deepened <N> targets at <timestamp>
- User interview: <date>, <N> questions answered

---

*This is the project's source of truth for scheduling, distribution, and targeting. Downstream rollout and pitch-kit phases read from this file — keep it current if dates or targets shift.*
```

### Grounding-quality checklist (self-check before writing)

- [ ] Every playlist in the targets table has a row populated from `inspect_playlist` (curator, followers, refresh, notes) — if any column says "TBD", it's because MCP returned no data for that field, not because you didn't look
- [ ] Every playlist name traces to a row returned by `find_playlists` this run — no names added from memory
- [ ] Every `Spotify URL` column value is the `spotifyUrl` field straight from the `find_playlists` response (not a Soundcharts ID, not a constructed URL)
- [ ] "Known calendar conflicts" either lists real conflicts from `get_releases` OR explicitly states no conflicts / MCP error
- [ ] Release date is a specific YYYY-MM-DD, not a vague "Q3"
- [ ] Distribution section reflects `Distribution mode` from PROJECT.md — don't write label-flow content in a self-releasing plan
- [ ] Promo budget tier gates recommendations — no "hire a PR firm" advice in a `none` tier
- [ ] Data sources section is truthful about what ran — if `inspect_playlist` was skipped for any target, the count reflects that

If any check fails, fix it before writing.

## Step 8: Update STATE.md

Use Edit on `.patchline/STATE.md`. **Append-only to the ledger — do NOT rewrite `Current phase:`. The `next` router reads `Completed phases:` as the authoritative signal and picks the successor itself.**

- `Completed phases:` → append `- release-plan — completed YYYY-MM-DD, artifact: RELEASE_PLAN.md`
- `Artifacts:` → append `- RELEASE_PLAN.md (release-plan phase, generated YYYY-MM-DD)`
- `Last updated: YYYY-MM-DD by /aria:next (release-plan skill)`

Leave `Current phase:` untouched. The user's next `/aria:next` will walk the chain and land on `rollout` (or whatever composition-status routing dictates).

## Step 9: Hand off

≤3 sentences:

> Release plan written to `.patchline/artifacts/RELEASE_PLAN.md`. Target: `<release date>`, `<N>` playlist targets (all MCP-verified, seeded from anchor `<track title>`), distribution via `<mode + distributor/label>`. Run `/aria:next` to move to `rollout` — I'll sketch a week-by-week calendar from announce to release day.

## Error handling

- **STATE.md shows different current phase** → STOP, surface the mismatch.
- **MOODBOARD.md has no anchor track** → `AskUserQuestion` to pick one (catalog track name, Spotify URL, or upload-first). Don't invent an anchor.
- **`get_asset` returns "Asset not found" for the chosen anchor** → the asset was deleted or the user hand-edited MOODBOARD.md to stale values. Surface it, ask for a new anchor.
- **`get_asset` returns the asset but with no Cynite metadata** → flag it: playlist matching may fall back to aiMetadata genres or fail. Let the user decide whether to proceed or re-analyze first.
- **`get_releases` errors** → proceed; flag the gap in the "Known conflicts" section.
- **`find_playlists` returns empty or errors** → skip the playlist targets section; flag it in the artifact; still ship the rest of the plan. The user can re-run this phase after uploading a better-analyzed anchor.
- **`inspect_playlist` errors on a target** → drop that target from the table. Never list unverified playlists.
- **User refuses to pick a release date** → do not guess. Write "Target date: TBD — set this before running rollout phase" and stop. Downstream calendar can't work without an anchor.
- **Conflict with an existing release in user's calendar** → flag it in the "Known conflicts" section, keep the user's chosen date (they may have legitimate reasons to stack), don't veto.

## Examples

### Happy path — self-releasing single with catalog anchor

```
User: /aria:next
You (reads all prior artifacts; finds anchor assetId `ast_7f2e9` in MOODBOARD.md;
     calls get_asset → confirms ISRC + Cynite present (126 BPM, A min, [house,
     tech-house]); calls get_releases(status: "released", limit: 50) → 8 past
     releases; calls get_releases(status: "submitted", limit: 50) → 2 upcoming
     (2026-05-15, 2026-07-01); calls find_playlists(assetId: "ast_7f2e9",
     limit: 25) → 18 candidates with spotifyUrls; calls inspect_playlist on top
     6 spotifyUrls):
  Pulled your release history (2 upcoming — 2026-05-15 and 2026-07-01) and 18
  playlist candidates seeded from your anchor track "Midnight Drive" (126 BPM,
  house/tech-house). Deepened the top 6. Five quick questions.

  1/5 — What's the target release date?

User: June 14
You: June 14 is clean — no conflicts with your existing calendar.
     2/5 — territories?
User: Global
You (AskUserQuestion with distributor options):
  3/5 — Which distributor?
User: DistroKid
You (AskUserQuestion with DSP priority options):
  4/5 — DSP priority: Spotify-first, Apple-first, or equal?
User: Spotify-first
You (AskUserQuestion with promo tier options):
  5/5 — Promo budget tier: none, modest, or significant?
User: Modest
You (writes RELEASE_PLAN.md with 3 editorial + 5 curated + 5 indie targets,
     all from find_playlists response, each with spotifyUrl + inspect_playlist
     data; Spotify-for-Artists deadline calculated as May 17; appends to
     Completed phases + Artifacts in STATE.md, leaves Current phase untouched):
  Release plan written. Target 2026-06-14, 13 playlist targets (all MCP-verified,
  seeded from anchor "Midnight Drive"), DistroKid + Spotify-first priority,
  modest promo tier. Run /aria:next for rollout.
```

### No catalog anchor — spotifyUrl fallback

```
You (MOODBOARD.md references are all external Spotify tracks, no assetIds):
  MOODBOARD.md has three reference tracks, all external Spotify URLs — you
  don't have a catalog anchor yet.

You (AskUserQuestion — options: "Use <ref 1: Artist - Title>", "Use <ref 2>",
     "Use <ref 3>", "Upload a reference track first"):
  Which reference should I seed playlist matching off of?

User: Use ref 2
You (calls find_playlists(spotifyUrl: "https://open.spotify.com/track/...",
     limit: 25) → Soundcharts resolves genres → 14 candidates; calls
     inspect_playlist on top 5):
  Seeded off external track "..." — 14 playlist candidates returned. Note
  in the artifact: matching used external seed, not catalog track. Continuing
  interview.
```

### `find_playlists` errors (auth expired)

```
You (find_playlists returns isError: true with "authentication required"):
  Couldn't match playlists — Patchline MCP returned "authentication required".
  Run /mcp in Claude Code to reconnect aria, then re-invoke /aria:next. I'll
  pick up from here — get_releases and the anchor resolution already ran, so
  we're only missing the matching step.
```

### Calendar conflict

```
You (get_releases shows release scheduled 10 days after proposed date):
  June 14 is 10 days before your remix EP drop on June 24 — Spotify editorial
  typically won't pitch both within a 2-week window. You have two options:
  (a) keep both dates, accept that the EP will get most editorial attention,
  (b) shift this single to earlier-May. Which one?
User: Keep both.
You (flags the conflict in the artifact, continues):
  Noted. "Known conflicts" section will flag the 10-day gap so downstream
  rollout and pitch-kit handle it. Moving on.
```

## Common mistakes (don't make these)

- **Inventing playlist names.** This is the one inviolable rule in this entire skill. Every playlist traces to `find_playlists` + `inspect_playlist`. If MCP doesn't return a match, the table is empty and flagged — never add a name from training-data memory ("Spotify's Fresh Finds fits here") without verifying it came back from the MCP call this run.
- **Passing invented args to `find_playlists`.** The tool ONLY accepts `assetId`, `spotifyUrl`, `limit`. It does NOT accept `tempo`, `energy`, `genre`, `country`, `tier_preference`, `freshness_days`. If you need those dimensions, filter the response client-side — don't fabricate parameters the tool will reject.
- **Passing an `artist_id` to `get_releases`.** The tool is user-scoped — it only takes `status` and `limit`. Filter by artist name client-side after the call if you need to scope.
- **Passing a Soundcharts UUID to `inspect_playlist`.** The tool takes `playlist_url` (Spotify URL or bare 22-char Spotify playlist ID). Always use the `spotifyUrl` field straight from the `find_playlists` response.
- **Populating playlist rows from `find_playlists` alone without `inspect_playlist`.** `find_playlists` gives match scores + basic metadata; `inspect_playlist` gives curator + refresh + recent-adds + curator network. The pitch-kit phase needs both. Skipping `inspect_playlist` produces unpitchable targets.
- **Pretending the tool filters by territory or tier.** It doesn't. The playlist matcher operates purely on sonic + genre signal. If the user asks for "US-only editorial", capture the intent but flag that the targets list isn't territory-filtered at the MCP layer.
- **Ignoring calendar collisions.** `get_releases` exists for a reason. If the user has a release in ±14 days, flag it — don't silently stack.
- **Recommending paid PR on a `none` promo tier.** The budget tier is a constraint, not a suggestion. Respect it.
- **Writing label-flow content in a `self_releasing` plan (or vice versa).** Read `Distribution mode` from PROJECT.md and stay in that lane.
- **Letting the user leave the release date vague.** "Q3" is not a date. Push once for specificity; if they still refuse, write "TBD" and stop — don't generate calendar downstream off nothing.
- **Padding the plan with aspirational language** ("this release will reshape the sonic landscape"). Clinical. Concrete. Scannable.
- **Rewriting `Current phase:` in STATE.md.** This skill appends to `Completed phases:` + `Artifacts:` only. The `next` router is the authority on `Current phase:`.
- **Advancing STATE.md without writing RELEASE_PLAN.md.** Check the file exists on disk before updating state.
