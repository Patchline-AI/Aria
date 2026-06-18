---
name: pitch
description: "Pitch a track. Find the song in the catalog, ground it in real intelligence and real playlist data, draft a sendable pitch, and create a shareable curator pitch link. Use when the user says \"pitch my track\", \"write a pitch for <song>\", \"help me get on playlists\", \"draft a curator pitch\", or \"make a pitch link for <song>\". MCP-grounded: catalog_search/get_asset -> get_song_intelligence + get_artist_intelligence + find_playlists/inspect_playlist -> generate_pitch -> create_pitch_link. No invented playlists, curators, or metrics."
argument-hint: "[optional track title or catalog assetId, or a target playlist URL]"
model: claude-sonnet-4-6
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
  - aria
---

## Your task

Turn one catalog track into a sendable, grounded pitch — and optionally a public curator pitch link the user can send. The flow:

1. **Find the track** in the catalog (`catalog_search` → `get_asset`) to get a real `assetId`.
2. **Ground it** — `get_song_intelligence` (streams, playlists, charts, tags), `get_artist_intelligence` (career stage, metrics, bio), and `find_playlists` + `inspect_playlist` for real playlist targets.
3. **Generate the pitch** via `generate_pitch`, passing the real `assetId` and (when known) the target playlist — so it's grounded in the actual track, not a template.
4. **Create a pitch link** with `create_pitch_link` if the user wants something shareable.

The discipline carried over from the old pitch-kit: **every playlist fact comes from `find_playlists` / `inspect_playlist`. No invented curators, no fabricated follower counts, no hand-written pitches replacing the tool output.** A pitch built on a hallucinated curator gets deleted on sight.

## Supporting files

- [`../../CLAUDE.md`](../../CLAUDE.md) — voice, grounding rules, "the plugin drafts pitches; the user submits them," never surface internal provider names.

## Step 1: Find the track

If the user gave a catalog `assetId`, use it directly. Otherwise call `mcp__aria__catalog_search` with `{ query: "<track title> <artist>" }` and take the top hit's `id` as the `assetId`. Confirm with the user if multiple close matches come back.

If `catalog_search` returns nothing:

> "I can't find that track in your catalog. Pitches are grounded in a real catalog track. Either drop it first (say 'drop my single' to upload + analyze), or paste the exact title. If it's released elsewhere, import it by URL."

Then call `mcp__aria__get_asset` with `{ assetId }` to capture `title`, `artist`, `isrc`, and readiness. If `get_asset` is an error, surface it and stop.

## Step 2: Ground the track and artist

Call these to anchor the pitch in real data — they're the difference between a sendable pitch and filler:

- `mcp__aria__get_song_intelligence` with `{ assetId }` → current metrics, existing playlist/chart placements, tags, attribution warnings. If it returns `{ available: false, code: "SONG_NOT_FOUND" }`, the track has no song-level intelligence yet (normal for brand-new uploads) — note it and lean on artist intelligence + audio tags instead. Don't fabricate streams.
- `mcp__aria__get_artist_intelligence` with `{ artist_name }` (or `artistId`) → career stage, genres, monthly listeners, cached bio. If `found: false`, the artist isn't enriched yet — say so; don't invent metrics.

## Step 3: Ground the playlist targets

If the user named or pasted a target playlist, inspect it directly. Otherwise discover matches:

