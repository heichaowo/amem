import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  clean: true,
  bundle: true,
  // @huggingface/transformers uses dynamic imports for ONNX backends
  // bundling it breaks backend detection — keep as external
  external: [
    '@huggingface/transformers',
    'onnxruntime-node',
    'openclaw',
    /^openclaw\/.+/
  ],
  // Only amem-core (an unpublished workspace package) must be inlined.
  // Everything in `dependencies` stays external so it is installed at
  // runtime, not baked into dist — this keeps the bundle small and avoids
  // tripping registry scanners on vendored SDK credential-reading code.
  noExternal: ['amem-core'],
})
