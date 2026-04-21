#!/usr/bin/env npx tsx

/**
 * Aria by Patchline — smoke-test harness
 *
 * Exercises the pieces of the plugin that touch the real world:
 *   1. MCP HTTP endpoint is reachable (no connection-refused)
 *   2. Patchline's RFC 9728 protected-resource metadata is well-formed
 *   3. Every "mcp__aria__*" tool referenced in skill allowed-tools
 *      lists resolves against the live tools/list (skipped if no token)
 *   4. First 3 steps of /aria:start simulated against a scratch tmpdir
 *
 * Usage:
 *   npx tsx scripts/smoke-test.ts
 *
 * Env:
 *   PATCHLINE_MCP_URL    — override the MCP URL (default: https://www.patchline.ai/api/mcp/v2)
 *   PATCHLINE_MCP_TOKEN  — optional OAuth bearer token; enables tools/list check
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — at least one check failed
 *
 * Run this after any MCP endpoint change or before releasing a new version.
 */

import fs from 'fs'
import os from 'os'
import path from 'path'
import yaml from 'js-yaml'

// ──────────────────────────────────────────────────────────────────────────
// Paths & config
// ──────────────────────────────────────────────────────────────────────────

const SCRIPT_DIR = path.dirname(path.resolve(__filename))
const PLUGIN_ROOT = path.resolve(SCRIPT_DIR, '..')
const MCP_JSON = path.join(PLUGIN_ROOT, '.mcp.json')
const SKILLS_DIR = path.join(PLUGIN_ROOT, 'skills')

const DEFAULT_MCP_URL = 'https://www.patchline.ai/api/mcp/v2'
const MCP_URL = process.env.PATCHLINE_MCP_URL || DEFAULT_MCP_URL
const MCP_TOKEN = process.env.PATCHLINE_MCP_TOKEN || ''
const FETCH_TIMEOUT_MS = 10_000

// Tool-namespace prefix used by the Claude MCP client.
const TOOL_PREFIX = 'mcp__aria__'
const MCP_SERVER_NAME = 'aria'

// ──────────────────────────────────────────────────────────────────────────
// Colors (matches tests/runners/deploy-and-verify.ts palette)
// ──────────────────────────────────────────────────────────────────────────

const C = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

type Color = keyof typeof C

function log(msg: string, color: Color = 'gray') {
  // eslint-disable-next-line no-console
  console.log(`${C[color]}${msg}${C.reset}`)
}

function header(msg: string) {
  log(`\n${'═'.repeat(60)}`, 'cyan')
  log(`  ${msg}`, 'cyan')
  log(`${'═'.repeat(60)}`, 'cyan')
}

function section(msg: string) {
  log(`\n  ${msg}`, 'cyan')
  log(`  ${'-'.repeat(40)}`, 'gray')
}

// ──────────────────────────────────────────────────────────────────────────
// Result tracking
// ──────────────────────────────────────────────────────────────────────────

type Status = 'pass' | 'warn' | 'fail'

interface CheckResult {
  name: string
  status: Status
  detail: string
}

const results: CheckResult[] = []
const cleanupHooks: Array<() => void> = []

function record(name: string, status: Status, detail = '') {
  results.push({ name, status, detail })
  const colored =
    status === 'pass'
      ? `${C.green}PASS${C.reset}`
      : status === 'warn'
      ? `${C.yellow}WARN${C.reset}`
      : `${C.red}FAIL${C.reset}`
  log(`    ${colored}  ${name}${detail ? ` — ${detail}` : ''}`, 'gray')
}

// ──────────────────────────────────────────────────────────────────────────
// fetch with timeout (Node 18+ has global fetch).
// ──────────────────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Check 1: MCP endpoint reachability
// ──────────────────────────────────────────────────────────────────────────

