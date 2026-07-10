// `pnpm -r <script>` silently skips workspace packages that do not define
// <script>. A package with no `typecheck` or `lint` script therefore sails
// through CI green while never being checked at all — the failure mode is
// invisible, which is how openclaw-amem went unchecked by `pnpm -r typecheck`
// and amem-core/amem-api by `pnpm -r lint`. Assert the scripts exist instead.
import { readdirSync, readFileSync } from 'node:fs'

const REQUIRED_SCRIPTS = ['typecheck', 'lint']

const missing = []
for (const entry of readdirSync('packages', { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const { scripts = {} } = JSON.parse(readFileSync(`packages/${entry.name}/package.json`, 'utf8'))
  const absent = REQUIRED_SCRIPTS.filter((name) => !scripts[name])
  if (absent.length) missing.push(`  packages/${entry.name} is missing: ${absent.join(', ')}`)
}

if (missing.length) {
  console.error(`Every package under packages/* must define: ${REQUIRED_SCRIPTS.join(', ')}`)
  console.error(missing.join('\n'))
  process.exit(1)
}

console.log(`every package defines: ${REQUIRED_SCRIPTS.join(', ')}`)
