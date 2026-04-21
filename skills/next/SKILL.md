---
name: next
description: Advance an Aria-managed project to its next lifecycle phase. Reads `.patchline/STATE.md`, determines which phase should run, and routes into that phase's skill. Respects the composition-status branch — projects with finished music skip the songwriting-brief phase. Handles state drift (STATE.md says phase X but artifact X.md is missing) by re-running the incomplete phase rather than advancing. Invoke via `/aria:next`.
argument-hint: "[optional — no arguments expected; reads state from .patchline/]"
model: claude-sonnet-4-6
prerequisites:
  - start
allowed-tools:
  - Read
  - Edit
  - Bash
  - Glob
  - AskUserQuestion
  - aria
---

## Your Task

Orchestrate the Aria lifecycle. You do not produce artifacts yourself — you read `.patchline/STATE.md`, figure out which phase the user should run next, and route them into that phase's skill (which then produces the artifact).

By the end of this skill the user will either:
1. Be told exactly which phase is about to run + what it will produce, and will see that phase's skill execute, OR
2. Be told the workspace doesn't exist (and pointed at `/aria:start`), OR
3. Be told the chain is complete (and given follow-up suggestions).

You never skip a phase silently. You never invent a phase order that deviates from the canonical chain below.

## Supporting files

- [`../../CLAUDE.md`](../../CLAUDE.md) — voice, workspace contract, skill-chaining overview
- [`../start/SKILL.md`](../start/SKILL.md) — predecessor, creates the workspace you read
- [`../creative-brief/SKILL.md`](../creative-brief/SKILL.md), [`../vision-story/SKILL.md`](../vision-story/SKILL.md), [`../moodboard/SKILL.md`](../moodboard/SKILL.md), [`../songwriting-brief/SKILL.md`](../songwriting-brief/SKILL.md), [`../release-plan/SKILL.md`](../release-plan/SKILL.md), [`../rollout/SKILL.md`](../rollout/SKILL.md), [`../pitch-kit/SKILL.md`](../pitch-kit/SKILL.md), [`../smart-link/SKILL.md`](../smart-link/SKILL.md) — the phase skills you dispatch to

## The canonical chain

```
start
  → creative-brief
    → vision-story
      → moodboard
        → [songwriting-brief — SKIPPED if compositionStatus == complete]
          → release-plan
            → rollout
              → pitch-kit
                → smart-link
```

`start` is not a phase the user re-runs via `/aria:next` — it's a separate entry point. Your responsibility starts at `creative-brief` and ends at `smart-link`.

## Step 1: Check the workspace exists

Run `ls .patchline/PROJECT.md` via Bash. Three outcomes:

- **`.patchline/` does not exist** → STOP. Tell the user: "No Aria workspace in this directory yet. Run `/aria:start` first — I'll bootstrap `.patchline/` with your artist identity and project scope, then `/aria:next` picks up from there."
- **`.patchline/` exists but `PROJECT.md` is missing** → STOP. Tell the user: "`.patchline/` exists but `PROJECT.md` is missing — the workspace is half-built. Either run `/aria:start` to rebuild, or restore PROJECT.md from a backup/git history."
- **Both exist** → proceed to Step 2.

## Step 2: Read state

Use Read on these three files:

- `.patchline/STATE.md` — extract: `Current phase:`, `Completed phases:`, `Composition status:`, `Distribution mode:`
- `.patchline/PROJECT.md` — extract: artist name, project name (you'll use these in the hand-off message)
- `ls .patchline/artifacts/` via Bash — capture the actual list of artifact files on disk

Normalize the current phase string. Valid values:
- `creative-brief`
- `vision-story`
- `moodboard`
- `songwriting-brief`
- `release-plan`
- `rollout`
- `pitch-kit`
- `smart-link`
- `complete` (the chain is done)

If `STATE.md` has a `Current phase:` value outside this set, STOP and tell the user: "STATE.md has an unrecognized current phase: `<value>`. Valid phases are: creative-brief, vision-story, moodboard, songwriting-brief, release-plan, rollout, pitch-kit, smart-link, or complete. Edit STATE.md to set a valid phase, then re-invoke."

## Step 3: Detect state drift

STATE.md and the artifact files must agree. "State drift" means STATE.md claims a phase is complete but its artifact is missing, OR STATE.md points to a current phase whose PREDECESSOR artifact is missing.

Build the expected-artifacts list from `Completed phases:` in STATE.md:

| Completed phase | Expected artifact file |
|---|---|
| creative-brief | `BRIEF.md` |
| vision-story | `VISION.md` |
| moodboard | `MOODBOARD.md` |
| songwriting-brief | `SONGWRITING.md` |
| release-plan | `RELEASE_PLAN.md` |
| rollout | `ROLLOUT.md` |
| pitch-kit | `PITCH_KIT.md` |
| smart-link | `LAUNCH.md` |

Compare against the actual file list from Step 2. Two drift cases:

- **Case A — STATE says phase X is complete but artifact X is missing on disk.** STOP. Tell the user: "STATE.md says `<phase>` is complete but its artifact `<filename>` is missing from `.patchline/artifacts/`. The workspace and state disagree. Choose: (a) re-run `<phase>` by hand-editing STATE.md `Current phase:` back to `<phase>` and re-invoking, or (b) if the artifact is in git/backup, restore it. I won't advance past this drift."
- **Case B — STATE says `Current phase: X` and phase X's PREDECESSOR artifact is also missing.** Treat this as drift in the predecessor — set the phase-to-run to that missing predecessor instead of X. Tell the user: "STATE.md pointed at `<X>` but `<predecessor>`'s artifact is missing. Running `<predecessor>` first to restore the chain."

If neither drift case applies, proceed to Step 4.

## Step 4: Apply the composition-status branch

Read `Composition status:` from STATE.md. Values and their effects on the chain:

- `complete` → after `moodboard`, the next phase is `release-plan` (songwriting-brief is SKIPPED entirely — not re-run, not deferred, just not in the chain for this project).
- `partial` or `writing` → after `moodboard`, the next phase is `songwriting-brief`, then `release-plan`.
- missing / unrecognized → STOP. Tell the user: "STATE.md is missing `Composition status:` (valid: complete, partial, writing). Set it by hand-editing STATE.md, then re-invoke."

Store the effective chain for this invocation:

- If `complete`: `[creative-brief, vision-story, moodboard, release-plan, rollout, pitch-kit, smart-link]`
- If `partial` or `writing`: `[creative-brief, vision-story, moodboard, songwriting-brief, release-plan, rollout, pitch-kit, smart-link]`

## Step 5: Pick the phase to run

Walk the effective chain in order. Find the first phase that is NOT in `Completed phases:` — that's the phase to run.

Edge cases:

- **All phases complete** → tell the user: "Aria chain complete — all 8 phases shipped (or 7 if you skipped songwriting-brief). Your `.patchline/artifacts/` holds BRIEF, VISION, MOODBOARD, [SONGWRITING,] RELEASE_PLAN, ROLLOUT, PITCH_KIT, LAUNCH. Follow-ups worth considering: (a) `/aria:next` after editing STATE.md back to a phase to re-run it, (b) wait for PR #468 and re-run `/aria:start` to sync artifacts to your Patchline Project, (c) use the pitch kit — the plugin drafted them but you still need to send them." Do not run anything.
- **`Current phase:` in STATE.md doesn't match the first-incomplete walk result** → trust the walk. The chain is the source of truth, `Current phase:` is a convenience pointer that can go stale if the user hand-edits `Completed phases:`. Tell the user: "STATE.md's `Current phase:` pointer was stale (`<stale value>`). Running `<actual next phase>` based on completed-phases ledger."

## Step 6: Announce-and-stop (NOT inline execution)

In Claude Code, each skill runs in its own dispatch envelope — its own `model:` (opus for `release-plan` and `pitch-kit`, sonnet elsewhere), its own `allowed-tools:` list. `next` is a router, not an executor. Inline-executing the phase skill via `Read` bypasses both — the phase skill's model hint is ignored, and its allowed-tools aren't enforced. That's dishonest.

Correct flow:

1. **Update STATE.md `Current phase:`** to match the phase you just picked in Step 5. This is the ONE field `next` is authorized to write. Use the Edit tool on `.patchline/STATE.md`.
2. **Announce** to the user, in ≤3 sentences:
   - Which phase is about to run
   - Which artifact it will produce
   - How to invoke it: the exact slash command `/aria:<phase>`
3. **Stop.** Do NOT attempt to run the phase skill yourself. Do NOT ask interview questions for it. Wait for the user to run the slash command.

Example announcement:
> Next up: `vision-story` — produces `VISION.md` (sonic identity, reference artists, narrative positioning). It's grounded in `get_trending_artists` + `search_artists` for your peer landscape.
>
> Run `/aria:vision-story` when ready. It'll ask you 3–4 questions and write the artifact.

## Step 7: Authority split — what `next` writes, what phase skills write

- **`next` writes:** `Current phase:` in STATE.md (authority). Nothing else.
- **Phase skills write:** append to `Completed phases:` at the end of their flow. They do NOT touch `Current phase:` — `next` is the sole writer.

This eliminates the split-brain that existed when both `next` and phase skills wrote `Current phase:`. Whenever STATE.md's `Current phase:` is stale (e.g. user hand-edited `Completed phases:`), Step 5's fresh chain walk is the tiebreaker — `next` updates `Current phase:` to match in Step 6.1.

If you (as the `next` skill) find yourself wanting to write `Completed phases:`, STOP. That's the phase skill's job. If you find a phase skill's body trying to write `Current phase:`, that's a bug in that skill — flag it and continue; do not attempt to "help" by writing it yourself.

## Error handling

- **`.patchline/` doesn't exist** → Step 1, point at `/aria:start`.
- **`.patchline/STATE.md` unreadable** (permission error, corrupt markdown) → surface the exact error, tell the user: "Can't read STATE.md — `<error>`. Check file permissions or restore from git. Don't delete `.patchline/` — PROJECT.md and artifacts are fine."
- **State drift (Case A)** → Step 3, stop and ask the user to resolve.
- **State drift (Case B)** → Step 3, run the missing predecessor.
- **Unrecognized `Current phase:`** → Step 2, stop.
- **Missing `Composition status:`** → Step 4, stop.
- **Phase skill file `plugin/skills/<phase>/SKILL.md` missing** (shouldn't happen in a real install, but possible in dev worktrees) → STOP. Tell the user: "The `<phase>` skill file is missing from this plugin install. Re-install the plugin via `/plugin install aria` or check out a complete git ref."
- **User's MCP auth expired mid-dispatch** → the downstream phase skill handles this; don't pre-empt.

## Examples

### Happy path — advancing from creative-brief to vision-story

```
User: /aria:next
You (reads STATE.md — Current phase: creative-brief, Completed phases:
     creative-brief; reads PROJECT.md — Vintage Culture, "Midnight Oil";
     ls artifacts/ — BRIEF.md present; Step 5 walk → next phase is
     vision-story):

  (updates STATE.md Current phase: vision-story)

  Next up: vision-story — produces VISION.md (sonic identity, reference
  artists, narrative positioning). Grounded in get_trending_artists +
  search_artists for your peer landscape.

  Run `/aria:vision-story` when ready. It'll ask you 3–4 questions and
  write the artifact, then append itself to Completed phases.

User: /aria:vision-story
(separate skill invocation runs; next's job here is done)
```

### Composition-status branch — skipping songwriting-brief

```
User: /aria:next
You (reads STATE.md — Completed phases: creative-brief, vision-story,
     moodboard; Composition status: complete; Step 5 walk with `complete`
     chain → next phase is release-plan):

  (updates STATE.md Current phase: release-plan)

  Your composition status is `complete` — songwriting-brief is skipped.

  Next up: release-plan — produces RELEASE_PLAN.md (schedule,
  distribution, playlist targets). Grounded in get_releases for calendar
  collisions + find_playlists seeded from your anchor track in
  MOODBOARD.md.

  Run `/aria:release-plan` when ready.
```

### State drift — artifact missing

```
User: /aria:next
You (reads STATE.md — Completed phases: creative-brief, vision-story,
     moodboard; ls artifacts/ — MOODBOARD.md missing):
  STATE.md says moodboard is complete but MOODBOARD.md is missing from
  .patchline/artifacts/. The workspace and state disagree.

  Choose:
    (a) Re-run moodboard — hand-edit STATE.md to move moodboard out of
        Completed phases and set Current phase: moodboard, then re-invoke
    (b) If MOODBOARD.md is in git or a backup, restore it to
        .patchline/artifacts/ and re-invoke

  I won't advance past this drift.
```

### Chain complete

```
User: /aria:next
You (reads STATE.md — Current phase: complete, all 8 phases in
     Completed phases):
  Aria chain complete — BRIEF, VISION, MOODBOARD, SONGWRITING,
  RELEASE_PLAN, ROLLOUT, PITCH_KIT, LAUNCH all shipped for "Midnight
  Oil". The artifacts are in .patchline/artifacts/.

  Follow-ups worth considering:
    - Send the pitches. I drafted them; you deliver them.
    - After PR #468 ships, re-run /aria:start to sync artifacts into
      your Patchline Project container.
    - Want to re-run a phase? Hand-edit STATE.md — remove it from
      Completed phases, set Current phase: <phase>, then /aria:next.
```

### No workspace

```
User: /aria:next
You (ls .patchline/ — doesn't exist):
  No Aria workspace in this directory yet. Run /aria:start first — I'll
  bootstrap .patchline/ with your artist identity and project scope,
  then /aria:next picks up from there.
```

## Common mistakes (don't make these)

- **Writing `Completed phases:` from `next`.** That's the phase skill's job. `next` only writes `Current phase:`. Never both.
- **Trying to inline-execute the phase skill.** Reading `plugin/skills/<phase>/SKILL.md` and following its steps in-turn bypasses the phase's model + allowed-tools envelope. That's dishonest. Announce + stop.
- **Ignoring `Composition status: complete` and running songwriting-brief anyway.** The whole point of R11's branch is that projects with finished music don't need it. Read the status every time; respect it every time.
- **Silently running the next phase when an artifact is missing upstream.** If MOODBOARD.md is missing but STATE.md says we're on release-plan, release-plan will produce garbage — it has no sonic reference to plan against. Re-run moodboard first.
- **Inventing user answers to chain multiple phases in one turn.** Each phase interviews the user. You ask one question, you stop, you wait for the human. No speed-running.
- **Trusting `Current phase:` over the `Completed phases:` ledger.** Users hand-edit STATE.md. The pointer can go stale. The canonical signal is which phases are in `Completed phases:`; walk the chain from there.
