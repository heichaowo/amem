import { defineConfig } from 'tsup'
import { fileURLToPath } from 'node:url'

// The `amem` engine is an unpublished workspace package (its source lives in
// packages/amem-core), inlined into this bundle so the plugin ships
// self-contained. It is resolved by alias to its source rather than declared as
// a dependency on purpose: a `workspace:*` dependency is rewritten to a version
// in the published manifest, and ClawHub's `npm install` then 404s on it while
// it is unpublished. No dependency, no leak.
const amemEngine = fileURLToPath(new URL('../amem-core/src/index.ts', import.meta.url))

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  clean: true,
  bundle: true,
  // @huggingface/transformers uses dynamic imports for ONNX backends
  // bundling it breaks backend detection — keep as external
  external: ['@huggingface/transformers', 'onnxruntime-node', 'openclaw', /^openclaw\/.+/],
  esbuildOptions(options) {
    // Everything in `dependencies` stays external and is installed at runtime;
    // only the `amem` engine is inlined, via this alias to its source.
    options.alias = { ...options.alias, amem: amemEngine }
  },
})
