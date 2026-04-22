---
name: pitch-kit
description: "Seventh lifecycle phase. Produces PITCH_KIT.md — one pitch per priority playlist target plus a short bio, a press-release template, and a cold-outreach email template. Every pitch is grounded in real MCP output: `inspect_playlist` (re-pulled fresh per playlist — curators churn), `generate_pitch` (the real 3-arg tool), `get_bio`, and `get_work_metadata`. Use when STATE.md shows pitch-kit as the next incomplete phase. Typically invoked via `/aria:next` after rollout."
argument-hint: "[optional — no arguments expected; reads context from .patchline/]"
model: claude-opus-4-7
prerequisites:
  - rollout
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - AskUserQuestion
  - aria
---

## Your Task

Produce `.patchline/artifacts/PITCH_KIT.md` — the single most load-bearing creative artifact in the Aria lifecycle. This is what the artist will copy-paste into Spotify's submission form, into emails to curators, into DMs to sync supervisors. Generic, template-feeling pitches get deleted on sight. Tailored pitches — ones that cite the playlist's actual recent adds, name-drop its curator's sensibility, and position the track against what's already there — get listened to.

You will:

1. Read every prior artifact (BRIEF, VISION, MOODBOARD, RELEASE_PLAN)
2. Extract the priority playlist targets from RELEASE_PLAN.md (stored as Spotify URLs / IDs, not internal playlist UUIDs)
3. Confirm the target list with the user via AskUserQuestion if the plan has more than 5 — let them narrow
4. For EACH chosen playlist, re-pull its current state via `inspect_playlist(playlist_url: <spotify URL>)`
5. Call `generate_pitch(artist_name, track_name, target_playlist)` — the REAL 3-arg tool — to get a base pitch, then enrich it in-session with the playlist-specific context from `inspect_playlist` output
6. Pull the artist bio (`get_bio`) and the focus track's work metadata (`get_work_metadata`)
7. Assemble `PITCH_KIT.md` with: per-playlist pitches (base + enrichment), short bio, press-release template, cold-outreach email template
8. Append `pitch-kit` to STATE.md's `Completed phases:` (append-only — do NOT overwrite `Current phase:`; the router owns that)

**The hard rule (R7 grounding):** every playlist subsection MUST come from live `inspect_playlist` output, and every pitch MUST start from live `generate_pitch` output. No invented curators. No fabricated follower counts. No hand-written pitches. If a playlist in RELEASE_PLAN.md no longer inspect-resolves (delisted, private, regional), mark it **Unreachable** and skip — do not pitch to a ghost.

## Supporting files

- [`../../CLAUDE.md`](../../CLAUDE.md) — voice, MCP grounding rules, "never claim pitches were submitted"
- [`../../reference/state-schema.md`](../../reference/state-schema.md) — STATE.md contract (append-only semantics)

## Real tool signatures (this is the whole point — match these exactly)

The current implementation under `lib/mcp/tools/` accepts these arguments. Anything else is silently stripped by Zod at the MCP boundary — extra args do NOT get forwarded to the underlying service. Match these exactly:

### `mcp__aria__generate_pitch`

```
generate_pitch(
  artist_name: string,         // REQUIRED
  track_name?: string,         // optional — the track you're pitching
  target_playlist?: string,    // optional — the playlist NAME as a string (e.g. "Night Rider")
)
```

Returns: a pitch draft (usually 120–180 words) as plain text. The server-side call uses real streaming intelligence (streams, audience demographics, genre) to ground the pitch.

**That's it.** Three string args. There is NO `playlist_id`, NO `playlist_curator`, NO `playlist_vibe_profile`, NO `reference_artists`, NO `artist_positioning` argument. Prior versions of this skill pretended those existed — they were silently dropped. Don't pass them.

### `mcp__aria__inspect_playlist`

```
inspect_playlist(
  playlist_url: string,              // REQUIRED — Spotify URL OR bare 22-char Spotify playlist ID
  include_tracks?: boolean,          // default true
  include_curator_network?: boolean, // default true
)
```

Accepts a Spotify playlist URL like `https://open.spotify.com/playlist/37i9dQZF1DX...` or a bare 22-character Spotify playlist ID. **Not an internal playlist UUID.** RELEASE_PLAN.md stores Spotify URLs / IDs in its playlist-targets tables; forward those directly.

Returns: `{ spotifyId, playlist: { name, type, followers, growthSummary, refreshed, typeLabel, ... }, trackSnapshot: { visible tracks, 30-day adds, unique artists, most-repeated artists }, curatorNetwork: { sibling playlists, combined follower reach }, _raw: {...} }`.

### `mcp__aria__get_bio`

```
get_bio(artist_name: string)
```

Returns the cached AI-generated bio from artist intelligence, or an error with next steps (usually "call add_artist first, then enrichment generates the bio"). This tool does NOT synthesize a new bio on demand.

### `mcp__aria__get_work_metadata`

