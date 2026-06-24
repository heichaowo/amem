/**
 * quality.ts — Memory quality scanning and review batch generation (Story 31)
 */

import * as fs from 'fs'
import * as path from 'path'
import { listNotes, patchNotePayload, type MemoryNote } from './storage.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LowQualityItem {
  note: MemoryNote
  reasons: LowQualityReason[]
}

export type LowQualityReason = 'too_short' | 'expired_ephemeral' | 'pending_conflict'

// ── scanLowQuality ────────────────────────────────────────────────────────────

export async function scanLowQuality(agentId: string): Promise<LowQualityItem[]> {
  const notes = await listNotes(agentId)
  const now = Date.now()
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
  const results: LowQualityItem[] = []

  for (const note of notes) {
    const reasons: LowQualityReason[] = []

    if (note.content.trim().length < 10) {
      reasons.push('too_short')
    }

    if (note.ephemeral === true) {
      const createdAt = new Date(note.timestamp).getTime()
      if (now - createdAt > SEVEN_DAYS_MS) {
        reasons.push('expired_ephemeral')
      }
    }

    if (note.conflict === true) {
      reasons.push('pending_conflict')
    }

    if (reasons.length > 0) {
      if (!note.low_quality) {
        await patchNotePayload(note.id, { low_quality: true })
      }
      results.push({ note, reasons })
    }
  }

  return results
}

// ── generateReviewBatch ───────────────────────────────────────────────────────

const DEFAULT_OUTPUT_DIR = process.env.AMEM_REVIEW_DIR || process.cwd()

function nextBatchNumber(dir: string): number {
  let max = 0
  try {
    const files = fs.readdirSync(dir)
    for (const f of files) {
      const match = f.match(/^amem-review-batch(\d+)\.md$/)
      if (match) {
        const n = parseInt(match[1], 10)
        if (n > max) max = n
      }
    }
  } catch {
    // dir doesn't exist yet
  }
  return max + 1
}

function reasonLabel(r: LowQualityReason): string {
  switch (r) {
    case 'too_short':
      return '内容过短（<10字）'
    case 'expired_ephemeral':
      return '临时记忆已过期（>7天）'
    case 'pending_conflict':
      return '存在冲突标记'
  }
}

function severityBadge(reasons: LowQualityReason[]): string {
  if (reasons.includes('too_short')) return '🔴 LOW'
  if (reasons.includes('expired_ephemeral')) return '🟡 EXPIRED'
  return '🟠 CONFLICT'
}

export async function generateReviewBatch(agentId: string, outputPath?: string): Promise<string> {
  const items = await scanLowQuality(agentId)
  const dir = outputPath ? path.dirname(outputPath) : DEFAULT_OUTPUT_DIR
  const batchN = outputPath ? 0 : nextBatchNumber(dir)
  const filePath = outputPath || path.join(dir, `amem-review-batch${batchN}.md`)

  const now = new Date().toISOString().slice(0, 10)
  const lines: string[] = []

  lines.push(`# A-MEM 质量审核 — Batch ${batchN || 'custom'}`)
  lines.push('')
  lines.push(`> 生成时间：${now} | 共 ${items.length} 条低质量条目`)
  lines.push('> 选好后可使用 memory_quality_apply 批量处理')
  lines.push('')

  if (items.length === 0) {
    lines.push('✅ 没有发现低质量条目。')
  }

  for (let i = 0; i < items.length; i++) {
    const { note, reasons } = items[i]
    const badge = severityBadge(reasons)
    const reasonStr = reasons.map(reasonLabel).join('、')

    lines.push(`### [${i + 1}] ${badge} | ${note.category || 'General'}`)
    lines.push(`\`${note.id}\``)
    lines.push('')
    lines.push(`**问题：** ${reasonStr}`)
    lines.push('')
    lines.push('**内容：**')
    lines.push('```')
    lines.push(note.content)
    lines.push('```')
    lines.push('')
    lines.push(`**关键词：** ${note.keywords.join(', ')}`)
    lines.push(`**标签：** ${note.tags.join(', ')}`)
    lines.push('')
    lines.push('- [ ] ✅ 保留')
    lines.push('- [ ] 🔧 改写')
    lines.push('- [ ] 🗑️ 删除')
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8')

  return filePath
}
