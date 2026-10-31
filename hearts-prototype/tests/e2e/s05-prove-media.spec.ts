import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { E2E_BASE } from '../env'

// S05 step 1: prove or rule out that a learner can open another learner's answer media
// in the same portal. This spec runs against UNFIXED Media.access.read. After the fix,
// s05-media-hostile.spec.ts asserts the opposite.

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

test.skip('S05 prove (before the fix): learner B can list and fetch learner A answer media in the same portal', async () => {
  const master = await as('master@hearts.test', 'hearts-master')
  const alice = await as('elm-learner2@hearts.test', 'portal-learner')
  const bob = await as('elm-learner@hearts.test', 'portal-learner')

  const nur = (await json(await master.get('/api/lessons?where[youtubeId][equals]=NIR88RRpat4&depth=0'))).docs[0]
  expect(nur, 'seed talk').toBeTruthy()
  const point = (
    await json(await master.get(`/api/engagement-points?where[lesson][equals]=${nur.id}&where[kind][equals]=reflection&where[status][equals]=published&depth=0&limit=10`))
  ).docs[0]
  expect(point, 'reflection point').toBeTruthy()

  const saved = await alice.post('/api/answers', {
    multipart: {
      pointId: String(point.id),
      body: `S05 prove voice of A ${Date.now()}`,
      keepPrivate: 'on',
      image: { name: 's05-alice.png', mimeType: 'image/png', buffer: PNG },
    },
  })
  expect(saved.ok(), await saved.text()).toBeTruthy()
  const result = await json(saved)
  const answer = await json(await alice.get(`/api/answers/${result.answerId}?depth=1`))
  const media = typeof answer.image === 'object' && answer.image ? answer.image : null
  expect(media?.id, 'alice media id').toBeTruthy()
  const mediaId = media.id as number
  const filename = String(media.filename || '')
  const mediaUrl = String(media.url || '')

  const listed = await json(await bob.get('/api/media?limit=100&depth=0'))
  const listedDocs = (listed.docs || []) as { id: number; filename?: string }[]
  const listHit = listedDocs.some((row) => row.id === mediaId)

  const byId = await bob.get(`/api/media/${mediaId}?depth=0`)
  const byIdBody = await json(byId)

  const byFile = filename ? await bob.get(`/api/media/file/${encodeURIComponent(filename)}`) : null
  const byUrl = mediaUrl ? await bob.get(mediaUrl.startsWith('http') ? mediaUrl : mediaUrl) : null

  const proof = {
    at: new Date().toISOString(),
    branch: 'cursor/basics-safety-c9aa',
    aliceAnswerId: result.answerId,
    mediaId,
    filename,
    mediaUrl,
    bobListCount: listedDocs.length,
    bobListIncludesAlice: listHit,
    bobFetchByIdStatus: byId.status(),
    bobFetchByIdOk: byId.ok(),
    bobFetchByIdHasFilename: byIdBody.filename === filename,
    bobFetchByFileStatus: byFile ? byFile.status() : null,
    bobFetchByFileOk: byFile ? byFile.ok() : null,
    bobFetchByUrlStatus: byUrl ? byUrl.status() : null,
    bobFetchByUrlOk: byUrl ? byUrl.ok() : null,
    leak:
      listHit ||
      byId.ok() ||
      Boolean(byFile?.ok()) ||
      Boolean(byUrl?.ok()),
  }

  const outDir = path.join(process.cwd(), '..', 'proto-test', 'verify', 'safety')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(path.join(outDir, 's05-prove-before.json'), JSON.stringify(proof, null, 2))

  expect(proof.leak, `S05 leak proof: ${JSON.stringify(proof)}`).toBeTruthy()

  await master.dispose()
  await alice.dispose()
  await bob.dispose()
})
