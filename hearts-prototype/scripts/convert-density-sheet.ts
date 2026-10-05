import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const result = spawnSync('python3', [path.join(root, 'scripts/build-density-import.py'), ...process.argv.slice(2)], { stdio: 'inherit' })
process.exit(result.status ?? 1)
