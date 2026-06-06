/**
 * memory.ts — A-MEM core logic: addMemory, searchMemory, listMemories
 * Full TypeScript port of amem_client.py
 */

import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { encode, cosineSimilarity } from './embedding.js'
import {
  addNote,
  getNote,
  updateNote,
  queryByEmbedding,
  listNotes,
  countNotes,
  findByHash,
  updateNoteContent,
  deleteNote,
  getNotesByDatePrefix,
  replaceLinkReferences,
  invalidateNote,
  type MemoryNote,
} from './storage.js'
import { llmConstructNote, llmShouldLink, llmEvolveNote, llmShouldMerge } from './llm.js'
import { shouldRunEvolution } from './evo-counter.js'
import { Jieba } from '@node-rs/jieba'

// ── BM25 helpers ──────────────────────────────────────────────────────────────

// Lazy-initialized Jieba instance (Story 21: Chinese word segmentation)
let _jieba: Jieba | null = null
function getJieba(): Jieba {
  if (!_jieba) _jieba = new Jieba()
  return _jieba
}

/**
 * Tokenize text for BM25 indexing.
 * Story 21: Chinese text is segmented with Jieba (HMM mode) before indexing.
 * Non-Chinese text falls back to whitespace/word-boundary splitting.
 * Mixed text (e.g. "文静TTS参数") is handled correctly — Jieba preserves
 * ASCII tokens as-is while segmenting CJK spans.
 */
