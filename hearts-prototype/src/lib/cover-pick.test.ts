import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseCoverHit, coverSearchQuery, findCoverPhoto } from './cover-pick'

test('a course title becomes a parent-and-child photograph search', () => {
  assert.match(coverSearchQuery('Welcome'), /parent and child at home/)
  assert.match(coverSearchQuery('Social and Emotional Readiness'), /kitchen/)
  assert.match(coverSearchQuery('Focus at the table'), /homework|parent and child/)
  assert.equal(coverSearchQuery('Welcome'), coverSearchQuery('Welcome'))
})

test('the picker keeps a real photograph and ignores diagrams', () => {
  const chosen = chooseCoverHit([
    { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a.jpg', mime: 'image/jpeg' },
    { url: 'https://example.com/secret.jpg', mime: 'image/jpeg' },
    { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b.svg', mime: 'image/svg+xml' },
  ], 'course:9')
  assert.equal(chosen?.url, 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a.jpg')
  assert.equal(chooseCoverHit([{ url: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a.jpg', mime: 'image/jpeg' }], 'course:9')?.url, 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a.jpg')
  assert.equal(chooseCoverHit([], 'course:9'), null)
})

test('a failed search does not invent a picture', async () => {
  const found = await findCoverPhoto('A brand new course', 'course:404', async () => new Response('no', { status: 500 }))
  assert.equal(found, null)
})
