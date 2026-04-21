---
name: rollout
description: "Sixth lifecycle phase. Produces ROLLOUT.md — a week-by-week content + outreach calendar running from announce through release-day to +4 weeks post-release. Reads RELEASE_PLAN.md for dates, playlist targets, and DSP priorities; reads VISION.md so the content cadence matches the narrative already established. Optionally re-runs `find_playlists(assetId, limit)` to widen the candidate pool and previews one pitch via `generate_pitch(artist_name, track_name, target_playlist)` — the real 3-arg signature, no draft mode. Invoked via `/aria:next` after `release-plan`."
argument-hint: "[optional — no arguments expected; reads context from .patchline/]"
model: claude-sonnet-4-6
prerequisites:
  - release-plan
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - AskUserQuestion
  - aria
---

## Your Task

Produce `.patchline/artifacts/ROLLOUT.md` — a dated, week-by-week calendar that tells the artist (and any manager / label / collaborator) exactly what content is created, what channel it goes on, what action is taken, and who owns it, from announce (−6 weeks) through release day through +4 weeks post-release.

The rollout must match the narrative tone from VISION.md, use the playlist targets and dates from RELEASE_PLAN.md, and scope realistically to the artist's `promoBudgetTier`. No generic "post a teaser" advice — every row is concrete and grounded.

You will:
1. Read `RELEASE_PLAN.md` (dates, targets, DSPs) and `VISION.md` (narrative tone)
2. Optionally re-run `find_playlists` if release-plan targets need refining for specific rollout waves
3. Preview one pitch via `generate_pitch(artist_name, track_name, target_playlist)` — the real 3-arg signature (no draft mode) — as a shape sanity-check before `pitch-kit` runs the full per-playlist loop
4. Interview the user on content capacity, channels, live shows
5. Write `ROLLOUT.md` as a week-by-week table
6. Update `STATE.md` → advance to `pitch-kit`

## Supporting files

- [`../../CLAUDE.md`](../../CLAUDE.md) — voice, workspace contract, MCP grounding rules
- [`../release-plan/SKILL.md`](../release-plan/SKILL.md) — predecessor; this rollout is anchored to the dates and playlist targets written there
- [`../pitch-kit/SKILL.md`](../pitch-kit/SKILL.md) — successor; pitch-kit consumes the outreach wave dates written here

## Step 1: Read workspace context

Use Read, in order:

- `.patchline/PROJECT.md` — `distributionMode`, `compositionStatus`
- `.patchline/STATE.md` — confirm `Current phase: rollout`. If not, STOP.
- `.patchline/artifacts/RELEASE_PLAN.md` — extract: release date, territories, DSPs, playlist targets (all three tiers), editorial pitch window, promo budget tier, known conflicts, distribution mode + label coordination periods if any
- `.patchline/artifacts/VISION.md` — extract: sonic identity one-liner, narrative arc, reference artists. The rollout's content notes should echo this tone — if VISION says "intimate, late-night, minimal", the rollout can't recommend "big colorful festival-vibe teasers".
- `.patchline/artifacts/BRIEF.md` — non-negotiables, audience

If `ROLLOUT.md` already exists, ask: "A ROLLOUT.md already exists. Overwrite, or refine in place?"

## Step 2: Optional MCP refinement

### Refine playlist targets if needed (real schema only)

`release-plan` already locked the main targets via `find_playlists(assetId: <anchor>, limit: N)` — seeded from the focus-track asset in MOODBOARD.md. If rollout needs to widen the pool for a second-wave push, the ONLY knobs the tool exposes are:

- `assetId` (required, unless `spotifyUrl` is provided instead) — the focus track
- `spotifyUrl` (alternative to `assetId`)
- `limit` (1–25, default 10) — ask for more candidates than release-plan did

There is no `genre` filter, no `freshness_days` threshold, no `country`/`territories` filter, no `tier_preference`. Do NOT pass those — Zod silently strips them, and you'd just be getting the same candidate set release-plan already has.

Rule of thumb: only re-run `find_playlists` if RELEASE_PLAN.md's top-10 list feels thin for rollout's needs. Call with `find_playlists(assetId: <anchor from MOODBOARD>, limit: 25)` to surface ranks 11–25 not previously captured. Do not re-pull on every rollout invocation — most of the time the release-plan targets are enough.

Regional editorial variants (BR vs DE vs US editorials) are a real product concern but there's no MCP tool to resolve them today. Note in the artifact that territory-specific editorial pitches should be queued manually if RELEASE_PLAN.md's targets are US-only and the release is multi-market. Don't pretend MCP handles this.

