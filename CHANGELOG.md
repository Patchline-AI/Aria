# Changelog

All notable changes to Aria by Patchline are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-17

### Changed
- **Retired the 11-phase release waterfall.** The `start`/`next` orchestrator, the per-phase skills (`creative-brief`, `vision-story`, `moodboard`, `songwriting-brief`, `release-plan`, `rollout`, `pitch-kit`, `audio-intake`, `smart-link`), the `.patchline/` workspace, and the `STATE.md` lifecycle ledger are gone.
- Replaced them with five standalone "moment" skills — `drop`, `pitch`, `link`, `fans`, `operator` — each a single-job, end-to-end, MCP-grounded action with no shared state or forced order. Both solo artists and labels use the same skills.

### Added
- `get_started` MCP orientation tool: the cheap first call that reports your roster/catalog state and the next best action, so a brand-new user gets competent fast on any MCP client.
- `set_cover_art` action on `manage_catalog_asset` (dry-run plan then apply), plus an image-cover upload path through `get_asset_upload_link` / `confirm_asset_upload`.

### Removed
- `reference/state-schema.md` (the retired STATE.md ledger contract) and all references to it.

## [0.1.3-alpha] - 2026-04-23

### Changed
- Reframed Claude Desktop/Cowork guidance around natural-language `Start Aria` and `Continue Aria`, with phase-specific slash commands treated as fallbacks instead of the primary flow.
- Updated `aria:next` to set `Current phase` and tee up the next phase's first question or action in the same turn, reducing the manual "click next, click phase" workflow.
- Clarified troubleshooting for stale plugin caches and missing slash-skill visibility in Claude Desktop/Cowork.

## [0.1.2-alpha] — 2026-04-21

### Added
- Added `audio-intake`, a finished-track gate that creates a secure upload handoff, confirms the focus asset, triggers Patchline track analysis, and records the focus track before creative strategy phases.
- Added MCP upload handoff tools: `get_asset_upload_link` and `confirm_asset_upload`.

### Changed
- Finished-track onboarding now routes to `audio-intake` before `creative-brief`.
- `creative-brief` and `vision-story` use focus-track analysis when available instead of asking artists to describe sound from scratch.
- Artist intelligence wording now distinguishes "enrichment complete but sparse upstream data" from "enrichment pending."

## [0.1.1-alpha] — 2026-04-21

### Changed
- Clarified first-run installation and reload steps for Claude Code.
- Refined public positioning for Aria by Patchline and moved future skill ideas out of public README copy.
- Updated `/aria:start` guidance to prefer Spotify artist profile URLs and avoid web-search fallback when MCP is unavailable.

## [0.1.0-alpha] — 2026-04-21

Initial public release.

### Added
- 10 lifecycle skills (`start`, `creative-brief`, `vision-story`, `moodboard`, `songwriting-brief`, `release-plan`, `rollout`, `pitch-kit`, `smart-link`) plus the `next` orchestrator
- `aria` MCP server integration with 23 tools covering catalog management, playlist targeting, artist intelligence, pitch generation, roster actions, release workflows, and smart-link creation
- `.patchline/` workspace convention: plaintext markdown artifacts per phase
- `STATE.md` lifecycle ledger with composition-status branching and drift detection
- Cognito OAuth authentication flow via Patchline-hosted proxy (RFC 8414 + RFC 9728 compliant)
- `scripts/validate.ts` — static structure validator (manifests, frontmatter, prerequisite graph)
- `scripts/smoke-test.ts` — live MCP reachability + workspace bootstrap validator
- MIT license on plugin code; hosted MCP service remains proprietary

### Notes
- First version published to the Claude Code plugin marketplace as `patchline-ai/aria`
- Requires a Patchline AI account (free tier available)

[Unreleased]: https://github.com/Patchline-AI/aria/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Patchline-AI/aria/compare/v0.1.3-alpha...v0.2.0
[0.1.3-alpha]: https://github.com/Patchline-AI/aria/compare/v0.1.2-alpha...v0.1.3-alpha
[0.1.2-alpha]: https://github.com/Patchline-AI/aria/compare/v0.1.1-alpha...v0.1.2-alpha
[0.1.1-alpha]: https://github.com/Patchline-AI/aria/compare/v0.1.0-alpha...v0.1.1-alpha
[0.1.0-alpha]: https://github.com/Patchline-AI/aria/releases/tag/v0.1.0-alpha
