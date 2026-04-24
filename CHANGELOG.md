# Changelog

All notable changes to Aria by Patchline are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3-alpha] — 2026-04-22

### Added
- `release-plan` now calls `create_campaign` when a Project Anchor exists, so Aria creates app-backed campaign tasks instead of only writing local markdown.
- Public smoke coverage now guards against regressing the command-center campaign sync path.

### Changed
- Public copy now describes vendor-powered data as artist intelligence and track analysis in customer-facing surfaces.
- `release-plan` keeps distributor/social setup as known context or action items, not mandatory setup questions.

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
- `aria` MCP server integration with 18 tools covering catalog management, playlist targeting, artist intelligence, pitch generation, and smart-link creation
- `.patchline/` workspace convention: plaintext markdown artifacts per phase
- `STATE.md` lifecycle ledger with composition-status branching and drift detection
- Cognito OAuth authentication flow via Patchline-hosted proxy (RFC 8414 + RFC 9728 compliant)
- `scripts/validate.ts` — static structure validator (manifests, frontmatter, prerequisite graph)
- `scripts/smoke-test.ts` — live MCP reachability + workspace bootstrap validator
- MIT license on plugin code; hosted MCP service remains proprietary

### Notes
- First version published to the Claude Code plugin marketplace as `patchline-ai/aria`
- Requires a Patchline AI account (free tier available)

[Unreleased]: https://github.com/Patchline-AI/Aria/compare/v0.1.3-alpha...HEAD
[0.1.3-alpha]: https://github.com/Patchline-AI/Aria/compare/v0.1.2-alpha...v0.1.3-alpha
[0.1.2-alpha]: https://github.com/Patchline-AI/Aria/compare/v0.1.1-alpha...v0.1.2-alpha
[0.1.1-alpha]: https://github.com/Patchline-AI/Aria/compare/v0.1.0-alpha...v0.1.1-alpha
[0.1.0-alpha]: https://github.com/Patchline-AI/Aria/releases/tag/v0.1.0-alpha
