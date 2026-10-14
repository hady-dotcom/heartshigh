import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEMO_ANNOUNCE,
  DEMO_ANSWER,
  DEMO_CHANNEL,
  DEMO_COURSE,
  DEMO_LATER,
  DEMO_LIBRARY,
  DEMO_QUESTION,
  DEMO_REPLY,
  DEMO_SCENARIOS,
  DEMO_THUMB,
  DEMO_VIDEO,
  CAST_FLOW,
  castHeader,
  castPrompt,
  castReady,
  clock,
  defaultCast,
  demoChannelMessage,
  fillCast,
  learnerSeesCourse,
  ownStats,
  readChannelMessage,
  rollCast,
  reduceDemo,
  runDemoCommand,
  scenarioPlays,
  seedDemo,
  stageFor,
  teacherQueue,
  welcomeLine,
  workbookEntries,
} from '../../src/lib/demo-stage'

describe('demo stage stays in memory', () => {
  it('seeds sample data and never names a real account', () => {
    const seed = seedDemo()
    const packed = JSON.stringify(seed)
    assert.equal(packed.includes('@hearts.test'), false)
    assert.equal(packed.includes('@demo-stage.hearts'), false)
    assert.equal(seed.visibility, 'draft')
    assert.deepEqual(seed.library, [...DEMO_LIBRARY])
    assert.equal(seed.videos.length, 0)
    assert.equal(learnerSeesCourse(seed), false)
  })

  it('leaves the previous state untouched and reset reloads the seed', () => {
    const before = seedDemo()
    const snapshot = structuredClone(before)
    const published = reduceDemo(before, { type: 'publish' })
    assert.deepEqual(before, snapshot)
    assert.equal(published.visibility, 'published')
    assert.equal(before.visibility, 'draft')
    const dirty = reduceDemo(reduceDemo(published, { type: 'add-video' }), { type: 'announce' })
    assert.deepEqual(reduceDemo(dirty, { type: 'reset' }), seedDemo())
  })
})

describe('the school-demo flow', () => {
  it('adds a video with a sample thumbnail and the admin counts tick', () => {
    const next = reduceDemo(seedDemo(), { type: 'add-video' })
    assert.equal(next.videos[0]?.title, DEMO_VIDEO)
    assert.equal(next.videos[0]?.thumb, DEMO_THUMB)
    assert.equal(ownStats(next).videos, 1)
    assert.equal(next.ticker[0]?.text, `Video added: ${DEMO_VIDEO}`)
    assert.equal(reduceDemo(next, { type: 'add-video' }), next)
  })

  it('pins a question at the pause, then a later one', () => {
    let state = reduceDemo(seedDemo(), { type: 'add-video' })
    state = reduceDemo(state, { type: 'pause', at: 64 })
    state = reduceDemo(state, { type: 'add-question', when: 'now' })
    assert.equal(state.questions[0]?.prompt, DEMO_QUESTION)
    assert.equal(state.questions[0]?.at, 64)
    assert.equal(clock(64), '01:04')
    assert.equal(ownStats(state).questions, 1)
    state = reduceDemo(state, { type: 'add-question', when: 'later' })
    assert.equal(state.questions[1]?.prompt, DEMO_LATER)
    assert.equal(state.questions[1]?.contingentOn, 'q-now')
    assert.equal(ownStats(state).questions, 2)
  })

  it('publishes into the learner phone, then the answer, the queue, the reply and the workbook', () => {
    let state = stageFor('workbook')
    assert.equal(learnerSeesCourse(state), true)
    assert.equal(teacherQueue(state).length, 0)
    state = runDemoCommand(state, 'send-answer')
    assert.equal(fillCast(state.ticker[0]?.text || '', defaultCast()), `Abdallah answered: ${DEMO_ANSWER}`)
    assert.equal(teacherQueue(state).length, 1)
    assert.equal(ownStats(state).answers, 1)
    assert.equal(workbookEntries(state)[0]?.reply, '')
    state = runDemoCommand(state, 'send-reply')
    assert.equal(fillCast(state.ticker[0]?.text || '', defaultCast()), 'Sami replied')
    assert.equal(teacherQueue(state).length, 0)
    assert.equal(workbookEntries(state)[0]?.reply, DEMO_REPLY)
    assert.equal(workbookEntries(reduceDemo(state, { type: 'toggle', feature: 'workbook' })).length, 0)
  })

  it('posts an announcement and toggles a feature without touching the course', () => {
    const announced = reduceDemo(seedDemo(), { type: 'announce' })
    assert.equal(announced.announcements[0]?.body, DEMO_ANNOUNCE)
    assert.equal(announced.visibility, 'draft')
    assert.equal(learnerSeesCourse(announced), false)
    const live = reduceDemo(announced, { type: 'toggle', feature: 'live' })
    assert.equal(live.features.live, true)
    assert.equal(live.ticker[0]?.text, 'Feature toggled')
    assert.equal(ownStats(live).published, 0)
  })

  it('refuses an answer until the course is published', () => {
    let state = reduceDemo(seedDemo(), { type: 'add-video' })
    state = reduceDemo(state, { type: 'add-question', when: 'now' })
    assert.equal(reduceDemo(state, { type: 'answer' }), state)
    state = reduceDemo(state, { type: 'publish' })
    assert.equal(state.ticker[0]?.text, `Course published: ${DEMO_COURSE}`)
    assert.notEqual(reduceDemo(state, { type: 'answer' }), state)
  })
})

