# Changesets

This folder is managed by [`@changesets/cli`](https://github.com/changesets/changesets) — the tool that versions
and publishes the packages in this monorepo.

**To record a change for release**, run:

```bash
pnpm changeset
```

Pick the affected package(s) and a bump type (patch / minor / major), and write a short summary. Commit the generated
`.changeset/*.md` file with your PR. On merge to `main`, the release workflow opens a "Version Packages" PR; merging
that PR publishes the bumped packages to npm.

See the [common questions](https://github.com/changesets/changesets/blob/main/docs/common-questions.md).
