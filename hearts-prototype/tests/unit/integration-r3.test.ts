import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cleanThumbnail, hasWordsInPicture, isPortraitSize, isShortsUrl, isTitledThumbnail, isVerticalLesson } from '../../src/lib/shorts'
import { playerVars } from '../../src/lib/yt'

test('Shorts: a /shorts/ link or a 9:16 size is vertical, a watch link or a 16:9 size is not', () => {
  assert.ok(isShortsUrl('https://www.youtube.com/shorts/abcdefghijk'))
  assert.ok(isShortsUrl('https://youtube.com/shorts/abcdefghijk?feature=share'))
  assert.ok(isShortsUrl('https://m.youtube.com/shorts/abcdefghijk'))
  assert.ok(!isShortsUrl('https://www.youtube.com/watch?v=abcdefghijk'))
  assert.ok(!isShortsUrl('https://example.com/shorts/abcdefghijk'))
  assert.ok(!isShortsUrl(null))
  assert.ok(isPortraitSize(113, 200))
  assert.ok(isPortraitSize(1080, 1920))
  assert.ok(!isPortraitSize(200, 113))
  assert.ok(!isPortraitSize(500, 500))
  assert.ok(!isPortraitSize(undefined, 200))
  assert.ok(isVerticalLesson({ vertical: true }))
  assert.ok(isVerticalLesson({ sourceUrl: 'https://www.youtube.com/shorts/abcdefghijk' }))
  assert.ok(!isVerticalLesson({ youtubeUrl: 'https://youtu.be/abcdefghijk' }))
  assert.ok(!isVerticalLesson(null))
})

test('export times: the portal zone (Europe/London unless set), the viewer\'s language, and a short zone label', async () => {
  const { DEFAULT_TIME_ZONE, isTimeZone, localeFromAcceptLanguage, portalTimeZone, zonedTime, zoneCity } = await import('../../src/lib/zone-time')
  assert.equal(DEFAULT_TIME_ZONE, 'Europe/London')
  assert.equal(portalTimeZone(null), 'Europe/London')
  assert.equal(portalTimeZone({ timeZone: 'Not/AZone' }), 'Europe/London')
  assert.equal(portalTimeZone({ timeZone: 'Asia/Dubai' }), 'Asia/Dubai')
  assert.ok(isTimeZone('America/Los_Angeles') && !isTimeZone('Mars/Olympus'))
  assert.equal(localeFromAcceptLanguage('de-DE,de;q=0.9,en;q=0.8'), 'de-DE')
  assert.equal(localeFromAcceptLanguage('en;q=0.2, fr-CA;q=0.9'), 'fr-CA')
  assert.equal(localeFromAcceptLanguage(''), 'en-GB')
  assert.equal(zonedTime('2026-10-04T05:12:00.000Z', 'Europe/London', 'en-GB'), '4 Oct 2026, 06:12 BST')
  assert.equal(zonedTime('2026-12-04T05:12:00.000Z', 'Europe/London', 'en-GB'), '4 Dec 2026, 05:12 GMT')
  assert.equal(zonedTime('2026-10-04T05:12:00.000Z', 'Asia/Dubai', 'en-GB'), '4 Oct 2026, 09:12 GST')
  assert.match(zonedTime('2026-10-04T18:57:00.000Z', 'America/Toronto', 'en-GB'), /^4 Oct 2026, 14:57 (EDT|GMT-4)$/)
  assert.equal(zoneCity('America/Toronto'), 'Toronto')
  assert.match(zonedTime('2026-10-04T05:12:00.000Z', 'Europe/London', 'en-US'), /^Oct 4, 2026, 06:12 AM GMT\+1$/)
  assert.equal(zonedTime('nonsense', 'Europe/London'), '')
  assert.equal(zoneCity('America/Los_Angeles'), 'Los Angeles')
})

test('words in the picture: a Short or a lesson flagged with burned-in captions, nothing else', () => {
  assert.ok(hasWordsInPicture({ vertical: true }))
  assert.ok(hasWordsInPicture({ burnedCaptions: true }))
  assert.ok(hasWordsInPicture({ youtubeUrl: 'https://www.youtube.com/shorts/abcdefghijk' }))
  assert.ok(!hasWordsInPicture({ burnedCaptions: false, youtubeUrl: 'https://youtu.be/abcdefghijk' }))
  assert.ok(!hasWordsInPicture(null))
})

test('posters: YouTube\'s titled thumbnails and their /clips/ copies are never ours; the large frame only when marked clean', () => {
  assert.ok(isTitledThumbnail('https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg'))
  assert.ok(isTitledThumbnail('https://img.youtube.com/vi/abcdefghijk/maxresdefault.jpg'))
  assert.ok(isTitledThumbnail('/clips/HfIT8TSoHiE.jpg'))
  assert.ok(isTitledThumbnail('https://i.ytimg.com/vi/HfIT8TSoHiE/hqdefault.jpg'))
  assert.ok(!isTitledThumbnail('/slides/bg-cinema-road.jpg'))
  assert.ok(!isTitledThumbnail(null))
  assert.equal(cleanThumbnail({ youtubeId: 'abcdefghijk', thumbnailClean: true }), 'https://i.ytimg.com/vi/abcdefghijk/maxresdefault.jpg')
  assert.equal(cleanThumbnail({ youtubeId: 'abcdefghijk' }), null)
  assert.equal(cleanThumbnail({ youtubeId: 'not an id', thumbnailClean: true }), null)
})

test('feed players and the course player keep YouTube captions and annotations off and send no caption language', () => {
  for (const kind of ['hors', 'appetiser', 'full'] as const) {
    const vars = playerVars(kind, 3, 20) as Record<string, unknown>
    assert.equal(vars.cc_load_policy, 0, kind)
    assert.equal(vars.iv_load_policy, 3, kind)
    assert.equal(vars.controls, 0, kind)
    assert.equal('cc_lang_pref' in vars, false, kind)
  }
})

test('portal names: the brand word shows as Hady Core; other names, stored values and slugs stay as typed', async () => {
  const { portalDisplayName, showPortalName } = await import('../../src/lib/portal-name')
  assert.equal(showPortalName('Hearts'), 'Hady Core')
  assert.equal(showPortalName('hearts demo'), 'Hady Core demo')
  assert.equal(showPortalName('East London Mosque'), 'East London Mosque')
  assert.equal(showPortalName('Heartsease Hall'), 'Heartsease Hall')
  assert.equal(showPortalName(undefined), '')
  assert.equal(portalDisplayName({ name: 'Hearts', organisationName: '' }), 'Hady Core')
  assert.equal(portalDisplayName({ name: 'Leeds Chapter', organisationName: 'Hearts' }), 'Hady Core')
  assert.equal(portalDisplayName({ name: 'Hearts', organisationName: 'East London Mosque' }), 'East London Mosque')
  const portal = { slug: 'hearts', name: 'Hearts' }
  portalDisplayName(portal)
  assert.deepEqual(portal, { slug: 'hearts', name: 'Hearts' })
})
