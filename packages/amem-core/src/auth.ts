/**
 * auth.ts — write authorization for the Access Protocol (Story 33).
 *
 * Story 32 gave every note `owner` / `readers` / `writers` and enforced `readers`
 * at query time. It deliberately left `writers` unenforced. The consequence: the
 * agent filter matches `agent_id == caller OR agent_id == 'shared'`, so ANY query
 * can return another agent's shared note — and every mutation then wrote to it
 * unchecked. An audit found eight such write sites (dedup, link generation,
 * evolution ×2, CRUD update/delete, quality scan, link rewriting).
 *
 * This is the one rule they all gate on. Kept pure and dependency-free so the
 * policy is unit-testable on its own and identical everywhere it is applied.
 */
import type { MemoryNote } from './storage.js'

/**
 * May `callerAgentId` mutate `note`?
 *
 * True when the caller owns it, is listed in `writers`, or `writers` is open
 * (`'*'`). Everything else — notably another agent's shared note, which is
 * readable but not writable — is denied.
 */
export function canWrite(note: Pick<MemoryNote, 'owner' | 'writers'>, callerAgentId: string): boolean {
  return note.owner === callerAgentId || note.writers.includes(callerAgentId) || note.writers.includes('*')
}
