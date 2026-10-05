import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { liveEventIcs } from '../server/live-email'
import { scanLiveReminders } from '../server/live-email'

describe('V03 live email hook', () => {
  it('builds an .ics for a sitting', () => {
    const ics = liveEventIcs({ id: 9, title: 'Friday circle', startsAt: '2026-10-09T18:00:00Z', url: 'https://hearts.example/live' })
    assert.match(ics, /BEGIN:VCALENDAR/)
    assert.match(ics, /Friday circle/)
    assert.match(ics, /hearts-live-9@hearts/)
  })

  it('scans nothing when live-sessions is not on this tree', async () => {
    const result = await scanLiveReminders({ collections: {} } as never)
    assert.deepEqual(result, { scanned: 0, emailed: 0 })
  })
})
