/**
 * crud-guard.ts — write-safety policy for the agent_end CRUD decision (Story 41).
 *
 * The CRUD step hands the LLM a numbered list of candidate memories and asks it
 * to pick one to UPDATE or DELETE. Picking the WRONG number is the engine's only
 * silent, unrecoverable failure:
 *
 *   - DELETE is already safe — `invalidateNote` is a soft delete (is_active=false).
 *   - UPDATE is not — `updateNoteContent` overwrites content + embedding in place.
 *
 * An out-of-range index is harmless (`memories[bad]` is undefined and the caller
 * skips it). The dangerous case is an in-range but WRONG index: both are valid
 * array positions, so nothing structural catches it, and the access protocol
 * (Story 33/36) does not either — the caller usually does own the note it is
 * about to clobber.
 *
 * This is a documented failure class, not a hypothetical: mem0 removed its own
 * CRUD step in part because "overwrites sometimes erased key information from the
 * original fact", and Memory-R1 exists because vanilla LLMs mis-classify additive
 * facts as contradictions. The risk scales inversely with model capability, and
 * the memories that reach this step have already survived hash and vector dedup —
 * i.e. they are the HARDEST subset, exactly where a cheap model is least reliable.
 *
 * The rule below is the architectural answer to that, rather than paying for a
 * bigger model: before overwriting a memory, check that the replacement text is
 * at least plausibly ABOUT that memory. A mis-targeted UPDATE rewrites a note
 * with content that has nothing to do with it, which is cheap to detect — both
 * embeddings are already in hand, so this costs one dot product and no LLM call.
 */
import { cosineSimilarity } from './embedding.js'

/**
 * Similarity floor for accepting an UPDATE target.
 *
 * Heuristic, not empirically tuned: it sits just above the 0.3 bar the engine
 * already uses for "these two notes are related at all", because a legitimate
 * CRUD UPDATE is often a correction or contradiction ("drinks tea" → "switched to
 * coffee") that is related but not near-identical. Set it too high and real
 * corrections get downgraded; too low and the guard does nothing.
 *
 * Failing this check is SAFE by construction — the caller inserts the fact as a
 * new memory instead of overwriting, and scheduled consolidation can merge later.
 * So the cost of a false positive is a duplicate, and the cost of a false
 * negative is a destroyed memory. Bias accordingly: raise it for cheaper models.
 */
export const DEFAULT_CRUD_UPDATE_MIN_SIM = 0.35

/** Resolve the threshold: env var wins, then an explicit override, then default. */
export function resolveCrudUpdateMinSim(override?: number): number {
  const envVal = Number(process.env.AMEM_CRUD_UPDATE_MIN_SIM)
  if (Number.isFinite(envVal) && envVal >= 0) return envVal
  if (override !== undefined && Number.isFinite(override) && override >= 0) return override
  return DEFAULT_CRUD_UPDATE_MIN_SIM
}

/**
 * May `newEmbedding`'s fact overwrite the memory `targetEmbedding` belongs to?
 *
 * True when the replacement is plausibly about the same thing. False means the
 * LLM most likely named the wrong index — the caller should insert instead of
 * overwrite, never throw.
 *
 * Both vectors are L2-normalized by `encode`, so this is a dot product.
 */
export function isPlausibleUpdateTarget(
  newEmbedding: number[],
  targetEmbedding: number[],
  minSimilarity?: number
): boolean {
  // A missing or malformed vector is not evidence of a good target. Refuse
  // rather than let a degenerate similarity wave the overwrite through.
  if (!newEmbedding?.length || !targetEmbedding?.length) return false
  if (newEmbedding.length !== targetEmbedding.length) return false
  return cosineSimilarity(newEmbedding, targetEmbedding) >= resolveCrudUpdateMinSim(minSimilarity)
}
