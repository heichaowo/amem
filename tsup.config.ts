import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  clean: true,
  bundle: true,
  // @huggingface/transformers uses dynamic imports for ONNX backends
  // bundling it breaks backend detection — keep as external
  external: ['@huggingface/transformers', 'onnxruntime-node'],
  noExternal: ['chromadb', '@anthropic-ai/sdk', 'uuid'],
})
