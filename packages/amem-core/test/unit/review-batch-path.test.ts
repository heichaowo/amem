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
  it('rejects an absolute path outside the review directory', async () => {
    await expect(generateReviewBatch('a', '/etc/passwd')).rejects.toThrow(/审核目录/)
  })

  it('rejects a ../ traversal that climbs out of the root', async () => {
    await expect(generateReviewBatch('a', path.join(ROOT, '..', '..', 'evil.md'))).rejects.toThrow(
      /审核目录/
    )
  })

  it('rejects a prefix-collision sibling (root-evil vs root)', async () => {
    // `${ROOT}-evil/x` startsWith `${ROOT}` textually but is NOT inside ${ROOT};
    // the path.sep boundary check is what stops it.
    await expect(generateReviewBatch('a', `${ROOT}-evil/x.md`)).rejects.toThrow(/审核目录/)
  })

  it('rejects before any filesystem write happens', async () => {
    const target = '/tmp/amem-escape-proof.md'
    fs.rmSync(target, { force: true })
    await expect(generateReviewBatch('a', target)).rejects.toThrow()
    expect(fs.existsSync(target)).toBe(false)
  })

  it('accepts a path inside the review directory and writes it', async () => {
    const target = path.join(ROOT, 'sub', 'review.md')
    const out = await generateReviewBatch('a', target)
    expect(out).toBe(target)
    expect(fs.existsSync(target)).toBe(true)
  })
})
