import { defineConfig } from 'tsup'

export default defineConfig({
  // `index` is the importable surface (used by tests and, later, by the MCP
  // bridge); `cli` is the process entrypoint.
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
})
