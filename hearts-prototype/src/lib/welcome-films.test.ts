import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canReadMedia, mediaListWhere } from './media-access'
import {
  afterWelcomePath,
  filmSource,
  filmsFor,
  hasWelcomeWalk,
  nextWelcomeStep,
  shouldSeeWelcomeWalk,
  spokenWordsAt,
  welcomeStepFromQuery,
  welcomeWalkHref,
} from './welcome-films'

const portal = {
  slug: 'east-london',
  learnerWelcome: 11,
  learnerIntroUrl: 'https://www.youtube.com/watch?v=MK5q_zMiX1g',
  teacherWelcomeUrl: 'https://www.youtube.com/watch?v=ECaTWkof57E',
}

describe('welcome films', () => {
  it('prefers an uploaded file over a YouTube link, and an empty slot stays empty', () => {
    assert.deepEqual(filmSource(portal, 'learnerWelcome'), {
      kind: 'media',
      mediaId: 11,
      url: '',
      src: '/api/hearts/file/11',
    })
    assert.equal(filmSource(portal, 'learnerIntro').kind, 'url')
    assert.equal(filmSource(portal, 'teacherIntro').kind, 'empty')
  })

  it('learners see the learner pair; teachers see the teacher pair', () => {
    assert.equal(filmsFor(portal, 'learner').welcome.mediaId, 11)
    assert.equal(filmsFor(portal, 'teacher').welcome.url.includes('ECaTWkof57E'), true)
    assert.equal(filmsFor(portal, 'teacher').intro.kind, 'empty')
  })

  it('first login shows the walk; a dismissed flag never blocks a returning person', () => {
    const newLearner = { role: 'learner', seenWelcome: false, onboarded: false }
    const returning = { role: 'learner', seenWelcome: true, onboarded: true }
    assert.equal(shouldSeeWelcomeWalk(newLearner, portal), true)
    assert.equal(shouldSeeWelcomeWalk(returning, portal), false)
    assert.equal(welcomeWalkHref('/p/east-london', newLearner, portal), '/p/east-london/welcome?step=welcome')
    assert.equal(welcomeWalkHref('/p/east-london', returning, portal), null)
    assert.equal(hasWelcomeWalk({ slug: 'leeds' }, 'learner'), false)
    assert.equal(shouldSeeWelcomeWalk(newLearner, { slug: 'leeds' }), false)
  })

  it('welcome then intro then the app; new learners go on to the opening', () => {
    assert.equal(nextWelcomeStep('welcome'), 'intro')
    assert.equal(nextWelcomeStep('intro'), 'done')
    assert.equal(welcomeStepFromQuery('films'), 'welcome')
    assert.equal(afterWelcomePath('/p/east-london', { role: 'learner', onboarded: false }), '/p/east-london/start')
    assert.equal(afterWelcomePath('/p/east-london', { role: 'learner', onboarded: true }), '/p/east-london')
    assert.equal(afterWelcomePath('/p/east-london', { role: 'teacher', onboarded: true }), '/p/east-london/admin')
  })

  it('captions are only the words being spoken, never a frozen title', () => {
    const cues = [
      { at: 0, end: 2, text: 'Assalamu alaikum' },
      { at: 2, end: 5, text: 'this is how we begin' },
    ]
    assert.equal(spokenWordsAt(cues, 0.4), 'Assalamu alaikum')
    assert.equal(spokenWordsAt(cues, 2.1), 'this is how we begin')
    assert.equal(spokenWordsAt(cues, 5), '')
    assert.equal(spokenWordsAt([{ at: 0, text: 'Welcome to Hady Core' }], 12), '')
  })
})

describe('welcome film media access', () => {
  const learner = { id: 2, role: 'learner', tenants: [{ tenant: 1 }] }
  const outsider = { id: 8, role: 'learner', tenants: [{ tenant: 9 }] }
  const film = { id: 11, owner: 5, purpose: 'portal-asset', portal: 1 }

  it('portal members can open a welcome film; another portal cannot', () => {
    assert.equal(canReadMedia(learner, film, null), true)
    assert.equal(canReadMedia(outsider, film, null), false)
    assert.equal(canReadMedia(null, film, null), false)
    const list = mediaListWhere(learner)
    assert.deepEqual(list, { and: [{ portal: { equals: 1 } }, { purpose: { in: ['portal-asset', 'film'] } }] })
  })
})
