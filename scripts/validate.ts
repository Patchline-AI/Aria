#!/usr/bin/env npx tsx

/**
 * Aria by Patchline — plugin validator
 *
 * Validates the static structure of the plugin: manifest schema,
 * marketplace schema, .mcp.json schema, skill frontmatter, and the
 * prerequisites dependency graph.
 *
 * Usage:
 *   npx tsx scripts/validate.ts
 *
 * Exit codes:
 *   0 — all checks passed (warnings allowed)
 *   1 — at least one check failed
 *
 * Run this before every commit.
 */

import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

// ──────────────────────────────────────────────────────────────────────────
// Paths
// ──────────────────────────────────────────────────────────────────────────

// Script lives at scripts/validate.ts → plugin root is one level up.
const SCRIPT_DIR = path.dirname(path.resolve(__filename))
const PLUGIN_ROOT = path.resolve(SCRIPT_DIR, '..')
const PLUGIN_JSON = path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json')
const MARKETPLACE_JSON = path.join(PLUGIN_ROOT, '.claude-plugin', 'marketplace.json')
const MCP_JSON = path.join(PLUGIN_ROOT, '.mcp.json')
const SKILLS_DIR = path.join(PLUGIN_ROOT, 'skills')

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
  issues: string[]
}

const results: CheckResult[] = []

function record(name: string, status: Status, issues: string[] = []) {
  results.push({ name, status, issues })
}

// ──────────────────────────────────────────────────────────────────────────
// Known Claude model IDs (maintained as a conservative allow-list).
// If a model ID is added here that doesn't exist, the frontmatter check
// will flag it — intentional belt-and-suspenders.
// ──────────────────────────────────────────────────────────────────────────

const KNOWN_MODELS = new Set<string>([
  'claude-sonnet-4-6',
  'claude-sonnet-4-7',
  'claude-opus-4-6',
  'claude-opus-4-7',
  'claude-haiku-4-6',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-sonnet-4-5',
  'claude-sonnet-4-5-20250929',
  'claude-opus-4-5',
  'claude-haiku-4-5',
  'sonnet',
  'opus',
  'haiku',
  'inherit',
])

// ──────────────────────────────────────────────────────────────────────────
// Frontmatter schema
// ──────────────────────────────────────────────────────────────────────────

const REQUIRED_FRONTMATTER_KEYS = ['name', 'description', 'model', 'allowed-tools'] as const
const OPTIONAL_FRONTMATTER_KEYS = [
  'argument-hint',
  'context',
  'prerequisites',
  'requirements',
] as const
const ALL_ALLOWED_KEYS = new Set<string>([
  ...REQUIRED_FRONTMATTER_KEYS,
  ...OPTIONAL_FRONTMATTER_KEYS,
])