### Preview pitch shape (not final pitches)

Call `mcp__aria__generate_pitch` with the real 3-arg signature:
- `artist_name` (required) — from PROJECT.md
- `track_name` (optional) — focus track title from RELEASE_PLAN.md
- `target_playlist` (optional) — pick the top Tier 1 editorial target from RELEASE_PLAN.md as a string

That's it. There is **no** `mode: 'draft'` argument — the tool has exactly 3 keys and Zod strips anything else. Treat every call as a normal, committed pitch — the pitch the tool returns is what the tool returns, regardless of intent. `pitch-kit` later will call it again per-playlist with full context; this call is just for shape-sanity in this phase.

You're not writing the final pitches here — you're verifying a sample pitch renders cleanly for the top target so you know `pitch-kit` will have workable content. If the returned pitch is weak, thin, or error'd, flag in the rollout artifact that `pitch-kit` may need more user-provided context or a re-auth.

If `generate_pitch` errors: note the error in the rollout artifact's Data Sources section, flag that `pitch-kit` may need a re-auth or different inputs, continue the rollout synthesis without it.

## Step 3: Interview (3–5 focused questions)

One question per turn. Rollout depends on how much the artist can actually make + ship.

### The five pillars

1. **"How much content can you make yourself between now and release?"** — Be concrete. Get numbers. Three sub-categories, bundled into one turn:
   - Photos: <N> new shoots / how many usable images total?
   - Short video (vertical, 15–60s): <N> clips?
   - Long video (music video, live session, behind-the-scenes): <yes/no + which>?
   
   If they say "whatever you need", push: "Give me a realistic cap — it's better to plan for 3 good clips than 10 you won't finish."

2. **"Which socials are you actually active on?"** — Accept any combination: Instagram, TikTok, X, Threads, YouTube, Bluesky, Mastodon, Discord, Reddit. Flag which are primary vs secondary. If they say "all of them equally", push: "Which one do you post to without thinking about it?" That's the primary.

3. **"Do you have an email list — and how big?"** — Three buckets: `none`, `small (<1k)`, `meaningful (1k+)`. This determines whether the rollout can include an email-subscriber-first announce or whether it's all social. If they don't know the size, tell them to check — it's a 30-second lookup and it shapes the plan.

4. **"Live shows planned in the release window — ±4 weeks?"** — Shows are narrative anchors and content generators. Get specifics: venue, city, date, capacity tier (club / theater / festival). If no shows, that's fine — rollout relies entirely on digital.

5. **"Who's executing — just you, or do you have manager / label / team helping?"** — Determines the "Owner" column. Categories:
   - `solo` — artist does everything
   - `artist + manager` — manager handles outreach, artist handles content
   - `label-coordinated` (if `distributionMode == with_label`) — label marketing handles announce + editorial pitches, artist handles content + socials

### Optional 6th question

If `distributionMode == with_label`: "Does the label want any specific content formats or channels prioritized?" — labels often have preferred content templates (e.g. a specific portrait-style promo photo, a "label intro" video format).

## Step 4: Draft ROLLOUT.md

Use Write to create `.patchline/artifacts/ROLLOUT.md`. Calendar-style, scannable, concrete:

