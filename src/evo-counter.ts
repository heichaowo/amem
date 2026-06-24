/**
 * evo-counter.ts — Evolution throttle counter (Story 13-C)
 *
 * Tracks how many times addMemory has been called and gates evolution
 * behind an EVO_THRESHOLD counter. This reduces LLM calls dramatically
 * in high-frequency write scenarios.
 *
 * Counter persisted to ~/.openclaw/amem_evo_cnt.json.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const COUNTER_FILE = process.env.AMEM_EVO_COUNTER_PATH
  || path.join(os.homedir(), '.openclaw', 'amem_evo_cnt.json')
const EVO_THRESHOLD = 20

interface CounterData {
  count: number
  updatedAt: string
}

export function getEvoCount(): number {
  try {
    const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf-8')) as CounterData
    return data.count || 0
  } catch {
    return 0
  }
}

export function incrementEvoCount(): number {
  const count = getEvoCount() + 1
  fs.writeFileSync(COUNTER_FILE, JSON.stringify({ count, updatedAt: new Date().toISOString() }))
  return count
}

export function shouldRunEvolution(): boolean {
  const count = incrementEvoCount()
  return count % EVO_THRESHOLD === 0
}
