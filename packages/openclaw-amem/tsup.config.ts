import { defineConfig } from 'tsup'
import { fileURLToPath } from 'node:url'

// amem-core is an unpublished workspace package, inlined into this bundle so the
// plugin ships self-contained. It is resolved by alias to its source rather than
// declared as a dependency on purpose: a `workspace:*` dependency is rewritten to
// `amem-core@0.1.0` in the published manifest, and ClawHub's `npm install` then
// 404s on it — there is no such package on the registry. No dependency, no leak.
const amemCore = fileURLToPath(new URL('../amem-core/src/index.ts', import.meta.url))

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
    // only amem-core is inlined, via this alias to its source.
    options.alias = { ...options.alias, 'amem-core': amemCore }
  },
})
