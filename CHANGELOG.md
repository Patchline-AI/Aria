# Changelog

All notable changes to Aria by Patchline are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Patchline-AI/aria/compare/v0.1.0-alpha...HEAD
[0.1.0-alpha]: https://github.com/Patchline-AI/aria/releases/tag/v0.1.0-alpha