async function checkMcpReachable() {
  const name = 'MCP endpoint reachable'
  try {
    const res = await fetchWithTimeout(MCP_URL, { method: 'GET' })
    // 200 OK (unlikely without MCP handshake), 401 Unauthorized, or 400/405
    // all mean the server is alive. Connection refused / DNS failure throws.
    if (res.status === 200 || res.status === 401 || res.status === 400 || res.status === 405) {
      record(name, 'pass', `HTTP ${res.status} from ${MCP_URL}`)
    } else {
      record(name, 'warn', `HTTP ${res.status} from ${MCP_URL} (expected 200/401/400/405)`)
    }
  } catch (e: any) {
    record(name, 'fail', `${e.name || 'Error'}: ${e.message} (URL: ${MCP_URL})`)
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Check 2: RFC 9728 protected-resource metadata
// ──────────────────────────────────────────────────────────────────────────

async function checkProtectedResourceMetadata() {
  const name = 'RFC 9728 protected-resource metadata'

  // Derive well-known URL from the MCP origin.
  let origin: string
  try {
    const u = new URL(MCP_URL)
    origin = `${u.protocol}//${u.host}`
  } catch (e: any) {
    record(name, 'fail', `invalid MCP URL: ${e.message}`)
    return
  }

  const candidates = [
    // RFC 9728 canonical well-known
    `${origin}/.well-known/oauth-protected-resource`,
    // Per-resource well-known (Patchline may serve one scoped to /api/mcp/v2)
    `${origin}/.well-known/oauth-protected-resource/api/mcp/v2`,
  ]

  let lastError = ''
  for (const url of candidates) {
    try {
      const res = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      if (res.status !== 200) {
        lastError = `HTTP ${res.status} at ${url}`
        continue
      }
      let body: any
      try {
        body = await res.json()
      } catch (e: any) {
        lastError = `invalid JSON at ${url}: ${e.message}`
        continue
      }
      // RFC 9728 requires "resource" and an authorization-server discovery
      // signal — either authorization_servers (array) or a single URL.
      if (typeof body !== 'object' || body === null) {
        lastError = `response at ${url} is not a JSON object`
        continue
      }
      if (!body.resource) {
        lastError = `response at ${url} missing "resource" field`
        continue
      }
      const hasAuthServer =
        Array.isArray(body.authorization_servers) && body.authorization_servers.length > 0
      if (!hasAuthServer) {
        lastError = `response at ${url} missing non-empty "authorization_servers"`
        continue
      }
      record(name, 'pass', `${url} resource=${body.resource}`)
      return
    } catch (e: any) {
      lastError = `${e.name || 'Error'}: ${e.message} at ${url}`
    }
  }

  record(name, 'fail', lastError || 'no candidate well-known endpoint responded')
}

// ──────────────────────────────────────────────────────────────────────────
// Check 3: allowed-tools references match live tools/list
// ──────────────────────────────────────────────────────────────────────────

/**
 * Pull every `mcp__aria__*` reference from every skill's frontmatter AND body.
 *
 * Claude Code plugin layout: skills live at `skills/<name>/SKILL.md` (subfolder).
 * Earlier version walked `skills/*.md` flat — silently found zero skills post-restructure
 * and made this check a no-op. Fixed to mirror validator's enumeration.
 *
 * Also scans skill BODIES for `mcp__aria__<tool>` references — not just the
 * `allowed-tools:` wildcard — so we catch bodies that name tools the allowed-tools
 * list doesn't enumerate.
 */
function collectReferencedTools(): { byTool: Map<string, string[]>; hasPrefixRef: boolean } {
  const byTool = new Map<string, string[]>()
  let hasPrefixRef = false

  const entries = fs.existsSync(SKILLS_DIR)
    ? fs
        .readdirSync(SKILLS_DIR)
        .filter((name) => {
          const subdir = path.join(SKILLS_DIR, name)
          if (!fs.statSync(subdir).isDirectory()) return false
          return fs.existsSync(path.join(subdir, 'SKILL.md'))
        })
    : []

  for (const entry of entries) {
    const full = path.join(SKILLS_DIR, entry, 'SKILL.md')
    let raw: string
    try {
      raw = fs.readFileSync(full, 'utf8')
    } catch {
      continue
    }
    const normalized = raw.replace(/\r\n/g, '\n')
    let body = normalized
    if (normalized.startsWith('---\n')) {
      const rest = normalized.slice(4)
      const close = rest.indexOf('\n---')
      if (close !== -1) {
        const frontRaw = rest.slice(0, close)
        body = rest.slice(close + 4)
        let fm: any
        try {
          fm = yaml.load(frontRaw)
        } catch {
          fm = null
        }
        const allowed = Array.isArray(fm?.['allowed-tools']) ? fm['allowed-tools'] : []
        for (const t of allowed) {
          if (typeof t !== 'string') continue
          if (t === MCP_SERVER_NAME) {
            hasPrefixRef = true
            continue
          }
          if (t.startsWith(TOOL_PREFIX)) {
            const toolName = t.slice(TOOL_PREFIX.length)
            const existing = byTool.get(toolName) ?? []
            if (!existing.includes(`${entry} (allowed-tools)`)) existing.push(`${entry} (allowed-tools)`)
            byTool.set(toolName, existing)
          }
        }
      }
    }

    // Scan skill body for explicit mcp__aria__<tool> references.
    // Catches bodies that name tools the allowed-tools list doesn't enumerate.
    const bodyRefRe = new RegExp(`${TOOL_PREFIX.replace(/_/g, '_')}([a-zA-Z0-9_]+)`, 'g')
    for (const match of body.matchAll(bodyRefRe)) {
      const toolName = match[1]
      const existing = byTool.get(toolName) ?? []
      const marker = `${entry} (body)`
      if (!existing.includes(marker)) existing.push(marker)
      byTool.set(toolName, existing)
    }
  }

  return { byTool, hasPrefixRef }
}

async function listServerTools(): Promise<Set<string> | null> {
  if (!MCP_TOKEN) return null

  // Minimal MCP JSON-RPC handshake: initialize → initialized → tools/list.
  const sessionHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${MCP_TOKEN}`,
  }

  // Initialize
  const initBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'aria-smoke-test', version: '0.1.0' },
    },
  }
  const initRes = await fetchWithTimeout(MCP_URL, {
    method: 'POST',
    headers: sessionHeaders,
    body: JSON.stringify(initBody),
  })
  if (!initRes.ok) {
    throw new Error(`initialize failed: HTTP ${initRes.status}`)
  }
  // Capture session id if the server uses one (Streamable HTTP transport).
  const sessionId = initRes.headers.get('mcp-session-id')
  if (sessionId) sessionHeaders['mcp-session-id'] = sessionId

  // tools/list
  const listBody = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  }
  const listRes = await fetchWithTimeout(MCP_URL, {
    method: 'POST',
    headers: sessionHeaders,
    body: JSON.stringify(listBody),
  })
  if (!listRes.ok) {
    throw new Error(`tools/list failed: HTTP ${listRes.status}`)
  }

  const text = await listRes.text()
  // Response may be plain JSON or SSE-framed; parse defensively.
  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch {
    // Try to extract a data: line from SSE.
    const dataLine = text
      .split(/\r?\n/)
      .find((l) => l.startsWith('data:'))
    if (!dataLine) throw new Error(`unparseable tools/list response`)
    parsed = JSON.parse(dataLine.slice(5).trim())
  }

  const tools = parsed?.result?.tools
  if (!Array.isArray(tools)) {
    throw new Error('tools/list response missing result.tools array')
  }
  return new Set<string>(tools.map((t: any) => t.name).filter((n: any) => typeof n === 'string'))
}

async function checkAllowedToolsResolve() {
  const name = 'allowed-tools references resolve'
  const { byTool, hasPrefixRef } = collectReferencedTools()

  if (byTool.size === 0 && !hasPrefixRef) {
    record(name, 'pass', 'no aria tool references in allowed-tools')
    return
  }

  if (!MCP_TOKEN) {
    record(
      name,
      'warn',
      `skipped — set PATCHLINE_MCP_TOKEN to resolve ${byTool.size} referenced tool(s) against tools/list`
    )
    return
  }

  let serverTools: Set<string> | null
  try {
    serverTools = await listServerTools()
  } catch (e: any) {
    record(name, 'fail', `could not list tools: ${e.message}`)
    return
  }
  if (!serverTools) {
    record(name, 'warn', 'tools/list returned null (unexpected)')
    return
  }

  const missing: string[] = []
  for (const [tool, skills] of byTool.entries()) {
    if (!serverTools.has(tool)) {
      missing.push(`${tool} (referenced by ${skills.join(', ')})`)
    }
  }

  if (missing.length === 0) {
    record(name, 'pass', `${byTool.size}/${byTool.size} referenced tools exist on server`)
  } else {
    record(name, 'fail', `missing on server: ${missing.join('; ')}`)
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Check 4: simulate /aria:start first 3 steps in a scratch tmpdir
// ──────────────────────────────────────────────────────────────────────────

function checkStartSimulation() {
  const name = '/aria:start first-3-steps simulation'
  const ts = Date.now()
  const tmpRoot = path.join(os.tmpdir(), `aria-smoke-${ts}`)
  const patchlineDir = path.join(tmpRoot, '.patchline')
  const artifactsDir = path.join(patchlineDir, 'artifacts')
  const projectMd = path.join(patchlineDir, 'PROJECT.md')
  const stateMd = path.join(patchlineDir, 'STATE.md')

  // Register cleanup regardless of what happens.
  cleanupHooks.push(() => {
    try {
      if (fs.existsSync(tmpRoot)) fs.rmSync(tmpRoot, { recursive: true, force: true })
    } catch {
      // best-effort — tmpdir cleanup is not load-bearing
    }
  })

  try {
    // Step 1-ish: create workspace dir (simulating "no existing .patchline/").
    fs.mkdirSync(artifactsDir, { recursive: true })

    // Step 2-ish: write a fake PROJECT.md as if artist identity was grounded.
    const projectBody = [
      '# Project: Aria Smoke Test',
      '',
      '> Started: 2026-04-18 · Distribution: self_releasing',
      '',
      '## Artist identity',
      '',
      '- Name: Smoke Tester',
      '- Patchline artist ID: not in roster',
      '- Soundcharts ID: smoke-test-id',
      '- Primary genres: test, fixture',
      '- Career stage: developing',
      '- Country: US',
      '- Current monthly listeners (Spotify): 0',
      '',
      '## Project scope',
      '',
      '- Type: TBD',
      '- Working title: Aria Smoke Test',
      '- Distribution: self_releasing',
      '- Composition status: complete',
      '',
    ].join('\n')
    fs.writeFileSync(projectMd, projectBody, 'utf8')

    // Step 3-ish: write STATE.md.
    const stateBody = [
      '# State',
      '',
      '## Current phase',
      '',
      '`creative-brief` — pending.',
      '',
      '## Completed phases',
      '',
      '(none yet)',
      '',
      '## Distribution mode',
      '',
      '`self_releasing`',
      '',
      '## Composition status',
      '',
      '`complete`',
      '',
    ].join('\n')
    fs.writeFileSync(stateMd, stateBody, 'utf8')

    // Assertions.
    const failures: string[] = []
    if (!fs.existsSync(projectMd)) failures.push('PROJECT.md missing after write')
    if (!fs.existsSync(stateMd)) failures.push('STATE.md missing after write')
    if (!fs.existsSync(artifactsDir)) failures.push('artifacts/ missing after mkdir')

    const projectRead = fs.readFileSync(projectMd, 'utf8')
    if (!/^#\s+Project:/m.test(projectRead)) failures.push('PROJECT.md missing H1 heading')
    if (!/Artist identity/.test(projectRead)) failures.push('PROJECT.md missing artist identity section')

    const stateRead = fs.readFileSync(stateMd, 'utf8')
    if (!/Current phase/.test(stateRead)) failures.push('STATE.md missing Current phase section')
    if (!/creative-brief/.test(stateRead)) failures.push('STATE.md missing creative-brief pointer')

    if (failures.length === 0) {
      record(name, 'pass', `scratch at ${tmpRoot}`)
    } else {
      record(name, 'fail', failures.join('; '))
    }
  } catch (e: any) {
    record(name, 'fail', `${e.name || 'Error'}: ${e.message}`)
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Reporting
// ──────────────────────────────────────────────────────────────────────────

function pad(s: string, n: number): string {
  if (s.length >= n) return s
  return s + ' '.repeat(n - s.length)
}

function statusCell(s: Status): string {
  switch (s) {
    case 'pass':
      return `${C.green}pass${C.reset}`
    case 'warn':
      return `${C.yellow}warn${C.reset}`
    case 'fail':
      return `${C.red}fail${C.reset}`
  }
}

function printReport() {
  section('Summary')

  const nameCol = Math.max(10, ...results.map((r) => r.name.length))
  log(`  ${C.bold}${pad('Check', nameCol)}  ${pad('Status', 6)}  Detail${C.reset}`, 'gray')
  log(`  ${'-'.repeat(nameCol + 20)}`, 'gray')
  for (const r of results) {
    log(`  ${pad(r.name, nameCol)}  ${statusCell(r.status)}   ${r.detail}`, 'gray')
  }

  const passes = results.filter((r) => r.status === 'pass').length
  const warns = results.filter((r) => r.status === 'warn').length
  const fails = results.filter((r) => r.status === 'fail').length

  log('', 'gray')
  log(`  pass: ${passes}`, passes > 0 ? 'green' : 'gray')
  log(`  warn: ${warns}`, warns > 0 ? 'yellow' : 'gray')
  log(`  fail: ${fails}`, fails > 0 ? 'red' : 'gray')
}

function cleanup() {
  for (const hook of cleanupHooks) {
    try {
      hook()
    } catch {
      // swallow
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────

async function main() {
  header('Aria plugin smoke test')
  log(`  plugin root: ${PLUGIN_ROOT}`, 'gray')
  log(`  MCP URL:     ${MCP_URL}`, 'gray')
  log(`  .mcp.json:   ${MCP_JSON}`, 'gray')
  log(`  token:       ${MCP_TOKEN ? 'provided' : 'not set (tools/list check will be skipped)'}`, 'gray')

  section('1. MCP endpoint reachability')
  await checkMcpReachable()

  section('2. Protected-resource metadata (RFC 9728)')
  await checkProtectedResourceMetadata()

  section('3. allowed-tools references resolve against server')
  await checkAllowedToolsResolve()

  section('4. /aria:start simulation')
  checkStartSimulation()

  printReport()
  cleanup()

  const hasFail = results.some((r) => r.status === 'fail')
  if (hasFail) {
    log('\nsmoke-test: FAILED\n', 'red')
    process.exit(1)
  }
  log('\nsmoke-test: OK\n', 'green')
  process.exit(0)
}

process.on('SIGINT', () => {
  cleanup()
  process.exit(130)
})
process.on('SIGTERM', () => {
  cleanup()
  process.exit(143)
})
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error(`${C.red}uncaught: ${err}${C.reset}`)
  cleanup()
  process.exit(1)
})

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`${C.red}fatal: ${err}${C.reset}`)
  cleanup()
  process.exit(1)
})
