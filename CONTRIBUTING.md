# Contributing to Aria

Thanks for your interest in extending Aria. This plugin is MIT-licensed and designed to be composable — you can write your own SKILL.md files as standalone moment skills, fork and rebrand, or just suggest improvements to what we ship.

## Ways to contribute

### 1. Propose a new moment skill

If you have an idea for a moment we should ship (e.g. a press-release skill, a sync-licensing skill, a fan-funnel skill), open an issue using the [Skill Proposal template](./.github/ISSUE_TEMPLATE/skill_proposal.md) describing:

- **Skill name** — kebab-case, e.g. `press-release`
- **The job** — the single, end-to-end outcome it delivers in one shot
- **Who it serves** — keep it role-agnostic; both solo artists and labels should be able to use it
- **MCP tools required** — which `aria` tools it calls (see [patchline.ai/mcp](https://www.patchline.ai/mcp) for the current tool list)
- **Why now** — what pain it solves that the current moment skills don't

We'll respond within a week. If accepted, we'll either write it or invite you to PR it.

### 2. Write a community skill that chains on top

This is the big OSS win — you don't need our permission to extend Aria. You can:

- Fork the plugin, add your skill, publish as your own plugin that depends on Aria
- Publish a standalone skill that users install alongside Aria

A compatible community skill needs:

- **YAML frontmatter** with: `name`, `description`, `model`, `allowed-tools`
- **Skill body** following the same `## Your Task` / `## Step N` / `## Error handling` / `## Examples` structure as our skills
- **Stateless** — each skill is a self-contained moment; do not assume a shared ledger or phase order.
- **MCP-grounding discipline** — if your skill invents facts instead of calling MCP, it's not a community Aria skill, it's a hallucinator. Don't ship those.

### 3. Fix bugs / improve wording / catch typos

PRs welcome. Small ones go fast.

### 4. Report issues

Use the [Bug Report template](./.github/ISSUE_TEMPLATE/bug_report.md) with:
- Which skill failed (`/aria:<name>`, e.g. `/aria:drop`, `/aria:pitch`)
- What you expected vs. what happened
- Any console output / MCP error strings
- Your Claude Code / Claude Desktop version

## What we won't merge

- **Skills that replace the `aria` MCP** with a competitor's endpoint. Fork for that — but don't call it Aria.
- **Skills that bypass MCP grounding** (fabricate playlist names, invent metrics, make up audio features). The whole point of Aria is artifacts you can send to a human curator unedited. Fabrication breaks the trust contract.
- **Skills that front-load user questions.** We ask 3–5 questions per skill, max, and skip ones already answered by MCP data. Questionnaire-bloat PRs get rejected.

## Development setup

```bash
# 1. Clone the plugin
gh repo clone Patchline-AI/aria
cd aria

# 2. Install locally in Claude Code
/plugin marketplace add "file://$(pwd)"
/plugin install aria@patchline-ai
/reload-plugins

# 3. Smoke-test
cd /tmp && mkdir smoke && cd smoke
get started
```

### Validation + smoke tests

Before opening a PR, run the validation scripts from the repo root:

```bash
# Static structure check (manifests, skill frontmatter, prerequisite graph)
npx tsx scripts/validate.ts

# Live checks (MCP reachable, OAuth metadata, workspace bootstrap)
npx tsx scripts/smoke-test.ts

# With live tools/list verification:
PATCHLINE_MCP_TOKEN=eyJ... npx tsx scripts/smoke-test.ts
```

Both scripts exit 0 on pass, 1 on fail. See [scripts/README.md](./scripts/README.md) for details.

## Pull requests

- Target `main`
- Include a `CHANGELOG.md` entry under the unreleased section
- If you touched any skill, run `validate.ts` — if you touched MCP integration, run `smoke-test.ts`
- Follow the [PR template](./.github/PULL_REQUEST_TEMPLATE.md)

## Code of conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). In short: be kind. Music is a small industry; the people you rate unfairly today you'll share a stage with tomorrow. Same for code review.

## Questions

Open an issue or drop us a line at [patchline.ai](https://patchline.ai).
