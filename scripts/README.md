# plugin/scripts — Aria plugin validation + smoke tests

Two TypeScript scripts that guard the plugin against drift:

| Script | When to run | What it covers |
|---|---|---|
| `validate.ts` | Before every commit | Static structure: manifests, frontmatter, prereq graph |
| `smoke-test.ts` | After any MCP endpoint change, or before releasing a new version | MCP reachable, OAuth metadata, tool references, moment-skill structure, README moment model, vendor-neutral copy |

Both run via `pnpm exec tsx`. Run from the repo root so the workspace lockfile and
installed dependencies are reused consistently.

```bash
pnpm exec tsx plugin/scripts/validate.ts
pnpm exec tsx plugin/scripts/smoke-test.ts
```

---

## `validate.ts`

```bash
pnpm exec tsx plugin/scripts/validate.ts
```

Parses and validates:

1. **`.claude-plugin/plugin.json`** — required fields: `name`, `description`, `version`, `author`, `skills`, `mcpServers`, `keywords`.
2. **`.claude-plugin/marketplace.json`** — required: `owner`, non-empty `plugins[]` with `name`, `description`, `version`, `source` on every entry.
3. **`.mcp.json`** — requires a `mcpServers` object; every entry must have either (`url` + `type`) for HTTP/SSE remotes or `command` for stdio servers.
4. **`skills/**/SKILL.md`** — each file's YAML frontmatter:
   - Required keys: `name` (kebab-case, matches filename minus `.md`), `description`, `model` (known Claude model ID), `allowed-tools` (list).
   - Optional keys: `argument-hint`, `context` (must be `"fork"` if present), `prerequisites` (list of skill names), `requirements`.
   - Unknown keys are flagged as fails — guards against typos like `allowed_tools`, `promptexpected`.
   - Body must contain `## Your task`, at least one `## Step <N>:` or `## Rule <N>:` heading, and `## Common mistakes`.
5. **Prerequisites graph** — every name in `prerequisites:` must resolve to an existing skill; no cycles (DFS with GRAY-coloring).

Output is a per-file table with `pass / warn / fail` statuses. Exit 0 if all pass, exit 1 on any fail.

The manifest pass also validates `.cursor-plugin/plugin.json` and root
`mcp.json`, then enforces cross-client name, endpoint, version, server-count,
and byte-exact logo-hash parity.

---

## `smoke-test.ts`

```bash
pnpm exec tsx plugin/scripts/smoke-test.ts
# with live tools/list check:
PATCHLINE_MCP_TOKEN=eyJ... pnpm exec tsx plugin/scripts/smoke-test.ts
```

Runs six checks (the first three touch the network; the rest are local):

1. **MCP endpoint reachable** — HTTP GET `https://www.patchline.ai/api/mcp/v1`. Expects 200/401/400/405 (server is alive). Connection refused or DNS failure is a fail.
2. **RFC 9728 protected-resource metadata** — tries `/.well-known/oauth-protected-resource` and the scoped variant under the MCP path. Response must be JSON with a non-empty `resource` field and a non-empty `authorization_servers[]` array.
3. **`allowed-tools` references resolve** — scans every `skills/**/SKILL.md` for `mcp__aria__<toolname>` entries, then calls `tools/list` against the live MCP (requires `PATCHLINE_MCP_TOKEN`). Missing tools are listed by (tool, referencing skill). If no token is set, this check `WARN`s and is skipped — not a fail.
4. **Moment skills present + frontmatter valid** — confirms each of the four current moment skills (`drop`, `link`, `fans`, `operator`) has a `SKILL.md` whose frontmatter parses and whose `name` matches its directory.
5. **Public docs document the moment model** — asserts the README mentions `get started` and at least one moment skill name.
6. **Vendor-neutral public copy** — scans public docs + skill instructions and fails on any leaked third-party vendor name.

Env vars:

- `PATCHLINE_MCP_URL` — override the MCP URL (default `https://www.patchline.ai/api/mcp/v1`). Useful for staging.
- `PATCHLINE_MCP_TOKEN` — OAuth bearer token. When set, enables check 3.

Exit 0 on all pass (warnings allowed), exit 1 on any fail.

---

## Adding a new check

Both scripts follow the same structure:

1. Add a function `checkX()` that pushes into `results` via `record(name, status, ...)`.
2. Call it from `main()` under its own `section('...')` banner.
3. Tracked statuses are `'pass' | 'warn' | 'fail'`. `warn` is for "I can't verify this right now but it's not broken" (e.g. skipped tools/list without a token). `fail` is terminal — causes exit 1.
4. If the check allocates resources (tmpdirs, open sockets, child processes), register a cleanup in `cleanupHooks` so it still runs on SIGINT / uncaughtException.

Keep checks independent — the whole report must still be useful when one check fails.

---

## Exit codes + output format

| Exit | Meaning |
|---|---|
| `0` | All checks passed. `warn`s are allowed. |
| `1` | At least one `fail`. |
| `130` | SIGINT (Ctrl-C). `smoke-test.ts` cleans up tmpdirs first. |
| `143` | SIGTERM. Same cleanup as SIGINT. |

Output is colorized for terminals (`cyan` headers, `green` pass, `yellow` warn, `red` fail) using ANSI escape codes — identical palette to `tests/runners/deploy-and-verify.ts`. Redirect stdout to a file and strip ANSI if you need to diff runs.

---

## Cross-platform notes

- Scripts use `path.join` and `path.resolve` — no string path concatenation. Runs identically on Windows (Git Bash, PowerShell) and macOS/Linux.
- `fs.rmSync(..., { recursive: true, force: true })` handles Windows read-only quirks.
- `fetchWithTimeout` uses the Node 18+ global `fetch` — no external HTTP client dependency.
- YAML parsing uses `js-yaml@^4`, which is already available in the repo workspace.

---

## Typical usage in a commit workflow

```bash
# before committing any change:
pnpm exec tsx plugin/scripts/validate.ts

# before pushing / before releasing a new version:
PATCHLINE_MCP_TOKEN=$(cat ~/.patchline-mcp-token) \
  pnpm exec tsx plugin/scripts/smoke-test.ts
```

A sensible pre-commit hook would run `validate.ts` automatically on any staged file.
