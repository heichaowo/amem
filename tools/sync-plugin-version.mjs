// Keep openclaw.plugin.json's `version` in sync with the plugin package.json.
// Changesets bumps package.json only; the OpenClaw manifest must match, so this
// runs as part of the root `version` script (see package.json).
import { readFileSync, writeFileSync } from 'node:fs'

const PKG = 'packages/openclaw-amem/package.json'
const MANIFEST = 'packages/openclaw-amem/openclaw.plugin.json'

const version = JSON.parse(readFileSync(PKG, 'utf8')).version
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))

if (manifest.version !== version) {
  manifest.version = version
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
  console.log(`synced openclaw.plugin.json version -> ${version}`)
} else {
  console.log(`openclaw.plugin.json already at ${version}`)
}
