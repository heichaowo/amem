/**
 * amem — the A-MEM agentic memory engine (framework-agnostic).
 *
 * Qdrant + Transformers.js, no Python. Note construction, link generation,
 * memory evolution, and hybrid (BM25 + dense) retrieval with graph expansion.
 * Any host — the OpenClaw plugin, the amem-api service, a game agent — shares
 * this one engine.
 *
 * This is the deliberate public surface. The ranking primitives (BM25, RRF,
 * tokenisation), the LLM call helpers, the evolution throttle, the prompt
 * locale table and the low-level Qdrant point operations are all real but
 * internal; tests reach them through their source modules, not through here.
 */

// ── Configuration ─────────────────────────────────────────────────────────────
export { configure } from './config.js'

// ── Embedding & model lifecycle ───────────────────────────────────────────────
export { encode, loadModel, isModelLoaded } from './embedding.js'

// ── Memory operations ─────────────────────────────────────────────────────────
export {
  addMemory,
  addEpisodic,
  searchMemory,
  listMemories,
  mergeSimilarNotes,
  consolidateMemories,
  checkQuality,
  type SearchResult,
} from './memory.js'

// ── Quality ───────────────────────────────────────────────────────────────────
export { scanLowQuality, generateReviewBatch, type LowQualityItem, type LowQualityReason } from './quality.js'

// ── Storage ───────────────────────────────────────────────────────────────────
export {
  createStorageContext,
  ensureCollection,
  pingQdrant,
  listNotes,
  getNote,
  updateNote,
  deleteNote,
  invalidateNote,
  patchNotePayload,
  type StorageContext,
  type MemoryNote,
  type QueryResult,
  type EvolutionEntry,
  type AmemPluginConfig,
  type AgentAmemConfig,
} from './storage.js'

// ── LLM (one host-facing helper; the rest of the LLM layer is internal) ───────
export { llmCrudDecision, type MemoryOperation } from './llm.js'
