import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { TEST_IDS, deskPageCopyKeys, deskTestIdKeys, pageHelp } from '../../src/lib/desk-help'
import { FEATURES } from '../../src/lib/features'
import { learnerHelpKeys } from '../../src/lib/page-help'
import { seeHowFor, seeHowManifest } from '../../src/lib/see-how'
import { EXTRA_DESK_HELP_TOPICS, SEE_HOW_PAGES, SEE_HOW_SKIPPED, seeHowKeyOwners } from '../../src/lib/see-how-pages'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function covered(key: string) {
  return Boolean(seeHowManifest.keys[key] || seeHowManifest.skipped[key])
}

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name)
    if (name.isDirectory()) {
      if (name.name === 'node_modules' || name.name.startsWith('.')) continue
      walk(full, out)
    } else if (name.name.endsWith('.tsx')) out.push(full)
  }
  return out
}

function literals(source: string, pattern: RegExp) {
  return [...source.matchAll(pattern)].map((match) => match[1])
}

test('help keys are filmed once, or listed as skipped', () => {
  const owners = seeHowKeyOwners()
  assert.ok(owners.size > 0)

  const missing: string[] = []
  const expectKey = (key: string) => {
    if (!covered(key)) missing.push(key)
  }

  for (const key of learnerHelpKeys()) expectKey(key)
  for (const key of deskTestIdKeys()) expectKey(key)
  for (const key of EXTRA_DESK_HELP_TOPICS) expectKey(key)
  for (const feature of FEATURES) expectKey(`feature-${feature.key}`)
  for (const key of owners.keys()) expectKey(key)

  const sources = walk(path.join(root, 'src')).map((file) => readFileSync(file, 'utf8'))
  const joined = sources.join('\n')
  for (const key of literals(joined, /<(?:HelpTip|TopicHelp)\b[^>]*\btopic="([^"]+)"/g)) expectKey(key)
  for (const key of literals(joined, /<PageHelp\b[^>]*\bpage="([^"]+)"/g)) expectKey(key)
  for (const key of literals(joined, /\bseeHowKey="([^"]+)"/g)) expectKey(key)

  for (const source of sources) {
    for (const match of source.matchAll(/<(?:AdminFrame|MasterFrame|DeskFrame|Frame|AppFrame)\b([^>]*?)>/gs)) {
      const blob = match[1]
      const testId = blob.match(/\btestId="([^"]+)"/)?.[1]
      const active = blob.match(/\bactive="([^"]+)"/)?.[1]
      if (match[0].startsWith('<AppFrame') && testId) expectKey(testId)
      if (!testId && !active) continue
      const topic = testId || active || ''
      if (pageHelp(active, testId)) expectKey(topic)
    }
  }

  for (const copyKey of deskPageCopyKeys()) {
    const viaTestId = Object.entries(TEST_IDS).some(([testId, pageKey]) => pageKey === copyKey && covered(testId))
    if (!covered(copyKey) && !viaTestId) missing.push(`page-copy:${copyKey}`)
  }

  assert.deepEqual([...new Set(missing)], [])
})

test('manifest keys, skips and video files agree', () => {
  const keyOverlap = Object.keys(seeHowManifest.keys).filter((key) => seeHowManifest.skipped[key])
  assert.deepEqual(keyOverlap, [])

  for (const [key, reason] of Object.entries(SEE_HOW_SKIPPED)) {
    assert.equal(seeHowManifest.skipped[key], reason)
    assert.equal(seeHowFor(key), null)
  }
  assert.equal(seeHowFor('not-a-help-key'), null)

  for (const [key, pageId] of Object.entries(seeHowManifest.keys)) {
    assert.ok(seeHowManifest.pages[pageId], `${key} points at missing page ${pageId}`)
  }

  for (const spec of SEE_HOW_PAGES) {
    const filmed = seeHowManifest.pages[spec.id]
    if (!filmed) {
      for (const key of spec.keys) assert.ok(seeHowManifest.skipped[key], `${spec.id} is neither filmed nor skipped (${key})`)
      continue
    }
    assert.ok(filmed.captions.length > 0, spec.id)
    assert.ok(filmed.captions.every((row) => row.text.trim().length > 0 && row.end > row.start), spec.id)
    assert.ok((filmed.seconds || 0) > 0 && (filmed.seconds || 0) <= 32, `${spec.id} is ${filmed.seconds}s`)
    assert.equal(filmed.video, `/see-how/${spec.id}.webm`)
    assert.equal(filmed.poster, `/see-how/${spec.id}.jpg`)
    assert.equal(typeof filmed.overrideVideo, 'string')
    const video = path.join(root, 'public', filmed.video)
    const poster = path.join(root, 'public', filmed.poster)
    assert.ok(statSync(video).size > 1000, video)
    assert.ok(statSync(video).size <= 1_200_000, `${spec.id} video is ${statSync(video).size} bytes`)
    assert.ok(statSync(poster).size > 500, poster)
    assert.ok(seeHowFor(spec.id)?.video)
  }
})
