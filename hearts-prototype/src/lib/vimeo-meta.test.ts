import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchVimeoMeta, readVimeoOembed, shouldFetchVimeo } from './vimeo-meta'

test('vimeo oEmbed keeps a real duration and an https thumbnail', () => {
  const meta = readVimeoOembed({ duration: 372.4, thumbnail_url: 'https://i.vimeocdn.com/video/123_640.jpg' })
  assert.equal(meta.durationSeconds, 372)
  assert.equal(meta.posterUrl, 'https://i.vimeocdn.com/video/123_640.jpg')
  assert.equal(readVimeoOembed({ duration: 0, thumbnail_url: 'http://example.com/a.jpg' }).posterUrl, '')
  assert.equal(readVimeoOembed({ thumbnail_url: 'javascript:alert(1)' }).posterUrl, '')
})

test('a missing oEmbed answer is not stored', async () => {
  const missed = await fetchVimeoMeta('1239173361', async () => new Response('no', { status: 404 }))
  assert.equal(missed, null)
  const got = await fetchVimeoMeta('1239173361', async () => Response.json({ duration: 90, thumbnail_url: 'https://i.vimeocdn.com/video/a.jpg' }))
  assert.equal(got?.durationSeconds, 90)
  assert.equal(got?.posterUrl, 'https://i.vimeocdn.com/video/a.jpg')
})

test('tests and the live build do not call Vimeo while they start', () => {
  assert.equal(shouldFetchVimeo({ HEARTS_E2E: '1' }), false)
  assert.equal(shouldFetchVimeo({ NODE_ENV: 'test' }), false)
  assert.equal(shouldFetchVimeo({ HEARTS_BUILD: '1' }), false)
  assert.equal(shouldFetchVimeo({ NODE_ENV: 'production' }), true)
})
