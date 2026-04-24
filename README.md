# Aria by Patchline

[![Claude Code](https://img.shields.io/badge/Claude%20Code-Plugin-D97757)](https://docs.claude.com/en/docs/claude-code/plugins)
[![License: MIT](https://img.shields.io/badge/License-MIT-0068FF)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0--alpha-00E6E2)](./CHANGELOG.md)
[![MCP](https://img.shields.io/badge/MCP-aria-002772)](https://www.patchline.ai/mcp)

**Ship a music release end-to-end without leaving Claude.**

Aria is a Claude Code plugin that walks artists and managers through a release lifecycle from raw idea or finished track to pitched, released, and live on a smart link. Every artifact it produces is grounded in your real catalog and real streaming data via the Patchline MCP. No hallucinated playlists. No invented metrics.

```bash
# In Claude Code
/plugin marketplace add Patchline-AI/Aria
/plugin install aria@patchline-ai
/reload-plugins
```

After `/reload-plugins`, approve the Aria MCP server if Claude Code asks.
Then run `/mcp`, choose `plugin:aria:aria`, and authenticate with your
Patchline account. Once the server shows connected, start in plain language:

```text
Start Aria for this artist: <Spotify artist profile URL>
```

Some Claude Code builds expose plugin skills as slash aliases such as
`/aria:start`; others load them from natural language. If a bare `/aria:start`
returns "unknown command", use the sentence above and Claude will load the
`aria:start` skill itself.

Use the artist profile URL first, not a track, album, or playlist URL. If you
do not have the Spotify profile URL yet, type the artist name and Aria will
search your Patchline roster/index.

---

## What you get

- **Nine lifecycle skills** — `audio-intake`, `creative-brief`, `vision-story`, `moodboard`, `songwriting-brief`, `release-plan`, `rollout`, `pitch-kit`, `smart-link`
- **Two lifecycle skills** — `aria:start` bootstraps a project, `aria:next` advances to the next phase
- **The `aria` MCP server** — tools spanning catalog management, secure upload handoff, playlist targeting, artist intelligence, pitch generation, project creation, and smart-link creation
- **A `.patchline/` workspace** — plaintext markdown artifacts you can hand-edit, version-control, or forward to a collaborator

## How it's different from "ChatGPT for music"

This is not a tool explorer. Each phase is a **progressive interview**: Claude asks only the missing clarifying questions, calls MCP tools to ground the answers in your real data, and produces a named artifact (`BRIEF.md`, `MOODBOARD.md`, `PITCH_KIT.md` …). Every output is verifiable against your Patchline catalog, artist intelligence, and track analysis.

If you've seen a GSD-style phased plugin — same discipline. Different verb set: music.

## Quickstart

1. `cd` into a directory where you want your project workspace (the current dir is fine; Aria never touches anything outside `.patchline/`)
2. Run `/reload-plugins` and approve the Aria MCP server if prompted
3. Run `/mcp`, authenticate `plugin:aria:aria`, and wait for it to show connected
4. Say `Start Aria for this artist: <Spotify artist profile URL>` — Aria resolves the artist through Patchline intelligence, asks for your project name, creates a Patchline Project Anchor, then creates `.patchline/` with a `PROJECT.md` and `STATE.md`
5. If you already have the finished track, Aria routes to `audio-intake` first so you can upload/confirm the focus track, capture campaign basics, and wait for track analysis before sonic strategy questions.
6. Say `Continue Aria` or `run aria:next` — advances to whatever phase you haven't completed. After audio is settled, the next strategy run produces `BRIEF.md`.
7. Keep saying `Continue Aria` until your smart link is live.

Each artifact lives as plaintext markdown in `.patchline/artifacts/`. Edit by hand if Aria misses something, then `/aria:next` regenerates the downstream outputs.

## Who this is for

- Independent artists planning a release
- Managers coordinating releases on behalf of artists
- Labels running structured campaigns across multiple artists

## Requirements

- A [Patchline AI account](https://patchline.ai) (free tier available; some features are tier-gated post-launch)
- Claude Code 1.x+ **or** Claude Desktop with MCP + plugin support
- An internet connection — the MCP server is hosted

## First run — authentication

The first MCP call triggers a one-time Cognito OAuth flow in your browser. Token is persisted by Claude's MCP client. If the flow stalls:

1. Close the browser tab
2. Run `/reload-plugins`
3. Run `/mcp` in Claude Code and reconnect `plugin:aria:aria`
4. Still stuck? See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

You will never be asked for raw credentials, tokens, or AWS keys. The plugin doesn't need them.

## Privacy and data handling

Aria connects Claude to Patchline's hosted MCP service at
`https://www.patchline.ai/api/mcp/v1`. When you authenticate, Claude receives a
Patchline OAuth access token for the scopes authorized in the connection flow;
Patchline authenticates and user-scopes each MCP tool call server-side.

Data you send through Aria, and tool outputs returned to Claude, may transit
Claude or another MCP client under that client's own terms and privacy policy.
Patchline's collection, processing, retention, subprocessors, and AI-improvement
rules are described in the [Patchline Privacy Policy](https://www.patchline.ai/privacy).

Uploaded audio, track-analysis outputs, spectrograms, fingerprints, embeddings,
and similar music-derived technical features may be used to provide and improve
Patchline features such as catalog search, sonic matching, recommendations, and
metadata quality. Patchline does not use your audio recordings, masters,
compositions, musical works, or derivative audio or music features to train
generative music or audio models without separate, explicit opt-in consent.

## Relationship to the Patchline web app

The plugin is the **guided workspace** for planning release artifacts inside Claude. The web app at [patchline.ai](https://patchline.ai) is where your catalog, storefront, billing, and social integrations live.

Patchline also ships a Telegram companion bot for always-on mobile execution: paste links, trigger quick actions, and keep release momentum moving when you are away from your desk. Think of it as the 24/7 operator in your pocket; Aria is the structured planning room.

## License + attribution

- **Plugin code: [MIT License](./LICENSE).** Open source so artists, managers, and builders can inspect how the workflow is structured and adapt it for their own teams.
- **MCP service: hosted + proprietary.** The `aria` MCP endpoint at `patchline.ai/api/mcp/v1` is Patchline-owned infrastructure, authenticated via Cognito. Requires a Patchline account. This is the standard authenticated-service pattern (AWS / OpenAI / Anthropic SDKs).
- **Inspired by the wider Claude music-tooling community.** We respect earlier experiments such as [`bitwize-music-studio/claude-ai-music-skills`](https://github.com/bitwize-music-studio/claude-ai-music-skills); Aria takes a different route by grounding release operations in Patchline's hosted catalog, artist intelligence, track analysis, and smart-link infrastructure.

## Extending Aria

Aria is designed to be composable without exposing Patchline's full internal roadmap. If you want to contribute a lifecycle skill, start with [CONTRIBUTING.md](./CONTRIBUTING.md) and [`reference/state-schema.md`](./reference/state-schema.md) so your phase respects the `STATE.md` contract.

## Links

| | |
|---|---|
| Web app | [patchline.ai](https://patchline.ai) |
| MCP landing | [patchline.ai/mcp](https://www.patchline.ai/mcp) |
| Privacy policy | [patchline.ai/privacy](https://www.patchline.ai/privacy) |
| Issues + feedback | [github.com/Patchline-AI/Aria/issues](https://github.com/Patchline-AI/Aria/issues) |
| Changelog | [CHANGELOG.md](./CHANGELOG.md) |
| Contributing | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| Code of conduct | [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) |

---

Built by [Patchline AI](https://patchline.ai).
