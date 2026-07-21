/**
 * Story 36 — the link-neighbourhood walk must not surface a note the caller may
 * not read. Synthetic notes and an injected mock StorageContext only; nothing
 * touches a real Qdrant or a real memory.
 *
 * The shape that matters: a SHARED note is returned to every agent by every
 * query, and its `links[]` can name its owner's PRIVATE notes. Evolution walks
 * those links and puts their content into the LLM prompt — so without the read
 * rule, one shared note leaks its owner's private memory to anyone who links to it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fakeEncode } = vi.hoisted(() => ({
  fakeEncode: (t: string) => Array.from({ length: 8 }, (_, i) => ((t.charCodeAt(i % t.length) || 1) % 7) / 7),
}))

vi.mock('../../src/embedding.js', () => ({
  encode: vi.fn(async (t: string) => fakeEncode(t)),
  cosineSimilarity: (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0),
}))

vi.mock('../../src/llm.js', () => ({
  llmConstructNote: vi.fn(async () => ({
    keywords: ['k'],
    tags: ['t'],
    context: 'c',
    category: 'General',
    note_type: 'memory',
    topics: [],
    confidence: 'high',
  })),
  llmShouldLink: vi.fn(async () => true),
  llmEvolveNote: vi.fn(async () => ({
    tags: null,
    context: null,
    shouldStrengthen: false,
    suggestedConnections: [],
    tagsToUpdate: [],
  })),
  llmShouldMerge: vi.fn(),
  llmEvolutionJudge: vi.fn(),
  llmCrudDecision: vi.fn(),
}))

// Evolution is normally gated behind a 20-write counter; force it on.
vi.mock('../../src/evo-counter.js', () => ({
  shouldRunEvolution: () => true,
  getEvoCount: () => 20,
  incrementEvoCount: vi.fn(() => 20),
}))

import { addMemory } from '../../src/memory.js'
import { canRead } from '../../src/auth.js'
import type { MemoryNote, StorageContext } from '../../src/storage.js'

const CONTENT = 'a sufficiently long synthetic memory note for testing'

const PRIVATE_ID = '22222222-2222-4222-8222-222222222222'
const PUBLIC_ID = '33333333-3333-4333-8333-333333333333'
const SHARED_ID = '11111111-1111-4111-8111-111111111111'

const PRIVATE_CONTENT = 'agentA private diary entry that must never leak'

function note(over: Partial<MemoryNote> & Pick<MemoryNote, 'id' | 'content' | 'owner' | 'readers'>): MemoryNote {
  return {
    timestamp: new Date().toISOString(),
    keywords: [],
    tags: [],
    context: '',
    embedding: fakeEncode(over.content),
    links: [],
    agent_id: 'shared',
    hash: over.id,
    retrieval_count: 0,
    last_accessed: new Date().toISOString(),
    is_active: true,
    writers: ['*'],
    ...over,
  } as MemoryNote
}

/**
 * A store whose getNote honours `canRead` exactly as the real one does, so the
 * assertion is on the call site: does it pass the caller through?
 */
function makeCtx(notes: MemoryNote[], topMatch: MemoryNote) {
  const byId = new Map(notes.map((n) => [n.id, n]))
  return {
    findByHash: vi.fn(async () => null),
    countNotes: vi.fn(async () => notes.length + 1),
    queryByEmbedding: vi.fn(async () => [{ note: topMatch, score: 0.5 }]),
    addNote: vi.fn(async () => {}),
    updateNoteContent: vi.fn(async () => true),
    updateNote: vi.fn(async () => {}),
    getNote: vi.fn(async (id: string, readerAgentId?: string) => {
      const n = byId.get(id)
      if (!n) return null
      if (readerAgentId !== undefined && !canRead(n, readerAgentId)) return null
      return n
    }),
  } as unknown as StorageContext
}

beforeEach(() => vi.clearAllMocks())

describe('Story 36 — evolution must not read a neighbour the caller cannot', () => {
  it('drops the owner’s private neighbour and keeps the public one', async () => {
    const priv = note({ id: PRIVATE_ID, content: PRIVATE_CONTENT, owner: 'agentA', readers: ['agentA'] })
    const pub = note({ id: PUBLIC_ID, content: 'agentA public note', owner: 'agentA', readers: ['*'] })
    // Shared, writable by anyone — so Story 33's canWrite gate lets evolution run
    // and the only thing standing between agentB and the private note is canRead.
    const shared = note({
      id: SHARED_ID,
      content: 'agentA shared note',
      owner: 'agentA',
      readers: ['*'],
      links: [PRIVATE_ID, PUBLIC_ID],
    })
    const ctx = makeCtx([priv, pub, shared], shared)

    await addMemory(CONTENT, 'agentB', { storageCtx: ctx })

    const llm = await import('../../src/llm.js')
    expect(llm.llmEvolveNote).toHaveBeenCalledOnce()
    const linkedNotes = vi.mocked(llm.llmEvolveNote).mock.calls[0][1] as Array<{ id: string; content: string }>

    expect(linkedNotes.map((n) => n.id)).toContain(PUBLIC_ID)
    expect(linkedNotes.map((n) => n.id)).not.toContain(PRIVATE_ID)
    // The content is what actually reaches the model — assert on it directly.
    expect(JSON.stringify(linkedNotes)).not.toContain(PRIVATE_CONTENT)
  })

  it('keeps the neighbour when the caller is an authorized reader (no regression)', async () => {
    const readable = note({
      id: PRIVATE_ID,
      content: PRIVATE_CONTENT,
      owner: 'agentA',
      readers: ['agentA', 'agentB'],
    })
    const shared = note({
      id: SHARED_ID,
      content: 'agentA shared note',
      owner: 'agentA',
      readers: ['*'],
      links: [PRIVATE_ID],
    })
    const ctx = makeCtx([readable, shared], shared)

    await addMemory(CONTENT, 'agentB', { storageCtx: ctx })

    const llm = await import('../../src/llm.js')
    const linkedNotes = vi.mocked(llm.llmEvolveNote).mock.calls[0][1] as Array<{ id: string; content: string }>
    expect(linkedNotes.map((n) => n.id)).toContain(PRIVATE_ID)
  })

  it('passes the caller on every neighbourhood read', async () => {
    const pub = note({ id: PUBLIC_ID, content: 'agentA public note', owner: 'agentA', readers: ['*'] })
    const shared = note({
      id: SHARED_ID,
      content: 'agentA shared note',
      owner: 'agentA',
      readers: ['*'],
      links: [PUBLIC_ID],
    })
    const ctx = makeCtx([pub, shared], shared)

    await addMemory(CONTENT, 'agentB', { storageCtx: ctx })

    const neighbourReads = vi.mocked(ctx.getNote).mock.calls.filter((c) => c[0] === PUBLIC_ID)
    expect(neighbourReads.length).toBeGreaterThan(0)
    for (const call of neighbourReads) expect(call[1]).toBe('agentB')
  })
})
