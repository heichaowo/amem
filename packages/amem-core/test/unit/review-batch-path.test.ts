import { describe, it, expect, vi, afterAll } from 'vitest'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'

// generateReviewBatch confines its write to AMEM_REVIEW_DIR. Point that at a
// temp dir before quality.ts is imported (DEFAULT_OUTPUT_DIR is captured at
// module load), so the accept-case writes somewhere disposable and the
// reject-cases have a concrete root to escape from.
const ROOT = vi.hoisted(() => {
  const p = require('path').join(require('os').tmpdir(), 'amem-review-batch-test')
  process.env.AMEM_REVIEW_DIR = p
  return p
})

// scanLowQuality() would otherwise hit Qdrant. It is only reached AFTER the
// path guard, so the reject-cases never touch it — but the accept-case does.
vi.mock('../../src/storage.js', () => ({
  listNotes: vi.fn(async () => []),
  patchNotePayload: vi.fn(),
}))

import { generateReviewBatch } from '../../src/quality.js'

afterAll(() => fs.rmSync(ROOT, { recursive: true, force: true }))

describe('generateReviewBatch outputPath confinement', () => {
  it('rejects an absolute path', async () => {
    await expect(generateReviewBatch('a', '/etc/passwd')).rejects.toThrow(/纯文件名/)
  })

  it('rejects a ../ traversal', async () => {
    await expect(generateReviewBatch('a', '../../../evil.md')).rejects.toThrow(/纯文件名/)
  })

  it('rejects any path carrying a directory component', async () => {
    await expect(generateReviewBatch('a', 'sub/review.md')).rejects.toThrow(/纯文件名/)
  })

  it('rejects "." and ".." which basename would collapse onto the root dir', async () => {
    await expect(generateReviewBatch('a', '.')).rejects.toThrow(/纯文件名/)
    await expect(generateReviewBatch('a', '..')).rejects.toThrow(/纯文件名/)
  })

  it('rejects before any filesystem write happens', async () => {
    const escaped = '/tmp/amem-escape-proof.md'
    fs.rmSync(escaped, { force: true })
    await expect(generateReviewBatch('a', escaped)).rejects.toThrow()
    expect(fs.existsSync(escaped)).toBe(false)
    // and it did not silently redirect the traversal into the root either
    expect(fs.existsSync(path.join(ROOT, 'amem-escape-proof.md'))).toBe(false)
  })

  it('accepts a bare filename and writes it into the review root', async () => {
    const out = await generateReviewBatch('a', 'review.md')
    expect(out).toBe(path.join(ROOT, 'review.md'))
    expect(fs.existsSync(out)).toBe(true)
  })
})
