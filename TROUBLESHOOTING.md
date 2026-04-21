# Troubleshooting

Common issues and how to resolve them. If nothing here matches, open an [issue](https://github.com/Patchline-AI/aria/issues/new/choose).

## Authentication

### "The session expired. Let me restart the flow." keeps looping

Cause: a stale / empty OAuth credential in Claude's MCP client state is short-circuiting the auth flow before it can complete.

**Fix:**

Quit Claude Code fully first (not just close the window), then run the matching command for your OS. Both scripts back up your credentials to `.credentials.backup.json` and remove any MCP OAuth entry pointing at Patchline — regardless of whether the server is registered as `aria` or the legacy `patchline-aria`.

```bash
# macOS / Linux
cp ~/.claude/.credentials.json ~/.claude/.credentials.backup.json && \
  jq 'if .mcpOAuth then
        .mcpOAuth |= with_entries(
          select(
            (.key | test("^(aria|patchline-aria)\\|") | not) and
            (.value.serverUrl // "" | test("patchline\\.ai/api/mcp") | not)
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
            ($_.Value.serverUrl -and $_.Value.serverUrl -match 'patchline\.ai/api/mcp')
        } |
        ForEach-Object { $_.Name }
    foreach ($name in $toRemove) {
        $creds.mcpOAuth.PSObject.Properties.Remove($name)
    }
    $creds | ConvertTo-Json -Depth 20 | Set-Content $path -Encoding UTF8
}
```

Restart Claude Code, run `/reload-plugins`, approve the Aria MCP server, then ask Claude to start Aria in plain language (for example: `Start Aria for this artist: <Spotify artist URL>`). That will re-run the browser OAuth flow from scratch. If something goes wrong, restore the backup: `mv ~/.claude/.credentials.backup.json ~/.claude/.credentials.json` (or `Move-Item` on Windows).

### The browser says "Authentication Successful" but Claude Code never connects

Cause: the loopback callback fired but the token exchange silently dropped. This is a bug we've fixed on our side — make sure you're on the latest Patchline backend build (automatically redeployed; no action needed on your end).

**Fix:** wait 30 seconds, restart Claude Code, run `/mcp` and reconnect `aria`. If it still fails, clear the stale credential (see above) and retry.

### Cognito OAuth page shows `redirect_mismatch`

Cause: Cognito rejected the callback URL. Aria should go through `https://www.patchline.ai/api/mcp/v1/authorize`, which rewrites Claude Code's random `http://localhost:<port>/callback` URL to Patchline's registered callback before sending you to Cognito.

**Fix:** first update/reload the plugin and retry:

```
/plugin uninstall aria
/plugin marketplace add Patchline-AI/aria
/plugin install aria@patchline-ai
/reload-plugins
```

Then run `/mcp`, authenticate `plugin:aria:aria`, and confirm the authorize URL starts with `https://www.patchline.ai/api/mcp/v1/authorize`. If the browser still lands on Cognito's `redirect_mismatch` page, open an issue with both URLs: the Claude Code authorize URL and the final browser URL.

## MCP tool errors

### "Tool `mcp__aria__<name>` returned isError: true"

Look at the error body. Common causes:

- **`UNAUTHENTICATED`** — session expired. Run `/mcp` and reconnect.
- **`NOT_FOUND` on a catalog tool** — you haven't imported any assets yet. Run `/aria:start` to bootstrap, then use the web app to import tracks from Spotify / Soundcloud / DistroKid.
- **`RATE_LIMITED`** — you've hit the Soundcharts quota (free tier). Retry in 60 seconds.

### `find_playlists` / `inspect_playlist` returns empty

Cause: the track you're targeting hasn't been analyzed by Cynite yet (audio features unavailable).

**Fix:** upload the master audio via the Patchline web app. Playlist matching starts from sonic signatures — without them, matching falls back to genre-only, which is less precise.

## Plugin installation

### `/plugin install aria@patchline-ai` says "plugin not found"

You probably forgot the marketplace-add step:

```
/plugin marketplace add Patchline-AI/aria
/plugin install aria@patchline-ai
```

### `/plugin list` shows `aria` but skills don't resolve

Cause: plugin cache got stale after install or a manual update. Some Claude Code builds do not expose plugin skills as bare slash commands even when the skill can be loaded from natural language.

**Fix:** run `/reload-plugins`, then use plain language: `Start Aria for this artist: <Spotify URL>`. If bare `/aria:start` says "unknown command", that is a Claude Code command-surface limitation, not a plugin install failure.

## Still stuck?

Open an issue with the [Bug Report template](./.github/ISSUE_TEMPLATE/bug_report.md). Include:

- The exact command you ran
- What you expected vs. what happened
- Output of `/mcp` showing the aria connection state
- Your Claude Code version (run `claude --version` in your terminal)

We triage within a week.