- `mcp__aria__find_playlists` with `{ assetId }` → ranked playlists with real match scores, follower counts, and types (uses the track's audio features + genre).
- For the top 1–3 the user wants to pitch, re-pull each fresh with `mcp__aria__inspect_playlist` (`{ playlist_url: "<spotify URL or 22-char ID>" }`) → current followers, 30-day adds, most-repeated artists, refresh cadence, curator network. This is what makes the pitch specific: cite *this week's* adds, not stale data.

If the user is pitching many playlists, use AskUserQuestion to let them pick the top few — `inspect_playlist` is one call each, so don't run ten by default. If a playlist won't `inspect_playlist`-resolve (delisted/private/regional), say it's unreachable and skip it — don't pitch to a ghost.

## Step 4: Generate the pitch

Call `mcp__aria__generate_pitch` with the **real** arguments — match the contract exactly; extra/invented args are silently dropped at the boundary:

```
generate_pitch(
  artist_name: "<from get_asset>",        // REQUIRED
  assetId: "<from Step 1>",               // grounds the pitch in the real catalog track — pass it
  track_name: "<track title>",            // optional
  target_playlist: "<playlist name>",     // optional — the playlist NAME string
  playlistUrl: "<spotify playlist URL>",  // optional — lets the tool inspect the target itself
)
```

The tool returns a grounded pitch (≈120–180 words) using the shared evidence ledger over catalog/artist/audio/song data. Capture it **verbatim** as the base pitch — it already used real data server-side; don't rewrite it for "polish."

If metrics are sparse and the tool needs it, you may pass `mode: "cold_start"` with `verified_context` containing **only verified facts** (real BPM/key from `get_audio_features`, real career stage) — never invented numbers.

If you want to add per-playlist context, stitch a short tail from `inspect_playlist` output (real 30-day adds, real most-repeated artists, real follower count) — every number must trace to the API response. Label it clearly as context vs. the base pitch.

If `generate_pitch` returns `isError` (supervisor timeout, no response), surface it with the next step ("retry in a moment") — do NOT write a Claude-authored pitch and pass it off as the grounded one.

## Step 5: Create a pitch link (if the user wants it shareable)

If the user wants a link to send a curator, call `mcp__aria__create_pitch_link`. Required fields:

```
create_pitch_link(
  trackAssetId: "<assetId>",          // REQUIRED
  trackName: "<track title>",         // REQUIRED
  artistName: "<artist>",             // REQUIRED
  targetCuratorName: "<curator/playlist contact>",  // REQUIRED
  pitchCopy: "<the generated pitch>", // REQUIRED — use the generate_pitch output
  targetPlaylist: "<playlist name>",  // optional
  fitRationale: "<why this track fits, from inspect_playlist data>",  // optional
  expiresInDays: 14,                  // optional, default 14, max 30
)
```

Capture the returned `shareUrl`. If `create_pitch_link` errors, surface it and still hand back the drafted pitch text — the copy is useful even without the link.

> Per CLAUDE.md: you drafted the pitch and (optionally) a link. **You did not submit it.** Direct-submit isn't an MCP capability. Say "ready to send" / "drafted," never "submitted."

## Step 6: Report

Tell the user, ≤4 sentences:

> Pitch drafted for **<track>** by **<artist>**, grounded in <real song/artist intelligence + N inspected playlists>. <If link: "Shareable curator pitch link: **<shareUrl>** (expires in <N> days).">. Paste the copy into Spotify for Artists or your curator email — you submit it, I drafted it. <If a playlist was unreachable: name it and suggest re-running find_playlists.>

Generate a `PITCH.md` artifact only if the user asks for a file.

## Error handling

- **Track not in catalog** → point to drop/import (Step 1).
- **`get_song_intelligence` SONG_NOT_FOUND** → normal for new tracks; ground on artist intelligence + audio tags, disclose the gap.
- **`get_artist_intelligence` found:false** → artist not enriched; don't invent metrics.
- **Playlist won't inspect_playlist-resolve** → mark unreachable, skip, suggest find_playlists for replacements.
- **`generate_pitch` error** → surface it; never substitute a hand-written pitch as the grounded one.
- **`create_pitch_link` error** → surface it, still return the drafted copy.
- **MCP auth expired** → "Run `/mcp`, reconnect `plugin:aria:aria`, try again."

## Common mistakes

- **Inventing curators, follower counts, or recent adds.** Every playlist fact traces to `find_playlists` / `inspect_playlist`. If the tool didn't return a curator name, omit the curator clause — don't make one up.
- **Passing invented args to `generate_pitch`.** It takes `artist_name` (required), `assetId`, `track_name`, `target_playlist`, `platform`, `playlistUrl`, `mode`, `verified_context`. Things like `playlist_curator`, `reference_artists`, `artist_positioning` are silently stripped — the pitch comes out the same as if you hadn't passed them.
- **Skipping `assetId` on `generate_pitch`** when you have it — that's what grounds the pitch in the real track.
- **Rewriting the base pitch for tone.** It used real evidence server-side. Add a context tail or let the user hand-edit; don't overwrite the grounded core.
- **Claiming the pitch was submitted.** The plugin drafts; the user submits.
- **Running `inspect_playlist` on ten playlists by default** — it's one call each; let the user pick the top few.
- **Surfacing the streaming-intelligence provider name** to the user.
