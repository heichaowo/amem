/**
 * memory.ts — A-MEM core logic: addMemory, searchMemory, listMemories
 * Full TypeScript port of amem_client.py
 */

import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'crypto'
import { encode, cosineSimilarity } from './embedding.js'
import { addNote, getNote, updateNote, queryByEmbedding, listNotes, countNotes, findByHash, updateNoteContent, deleteNote, getNotesByDatePrefix, type MemoryNote } from './storage.js'
import { llmConstructNote, llmShouldLink, llmEvolveNote, llmShouldMerge } from './llm.js'

// ── BM25 helpers ──────────────────────────────────────────────────────────────
function simpleTokenize(text: string): string[] {
  return Array.from(text.toLowerCase().matchAll(/[\w\u4e00-\u9fff]+/g)).map((m) => m[0])
}

interface BM25State {
  ids: string[]
  corpus: string[][]
  idf: Map<string, number>
  avgdl: number
}

function buildBM25(notes: MemoryNote[]): BM25State {
  const ids = notes.map((n) => n.id)
  const corpus = notes.map((n) => {
    const text = [n.content, ...n.keywords, ...n.tags].join(' ')
    return simpleTokenize(text)
  })

  // IDF
  const df = new Map<string, number>()
  for (const tokens of corpus) {
    for (const t of new Set(tokens)) df.set(t, (df.get(t) ?? 0) + 1)
  }
  const N = corpus.length
  const idf = new Map<string, number>()
  df.forEach((freq, term) => {
    idf.set(term, Math.log((N - freq + 0.5) / (freq + 0.5) + 1))
  })

  const avgdl = corpus.reduce((s, t) => s + t.length, 0) / Math.max(N, 1)
  return { ids, corpus, idf, avgdl }
}

function bm25Score(state: BM25State, queryTokens: string[], k1 = 1.5, b = 0.75): [string, number][] {
  const scores: [string, number][] = state.ids.map((id, i) => {
    const doc = state.corpus[i]
    const dl = doc.length
    const tf = new Map<string, number>()
    for (const t of doc) tf.set(t, (tf.get(t) ?? 0) + 1)

    let score = 0
    for (const t of queryTokens) {
      const f = tf.get(t) ?? 0
      if (f === 0) continue
      const idfVal = state.idf.get(t) ?? 0
      score += idfVal * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (dl / state.avgdl))))
    }
    return [id, score]
  })
  return scores.sort((a, b) => b[1] - a[1])
}

// ── RRF merge ─────────────────────────────────────────────────────────────────
function rrfMerge(
  embIds: string[],
  bm25Ids: string[],
  k = 60,
): [string, number][] {
  const scores = new Map<string, number>()
  embIds.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1)))
  bm25Ids.forEach((id, rank) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1)))
  return Array.from(scores.entries()).sort((a, b) => b[1] - a[1])
}

// ── Build embedding text (same as Python) ─────────────────────────────────────
function buildEmbedText(note: Pick<MemoryNote, 'content' | 'keywords' | 'tags' | 'context'>): string {
  let text = note.content
  if (note.keywords.length) text += ' ' + note.keywords.join(' ')
  if (note.tags.length) text += ' ' + note.tags.join(' ')
  if (note.context) text += ' ' + note.context
  return text
}