```markdown
# Rollout Calendar: <project-name>

> Generated by `/aria:next` (rollout skill) on YYYY-MM-DD · v1
> Grounded in: RELEASE_PLAN.md (release date: <date>), VISION.md (tone: <one-liner>), BRIEF.md (audience: <short>), `generate_pitch` draft preview, `find_playlists` supplementary queries if run.

## Window

**Announce (−6 weeks)**: <YYYY-MM-DD — calculated from release date>
**Release day**: <YYYY-MM-DD from RELEASE_PLAN.md>
**Window closes (+4 weeks)**: <YYYY-MM-DD>

## Capacity

- Content assets available: <N photos, N short video, long video yes/no> (from Interview Q1)
- Active socials: primary = <platform>, secondary = <platforms> (from Q2)
- Email list: <none | small | meaningful> (from Q3)
- Live shows in window: <list or "none"> (from Q4)
- Execution team: <solo | artist + manager | label-coordinated> (from Q5)
- Promo budget tier: <from RELEASE_PLAN.md> — scopes what "paid" actions are allowed

## Calendar

<If distributionMode == self_releasing:>

| Week | Date | Content | Channel | Action | Owner |
|---|---|---|---|---|---|
| −6w | YYYY-MM-DD | Announce post (VISION-aligned copy, best promo photo) | Primary social + email (if list exists) | Publish, pin, share | Artist |
| −5w | YYYY-MM-DD | First teaser clip (audio snippet 15–20s) | Primary social | Publish + cross-post | Artist |
| −4w | YYYY-MM-DD | Spotify-for-Artists editorial pitch submission | DSP | Submit via S4A | Artist / Manager |
| −4w | YYYY-MM-DD | Apple Music editorial submission (via distributor) | DSP | Submit via distributor | Artist / Manager |
| −3w | YYYY-MM-DD | Cover art reveal | All active socials | Publish | Artist |
| −2w | YYYY-MM-DD | Second teaser (visual — portrait or clip) | Primary + secondary socials | Publish + story/status | Artist |
| −2w | YYYY-MM-DD | Tier 2 curated playlist outreach begins | DM / email | Send pitches (draft in pitch-kit) | Artist / Manager |
| −1w | YYYY-MM-DD | Pre-save link goes live | All channels + email | Publish + CTA | Artist |
| −1w | YYYY-MM-DD | Friendly press / blog outreach | Email / DM | Send (via pitch-kit) | Artist / Manager |
| 0 | YYYY-MM-DD **RELEASE DAY** | Smart link live (from smart-link phase) | All channels | Announce, thank-you post, link everywhere | Artist |
| +1w | YYYY-MM-DD | Push to Tier 3 indie / niche curators | DM / submission forms | Send pitches | Artist |
| +1w | YYYY-MM-DD | Early analytics check-in (streams, saves, playlist adds) | Spotify for Artists | Screenshot, note, adjust | Artist |
| +2w | YYYY-MM-DD | Content refresh — BTS clip / reaction post / lyric visual | Primary social | Publish | Artist |
| +4w | YYYY-MM-DD | First-wave analytics full review | S4A + Apple Music for Artists | Compare to north-star metric from BRIEF.md | Artist / Manager |

<If distributionMode == with_label, add a parallel "Label coordination" column:>

| Week | Date | Content | Channel | Action | Artist owner | Label owner |
|---|---|---|---|---|---|---|
| −6w | YYYY-MM-DD | Announce post | Primary social + email | Publish, pin | Artist | Label: approves copy |
| −4w | YYYY-MM-DD | Spotify editorial pitch | DSP | Submit | Label (handles via label S4A) | Label |
| ... | | | | | | |

## Wave-by-wave notes

### Announce wave (−6w to −4w)

- **Tone anchor**: match VISION.md one-liner: *"<tone>"*
- **Copy templates**: handled in `pitch-kit` phase for outreach; social-post copy is artist's voice (not AI-generated unless user asks)
- **Known risk**: if content isn't ready by −6w, shift the whole calendar forward (don't compress — a rushed rollout is worse than a slightly-later one)

### Editorial pitch window (−4w to −3w)

- **Spotify-for-Artists**: submit via S4A — recommends 4 weeks out, no less. See RELEASE_PLAN.md Tier 1 targets.
- **Apple Music**: via distributor. If `distributionMode == with_label`, label handles this.
- **Pitch drafts**: generated in the `pitch-kit` phase (upcoming). Do not DM curators before `pitch-kit` ships.

### Pre-release content wave (−3w to −1w)

- **Content cadence**: 2 teasers + cover reveal + pre-save CTA. If capacity (Q1) can't cover all four, drop pre-save CTA first, then second teaser.
- **Cross-post logic**: primary social gets full content; secondary gets condensed version. No copy-paste identical posts.

### Release day (0)

- **Primary action**: announce via smart link (from `smart-link` phase, upcoming). Post on every active channel. Email list if exists.
- **Do NOT**: schedule this for 12:01 AM local — DSP editorial adds typically land Friday 00:00 UTC, giving you a 12-hour jump in some territories. Release-day post goes live 6–8 AM local.

### Post-release waves (+1w to +4w)

- **+1w**: push to non-editorial curators (Tier 3 from RELEASE_PLAN.md). Early analytics check.
- **+2w**: content refresh — keep the release alive past the launch-day spike.
- **+4w**: retrospective against BRIEF.md north-star metric. If the metric is hit, plan next release; if not, identify which wave underperformed and adjust future rollouts.

## Pitch preview (sanity-check from `generate_pitch` draft)

<If generate_pitch returned a usable draft:>
Sample editorial pitch shape (draft — final pitches in pitch-kit phase):

- **Hook**: <first line from draft>
- **Narrative**: <1–2 sentences from draft body>
- **Angle for <top Tier 1 playlist from RELEASE_PLAN>**: <angle line from draft>

This shape works. Phase 7 (`pitch-kit`) will generate one tailored pitch per Tier 1/2 target.

<If generate_pitch errored:>
`generate_pitch` preview failed (MCP returned: <error>). Phase 7 will need either a re-auth or more explicit narrative input — flag to user when they reach that phase.

## Promo budget tier constraints

**Promo tier: <none | modest | significant>**

<Based on tier, scope recommendations:>
- `none`: No paid ads. No PR retainer. No paid playlist services. All actions above are organic-only. Remove any "paid social boost" suggestions if they snuck in.
- `modest`: One paid-social boost per wave max (announce, cover reveal, release day). No PR retainer. One optional outreach service if they have one pre-existing.
- `significant`: Paid social across multiple waves, PR retainer active, targeted ad spend on release day + +1w. Label-coordinated if `distributionMode == with_label`.

## Known risks + contingencies

- **Content delay**: if photos / video not done by −4w, compress the teaser wave, not the editorial-pitch wave (editorial deadlines are hard).
- **Editorial rejection**: if Spotify/Apple editorial doesn't pick it up, the +1w Tier 3 push becomes the primary distribution wave — upgrade it from "push" to "lead with".
- **Calendar conflict**: <from RELEASE_PLAN.md Known Conflicts section — re-surface any that affect this window>
- **Composition status = writing**: if the music isn't final by −4w, the rollout stalls. Flagged.

## Data sources

- RELEASE_PLAN.md: release date + targets + DSPs + promo tier
- VISION.md: tone anchor
- BRIEF.md: audience + north-star metric
- `generate_pitch`: draft-mode preview at <timestamp>
- `find_playlists`: supplementary queries at <timestamp> if run, else "not re-run this phase"
- User interview: <date>, <N> questions answered

---

*This calendar assumes dates as written. Shift everything uniformly if release date moves; don't compress without revisiting editorial windows.*
```

