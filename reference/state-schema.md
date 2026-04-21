# STATE.md schema

> Canonical reference for `.patchline/STATE.md`, the lifecycle ledger every Aria skill reads and writes. If you're writing a new skill (first-party or community), this is the contract you conform to.

---

## 1. Purpose

`.patchline/STATE.md` is the single source of truth for:

- Which lifecycle phase the project is currently in
- Which phases have completed (and when, producing which artifact)
- Which phases are blocked (and why)
- Project-wide settings that affect chain routing: `Distribution mode`, `Composition status`, `Patchline persistence`

Every Aria skill is expected to:

- **Read** STATE.md at the start to establish context
- **Write** STATE.md at the end (if the skill produced an artifact) — append-only: append itself to `Completed phases:`, append its artifact to `Artifacts:`, and bump the `Last updated:` footer. **Phase skills do NOT write `Current phase:`. Only the `next` router writes that field** (see §4 authority split).

STATE.md is plaintext markdown on purpose. Users can hand-edit. If they hand-edit, the next skill respects the edit — skills trust the ledger over their own assumptions.

---

## 2. File location

Always `.patchline/STATE.md` in the user's current working directory. Not in `~/.patchline/`, not in any parent directory, not in `.patchline/artifacts/`. Exactly one per project, sitting next to `PROJECT.md`.

```
<cwd>/
  .patchline/
    PROJECT.md      ← artist identity + project scope
    STATE.md        ← THIS FILE — lifecycle ledger
    artifacts/
      BRIEF.md
      VISION.md
      ...
```

Skills locate it via `Read` on the absolute or relative path. The `start` skill creates it. No other skill creates it; they all Edit.

---

## 3. Schema

STATE.md is structured as markdown sections. Skills parse by looking for the canonical heading, then extracting the value that follows. Exact spelling matters — skills do literal string matching on heading text.

### 3.1 `# State` (top heading)

A single H1 at the top, plus an optional descriptive blockquote. Not parsed — for human readability.

```markdown
# State

> Canonical lifecycle ledger. Updated by each skill upon successful completion.
```

**Written by:** `start`. Never modified after.

---

### 3.2 `## Current phase`

The phase the project is currently in. Points to the NEXT phase to run, or `complete` if the lifecycle is done.

```markdown
## Current phase

`<phase-name>` — pending. Run `/aria:next` to begin.
```

**Valid values for `<phase-name>`:**

- `creative-brief`
- `vision-story`
- `moodboard`
- `songwriting-brief`
- `release-plan`
- `rollout`
- `pitch-kit`
- `smart-link`
- `complete`

**Set by:**
- `start` initializes to `creative-brief — pending`
- Each phase skill advances this field to its successor when the phase completes
- `smart-link` sets it to `complete` when the final phase ships
- User can hand-edit to re-run a phase (set to an earlier phase name, also remove that phase from `Completed phases:`)

**Parsing convention:** skills look for the line `\`<phase>\` — pending` or similar. Anything in backticks immediately after the `## Current phase` heading is the phase name.

---

### 3.3 `## Completed phases`

The authoritative ledger of which phases have shipped. This is the source of truth for chain routing (`next.md` walks the chain against this list, not against `Current phase`).

```markdown
## Completed phases

- creative-brief — completed 2026-04-18, artifact: BRIEF.md
- vision-story — completed 2026-04-18, artifact: VISION.md
- moodboard — completed 2026-04-19, artifact: MOODBOARD.md
```

**Format:** one bullet per completed phase. Each bullet: `<phase-name> — completed YYYY-MM-DD, artifact: <ARTIFACT_NAME>.md`

Phase skills may optionally append an inline note — e.g. `pitch-kit` appends `(<N> playlist pitches, <N> ghost playlists flagged)`. Note is free-text; not parsed.

**Set by:** every phase skill, appending to the list upon successful completion. Never removed programmatically — only the user hand-edits to invalidate a phase (for re-runs).

**Initial value:** the `start` skill writes `(none yet)` as a placeholder. First phase to complete replaces the placeholder with its bullet.

---

### 3.4 `## Artifacts`

Parallel listing of artifacts on disk. Duplicates information from `Completed phases:` but keyed on the file, not the phase. Makes state-drift detection easy.

