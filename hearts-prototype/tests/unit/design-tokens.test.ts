import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')
const debtPath = path.join(root, 'tests/unit/design-token-debt.json')

const roots = [
  path.join(root, 'src/app/(frontend)'),
  path.join(root, 'src/screens/desk'),
  path.join(root, 'src/components/desk'),
]

/** Hard-coded colours and font sizes. Spacing and radii are not counted yet. */
export function tokenViolations(css: string) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const hits: string[] = []
  const patterns = [
    /#[0-9a-fA-F]{3,8}\b/g,
    /\brgba?\s*\(/gi,
    /\bhsla?\s*\(/gi,
    /font-size\s*:[^;{]*?\d+(?:\.\d+)?(?:px|rem|em)/gi,
  ]
  for (const pattern of patterns) {
    for (const match of stripped.matchAll(pattern)) hits.push(match[0])
  }
  return hits
}

function cssFiles(dir: string, out: string[] = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) cssFiles(full, out)
    else if (name.endsWith('.css')) out.push(full)
  }
  return out
}

test('learner and admin CSS keeps colours and font sizes in tokens.css', () => {
  const debt = JSON.parse(readFileSync(debtPath, 'utf8')) as Record<string, number>
  const files = roots.flatMap((dir) => cssFiles(dir))
  const seen = new Set<string>()

  for (const file of files) {
    const rel = path.relative(root, file).split(path.sep).join('/')
    seen.add(rel)
    if (rel.endsWith('/tokens.css')) continue
    const hits = tokenViolations(readFileSync(file, 'utf8'))
    if (rel.endsWith('/shell-modern.css')) {
      assert.equal(hits.length, 0, `shell-modern.css must use tokens only, found ${hits.slice(0, 8).join(', ')}`)
      continue
    }
    const cap = debt[rel]
    if (cap === undefined) {
      assert.equal(hits.length, 0, `${rel} is new CSS with ${hits.length} hard-coded colours or font sizes. Use tokens.css, or record a ceiling only for an existing file you are migrating.`)
      continue
    }
    assert.ok(
      hits.length <= cap,
      `${rel} has ${hits.length} hard-coded colours or font sizes. The ceiling is ${cap}. Move the new values into tokens.css.`,
    )
  }

  for (const rel of Object.keys(debt)) {
    assert.ok(seen.has(rel), `${rel} is in the token ceiling but the file is gone. Remove it from design-token-debt.json.`)
  }
})
