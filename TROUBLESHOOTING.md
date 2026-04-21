# Troubleshooting

Common issues and how to resolve them. If nothing here matches, open an [issue](https://github.com/Patchline-AI/aria/issues/new/choose).

## Authentication

### "The session expired. Let me restart the flow." keeps looping

Cause: a stale / empty OAuth credential in Claude's MCP client state is short-circuiting the auth flow before it can complete.

**Fix:**

```bash
# macOS / Linux
jq 'if .mcpOAuth then .mcpOAuth |= with_entries(select(.key | test("patchline-aria") | not)) else . end' \
  ~/.claude/.credentials.json > ~/.claude/.credentials.new.json \
  && mv ~/.claude/.credentials.new.json ~/.claude/.credentials.json

# Windows PowerShell
$creds = Get-Content "$env:USERPROFILE\.claude\.credentials.json" | ConvertFrom-Json
if ($creds.mcpOAuth) {
    $creds.mcpOAuth.PSObject.Properties.Name |
        Where-Object { $_ -match 'patchline-aria' } |
        ForEach-Object { $creds.mcpOAuth.PSObject.Properties.Remove($_) }
    $creds | ConvertTo-Json -Depth 20 | Set-Content "$env:USERPROFILE\.claude\.credentials.json"
}
```

Then restart Claude Code and run any Aria command — it will re-run the browser OAuth flow from scratch.

### The browser says "Authentication Successful" but Claude Code never connects

Cause: the loopback callback fired but the token exchange silently dropped. This is a bug we've fixed on our side — make sure you're on the latest Patchline backend build (automatically redeployed; no action needed on your end).

**Fix:** wait 30 seconds, restart Claude Code, run `/mcp` and reconnect `aria`. If it still fails, clear the stale credential (see above) and retry.

### Cognito OAuth page redirects to a port-mismatch error

Cause: Cognito does not support [RFC 8252 loopback port relaxation](https://datatracker.ietf.org/doc/html/rfc8252#section-7.3). Our proxy handles this automatically — but if you hit it, it means Claude Code is talking directly to Cognito instead of through `patchline.ai/api/mcp/v2/authorize`.

**Fix:** uninstall + reinstall the plugin:

```
/plugin uninstall aria
/plugin marketplace add Patchline-AI/aria
/plugin install aria@patchline-ai
```

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

### `/plugin list` shows `aria` but commands don't resolve

Cause: plugin cache got stale after a manual update.

**Fix:** restart Claude Code (fully quit, not just close window).

## Still stuck?

Open an issue with the [Bug Report template](./.github/ISSUE_TEMPLATE/bug_report.md). Include:

- The exact command you ran
- What you expected vs. what happened
- Output of `/mcp` showing the aria connection state
- Your Claude Code version (run `claude --version` in your terminal)

We triage within a week.