describe('cast your demo', () => {
  it('asks for exactly one of each, and the kind of place changes the wording', () => {
    const cast = defaultCast()
    assert.deepEqual([...CAST_FLOW], ['master', 'portal', 'teacher', 'learner'])
    assert.equal(cast.master, 'Leon (HEARTS)')
    assert.equal(castPrompt('master', 'mosque'), 'Who runs the whole system?')
    assert.equal(castPrompt('portal', 'mosque'), 'Who would look after your mosque?')
    assert.equal(castPrompt('portal', 'school'), 'Who would look after your school?')
    assert.equal(castPrompt('portal', 'company'), 'Who would look after your company?')
    assert.equal(castPrompt('teacher', 'mosque'), 'Who would guide the learners and reply to them?')
    assert.equal(castPrompt('learner', 'mosque'), 'Pick one learner from your community')
    assert.equal(castHeader(cast, 'portal'), 'Rafiq, looking after Al-Noor Mosque')
    assert.equal(castHeader(cast, 'teacher'), 'Sami, guiding the learners')
    assert.equal(welcomeLine(cast), 'Salaam Abdallah')
    assert.equal(welcomeLine({ ...cast, kind: 'school' }), 'Hello Abdallah')
    assert.equal(welcomeLine({ ...cast, kind: 'company' }), 'Hello Abdallah')
    assert.equal(castReady({ ...cast, learner: '   ' }, 'learner'), false)
    const made = rollCast(cast, 'learner', 0)
    assert.equal(made.learner, 'Yusuf')
    assert.equal(made.teacher, cast.teacher)
    const place = rollCast({ ...cast, kind: 'school' }, 'portal', 0)
    assert.equal(place.portalName, 'Willow Academy')
    assert.equal(fillCast('{learner} answered. {teacher} replied at {portal}.', cast), 'Abdallah answered. Sami replied at Al-Noor Mosque.')
  })
})

describe('demo steps and the refresh bus', () => {
  it('offers between six and ten click-throughs, and each one can be played', () => {
    assert.ok(DEMO_SCENARIOS.length >= 6)
    assert.ok(DEMO_SCENARIOS.length <= 10)
    for (const scenario of DEMO_SCENARIOS) {
      assert.equal(scenarioPlays(scenario.id), true, scenario.title)
      assert.ok(scenario.steps.length >= 1)
    }
  })

  it('shares one state over the demo channel', () => {
    const next = reduceDemo(seedDemo(), { type: 'publish' })
    const message = demoChannelMessage(next)
    const current = seedDemo()
    assert.equal(message.channel, DEMO_CHANNEL)
    assert.equal(message.type, 'replace')
    assert.deepEqual(readChannelMessage(current, message), next)
    assert.equal(readChannelMessage(current, { type: 'nope' }), current)
    assert.equal(readChannelMessage(next, null), next)
  })
})
