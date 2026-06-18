---
name: link
description: "Make and share a smart link. Create a live patchline.ai share link for a released track (or a pre-release drop link), then hand back distribution-ready copy for socials, email, and bio — plus how to read its analytics later. Use when the user says \"make a smart link\", \"give me a share link for <song>\", \"create a link to send fans\", \"link for my release\", or \"how's my link doing\". MCP-grounded: create_smart_link / create_drop_link -> get_share_surface -> get_surface_analytics. The link URL must be live — no placeholders."
argument-hint: "[optional track title or catalog assetId; or a releaseId for a pre-release drop link]"
model: claude-sonnet-4-6
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
  - aria
---

## Your task

Give the artist one live link to route fans everywhere, and the copy to spread it. The flow:

1. **Find the track** (`catalog_search` → `get_asset`) and confirm it has an ISRC.
2. **Create the link** — `create_smart_link` for a released track (server resolves DSP URLs from the ISRC), or `create_drop_link` for a pre-release/announcement.
3. **Read it back** with `get_share_surface` to confirm what's live and which platforms resolved.
4. **Hand back distribution copy** for socials / email / bio, and tell the user how to check `get_surface_analytics` later.

Both solo artists and labels use this. Keep copy role-agnostic.

**The hard rule (from smart-link):** the link URL you give the user must be the real `shareUrl` returned by the create tool. If the create call errors, STOP and surface it — never hand back a placeholder URL. The artist will paste it into their bio; a dead link kills the release.

## Supporting files

- [`../../CLAUDE.md`](../../CLAUDE.md) — voice, MCP grounding, never surface internal provider names.

## Step 1: Pick the link type

Decide (or ask once via AskUserQuestion) which the user needs:

- **Smart link** — the track is released / distributed (has an ISRC). Routes fans to every DSP. Use `create_smart_link`.
- **Drop link** — pre-release or announcement for a release that may not have DSP links yet (pre-saves, "out Friday"). Use `create_drop_link` with a `releaseId`.

Default to a smart link if the track is already out.

## Step 2: Resolve the track (smart link path)

If the user gave an `assetId`, use it. Otherwise `mcp__aria__catalog_search` with `{ query: "<track> <artist>" }` → top hit's `id`. Then `mcp__aria__get_asset` with `{ assetId }`.

**Check the ISRC.** `create_smart_link` requires it — the server resolves DSP links from the ISRC. If `get_asset` shows `isrc` null/missing:

> STOP: "This track doesn't have an ISRC yet, and a smart link needs one to resolve DSP links. Distribute it through your distributor so an ISRC is assigned, then come back. If it's already distributed, re-import the asset to refresh the ISRC. (If you just want a pre-release/announcement link now, I can make a drop link instead.)"

Catching it here gives a clearer message than the server's generic rejection.

## Step 3: Create the link

### Smart link
```
create_smart_link(
  assetId: "<from Step 2>",   // REQUIRED
  title: "<optional display-name override>",
)
```
By default this **returns the existing canonical link** if one already exists for the track — it won't mint duplicates. Only pass `forceNew: true` when a separate campaign link is genuinely intended. Capture `shareUrl` and `shareId`.

### Drop link
```
create_drop_link(
  releaseId: "<the release id>",   // REQUIRED
  title, artist, releaseDate, spotifyPresaveUrl, applePresaveUrl, smartLinkUrl  // all optional
)
```
Capture `shareUrl` and `shareId`.

> You do NOT pass DSP URLs to `create_smart_link` — the server resolves them from the ISRC. For a drop link you may pass known pre-save URLs, but don't fabricate them.

### If the create call errors — STOP

- Smart link "missing ISRC" → re-check Step 2; if it passed, the ISRC may have cleared — ask the user to re-import.
- HTTP 404 → the `assetId` doesn't exist or isn't the user's; re-resolve in Step 2.
- Tool-not-found → the deployed MCP doesn't have this tool yet; point at TROUBLESHOOTING.md.
- Auth error → `/mcp` reconnect.

**Do not produce distribution copy with a placeholder URL.** A real `shareUrl` is the gate.

## Step 4: Read the link back

Call `mcp__aria__get_share_surface` with `{ shareId }` (or `{ url }`) to confirm what's live and capture the resolved platform links / section config. Cite the real platforms — don't claim a DSP resolved if the response doesn't list it. If `get_share_surface` errors but the create call returned a `shareUrl`, the link still exists; note the read-back was unavailable and proceed with the create response.

## Step 5: Hand back distribution copy

Give the user ready-to-paste copy. Pull voice from anything the user told you about the release; keep it tight and non-generic.

**Bio / link-in-bio:**
> <shareUrl>

**Instagram (feed + story):**
> Feed caption: a short, specific line about the track — not "Excited to announce!" Drop the link in bio.
> Story: link sticker → <shareUrl>, caption "out now" (or pre-save framing for a drop link).

**Twitter/X:**
> One line + <shareUrl>. Let the link do the work; ≤120 chars.

**Email (if they have a list):**
> One short paragraph in the artist's voice, one CTA (stream / pre-save), <shareUrl>. Under 100 words. If they have no list, suggest starting one before the next release.

Keep platform drafts to channels the user actually uses — don't fabricate a TikTok plan they never mentioned.

## Step 6: Tell them how to track it

> Check how the link is doing anytime — I'll pull `get_surface_analytics` for `<shareId>`: views, captures, clicks, plays. For a released track, DSP coverage fills in over the first 24–48h as platforms index the ISRC; re-run this to refresh.

If the user asks now, call `mcp__aria__get_surface_analytics` with `{ shareId }` and report the aggregate numbers (views, captures, downloads, plays, last viewed). Aggregates only — there are no individual fan identities in this surface.

## Step 7: Report

≤4 sentences:

> Live link for **<track/release>**: **<shareUrl>** <if smart link: "— routes fans to <N> platforms"; if it reused an existing link: "(reused your existing canonical link — no duplicate created)">. Copy for socials, email, and your bio is above. Say "how's my link doing" anytime and I'll pull the view/capture/click stats.

Generate a `LINK.md` artifact only if the user asks.

## Error handling

- **Track not in catalog** → point to drop/import.
- **No ISRC (smart link)** → STOP, point at distributor; offer a drop link instead.
- **create call errors** → STOP, surface exact error, no placeholder URL.
- **`get_share_surface` errors but create succeeded** → proceed with the create `shareUrl`, note read-back unavailable.
- **`get_surface_analytics` errors** → surface it; the link is still live.
- **MCP auth expired** → `/mcp` reconnect.

## Common mistakes

- **Handing back a placeholder URL when the create call failed.** THE failure mode. STOP on error.
- **Passing legacy args to `create_smart_link`** — it takes only `assetId` (required), `title`, `enabledSections`, `projectId`, `campaignId`, `forceNew`, `taskId`. `artist_name`, `track_isrc`, `cover_art_url`, `dsp_urls` are not accepted; the server resolves them from the asset.
- **Minting a duplicate smart link** by reflexively passing `forceNew: true`. Default behavior reuses the canonical link — that's correct.
- **Fabricating DSP URLs** in the copy. Cite only platforms `get_share_surface` / the create response actually resolved.
- **Writing "Excited to announce" AI-tell copy.** Be specific to the track.
- **Drafting copy for platforms the user never mentioned.**
- **Exposing individual fan data** — surface analytics are aggregate; there are no names/emails here.
- **Surfacing the link/DSP-resolution provider name** to the user.
