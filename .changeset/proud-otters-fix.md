---
'openclaw-amem': patch
---

Fix a phantom `amem-core@0.1.0` dependency that broke installation from ClawHub.

The engine is bundled into the plugin's `dist` by tsup, but `amem-core` was
still declared as a `workspace:*` devDependency. On publish, pnpm rewrote that
to `amem-core@0.1.0` — a private package that does not exist on npm. ClawHub
extracts the tarball and runs a full `npm install`, which then 404s on it, so
the plugin could not be installed at all.

The engine is now resolved by a build alias to its source (see
`tsup.config.ts`) instead of a package dependency, so it stays inlined in the
bundle while no longer appearing anywhere in the published manifest.
