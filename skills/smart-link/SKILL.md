---
name: smart-link
description: 'Final lifecycle phase. Transitions the plugin from "preparing" to "shipping" — generates a live `patchline.ai/s/<slug>` smart link via `create_smart_link` (server-side resolution of ISRC, DSP URLs, cover art, artist identity from the catalog asset) and produces `LAUNCH.md` with the real URL + a day-of-release checklist (socials, email, playlist pitches, label notification, monitoring pointers). Reads every prior artifact. Use when STATE.md shows `current phase: smart-link`. Typically the last `/aria:next` of the cycle. The hard rule — the smart-link URL must be LIVE. No placeholders.'
argument-hint: "[optional — no arguments expected; reads context from .patchline/]"
model: claude-sonnet-4-6
prerequisites:
  - pitch-kit
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - AskUserQuestion
  - aria
---

## Your Task

Ship the release. Produce `.patchline/artifacts/LAUNCH.md` — the day-of-release operations doc, anchored on a real, live smart-link URL returned by `create_smart_link`. After this skill runs:

- The artist's smart link exists in Patchline and is publicly resolvable (e.g. `https://patchline.ai/s/midnight-oil`)
- LAUNCH.md lists every outbound action — socials, email, playlist submissions, label notification
- The STATE.md ledger marks the lifecycle complete
- The user has a clear "what's next" — including monitoring pointers and the verify-phase backlog

You will:

1. Read every prior artifact
2. Resolve the focus track's `assetId` and verify it has an ISRC (server requires it)
3. Ensure the artist is in the user's Patchline roster via `add_artist` (idempotent; single `artist_url` arg)
4. Ask at most 1 confirming question (title-override) via AskUserQuestion
5. Create the real smart link via `create_smart_link(assetId, title?)` — server resolves DSP URLs, cover art, artist identity from the asset
6. Extract the live URL from the tool response and produce `LAUNCH.md` with it
7. Mark the lifecycle complete in STATE.md

**The hard rule: the smart-link URL in LAUNCH.md must be the real URL returned by `create_smart_link`. If `create_smart_link` errors, STOP and surface the exact error. Do NOT produce LAUNCH.md with a placeholder URL — a placeholder smart-link is worse than no LAUNCH.md at all, because the artist will copy it into their bio.**

## Supporting files

- [`../../CLAUDE.md`](../../CLAUDE.md) — voice, "never claim pitches were submitted", MCP grounding
- [`../pitch-kit/SKILL.md`](../pitch-kit/SKILL.md) — predecessor, produces PITCH_KIT.md
- [`../release-plan/SKILL.md`](../release-plan/SKILL.md) — source of release date, focus track `assetId`, focus DSPs

## Step 1: Read workspace context

Use Read:

- `.patchline/PROJECT.md` — artist name, Patchline artist ID (may be "not in roster"), **Spotify artist URL**, Distribution mode
- `.patchline/STATE.md` — confirm the chain routes here (check `Current phase:` and `Completed phases:`). If `Current phase:` disagrees, STOP: "STATE.md says we're in phase `<X>`, not smart-link. Run `/aria:next` to invoke the correct phase."
- `.patchline/artifacts/BRIEF.md` — project intent, non-negotiables
- `.patchline/artifacts/VISION.md` — narrative positioning (used for launch copy)
- `.patchline/artifacts/MOODBOARD.md` — reference context
- `.patchline/artifacts/RELEASE_PLAN.md` — **focus track `assetId`**, release date, focus DSPs
- `.patchline/artifacts/ROLLOUT.md` — week-of content drafts (referenced in the checklist)
- `.patchline/artifacts/PITCH_KIT.md` — referenced in the pitch-submission checklist
- `.patchline/artifacts/LAUNCH.md` — if it ALREADY exists, ask: "A LAUNCH.md already exists. The smart link may already be live. Overwrite (re-create smart link — this may generate a new URL and orphan the old one) or refine in place?" Do not silently overwrite. If the user confirms re-create, include a warning in the new LAUNCH.md that the previous smart-link slug is orphaned.

