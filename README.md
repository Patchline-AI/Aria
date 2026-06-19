# Aria by Patchline

[![Claude Code](https://img.shields.io/badge/Claude%20Code-Plugin-D97757)](https://docs.claude.com/en/docs/claude-code/plugins)
[![License: MIT](https://img.shields.io/badge/License-MIT-0068FF)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.0-00E6E2)](./CHANGELOG.md)
[![MCP](https://img.shields.io/badge/MCP-aria-002772)](https://www.patchline.ai/mcp)

**Ship a music release end-to-end without leaving Claude Desktop, Cowork, or Claude Code.**

Aria is a Claude plugin for Claude Code and Claude Desktop/Cowork that walks artists and managers through a release lifecycle from raw idea or finished track to pitched, released, and live on a smart link. Every artifact it produces is grounded in your real catalog and real streaming data via the Patchline MCP. No hallucinated playlists. No invented metrics.

```bash
# In Claude Code
/plugin marketplace add Patchline-AI/aria
/plugin install aria@patchline-ai
/reload-plugins
```

After `/reload-plugins`, approve the Aria MCP server if Claude Code asks.
Then run `/mcp`, choose `plugin:aria:aria`, and authenticate with your
Patchline account. Once the server shows connected, start in plain language:

```text
get started
```

`get_started` reports what's in your workspace (artists, tracks, releases) and
the single best next action. From there, just say what you want — "drop my new
single", "make a smart link", "how are my fans doing" — or
invoke a skill directly (`/aria:drop`, `/aria:link`,
`/aria:fans`, `/aria:operator`). Nothing chains; each skill is a standalone, single-job moment.

On Claude Desktop/Cowork, install the same plugin package through the app's
plugin flow and use the same natural-language prompts.

If you are iterating on the plugin itself and want Claude Desktop/Cowork to
load your local working copy instead of the published `Patchline-AI/aria`
release, see [TROUBLESHOOTING - Testing unreleased changes from a local clone](./TROUBLESHOOTING.md#testing-unreleased-changes-from-a-local-clone).
If `/reload-plugins` reports "not available on this environment", see
[TROUBLESHOOTING - `/reload-plugins` says "not available on this environment"](./TROUBLESHOOTING.md#reload-plugins-says-not-available-on-this-environment).

Use the artist profile URL first, not a track, album, or playlist URL. If you
do not have the Spotify profile URL yet, type the artist name and Aria will
search your Patchline roster/index.

---

## What you get

- **Four lean "moment" skills** — each does one valuable thing end-to-end, grounded in your real Patchline data:
  - `drop` — take a finished track from a file to live on your storefront (upload → analyze → cover → store link)
  - `link` — create and share a smart link for a track, with analytics
  - `fans` — direct-to-fan: audience overview, geography, segments, store/surface analytics
  - `operator` — the operating manual for driving the MCP correctly (safety gates, grounding, token-frugality)
- **Pitch copy without a pitch skill:** use `generate_pitch` for draft submission copy and `create_asset_share` for a shareable link (`create_pitch_link` is gated/hidden in the 49-tool build).
- **The `aria` MCP server** — tools spanning catalog management, secure upload handoff, cover art, playlist targeting, artist intelligence, pitch generation, project/campaign creation, smart links, and audience analytics. Call `get_started` first if you're unsure where to begin.

## How it's different from "ChatGPT for music"

This is not a tool explorer, and it's not a 10-step waterfall. Each skill is a single grounded action: it calls the `aria` MCP to ground every fact in your real catalog, artist intelligence, and track analysis — no invented playlists, no hallucinated metrics — and gets one job done fast. Both solo artists and labels use them.

## Quickstart

1. Run `/reload-plugins` and approve the Aria MCP server if prompted.
2. Run `/mcp`, authenticate `plugin:aria:aria`, and wait for it to show connected.
3. Say `get started` (or call the `get_started` tool) — Aria reports what you have (artists, tracks, releases) and the single best next step.
4. From there, just say what you want: "drop my new single", "make a smart link", "how are my fans doing". Or invoke a skill directly: `/aria:drop`, `/aria:link`, `/aria:fans`, `/aria:operator`.

Nothing chains — each skill is standalone and can run any time. Skills produce a written artifact only if you ask; the default is a concise inline report.

## Who this is for

- Independent artists planning a release
- Managers coordinating releases on behalf of artists
- Labels running structured campaigns across multiple artists

## Requirements

- A [Patchline AI account](https://patchline.ai) (free tier available; some features are tier-gated post-launch)
- Claude Code 1.x+ or Claude Desktop/Cowork with MCP and plugin support
- An internet connection - the MCP server is hosted

## First run - authentication

The first MCP call triggers a one-time Cognito OAuth flow in your browser. The token is persisted by Claude's MCP client. If the flow stalls:

1. Close the browser tab.
2. Run `/reload-plugins`.
3. Run `/mcp` in Claude Code and reconnect `plugin:aria:aria`.
4. Still stuck? See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

You will never be asked for raw credentials, tokens, or AWS keys. The plugin does not need them.

## Relationship to the Patchline web app

The plugin is the guided workspace for planning release artifacts inside Claude. The web app at [patchline.ai](https://patchline.ai) is where your catalog, storefront, billing, and social integrations live.

Patchline also ships a Telegram companion bot for always-on mobile execution: paste links, trigger quick actions, and keep release momentum moving when you are away from your desk. Think of it as the 24/7 operator in your pocket; Aria is the structured planning room.

## License + attribution

- **Plugin code: [MIT License](./LICENSE).** Open source so artists, managers, and builders can inspect how the workflow is structured and adapt it for their own teams.
- **MCP service: hosted + proprietary.** The `aria` MCP endpoint at `patchline.ai/api/mcp/v1` is Patchline-owned infrastructure, authenticated via Cognito. It requires a Patchline account.
- **Inspired by the wider Claude music-tooling community.** We respect earlier experiments such as [`bitwize-music-studio/claude-ai-music-skills`](https://github.com/bitwize-music-studio/claude-ai-music-skills); Aria takes a different route by grounding release operations in Patchline's hosted catalog, artist intelligence, track analysis, and smart-link infrastructure.

## Extending Aria

Aria is designed to be composable without exposing Patchline's full internal roadmap. If you want to contribute a skill, start with [CONTRIBUTING.md](./CONTRIBUTING.md). Each skill is a standalone moment (`drop`, `pitch`, `link`, `fans`, `operator`), MCP-grounded, with no shared phase state to maintain.

## Links

| | |
|---|---|
| Web app | [patchline.ai](https://patchline.ai) |
| MCP landing | [patchline.ai/mcp](https://www.patchline.ai/mcp) |
| Issues + feedback | [github.com/Patchline-AI/aria/issues](https://github.com/Patchline-AI/aria/issues) |
| Changelog | [CHANGELOG.md](./CHANGELOG.md) |
| Contributing | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| Code of conduct | [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) |

---

Built by [Patchline AI](https://patchline.ai).
