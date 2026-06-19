---
name: drop
description: "Drop a song. The one-shot release flow: upload the master, let Patchline analyze it, give it a cover, list it on the storefront, and create the public store link. Use when the user says \"drop my new single\", \"release this track\", \"put my song out\", \"I just finished a track, get it live\", or pastes a local audio file and wants it shipped. Reuses start's Spotify-URL identity resolution if the artist isn't connected yet. MCP-grounded: get_asset_upload_link -> confirm_asset_upload -> manage_catalog_asset set_cover_art -> manage_store_listing validate/list -> create_store_link."
argument-hint: "[optional local audio file path, or Spotify artist URL to connect first]"
model: claude-sonnet-4-6
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
  - aria
---

## Your task

Take a finished track from a file on disk to live on the artist's storefront, in one flow. No 10-step waterfall. The headline path:

1. **Connect the artist** if they aren't already (Spotify URL -> `analyze_url` -> `add_artist` -> `get_artist_intelligence`).
2. **Upload the master** — `get_asset_upload_link` mints a presigned URL, the user's bytes go straight to storage (never through MCP), then `confirm_asset_upload` finalizes and kicks off track analysis.
3. **Give it a cover** — upload an image the same way, then `manage_catalog_asset` with `action: "set_cover_art"`, pointing the track at the image as `coverAssetId`.
4. **Put it on the storefront** — `manage_store_listing` validates/lists the track, then `create_store_link` makes the public store surface.

Both solo artists and labels use this — a label connects a roster artist, a solo artist connects themselves. Keep copy role-agnostic.

## Supporting files

- [`../../CLAUDE.md`](../../CLAUDE.md) — voice, MCP grounding, never surface internal data-provider names, surface tool errors with a one-line next step.
- The artist-identity resolution (Spotify URL → `analyze_url` → `add_artist`) and the upload/confirm/analysis gate are inlined in Steps 1 and 3 below — this skill is self-contained.

## Security: file paths and URLs

A pasted Spotify URL goes only to `analyze_url` / `add_artist`. A local file path goes to Bash **only** quoted, for `ls`/`stat`/`curl` — never unquoted, never interpolated into a shell context with metacharacters. If a path contains shell metacharacters you can't safely quote, ask the user to move the file somewhere clean.

## Step 1: Make sure an artist is connected

Call `mcp__aria__get_started` first if you don't already know the roster state — it's the cheap first call and tells you whether the user has an artist connected. If it reports stage `connect_artist`, or the user explicitly hasn't connected anyone, resolve identity now:

- **Spotify artist URL given** → `mcp__aria__analyze_url` with the URL. If `type` is `spotify_artist`, call `mcp__aria__add_artist` with `{ artist_url: <cleanUrl> }`, then `mcp__aria__get_artist_intelligence` with the canonical name to capture the Patchline `artistId`. Never re-ask for the artist name after a valid Spotify artist URL resolves.
- **Artist already connected** → grab their `artistId` from `get_started`/`browse_roster` and continue.
- **No URL, not connected** → ask once: "Paste your Spotify artist profile URL so I can connect the artist before I drop the track." Don't web-search identity.

If `add_artist` returns `isError`, surface the exact message and the one-line fix (usually: "paste a Spotify *artist* URL, not a track URL"). Capture `artistId` and `artistName` for the upload.

## Step 2: Locate the master file

If the user passed a path, verify it exists with quoted Bash (`ls -la "<path>"`). Otherwise ask: "Paste the local path to your final WAV/MP3/AIFF/FLAC." If there's no file yet, stop and tell them the drop needs the master file (or an existing catalog `assetId` if it's already uploaded) — don't fabricate a placeholder.

Derive a clean track title from the filename (strip extension and common suffixes like `final`, `master`, `v2`, `mix`). If it clearly differs from what the user called the track, confirm once via AskUserQuestion; otherwise proceed.

## Step 3: Upload the master

1. Read the file's name and byte size with quoted Bash (`stat -c %s "<path>"`).
2. Call `mcp__aria__get_asset_upload_link`:
   - `fileName` (required), `fileSizeBytes` (required)
   - `trackTitle`, `format` (e.g. `wav`), `artistId` (if connected), `artistName`, `projectName` if you have one
3. Capture `assetId` and `uploadUrl` from the response. **Treat `uploadUrl` as sensitive — never print it in normal output.**
4. PUT the bytes directly with quoted Bash:
   ```bash
   curl -sS -X PUT -T "<path>" "<uploadUrl>"
   ```
   Keep output quiet unless it errors.
5. Call `mcp__aria__confirm_asset_upload` with `{ assetId }`. This finalizes the asset and triggers track analysis + AI metadata.

If `get_asset_upload_link` returns `isError` (quota, bad size), surface it and stop. If the PUT fails, report the HTTP status and stop — the track isn't uploaded, so don't continue to cover or storefront.