```markdown
## Artifacts

- BRIEF.md (creative-brief phase, generated 2026-04-18)
- VISION.md (vision-story phase, generated 2026-04-18)
- MOODBOARD.md (moodboard phase, generated 2026-04-19)
```

**Format:** `<ARTIFACT_NAME>.md (<phase> phase, generated YYYY-MM-DD)`

**Set by:** every phase skill upon completion. Kept in sync with `Completed phases:`.

**Initial value:** `(none yet — populated under `.patchline/artifacts/` as phases complete)`.

---

### 3.5 `## Blockers`

Free-text list of open issues that prevent the chain from advancing cleanly. Rare — most blockers are surfaced in-session, not written to STATE.md. But persistent blockers (e.g. "waiting on label to confirm release date") belong here.

```markdown
## Blockers

- Label contact hasn't confirmed February release date — release-plan blocked until that lands.
```

**Format:** free-text bullets. One per blocker.

**Set by:** any skill that detects a persistent blocker. User can also hand-edit.

**Initial value:** `(none)`.

---

### 3.6 `## Distribution mode`

Set once at `start`; determines whether the project is self-released (user keeps all control / revenue) or label-coordinated (external calendar, external approvals). Affects `release-plan`, `rollout`, and `smart-link` flows.

```markdown
## Distribution mode

`self_releasing` | `with_label` — set at bootstrap, can be changed later via hand-edit.
```

**Valid values:**
- `self_releasing` — artist distributes via DistroKid / Symphonic / Stem / etc.; no external calendar.
- `with_label` — project is running on a label's timeline; downstream skills will ask for label contact + timeline constraints.

