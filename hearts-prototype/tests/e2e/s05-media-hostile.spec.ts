import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
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

test('S05: learner B cannot list or fetch learner A private answer media', async () => {
  const master = await as('master@hearts.test', 'hearts-master')
  const alice = await as('elm-learner2@hearts.test', 'portal-learner')
  const bob = await as('elm-learner@hearts.test', 'portal-learner')
  const teacher = await as('elm-teacher@hearts.test', 'portal-teacher')

  const nur = (await json(await master.get('/api/lessons?where[youtubeId][equals]=NIR88RRpat4&depth=0'))).docs[0]
  const point = (await json(await master.get(`/api/engagement-points?where[lesson][equals]=${nur.id}&where[kind][equals]=reflection&where[status][equals]=published&depth=0&limit=10`))).docs[0]

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
  const answer = await json(await alice.get(`/api/answers/${result.answerId}?depth=0`))
  const mediaId = typeof answer.image === 'object' && answer.image ? Number(answer.image.id) : Number(answer.image)
  expect(mediaId, 'alice media').toBeTruthy()
  const owned = await json(await alice.get(`/api/media/${mediaId}?depth=0`))
  const filename = String(owned.filename || '')

  const listed = await json(await bob.get('/api/media?limit=100&depth=0'))
  const listedDocs = (listed.docs || []) as { id: number }[]
  expect(listedDocs.some((row) => row.id === mediaId)).toBeFalsy()

  const byId = await bob.get(`/api/media/${mediaId}?depth=0`)
  expect(byId.ok()).toBeFalsy()

  if (filename) {
    const byFile = await bob.get(`/api/media/file/${encodeURIComponent(filename)}`)
    expect(byFile.ok()).toBeFalsy()
  }

  const signed = await bob.get(`/api/hearts/file/${mediaId}`)
  expect(signed.status()).toBe(403)

  const teacherFetch = await teacher.get(`/api/media/${mediaId}?depth=0`)
  expect(teacherFetch.ok(), 'teacher cannot open an unshared answer file').toBeFalsy()

  const ownerFetch = await alice.get(`/api/hearts/file/${mediaId}`)
  expect(ownerFetch.ok(), 'owner can open their file').toBeTruthy()

  const proof = {
    at: new Date().toISOString(),
    mediaId,
    bobListIncludesAlice: listedDocs.some((row) => row.id === mediaId),
    bobFetchByIdStatus: byId.status(),
    bobSignedStatus: signed.status(),
    teacherFetchStatus: teacherFetch.status(),
    ownerFetchOk: ownerFetch.ok(),
    closed: !listedDocs.some((row) => row.id === mediaId) && !byId.ok() && signed.status() === 403,
  }
  const outDir = path.join(process.cwd(), '..', 'proto-test', 'verify', 'safety')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(path.join(outDir, 's05-prove-after.json'), JSON.stringify(proof, null, 2))

  await master.dispose()
  await alice.dispose()
  await bob.dispose()
  await teacher.dispose()
})