function simpleTokenize(text: string): string[] {
  const hasChinese = /[\u4e00-\u9fff]/.test(text)
  if (hasChinese) {
    // Jieba cut with HMM=true for unknown word recognition
    return getJieba()
      .cut(text, true)
      .map((t) => t.toLowerCase().trim())
      .filter((t) => t.length > 0 && /[\w\u4e00-\u9fff]/.test(t))
  }
  return Array.from(text.toLowerCase().matchAll(/[\w]+/g)).map((m) => m[0])
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
function rrfMerge(embIds: string[], bm25Ids: string[], k = 60): [string, number][] {
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
  const { keywords, tags, context, category } = await llmConstructNote(content)
  console.log(`  keywords: ${keywords.join(', ')}`)
  console.log(`  tags: ${tags.join(', ')}`)
  console.log(`  context: ${context}`)
  console.log(`  category: ${category}`)

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
    // 13-A
    retrieval_count: 0,
    last_accessed: new Date().toISOString(),
    // 13-B
    evolution_history: [],
    // 13-E
    category,
    is_active: true,
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

        // Step 3: Memory Evolution (up to 3) — gated by evo_threshold (Story 13-C)
        if (shouldRunEvolution()) {
          console.log(`  [evo] threshold reached, running evolution for ${Math.min(linkedIds.length, 3)} linked notes`)
          for (const lid of linkedIds.slice(0, 3)) {
            const linked = await getNote(lid)
            if (!linked) continue

            // Gather link contents and IDs
            const linkedNotes: Array<{ id: string; content: string }> = []
            for (const llid of linked.links.slice(0, 5)) {
              if (llid === note.id) continue
              const ln = await getNote(llid)
              if (ln) linkedNotes.push({ id: ln.id, content: ln.content })
            }
            linkedNotes.push({ id: note.id, content }) // new note exactly once

            const oldTags = [...linked.tags]
            const oldContext = linked.context

            const {
              tags: newTags,
              context: newContext,
              shouldStrengthen,
              suggestedConnections,
              tagsToUpdate,
            } = await llmEvolveNote(linked.content, linkedNotes)

            let evolved = false

            // Standard update_neighbor action
            if (newTags !== null || newContext !== null) {
              if (newTags !== null) linked.tags = newTags
              if (newContext !== null) linked.context = newContext

              linked.evolution_history = linked.evolution_history || []
              linked.evolution_history.push({
                triggeredBy: note.id,
                triggeredAt: new Date().toISOString(),
                oldContext,
                newContext: newContext ?? oldContext,
                oldTags,
                newTags: newTags ?? oldTags,
                action: 'update_neighbor',
              })
              evolved = true
            }

            let noteChanged = false
            let noteTagsChanged = false

            // Strengthen action
            if (shouldStrengthen && suggestedConnections.length > 0) {
              // 1. 双向链接绑定
              for (const targetId of suggestedConnections) {
                if (!note.links.includes(targetId)) {
                  note.links.push(targetId)
                  noteChanged = true
                }
                const target = await getNote(targetId)
                if (target && !target.links.includes(note.id)) {
                  target.links.push(note.id)
                  await updateNote(target)
                }
              }
              // 2. 更新新写入 memory 的 note.tags
              if (tagsToUpdate.length > 0) {
                note.tags = tagsToUpdate
                noteChanged = true
                noteTagsChanged = true
              }

              // 3. 记录 strengthen 操作到被加强的邻居 (linked) 的 evolution_history 中
              linked.evolution_history = linked.evolution_history || []
              linked.evolution_history.push({
                triggeredBy: note.id,
                triggeredAt: new Date().toISOString(),
                oldContext: linked.context,
                newContext: linked.context,
                oldTags: [...linked.tags],
                newTags: [...linked.tags],
                action: 'strengthen',
                suggestedConnections,
                tagsUpdated: tagsToUpdate,
              })
              evolved = true
            }

            if (noteChanged) {
              if (noteTagsChanged) {
                note.embedding = await encode(buildEmbedText(note))
              }
              await updateNote(note)
            }

            if (evolved) {
              // Re-compute embedding after evolution
              if (newTags !== null || newContext !== null) {
                linked.embedding = await encode(buildEmbedText(linked))
              }
              await updateNote(linked)
              console.log(`  evolved/strengthened note ${lid.slice(0, 8)}...`)
            }
          }
        } else {
          console.log(`  [evo] threshold not reached, skipping evolution this round`)
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

export async function searchMemory(
  query: string,
  topK = 5,
  agentId = 'main',
  opts?: { useBfs?: boolean }
): Promise<SearchResult[]> {
  const useBfs = opts?.useBfs !== false // default true
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

  // RRF fusion with retrieval_count heat boost (Story 13-A)
  const merged = rrfMerge(
    embResults.map((r) => r.note.id),
    bm25Ranked.map((r) => r[0])
  )

  // Apply heat boost: retrieval_count makes frequently-retrieved notes rank higher
  const noteMap = new Map(allNotes.map((n) => [n.id, n]))
  const boostedMerged: [string, number][] = merged.map(([id, rrfScore]) => {
    const note = noteMap.get(id)
    const recencyBoost = note ? 1 + 0.05 * Math.log(1 + (note.retrieval_count || 0)) : 1
    return [id, rrfScore * recencyBoost]
  })
  boostedMerged.sort((a, b) => b[1] - a[1])

  const topIds = boostedMerged.slice(0, topK).map(([id]) => id)

  // Story 18: 2-hop BFS link expansion (can be disabled via opts.useBfs=false for ablation)
  // Walk the link graph up to 2 hops from each top result to surface
  // contextually related notes that scored too low for direct retrieval.
  const BFS_MAX_HOPS = 2
  const BFS_MAX_EXPAND = 8 // max extra notes to add via BFS (cap to avoid bloat)
  const visitedIds = new Set<string>(topIds)
  const bfsQueue: Array<{ id: string; hop: number }> = useBfs ? topIds.map((id) => ({ id, hop: 0 })) : []
  const bfsExtra: string[] = [] // IDs discovered via BFS, in discovery order

  while (bfsQueue.length > 0 && bfsExtra.length < BFS_MAX_EXPAND) {
    const item = bfsQueue.shift()!
    if (item.hop >= BFS_MAX_HOPS) continue
    const note = noteMap.get(item.id)
    if (!note) continue
    for (const linkedId of note.links) {
      if (visitedIds.has(linkedId)) continue
      visitedIds.add(linkedId)
      // Only include active notes (is_active !== false)
      const linked = noteMap.get(linkedId)
      if (!linked || linked.is_active === false) continue
      bfsExtra.push(linkedId)
      bfsQueue.push({ id: linkedId, hop: item.hop + 1 })
      if (bfsExtra.length >= BFS_MAX_EXPAND) break
    }
  }

  // Build result map
  const embSimMap = new Map(embResults.map((r) => [r.note.id, r.score]))
  const rrfMap = new Map(boostedMerged.map(([id, score]) => [id, score]))

  const results: SearchResult[] = []
  for (const id of [...topIds, ...bfsExtra]) {
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

// ── mergeSimilarNotes ──────────────────────────────────────────────────────────

/** Sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Merge semantically similar notes written today.
 * Called asynchronously from agent_end hook; failures are silent.
 * Returns the number of notes merged (deleted).
 */
export async function mergeSimilarNotes(agentId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"
  const notes = await getNotesByDatePrefix(today, agentId)

  // Not enough notes to bother
  if (notes.length < 5) return 0

  // Build list of (i, j) candidate pairs with sim >= 0.80
  // Cap at top-10 pairs to limit LLM calls
  interface SimPair {
    i: number
    j: number
    sim: number
  }

  const pairs: SimPair[] = []
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      if (!notes[i].embedding.length || !notes[j].embedding.length) continue
      const sim = cosineSimilarity(notes[i].embedding, notes[j].embedding)
      if (sim >= 0.8) {
        pairs.push({ i, j, sim })
      }
    }
  }

  if (pairs.length === 0) return 0

  // Sort by similarity descending, take top 10
  pairs.sort((a, b) => b.sim - a.sim)
  const topPairs = pairs.slice(0, 10)

  // Track deleted IDs to skip stale pairs
  const deletedIds = new Set<string>()
  let mergedCount = 0

  for (const { i, j } of topPairs) {
    const noteA = notes[i]
    const noteB = notes[j]

    // Skip if either has already been deleted
    if (deletedIds.has(noteA.id) || deletedIds.has(noteB.id)) continue

    const result = await llmShouldMerge(noteA.content, noteB.content)

    if (result.shouldMerge && result.merged) {
      // Keep the longer note (more complete), update its content, delete the other
      const [keepNote, dropNote] = noteA.content.length >= noteB.content.length ? [noteA, noteB] : [noteB, noteA]

      const newEmbedding = await encode(result.merged)
      const newHash = createHash('md5').update(result.merged).digest('hex')
      await updateNoteContent(keepNote.id, result.merged, newEmbedding, newHash)
      await deleteNote(dropNote.id)
      deletedIds.add(dropNote.id)
      mergedCount++
    }

    // Rate-limit: 200ms between LLM calls
    await sleep(200)
  }

  return mergedCount
}

/**
 * Consolidate semantically similar memories.
 * Performs deep deduplication by category and similarity score.
 */
export async function consolidateMemories(agentId: string, logger?: any): Promise<number> {
  const log = {
    info: (msg: string) => (logger ? logger.info(msg) : console.log(msg)),
    warn: (msg: string) => (logger ? logger.warn(msg) : console.warn(msg)),
    error: (msg: string) => (logger ? logger.error(msg) : console.error(msg)),
  }

  log.info(`[Consolidation] Starting consolidation for agentId: ${agentId}`)

  // 1. 加载记忆：获取所有活动（is_active: true）记忆条目
  const allNotes = await listNotes(agentId)
  log.info(`[Consolidation] Loaded ${allNotes.length} active notes.`)

  // 2. 分类分组：根据 category 字段将记忆分组
  const groups = new Map<string, MemoryNote[]>()
  for (const note of allNotes) {
    const category = note.category || 'General'
    if (!groups.has(category)) {
      groups.set(category, [])
    }
    groups.get(category)!.push(note)
  }

  // 3. 两两比对：在每个分类分组内计算余弦相似度
  interface CandidatePair {
    noteA: MemoryNote
    noteB: MemoryNote
    similarity: number
  }
  const candidates: CandidatePair[] = []

  for (const [category, groupNotes] of groups.entries()) {
    log.info(`[Consolidation] Category "${category}" has ${groupNotes.length} notes.`)
    for (let i = 0; i < groupNotes.length; i++) {
      for (let j = i + 1; j < groupNotes.length; j++) {
        const noteA = groupNotes[i]
        const noteB = groupNotes[j]
        if (!noteA.embedding.length || !noteB.embedding.length) continue
        const sim = cosineSimilarity(noteA.embedding, noteB.embedding)
        if (sim >= 0.75) {
          candidates.push({ noteA, noteB, similarity: sim })
        }
      }
    }
  }

  // 4. 筛选候选对：按相似度从高到低排序，限制最多 15 对
  candidates.sort((a, b) => b.similarity - a.similarity)
  const topPairs = candidates.slice(0, 15)
  log.info(
    `[Consolidation] Found ${candidates.length} candidate pairs with similarity >= 0.75. Processing top ${topPairs.length}.`
  )

  const processedIds = new Set<string>()
  let mergedCount = 0

  // Helper: append log to log file
  function logMergeToFile(keepId: string, dropId: string, mergedContent: string) {
    const logDir = path.join(os.homedir(), '.openclaw', 'logs')
    const logFile = path.join(logDir, 'amem-consolidate.log')
    const timestamp = new Date().toISOString()
    const logMsg = `[${timestamp}] Consolidated: KeepNote ${keepId} and DropNote ${dropId}. Merged length: ${mergedContent.length} chars.\n`

    try {
      fs.mkdirSync(logDir, { recursive: true })
      fs.appendFileSync(logFile, logMsg, 'utf8')
    } catch (err) {
      log.error(`[Consolidation] Failed to write log: ${(err as Error).message}`)
    }
  }

  // 5. LLM 融合决策与信息继承
  for (const { noteA, noteB, similarity } of topPairs) {
    if (processedIds.has(noteA.id) || processedIds.has(noteB.id)) {
      log.info(
        `[Consolidation] Skipping pair (${noteA.id.slice(0, 8)}, ${noteB.id.slice(0, 8)}) as one or both already merged.`
      )
      continue
    }

    log.info(
      `[Consolidation] Evaluating pair (${noteA.id.slice(0, 8)}, ${noteB.id.slice(0, 8)}) with sim ${similarity.toFixed(4)}...`
    )
    const mergeDecision = await llmShouldMerge(noteA.content, noteB.content)

    if (mergeDecision.shouldMerge && mergeDecision.merged) {
      log.info(`  -> LLM decision: MERGE!`)

      // 比较两条记忆的长度，将较长的保留作为主节点 (KeepNote)
      const [keepNote, dropNote] = noteA.content.length >= noteB.content.length ? [noteA, noteB] : [noteB, noteA]

      log.info(
        `  -> KeepNote: ${keepNote.id.slice(0, 8)} (len: ${keepNote.content.length}), DropNote: ${dropNote.id.slice(0, 8)} (len: ${dropNote.content.length})`
      )

      const oldContext = keepNote.context
      const oldTags = [...keepNote.tags]

      // 内容更新
      keepNote.content = mergeDecision.merged

      // 元数据继承：
      // - 合并 tags 与 keywords（合并后去重）
      keepNote.tags = Array.from(new Set([...keepNote.tags, ...dropNote.tags]))
      keepNote.keywords = Array.from(new Set([...keepNote.keywords, ...dropNote.keywords]))

      // - 合并 links 链接数组（去重且排除自身 and DropNote）
      keepNote.links = Array.from(new Set([...keepNote.links, ...dropNote.links])).filter(
        (id) => id !== keepNote.id && id !== dropNote.id
      )

      // - retrieval_count 累加
      keepNote.retrieval_count = (keepNote.retrieval_count || 0) + (dropNote.retrieval_count || 0)

      // - last_accessed 取最新的时间戳
      const keepAccessTime = new Date(keepNote.last_accessed || keepNote.timestamp).getTime()
      const dropAccessTime = new Date(dropNote.last_accessed || dropNote.timestamp).getTime()
      keepNote.last_accessed =
        keepAccessTime >= dropAccessTime
          ? keepNote.last_accessed || keepNote.timestamp
          : dropNote.last_accessed || dropNote.timestamp

      // 重算 embedding 与 MD5 hash
      const embedText = buildEmbedText(keepNote)
      keepNote.embedding = await encode(embedText)
      keepNote.hash = createHash('md5').update(keepNote.content).digest('hex')

      // 将 DropNote 的合并事件记录在 KeepNote 的 evolution_history 中
      keepNote.evolution_history = keepNote.evolution_history || []
      keepNote.evolution_history.push({
        triggeredBy: dropNote.id,
        triggeredAt: new Date().toISOString(),
        oldContext,
        newContext: keepNote.context,
        oldTags,
        newTags: keepNote.tags,
        action: 'consolidate',
      })

      // 更新 KeepNote
      await updateNote(keepNote)

      // 软删除 DropNote
      await invalidateNote(dropNote.id)

      // 级联更新 links
      await replaceLinkReferences(dropNote.id, keepNote.id, agentId)

      // 写入日志
      logMergeToFile(keepNote.id, dropNote.id, keepNote.content)

      processedIds.add(keepNote.id)
      processedIds.add(dropNote.id)
      mergedCount++
    } else {
      log.info(`  -> LLM decision: DO NOT MERGE.`)
    }

    // Rate limit sleep
    await sleep(200)
  }

  log.info(`[Consolidation] Completed consolidation run. Merged ${mergedCount} pairs.`)
  return mergedCount
}
