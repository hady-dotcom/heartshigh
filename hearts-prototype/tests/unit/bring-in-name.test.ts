import assert from 'node:assert/strict'
import { test } from 'node:test'
import { looseBringInPaste, suggestedCourseName, suggestedCourseSpeaker } from '../../src/lib/bring-in-plan'
import { expandBringInText } from '../../src/lib/youtube-list'

const film = { title: 'Goals for the month', channel: 'HEARTS channel' }

test('a blank new course takes the playlist title, and a loose link takes the film then the channel', () => {
  assert.equal(looseBringInPaste('https://www.youtube.com/watch?v=B4KtRL_2aXY\nhttps://youtu.be/UUTnGXyCHZI | Hani'), true)
  assert.equal(looseBringInPaste('https://www.youtube.com/playlist?list=PLheartsround2'), false)
  assert.equal(
    suggestedCourseName({ playlistTitle: 'Round two sitting', loose: false, videos: [film] }),
    'Round two sitting',
  )
  assert.equal(
    suggestedCourseName({ playlistTitle: 'NA', loose: false, videos: [film] }),
    'HEARTS channel',
  )
  assert.equal(
    suggestedCourseName({ playlistTitle: 'Round two sitting', loose: true, videos: [film, { title: 'Later', channel: 'Other' }] }),
    'Goals for the month',
  )
  assert.equal(
    suggestedCourseName({ playlistTitle: '', loose: true, videos: [{ title: 'Film B4KtRL_2aXY', channel: 'HEARTS channel' }] }),
    'HEARTS channel',
  )
  assert.equal(suggestedCourseSpeaker({ typed: '', videos: [film] }), 'HEARTS channel')
  assert.equal(suggestedCourseSpeaker({ typed: 'Alauddin Elbakri', videos: [film] }), 'Alauddin Elbakri')
})

test('a playlist lookup keeps the playlist title for the course name', async () => {
  const expanded = await expandBringInText('https://www.youtube.com/playlist?list=PLheartsround2', {
    probeCaptions: false,
    list: async () => ({
      entries: [{ id: 'B4KtRL_2aXY', title: 'Goals for the month', durationRaw: 427, channel: 'HEARTS channel', channelId: 'UCheartsround', captions: 'yes', playlistTitle: 'Round two sitting' }],
      playlistTitle: 'Round two sitting',
      error: '',
    }),
  })
  assert.equal(expanded.playlistTitle, 'Round two sitting')
  assert.equal(expanded.videos[0]?.title, 'Goals for the month')
  assert.equal(
    suggestedCourseName({ playlistTitle: expanded.playlistTitle, loose: looseBringInPaste('https://www.youtube.com/playlist?list=PLheartsround2'), videos: expanded.videos }),
    'Round two sitting',
  )
})