If any upstream artifact is missing, STOP with a pointer to the right phase.

## Step 2: Resolve + verify the focus asset

The smart link is built from a single `assetId` — the server resolves everything else (ISRC → DSP URLs via Soundcharts, artist identity, cover art) from the Patchline catalog asset record.

### 2a. Locate the focus track's assetId

Pull the focus track's `assetId` from `RELEASE_PLAN.md`. If RELEASE_PLAN.md doesn't have one (e.g. earlier phase ran before catalog import), fall back to `mcp__aria__catalog_search` with `query: "<focus track title> <artist name>"` → take the top hit's `id` field as the `assetId`. If search returns no results:

> STOP: "Couldn't find this track in your Patchline catalog. Smart links require the track to be imported/distributed first. Options: (a) import the track via the dashboard and re-invoke, (b) if this is pre-release, wait until distribution is live and re-invoke."

### 2b. Verify the asset has an ISRC

Call `mcp__aria__get_asset` with `{ assetId: "<from 2a>" }`. Check the returned `isrc` field. 

**If `isrc` is null or missing:**

> STOP. Surface clearly: "Your focus track doesn't have an ISRC registered in Patchline's catalog. The smart link server needs an ISRC to resolve DSP links via Soundcharts. Upload/distribute this track through your distributor (DistroKid, Symphonic, Stem, TuneCore) so an ISRC is assigned, then re-run `/aria:smart-link`. If you already distributed, re-import the asset in the Patchline dashboard to refresh the ISRC."

Do NOT proceed. The server will reject `create_smart_link` without an ISRC — catching it here gives a clearer error than the server's generic validation message.

**If `isrc` is present:** continue. Capture the asset's `title`, `artist`, and `coverArt` for reference in LAUNCH.md (the server uses these too, but you cite them so the user can verify later).

### 2c. Capture asset metadata for LAUNCH.md

From the `get_asset` response, note:
- `id` (the `assetId`)
- `title`
- `artist`
- `isrc`
- `coverArt` URL (may be null — the server will use a default placeholder if so)

You'll cite these in LAUNCH.md's "Release specs" section.

## Step 3: Ensure the artist is in the user's Patchline roster

Smart links attach to the user's roster. Call `mcp__aria__add_artist` with:

- `artist_url` — **the Spotify artist URL from PROJECT.md**. This is the ONE required field. The tool also accepts YouTube / TikTok / SoundCloud / Apple Music / Instagram URLs, but Spotify is canonical and what you should use if captured.
- `artist_name` — optional display-name override. Usually omit; the handler derives the canonical name from Soundcharts enrichment.

The tool is **idempotent** — if the artist is already in the user's roster, `add_artist` returns the existing record with the same `artistId`. No duplicate created.

> In THIS step we do NOT pre-check with `search_artists`. `add_artist` handles the existing-record case itself. The `start` skill uses `search_artists` for a different purpose (identification during bootstrap).

### If PROJECT.md does not have a Spotify artist URL

STOP with a clear pointer:

> "PROJECT.md doesn't have a Spotify artist URL captured — `add_artist` requires a platform URL (name-only is rejected because artist names are ambiguous). Hand-edit PROJECT.md to add the line `Spotify artist URL: https://open.spotify.com/artist/<id>`, then re-invoke `/aria:next`."

### If `add_artist` errors

- Auth error → STOP: "Patchline MCP auth error. Run `/mcp` to reconnect, then re-invoke `/aria:next`."
- "Could not identify a supported platform from: <url>" → PROJECT.md has a malformed or unsupported URL. Point the user at the fix: Spotify artist URL preferred. Ask them to hand-edit and re-invoke.
- Soundcharts couldn't resolve (non-fatal) → the tool still adds the artist; response `enrichmentWillRun: false`. Note in LAUNCH.md that deep intelligence will run via the profile page's auto-enrich fallback. Continue.
- Rate-limit error → back off, tell user: "Patchline rate-limited add_artist. Retry in a minute."