```
get_work_metadata(
  spotifyId?: string,
  spotifyTrackUrl?: string,  // URL — extracted to spotifyId
  isrc?: string,
  songName?: string,
  artistName?: string,
)
```

At least one identifier required. Returns `{ workUuid, workName, iswc, writers[], publishers[] }`. Preferred order: `spotifyId`/`spotifyTrackUrl` (most accurate) → `isrc` → `songName`+`artistName`.

## Step 1: Read workspace context

Use Read on (stop at first miss — missing upstream is a blocker):

- `.patchline/PROJECT.md` — artist name, project name, Patchline artist ID, distribution mode
- `.patchline/STATE.md` — confirm `pitch-kit` is the next incomplete phase (not already in `Completed phases:`, and no phase after it already complete). If not, STOP: "STATE.md doesn't point at pitch-kit — it's at `<X>`. Run `/aria:next` to pick the right phase, or hand-edit STATE.md if this is intentional."
- `.patchline/artifacts/BRIEF.md` — north-star metric, non-negotiables, audience
- `.patchline/artifacts/VISION.md` — sonic identity, reference artists, the artist's-own-words narrative paragraph (the heart of every pitch's enrichment block)
- `.patchline/artifacts/MOODBOARD.md` — actual catalog tracks + track-analysis features (the BPM / energy / mood zone to cite)
- `.patchline/artifacts/RELEASE_PLAN.md` — focus track + ISRC (or Spotify track URL), release date, priority playlist targets with Spotify URLs / IDs, focus DSPs
- `.patchline/artifacts/PITCH_KIT.md` — if it ALREADY exists, ask the user: "A PITCH_KIT.md already exists. Overwrite (re-pull every playlist, regenerate every pitch), or refine in place?" Hand-edits to pitches are valuable — don't clobber them silently.

If `RELEASE_PLAN.md` is missing, STOP: "pitch-kit requires RELEASE_PLAN.md — it's the source of the playlist targets. Run `/aria:next` to hit release-plan first, or restore the file from git."

## Step 2: Extract the priority playlist targets from RELEASE_PLAN.md

Parse RELEASE_PLAN.md's playlist-targets tables (Tier 1 editorial + Tier 2 curated + Tier 3 indie). You're looking for:

