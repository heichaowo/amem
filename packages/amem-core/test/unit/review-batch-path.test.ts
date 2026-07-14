import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as path from 'path'

// generateReviewBatch writes under AMEM_REVIEW_DIR. Point that at a temp dir
// before quality.ts is imported (DEFAULT_OUTPUT_DIR is captured at module load).
const ROOT = vi.hoisted(() => {
  const p = require('path').join(require('os').tmpdir(), 'amem-review-batch-test')
  process.env.AMEM_REVIEW_DIR = p
  return p
})

// Mock the fs sinks so the test neither touches the disk nor constructs a real
// fs path from an env-derived root — reading mock.calls is a sharper assertion
// than probing the filesystem. scanLowQuality is mocked away too; it is only
// reached after the filename guard, so the reject-cases never hit it.
vi.mock('fs', async (importOriginal) => {
  const real = await importOriginal<typeof import('fs')>()
  return { ...real, writeFileSync: vi.fn(), mkdirSync: vi.fn() }
})
vi.mock('../../src/storage.js', () => ({
  listNotes: vi.fn(async () => []),
  patchNotePayload: vi.fn(),
}))

import * as fs from 'fs'
import { generateReviewBatch } from '../../src/quality.js'

beforeEach(() => vi.clearAllMocks())

describe('generateReviewBatch outputPath confinement', () => {
  const reject = (p: string) => expect(generateReviewBatch('a', p)).rejects.toThrow(/纯文件名/)

  it('rejects an absolute path', () => reject('/etc/passwd'))
  it('rejects a ../ traversal', () => reject('../../../evil.md'))
  it('rejects a path carrying a directory component', () => reject('sub/review.md'))
  it('rejects "." and ".." which would collapse onto the root directory', async () => {
    await reject('.')
    await reject('..')
  })

  it('writes nothing when it rejects', async () => {
    await reject('/etc/passwd')
    expect(fs.writeFileSync).not.toHaveBeenCalled()
  })

  it('accepts a bare filename and writes it into the review root', async () => {
    const out = await generateReviewBatch('a', 'review.md')
    expect(out).toBe(path.join(ROOT, 'review.md'))
    expect(fs.writeFileSync).toHaveBeenCalledOnce()
    expect(vi.mocked(fs.writeFileSync).mock.calls[0][0]).toBe(path.join(ROOT, 'review.md'))
  })
})
