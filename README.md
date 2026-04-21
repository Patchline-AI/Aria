# Aria by Patchline

[![Claude Code](https://img.shields.io/badge/Claude%20Code-Plugin-D97757)](https://docs.claude.com/en/docs/claude-code/plugins)
[![License: MIT](https://img.shields.io/badge/License-MIT-0068FF)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0--alpha-00E6E2)](./CHANGELOG.md)
[![MCP](https://img.shields.io/badge/MCP-aria-002772)](https://www.patchline.ai/mcp)

**Ship a music release end-to-end without leaving Claude.**

Aria is a Claude Code plugin that walks artists and managers through eight lifecycle phases — from raw idea to pitched, released, and live on a smart link. Every artifact it produces is grounded in your real catalog and real streaming data via the Patchline MCP. No hallucinated playlists. No invented metrics.

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

- **Eight lifecycle skills** — `creative-brief`, `vision-story`, `moodboard`, `songwriting-brief`, `release-plan`, `rollout`, `pitch-kit`, `smart-link`
- **Two lifecycle skills** — `aria:start` bootstraps a project, `aria:next` advances to the next phase
- **The `aria` MCP server** — 18 tools spanning catalog management, playlist targeting with Cynite sonic signatures, Soundcharts-backed artist intelligence, pitch generation, and smart-link creation
- **A `.patchline/` workspace** — plaintext markdown artifacts you can hand-edit, version-control, or forward to a collaborator

## How it's different from "ChatGPT for music"

This is not a tool explorer. Each phase is a **progressive interview**: Claude asks 3–5 clarifying questions, calls MCP tools to ground the answers in your real data, and produces a named artifact (`BRIEF.md`, `MOODBOARD.md`, `PITCH_KIT.md` …). Every output is verifiable against your Patchline catalog + the live Soundcharts and Cynite data pipeline.

If you've seen a GSD-style phased plugin — same discipline. Different verb set: music.

## Quickstart

1. `cd` into a directory where you want your project workspace (the current dir is fine; Aria never touches anything outside `.patchline/`)
2. Run `/reload-plugins` and approve the Aria MCP server if prompted
3. Run `/mcp`, authenticate `plugin:aria:aria`, and wait for it to show connected
4. Say `Start Aria for this artist: <Spotify artist profile URL>` — Aria resolves the artist through Patchline/Soundcharts, asks for your project name, then creates `.patchline/` with a `PROJECT.md` and `STATE.md`
5. Say `Continue Aria` or `run aria:next` — advances to whatever phase you haven't completed. The first run produces `BRIEF.md`.
6. Keep saying `Continue Aria` until your smart link is live.

Each artifact lives as plaintext markdown in `.patchline/artifacts/`. Edit by hand if Aria misses something, then `/aria:next` regenerates the downstream outputs.

## Who this is for

- Independent artists planning a release
- Managers coordinating releases on behalf of artists
- Labels running structured campaigns across multiple artists

It is **not** for:
- Audio production — we don't generate or master music. See [bitwize-music-studio/claude-ai-music-skills](https://github.com/bitwize-music-studio/claude-ai-music-skills) for that.
- General-purpose music research — if you just want tool access, point Claude directly at the MCP endpoint.

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

## Relationship to the Patchline web app

The plugin is the **guided entry point**. The web app at [patchline.ai](https://patchline.ai) is where your Project container, storefront, billing, and social integrations live. Aria produces artifacts; the app persists and visualizes them. You'll use both.

## License + attribution

- **Plugin code: [MIT License](./LICENSE).** Open source. Fork it, extend it, write your own skills that chain on top.
- **MCP service: hosted + proprietary.** The `aria` MCP endpoint at `patchline.ai/api/mcp/v1` is Patchline-owned infrastructure, authenticated via Cognito. Requires a Patchline account. This is the standard authenticated-service pattern (AWS / OpenAI / Anthropic SDKs).
- Plugin structure informed by [`bitwize-music-studio/claude-ai-music-skills`](https://github.com/bitwize-music-studio/claude-ai-music-skills) — the first music-vertical Claude plugin pattern we're aware of.

## Extending Aria

Aria is designed to be composable. You can write your own SKILL.md files that chain into the lifecycle via the `prerequisites:` YAML key. Examples:

- `sync-licensing-brief` that runs after `creative-brief` for artists chasing film/TV placements
- `remix-package` that forks after `release-plan` for labels assembling remix campaigns
- `brand-deck` for pitching to labels

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the contribution flow and [`reference/state-schema.md`](./reference/state-schema.md) for the `STATE.md` contract.

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
