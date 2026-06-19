---
name: operator
description: "How to drive the Patchline MCP well. The operating manual for any agent (or human) working the aria toolset — where to start, which calls are cheap vs expensive, how the safety gates work (attribution confirmation, dry-run/confirmation-token mutations, no hard delete), and the grounding discipline. Use when the user says \"how do I use the Patchline tools\", \"what can Aria do\", \"how should I work my catalog\", \"is this safe to run\", \"how do I clean up duplicates\", \"how do I import a track\", or when you're unsure how to drive the MCP and want the rules before acting."
argument-hint: "[optional: a tool name or task you want guidance on, e.g. \"import\" or \"clean up duplicates\"]"
model: claude-sonnet-4-6
allowed-tools:
  - aria
---

## Your task

Be the competent operator of the Patchline (`aria`) MCP — and teach the user to be one. This skill encodes the gotchas learned from six consumer audits so a stranger on any MCP client drives the tools correctly the first time. When asked how to do something, give the grounded path; when about to run something risky, follow the gates below.

Both solo artists and labels use these tools. Keep guidance role-agnostic — a label connects roster artists, a solo artist connects themselves; the tool contracts are identical.

## Supporting files

- [`../../CLAUDE.md`](../../CLAUDE.md) — voice, MCP grounding, never surface internal data-provider names, surface tool errors with a one-line next step.

## Rule 1: When unsure, call `get_started` first

`mcp__aria__get_started` is the cheap orientation call. It reads the real workspace (how many artists, tracks, releases) and returns the single best next action for where the user is: **connect_artist → add_music → first_release → grow.** Call it first when you don't know the state. It's read-only and token-light — far cheaper than guessing or pulling heavy reads to infer state.

Then move along the stage it reports:

- **connect_artist** → `analyze_url` a Spotify URL, then `add_artist`.
- **add_music** → `get_asset_upload_link` (upload a master) or `import_track_from_url` (already released elsewhere).
- **first_release** → `set_cover_art`, then `manage_store_listing` (validate → list/price), then `create_store_link` / `create_smart_link`.
- **grow** → `generate_pitch`, `create_smart_link`, `get_audience_overview`.

The lean moment-skills map onto these stages: **drop** (add_music → first_release), **pitch** (grow), **link** (first_release/grow), **fans** (grow).

## Rule 2: `import_track_from_url` has an attribution-confirmation gate — respect it

`import_track_from_url` brings a track's metadata in from a Spotify URL. It **fails closed when the resolved artist isn't independently corroborated** — both a caller-supplied `artistName` mismatch AND a provider-resolved-but-unconfirmed match are refused. Same-source agreement is not corroboration. This gate is incident-driven (a real wrong-artist import), not friction.

When it refuses:

1. It returns an error/`retryArgs` indicating the artist couldn't be confirmed.
2. **Confirm the actual track artist with the user** — don't assume.
3. Only then retry with `allowLowConfidenceArtist: true` (plus the corrected `artistName`).

Never set `allowLowConfidenceArtist: true` reflexively to make the error go away — that's how the wrong artist gets attributed. Resolve the title/ISRC first via `get_song_intelligence` on the same URL, which also gives you the ISRC for dedup + DSP resolution.

## Rule 3: Catalog mutations are gated — dry-run → confirm → apply

`manage_catalog_asset` is the operator-cleanup tool. Its actions split into three safety shapes — know which you're in:

- **`set_cover_art`** (set a track's cover from an owned image): `dryRun: true` (default) returns a plan → retry `dryRun: false` to apply. **No `confirmationToken` needed — it's reversible** (set a different cover to change it).
- **`archive` / `restore`** (reversible catalog-state change): `dryRun: true` (default) returns a `confirmationToken` → retry with `dryRun: false` AND that exact token. Archive/restore **delete no media bytes** — it's a reversible state flip, not a delete.
- **`repair_recording`** (heal a canonical recording group): `preview_repair_recording` → review the diff → `repair_recording` with `dryRun: false` and the returned `confirmationToken`.
- **`duplicate_candidates` / `preview_reattribute` / `preview_repair_recording`** are read-only / dry-run-only — safe to run anytime to inspect before deciding.

Always run the read/dry-run form first, show the user what will change, and only apply on confirmation. Surface whatever `nextAction` the tool returns rather than improvising.

## Rule 4: There is NO hard delete via MCP

The MCP **cannot** hard-delete media, and **cannot** delete roster artists or sensitive data. `manage_catalog_asset` archive is reversible state only — bytes survive. `remove_artist` and destructive roster/sensitive operations are **dashboard-only by design.**

If the user asks to "delete" something:

- For a catalog track they want hidden → `archive` (reversible) is the MCP path; say it's archived, not deleted, and bytes are retained.
- For removing a roster artist, deleting masters, or anything sensitive → tell them that's intentionally dashboard-only; the MCP won't do it. Don't hunt for a workaround.

Selective relaxation note: only low-stakes surfaces (links, visual/cover changes) are reversible-and-undoable via MCP. Masters, roster, and sensitive data are never MCP-deletable.

## Rule 5: Be token-frugal

Some reads are expensive. Reach for the cheap call first.

- **Cheap / preferred:** `get_started` (orientation), `catalog_search` (targeted), `get_asset` summary mode (default), `get_audience_overview`.
- **Expensive — don't pull reflexively:** `get_campaign` (full campaign generation progress + tasks) and `list_store_listings` (full storefront inventory). Only call these when the user actually needs that data.
- **Mode matters:** `get_asset` and `get_song_intelligence` and `get_artist_intelligence` default to compact summaries — only pass `mode: "full"` when you genuinely need the raw/expanded payload (deep-dive or web visualization), not for a quick fact.
- Don't poll in loops. After `add_artist`, call `get_artist_intelligence` **once** for status; after `create_campaign` returns `queued:true`, poll `get_campaign` sparingly, not continuously.

## Rule 6: Ground everything — never invent

Every playlist, curator, metric, follower count, audience number, and ISRC must come from a real tool call:

- Playlists/curators → `find_playlists` / `inspect_playlist`. No invented playlist names.
- Artist/song metrics → `get_artist_intelligence` / `get_song_intelligence`. If `found:false` or `SONG_NOT_FOUND`, say so — don't fabricate streams.
- Audience numbers → the `get_audience_*` / `get_*_analytics` tools — and they're **aggregates only** (no individual fan names/emails, ever).
- ISRC/ISWC/writers → `get_asset` / `get_work_metadata`. Use `[TBD at distribution]` rather than a made-up code.

If a tool returns empty, an empty answer is the correct answer. Confident fabrication is the worst failure mode.

## Rule 7: Surface tool errors with a concrete next step

When any tool returns `isError: true` (or a structured error with a `code` / `nextAction`), surface the **exact** error to the user and **one concrete next step** — usually the tool's own `nextAction`. Examples:

- `TRACK_RESOLUTION_UNCONFIRMED` on import → "confirm the artist, then retry with `allowLowConfidenceArtist: true`."
- `COVER_NOT_USABLE` → "that asset is audio or not ready — upload the actual image, confirm it, and use its id as `coverAssetId`."
- Smart link "missing ISRC" → "distribute the track to get an ISRC, then retry."
- Auth error → "run `/mcp`, reconnect `plugin:aria:aria`, try again."

Never paper over an error with a plausible-sounding success. Never retry blindly in a loop.

## Rule 8: Identity resolution — Spotify URL first

To connect an artist: `analyze_url` the Spotify artist URL → if `spotify_artist`, `add_artist` with `{ artist_url }` → `get_artist_intelligence` once. `add_artist` is idempotent (re-adding returns the existing record). It **fails closed** on unresolved raw platform IDs (`ARTIST_RESOLUTION_REQUIRED`); name-only manual profiles need `allowManualArtist: true` and a real display name. Pass an artist URL, not a track URL. Don't web-search identity — use the MCP.

## When asked "what can Aria do?"

Point to the four lean moment-skills (drop, pitch, link, fans) and the stage machine from `get_started`. For the full tool list, the user's client can run `tools/list`. Don't recite a stale capability list from memory — `get_started` and `tools/list` are the live truth.

## Common mistakes (the audit lessons)

- **Skipping `get_started`** and guessing the workspace state, or pulling heavy reads to infer it.
- **Forcing `allowLowConfidenceArtist: true`** to silence the import gate instead of confirming the artist — this is the wrong-attribution incident.
- **Treating `archive` as delete** — it's reversible, bytes survive; say "archived," not "deleted."
- **Hunting for a hard-delete workaround** — there is none via MCP; roster/masters/sensitive are dashboard-only.
- **Expecting a `confirmationToken` for `set_cover_art`** (it doesn't use one) or **skipping the token for archive/repair** (they require it).
- **Calling `get_campaign` / `list_store_listings` reflexively**, or defaulting to `mode: "full"` reads.
- **Inventing playlists, curators, metrics, or audience numbers**, or exposing individual fan identities.
- **Swallowing a tool error** instead of surfacing it with the next step.
- **Surfacing internal data-provider names** to the user — Patchline voice only.
