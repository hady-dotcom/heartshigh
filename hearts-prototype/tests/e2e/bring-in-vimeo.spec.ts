import path from 'node:path'
import { expect, request as playwrightRequest, test, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'
import { artifactDir } from './artifact-dir'

// Run twice: once with VIMEO_TOKEN set (a stand-in Vimeo answers), once without (plain "add your key" text).
const KEYED = Boolean(process.env.VIMEO_TOKEN)
const PHONE = { width: 390, height: 844 }
const DESK = { width: 1440, height: 900 }
const ARTIFACTS = artifactDir('bring-in-vimeo', KEYED ? 'with-key' : 'no-key')
const sfx = `${KEYED ? 'k' : 'n'}${Date.now().toString().slice(-6)}`
const COURSE = `Vimeo bring in ${sfx}`
const BASE_ID = KEYED ? 7700 : 7800
const LONG = `${BASE_ID}10000`
const SHORT = `${BASE_ID}10001`
const SILENT = `${BASE_ID}10002`
const HASH = 'ab12cd34ef'
const LINKS = [
  `https://vimeo.com/${LONG}/${HASH}`,
  `https://player.vimeo.com/video/${SHORT}?h=${HASH}`,
  `https://vimeo.com/${SILENT} | Hani`,
  `https://vimeo.com/${LONG}/${HASH}`,
].join('\n')

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(ARTIFACTS, `${name}.png`), fullPage: true })
}

