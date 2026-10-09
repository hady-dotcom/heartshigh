// Builds side-by-side images: the board panel on the left, the app screen on the right.
// Usage: node scripts/compare-boards.mjs <panel-dir> <screenshot-dir> <out-dir>
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const [panels = '/tmp', shots = 'artifacts/screenshots', out = 'artifacts/compare'] = process.argv.slice(2)
const pairs = [
  ['panel1.png', 'learner-01c-feed.png', '01 Hors d’oeuvre (feed)'],
  ['panel1.png', 'opening-08-feed.png', '01 Hors d’oeuvre, first feed after the opening'],
  ['panel2.png', 'learner-01b-appetiser.png', '02 Appetiser'],
  ['panel3.png', 'learner-02b-speaker.png', '02b Speaker'],
  ['panel4.png', 'learner-03-course-player-youtube.png', '03 Mains, course player'],
  ['panel5.png', 'learner-03b-answer-sheet.png', '03b Engagement point'],
  ['g1.png', 'learner-04-garden.png', 'Garden, growth banner'],
  ['g2.png', 'learner-04-garden-general.png', 'Garden, general'],
  ['g3.png', 'learner-04-garden-jibril.png', 'Garden, against Hadith Jibril'],
  ['g4.png', 'learner-04-garden-ghunya.png', 'Garden, against al-Ghuniyya'],
  ['g5.png', 'learner-04-garden-harvest.png', 'Garden, harvest'],
  ['g6.png', 'learner-04-garden-workbook.png', 'Garden, workbook'],
]
const H = 844
mkdirSync(out, { recursive: true })
const label = (text, width) =>
  Buffer.from(`<svg width="${width}" height="44" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1f1d36"/><text x="16" y="29" font-family="sans-serif" font-size="18" font-weight="700" fill="#f4efe5">${text.replace(/&/g, '&amp;')}</text></svg>`)
for (const [panel, shot, title] of pairs) {
  const left = await sharp(path.join(panels, panel)).resize({ height: H }).toBuffer()
  const right = await sharp(path.join(shots, shot)).resize({ height: H }).toBuffer()
  const lw = (await sharp(left).metadata()).width
  const rw = (await sharp(right).metadata()).width
  const width = lw + rw + 60
  await sharp({ create: { width, height: H + 96, channels: 3, background: '#e9e1d2' } })
    .composite([
      { input: label(`${title}: board on the left, app on the right`, width), left: 0, top: 0 },
      { input: left, left: 20, top: 66 },
      { input: right, left: lw + 40, top: 66 },
    ])
    .png()
    .toFile(path.join(out, `compare-${shot.replace(/^learner-/, '')}`))
}
console.log(`Wrote ${pairs.length} comparisons to ${out}`)
