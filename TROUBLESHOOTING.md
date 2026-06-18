# Troubleshooting

Common issues and how to resolve them. If nothing here matches, open an [issue](https://github.com/Patchline-AI/aria/issues/new/choose).

## Authentication

### "The session expired. Let me restart the flow." keeps looping

Cause: a stale or empty OAuth credential in Claude's MCP client state is short-circuiting the auth flow before it can complete.

**Fix:**

Quit Claude Code fully first (not just close the window), then run the matching command for your OS. Both scripts back up your credentials to `.credentials.backup.json` and remove any MCP OAuth entry pointing at Patchline, regardless of whether the server is registered as `aria` or the legacy `patchline-aria`.

```bash
# macOS / Linux
cp ~/.claude/.credentials.json ~/.claude/.credentials.backup.json && \
  jq 'if .mcpOAuth then
        .mcpOAuth |= with_entries(
          select(
            (.key | test("^(aria|patchline-aria)\\|") | not) and
            (.value.serverUrl // "" | test("patchline\\.ai/api/mcp/v1") | not)
          )
        )
      else . end' \
    ~/.claude/.credentials.backup.json > ~/.claude/.credentials.json
```

```powershell
# Windows PowerShell
$path = "$env:USERPROFILE\.claude\.credentials.json"
Copy-Item $path "$path.backup.json" -Force
$creds = Get-Content $path -Raw | ConvertFrom-Json
if ($creds.mcpOAuth) {
    $toRemove = $creds.mcpOAuth.PSObject.Properties |
        Where-Object {
            $_.Name -match '^(aria|patchline-aria)\|' -or
            ($_.Value.serverUrl -and $_.Value.serverUrl -match 'patchline\.ai/api/mcp/v1')
        } |
        ForEach-Object { $_.Name }
    foreach ($name in $toRemove) {
        $creds.mcpOAuth.PSObject.Properties.Remove($name)
    }
    $creds | ConvertTo-Json -Depth 20 | Set-Content $path -Encoding UTF8
}
```

Restart Claude Code, run `/reload-plugins`, approve the Aria MCP server, then ask Aria for anything in plain language (for example `get started`) to trigger the browser OAuth flow. If something goes wrong, restore the backup: `mv ~/.claude/.credentials.backup.json ~/.claude/.credentials.json` or `Move-Item` on Windows.

### The browser says "Authentication Successful" but Claude never connects

Cause: the loopback callback fired but the token exchange silently dropped.

**Fix:** wait 30 seconds, restart Claude, reconnect `aria`, and retry. If it still fails, clear the stale credential as shown above and retry.

### Cognito OAuth page shows `redirect_mismatch`

Cause: Cognito rejected the callback URL. Aria should go through `https://www.patchline.ai/api/mcp/v1/authorize`, which rewrites Claude's random `http://localhost:<port>/callback` URL to Patchline's registered callback before sending you to Cognito.

**Fix:** first update or reload the plugin and retry:

```text
/plugin uninstall aria
/plugin marketplace add Patchline-AI/aria
/plugin install aria@patchline-ai
/reload-plugins
```

Then run `/mcp`, authenticate `plugin:aria:aria`, and confirm the authorize URL starts with `https://www.patchline.ai/api/mcp/v1/authorize`. If the browser still lands on Cognito's `redirect_mismatch` page, open an issue with both URLs: the Claude authorize URL and the final browser URL.

## MCP tool errors

### "Tool `mcp__aria__<name>` returned isError: true"

Look at the error body. Common causes:

- `UNAUTHENTICATED` - session expired. Run `/mcp` and reconnect.
- `NOT_FOUND` on a catalog tool - you have not added any assets yet. Call `get_started` to see your workspace, then add a track (the `drop` skill / `get_asset_upload_link`) or import one in the web app.
- `RATE_LIMITED` - you hit the streaming-intelligence quota. Retry in 60 seconds.

### `find_playlists` or `inspect_playlist` returns empty

Cause: the track you are targeting has not completed track analysis yet, so audio features are unavailable.

**Fix:** upload the master audio via the Patchline web app or finish `audio-intake`. Playlist matching starts from sonic signatures; without them, matching falls back to genre-only, which is less precise.

## Plugin installation

### `/plugin install aria@patchline-ai` says "plugin not found"

You probably forgot the marketplace-add step:

```text
/plugin marketplace add Patchline-AI/aria
/plugin install aria@patchline-ai
```

### `/plugin list` shows `aria` but skills do not resolve

Cause: the plugin cache got stale after install or a manual update. Some Claude Code builds do not expose plugin skills as bare slash commands even when the skill can be loaded from natural language.

**Fix:** run `/reload-plugins`, then use plain language like `get started` or `drop my new single`. If a bare `/aria:drop` says "unknown command", that is a Claude Code command-surface limitation, not a plugin install failure.

### Claude Desktop / Cowork does not show slash skills

Cause: those clients may surface plugins and skills primarily through natural language instead of slash aliases.

**Fix:** say what you want in plain language — `get started`, `drop my track`, `pitch this`, `make a smart link`. Each skill is standalone; slash commands (`/aria:drop`, etc.) are a fallback, not the primary flow.

### `/reload-plugins` says "not available on this environment"

Cause: your Claude Code build predates the plugin system (the `/plugin` and `/reload-plugins` commands shipped in Claude Code 1.x with plugin support).

**Fix:** check your version with `claude --version` and upgrade:

- Homebrew: `brew upgrade claude-code`
- npm: `npm update -g @anthropic-ai/claude-code`
- Native installer: re-run the installer from [code.claude.com/docs/en/setup](https://code.claude.com/docs/en/setup)

Claude Desktop and Cowork bundle their own Claude Code runtime. Update the Claude Desktop app itself (not just the CLI on your machine) to get current plugin commands inside Cowork. After the update, restart Claude Desktop and retry `/reload-plugins`.

### Testing unreleased changes from a local clone

You do not have to publish a new version to `Patchline-AI/aria` to try in-progress plugin work. Point Claude Code at a local `plugin/` directory as its own marketplace:

```text
/plugin uninstall aria@patchline-ai
/plugin marketplace remove patchline-ai
/plugin marketplace add "<absolute path to your local plugin directory>"
/plugin install aria@patchline-ai
/reload-plugins
```

Windows example (Claude Code CLI uses forward slashes too):

```text
/plugin marketplace add "C:/Users/<you>/code/patchline/plugin"
```

After each edit, run `/reload-plugins` to pick up changes without restarting. When you are ready to go back to the published version, uninstall, remove the local marketplace, and re-add `Patchline-AI/aria`.

### A skill mentions phases, `Continue Aria`, or a `.patchline/` workspace

Cause: you are on an older plugin build (`0.1.x`) that used an 11-phase lifecycle with a `.patchline/STATE.md` ledger. That waterfall was retired in `0.2.0`.

**Fix:** reload or reinstall the plugin (`0.2.0`+). The current skills are standalone moments — `drop`, `pitch`, `link`, `fans`, `operator` — with no phases, no `Continue Aria`, and no local state files. Say what you want, or invoke a skill directly.

## Still stuck?

Open an issue with the [Bug Report template](./.github/ISSUE_TEMPLATE/bug_report.md). Include:

- The exact command you ran
- What you expected vs. what happened
- Output of `/mcp` showing the aria connection state
- Your Claude version, for example `claude --version`

We triage within a week.
