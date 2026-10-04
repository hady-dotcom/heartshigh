import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isPortraitSize, isShortsUrl, isVerticalLesson } from '../../src/lib/shorts'

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
  assert.match(zonedTime('2026-10-04T05:12:00.000Z', 'Europe/London', 'en-US'), /^Oct 4, 2026, 06:12 AM GMT\+1$/)
  assert.equal(zonedTime('nonsense', 'Europe/London'), '')
  assert.equal(zoneCity('America/Los_Angeles'), 'Los Angeles')
})