- The playlist NAME (e.g. "Night Rider") — string, goes to `generate_pitch`'s `target_playlist` arg
- The playlist's **Spotify URL or 22-char Spotify playlist ID** — goes to `inspect_playlist`'s `playlist_url` arg. RELEASE_PLAN.md's table should have this in the platform / link columns or an inline URL.
- The platform (usually Spotify — other platforms can't currently be inspected via this tool)
- The focus track title + ISRC from the "Release metadata" section of RELEASE_PLAN.md

**If the target row has no Spotify URL / ID** — common if RELEASE_PLAN.md was written before this tool-contract cleanup — you cannot inspect that playlist. Options:

(a) skip it and note it in the "Unreachable" section with reason `no Spotify URL in RELEASE_PLAN.md — re-run /aria:release-plan to refresh targets`, or
(b) ask the user if they want to provide a URL inline.

Pick (a) if the plan was generated recently and Spotify URLs are simply missing from a few rows. Pick (b) only if the user explicitly offers to hand-fill.

### If the plan has fewer than 3 playlist targets

Surface to the user: "RELEASE_PLAN.md only lists `<N>` playlist targets. pitch-kit works best with 5–10. Options: (a) proceed with what's there, (b) jump back to release-plan and use `find_playlists` to expand. Which?" Wait before continuing.

### If the plan has more than 5 playlist targets

Use `AskUserQuestion` to let the user narrow down. The skill is O(N) in MCP calls per playlist — running 10 playlists means ~10 inspect_playlist + ~10 generate_pitch calls, which is expensive and slow. Give the user the choice:

```
AskUserQuestion(
  questions: [
    {
      header: "Playlist targets",
      question: "Which playlists should I write pitches for? (Top targets from RELEASE_PLAN.md)",
      multiSelect: true,
      options: [
        { label: "<Playlist 1>", description: "<tier> · <curator> · <followers> followers" },
        { label: "<Playlist 2>", description: "..." },
        // ... up to 10, in the order RELEASE_PLAN.md ranks them
        { label: "All of them", description: "I have time — pitch all <N>" },
      ],
    },
  ],
)
```

If the user picks "All of them", process every target. Otherwise process only the selected list. Default to the top 5 if the user declines to answer.

## Step 3: Ask about bio tone

The short bio in PITCH_KIT.md appears in every pitch submission and in the press release. Tone matters and is genuinely subjective. Ask once:

```
AskUserQuestion(
  questions: [
    {
      header: "Bio tone",
      question: "What tone should the 120-word bio use?",
      multiSelect: false,
      options: [
        { label: "Third-person formal", description: "Standard press bio. '<Artist> is a <genre> producer based in <city>...' Best for submissions, A&R, journalists." },
        { label: "First-person", description: "'I make house music that lives at 2am...' Best for direct pitches to curators who respond to artist voice." },
        { label: "Narrative", description: "Opens with a scene or moment instead of facts. Best for feature pieces and sync pitches." },
      ],
    },
  ],
)
```

Capture the choice — you'll apply it in Step 5.

## Step 4: Ground the artist data (pre-loop)

Call these BEFORE the per-playlist loop — you'll reuse the results across every pitch.

### `mcp__aria__get_bio`

Pass `artist_name` (from PROJECT.md). Cases:

- **Cached bio returned** → extract the 2–3 most load-bearing sentences. If it's already ≤ 120 words and reads naturally in the chosen tone, use it verbatim in Step 5. If it's longer, compress — keep the facts, trim adjectives.
- **"No artist intelligence cached" / "no bio yet" error** → the tool won't synthesize a fresh bio. You'll write one inline in Step 5 using PROJECT.md + VISION.md + MOODBOARD.md + BRIEF.md. Flag this in the data-sources section: `Bio: no cached bio — generated fresh in-session from PROJECT.md + VISION.md + BRIEF.md`.
- **Auth error** → STOP and tell the user: "Patchline MCP returned an auth error. Run `/mcp` in Claude Code to reconnect, then re-invoke `/aria:next`."

### `mcp__aria__get_work_metadata`

Pass the focus track identifier in this priority order:

1. If RELEASE_PLAN.md has a Spotify track URL for the focus track → `spotifyTrackUrl: "<url>"`
2. Else if RELEASE_PLAN.md has a Spotify track ID → `spotifyId: "<id>"`
3. Else if RELEASE_PLAN.md has an ISRC → `isrc: "<isrc>"`
4. Else → `songName: "<focus track title>"`, `artistName: "<artist name>"`

Returns `{ workUuid, workName, iswc, writers: [{ uuid, name, role }], publishers: [{ uuid, name, share, adminPublisher }] }`.

Cases:

- **Resolved** → capture `iswc`, `writers[]`, `publishers[]` for the press release's "Writers / co-writers" and "Publisher" fields.
- **Error ("Could not resolve composition data for ...")** → normal for unreleased tracks. Streaming intelligence may not index works until the song is distributed. Use `[TBD at distribution]` placeholders in the press release. Flag in data-sources: `Work metadata for <track>: not indexed yet (typical for pre-release), placeholders used.`
- **Auth error** → same STOP path as above.

**Do NOT fabricate an ISRC, ISWC, writer name, or publisher.** `[TBD at distribution]` is a perfectly professional placeholder; a made-up code that fails at distribution time is a real problem.

## Step 5: Per-playlist deep loop (the expensive core)

For EACH priority playlist from Step 2, run this sub-pipeline. This is the heart of the skill — do not shortcut it.

### 5a. Re-pull the playlist fresh

Call `mcp__aria__inspect_playlist(playlist_url: "<spotify URL from RELEASE_PLAN.md>", include_tracks: true, include_curator_network: true)`.

You're re-pulling because:

- Curator changes (third-party playlists change ownership monthly)
- Follower counts drift
- 30-day track adds rotate weekly — they signal what the curator is actually into THIS week, which is the context your pitch leans into
- Refresh cadence can shift (a weekly-refresh playlist can become monthly)

The tool returns:

- `spotifyId` — the extracted Spotify playlist ID
- `playlist.name`, `playlist.type`, `playlist.followers`, `playlist.typeLabel` (editorial / curated / algorithmic), `playlist.growthSummary`, `playlist.refreshed`, `playlist.trackAge` (new-lean vs catalog-lean)
- `trackSnapshot.visibleTracks[]`, `trackSnapshot.last30DaysAdds`, `trackSnapshot.uniqueArtists`, `trackSnapshot.mostRepeatedArtists[]`
- `curatorNetwork.siblingPlaylists[]` (other playlists run by the same curator), `curatorNetwork.combinedFollowerReach`
- `_raw` — the full Lambda payload (use if you need a field the normalized surface omitted)

### 5b. Ghost-playlist check

If `inspect_playlist` returns an error (statusCode != 200, "not found in the Patchline playlist inventory", `isError: true`, or empty `playlist` object):

- Record the playlist name + the failure reason
- Do NOT call `generate_pitch` for it (no point pitching to a playlist you can't verify exists)
- Continue to the next playlist in the loop

These ghost playlists go in a dedicated "Unreachable playlists" section of PITCH_KIT.md (Step 6). Do not silently drop them — the user needs to know which RELEASE_PLAN.md targets are no longer reachable so they can re-run `/aria:release-plan` to find replacements.

### 5c. Generate the base pitch (real 3-arg call)

Call `mcp__aria__generate_pitch` with EXACTLY three arguments:

```
generate_pitch(
  artist_name: "<from PROJECT.md>",
  track_name: "<focus track title from RELEASE_PLAN.md>",
  target_playlist: "<playlist NAME string from inspect_playlist's playlist.name>",
)
```

The tool returns a pitch draft (usually 120–180 words). Capture it verbatim as the **base pitch**. This is the MCP-grounded core — it uses real streaming/demographic data server-side.

**Do not invent extra arguments.** There is no `playlist_id`, `playlist_curator`, `artist_positioning`, `reference_artists`, or `playlist_vibe_profile` parameter. Passing them silently fails — the Zod schema drops them and the tool runs as if only the 3 real args were supplied. Earlier versions of this skill misled callers by pretending otherwise; every pitch in the wild that was supposedly "tailored" via those fields was actually just the base 3-arg pitch with the extra args dropped on the floor.

### 5d. Enrich the base pitch with playlist-specific context (Claude-stitching, MCP-grounded)

`generate_pitch` is LESS customizable than a long-form, per-playlist pitch needs to be. To compensate honestly, Claude writes a **second paragraph / context block** that stitches in playlist-specific context from the **real** `inspect_playlist` output — not fabrication. Every fact in the enrichment block must trace to either `inspect_playlist` or an upstream artifact.

Enrichment block template (adapt phrasing per playlist — don't copy-paste):

> Context: fits [**Playlist Name**]'s [**playlist.typeLabel / trackAge lean**] pocket — [N] 30-day adds including [1–2 most-repeated artists from trackSnapshot.mostRepeatedArtists OR 1–2 recent additions from trackSnapshot.visibleTracks]. [Sonic tie from MOODBOARD.md audio features or VISION.md narrative — e.g. "120 BPM, deep-club energy" matches "track's 120-BPM claustrophobic pocket"]. Curator [curator name from playlist object, if present] runs [N] sibling playlists on the same aesthetic ([curatorNetwork.combinedFollowerReach] combined follower reach).

**Rules for the enrichment block:**

- **Every number** (follower count, 30-day adds, sibling count, combined reach) comes from `inspect_playlist` output
- **Every cited recent-add track or artist** comes from `trackSnapshot.visibleTracks` or `trackSnapshot.mostRepeatedArtists` — NOT from training-data memory
- **Sonic-tie language** (BPM, energy, mood) references MOODBOARD.md's track-analysis features OR VISION.md's narrative — NOT invented
- If `inspect_playlist` didn't return a field (e.g. no curator named on an editorial playlist), don't fabricate it — just omit that clause
- Length: 2–4 sentences MAX. The base pitch from `generate_pitch` is the main content; the enrichment is a grounding tail

In PITCH_KIT.md, clearly label which part is which — see the Step 6 template.

### 5e. Record per-playlist

For each playlist you now have:

- Playlist name, typeLabel (editorial / curated / indie), follower count, refresh cadence, trackAge lean
- 30-day add count, 2–3 most-repeated-artist names, 1–2 recent-add highlights
- Curator name + sibling-playlist count + combined reach (if available)
- **Base pitch** — verbatim from `generate_pitch`
- **Enrichment block** — Claude-stitched from `inspect_playlist` + upstream artifacts
- Submission route: extract from `playlist._raw` if present; else default to "Spotify For Artists pitch form" for editorial, "DM curator / submission form" for curated/indie

Move on to the next playlist. Budget 15–30 seconds per playlist end-to-end; 10 playlists = ~2–5 minutes total.

## Step 6: Draft PITCH_KIT.md

Use the Write tool. Structure:

```markdown
# Pitch Kit: <project-name>

> Generated by `/aria:next` (pitch-kit skill) on YYYY-MM-DD · v1
> Grounded in: RELEASE_PLAN.md (dated YYYY-MM-DD), <N> inspect_playlist calls (fetched YYYY-MM-DDThh:mm:ssZ), <N> generate_pitch drafts (3-arg calls, base-pitch verbatim), get_bio (<cached DATE | no cached bio — fresh>), get_work_metadata (<workUuid | not indexed yet>).

## Focus track

- **Title:** <track title>
- **Artist:** <artist name>
- **Release date:** <from RELEASE_PLAN.md>
- **ISRC:** <from RELEASE_PLAN.md focus-track section, else "[TBD at distribution]">
- **ISWC:** <from get_work_metadata, else "[TBD at distribution]">
- **Writers / co-writers:** <from get_work_metadata writers[] — "Name (role)", else "[TBD]">
- **Publisher(s):** <from get_work_metadata publishers[] — "Name (share%)", else "[TBD]">
- **Label / distributor:** <from RELEASE_PLAN.md Distribution section>

## Short bio (<= 120 words)

<Bio text from Step 5. Count words — must be <= 120. Tone: <the tone selected via AskUserQuestion in Step 3>.>

*Source: <"cached Patchline bio dated YYYY-MM-DD" | "generated fresh YYYY-MM-DD in-session from PROJECT.md + VISION.md + BRIEF.md (no cached bio available)">. Tone: <third-person formal | first-person | narrative>.*

---

## Playlist pitches

> One subsection per priority playlist. Every pitch re-pulled (`inspect_playlist`) and regenerated (`generate_pitch`) today. The **base pitch** is MCP-generated and should be sent as-is or lightly edited; the **playlist context** block is Claude-enriched from real `inspect_playlist` data — NOT invented — and can be woven in or appended to the submission message.

### 1. <Playlist Name>

- **Tier / type:** <editorial | curated | indie> (`playlist.typeLabel`)
- **Curator:** <from playlist object if present, else "Spotify Editorial" or "—">
- **Followers:** <playlist.followers>
- **Growth:** <playlist.growthSummary — e.g. "+2.4k / 30d">
- **Refresh cadence:** <playlist.refreshed — "weekly | biweekly | monthly | irregular">
- **Track-age lean:** <playlist.trackAge — "new-leaning | balanced | catalog-leaning">
- **30-day adds:** <trackSnapshot.last30DaysAdds> new tracks
- **Most-repeated artists:** <trackSnapshot.mostRepeatedArtists[0..2] — top 3, comma-separated>
- **Recent-add highlights:** <trackSnapshot.visibleTracks[0..2] — "Artist — Track", top 2–3 as sonic anchors>
- **Curator network:** <curatorNetwork.siblingPlaylists.length> sibling playlists · <curatorNetwork.combinedFollowerReach> combined reach (if available, else omit bullet)
- **Submission route:** <Spotify For Artists pitch form | DM via curator handle | submission form URL from _raw | "no public submission — research curator socials">
- **Spotify link:** https://open.spotify.com/playlist/<spotifyId>

**Base pitch** (from `generate_pitch(artist_name, track_name, target_playlist)` — MCP-grounded and streaming-intelligence-backed):

> <The exact text returned by generate_pitch. Verbatim. 120–180 words. Do NOT edit for polish — the tool already used real streaming data to ground it. If you disagree with the tone, note it in the enrichment block below rather than rewriting.>

**Playlist context** (Claude-stitched from `inspect_playlist` output — every number traces to the API response above):

> <2–4 sentences following the Step 5d template. Must cite real numbers (30-day adds, follower count, sibling reach) and real track/artist names from trackSnapshot. Must tie to MOODBOARD's track-analysis features or VISION's narrative.>

---

### 2. <Playlist Name>

<same structure as above — one subsection per successfully-inspected playlist>

---

<... 3 through N ...>

---

## Unreachable playlists (skipped)

> These playlists appeared in RELEASE_PLAN.md but couldn't be verified today via `inspect_playlist`. Usually means the playlist was delisted, went private, the Spotify URL was missing from RELEASE_PLAN.md, or the Patchline playlist inventory hasn't indexed it yet. Re-run `/aria:release-plan` to find replacements before sending.

- **<Playlist Name>** — <failure reason, e.g. "playlist not found in Patchline inventory — may be private or too new" | "no Spotify URL in RELEASE_PLAN.md — re-run release-plan to refresh" | "statusCode 500 from Lambda — retry">
- **<additional unreachable playlists>**

*(If every playlist resolved, delete this section.)*

---

## Press release template

> Use as-is for smaller outlets. Rewrite the lede per target publication. The artist quote is the ONE section you MUST personalize — generic quotes read like PR fluff and get cut from coverage.

---

**FOR IMMEDIATE RELEASE — <release-date from RELEASE_PLAN.md>**

# <ARTIST NAME> releases "<TRACK TITLE>", <one-sentence positioning from VISION.md>

**<City, Country from PROJECT.md> — <release-date>** — <Artist name>, the <career stage + primary genre from PROJECT.md>, <"releases" | "returns with" | "unveils"> "<Track title>", out <release date> on <label / "self-released via <distributor>" from RELEASE_PLAN.md>.

<Lede paragraph — 2–3 sentences. Pull directly from VISION.md's narrative positioning. What IS this track trying to DO? Use the artist's framing from BRIEF.md's project-intent section, not marketing-speak.>

**Artist quote:**

> "<A direct quote from the artist. If BRIEF.md's interview captured a strong line, use it verbatim. If not, flag this as `[TO BE PROVIDED BY ARTIST]` — do not fabricate a quote. Fake artist quotes are the #1 tell that a press release was AI-generated.>"

**About <Artist name>:**

<The 120-word bio above, or a 2–3 sentence compression. Do not re-write — reuse what the artist already approved.>

**Release specs:**
- Title: <track title>
- Artist: <artist name>
- ISRC: <from RELEASE_PLAN.md or [TBD at distribution]>
- ISWC: <from get_work_metadata or [TBD at distribution]>
- Writers: <from get_work_metadata writers[] or [TBD]>
- Publisher(s): <from get_work_metadata publishers[] or [TBD]>
- Label: <label name or "Independent">
- Distribution: <from RELEASE_PLAN.md Distribution section>
- Release date: <date>
- Focus DSPs: <from RELEASE_PLAN.md>

**Press contact:**

<Artist's publicist, label PR contact, or artist's direct email from PROJECT.md. If not set, flag `[TBD — fill in before sending]`.>

**Links:**
- Smart link: `[to be generated in smart-link phase — /aria:next after this]`
- Spotify (pre-save): `<pre-save URL if known, else TBD>`
- Streaming: `<DSP URLs from RELEASE_PLAN.md focus-DSPs section>`

---

## Cold-outreach email template (sync supervisors, A&R, journalists)

> For direct human outreach — NOT playlist submission forms. Short, specific, no "Hey hope you're doing well!". Replace `<placeholders>` before sending.

**Subject:** New from <Artist name> — "<Track title>" (for <specific-use-case — "Night Drive Vol. 3 sync window" | "your Q3 dance A&R look" | "<publication>'s underground column">)

**Body:**

Hi <First name>,

I'm reaching out because <one-sentence specific reason — "you cut the trailer for X and this track sits in the same [BPM / mood] pocket" | "you A&R'd [relevant release] and my next single ties into that lineage" | "you covered [peer artist from VISION.md's reference list] and I'd bracket my sound with theirs">.

<Artist name> — <one-sentence positioning, tight, from VISION.md narrative>. The track is "<title>", out <release date> on <label / self-released via distributor>.

Quick specs: <BPM from MOODBOARD audio features>, <key if in audio features>, <mood / energy in 3–4 words>. Reference artists: <2 peers from VISION.md reference list>.

Private stream: `[insert unlocked SoundCloud / Dropbox / private Spotify link]`
Smart link (live <release date>): `[from smart-link phase]`

Happy to send stems, work-for-hire terms, or a sync-friendly instrumental if useful.

<Artist name>
<Artist email / manager email from PROJECT.md>

---

*Tips for using this template:*
- **The "reason" line in ¶1 is the whole email.** If you can't write a specific, verifiable reason for THIS recipient, don't send. Generic cold emails get deleted.
- **Never CC more than one person.** Sync supervisors talk to each other; getting caught on a blast kills the relationship.
- **Attach the MP3 only if asked.** First email = link only. WAV after they reply yes.

---

## Data sources

- Patchline `inspect_playlist`: <N> playlists queried, <N> resolved, <N> failed. Fetched <timestamp>.
- Patchline `generate_pitch` (3-arg calls): <N> base pitches generated. Fetched <timestamp>. Each enriched in-session with `inspect_playlist` output.
- Patchline `get_bio`: <"cached bio dated YYYY-MM-DD" | "no cached bio — generated fresh in-session from upstream artifacts">.
- Patchline `get_work_metadata` for <track title>: <"workUuid <uuid>, ISWC <iswc>" | "not indexed yet — placeholders used in press release">.
- Upstream artifacts read: BRIEF.md (dated X), VISION.md (dated X), MOODBOARD.md (dated X), RELEASE_PLAN.md (dated X).
- User selections: <N> playlists selected via AskUserQuestion (of <total> in RELEASE_PLAN.md); bio tone = <tone>.

---

*Edit any pitch by hand before sending. Downstream phases do not re-read this file; it's the deliverable the user takes off-platform.*
```

### Grounding-quality checklist (self-check before Write)

Before you Write the file, verify:

- [ ] Every playlist subsection traces to a successful `inspect_playlist(playlist_url: ...)` call in THIS invocation — no stale snapshots from RELEASE_PLAN.md
- [ ] Every base pitch came from `generate_pitch(artist_name, track_name, target_playlist)` — exactly 3 args, correct names (`track_name` not `track_title`, `target_playlist` not `playlist_name`)
- [ ] Every enrichment block cites numbers and names that trace back to the `inspect_playlist` payload — no invented curators, no fabricated follower counts, no hallucinated recent-add tracks
- [ ] Ghost playlists are in the "Unreachable playlists" section, not silently dropped
- [ ] The short bio is ≤ 120 words (count them, don't estimate) and every claim traces to `get_bio` output or upstream artifacts
- [ ] No ISRC / ISWC / writer name / publisher is fabricated — if `get_work_metadata` didn't return it, the field says `[TBD at distribution]`
- [ ] The press-release artist quote is either (a) a real line from BRIEF.md's interview, or (b) flagged `[TO BE PROVIDED BY ARTIST]`. Never fabricated.
- [ ] The cold-outreach email's "reason" placeholder is flagged `<placeholder>` — not pre-filled with generic "I think you'd like this"
- [ ] The smart-link URL placeholder is `[to be generated in smart-link phase]`, not something that could be confused for a real URL
- [ ] Base pitch vs enrichment block is clearly labeled per-playlist so the user knows which is MCP-generated and which is Claude-stitched

If any check fails, fix before writing.

## Step 7: Update STATE.md (append-only)

Use Edit on `.patchline/STATE.md`. **Append-only semantics — do NOT overwrite `Current phase:`.** The router (`/aria:next`) owns `Current phase:`; pitch-kit only marks itself complete.

Changes:

- `Completed phases:` → append bullet: `- pitch-kit — completed YYYY-MM-DD, artifact: PITCH_KIT.md (<N> playlist pitches, <N> ghost playlists flagged)`
- `Artifacts:` → append: `- PITCH_KIT.md (pitch-kit phase, generated YYYY-MM-DD)`
- Footer: `Last updated: YYYY-MM-DD by /aria:next (pitch-kit skill)`

Do NOT modify:

- `Current phase:` — stays at whatever the router set; `/aria:next` advances it on its next invocation by reading `Completed phases:` and computing the next incomplete phase (see `../../reference/state-schema.md` §4 chain-routing logic).

Why append-only: `Completed phases:` is the authoritative signal; `Current phase:` is a convenience pointer. If a skill writes `Current phase:` while another invocation of `/aria:next` is in flight, the two writers race. Letting the router own that line eliminates the class of bug.

## Step 8: Hand off

Tell the user — ≤ 4 sentences:

> Pitch kit written to `.patchline/artifacts/PITCH_KIT.md`. `<N>` playlist pitches (base from `generate_pitch`, enrichment stitched from `inspect_playlist` — all real MCP data), plus a 120-word bio, a press-release template, and a cold-outreach email template. <If ghosts: "Note: `<N>` playlist<s> from RELEASE_PLAN.md didn't resolve today — flagged in the 'Unreachable' section. Consider re-running `/aria:release-plan` to find replacements.">. Read through, personalize the artist-quote placeholder in the press release, then run `/aria:next` to generate the live smart link — that's the last phase.

## Error handling

- **STATE.md doesn't point at pitch-kit** → STOP, see Step 1.
- **PITCH_KIT.md already exists** → ask overwrite vs. refine.
- **RELEASE_PLAN.md missing** → STOP, point at `/aria:release-plan`.
- **RELEASE_PLAN.md has < 3 playlist targets** → offer to proceed vs. go back and expand.
- **RELEASE_PLAN.md targets have no Spotify URLs/IDs** → skip the uninspectable ones; flag in Unreachable; tell the user to re-run /aria:release-plan to refresh playlist tables.
- **`inspect_playlist` errors on EVERY playlist** (likely Lambda degradation, not data issue) → save the partial kit as `PITCH_KIT.draft.md` with a header note; tell the user: "The playlist intelligence Lambda is erroring across the board — looks like infra degradation, not your data. I saved what I have as a draft. Re-run `/aria:next` when the playlist-matcher Lambda is back."
- **`generate_pitch` returns an error (supervisor timeout, no final_response)** → skip that playlist's base pitch, leave placeholder `[generate_pitch errored — regenerate manually]`, flag in data-sources. Do NOT write Claude-authored pitch text in the base-pitch slot.
- **`get_work_metadata` returns an error** → use `[TBD at distribution]` placeholders across ISRC / ISWC / writers / publishers in the press release. Flag in data-sources.
- **`get_bio` returns "no cached bio"** → write a fresh 120-word bio in-session from PROJECT.md + VISION.md + BRIEF.md + MOODBOARD.md. No fake milestones, no fabricated streaming numbers, no invented press quotes. Flag clearly in data-sources.
- **All MCP tools return auth errors** → STOP. Tell the user to run `/mcp` to reconnect and re-invoke.
- **User declines AskUserQuestion for playlists** → default to processing the top 5 from RELEASE_PLAN.md.
- **User declines AskUserQuestion for bio tone** → default to third-person formal.

## Examples

### Happy path — 5 selected from 8, all resolve

```
User: /aria:next
You (reads STATE.md — pitch-kit is next incomplete; reads RELEASE_PLAN.md —
     8 priority playlists with Spotify URLs, focus track "Midnight Oil"
     ISRC BRTUM2600123; reads VISION, MOODBOARD, BRIEF):
  Running pitch-kit. 8 priority playlists from RELEASE_PLAN. Two quick
  questions before the MCP loop.

  [AskUserQuestion — playlists, multiSelect]
User: Picks 5 of the 8.
  [AskUserQuestion — bio tone]
User: First-person.

You: Pulling real-time intel — 5 inspect_playlist calls, 5 generate_pitch
     calls, get_bio, get_work_metadata. ~2 minutes.

  [calls inspect_playlist(playlist_url=...) x5 — all return 200]
  [calls generate_pitch(artist_name, track_name, target_playlist) x5 — all
   return 120–180 word base pitches]
  [calls get_bio(artist_name) — returns cached bio from 2026-03-12]
  [calls get_work_metadata(isrc=BRTUM2600123) — returns workUuid,
   ISWC, 2 writers, 1 publisher]

You (writes PITCH_KIT.md with 5 playlist sections — each has real
    inspect_playlist intel, the real 3-arg generate_pitch base pitch,
    and a Claude-enriched context block citing real 30-day adds and
    real curator-network reach; bio is first-person 110 words;
    press release has real writers / publisher / ISWC; appends
    pitch-kit to Completed phases in STATE.md — no Current phase
    write):

  Pitch kit written to .patchline/artifacts/PITCH_KIT.md. 5 playlist
  pitches (base from generate_pitch, enrichment stitched from
  inspect_playlist — all real MCP data), 120-word first-person bio,
  press-release template with real ISWC/writers/publisher, and cold-
  outreach email template. All 5 targets resolved. Read through,
  personalize the artist-quote placeholder in the press release, then
  run /aria:next for the smart-link phase.
```

### Ghost playlist case

```
You (inspect_playlist for one of the 5 returns statusCode 404 "playlist not
    found in Patchline inventory"):
  [skips generate_pitch for that playlist; continues the loop; completes
   4 of 5 base pitches]

You:
  Pitch kit written. 4 playlist pitches. 1 playlist ("2am Sessions") didn't
  resolve — Patchline's playlist inventory returned not-found (likely
  delisted or went private since release-plan ran). Flagged in the
  'Unreachable playlists' section of PITCH_KIT.md. Want to re-run
  /aria:release-plan to find a replacement before moving on, or
  continue to /aria:next smart-link with 4?
```

### Lambda degradation

```
You (inspect_playlist errors on 4 of 5 playlists with Lambda invocation
    failures):
  The playlist intelligence Lambda is erroring on most playlists — 1
  resolved, 4 errored. This looks like infra degradation, not your data.

  Options:
    (a) Wait ~30 min and re-run /aria:next — Lambdas usually self-recover
    (b) Proceed with the 1 pitch I CAN generate, come back for the other 4
        later by re-running pitch-kit

  Which?
```

### Unreleased track (work metadata not indexed)

```
You (get_work_metadata for "Midnight Oil" returns "Could not resolve
    composition data"):
  "Midnight Oil" isn't in the composition intelligence database yet — normal
  for a pre-release. The press release uses [TBD at distribution]
  placeholders for ISWC, writers, publisher. Fill those in after
  distribution when the work gets indexed.

  [continues with the playlist loop]
```

## Common mistakes (don't make these)

- **Passing invented args to `generate_pitch`.** The tool accepts 3 strings: `artist_name`, `track_name`, `target_playlist`. Passing `playlist_id`, `playlist_curator`, `artist_positioning`, `reference_artists`, `playlist_vibe_profile`, `track_isrc`, `track_title` (the wrong key for track_name), or `playlist_name` (the wrong key for target_playlist) will NOT error — Zod silently strips them. The resulting pitch is the SAME as if you'd only passed the 3 real args. Prior versions of this skill pretended the extras were doing tailoring; they weren't. Match the real contract.
- **Passing internal playlist UUIDs to `inspect_playlist`.** The tool takes Spotify URLs or 22-char Spotify playlist IDs. An internal UUID will fail the regex and return a "Could not extract a Spotify playlist ID" error. RELEASE_PLAN.md stores Spotify URLs; forward those.
- **Copy-pasting the same enrichment block into every playlist subsection.** The whole point of per-playlist `inspect_playlist` calls is per-playlist context. If every playlist's "Context" paragraph reads the same, you've copied stale prose — re-read each `inspect_playlist` response and cite THAT playlist's specific 30-day adds / most-repeated artists / sibling reach.
- **Skipping `inspect_playlist` and reusing the stale snapshot from RELEASE_PLAN.md.** Playlists change. Curators change. 30-day adds rotate weekly. Re-pull, always.
- **Pitching to ghost playlists.** If `inspect_playlist` errors, the playlist is NOT in the pitch section — it's in the "Unreachable" section. You don't know who to pitch to if the playlist has been delisted.
- **Fabricating curator names, follower counts, or recent-add tracks in the enrichment block.** Every number and name in the enrichment must trace to `inspect_playlist` output. If `inspect_playlist` didn't return a curator name for an editorial playlist, the enrichment block omits the curator clause — it does NOT invent one.
- **Fabricating an ISRC or publisher for the press release.** `[TBD at distribution]` is perfectly professional. A made-up ISRC that fails to resolve later is a real problem.
- **Writing a fake artist quote.** Either pull a real line from BRIEF.md's interview, or flag `[TO BE PROVIDED BY ARTIST]`. PR fluff ("I've never been more excited about a release") is an obvious AI tell and gets the whole release cut from consideration.
- **Making the bio over 120 words to sound "thorough".** Curators skim. Sync supervisors want specs. 120 words max — count them.
- **Dropping the cold-outreach email template.** Some artists need it to email a sync supervisor by Friday. It belongs in PITCH_KIT.md regardless of whether the playlist workflow is complete.
- **Editing the `generate_pitch` base pitch for "polish".** The tool used real streaming intelligence server-side. Rewriting loses the grounding. If a base pitch is genuinely bad (off-tone, generic-feeling), your recourse is the enrichment block — don't rewrite the base. If the artist wants a tonal shift, that's what hand-editing the file before sending is for.
- **Claiming pitches were sent.** Per CLAUDE.md: the plugin drafts, the user submits. Hand-off message says "drafted" / "ready to send" — never "submitted" or "delivered".
- **Writing `Current phase:` in STATE.md.** Append-only for this skill. The router owns `Current phase:`. Only append to `Completed phases:` and `Artifacts:` plus the `Last updated:` footer.
- **Advancing STATE.md before verifying PITCH_KIT.md exists on disk.** Check the file after Write, before Edit-ing STATE.md.