### Grounding-quality checklist (self-check before writing)

- [ ] Every row has a concrete date (YYYY-MM-DD), not "week X"
- [ ] Every row has a specific channel, not "socials"
- [ ] Every row has an owner that matches the team structure from Q5
- [ ] Content cadence matches capacity from Q1 — don't recommend 10 teasers if they said 3
- [ ] Tone notes cite VISION.md — don't recommend "bright festival energy" if VISION says "intimate late-night"
- [ ] Paid recommendations are tier-scoped — no PR retainer in a `none` tier
- [ ] If `distributionMode == with_label`, the label-coordination column is populated
- [ ] Every playlist wave references RELEASE_PLAN.md tiers, no newly-invented targets
- [ ] Data sources section is truthful about what ran

If any check fails, fix it before writing.

## Step 5: Update STATE.md (append-only — do NOT write `Current phase:`)

Authority split: only `next` writes `Current phase:`. Phase skills append to `Completed phases:` + artifacts.

- `Completed phases:` → append `- rollout — completed YYYY-MM-DD, artifact: ROLLOUT.md`
- `Artifacts:` → append `- ROLLOUT.md (rollout phase, generated YYYY-MM-DD)`
- `Last updated: YYYY-MM-DD by /aria:rollout`

Do **not** touch `Current phase:`.

## Step 6: Hand off

≤3 sentences:

> Rollout calendar written to `.patchline/artifacts/ROLLOUT.md`. Announce lands <−6w date>, editorial pitches submit by <−4w date>, release day <date>, analytics review at +4w. Run `/aria:next` for `pitch-kit` — I'll draft one tailored pitch per Tier 1/2 playlist target from the release plan.

## Error handling

- **STATE.md shows different current phase** → STOP, surface the mismatch.
- **RELEASE_PLAN.md missing** → STOP, tell user to run `/aria:next` back through release-plan first. Rollout has no anchor without it.
- **Release date in RELEASE_PLAN.md is "TBD"** → STOP, tell user to set a real date first.
- **`generate_pitch` errors** → continue; note in "Pitch preview" section; flag to user that Phase 7 may need attention.
- **User can't make any content** (capacity all zero in Q1) → still produce rollout; all content rows become "none — artist declined"; the editorial-pitch + release-day + analytics rows carry the plan. Flag that a content-free rollout usually underperforms its metric.
- **No active socials** (Q2 returns nothing) → rollout defaults to email + direct-fan channels. If no email list either, flag that distribution is "release-only, no announce layer" — user may want to reconsider before locking.