test('Vimeo links with a private hash come in as drafts, short ones stay out, and the player keeps the hash', async ({ page }) => {
  test.setTimeout(240_000)
  await page.setViewportSize(DESK)
  await page.goto('/login?next=%2Fmaster%2Fbring-in')
  await page.getByTestId('login-email').fill('master@hearts.test')
  await page.getByTestId('login-password').fill('hearts-master')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  await expect(page.getByTestId('bring-in')).toBeVisible()
  await page.getByTestId('bring-in-urls').fill(LINKS)
  await page.getByTestId('bring-in-more').click()
  await page.getByTestId('bring-in-course').selectOption('new')
  await page.getByTestId('bring-in-new-title').fill(COURSE)
  await page.getByTestId('bring-in-speaker').fill('Leon')
  await shot(page, '01-paste')
  await page.getByTestId('bring-in-lookup').click()
  await expect(page.getByTestId('bring-in-preview')).toBeVisible()
  const copies = page.locator(`[data-testid="bring-in-row"][data-id="vimeo:${LONG}"]`)
  await expect(copies).toHaveCount(2)
  await expect(copies.nth(1)).toHaveAttribute('data-skip', 'duplicate')
  const short = page.locator(`[data-testid="bring-in-row"][data-id="vimeo:${SHORT}"]`)
  await expect(short).toHaveAttribute('data-skip', 'short')
  await expect(short.getByTestId('bring-in-pick')).not.toBeChecked()
  await shot(page, '02-preview')
  await page.getByTestId('bring-in-commit').click()
  await expect(page.getByTestId('bring-in-result')).toBeVisible()
  await expect(page.getByTestId('notice')).toContainText('saved as drafts')
  await shot(page, '03-result')

  const master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const course = (await (await master.get(`/api/courses?where[title][equals]=${encodeURIComponent(COURSE)}&limit=1`)).json()).docs?.[0]
  expect(course?.id).toBeTruthy()
  const lessons = (await (await master.get(`/api/lessons?where[course][equals]=${course.id}&limit=20&depth=0`)).json()).docs as Record<string, string>[]
  expect(lessons.map((lesson) => lesson.vimeoId).sort()).toEqual([LONG, SILENT].sort())
  const long = lessons.find((lesson) => lesson.vimeoId === LONG)!
  const silent = lessons.find((lesson) => lesson.vimeoId === SILENT)!
  expect(long.videoProvider).toBe('vimeo')
  expect(long.vimeoHash).toBe(HASH)
  expect(long.youtubeId || '').toBe('')
  expect(silent.vimeoHash || '').toBe('')
  expect(silent.speaker).toBe('Hani')
  expect(long.publishState).toBe('draft')
  if (KEYED) {
    expect(long.transcript).toContain('Today we talk about patience.')
    expect(long.transcriptSource).toBe('vimeo')
    expect(long.transcriptNote).toMatch(/^Bring-in: processed/)
    expect(Number(long.durationSeconds)).toBe(1800)
    expect(long.title).toBe(`Vimeo test talk ${LONG}`)
    expect(silent.transcriptNote).toContain('no captions on Vimeo yet')
  } else {
    expect(long.transcript || '').toBe('')
    expect(long.transcriptNote).toMatch(/^Bring-in: waiting/)
    expect(long.transcriptNote).toContain('Add your Vimeo key to pull words.')
    expect(long.title).toBe(`Vimeo public talk ${LONG}`)
    expect(Number(long.durationSeconds)).toBe(1800)
    await expect(page.getByTestId('bring-in-live')).toContainText('Add your Vimeo key to pull words.')
    await expect(page.getByTestId('bring-in-retry')).toHaveCount(0)
  }

  // Pasting the same links again does not make copies. A talk still waiting for words is reused.
  await page.goto('/master/bring-in')
  await page.getByTestId('bring-in-urls').fill(`https://vimeo.com/${LONG}/${HASH}`)
  await page.getByTestId('bring-in-more').click()
  await page.getByTestId('bring-in-course').selectOption(String(course.id))
  await page.getByTestId('bring-in-lookup').click()
  await expect(page.getByTestId('bring-in-preview')).toBeVisible()
  if (KEYED) {
    await expect(page.locator(`[data-testid="bring-in-row"][data-id="vimeo:${LONG}"]`)).toHaveAttribute('data-skip', 'library')
  } else {
    await page.getByTestId('bring-in-commit').click()
    await expect(page.getByTestId('bring-in-result')).toBeVisible()
    const again = (await (await master.get(`/api/lessons?where[course][equals]=${course.id}&limit=20&depth=0`)).json()).docs as unknown[]
    expect(again.length).toBe(2)
  }

  // The desk preview and the learner player both carry the hash.
  await master.patch(`/api/lessons/${long.id}`, { data: { publishState: 'published' } })
  await page.goto(`/master/library/${course.id}?part=${long.id}`)
  const deskFrame = page.locator(`iframe[src*="player.vimeo.com/video/${LONG}"]`).first()
  await expect(deskFrame).toHaveAttribute('src', new RegExp(`h=${HASH}`))
  await shot(page, '04-desk-preview')
  // Learner player: point a talk the seeded learner can open (local test data only) at the same private Vimeo film.
  const learner = await page.context().browser()!.newContext({ viewport: PHONE, baseURL: E2E_BASE })
  const phone = await learner.newPage()
  await phone.goto('/login?next=%2Fp%2Feast-london%2Flanes')
  await phone.getByTestId('login-email').fill('elm-learner@hearts.test')
  await phone.getByTestId('login-password').fill('portal-learner')
  await phone.getByTestId('login-submit').click()
  await phone.waitForURL((url) => !url.pathname.startsWith('/login'))
  await phone.goto('/p/east-london')
  const href = await phone.locator('a[href*="/course/"]').first().getAttribute('href')
  const openCourse = Number((/\/course\/(\d+)/.exec(String(href)) || [])[1])
  expect(openCourse, 'the learner has an open course').toBeGreaterThan(0)
  const seeded = ((await (await master.get(`/api/lessons?where[course][equals]=${openCourse}&limit=1&depth=0&sort=order`)).json()).docs?.[0]) as { id: number; course: number }
  expect(seeded?.id).toBeTruthy()
  const patched = await master.patch(`/api/lessons/${seeded!.id}`, { data: { videoProvider: 'vimeo', vimeoId: LONG, vimeoHash: HASH } })
  expect(patched.ok(), await patched.text()).toBeTruthy()
  await phone.goto(`/p/east-london/course/${seeded!.course}?part=${seeded!.id}`)
  const player = phone.getByTestId('vimeo-player')
  await expect(player).toHaveAttribute('src', new RegExp(`/video/${LONG}\\?h=${HASH}&api=1`))
  await shot(phone, '05-learner-player')
  await learner.close()
  await master.dispose()
})
