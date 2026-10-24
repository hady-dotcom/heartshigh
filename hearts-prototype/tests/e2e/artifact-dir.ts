import { mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Screenshot/film folder. HEARTS_ARTIFACTS or SCREENSHOT_DIR, else a temp dir — never /opt/cursor/artifacts on load. */
export function artifactDir(...parts: string[]) {
  const root = process.env.HEARTS_ARTIFACTS || process.env.SCREENSHOT_DIR || path.join(os.tmpdir(), 'hearts-artifacts')
  const dir = path.join(root, ...parts)
  mkdirSync(dir, { recursive: true })
  return dir
}