## Examples

### Happy path — self-releasing, modest tier

```
User: /aria:next
You (reads RELEASE_PLAN.md: release date 2026-06-14, 13 targets, Spotify-first,
     modest tier; reads VISION.md: "intimate 2am club, minimal, hypnotic";
     calls generate_pitch draft on top Tier 1 target → clean draft returned):
  Read the release plan — targeting 2026-06-14, modest promo, Spotify-first,
  13 playlist targets across three tiers. Tone from VISION is "intimate 2am
  club, minimal, hypnotic". Pitch-preview looks clean.

  Five quick questions on capacity.

  1/5 — How much content can you realistically make between now and release?
        Photos, short video, long video — give me real numbers.

User: 3 new photos, 4 short clips, no long video
You: Got it. 2/5 — Which socials are you actually active on?
User: Instagram primary, TikTok secondary, X barely
You: 3/5 — Email list — none, small (<1k), or meaningful (1k+)?
User: Small — around 400
You: 4/5 — Live shows in the ±4w window?
User: Two — Berlin on June 8, London on June 20
You: 5/5 — Execution team?
User: Solo, no manager
You (writes ROLLOUT.md with 14 calendar rows, VISION-aligned tone notes,
     tier-scoped to modest, all 5 live-show days incorporated as content
     anchors; updates STATE.md):
  Rollout written — 14 calendar rows from announce (2026-05-03) to +4w
  analytics (2026-07-12). Tour dates woven in as content anchors. Run
  /aria:next for pitch-kit.
```

### Label-coordinated, significant tier

```
You (reads RELEASE_PLAN.md: with_label, label = Spinnin', significant tier):
  Label-coordinated rollout — Spinnin' handles announce + editorial pitches,
  you handle content + socials. Five quick questions.
  ...
You (writes ROLLOUT.md with the parallel "Label owner" column,
     label-handled rows clearly marked, artist-handled rows clearly marked):
  Rollout written with split ownership. Label owns 4 rows, you own 10.
  Check with your A&R contact that the date split matches their calendar.
  Run /aria:next for pitch-kit.
```

### No content capacity

```
User: 0 photos, 0 video, "too busy with the music"
You: Rolling with the release-plan assets only. Your rollout will lean
     heavily on announce copy + smart-link distribution + editorial pitches.
     Expect the launch-day spike to be smaller without teaser content —
     flagging that in the calendar.
You (writes minimal ROLLOUT.md; content rows say "artist declined — using
     RELEASE_PLAN assets + cover art only"; editorial rows fully populated):
  Rollout written — lean version. Run /aria:next for pitch-kit.
```

### Example seed URL (demo artist)

When iterating on this skill during dev, `https://open.spotify.com/artist/0KPpwFcT8FMDSaiYV9d8LX` is a valid URL — `analyze_url` returns a real identity so you're not fabricating during test runs.

## Common mistakes (don't make these)

- **Generic calendar rows.** "Post a teaser" is not a row — "Post second teaser (15s audio clip from bridge) on Instagram Reels + TikTok primary channels" is. Every row is concrete.
- **Vague dates.** "Week 3" is not a date — "YYYY-MM-DD" is. Calculate from release date every time.
- **Tone mismatch.** If VISION says "minimal, 2am club", don't recommend "festival-vibe visuals" in any wave. Read VISION before drafting.
- **Overscoping for the budget tier.** `none` tier means organic-only. `modest` means one boost per wave max. `significant` lets you recommend paid PR. Respect it.
- **Ignoring live shows.** Tour dates in the ±4w window are content anchors — footage, photos, setlist teases. If the user has shows and you didn't weave them in, re-draft.
- **Same row for solo vs. label-coordinated.** If `distributionMode == with_label`, the "Owner" column needs the label / artist split. Don't leave everything as "Artist" — it's the wrong source of truth.
- **Inventing new playlist targets in rollout.** Rollout refers back to RELEASE_PLAN.md tiers; it does not introduce playlists that weren't there. If a second-wave `find_playlists` call surfaced new options, add them, but grounded.
- **Advancing STATE.md without writing ROLLOUT.md.** Check the file exists before updating state.
- **Ignoring the editorial pitch deadline.** −4w is not a suggestion — Spotify-for-Artists literally will not accept pitches submitted later. Anchor the rollout to that deadline first, then fill the rest.
