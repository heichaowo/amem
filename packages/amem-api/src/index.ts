/**
 * amem-api — the single-writer memory service for the amem stack.
 *
 * One process owns Qdrant, the embedding model, evolution and consolidation.
 * Every consumer — the OpenClaw plugin in remote mode, a game brain — talks to
 * it over HTTP or MCP rather than importing `amem-core` and opening its own
 * Qdrant connection. That is what makes the single-writer guarantee structural
 * instead of a convention.
 */
export { createApp } from './app.js'