Capture the returned `artistId` (aka `patchlineArtistId`). If PROJECT.md had "not in roster" before, use Edit to update the `Patchline artist ID:` line with the new `artistId`.

## Step 4: One confirming question

Before creating the smart link, confirm the displayed title. The server will default to the asset's `title` field; the user can override it for the shareable link display.

Ask via **AskUserQuestion**:

- **Question**: `Smart link display title`
- **Header**: `Smart link title`
- **Prompt**: `Smart link will be for "<Track Title>" by <Artist Name>. Use the track title as the display name, or override it?`
- **Options**:
  - `Use track title` — "Keep "<Track Title>" as the smart-link display name"
  - `Custom title` — "I'll type a different display name"
- Set `multiSelect: false`.

If the user picks `Custom title`, follow up: "What should the smart-link display name be?" and capture their string.

You do NOT ask about cover art or DSP URLs — the server resolves both from the asset record (cover art from `asset.coverArtUrl`, DSP URLs from Soundcharts via the ISRC).

## Step 5: Create the smart link

Call `mcp__aria__create_smart_link` with:

- `assetId` — from Step 2a (required)
- `title` — from Step 4 if the user chose `Custom title`; otherwise omit (server uses asset's `title`)

The tool returns a JSON object with these fields:

- `shareId` — internal Patchline share record ID
- `shareUrl` — the live URL, e.g. `https://patchline.ai/s/midnight-oil`
- `trackName` — resolved track title
- `artistName` — resolved artist display name
- `platformLinks` — object mapping DSP names to URLs (Spotify, Apple Music, Tidal, YouTube Music, etc.), populated server-side via Soundcharts
- `platformCount` — how many DSPs were resolved

Capture `shareUrl`, `shareId`, and `platformLinks`. These are your grounding for LAUNCH.md.

### If `create_smart_link` errors

**STOP. Do not produce LAUNCH.md.** This is the hard rule. Surface the exact error to the user:

- "Smart link creation failed (HTTP 400)" with "missing ISRC" in the message → this should've been caught in Step 2b. Re-check the asset. If Step 2b passed but the server still rejects, possibly the catalog's ISRC was cleared between steps — ask user to re-import and retry.
- "Smart link creation failed (HTTP 404)" → the `assetId` doesn't exist or doesn't belong to the user. Re-run Step 2a and confirm the match.
- Auth error → STOP, point at `/mcp`.
- Unknown server error → surface the raw error, tell user: "create_smart_link returned `<error>`. This looks like a transient server issue — retry in ~2 minutes, or check Patchline status. Not proceeding to LAUNCH.md until I have a real URL."

**Do not proceed to Step 6 until `create_smart_link` returns a real `shareUrl`.**

### Why no separate verification call

The previous version of this skill called `analyze_url` on the returned smart-link URL to verify it resolves. That approach doesn't work — `analyze_url` only recognizes Spotify and YouTube URLs and returns `Unsupported URL` for `patchline.ai/s/<slug>`. The `create_smart_link` success response IS the verification: the server wouldn't have returned `shareId` + `shareUrl` without persisting the record. If the CDN is slow to propagate, that's a separate (rare) issue the user can manually retry by opening the URL.

## Step 6: Draft LAUNCH.md

Use the Write tool:

```markdown
# Launch: <project-name>

> Generated by `/aria:next` (smart-link skill) on YYYY-MM-DD · v1
> Lifecycle complete — all required phases shipped (audio-intake if the finished track existed at start, songwriting-brief only if writing was still in progress).
> Grounded in: `create_smart_link` (shareId <shareId>, returned <timestamp>), `get_asset` (assetId <assetId>, ISRC verified at <timestamp>), `add_artist` (<created new | reused existing> artistId <id>).

## The live smart link

**URL:** <shareUrl from Step 5>

**Share ID:** `<shareId>`

Use this URL everywhere — bio links, Instagram stories, email signatures, every pitch.

## Release specs at a glance

- **Artist:** <artistName from create_smart_link response>
- **Patchline artist ID:** `<artistId from Step 3>`
- **Track:** <trackName from create_smart_link response>
- **ISRC:** <from get_asset in Step 2>
- **Release date:** <from RELEASE_PLAN.md>
- **Distribution:** <self_releasing | with_label — label name if applicable>
- **Cover art:** <coverArt URL from get_asset, or "Patchline default placeholder — no cover art on asset">

**DSP links resolved by the smart link server (from ISRC via Soundcharts):**

<Enumerate every key in create_smart_link's platformLinks response. Example:>
- Spotify: <platformLinks.spotify | "not resolved">
- Apple Music: <platformLinks.appleMusic | "not resolved">
- Tidal: <platformLinks.tidal | "not resolved">
- YouTube Music: <platformLinks.youtubeMusic | "not resolved">
- SoundCloud: <platformLinks.soundcloud | "not resolved">
- Deezer: <platformLinks.deezer | "not resolved">

<platformCount from response> DSP links total. DSPs not yet listed will auto-populate on the smart link as Soundcharts indexes them post-distribution — re-run `/aria:smart-link` after a week to refresh if needed.

---

## Day-of-release checklist

Work this top-to-bottom on release day. Check items off as you go — the user's own copy of this file is the single source of truth.

### Socials (T-0 — release day, morning)

> Copy drafts below. Personalize tone for your voice before posting.

- [ ] **Instagram post** (feed + story)

  Post copy draft:
  > <Pull a 280-character-or-less launch-day caption from VISION.md's narrative + the artist's voice in BRIEF.md. Example for Vintage Culture: "midnight oil — out now. 2am pocket, deep. not for the main stage.">
  
  Story copy draft:
  > Link sticker → <shareUrl>
  > Caption: "out now" or pull from the IG post

- [ ] **Twitter/X post**
  
  Draft:
  > <120-character launch tweet. Drop the smart link. One line from VISION.md if it's punchy. Let the link do the work.>

- [ ] **TikTok post** (if applicable — check ROLLOUT.md for TikTok cadence)
  
  Draft:
  > <If ROLLOUT has a TikTok plan, reference it. If not, skip — don't fabricate a TikTok strategy.>

### Email list (T-0)

- [ ] Send release announcement to your email list

  Subject line drafts (pick one):
  > "<track title> is out"
  > "new music — <track title>"
  > "<artist name> / <track title>"
  
  Body:
  > Pull the artist-voice paragraph from VISION.md + the smart-link URL. Keep it under 100 words. One CTA: stream.
  
  If no mailing list exists, skip this item and note: "No email list yet — consider starting one before the next release. Beacons / Mailchimp / Substack all work."

### Playlist submissions (T-0 or the day after)

- [ ] Submit via Spotify for Artists (if self-releasing or you have access)
- [ ] Submit to each playlist in `PITCH_KIT.md` — pitches are already drafted per-playlist

  Pitch submission order (priority from RELEASE_PLAN.md):
  1. <Playlist name> — submission URL / email from PITCH_KIT.md (cross-reference the `#<playlist-id>` section)
  2. <Playlist name> — submission URL / email
  3. <Playlist name> — submission URL / email
  ... (list ALL playlists from PITCH_KIT.md, not just top 3 — cross-reference each by its section heading)

  **Remember:** plugin drafted these; you submit them. Personalize the voice if needed, but the tailoring is already in place.

### Distribution + label (T-0)

<If self_releasing:>
- [ ] Confirm distribution is live — check your distributor's dashboard (DistroKid, Symphonic, Stem, TuneCore, CD Baby)
- [ ] If DSP links aren't resolving yet on the smart link, wait 24–48h for Soundcharts to index the ISRC before panicking

<If with_label:>
- [ ] Notify label contact that the smart link is live — forward this smart-link URL + the PITCH_KIT.md
- [ ] Confirm label's distribution timeline aligns with your release date

### Press / outreach (T-0 to T+3 days)

- [ ] Send the press release (from PITCH_KIT.md) to target outlets
- [ ] Send cold-outreach emails (template in PITCH_KIT.md) to sync supervisors / journalists / A&R
- [ ] If you have a publicist, forward PITCH_KIT.md to them

---

## Monitoring (T+24h, T+72h, T+7d)

### T+24h check

- [ ] Re-run `mcp__aria__inspect_playlist` on top-3 priority playlists from PITCH_KIT.md — any adds yet?
- [ ] Check streaming numbers on your DSP dashboards (Spotify for Artists, Apple Music for Artists)
- [ ] Open `<shareUrl>` manually — confirm it loads and the DSP buttons all click through

### T+72h check

- [ ] Same as T+24h — track adds, streams, DSP link completeness
- [ ] If zero playlist pickups yet, that's still within normal range — editorial playlists often add on weekly refresh cycles (Monday / Friday)
- [ ] If smart link is missing DSPs that should exist (e.g. Spotify shows but Apple Music doesn't), Soundcharts is probably still indexing — re-run `/aria:smart-link` to refresh `platformLinks`

### T+7d check — "iterate or coast" decision

- [ ] Playlist pickup rate: calculate `playlists_added / playlists_pitched` from PITCH_KIT.md
- [ ] **If pickup rate is < 10%** (e.g. 0 of 7): consider re-running `/aria:pitch-kit` with revised positioning. The pitches might not be landing; reset and try again with a different angle from VISION.md.
- [ ] **If pickup rate is 10–30%**: normal for indie releases. Continue promoting through socials + outreach.
- [ ] **If pickup rate is > 30%**: strong launch. Double down — consider a follow-up push (remixes, alt versions, sync pitches).

### Streaming-monitoring note

The plugin's current MCP does not yet have `get_streaming_stats` or `get_playlist_pickup` (those are on the post-launch backlog as B1 / verify-phase). For now, monitor manually via:
- Spotify for Artists dashboard
- Patchline dashboard → Smart Links → `<shareId>` (for click analytics)
- Soundcharts (via your Patchline intelligence tools — `get_artist_intelligence` re-pulls metrics)

When the verify-phase MCP tools ship, Aria will do this automatically.

---

## What's in this release

| Artifact | Purpose | Edited? |
|---|---|---|
| `BRIEF.md` | Project intent, audience, north-star | <yes / no — you'll know> |
| `VISION.md` | Sonic identity, narrative positioning | <yes / no> |
| `MOODBOARD.md` | Reference tracks, audio features | <yes / no> |
| <if SONGWRITING.md exists:> `SONGWRITING.md` | Song-level direction | <yes / no> |
| `RELEASE_PLAN.md` | Schedule, playlist targets, DSP priorities | <yes / no> |
| `ROLLOUT.md` | Week-by-week calendar, content cadence | <yes / no> |
| `PITCH_KIT.md` | Per-playlist pitches + press release + email templates | <yes / no> |
| `LAUNCH.md` | This file — live smart link + day-of checklist | — |

All artifacts live in `.patchline/artifacts/`. They persist on disk. Post-PR-#468, they'll also sync to your Patchline Project container (see `Patchline persistence` in STATE.md).

---

## Next steps

### Immediate (this release cycle)
- Work the day-of-release checklist above
- Send the pitches in PITCH_KIT.md (plugin drafted; you submit)
- Monitor at T+24h / T+72h / T+7d

### Backlog / future cycles
- **B1 — Verify phase.** When the `get_streaming_stats` and `get_playlist_pickup` MCP tools ship (tracked under NT1 in the plugin requirements), Aria will add a 9th lifecycle phase that auto-pulls streaming metrics and playlist adds, generates a post-mortem report, and feeds learnings into the next project's VISION.md. Until then, monitoring is manual — see the Monitoring section above.
- **Run `/aria:start` for the next project.** The workspace is self-contained; each release gets its own `.patchline/` directory. Your artist intelligence + roster persist in Patchline; you just start a fresh workspace per project.
- **Re-run a phase.** If something in this release didn't land (e.g. weak playlist pickup), hand-edit STATE.md — remove the phase from `Completed phases:`, set `Current phase: <phase>`, then `/aria:next`.

---

## Data sources

- `get_asset(assetId: <id>)`: returned at <timestamp> — ISRC verified, title `<title>`, cover art `<url or null>`
- `add_artist(artist_url: <spotify-url>)`: <created new | reused existing> — `artistId: <id>`, Soundcharts enrichment `<will run | skipped>`, fetched <timestamp>
- `create_smart_link(assetId: <id><, title: <override>>)`: `shareId: <id>`, `shareUrl: <url>`, `platformCount: <N>`, returned at <timestamp>
- Upstream artifacts: BRIEF (dated X), VISION (dated X), MOODBOARD (dated X), <SONGWRITING (dated X) if present>, RELEASE_PLAN (dated X), ROLLOUT (dated X), PITCH_KIT (dated X)

---

*This file is the operational deliverable. Edit by hand; the checklist is yours. Re-run `/aria:smart-link` to refresh the smart link's DSP coverage (same `shareUrl`, updated `platformLinks`) as Soundcharts indexes more DSPs post-distribution.*
```

### Grounding-quality checklist (self-check before writing)

- [ ] The smart-link URL field is the REAL `shareUrl` returned by `create_smart_link` — no `<URL will go here>`, no `patchline.ai/s/TBD`, no placeholder
- [ ] `get_asset` actually ran and the asset's ISRC is present — timestamp recorded
- [ ] DSP links in the Release specs section come from `platformLinks` in the tool response — not fabricated, not pulled from prior interview answers
- [ ] Cover art field reflects the asset's `coverArt` URL (or the default placeholder note if null) — not made up
- [ ] The playlist-submission list in the checklist enumerates EVERY playlist from PITCH_KIT.md, cross-referenced by section heading
- [ ] Social copy drafts pull voice from VISION.md — not generic "Excited to announce my new track!"
- [ ] The Monitoring section cites Soundcharts/Spotify for Artists as the current manual-check mechanism AND mentions that verify-phase tooling is post-launch backlog
- [ ] `Data sources` section reflects the tools you actually called, with their real arg shapes (`artist_url`, `assetId`)

If any check fails, fix before writing.

## Step 7: Update STATE.md (append-only — do NOT write `Current phase:`)

Use Edit on `.patchline/STATE.md`. **Append-only edits.** Authority split: only `next` writes `Current phase:`. Phase skills — including this final lifecycle phase — append to `Completed phases:` + `Artifacts:` only.

When the user next runs `/aria:next`, the router walks the chain, sees all phases are in `Completed phases:`, writes `Current phase: complete` itself, and tells the user the lifecycle is done. This keeps the single-writer rule intact.

- `## Completed phases` → APPEND one bullet. Do not touch earlier bullets.

  ```
  - smart-link — completed YYYY-MM-DD, artifact: LAUNCH.md (live URL: <shareUrl>)
  ```

- `## Artifacts` → APPEND one bullet. Do not touch earlier bullets.

  ```
  - LAUNCH.md (smart-link phase, generated YYYY-MM-DD)
  ```

- Add a new section at the bottom (before the `Last updated:` footer):

  ```markdown
  ## Next steps
  
  - Lifecycle complete for this project.
  - B1 — Verify phase: pending upstream MCP tools (`get_streaming_stats`, `get_playlist_pickup`). Monitoring currently manual — see LAUNCH.md.
  - To start a new project: `/aria:start` in a fresh directory (each project has its own `.patchline/`).
  ```

- Update the footer: `Last updated: YYYY-MM-DD by /aria:next (smart-link skill) — lifecycle complete`

## Step 8: Hand off

Tell the user — ≤4 sentences:

> Launch doc written to `.patchline/artifacts/LAUNCH.md`. Your live smart link is **<shareUrl>** — `<platformCount>` DSP links auto-resolved by the server. The file has your day-of-release checklist (socials, email, playlist pitches from PITCH_KIT.md, label notification) plus T+24h / T+72h / T+7d monitoring pointers. Aria lifecycle complete for this project — good luck, ship it.

## Error handling

- **STATE.md shows a different current phase** → STOP, Step 1.
- **LAUNCH.md already exists** → ask overwrite vs. refine, warn about orphaned slug on re-create.
- **Any upstream artifact missing** → STOP, point at the right phase.
- **Focus track not found in catalog (Step 2a)** → STOP, point user at import/distribution step.
- **Focus track has no ISRC (Step 2b)** → STOP, point user at distributor to get an ISRC assigned.
- **PROJECT.md missing Spotify artist URL (Step 3)** → STOP, ask user to hand-edit PROJECT.md.
- **`add_artist` auth error** → STOP, point at `/mcp`.
- **`add_artist` URL-parse error** → point user at PROJECT.md to fix the URL.
- **`create_smart_link` returns any error** → STOP, do NOT produce LAUNCH.md. The hard rule.
- **MCP returns tool-not-found for `create_smart_link`** → the deployed MCP version doesn't have this tool yet. STOP: "The `create_smart_link` MCP tool isn't available in your current MCP deployment. Check the plugin's TROUBLESHOOTING.md for the minimum MCP version required, or wait for the next Patchline deployment."

## Examples

### Happy path — self-releasing, track has ISRC

```
User: /aria:next
You (reads all artifacts; catalog_search fallback finds focus assetId
     asset_abc123; get_asset returns ISRC USABC2526001, coverArt set;
     add_artist with artist_url from PROJECT.md — returns existing
     artistId a4b8a4d8; asks 1 question via AskUserQuestion):
  Smart link will be for "Midnight Oil" by Vintage Culture. Use the
  track title as the display name, or override it?
  
  [Options: "Use track title" | "Custom title"]

User: Use track title

You (calls create_smart_link({ assetId: "asset_abc123" }) — returns
     shareUrl https://patchline.ai/s/midnight-oil, 6 platformLinks
     populated):
  Smart link live: https://patchline.ai/s/midnight-oil — 6 DSPs resolved.
  Writing LAUNCH.md...

You:
  Launch doc written to .patchline/artifacts/LAUNCH.md. Your live smart
  link is https://patchline.ai/s/midnight-oil — 6 DSP links auto-resolved
  by the server. The file has your day-of-release checklist (socials,
  email, playlist pitches from PITCH_KIT.md, label notification) plus
  T+24h / T+72h / T+7d monitoring pointers. Aria lifecycle complete —
  good luck, ship it.
```

### Missing ISRC (hard stop)

```
You (get_asset returns { ..., isrc: null, ... }):
  Your focus track doesn't have an ISRC registered in Patchline's catalog.
  The smart link server needs an ISRC to resolve DSP links via Soundcharts.
  
  Upload/distribute this track through your distributor (DistroKid,
  Symphonic, Stem, TuneCore) so an ISRC is assigned, then re-run
  `/aria:smart-link`. If you already distributed, re-import the asset in
  the Patchline dashboard to refresh the ISRC.
  
  Not proceeding to create_smart_link until the asset has an ISRC.
```

### Title override

```
You (AskUserQuestion → Custom title → follow-up):
  What should the smart-link display name be?
User: Midnight Oil (Deluxe)
You (calls create_smart_link({ assetId: "asset_abc123", title: "Midnight
     Oil (Deluxe)" }) — returns shareUrl https://patchline.ai/s/midnight-oil-deluxe):
  Smart link live: https://patchline.ai/s/midnight-oil-deluxe
  (continues)
```

### create_smart_link errored (hard stop)

```
You (create_smart_link returns "Smart link creation failed (HTTP 500)"):
  create_smart_link returned a server error — I'm NOT generating LAUNCH.md
  with a fake URL. This looks like a transient Patchline issue.

  Options:
    (a) Retry in ~2 minutes — /aria:next again
    (b) Check Patchline status at patchline.ai/status
    (c) Create the smart link manually via the Patchline dashboard, then
        re-invoke /aria:smart-link — I'll pick up from the LAUNCH.md
        drafting step using the manual URL

  Not proceeding to LAUNCH.md until I have a real URL.
```

### Missing Spotify artist URL in PROJECT.md

```
You (reads PROJECT.md — no Spotify artist URL captured):
  PROJECT.md doesn't have a Spotify artist URL captured — add_artist
  requires a platform URL (name-only is rejected because artist names
  are ambiguous). Hand-edit PROJECT.md to add the line:
  
    Spotify artist URL: https://open.spotify.com/artist/<id>
  
  Then re-invoke `/aria:next`. You can find the URL from any of the
  artist's Spotify pages — it's the canonical identity anchor.
```

## Common mistakes (don't make these)

- **Producing LAUNCH.md with a placeholder URL when `create_smart_link` failed.** This is THE failure mode. The hard rule exists because an artist will copy-paste "patchline.ai/s/TBD" into their bio and the release goes dead on arrival. STOP when create_smart_link errors. Do not produce the deliverable.
- **Passing legacy arg names to `create_smart_link`.** The tool accepts ONLY `assetId` (required) and `title` (optional). It does NOT accept `artist_id`, `artist_name`, `track_title`, `track_isrc`, `cover_art_url`, `dsp_urls`, `release_date`, or `distribution_mode`. The server resolves all of those from the asset record. Passing extra args will fail schema validation.
- **Passing a DSP URL as `artist_url` to `add_artist`.** The field is `artist_url`, not `spotify_url`. And it must be an ARTIST URL (`spotify.com/artist/...`), not a track URL (`spotify.com/track/...`) — the handler rejects track URLs to avoid the wrong-artist trap.
- **Calling `analyze_url` on the returned smart-link URL to verify.** `analyze_url` only recognizes Spotify and YouTube URLs and returns `Unsupported URL` for `patchline.ai/s/<slug>`. The `create_smart_link` success response IS the verification.
- **Calling `add_artist` non-idempotently.** The tool IS idempotent; trust it. If the artist already exists, it returns the existing `artistId`. Don't "check first" with `search_artists` — that's an extra call for no gain. (This is DIFFERENT from the `start` skill's `search_artists` use, which is for bootstrap identification.)
- **Fabricating DSP URLs.** The DSP links in LAUNCH.md come from `create_smart_link`'s `platformLinks` response. Never copy them from prior workspace artifacts or invent them.
- **Skipping the Step 2b ISRC check.** The server will reject `create_smart_link` if the asset has no ISRC — catching it here with a clear message is better UX than surfacing a generic 400 from the server.
- **Copy-pasting PITCH_KIT.md's entire content into LAUNCH.md.** The checklist REFERENCES PITCH_KIT.md by section ID. It doesn't duplicate the pitches. Cross-reference, don't bloat.
- **Writing a social-post draft that sounds like AI.** Pull voice from VISION.md's narrative section. "Excited to announce" is a red flag. Use the artist's actual phrasing.
- **Claiming the user's pitches were sent.** Per CLAUDE.md. The checklist says "submit" — not "sent". The plugin drafts; the user delivers.
- **Skipping the STATE.md `Next steps` section on completion.** This is how the user knows there's a verify-phase backlog and what to do between cycles. Don't drop it.
- **Writing social-post drafts for platforms the user never mentioned.** If ROLLOUT.md doesn't have a TikTok plan, don't fabricate a TikTok post. Only platforms that have actual ROLLOUT context get drafts.
- **Rewriting STATE.md sections instead of appending.** Every STATE edit is append-only on `Completed phases:` and `Artifacts:` bullet lists — never rewrite existing bullets. Only `next` writes `Current phase:`; phase skills (including this one) leave it alone. The `Last updated:` footer is the one line this skill replaces.
- **Forgetting to update PROJECT.md's `Patchline artist ID:` after `add_artist` creates a new record.** That ID is load-bearing for downstream Patchline dashboard lookups.
