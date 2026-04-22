---
name: audio-intake
description: "Track-upload gate for projects where the music already exists. Creates a secure direct upload link through the aria MCP, confirms upload, triggers Patchline track analysis, captures compact campaign intake while analysis runs, and records the focus track before creative strategy phases begin. Use when STATE.md shows `Current phase: audio-intake`."
argument-hint: "[optional local audio file path or existing Patchline assetId]"
model: claude-sonnet-4-6
prerequisites:
  - start
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

Create or confirm the project's focus-track asset before Aria asks subjective sonic questions. This phase exists because if the user already has the track, Patchline should analyze the audio before Aria invents a sound description.

By the end of this skill:

1. `.patchline/artifacts/AUDIO_INTAKE.md` records a confirmed asset ID and analysis status, or
2. `STATE.md` has a clean pending state explaining that analysis is still running and Aria can resume later.

Do not ask the user to describe the sound before trying the upload and analysis path.

## Supporting Files

- [`../../CLAUDE.md`](../../CLAUDE.md) - plugin-wide voice and MCP grounding rules.
- [`../../reference/state-schema.md`](../../reference/state-schema.md) - canonical STATE.md schema.
- [`../start/SKILL.md`](../start/SKILL.md) - predecessor skill.
- [`../creative-brief/SKILL.md`](../creative-brief/SKILL.md) - successor once analysis is complete.

## Step 1: Read Workspace Context

Use Read on:

- `.patchline/PROJECT.md` - extract project name, artist name, Patchline artist ID, Project Anchor ID, composition status, and campaign-intake placeholders.
- `.patchline/STATE.md` - confirm `Current phase: audio-intake`; read `Audio status`, `Focus track asset ID`, and `Track analysis status`.
- `.patchline/artifacts/AUDIO_INTAKE.md` - if it exists, use it to decide whether this is a resume, refresh, or replacement.

If `Composition status` is not `complete`, stop and tell the user audio-intake is only required when finished audio exists.

If `Current phase` is not `audio-intake`, stop and tell the user to run `/aria:next` first so STATE.md can route honestly.

## Step 2: Decide Upload Path

Ask one question only if the user did not pass a useful argument:

> Paste the local path to your final WAV/MP3/AIFF/FLAC file. If the track is already in Patchline, paste the asset ID instead.

Branch:

- Existing asset ID - call `mcp__aria__get_asset`. If audio features are present, proceed to Step 6. If analysis is missing, record pending state and continue to campaign intake.
- Local file path - verify it exists with Bash, then continue.
- No file yet - write `Audio status: missing`, tell the user to place the file in this workspace or upload in the Patchline web app, and stop.

Never upload bytes through MCP. MCP only creates the signed upload handoff.

## Step 3: Confirm Track Title From Filename

For local uploads, derive a clean title from the file name:

- Remove extension.
- Strip common suffixes such as `final`, `master`, `v1`, `v2`, `mix`, `wav`, `mp3`, dates, and duplicate artist prefixes when obvious.
- Compare the derived title with `Working title` in PROJECT.md.

If the derived title clearly differs from the project title, ask one quick confirmation:

> I read the file name as `<derived title>`, but the project is called `<project title>`. Should the track title be `<derived title>`, `<project title>`, or something else?

Use the answer as `trackTitle`. If the title matches or the difference is trivial capitalization/punctuation, do not ask.

## Step 4: Create The Secure Upload Handoff

For a local file path:

1. Use Bash to read file name and byte size. Quote the path; never execute it.
2. Call `mcp__aria__get_asset_upload_link` with:
   - `fileName`
   - `fileSizeBytes`
   - `trackTitle`
   - `artistId` from PROJECT.md if present and not `not in roster`
   - `artistName`
   - `projectName`
3. Capture returned `assetId`, `uploadUrl`, `uploadMethod`, and confirm tool.

## Step 5: Upload And Confirm

Use Bash to PUT the local file directly to the returned `uploadUrl`. Keep output quiet and do not print the full signed URL unless there is an error.

After PUT succeeds, call `mcp__aria__confirm_asset_upload` with `assetId`. This triggers Patchline upload finalization and track analysis.

If PUT or confirmation fails, write an `AUDIO_INTAKE.md` draft with `upload_failed` or `confirm_failed`, keep the phase incomplete, include the exact status/error, and stop.

## Step 6: Capture Compact Campaign Intake While Analysis Runs

Before polling, ask these compact campaign-intake questions. Ask one at a time and accept short answers.

1. "Target release date? Give YYYY-MM-DD, or say TBD."
2. "What is the main marketing goal for this release? Examples: week-1 streams, playlist placement, press, label attention, fan reactivation."
3. "Which assets do you want Aria to plan around: cover art, flyer, canvas/vertical video, press copy, all of these, or none yet?"
4. "Any visual references? Paste image paths/URLs, mood words, or say no visuals yet."
5. "Anything else Aria should know before it builds the campaign? One dump is fine."

