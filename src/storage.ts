/**
 * storage.ts — Qdrant vector storage for A-MEM
 * Uses native fetch (Node 18+) to avoid undici compatibility issues with Node v26
 * Collection: amem_notes, 384-dim cosine, with agent_id isolation
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** One entry in a note's evolution history (Story 13-B) */
export interface EvolutionEntry {
  triggeredBy: string // ID of the new note that caused this evolution
  triggeredAt: string // ISO timestamp
  oldContext: string
  newContext: string
  oldTags: string[]
  newTags: string[]
  action?: 'update_neighbor' | 'strengthen' | 'consolidate'
  suggestedConnections?: string[]
  tagsUpdated?: string[]
}

export interface MemoryNote {
  id: string
  content: string
  keywords: string[]
  tags: string[]
  context: string
  links: string[] // linked note IDs
  embedding: number[]
  timestamp: string
  agent_id: string // "main" | "subagent-xxx" | "shared"
  hash: string // md5(content), for exact-match dedup
  // ── Story 13-A: retrieval heat tracking ──────────────────────────────────
  retrieval_count: number // times this note has been returned by queryByEmbedding
  last_accessed: string // ISO timestamp of most recent retrieval
  // ── Story 13-B: evolution history ────────────────────────────────────────
  evolution_history: EvolutionEntry[] // log of tag/context changes
  // ── Story 13-E: coarse category ──────────────────────────────────────────
  category: string // e.g. "Technical" | "Business" | … | "General"
  is_active: boolean
  // ── Story 26A: knowledge type classification ──────────────────────────────
  note_type: 'memory' | 'knowledge' // memory: episodic; knowledge: durable reference
  // ── Story 26B: topic tags for knowledge notes ─────────────────────────────────────────
  topics: string[] // subject tags, e.g. ["TypeScript", "Qdrant"]; empty for memory notes
}

export interface QueryResult {
  note: MemoryNote
  score: number
}

// ── Config ────────────────────────────────────────────────────────────────────
const QDRANT_URL = 'http://localhost:6333'
const getCollection = () => process.env.AMEM_COLLECTION || 'amem_notes'
const VECTOR_DIM = 384

