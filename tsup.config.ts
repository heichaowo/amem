import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  clean: true,
  bundle: true,
  noExternal: ['chromadb', '@huggingface/transformers', '@anthropic-ai/sdk'],
})
