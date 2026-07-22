// The plugin's two configuration surfaces — environment variables and
// openclaw.json config keys — must each be declared in openclaw.plugin.json and
// documented in the config reference. Both drift silently, in different ways.
//
// Env vars: the plugin bundles the amem-core engine, so ClawHub's scan sees every
// `process.env.X` the bundled code reads. It clears the resulting "env access"
// finding only against the *declared* capability list — an undeclared var means
// the version is silently held (1.2.0 got stuck on ClawHub because the OpenAI
// provider added `OPENAI_API_KEY` / `AMEM_LLM_PROVIDER` without updating the
// manifest).
//
// Config keys: the manifest's configSchema is `additionalProperties: false`, so
// a key the code reads but the schema omits is REJECTED BY THE HOST — the user's
// setting is dropped and the plugin quietly runs on the default. Nothing in
// build, typecheck or lint catches that; the types happily describe a field the
// host will never deliver.
//
// And the docs drift from both the same way. Assert all of it here.
//
// Two chains, manifest as the pivot:
//   env:     code reads       ⊆ plugin.json envVars      ⊆ config docs
//   config:  AmemPluginConfig ⊆ plugin.json configSchema ⊆ config docs
import { readdirSync, readFileSync } from 'node:fs'

// Source the plugin actually ships: its own src + the inlined engine src.
const SRC_DIRS = ['packages/amem-core/src', 'packages/openclaw-amem/src']
const MANIFEST = 'packages/openclaw-amem/openclaw.plugin.json'
const DOCS = 'docs/reference/configuration.md'
// The interface the plugin casts api.pluginConfig to — the config keys it accepts.
const CONFIG_TYPE_FILE = 'packages/amem-core/src/storage.ts'
const CONFIG_TYPE_NAME = 'AmemPluginConfig'

// Non-configuration env reads to skip (none today). Add with a reason if a
// genuine internal (e.g. NODE_ENV) ever appears — a deliberate, visible act.
const IGNORE = new Set([])

// ── collect every env var the shipped code reads ──────────────────────────────
const readVars = new Set()
for (const dir of SRC_DIRS) {
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue
    const src = readFileSync(`${entry.parentPath ?? entry.path}/${entry.name}`, 'utf8')
    for (const m of src.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
      if (!IGNORE.has(m[1])) readVars.add(m[1])
    }
  }
}

// ── collect every config key the plugin accepts ───────────────────────────────
// Read the interface body rather than every `pluginConfig.x` access: the cast to
// AmemPluginConfig is the one place a key becomes accepted, and the body is a
// flat list of `name?: type` lines.
const typeSrc = readFileSync(CONFIG_TYPE_FILE, 'utf8')
const open = typeSrc.indexOf(`export interface ${CONFIG_TYPE_NAME} {`)
if (open < 0) throw new Error(`could not find "export interface ${CONFIG_TYPE_NAME}" in ${CONFIG_TYPE_FILE}`)
// Walk braces to the matching close. A regex either overruns the file or stops
// at the first nested `}` — and a gate that silently reads too few fields is
// worse than no gate.
let depth = 0
let end = -1
for (let i = typeSrc.indexOf('{', open); i < typeSrc.length; i++) {
  if (typeSrc[i] === '{') depth++
  else if (typeSrc[i] === '}' && --depth === 0) {
    end = i
    break
  }
}
if (end < 0) throw new Error(`unbalanced braces in ${CONFIG_TYPE_NAME} (${CONFIG_TYPE_FILE})`)
// Top-level fields only — two-space indent. Nested shapes are the host's problem.
const configKeys = new Set(
  [...typeSrc.slice(open, end).matchAll(/^ {2}([A-Za-z_][A-Za-z0-9_]*)\??:/gm)].map((m) => m[1])
)
if (!configKeys.size) throw new Error(`parsed zero fields out of ${CONFIG_TYPE_NAME} — the parser has drifted`)

// ── the declaration surfaces ──────────────────────────────────────────────────
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const declared = new Set(manifest.setup.providers.flatMap((p) => p.envVars ?? []))
const schemaKeys = new Set(Object.keys(manifest.configSchema?.properties ?? {}))
const docs = readFileSync(DOCS, 'utf8')

const problems = []

// (1) code reads ⊆ manifest envVars
for (const v of readVars) {
  if (!declared.has(v)) problems.push(`${v}: read in code but NOT declared in ${MANIFEST} (setup.providers[].envVars)`)
}

// (2) manifest envVars ⊆ config docs
for (const v of declared) {
  if (!docs.includes(v)) problems.push(`${v}: declared in ${MANIFEST} but NOT documented in ${DOCS}`)
}

// (3) AmemPluginConfig ⊆ manifest configSchema — else the host drops the key
for (const k of configKeys) {
  if (!schemaKeys.has(k)) {
    problems.push(
      `${k}: accepted by ${CONFIG_TYPE_NAME} but NOT in ${MANIFEST} configSchema.properties ` +
        `(additionalProperties is false, so the host would drop it)`
    )
  }
}

// (4) manifest configSchema ⊆ config docs
for (const k of schemaKeys) {
  if (!docs.includes(k)) problems.push(`${k}: in ${MANIFEST} configSchema but NOT documented in ${DOCS}`)
}

if (problems.length) {
  console.error('✗ configuration documentation is out of sync:\n')
  for (const p of problems) console.error(`  - ${p}`)
  console.error(
    `\nKeep both chains in sync: an env var the code reads, and a config key ${CONFIG_TYPE_NAME} accepts,\n` +
      `must each appear in ${MANIFEST} AND ${DOCS}.`
  )
  process.exit(1)
}

console.log(
  `✓ ${readVars.size} env vars and ${configKeys.size} config keys are declared in the manifest and documented (${DOCS}).`
)