// ── HTTP helpers ──────────────────────────────────────────────────────────────
async function qdrant(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${QDRANT_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = (await res.json()) as { status: string; result?: unknown; error?: string }
  if (!res.ok || (data.status && data.status !== 'ok' && data.status !== 'acknowledged')) {
    throw new Error(`Qdrant ${method} ${path} failed: ${data.error || JSON.stringify(data)}`)
  }
  return data.result
}

// ── Collection init ───────────────────────────────────────────────────────────
let _collectionReady = false

/** Reset the collection-ready flag. Used in tests after dropping the collection. */
export function resetCollectionReady(): void {
  _collectionReady = false
}

export async function ensureCollection(): Promise<void> {
  if (_collectionReady) return
  try {
    await qdrant('GET', `/collections/${getCollection()}`)
    _collectionReady = true
  } catch {
    // Create collection
    await qdrant('PUT', `/collections/${getCollection()}`, {
      vectors: { size: VECTOR_DIM, distance: 'Cosine' },
    })
    // Index agent_id for fast filtering
    await qdrant('PUT', `/collections/${getCollection()}/index`, {
      field_name: 'agent_id',
      field_schema: 'keyword',
    })
    // Index hash for exact-match dedup
    await qdrant('PUT', `/collections/${getCollection()}/index`, {
      field_name: 'hash',
      field_schema: 'keyword',
    })
    // Story 26B: Index topics for knowledge note filtering
    await qdrant('PUT', `/collections/${getCollection()}/index`, {
      field_name: 'topics',
      field_schema: 'keyword',
    })
    _collectionReady = true
  }
}

// ── Payload mapping ───────────────────────────────────────────────────────────
function noteToPoint(note: MemoryNote) {
  return {
    id: note.id,
    vector: note.embedding,
    payload: {
      content: note.content,
      keywords: note.keywords,
      tags: note.tags,
      context: note.context,
      links: note.links,
      timestamp: note.timestamp,
      agent_id: note.agent_id,
      hash: note.hash,
      // 13-A
      retrieval_count: note.retrieval_count ?? 0,
      last_accessed: note.last_accessed || note.timestamp,
      // 13-B: stored as JSON string (Qdrant payload can't handle nested array-of-objects)
      evolution_history: JSON.stringify(note.evolution_history ?? []),
      // 13-E
      category: note.category || 'General',
      is_active: note.is_active !== false,
      // 26B
      topics: note.topics ?? [],
    },
  }
}

function pointToNote(point: { id: string; payload: Record<string, unknown>; vector?: number[] }): MemoryNote {
  const p = point.payload
  const timestamp = (p.timestamp as string) || ''

  // 13-B: deserialize evolution_history from JSON string
  let evolutionHistory: EvolutionEntry[] = []
  try {
    const raw = p.evolution_history
    if (typeof raw === 'string' && raw.length > 0) {
      evolutionHistory = JSON.parse(raw) as EvolutionEntry[]
    } else if (Array.isArray(raw)) {
      // handle legacy case where it was stored as array
      evolutionHistory = raw as EvolutionEntry[]
    }
  } catch {
    evolutionHistory = []
  }

  return {
    id: String(point.id),
    content: (p.content as string) || '',
    keywords: (p.keywords as string[]) || [],
    tags: (p.tags as string[]) || [],
    context: (p.context as string) || '',
    links: (p.links as string[]) || [],
    timestamp,
    agent_id: (p.agent_id as string) || 'main',
    embedding: point.vector || [],
    hash: (p.hash as string) || '',
    // 13-A
    retrieval_count: typeof p.retrieval_count === 'number' ? p.retrieval_count : 0,
    last_accessed: (p.last_accessed as string) || timestamp,
    // 13-B
    evolution_history: evolutionHistory,
    // 13-E
    category: (p.category as string) || 'General',
    is_active: p.is_active !== false,
    // 26A
    note_type: ((p.note_type as string) === 'knowledge' ? 'knowledge' : 'memory') as 'memory' | 'knowledge',
    // 26B
    topics: Array.isArray(p.topics) ? (p.topics as string[]) : [],
  }
}

// ── Agent filter ──────────────────────────────────────────────────────────────
function agentFilter(agentId: string) {
  return {
    must: [
      {
        should: [
          { key: 'agent_id', match: { value: agentId } },
          { key: 'agent_id', match: { value: 'shared' } },
        ],
      },
    ],
    must_not: [{ key: 'is_active', match: { value: false } }],
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
export async function addNote(note: MemoryNote): Promise<void> {
  await ensureCollection()
  await qdrant('PUT', `/collections/${getCollection()}/points?wait=true`, {
    points: [noteToPoint(note)],
  })
}

export async function getNote(id: string): Promise<MemoryNote | null> {
  await ensureCollection()
  try {
    const result = (await qdrant('POST', `/collections/${getCollection()}/points`, {
      ids: [id],
      with_payload: true,
      with_vector: true,
    })) as Array<{ id: string; payload: Record<string, unknown>; vector: number[] }>
    if (!result.length) return null
    return pointToNote(result[0])
  } catch {
    return null
  }
}

export async function updateNote(note: MemoryNote): Promise<void> {
  await addNote(note) // upsert
}

/**
 * Find a note by exact MD5 hash match within an agent's scope.
 * Returns the first match, or null if none found.
 */
export async function findByHash(hash: string, agentId: string): Promise<MemoryNote | null> {
  await ensureCollection()
  const body = {
    filter: {
      must: [
        { key: 'hash', match: { value: hash } },
        { key: 'is_active', match: { value: true } },
        {
          should: [
            { key: 'agent_id', match: { value: agentId } },
            { key: 'agent_id', match: { value: 'shared' } },
          ],
        },
      ],
    },
    with_payload: true,
    with_vector: true,
    limit: 1,
  }
  const result = (await qdrant('POST', `/collections/${getCollection()}/points/scroll`, body)) as {
    points: Array<{ id: string; payload: Record<string, unknown>; vector: number[] }>
  }
  if (!result.points.length) return null
  return pointToNote(result.points[0])
}

/**
 * Update content, embedding, and hash of an existing note (partial update).
 * Other fields (keywords, tags, context, links, etc.) are preserved.
 */
export async function updateNoteContent(id: string, content: string, embedding: number[], hash: string): Promise<void> {
  await ensureCollection()
  // Update the vector
  await qdrant('PUT', `/collections/${getCollection()}/points/vectors?wait=true`, {
    points: [{ id, vector: embedding }],
  })
  // Update the payload fields
  await qdrant('POST', `/collections/${getCollection()}/points/payload?wait=true`, {
    payload: { content, hash },
    points: [id],
  })
}

export async function queryByEmbedding(
  embedding: number[],
  topK: number,
  agentId: string,
  scoreThreshold = 0.0
): Promise<QueryResult[]> {
  await ensureCollection()
  const result = (await qdrant('POST', `/collections/${getCollection()}/points/search`, {
    vector: embedding,
    limit: topK,
    with_payload: true,
    with_vector: true,
    score_threshold: scoreThreshold,
    filter: agentFilter(agentId),
  })) as Array<{ id: string; score: number; payload: Record<string, unknown>; vector: number[] }>

  const queryResults = result.map((r) => ({
    note: pointToNote(r),
    score: r.score,
  }))

  // 13-A: Batch-update retrieval_count and last_accessed for all hits (non-blocking)
  if (queryResults.length > 0) {
    const now = new Date().toISOString()
    const ids = queryResults.map((r) => r.note.id)

    // Fire-and-forget: increment retrieval_count per-point
    // Qdrant doesn't support atomic increment via payload patch, so we
    // compute the new count from the in-memory note and patch it.
    const patches = queryResults.map((r) => ({
      id: r.note.id,
      retrieval_count: (r.note.retrieval_count || 0) + 1,
    }))

    // We send individual patches (each has a different retrieval_count value),
    // but group the shared last_accessed update in one bulk call.
    Promise.all([
      // last_accessed bulk update (same value for all)
      qdrant('POST', `/collections/${getCollection()}/points/payload?wait=false`, {
        payload: { last_accessed: now },
        points: ids,
      }),
      // per-note retrieval_count increments
      ...patches.map((p) =>
        qdrant('POST', `/collections/${getCollection()}/points/payload?wait=false`, {
          payload: { retrieval_count: p.retrieval_count },
          points: [p.id],
        })
      ),
    ]).catch((err: unknown) => {
      // Non-fatal: retrieval tracking failure must not break search
      console.error(`[amem] retrieval tracking patch failed: ${(err as Error).message}`)
    })

    // Update in-memory note objects so callers see fresh values immediately
    for (const r of queryResults) {
      r.note.retrieval_count = (r.note.retrieval_count || 0) + 1
      r.note.last_accessed = now
    }
  }

  return queryResults
}

export async function listNotes(agentId?: string): Promise<MemoryNote[]> {
  await ensureCollection()
  const body: Record<string, unknown> = {
    with_payload: true,
    with_vector: true,
    limit: 10000,
  }
  if (agentId) body.filter = agentFilter(agentId)

  const result = (await qdrant('POST', `/collections/${getCollection()}/points/scroll`, body)) as {
    points: Array<{ id: string; payload: Record<string, unknown>; vector: number[] }>
  }
  return result.points.map(pointToNote)
}

export async function deleteNote(id: string): Promise<void> {
  await ensureCollection()
  await qdrant('POST', `/collections/${getCollection()}/points/delete`, {
    points: [id],
  })
}

export async function invalidateNote(id: string): Promise<void> {
  await ensureCollection()
  await qdrant('POST', `/collections/${getCollection()}/points/payload?wait=true`, {
    payload: { is_active: false },
    points: [id],
  })
}

/**
 * Fetch all notes for a given agentId whose timestamp starts with datePrefix (e.g. "2026-05-15").
 * Qdrant does not support string prefix filters, so we scroll all agent notes and filter in memory.
 */
export async function getNotesByDatePrefix(datePrefix: string, agentId: string): Promise<MemoryNote[]> {
  await ensureCollection()
  const body: Record<string, unknown> = {
    filter: {
      must: [
        { key: 'is_active', match: { value: true } },
        {
          should: [
            { key: 'agent_id', match: { value: agentId } },
            { key: 'agent_id', match: { value: 'shared' } },
          ],
        },
      ],
    },
    with_payload: true,
    with_vector: true,
    limit: 10000,
  }
  const result = (await qdrant('POST', `/collections/${getCollection()}/points/scroll`, body)) as {
    points: Array<{ id: string; payload: Record<string, unknown>; vector: number[] }>
  }
  return result.points.map(pointToNote).filter((n) => n.timestamp.startsWith(datePrefix))
}

export async function countNotes(agentId?: string): Promise<number> {
  await ensureCollection()
  const body: Record<string, unknown> = { exact: true }
  if (agentId) body.filter = agentFilter(agentId)

  const result = (await qdrant('POST', `/collections/${getCollection()}/points/count`, body)) as {
    count: number
  }
  return result.count
}

export async function updateNoteLinks(id: string, links: string[]): Promise<void> {
  await ensureCollection()
  await qdrant('POST', `/collections/${getCollection()}/points/payload?wait=true`, {
    payload: { links },
    points: [id],
  })
}

export async function replaceLinkReferences(oldId: string, newId: string, agentId: string): Promise<void> {
  const notes = await listNotes(agentId)
  for (const note of notes) {
    if (note.links.includes(oldId)) {
      const newLinks = note.links.map((linkId) => (linkId === oldId ? newId : linkId))
      const filteredLinks = newLinks.filter((linkId) => linkId !== note.id)
      const uniqueLinks = Array.from(new Set(filteredLinks))
      await updateNoteLinks(note.id, uniqueLinks)
    }
  }
}
