import assert from 'node:assert/strict'
import { test } from 'node:test'
import { discoverVimeoHash, discoverVimeoPage, fetchVimeoMeta, readVimeoOembed, shouldFetchVimeo, storedVimeoRow, vimeoHashFromHtml, vimeoOembedUrl } from './vimeo-meta'

test('a stored row keeps a real thumbnail and does not invent a length', () => {
  const row = storedVimeoRow([0, 'https://i.vimeocdn.com/video/a.webp?f=webp&amp;region=us', '6a201aec2b'])
  assert.equal(row?.durationSeconds, 0)
  assert.equal(row?.posterUrl, 'https://i.vimeocdn.com/video/a.webp?f=webp&region=us')
  assert.equal(row?.hash, '6a201aec2b')
  assert.equal(storedVimeoRow([0, '', '']), null)
  assert.equal(storedVimeoRow([169, 'https://i.vimeocdn.com/video/b.jpg'])?.durationSeconds, 169)
})

test('vimeo oEmbed keeps a real duration and an https thumbnail', () => {
  const meta = readVimeoOembed({ duration: 372.4, thumbnail_url: 'https://i.vimeocdn.com/video/123_640.jpg' })
  assert.equal(meta.durationSeconds, 372)
  assert.equal(meta.posterUrl, 'https://i.vimeocdn.com/video/123_640.jpg')
  assert.equal(meta.hash, '')
  assert.equal(readVimeoOembed({ html: '<iframe src="https://player.vimeo.com/video/1239173362?h=944300ea22">' }).hash, '944300ea22')
  assert.equal(vimeoHashFromHtml('<meta name="twitter:player" content="https://player.vimeo.com/video/1239173362?h=944300ea22">', '1239173362'), '944300ea22')
  assert.match(vimeoOembedUrl('1239173362', '944300ea22'), /vimeo\.com%2F1239173362%2F944300ea22/)
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

test('the privacy hash is read from the public page before oEmbed', async () => {
  const html = '<meta name="twitter:player" content="https://player.vimeo.com/video/1239173362?h=944300ea22">'
  const hash = await discoverVimeoHash('1239173362', async () => new Response(html, { status: 200 }))
  assert.equal(hash, '944300ea22')
  const meta = await fetchVimeoMeta('1239173362', async () => Response.json({ duration: 230, thumbnail_url: 'https://i.vimeocdn.com/video/a.jpg', html }), '944300ea22')
  assert.equal(meta?.hash, '944300ea22')
  assert.equal(meta?.durationSeconds, 230)
})

test('a hashed oEmbed miss falls back to the public oEmbed and keeps the hash', async () => {
  const meta = await fetchVimeoMeta('1239173362', async (url) => {
    if (String(url).includes('944300ea22')) return new Response('no', { status: 404 })
    return Response.json({ duration: 230, thumbnail_url: 'https://i.vimeocdn.com/video/a.jpg' })
  }, '944300ea22')
  assert.equal(meta?.durationSeconds, 230)
  assert.equal(meta?.hash, '944300ea22')
})

test('a real page keeps its privacy hash even when a challenge snippet is appended', async () => {
  const html = '<meta name="twitter:player" content="https://player.vimeo.com/video/1239173362?h=944300ea22"><h1>Verify to continue</h1>'
  const page = await discoverVimeoPage('1239173362', async () => new Response(html, { status: 200 }))
  assert.equal(page.seen, true)
  assert.equal(page.hash, '944300ea22')
})

test('a challenge page is not treated as a film with no privacy hash', async () => {
  const page = await discoverVimeoPage('496852675', async () => new Response('<div class="cf-turnstile"></div>', { status: 200 }))
  assert.equal(page.seen, false)
  assert.equal(page.hash, '')
  assert.equal(await discoverVimeoHash('496852675', async () => new Response('no', { status: 403 })), '')
})

test('tests and the live build do not call Vimeo while they start', () => {
  assert.equal(shouldFetchVimeo({ HEARTS_E2E: '1' }), false)
  assert.equal(shouldFetchVimeo({ NODE_ENV: 'test' }), false)
  assert.equal(shouldFetchVimeo({ HEARTS_BUILD: '1' }), false)
  assert.equal(shouldFetchVimeo({ NODE_ENV: 'production' }), true)
})
