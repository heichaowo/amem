// A published package must not depend on a private workspace package. pnpm
// rewrites `workspace:*` to the dependency's version when it publishes, so a
// private (never-published) package like amem-core turns into `amem-core@0.1.0`
// in the tarball manifest — and the registry install then 404s on it. That is
// exactly what broke `openclaw plugins install openclaw-amem` at 1.1.3: a
// leftover `amem-core: workspace:*` devDependency. ClawHub runs a full
// `npm install` (devDependencies included), so every dependency field counts.
// Nothing in build or typecheck catches this; only a user's failed install did.
// Assert it on the PR instead.
import { readdirSync, readFileSync } from 'node:fs'

const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

const pkgs = readdirSync('packages', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => JSON.parse(readFileSync(`packages/${entry.name}/package.json`, 'utf8')))

const privateNames = new Set(pkgs.filter((pkg) => pkg.private).map((pkg) => pkg.name))

const violations = []
for (const pkg of pkgs) {
  if (pkg.private) continue // a package that is never published cannot 404 anyone
  for (const field of DEP_FIELDS) {
    for (const dep of Object.keys(pkg[field] ?? {})) {
      if (privateNames.has(dep)) {
        violations.push(`  ${pkg.name} → ${field}["${dep}"]`)
      }
    }
  }
}

if (violations.length) {
  console.error('A published package depends on a private workspace package.')
  console.error('On publish, pnpm rewrites workspace:* to its version and the install 404s.')
  console.error('Bundle it into dist instead (tsup noExternal/alias), or publish it.')
  console.error(violations.join('\n'))
  process.exit(1)
}

console.log(
  `no published package depends on a private one (private: ${[...privateNames].join(', ') || 'none'})`
)