Update the `## Campaign intake` section in PROJECT.md with these answers immediately. If a Project Anchor exists, note that the same intake belongs in Project `ideaMetadata`; if no update tool is available in this session, keep the local PROJECT.md section as source of truth.

## Step 7: Wait For Track Analysis

Call `mcp__aria__get_asset` for the confirmed or existing `assetId`.

Polling schedule:

1. Wait 60 seconds before the first serious poll after confirmation.
2. Poll every 20 seconds after that.
3. Continue until analysis appears or roughly 7 minutes total have elapsed.

Treat analysis as complete when `get_asset` returns audio-analysis metadata/features such as BPM, key, genres, moods, energy, valence, danceability, or a generated audio description.

If analysis is still pending after the full window, this is not a failure. Write clean pending state:

- Focus track asset ID set to the asset ID.
- Audio status `uploaded`.
- Track analysis status `analysis_pending`.
- Blocker: "Track analysis is still processing for asset `<assetId>`. Re-run `/aria:audio-intake` later; Aria will resume without re-uploading."

Do not imply the track failed unless the MCP/API returned an explicit failure.

## Step 8: Write AUDIO_INTAKE.md

Use Write to create `.patchline/artifacts/AUDIO_INTAKE.md`:

```markdown
# Audio Intake: <project-name>

> Generated by `/aria:audio-intake` on YYYY-MM-DD

## Focus track

- Asset ID: <assetId>
- Title: <track title>
- Artist: <artist name>
- Source: <local upload | existing Patchline asset>
- Upload status: <uploaded | existing | failed>
- Track analysis status: <analysis_complete | analysis_pending | analysis_failed>

## Campaign intake

- Target release date: <answer or TBD>
- Marketing goal: <answer>
- Desired assets: <answer>
- Visual references: <paths/URLs/mood words/no visuals yet>
- Notes: <answer or none>

## Audio grounding

<If analysis exists: summarize BPM, key, genres, moods, energy/valence/danceability if available.>
<If pending: say track analysis is still running and downstream sonic phases must wait or use explicit user-provided context.>

## Data sources

- `get_asset_upload_link` asset creation: <timestamp or "not used - existing asset">
- `confirm_asset_upload`: <timestamp or "not used - existing asset">
- `get_asset`: <timestamp>, returned <analysis_complete | analysis_pending | analysis_failed>
```

Use "track analysis" in user-facing prose. Vendor-specific field names from raw MCP JSON can stay in internal data-source notes only if needed for debugging.

## Step 9: Update STATE.md

If analysis is complete:

- Append `- audio-intake - completed YYYY-MM-DD, artifact: AUDIO_INTAKE.md` to `Completed phases:`.
- Append `- AUDIO_INTAKE.md (audio-intake phase, generated YYYY-MM-DD)` to `Artifacts:`.
- Set or update `Focus track asset ID`, `Audio status: uploaded`, `Track analysis status: analysis_complete`, and `Last updated`.
- Clear any audio-analysis blocker.

If analysis is pending or failed:

- Write/update the focus-track fields.
- Set `Track analysis status: analysis_pending` or `analysis_failed`.
- Add or update a blocker.
- Do not append `audio-intake` to `Completed phases`.

Do not edit `Current phase`. `/aria:next` is the only skill that writes that field.

## Step 10: Hand Off

If complete:

> Track uploaded and analyzed. Focus asset: `<assetId>`. Run `/aria:next` to move into creative-brief; I will use the audio features instead of asking you to describe the sound from scratch.

If pending:

> Track uploaded and track analysis is still processing. I wrote asset `<assetId>` into STATE.md and left audio-intake incomplete so we do not build strategy on a blind read. Re-run `/aria:audio-intake` later; it will resume without re-uploading.

## Error Handling

- MCP auth expired - tell the user to run `/mcp`, reconnect `plugin:aria:aria`, then re-run `/aria:audio-intake`.
- Local file path missing - ask for a corrected path or an existing Patchline asset ID.
- Upload-link quota/limit error - surface the exact error and stop.
- PUT upload fails - write `upload_failed`, keep audio-intake incomplete, and include HTTP status.
- Confirmation fails - write `confirm_failed`, keep audio-intake incomplete, and include exact MCP error.
- Analysis remains pending after polling - record clean pending state; this is not a failure.

## Examples

User provides `C:\Music\Clouds Final.wav`: confirm the title as `Clouds Final` if it differs from PROJECT.md, upload with `get_asset_upload_link`, confirm with `confirm_asset_upload`, collect campaign intake while analysis runs, then poll until complete or cleanly pending.

User provides an existing asset ID: skip upload, call `get_asset` / `get_audio_features`, capture campaign intake, then complete or leave pending based on track-analysis status.

## Common Mistakes

- Asking "describe the sound" before attempting upload and analysis for completed tracks.
- Marking audio-intake complete while track analysis is still pending.
- Printing the full signed upload URL in normal output.
- Streaming binary audio through MCP.
- Advancing `Current phase` yourself.
