/**
 * config.ts — runtime configuration for amem-core.
 *
 * `dataDir` holds the evolution-throttle counter and consolidation logs.
 * Defaults to ~/.amem so the engine stays framework-agnostic; the OpenClaw
 * plugin calls configure({ dataDir: '<home>/.openclaw' }) to preserve its
 * existing on-disk location. Override via AMEM_DATA_DIR env var or configure().
 */
import * as os from 'os'
import * as path from 'path'

let _dataDir = process.env.AMEM_DATA_DIR || path.join(os.homedir(), '.amem')

export function configure(opts: { dataDir?: string }): void {
  if (opts.dataDir) _dataDir = opts.dataDir
}

export function getDataDir(): string {
  return _dataDir
}
