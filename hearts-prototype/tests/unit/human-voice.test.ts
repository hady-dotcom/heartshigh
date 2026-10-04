import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { STEP_SPECS } from '../../src/lib/ai-steps'
import { CIRCLE_LENGTHS, CIRCLE_TONES, circleRequest, mockCircleAnswers } from '../../src/lib/circle'
import { suggestRewrite, themesFromAnswers } from '../../src/lib/feedback'
import { banLine, bannedPhraseHits, hasTidyThreePartList } from '../../src/lib/human-voice'
import { REFLECTION_FALLBACK, reflectionSystem } from '../../src/lib/llm'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** The denylist sentence is allowed to name the phrases. Everything else is not. */
function scrub(text: string) {
  return text.replace(/Never write these phrases:[^.]*\./gi, '')
}

function filesIn(dir: string) {
  return readdirSync(dir)
    .filter((name) => !name.startsWith('.'))
    .map((name) => path.join(dir, name))
}

test('banned phrases stay out of the seeds and the prompts', () => {
  const files = [
    // Speaker biographies are quoted records. They are not demo answers or prompts.
    ...filesIn(path.join(root, 'src/seed')).filter((file) => !file.endsWith('speakers-data.json')),
    ...filesIn(path.join(root, 'prompts')),
  ]
  for (const file of files) {
    const hits = bannedPhraseHits(scrub(readFileSync(file, 'utf8')))
    assert.deepEqual(hits, [], `${path.relative(root, file)}: ${hits.join(', ')}`)
  }

  const prompts = [
    ...STEP_SPECS.map((step) => step.prompt),
    circleRequest({ prompt: 'What stayed with you?', kind: 'reflection' }, [{ tone: 'warm', length: 'short' }]).system,
    reflectionSystem(),
    banLine(),
  ]
  for (const [index, prompt] of prompts.entries()) {
    const hits = bannedPhraseHits(scrub(prompt))
    assert.deepEqual(hits, [], `prompt ${index}: ${hits.join(', ')}`)
  }
  assert.match(banLine(), /resonated with me/)
  assert.match(scrub(banLine()), /^$/)
})

test('demo answers, circle drafts, rewrites and theme notes avoid the banned phrases and a tidy list of three', () => {
  const samples = [
    ...REFLECTION_FALLBACK,
    suggestRewrite('Tell me about Islam'),
    suggestRewrite(''),
    ...themesFromAnswers('Phone went in the other room after isha.\nWalked to fajr with my brother.\nLeft my phone in the kitchen.\nTea on Thursday.\nShort one.').themes,
  ]
  const point = { prompt: 'What stayed with you from this?', kind: 'reflection' }
  for (let seed = 0; seed < 20; seed++) {
    for (const draft of mockCircleAnswers(point, 7, CIRCLE_TONES, CIRCLE_LENGTHS, seed)) samples.push(draft.body)
  }
  for (const sample of samples) {
    assert.deepEqual(bannedPhraseHits(sample), [], sample)
    assert.equal(hasTidyThreePartList(sample), false, sample)
  }
})