// Required body sections
const REQUIRED_SECTIONS: Array<{ name: string; pattern: RegExp }> = [
  { name: '## Your Task', pattern: /^##\s+Your\s+Task\s*$/im },
  // "## Step" covers "## Step 1: …", "## Step 2: …", etc. Need at least one.
  { name: '## Step <N>: …', pattern: /^##\s+Step\s+\d+\s*[:.]/im },
  { name: '## Error handling', pattern: /^##\s+Error\s+handling\s*$/im },
  { name: '## Examples', pattern: /^##\s+Examples\s*$/im },
]

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function readFile(p: string): string {
  return fs.readFileSync(p, 'utf8')
}

function fileExists(p: string): boolean {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

function isKebabCase(s: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s)
}

/**
 * Extract YAML frontmatter between the FIRST two `---` delimiters.
 * Returns { frontmatter, body } or throws if malformed.
 */
function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  // Normalize CRLF → LF so the splitter works consistently on Windows.
  const normalized = raw.replace(/\r\n/g, '\n')

  if (!normalized.startsWith('---\n')) {
    throw new Error('file does not start with "---" (YAML frontmatter delimiter)')
  }

  const rest = normalized.slice(4) // skip leading "---\n"
  const closeIdx = rest.indexOf('\n---')
  if (closeIdx === -1) {
    throw new Error('no closing "---" delimiter for YAML frontmatter')
  }

  const frontmatter = rest.slice(0, closeIdx)
  // Body starts after `\n---\n` (or `\n---` at EOF).
  const afterClose = rest.slice(closeIdx + 4) // skip "\n---"
  const body = afterClose.startsWith('\n') ? afterClose.slice(1) : afterClose
  return { frontmatter, body }
}

// ──────────────────────────────────────────────────────────────────────────
// Check 1: plugin.json
// ──────────────────────────────────────────────────────────────────────────

function checkPluginJson() {
  const issues: string[] = []
  const name = 'plugin.json'

  if (!fileExists(PLUGIN_JSON)) {
    record(name, 'fail', [`missing file at ${PLUGIN_JSON}`])
    return
  }

  let parsed: any
  try {
    parsed = JSON.parse(readFile(PLUGIN_JSON))
  } catch (e: any) {
    record(name, 'fail', [`invalid JSON: ${e.message}`])
    return
  }

  const required = [
    'name',
    'description',
    'version',
    'author',
    'skills',
    'mcpServers',
    'keywords',
  ]
  for (const key of required) {
    if (parsed[key] === undefined || parsed[key] === null || parsed[key] === '') {
      issues.push(`missing required field: "${key}"`)
    }
  }

  // Spot-check types for the fields we use.
  if (parsed.author && typeof parsed.author !== 'object') {
    issues.push('"author" must be an object with name/url')
  }
  if (parsed.author && typeof parsed.author === 'object' && !parsed.author.name) {
    issues.push('"author.name" is required')
  }
  if (parsed.keywords && !Array.isArray(parsed.keywords)) {
    issues.push('"keywords" must be an array')
  }
  if (parsed.skills && typeof parsed.skills !== 'string') {
    issues.push('"skills" must be a string path (e.g. "./skills/")')
  }
  if (parsed.mcpServers && typeof parsed.mcpServers !== 'string') {
    issues.push('"mcpServers" must be a string path (e.g. "./.mcp.json")')
  }

  record(name, issues.length === 0 ? 'pass' : 'fail', issues)
}

// ──────────────────────────────────────────────────────────────────────────
// Check 2: marketplace.json
// ──────────────────────────────────────────────────────────────────────────

function checkMarketplaceJson() {
  const issues: string[] = []
  const name = 'marketplace.json'

  if (!fileExists(MARKETPLACE_JSON)) {
    record(name, 'fail', [`missing file at ${MARKETPLACE_JSON}`])
    return
  }

  let parsed: any
  try {
    parsed = JSON.parse(readFile(MARKETPLACE_JSON))
  } catch (e: any) {
    record(name, 'fail', [`invalid JSON: ${e.message}`])
    return
  }

  if (!parsed.owner) {
    issues.push('missing required field: "owner"')
  }

  if (!Array.isArray(parsed.plugins)) {
    issues.push('"plugins" must be an array')
  } else if (parsed.plugins.length === 0) {
    issues.push('"plugins" array is empty — at least one entry required')
  } else {
    parsed.plugins.forEach((p: any, idx: number) => {
      const where = `plugins[${idx}]`
      for (const k of ['name', 'description', 'version', 'source']) {
        if (!p || p[k] === undefined || p[k] === null || p[k] === '') {
          issues.push(`${where} missing field: "${k}"`)
        }
      }
    })
  }

  record(name, issues.length === 0 ? 'pass' : 'fail', issues)
}

// ──────────────────────────────────────────────────────────────────────────
// Check 3: .mcp.json
// ──────────────────────────────────────────────────────────────────────────

function checkMcpJson() {
  const issues: string[] = []
  const name = '.mcp.json'

  if (!fileExists(MCP_JSON)) {
    record(name, 'fail', [`missing file at ${MCP_JSON}`])
    return
  }

  let parsed: any
  try {
    parsed = JSON.parse(readFile(MCP_JSON))
  } catch (e: any) {
    record(name, 'fail', [`invalid JSON: ${e.message}`])
    return
  }

  if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
    issues.push('missing required "mcpServers" object')
    record(name, 'fail', issues)
    return
  }

  const serverNames = Object.keys(parsed.mcpServers)
  if (serverNames.length === 0) {
    issues.push('"mcpServers" is empty — at least one server required')
  }

  for (const serverName of serverNames) {
    const entry = parsed.mcpServers[serverName]
    if (!entry || typeof entry !== 'object') {
      issues.push(`server "${serverName}": entry must be an object`)
      continue
    }
    // A server entry must have either (a) url + type for HTTP/SSE remotes,
    // or (b) command for stdio servers. Missing both is a fail.
    const hasHttp = entry.url && entry.type
    const hasStdio = entry.command
    if (!hasHttp && !hasStdio) {
      issues.push(
        `server "${serverName}": missing (url + type) for HTTP/SSE OR "command" for stdio`
      )
    }
    if (entry.url && !entry.type) {
      issues.push(`server "${serverName}": has "url" but missing "type" (expected "http" or "sse")`)
    }
    if (entry.type && !entry.url && !entry.command) {
      issues.push(`server "${serverName}": has "type" but no "url" or "command"`)
    }
  }

  record(name, issues.length === 0 ? 'pass' : 'fail', issues)
}

// ──────────────────────────────────────────────────────────────────────────
// Check 4: skills/*.md frontmatter + body sections
// ──────────────────────────────────────────────────────────────────────────

interface ParsedSkill {
  file: string
  skillName: string
  frontmatter: Record<string, any>
  body: string
  issues: string[]
}

function checkSkills(): { skills: ParsedSkill[]; anyFail: boolean } {
  const skills: ParsedSkill[] = []
  let anyFail = false

  if (!fs.existsSync(SKILLS_DIR) || !fs.statSync(SKILLS_DIR).isDirectory()) {
    record('skills/', 'fail', [`missing directory: ${SKILLS_DIR}`])
    return { skills, anyFail: true }
  }

  // Claude Code plugin format (per official docs): each skill lives in its own
  // subdirectory, with a SKILL.md file inside. skills/<name>/SKILL.md.
  // Example: skills/start/SKILL.md → invokable as /aria:start
  const entries = fs
    .readdirSync(SKILLS_DIR)
    .filter((name) => {
      const full = path.join(SKILLS_DIR, name)
      if (!fs.statSync(full).isDirectory()) return false
      return fs.existsSync(path.join(full, 'SKILL.md'))
    })
    .sort()

  if (entries.length === 0) {
    record('skills/', 'fail', ['no skill subdirectories with SKILL.md found in skills/'])
    return { skills, anyFail: true }
  }

  for (const entry of entries) {
    const full = path.join(SKILLS_DIR, entry, 'SKILL.md')
    const fileBasename = entry // skill name = directory name
    const issues: string[] = []

    let raw: string
    try {
      raw = readFile(full)
    } catch (e: any) {
      record(`skills/${entry}`, 'fail', [`unreadable: ${e.message}`])
      anyFail = true
      continue
    }

    let frontRaw: string
    let body: string
    try {
      const split = splitFrontmatter(raw)
      frontRaw = split.frontmatter
      body = split.body
    } catch (e: any) {
      record(`skills/${entry}`, 'fail', [`frontmatter: ${e.message}`])
      anyFail = true
      continue
    }

    let fm: any
    try {
      fm = yaml.load(frontRaw)
    } catch (e: any) {
      record(`skills/${entry}`, 'fail', [`YAML parse error: ${e.message}`])
      anyFail = true
      continue
    }

    if (!fm || typeof fm !== 'object' || Array.isArray(fm)) {
      record(`skills/${entry}`, 'fail', ['frontmatter did not parse to an object'])
      anyFail = true
      continue
    }

    // Required keys.
    for (const key of REQUIRED_FRONTMATTER_KEYS) {
      if (fm[key] === undefined || fm[key] === null || fm[key] === '') {
        issues.push(`missing required key: "${key}"`)
      }
    }

    // Unknown keys (spelling drift).
    for (const key of Object.keys(fm)) {
      if (!ALL_ALLOWED_KEYS.has(key)) {
        issues.push(`unknown frontmatter key: "${key}" (typo?)`)
      }
    }

    // name must be kebab-case AND match filename-minus-ext.
    if (fm.name && typeof fm.name === 'string') {
      if (!isKebabCase(fm.name)) {
        issues.push(`"name" must be kebab-case, got "${fm.name}"`)
      }
      if (fm.name !== fileBasename) {
        issues.push(
          `"name" ("${fm.name}") must match filename-minus-ext ("${fileBasename}")`
        )
      }
    }

    // description must be non-empty string.
    if (fm.description !== undefined && typeof fm.description !== 'string') {
      issues.push('"description" must be a string')
    }

    // model must be a known Claude model ID.
    if (fm.model !== undefined) {
      if (typeof fm.model !== 'string') {
        issues.push('"model" must be a string')
      } else if (!KNOWN_MODELS.has(fm.model)) {
        issues.push(
          `"model" is not a known Claude model ID: "${fm.model}" (allowed: ${[...KNOWN_MODELS].slice(0, 5).join(', ')}, …)`
        )
      }
    }

    // allowed-tools must be a list.
    if (fm['allowed-tools'] !== undefined && !Array.isArray(fm['allowed-tools'])) {
      issues.push('"allowed-tools" must be a YAML list')
    }

    // context (optional) — if present must be "fork".
    if (fm.context !== undefined && fm.context !== 'fork') {
      issues.push(`"context" must be "fork" if present, got "${fm.context}"`)
    }

    // prerequisites (optional) — if present must be a list of strings.
    if (fm.prerequisites !== undefined) {
      if (!Array.isArray(fm.prerequisites)) {
        issues.push('"prerequisites" must be a YAML list')
      } else {
        for (const p of fm.prerequisites) {
          if (typeof p !== 'string') {
            issues.push(`"prerequisites" entries must be strings (got ${typeof p})`)
          }
        }
      }
    }

    // argument-hint (optional) — if present must be a string.
    if (fm['argument-hint'] !== undefined && typeof fm['argument-hint'] !== 'string') {
      issues.push('"argument-hint" must be a string')
    }

    // Body sections.
    for (const section of REQUIRED_SECTIONS) {
      if (!section.pattern.test(body)) {
        issues.push(`body missing required section: "${section.name}"`)
      }
    }

    const status: Status = issues.length === 0 ? 'pass' : 'fail'
    if (status === 'fail') anyFail = true

    record(`skills/${entry}`, status, issues)
    skills.push({
      file: entry,
      skillName: fm?.name ?? fileBasename,
      frontmatter: fm ?? {},
      body,
      issues,
    })
  }

  return { skills, anyFail }
}

// ──────────────────────────────────────────────────────────────────────────
// Check 5: prerequisites chain (references exist + no cycles)
// ──────────────────────────────────────────────────────────────────────────

function checkPrerequisiteChain(skills: ParsedSkill[]): boolean {
  const issues: string[] = []
  const skillByName = new Map<string, ParsedSkill>()
  for (const s of skills) {
    const n = (s.frontmatter?.name as string) || s.skillName
    skillByName.set(n, s)
  }

  // Existence check.
  for (const s of skills) {
    const prereqs = Array.isArray(s.frontmatter?.prerequisites)
      ? (s.frontmatter.prerequisites as string[])
      : []
    for (const p of prereqs) {
      if (typeof p !== 'string') continue
      if (!skillByName.has(p)) {
        issues.push(`"${s.skillName}" lists prerequisite "${p}" which does not exist in skills/`)
      }
    }
  }

  // Cycle detection via DFS (iterative to avoid blowing the stack).
  const graph = new Map<string, string[]>()
  for (const s of skills) {
    const n = (s.frontmatter?.name as string) || s.skillName
    const prereqs = Array.isArray(s.frontmatter?.prerequisites)
      ? (s.frontmatter.prerequisites as string[]).filter(
          (p): p is string => typeof p === 'string'
        )
      : []
    graph.set(n, prereqs)
  }

  const WHITE = 0
  const GRAY = 1
  const BLACK = 2
  const color = new Map<string, number>()
  for (const n of graph.keys()) color.set(n, WHITE)

  function visit(node: string, stack: string[]): string[] | null {
    color.set(node, GRAY)
    const neighbors = graph.get(node) ?? []
    for (const next of neighbors) {
      if (!graph.has(next)) continue // existence issue already reported above
      const c = color.get(next) ?? WHITE
      if (c === GRAY) {
        // Cycle: stack ... → next (which is already in the stack).
        return [...stack, node, next]
      }
      if (c === WHITE) {
        const cycle = visit(next, [...stack, node])
        if (cycle) return cycle
      }
    }
    color.set(node, BLACK)
    return null
  }

  for (const n of graph.keys()) {
    if ((color.get(n) ?? WHITE) === WHITE) {
      const cycle = visit(n, [])
      if (cycle) {
        issues.push(`cycle detected in prerequisites: ${cycle.join(' → ')}`)
        break
      }
    }
  }

  const status: Status = issues.length === 0 ? 'pass' : 'fail'
  record('prerequisites graph', status, issues)
  return status !== 'fail'
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
  section('Per-file results')

  const nameCol = Math.max(4, ...results.map((r) => r.name.length))
  log(
    `  ${C.bold}${pad('File / Check', nameCol)}  ${pad('Status', 6)}  Issues${C.reset}`,
    'gray'
  )
  log(`  ${'-'.repeat(nameCol + 20)}`, 'gray')

  for (const r of results) {
    const firstIssue = r.issues[0] ?? ''
    log(`  ${pad(r.name, nameCol)}  ${statusCell(r.status)}   ${firstIssue}`, 'gray')
    for (const extra of r.issues.slice(1)) {
      log(`  ${pad('', nameCol)}          ${extra}`, 'gray')
    }
  }

  const passes = results.filter((r) => r.status === 'pass').length
  const warns = results.filter((r) => r.status === 'warn').length
  const fails = results.filter((r) => r.status === 'fail').length

  section('Summary')
  log(`  pass: ${passes}`, passes > 0 ? 'green' : 'gray')
  log(`  warn: ${warns}`, warns > 0 ? 'yellow' : 'gray')
  log(`  fail: ${fails}`, fails > 0 ? 'red' : 'gray')
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────

function main() {
  header('Aria plugin validator')
  log(`  plugin root: ${PLUGIN_ROOT}`, 'gray')

  section('Manifests')
  checkPluginJson()
  checkMarketplaceJson()
  checkMcpJson()

  section('Skills')
  const { skills } = checkSkills()

  section('Prerequisites graph')
  checkPrerequisiteChain(skills)

  printReport()

  const hasFail = results.some((r) => r.status === 'fail')
  if (hasFail) {
    log('\nvalidate: FAILED\n', 'red')
    process.exit(1)
  }
  log('\nvalidate: OK\n', 'green')
  process.exit(0)
}

main()
