import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Run test files sequentially to prevent Qdrant integration tests
    // from interfering with each other via concurrent collection operations.
    pool: 'forks',
    singleFork: true,
  },
})