// ── addMemory ─────────────────────────────────────────────────────────────────
export async function addMemory(content: string, agentId = 'main'): Promise<string> {
  // ── Layer 1: Exact hash dedup (before LLM & embedding, cheapest check) ──────
  const hash = createHash('md5').update(content).digest('hex')
  const existingByHash = await findByHash(hash, agentId)
  if (existingByHash) {
    console.log(`[add] dedup: exact hash match, skipping (id=${existingByHash.id.slice(0, 8)})`)
    return existingByHash.id
  }

  console.log('[add] Constructing note...')

  // Step 1: Note Construction
  const { keywords, tags, context } = await llmConstructNote(content)
  console.log(`  keywords: ${keywords.join(', ')}`)
  console.log(`  tags: ${tags.join(', ')}`)
  console.log(`  context: ${context}`)

  const fieldsText = buildEmbedText({ content, keywords, tags, context })
  const embedding = await encode(fieldsText)

  // ── Layer 2: High-similarity vector dedup (UPDATE instead of INSERT) ─────────
  const topMatch = await queryByEmbedding(embedding, 1, agentId, 0.0)
  if (topMatch.length > 0 && topMatch[0].score >= 0.88) {
    console.log(`[add] dedup: high-sim match (sim=${topMatch[0].score.toFixed(3)}), updating existing`)
    await updateNoteContent(topMatch[0].note.id, content, embedding, hash)
    return topMatch[0].note.id
  }

  const note: MemoryNote = {
    id: uuidv4(),
    content,
    timestamp: new Date().toISOString(),
    keywords,
    tags,
    context,
    embedding,
    links: [],
    agent_id: agentId,
    hash,
  }

  // Save first
  await addNote(note)
  console.log(`  saved note ${note.id}`)

  // Step 2: Link Generation
  try {
    const total = await countNotes(agentId)
    if (total > 1) {
      const candidates = await queryByEmbedding(embedding, 6, agentId, 0.0)

      const linkedIds: string[] = []
      const linkedContents: string[] = []

      for (const { note: cand, score } of candidates) {
        if (cand.id === note.id) continue
        if (score < 0.3) continue

        console.log(`  candidate ${cand.id.slice(0, 8)}... sim=${score.toFixed(3)}, asking LLM...`)
        const shouldLink = await llmShouldLink(content, cand.content)
        if (shouldLink) {
          linkedIds.push(cand.id)
          linkedContents.push(cand.content)
          console.log(`    → linked!`)
        }
      }

      if (linkedIds.length > 0) {
        note.links = linkedIds
        await updateNote(note)

        // Bidirectional links
        for (const lid of linkedIds) {
          const linked = await getNote(lid)
          if (linked && !linked.links.includes(note.id)) {
            linked.links.push(note.id)
            await updateNote(linked)
          }
        }

        // Step 3: Memory Evolution (up to 3)
        for (const lid of linkedIds.slice(0, 3)) {
          const linked = await getNote(lid)
          if (!linked) continue

          // Gather link contents (skip new note to avoid duplication)
          const linkContents: string[] = []
          for (const llid of linked.links.slice(0, 5)) {
            if (llid === note.id) continue
            const ln = await getNote(llid)
            if (ln) linkContents.push(ln.content)
          }
          linkContents.push(content) // new note exactly once

          const { tags: newTags, context: newContext } = await llmEvolveNote(linked.content, linkContents)
          if (newTags !== null) linked.tags = newTags
          if (newContext !== null) linked.context = newContext

          if (newTags !== null || newContext !== null) {
            // Re-compute embedding after evolution
            linked.embedding = await encode(buildEmbedText(linked))
            await updateNote(linked)
            console.log(`  evolved note ${lid.slice(0, 8)}... (embedding updated)`)
          }
        }
      }
    }
  } catch (e) {
    console.error(`[warn] Link/Evolution phase failed: ${(e as Error).message}`)
  }

  console.log(`[done] Note added: ${note.id}`)
  return note.id
}

// ── searchMemory ──────────────────────────────────────────────────────────────
export interface SearchResult {
  id: string
  content: string
  context: string
  tags: string[]
  keywords: string[]
  links: string[]
  timestamp: string
  similarity: number
  rrf: number
}

export async function searchMemory(query: string, topK = 5, agentId = 'main'): Promise<SearchResult[]> {
  const total = await countNotes(agentId)
  if (total === 0) return []

  // Embedding retrieval
  const queryEmbedding = await encode(query)
  const n = Math.min(Math.max(topK * 4, 20), total)
  const embResults = await queryByEmbedding(queryEmbedding, n, agentId, 0.0)

  // BM25 retrieval
  const allNotes = await listNotes(agentId)
  const bm25State = buildBM25(allNotes)
  const queryTokens = simpleTokenize(query)
  const bm25Ranked = bm25Score(bm25State, queryTokens).slice(0, n)

  // RRF fusion
  const merged = rrfMerge(
    embResults.map((r) => r.note.id),
    bm25Ranked.map((r) => r[0]),
  )
  const topIds = merged.slice(0, topK).map(([id]) => id)

  // Build result map
  const embSimMap = new Map(embResults.map((r) => [r.note.id, r.score]))
  const noteMap = new Map(allNotes.map((n) => [n.id, n]))
  const rrfMap = new Map(merged.map(([id, score]) => [id, score]))

  const results: SearchResult[] = []
  for (const id of topIds) {
    const note = noteMap.get(id)
    if (!note) continue
    results.push({
      id: note.id,
      content: note.content,
      context: note.context,
      tags: note.tags,
      keywords: note.keywords,
      links: note.links,
      timestamp: note.timestamp,
      similarity: embSimMap.get(id) ?? 0,
      rrf: rrfMap.get(id) ?? 0,
    })
  }

  return results
}

// ── listMemories ──────────────────────────────────────────────────────────────
export async function listMemories(agentId = 'main'): Promise<{ count: number }> {
  const count = await countNotes(agentId)
  return { count }
}
