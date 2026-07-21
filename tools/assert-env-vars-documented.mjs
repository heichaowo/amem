// Every env var the plugin's code reads must be (1) declared in
// openclaw.plugin.json's envVars and (2) documented in the config reference.
//
// The plugin bundles the amem-core engine, so ClawHub's scan sees every
// `process.env.X` the bundled code reads. It clears the resulting "env access"
// finding only against the *declared* capability list — an undeclared var means
// the version is silently held (1.2.0 got stuck on ClawHub because the OpenAI
// provider added `OPENAI_API_KEY` / `AMEM_LLM_PROVIDER` without updating the
// manifest). And the docs drift the same way (a var the code reads but the wiki
// never mentions). Nothing in build/typecheck catches either. Assert it here.
//
// Chain (manifest is the pivot):  code reads ⊆ plugin.json envVars ⊆ config docs.
import { readdirSync, readFileSync } from 'node:fs'

// Source the plugin actually ships: its own src + the inlined engine src.
const SRC_DIRS = ['packages/amem-core/src', 'packages/openclaw-amem/src']
const MANIFEST = 'packages/openclaw-amem/openclaw.plugin.json'
const DOCS = 'docs/reference/configuration.md'

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

// ── the two declaration surfaces ──────────────────────────────────────────────
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
const declared = new Set(manifest.setup.providers.flatMap((p) => p.envVars ?? []))
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

if (problems.length) {
  console.error('✗ env var documentation is out of sync:\n')
  for (const p of problems) console.error(`  - ${p}`)
  console.error(
    `\nKeep the chain in sync: a var the code reads must appear in ${MANIFEST} AND ${DOCS}.`
  )
  process.exit(1)
}

console.log(`✓ ${readVars.size} code-read env vars are declared in the manifest and documented (${DOCS}).`)
