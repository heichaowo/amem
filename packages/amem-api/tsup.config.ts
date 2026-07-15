import { defineConfig } from 'tsup'

export default defineConfig({
  // `index` is the importable surface. Two entrypoints, one per interface:
  // `cli` serves HTTP and owns the engine; `mcp-cli` speaks MCP over stdio and
  // is a thin client of the former.
  entry: ['src/index.ts', 'src/cli.ts', 'src/mcp-cli.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
})
