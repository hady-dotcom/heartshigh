import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { E2E_BASE } from '../env'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

async function as(email: string, password: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}

const json = async (response: APIResponse) => (await response.json().catch(() => ({}))) as Record<string, any>

async function get(ctx: APIRequestContext, path: string, tries = 4) {
  let last: unknown
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await ctx.get(path)
    } catch (error) {
      last = error
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
    }
  }
  throw last
}

function denied(status: number) {
  return status === 403 || status === 404
}

test('S05: learner B cannot list or fetch learner A private answer media', async ({ page }) => {
  const master = await as('master@hearts.test', 'hearts-master')
  const alice = await as('elm-learner2@hearts.test', 'portal-learner')
  const bob = await as('elm-learner@hearts.test', 'portal-learner')
  const teacher = await as('elm-teacher@hearts.test', 'portal-teacher')
  const guest = await playwrightRequest.newContext({ baseURL: E2E_BASE })

  const nur = (await json(await get(master, '/api/lessons?where[youtubeId][equals]=NIR88RRpat4&depth=0'))).docs[0]
  const point = (
    await json(
      await get(
        master,
        `/api/engagement-points?where[lesson][equals]=${nur.id}&where[kind][equals]=reflection&where[status][equals]=published&depth=0&limit=10`,
      ),
    )
  ).docs[0]

  const saved = await alice.post('/api/answers', {
    multipart: {
      pointId: String(point.id),
      body: `S05 after private ${Date.now()}`,
      keepPrivate: 'on',
      image: { name: 's05-after.png', mimeType: 'image/png', buffer: PNG },
    },
  })
  expect(saved.ok(), await saved.text()).toBeTruthy()
  const result = await json(saved)
  expect(result.answerId, 'alice answer').toBeTruthy()
  const answer = await json(await get(alice, `/api/answers/${result.answerId}?depth=0`))
  const mediaId = typeof answer.image === 'object' && answer.image ? Number(answer.image.id) : Number(answer.image)
  expect(mediaId, 'alice media').toBeTruthy()
  const owned = await json(await get(alice, `/api/media/${mediaId}?depth=0`))
  const filename = String(owned.filename || '')

  const listed = await json(await get(bob, '/api/media?limit=100&depth=0'))
  const listedDocs = (listed.docs || []) as { id: number }[]
  expect(listedDocs.some((row) => row.id === mediaId)).toBeFalsy()

  const byId = await get(bob, `/api/media/${mediaId}?depth=0`)
  expect(denied(byId.status()), `bob by id ${byId.status()}`).toBeTruthy()

  const byFile = filename ? await get(bob, `/api/media/file/${encodeURIComponent(filename)}`) : null
  if (byFile) expect(denied(byFile.status()), `bob by file ${byFile.status()}`).toBeTruthy()

  const signed = await get(bob, `/api/hearts/file/${mediaId}`)
  expect(signed.status()).toBe(403)

  const teacherPrivate = await get(teacher, `/api/hearts/file/${mediaId}`)
  expect(denied(teacherPrivate.status()), 'teacher cannot open an unshared answer file').toBeTruthy()

  const ownerById = await get(alice, `/api/media/${mediaId}?depth=0`)
  expect(ownerById.ok(), 'owner can read their media row').toBeTruthy()
  const ownerFetch = await get(alice, `/api/hearts/file/${mediaId}`)
  expect(ownerFetch.ok(), 'owner can open their file').toBeTruthy()

  const sharedSaved = await alice.post('/api/answers', {
    multipart: {
      pointId: String(point.id),
      body: `S05 after shared ${Date.now()}`,
      shareWithTeacher: 'on',
      image: { name: 's05-shared.png', mimeType: 'image/png', buffer: PNG },
    },
  })
  expect(sharedSaved.ok(), await sharedSaved.text()).toBeTruthy()
  const sharedResult = await json(sharedSaved)
  const sharedAnswer = await json(await get(alice, `/api/answers/${sharedResult.answerId}?depth=0`))
  const sharedMediaId =
    typeof sharedAnswer.image === 'object' && sharedAnswer.image ? Number(sharedAnswer.image.id) : Number(sharedAnswer.image)
  const teacherShared = await get(teacher, `/api/hearts/file/${sharedMediaId}`)
  expect(teacherShared.ok(), 'teacher can open a shared answer file').toBeTruthy()
  const bobShared = await get(bob, `/api/hearts/file/${sharedMediaId}`)
  expect(denied(bobShared.status()), 'learner B still cannot open a teacher-shared file').toBeTruthy()

  const publicStill = await get(guest, '/theme/lattice.svg')
  expect(publicStill.ok(), 'public library / theme art still loads signed out').toBeTruthy()
  const guestMedia = await get(guest, '/api/media?limit=5&depth=0')
  expect(guestMedia.ok(), 'signed-out people cannot list media').toBeFalsy()

  await page.goto(`/login?next=${encodeURIComponent('/p/east-london/garden/workbook')}`)
  await page.getByTestId('login-email').fill('elm-learner2@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  await expect(page.getByTestId('workbook-media').first()).toBeVisible()
  const shots = path.join(process.cwd(), '..', 'proto-test', 'verify', 'hotfix-s05')
  mkdirSync(shots, { recursive: true })
  await page.getByTestId('workbook-media').first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(shots, 'workbook-owner-file.png'), fullPage: true })

  await page.context().clearCookies()
  await page.goto(`/login?next=${encodeURIComponent('/p/east-london/garden/workbook')}`)
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  const forbidden = await page.goto(`/api/hearts/file/${mediaId}`)
  expect(forbidden?.status()).toBe(403)
  await page.screenshot({ path: path.join(shots, 'learner-b-403.png'), fullPage: true })

  const proof = {
    at: new Date().toISOString(),
    mediaId,
    sharedMediaId,
    bobListIncludesAlice: listedDocs.some((row) => row.id === mediaId),
    bobFetchByIdStatus: byId.status(),
    bobFetchByFileStatus: byFile ? byFile.status() : null,
    bobSignedStatus: signed.status(),
    teacherPrivateStatus: teacherPrivate.status(),
    teacherSharedOk: teacherShared.ok(),
    ownerFetchOk: ownerFetch.ok(),
    ownerByIdOk: ownerById.ok(),
    publicStillSignedOut: publicStill.ok(),
    guestMediaStatus: guestMedia.status(),
    closed:
      !listedDocs.some((row) => row.id === mediaId) &&
      denied(byId.status()) &&
      signed.status() === 403 &&
      ownerFetch.ok() &&
      teacherShared.ok() &&
      denied(teacherPrivate.status()),
  }
  writeFileSync(path.join(shots, 's05-prove-after.json'), JSON.stringify(proof, null, 2))
  expect(proof.closed, JSON.stringify(proof)).toBeTruthy()

  await master.dispose()
  await alice.dispose()
  await bob.dispose()
  await teacher.dispose()
  await guest.dispose()
})
