/**
 * storage.ts — Qdrant vector storage for A-MEM
 * Uses native fetch (Node 18+) to avoid undici compatibility issues with Node v26
 * Collection: amem_notes, 384-dim cosine, with agent_id isolation
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MemoryNote {
  id: string
  content: string
  keywords: string[]
  tags: string[]
  context: string
  links: string[]     // linked note IDs
  embedding: number[]
  timestamp: string
  agent_id: string    // "main" | "subagent-xxx" | "shared"
  hash: string        // md5(content), for exact-match dedup
}

export interface QueryResult {
  note: MemoryNote
  score: number
}

// ── Config ────────────────────────────────────────────────────────────────────
const QDRANT_URL = 'http://localhost:6333'
const COLLECTION = 'amem_notes'
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

export async function ensureCollection(): Promise<void> {
  if (_collectionReady) return
  try {
    await qdrant('GET', `/collections/${COLLECTION}`)
    _collectionReady = true
  } catch {
    // Create collection
    await qdrant('PUT', `/collections/${COLLECTION}`, {
      vectors: { size: VECTOR_DIM, distance: 'Cosine' },
    })
    // Index agent_id for fast filtering
    await qdrant('PUT', `/collections/${COLLECTION}/index`, {
      field_name: 'agent_id',
      field_schema: 'keyword',
    })
    // Index hash for exact-match dedup
    await qdrant('PUT', `/collections/${COLLECTION}/index`, {
      field_name: 'hash',
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
    },
  }
}

function pointToNote(point: {
  id: string
  payload: Record<string, unknown>
  vector?: number[]
}): MemoryNote {
  const p = point.payload
  return {
    id: String(point.id),
    content: (p.content as string) || '',
    keywords: (p.keywords as string[]) || [],
    tags: (p.tags as string[]) || [],
    context: (p.context as string) || '',
    links: (p.links as string[]) || [],
    timestamp: (p.timestamp as string) || '',
    agent_id: (p.agent_id as string) || 'main',
    embedding: point.vector || [],
    hash: (p.hash as string) || '',
  }
}

// ── Agent filter ──────────────────────────────────────────────────────────────
function agentFilter(agentId: string) {
  return {
    should: [
      { key: 'agent_id', match: { value: agentId } },
      { key: 'agent_id', match: { value: 'shared' } },
    ],
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
export async function addNote(note: MemoryNote): Promise<void> {
  await ensureCollection()
  await qdrant('PUT', `/collections/${COLLECTION}/points?wait=true`, {
    points: [noteToPoint(note)],
  })
}

export async function getNote(id: string): Promise<MemoryNote | null> {
  await ensureCollection()
  try {
    const result = (await qdrant('POST', `/collections/${COLLECTION}/points`, {
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
  const result = (await qdrant('POST', `/collections/${COLLECTION}/points/scroll`, body)) as {
    points: Array<{ id: string; payload: Record<string, unknown>; vector: number[] }>
  }
  if (!result.points.length) return null
  return pointToNote(result.points[0])
}

/**
 * Update content, embedding, and hash of an existing note (partial update).
 * Other fields (keywords, tags, context, links, etc.) are preserved.
 */
export async function updateNoteContent(
  id: string,
  content: string,
  embedding: number[],
  hash: string,
): Promise<void> {
  await ensureCollection()
  // Update the vector
  await qdrant('PUT', `/collections/${COLLECTION}/points/vectors?wait=true`, {
    points: [{ id, vector: embedding }],
  })
  // Update the payload fields
  await qdrant('POST', `/collections/${COLLECTION}/points/payload?wait=true`, {
    payload: { content, hash },
    points: [id],
  })
}

export async function queryByEmbedding(
  embedding: number[],
  topK: number,
  agentId: string,
  scoreThreshold = 0.0,
): Promise<QueryResult[]> {
  await ensureCollection()
  const result = (await qdrant('POST', `/collections/${COLLECTION}/points/search`, {
    vector: embedding,
    limit: topK,
    with_payload: true,
    with_vector: true,
    score_threshold: scoreThreshold,
    filter: agentFilter(agentId),
  })) as Array<{ id: string; score: number; payload: Record<string, unknown>; vector: number[] }>

  return result.map((r) => ({
    note: pointToNote(r),
    score: r.score,
  }))
}

export async function listNotes(agentId?: string): Promise<MemoryNote[]> {
  await ensureCollection()
  const body: Record<string, unknown> = {
    with_payload: true,
    with_vector: true,
    limit: 10000,
  }
  if (agentId) body.filter = agentFilter(agentId)

  const result = (await qdrant('POST', `/collections/${COLLECTION}/points/scroll`, body)) as {
    points: Array<{ id: string; payload: Record<string, unknown>; vector: number[] }>
  }
  return result.points.map(pointToNote)
}

export async function countNotes(agentId?: string): Promise<number> {
  await ensureCollection()
  const body: Record<string, unknown> = { exact: true }
  if (agentId) body.filter = agentFilter(agentId)

  const result = (await qdrant('POST', `/collections/${COLLECTION}/points/count`, body)) as {
    count: number
  }
  return result.count
}
