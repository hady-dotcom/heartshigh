import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { GARDEN_AREAS } from '../../src/lib/garden-areas'

test('garden plaques use the learner sans and keep every lane name', () => {
  const css = readFileSync(new URL('../../src/app/(frontend)/garden.css', import.meta.url), 'utf8')
  const rule = css.slice(css.indexOf('.plaque-name {'), css.indexOf('.garden-fruits'))
  assert.match(rule, /font-family:\s*var\(--sans\)/)
  assert.equal(rule.includes('Cinzel'), false)
  assert.equal(rule.includes('text-overflow'), false)
  assert.match(rule, /max-width:\s*36%/)
  assert.match(rule, /white-space:\s*nowrap/)
  assert.match(rule, /left:\s*50%;/)
  assert.deepEqual(GARDEN_AREAS.map((area) => area.plaque), ['QUR’AN', 'HADITH', 'CHARACTER', 'SOCIETY', 'SPIRITUALITY'])
})

test('garden plaque ribbons tuck their corners into the round pot', async () => {
  const lanes = ['quran', 'hadith', 'character', 'society', 'spirituality']
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b
  for (const lane of lanes) {
    for (const stage of [0, 4]) {
      const file = fileURLToPath(new URL(`../../public/garden/trees/${lane}/stage-${stage}-planter.webp`, import.meta.url))
      const { data, info } = await sharp(file)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const L = (x, y) => {
        const i = (y * info.width + x) * 4
        return lum(data[i], data[i + 1], data[i + 2])
      }
      assert.ok(L(160, 562) > 140, `${lane} stage ${stage} top corner is pot`)
      assert.ok(L(165, 598) > 120, `${lane} stage ${stage} bottom corner is pot`)
      assert.ok(L(256, 582) < 80, `${lane} stage ${stage} face stays dark`)
    }
  }
})