**Set by:** `start` (from the user's answer at Step 3). Can be hand-edited later if the project switches (e.g. picked up by a label mid-flight).

**Parsing convention:** skills look for the backtick-quoted value in the paragraph following the heading.

---

### 3.7 `## Composition status`

Set once at `start`; determines whether the `songwriting-brief` phase runs. This is the composition-status branch from R11.

```markdown
## Composition status

`complete` | `partial` | `writing` — set at bootstrap. Determines whether `songwriting-brief` phase runs. If `complete`, `next` skips directly from `moodboard` to `release-plan`.
```

**Valid values:**
- `complete` — final mixes / masters exist. Chain is `creative-brief → vision-story → moodboard → release-plan → rollout → pitch-kit → smart-link` (7 phases).
- `partial` — rough sketches / demos exist, still writing. Chain includes `songwriting-brief` (8 phases).
- `writing` — starting from zero, no audio. Chain includes `songwriting-brief` (8 phases).

**Set by:** `start`. Read by `next` to route the chain.

**Parsing convention:** skills look for the backtick-quoted value in the paragraph following the heading.

---

### 3.8 `## Patchline persistence`

Feature-flag section (R8 / PR #468). Captures whether the MCP `create_project` tool was available at `start` — if so, future skills are expected to sync artifacts to the user's Patchline Project container. Until #468 ships to prod, this is always `OFF`.

```markdown
## Patchline persistence

Persistence: OFF — artifacts live on disk only. Project sync is not available in the public MCP yet.
```

**Valid values:**
- `Persistence: OFF — artifacts live on disk only. Project sync is not available in the public MCP yet.`

**Set by:** `start` at bootstrap. Current public Aria is local-workspace only; do not probe for or reference `mcp__aria__create_project` until the MCP server actually exposes project-sync tools.

---

### 3.9 Footer: `Last updated` line

```markdown
---

Last updated: 2026-04-19 by `/aria:next` (creative-brief skill)
```

**Format:** `Last updated: YYYY-MM-DD by \`/aria:<command>\` (<skill-name> skill)` or similar. Not parsed programmatically — purely for human debugging.

**Set by:** every skill that edits STATE.md.

---

## 4. Chain-routing logic

The `next` skill's decision tree, in pseudocode. This is the canonical algorithm — if you're writing a community skill that wants to route based on state, use this.

```
function pick_next_phase(state):
    # Step 1: no workspace
    if not exists(".patchline/PROJECT.md"):
        return "run /aria:start first"

    # Step 2: parse STATE.md
    current_phase = state.current_phase         # from `## Current phase`
    completed     = state.completed_phases      # from `## Completed phases` bullet list
    comp_status   = state.composition_status    # from `## Composition status`

    # Step 3: chain complete?
    if current_phase == "complete":
        return "lifecycle complete — see LAUNCH.md for next steps"

    # Step 4: determine the effective chain based on composition-status branch
    if comp_status == "complete":
        chain = [
            "creative-brief",
            "vision-story",
            "moodboard",
            "release-plan",     # songwriting-brief SKIPPED
            "rollout",
            "pitch-kit",
            "smart-link",
        ]
    elif comp_status in ("partial", "writing"):
        chain = [
            "creative-brief",
            "vision-story",
            "moodboard",
            "songwriting-brief",
            "release-plan",
            "rollout",
            "pitch-kit",
            "smart-link",
        ]
    else:
        return "error: Composition status missing / invalid"

    # Step 5: state-drift check (see §5)
    for completed_phase in completed:
        if not exists(".patchline/artifacts/" + expected_artifact_for(completed_phase)):
            return "drift: re-run " + completed_phase

    # Step 6: pick first incomplete phase in the chain
    for phase in chain:
        if phase not in completed:
            return phase

    # All chain phases are in completed but current_phase isn't "complete" — ledger is ahead
    return "lifecycle complete — update Current phase to `complete`"
```

**Key invariants (authority split):**

- `Completed phases:` is the AUTHORITATIVE signal for what's shipped. The `next` router walks the chain against this list.
- `Current phase:` is a router-maintained pointer. **Only `next` writes it** — phase skills never touch it. This eliminates the split-brain that existed when both `next` and phase skills could write `Current phase:`.
- **Phase skills write:** append to `Completed phases:`, append to `Artifacts:`, bump `Last updated:`. Nothing else.
- **`next` writes:** `Current phase:` — updates it before announcing which phase will run. Sole writer.
- If `Current phase:` drifts (e.g. user hand-edits `Completed phases:`), `next`'s fresh chain walk is authoritative — it overwrites the pointer to match reality.
- The composition-status branch is evaluated every `next` invocation — if the user hand-edits `Composition status:` mid-cycle, `next` respects the new value.
- When the chain is complete (all phases in `Completed phases:`), `next` writes `Current phase: complete` as the final state. Phase skills — even the last one (`smart-link`) — do not write this themselves.

---

## 5. State-drift detection

State drift: STATE.md and the files on disk disagree. Every skill that depends on upstream artifacts MUST check for drift before proceeding.

### Case A — "Phase complete, artifact missing"

STATE.md `Completed phases:` lists phase X, but `.patchline/artifacts/<ARTIFACT>.md` doesn't exist.

**Expected artifact map:**

| Phase | Artifact filename |
|---|---|
| `creative-brief` | `BRIEF.md` |
| `vision-story` | `VISION.md` |
| `moodboard` | `MOODBOARD.md` |
| `songwriting-brief` | `SONGWRITING.md` |
| `release-plan` | `RELEASE_PLAN.md` |
| `rollout` | `ROLLOUT.md` |
| `pitch-kit` | `PITCH_KIT.md` |
| `smart-link` | `LAUNCH.md` |

**Handling:** STOP. Surface to user: "STATE.md says `<phase>` is complete but `<artifact>` is missing from `.patchline/artifacts/`. The workspace and state disagree." Offer two options: (a) re-run the phase (user hand-edits STATE.md to remove the phase from `Completed phases:` and sets `Current phase:` to it, then re-invokes), (b) restore the artifact from git / backup.

**Why STOP rather than auto-re-run:** auto-re-running would overwrite any downstream artifacts that DID get produced after the missing one. The user needs to explicitly sign off on the invalidation.

### Case B — "Current phase's predecessor is missing"

STATE.md `Current phase:` is phase X, X's predecessor is Y, and Y's artifact is missing (regardless of what `Completed phases:` says).

**Handling:** treat as drift IN the predecessor. Run phase Y first to restore the chain. Tell the user: "STATE.md pointed at `<X>` but `<Y>`'s artifact is missing. Running `<Y>` first to restore the chain."

This is distinct from Case A — here, the user may never have produced Y's artifact, or may have deleted it and then hand-edited STATE.md past it. Either way, Y needs to exist before X can run meaningfully.

### Case C — `Current phase` is unrecognized

STATE.md has a `Current phase:` value outside the valid list (§3.2).

**Handling:** STOP. Tell the user: "STATE.md has an unrecognized current phase: `<value>`. Valid phases are: creative-brief, vision-story, moodboard, songwriting-brief, release-plan, rollout, pitch-kit, smart-link, complete. Edit STATE.md and re-invoke."

### Case D — `Composition status` missing or invalid

See §3.7. STOP. Tell the user to set it.

---

## 6. Evolution notes

STATE.md will grow over milestones. Keep it backwards-compatible.

### Coming soon: PR #468 (Patchline Projects)

When #468 merges to prod, `Patchline persistence: ON` will mean skills sync each artifact to the user's Project container (tool `create_project` / `update_project`). The STATE.md schema gains:

- `## Patchline Project ID` — the `project_id` returned by `create_project` on first sync
- Inline notation on each `Completed phases:` bullet: `... — synced to Patchline project <id> YYYY-MM-DD`

These are additive. Skills that don't know about them will ignore them; skills that do will look for them opt-in.

### Coming later: verify-phase (backlog B1 / NT1)

When `get_streaming_stats` / `get_playlist_pickup` MCP tools ship, a 9th phase `verify` is added. STATE.md gains:

- `verify` added to the valid `Current phase:` values (§3.2)
- `verify` added to both composition-status chains in §4
- A new `## Verify checkpoints` section tracking T+24h / T+72h / T+7d / T+30d runs

Backwards-compat: old STATE.md files won't have these fields. New skills read them with `Get(default=…)` semantics — if absent, treat as "not configured".

### Community extensibility

Third-party skills that plug into the chain via `prerequisites:` (R12) can ADD sections to STATE.md as long as they namespace them clearly. Example: a `sync-licensing-brief` community skill might write:

```markdown
## Community: sync-licensing

- sync-brief generated 2026-04-19, targeted at film supervisors
```

Rules for community sections:

- Prefix with `Community: ` to make it clear they're not first-party
- Don't modify first-party sections (§3.2–§3.9)
- Don't assume a specific phase ordering beyond what's declared in the skill's `prerequisites:`

### Parsing contract — always explicit keys

Never positional. Skills parse by `## <Exact Heading>` lookup, then extract the value. If the schema adds new sections, existing skills should ignore them gracefully.

Good:
```
current_phase = state.extract_after_heading("## Current phase")
```

Bad:
```
current_phase = state.lines[3]  # depends on section ordering
```

---

## 7. Example — a fully populated STATE.md mid-cycle

```markdown
# State

> Canonical lifecycle ledger. Updated by each skill upon successful completion.

## Current phase

`pitch-kit` — pending. Run `/aria:next` to begin.

## Completed phases

- creative-brief — completed 2026-04-18, artifact: BRIEF.md
- vision-story — completed 2026-04-18, artifact: VISION.md
- moodboard — completed 2026-04-19, artifact: MOODBOARD.md
- release-plan — completed 2026-04-19, artifact: RELEASE_PLAN.md
- rollout — completed 2026-04-19, artifact: ROLLOUT.md

## Artifacts

- BRIEF.md (creative-brief phase, generated 2026-04-18)
- VISION.md (vision-story phase, generated 2026-04-18)
- MOODBOARD.md (moodboard phase, generated 2026-04-19)
- RELEASE_PLAN.md (release-plan phase, generated 2026-04-19)
- ROLLOUT.md (rollout phase, generated 2026-04-19)

## Blockers

(none)

## Distribution mode

`self_releasing` — set at bootstrap, can be changed later via hand-edit.

## Composition status

`complete` — set at bootstrap. songwriting-brief was SKIPPED based on this value.

## Patchline persistence

Persistence: OFF — artifacts live on disk only. Project sync is not available in the public MCP yet.

---

Last updated: 2026-04-19 by `/aria:next` (rollout skill)
```

This STATE.md says: project is mid-flight, 5 phases shipped (songwriting-brief legitimately skipped because Composition status is `complete`), pitch-kit is next, no blockers, self-releasing, persistence is off pending #468.

A skill reading this file can confidently:
- Pick up with `pitch-kit` (chain order, `Completed phases:` walk, composition-status branch applied)
- Read prior artifacts from disk — all present (no drift)
- Use self_releasing flows (no label coordination needed)
- Skip any Patchline-Project sync logic (persistence OFF)