> Track analysis runs in the background. You do NOT need to block on it to set a cover or create the store link — analysis enriches BPM/key/tags/sync-angle later. Mention it's processing; don't poll in a loop here. (The full poll-until-analyzed flow lives in `audio-intake` if the user wants to wait.)

## Step 4: Give it a cover (optional but recommended)

Ask once via AskUserQuestion whether they have cover art:

- **They have an image file** → upload it exactly like Step 3 (`get_asset_upload_link` with the image filename/size → PUT → `confirm_asset_upload`). Capture the image's `assetId` as the `coverAssetId`.
- **No cover yet** → skip this step; note the track will use a default placeholder until they set one. Don't generate or invent artwork.

Then point the track at the image:

```
manage_catalog_asset(action: "set_cover_art", assetId: "<track assetId>", coverAssetId: "<image assetId>")
```

`set_cover_art` defaults to `dryRun: true` — the first call returns a **plan** (which track, which cover) and a `nextAction`. Confirm the plan reads right, then re-call with `dryRun: false` to apply.

- **No `confirmationToken` is needed** — `set_cover_art` is reversible (set a different cover to change it). This is unlike archive/repair, which DO require a token.
- If the cover call returns `COVER_NOT_USABLE`, you pointed `coverAssetId` at audio (or the image has no storage key yet) — re-upload the actual image and confirm it. If `COVER_NOT_FOUND`, the image upload didn't confirm — redo Step 4's upload. Surface whichever `nextAction` the tool returns.

## Step 5: List the track on the storefront, then get the link

A store link only surfaces the storefront — the track is for sale only once it's **listed**. Do all three, in order:

1. **Validate** it's commerce-ready:
   ```
   manage_store_listing(action: "validate", assetId: "<track assetId>")
   ```
   It reports whether the track can be listed and any blockers (missing audio, artist/seller setup). If it's not commerce-ready, surface the exact blocker and stop — don't hand back a link to an unlisted track.
2. **List it** (this is what actually puts it up for sale):
   ```
   manage_store_listing(action: "list", assetId: "<track assetId>")
   ```
   If the user gave a price, set it with `manage_store_listing(action: "price", assetId, priceInCents)`.
3. **Get the shareable link**:
   ```
   create_store_link()        // or pass projectId if this track belongs to a release project
   ```
   Capture `shareUrl` and `shareId` — the live storefront URL the artist shares.

> Do NOT skip the `list` step. `create_store_link` returns a store-surface URL even when nothing is listed, so a link without a prior successful `manage_store_listing list` points at an empty store — the track is live for fans only after `list` succeeds.

If `manage_store_listing validate/list` or `create_store_link` returns `isError`, surface it with the next step (often a seller-agreement or payout-setup prompt the user completes in the dashboard).

## Step 6: Report what shipped

Tell the user in ≤4 sentences — concrete, with the live URL:

> Dropped **<track title>** by **<artist name>**. Master uploaded (asset `<assetId>`, track analysis is processing in the background) <if cover: "and cover art set">. It's live on your storefront: **<shareUrl>**. <If no cover: "Add cover art when you have it — say 'set the cover for <track>' and point me at an image.">

If you only generate an artifact when the user asks: a short `DROP.md` with the asset ID, cover status, and store URL. Otherwise just report inline.

## Error handling

- **MCP not connected / auth expired** → "Aria isn't connected. Run `/mcp`, reconnect `plugin:aria:aria`, then try again."
- **`add_artist` track-URL error** → ask for the Spotify *artist* URL.
- **File missing** → ask for a corrected path or an existing catalog `assetId`.
- **`get_asset_upload_link` quota/size error** → surface exact message, stop.
- **PUT fails** → report HTTP status, stop (track not uploaded).
- **`confirm_asset_upload` fails** → surface exact error; the asset exists but isn't finalized — retry confirm before moving on.
- **`set_cover_art` dry-run mismatch** → re-read which track/cover it planned; only apply with `dryRun:false` once it's right.
- **`create_store_link` seller/payout error** → surface the dashboard step the user must complete first.

Never claim a track is "live on the storefront" unless `manage_store_listing list` succeeded and `create_store_link` returned a real `shareUrl`. A fabricated store URL is worse than none — the artist will paste it into their bio.

## Common mistakes

- **Streaming audio bytes through MCP.** MCP only mints the presigned URL; bytes go to storage via the PUT. Never base64 a file into a tool argument.
- **Printing the signed `uploadUrl`.** It's sensitive operational material — keep it out of normal output.
- **Blocking the drop on track analysis.** Analysis is background; cover + store link don't need it. Don't sit in a polling loop.
- **Applying `set_cover_art` without reading the dry-run plan**, or expecting a `confirmationToken` it doesn't use.
- **Pointing `coverAssetId` at the audio asset** instead of an uploaded image.
- **Inventing cover art or a track title.** Derive the title from the filename and confirm if ambiguous; if there's no cover, say so.
- **Surfacing the names of analysis or storage providers** — say "track analysis" and "your storefront," never the vendor.
