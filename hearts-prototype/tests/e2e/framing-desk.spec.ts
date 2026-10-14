import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { PLACEHOLDER_FACE, PLACEHOLDER_FACE_FOCUS } from '../../src/lib/framing/placeholder'

async function signIn(page: Page) {
  await page.goto('/login?next=%2Fmaster%2Fframing')
  await page.getByTestId('login-email').fill('master@hearts.test')
  await page.getByTestId('login-password').fill('hearts-master')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => url.pathname.startsWith('/master/framing'))
}

async function openFirstClip(page: Page) {
  await expect(page.getByTestId('master-framing')).toBeVisible()
  await page.getByTestId('framing-open').first().click()
  await expect(page.getByTestId('framing-clip')).toBeVisible()
  await expect(page.getByTestId('framing-explainer')).toContainText('words underneath')
  const count = (await page.getByTestId('segment-count').innerText()).trim()
  expect(count).toMatch(/^\d+ segments?$/)
  expect(count).not.toBe('1 segments')
}

async function ratio(stage: Locator, film: Locator) {
  const outer = await stage.boundingBox()
  const inner = await film.boundingBox()
  expect(outer && inner).toBeTruthy()
  return {
    height: inner!.height / outer!.height,
    top: (inner!.y - outer!.y) / outer!.height,
  }
}

function stampFace(cutId: number) {
  const db = new DatabaseSync(path.join(process.cwd(), 'data/hearts-test.db'))
  const row = db.prepare(`
    SELECT cuts.start AS start, cuts."end" AS end, cuts.framing_track AS framing_track, lessons.youtube_id AS youtube_id
    FROM cuts JOIN lessons ON lessons.id = cuts.lesson_id
    WHERE cuts.id = ?
  `).get(cutId) as { start: number; end: number; framing_track: string | null; youtube_id: string }
  const track = row.framing_track
    ? (JSON.parse(row.framing_track) as { segments: { crop?: unknown; focus?: unknown; confidence: number }[] })
    : {
        version: 1,
        youtubeId: row.youtube_id,
        start: row.start,
        end: row.end,
        segments: [{ start: row.start, end: row.end, mode: 'F', confidence: 0, focus: { x: 0.5, y: 0.45 } }],
      }
  const segment = track.segments[0]
  if (!segment) throw new Error(`Cut ${cutId} has no framing segment`)
  segment.crop = PLACEHOLDER_FACE
  segment.focus = PLACEHOLDER_FACE_FOCUS
  segment.confidence = 0.85
  db.prepare('UPDATE cuts SET framing_track = ? WHERE id = ?').run(JSON.stringify(track), cutId)
  db.close()
}

/** How far the still sits left of the phone window. Centre crop pulls it hard left; face track keeps the face in frame. */
async function stillShift(lab: Locator) {
  const film = await lab.getByTestId('framing-film').boundingBox()
  const still = await lab.getByTestId('framing-still').boundingBox()
  expect(film && still && film.width > 0).toBeTruthy()
  return (still!.x - film!.x) / film!.width
}

function fileHash(file: string) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

/** Average channel distance of two downscaled shots. A one-pixel clock tick stays near zero. */
function shotDistance(left: string, right: string) {
  const thumb = (file: string) =>
    execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'scale=24:48', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'])
  const a = thumb(left)
  const b = thumb(right)
  const n = Math.min(a.length, b.length)
  let sum = 0
  for (let i = 0; i < n; i++) sum += Math.abs(a[i]! - b[i]!)
  return sum / n
}

async function learnerShape(page: Page) {
  const root = page.getByTestId('learner-preview')
  const player = root.getByTestId('framing-player')
  await expect(player).toHaveAttribute('data-framing-mode', 'F')
  await expect(player).toHaveAttribute('data-framing-source', 'placeholder')
  const shape = await ratio(player, root.getByTestId('framing-film'))
  expect(shape.height).toBeLessThan(0.4)
  expect(shape.top).toBeLessThan(0.14)
  return shape
}

test('the framing desk shows the learner phone, and the lab crop changes at both sizes', async ({ page }) => {
  test.setTimeout(240_000)
  await signIn(page)

  await page.setViewportSize({ width: 1280, height: 800 })
  await openFirstClip(page)
  await learnerShape(page)
  await page.getByTestId('learner-preview').screenshot({ path: 'test-results/framing-learner-1280.png' })

  await page.getByTestId('for-techies').locator('summary').click()
  const lab = page.getByTestId('lab-preview')
  await expect(lab).toBeVisible()
  await expect(page.getByTestId('face-track-note')).toHaveText("Face tracking hasn't been run on this clip.")
  await expect(page.locator('[data-testid="framing-mode-select"] option[value="D"]')).toContainText('not run')

  const cutId = Number(new URL(page.url()).pathname.split('/').pop())
  stampFace(cutId)
  await page.reload()
  await expect(page.getByTestId('framing-clip')).toBeVisible()
  await page.getByTestId('for-techies').locator('summary').click()
  await expect(page.getByTestId('face-track-note')).toHaveCount(0)
  await expect(page.locator('[data-testid="framing-mode-select"] option[value="D"]')).not.toContainText('not run')
  await page.addStyleTag({ content: '.fr-film, .fr-media, .fr-bg, .fr-host { transition: none !important; }' })

  const labPlayer = lab.getByTestId('framing-player')
  const shot = async (mode: 'A' | 'B' | 'D', file: string) => {
    await page.getByTestId('framing-mode-select').selectOption(mode)
    await expect(labPlayer).toHaveAttribute('data-framing-mode', mode)
    if (mode === 'A' || mode === 'D') {
      await expect(lab.getByTestId('framing-still')).toBeVisible()
      await expect.poll(async () => (await ratio(labPlayer, lab.getByTestId('framing-film'))).height).toBeGreaterThan(0.9)
      await expect.poll(async () => stillShift(lab)).toBeLessThan(mode === 'A' ? -1 : 0)
      if (mode === 'D') await expect.poll(async () => stillShift(lab)).toBeGreaterThan(-0.4)
    }
    if (mode === 'B') {
      await expect.poll(async () => (await ratio(labPlayer, lab.getByTestId('framing-film'))).height).toBeLessThan(0.45)
      await expect.poll(async () => (await ratio(labPlayer, lab.getByTestId('framing-film'))).top).toBeGreaterThan(0.15)
    }
    await learnerShape(page)
    await lab.scrollIntoViewIfNeeded()
    await lab.screenshot({ path: file, animations: 'disabled' })
  }

  const labA = 'test-results/framing-lab-a-1280.png'
  const labB = 'test-results/framing-lab-b-1280.png'
  const labD = 'test-results/framing-lab-d-1280.png'
  await shot('A', labA)
  await shot('B', labB)
  await shot('D', labD)

  expect(fileHash(labA)).not.toBe(fileHash(labB))
  expect(fileHash(labA)).not.toBe(fileHash(labD))
  expect(fileHash(labB)).not.toBe(fileHash(labD))
  expect(shotDistance(labA, labB)).toBeGreaterThan(8)
  expect(shotDistance(labA, labD)).toBeGreaterThan(8)
  expect(shotDistance(labB, labD)).toBeGreaterThan(8)

  await page.setViewportSize({ width: 390, height: 844 })
  await learnerShape(page)
  await page.getByTestId('framing-mode-select').selectOption('A')
  await expect(labPlayer).toHaveAttribute('data-framing-mode', 'A')
  await expect.poll(async () => (await ratio(labPlayer, lab.getByTestId('framing-film'))).height).toBeGreaterThan(0.9)
  await lab.scrollIntoViewIfNeeded()
  await lab.screenshot({ path: 'test-results/framing-lab-a-390.png' })
  await page.getByTestId('learner-preview').screenshot({ path: 'test-results/framing-learner-390.png' })
  await page.screenshot({ path: 'test-results/framing-page-390.png' })

  await page.getByTestId('framing-mode-select').selectOption('B')
  await expect.poll(async () => (await ratio(labPlayer, lab.getByTestId('framing-film'))).top).toBeGreaterThan(0.15)
  await lab.screenshot({ path: 'test-results/framing-lab-b-390.png' })

  await page.getByTestId('framing-save').click()
  await expect(page.getByTestId('notice')).toContainText('Learners still see')
  await expect(page.getByTestId('learner-preview').getByTestId('framing-player')).toHaveAttribute('data-framing-mode', 'F')
  await page.getByTestId('for-techies').locator('summary').click()
  await expect(page.getByTestId('framing-mode-select')).toHaveValue('B')
  await expect(page.getByTestId('lab-preview').getByTestId('framing-player')).toHaveAttribute('data-framing-mode', 'B')
  await learnerShape(page)
})
