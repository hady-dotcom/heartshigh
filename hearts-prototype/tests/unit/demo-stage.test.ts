import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CAST_FLOW,
  DEMO_CHANNEL,
  LOOP_ANSWER,
  LOOP_BOOK_LINE,
  LOOP_COMMENT,
  LOOP_COURSE,
  LOOP_NOTE,
  LOOP_PLAY,
  LOOP_QUESTION,
  LOOP_REPLY,
  LOOP_WORKBOOK,
  SEED_COURSES,
  SEED_NOTE,
  castFilled,
  castHeader,
  castPrompt,
  castReady,
  defaultCast,
  demoChannelMessage,
  fillCast,
  kindLabel,
  learnerPrompts,
  learnerThread,
  loopCounts,
  loopStepPlays,
  playAll,
  readChannelMessage,
  receiversFor,
  reduceDemo,
  rollCast,
  seedDemo,
  stuckRows,
  welcomeLine,
  COVERAGE,
  DEMO_ENTRY_START,
  DEMO_ENTRY_TITLE,
  alertsFor,
  coverageMarkdown,
  coverageWorks,
  learnerVisible,
} from '../../src/lib/demo-stage'

const JARGON = ['payload', 'toggle', 'draft', 'publish', 'contingent', 'scenario', 'imported']

describe('demo stage stays in memory', () => {
  it('starts with a full sample and never names a real account', () => {
    const seed = seedDemo()
    const packed = JSON.stringify(seed)
    assert.equal(packed.includes('@'), false)
    assert.equal(seed.courses.map((course) => course.title).join('|'), SEED_COURSES.join('|'))
    assert.equal(seed.notes[0]?.body, SEED_NOTE)
    assert.equal(loopCounts(seed).waiting, 3)
    assert.equal(loopCounts(seed).done, 2)
    assert.equal(loopCounts(seed).stuck, 5)
    assert.ok(seed.activity.length >= 4)
    assert.ok(seed.queue.some((row) => row.kind === 'comment' && !row.done))
    assert.ok(seed.queue.some((row) => row.kind === 'workbook' && !row.done))
    assert.ok(seed.queue.some((row) => row.kind === 'answer' && !row.done))
    assert.equal(learnerThread(seed).some((row) => row.done && row.reply), true)
  })

  it('leaves the previous state untouched and reset reloads the sample', () => {
    const before = seedDemo()
    const snapshot = structuredClone(before)
    const added = reduceDemo(before, { type: 'add-course', title: 'River path' })
    assert.deepEqual(before, snapshot)
    assert.equal(added.courses[0]?.title, 'River path')
    assert.equal(before.courses[0]?.title, SEED_COURSES[0])
    assert.deepEqual(reduceDemo(added, { type: 'reset' }), seedDemo())
  })
})

describe('down the loop', () => {
  it('adds a course into the library and the learner feed', () => {
    const next = reduceDemo(seedDemo(), { type: 'add-course', title: `  ${LOOP_COURSE}  ` })
    assert.equal(next.courses[0]?.title, LOOP_COURSE)
    assert.equal(loopCounts(next).courses, SEED_COURSES.length + 1)
    assert.equal(next.activity[0]?.text, `{master} added a course: ${LOOP_COURSE}.`)
    assert.deepEqual(receiversFor({ type: 'add-course', title: LOOP_COURSE }), ['portal', 'learner'])
    assert.equal(next.fresh[0], next.courses[0]?.id)
    assert.equal(reduceDemo(next, { type: 'add-course', title: '   ' }), next)
  })

  it('posts an announcement onto the phone', () => {
    const next = reduceDemo(seedDemo(), { type: 'post-note', body: LOOP_NOTE })
    assert.equal(next.notes[0]?.body, LOOP_NOTE)
    assert.equal(next.notes[1]?.body, SEED_NOTE)
    assert.deepEqual(receiversFor({ type: 'post-note', body: LOOP_NOTE }), ['learner'])
    const quiet = seedDemo()
    assert.equal(reduceDemo(quiet, { type: 'post-note', body: ' ' }), quiet)
  })

  it('sets a question and a workbook prompt the learner can open', () => {
    let state = reduceDemo(seedDemo(), { type: 'set-prompt', kind: 'question', text: LOOP_QUESTION })
    state = reduceDemo(state, { type: 'set-prompt', kind: 'workbook', text: LOOP_WORKBOOK })
    assert.equal(learnerPrompts(state)[0]?.text, LOOP_WORKBOOK)
    assert.equal(learnerPrompts(state)[1]?.text, LOOP_QUESTION)
    assert.equal(stuckRows(state).filter((row) => row.name === '{learner}').length, 3)
    assert.deepEqual(receiversFor({ type: 'set-prompt', kind: 'question', text: LOOP_QUESTION }), ['learner'])
  })
})

describe('back up the loop', () => {
  it('lands an answer, a workbook line, and a comment in the reply queue', () => {
    let state = reduceDemo(seedDemo(), { type: 'set-prompt', kind: 'question', text: LOOP_QUESTION })
    state = reduceDemo(state, { type: 'set-prompt', kind: 'workbook', text: LOOP_WORKBOOK })
    const before = loopCounts(state)
    state = reduceDemo(state, { type: 'write', kind: 'answer', body: LOOP_ANSWER })
    state = reduceDemo(state, { type: 'write', kind: 'workbook', body: LOOP_BOOK_LINE })
    state = reduceDemo(state, { type: 'write', kind: 'comment', body: LOOP_COMMENT })
    assert.equal(state.queue[0]?.body, LOOP_COMMENT)
    assert.equal(state.queue[0]?.kind, 'comment')
    assert.equal(state.queue[1]?.body, LOOP_BOOK_LINE)
    assert.equal(state.queue[2]?.body, LOOP_ANSWER)
    assert.equal(state.queue[2]?.prompt, LOOP_QUESTION)
    assert.equal(loopCounts(state).waiting, before.waiting + 3)
    assert.equal(loopCounts(state).stuck, before.stuck + 1)
    assert.equal(kindLabel('workbook'), 'Workbook')
    const bare = seedDemo()
    assert.equal(reduceDemo(bare, { type: 'write', kind: 'answer', body: 'No question is open' }), bare)
    assert.equal(reduceDemo(bare, { type: 'write', kind: 'comment', body: '   ' }), bare)
  })

  it('sends the reply to the learner, marks it done, and moves the numbers', () => {
    const seed = seedDemo()
    const before = loopCounts(seed)
    const next = reduceDemo(seed, { type: 'reply', id: 'wait-maryam', body: '  Yes, Friday.  ' })
    const maryam = next.queue.find((row) => row.id === 'wait-maryam')
    assert.equal(maryam?.done, true)
    assert.equal(maryam?.reply, 'Yes, Friday.')
    assert.equal(loopCounts(next).waiting, before.waiting - 1)
    assert.equal(loopCounts(next).done, before.done + 1)
    assert.equal(loopCounts(next).stuck, before.stuck - 1)
    assert.equal(next.activity[0]?.text, '{teacher} wrote back to Maryam.')
    assert.equal(reduceDemo(next, { type: 'reply', id: 'wait-maryam', body: 'Again' }), next)
    assert.equal(reduceDemo(seed, { type: 'reply', id: 'missing', body: 'Hello' }), seed)
    assert.deepEqual(receiversFor({ type: 'reply', id: 'wait-maryam', body: 'Yes' }), ['learner', 'portal', 'master'])
  })
})

describe('play the loop', () => {
  it('walks every step in plain words', () => {
    assert.equal(LOOP_PLAY.length, 9)
    assert.deepEqual(LOOP_PLAY.map((step) => step.actor), ['master', 'portal', 'teacher', 'teacher', 'learner', 'learner', 'learner', 'teacher', 'portal'])
    for (const step of LOOP_PLAY) {
      assert.equal(loopStepPlays(step.id), true, step.id)
      const packed = step.say.toLowerCase()
      for (const word of JARGON) assert.equal(packed.includes(word), false, word)
    }
    const done = playAll()
    assert.equal(done.courses.some((course) => course.title === LOOP_COURSE), true)
    assert.equal(done.notes.some((note) => note.body === LOOP_NOTE), true)
    assert.equal(learnerPrompts(done).some((prompt) => prompt.text === LOOP_QUESTION), true)
    assert.equal(learnerPrompts(done).some((prompt) => prompt.text === LOOP_WORKBOOK), true)
    const thread = learnerThread(done)
    assert.equal(thread.some((row) => row.body === LOOP_ANSWER && row.done && row.reply === LOOP_REPLY), true)
    assert.equal(thread.some((row) => row.body === LOOP_BOOK_LINE && !row.done), true)
    assert.equal(thread.some((row) => row.body === LOOP_COMMENT && !row.done), true)
    assert.ok(loopCounts(done).courses > loopCounts(seedDemo()).courses)
    assert.ok(loopCounts(done).done > loopCounts(seedDemo()).done)
    assert.ok(stuckRows(done).length > 0)
  })

  it('shares one state over the demo channel', () => {
    const next = reduceDemo(seedDemo(), { type: 'add-course', title: LOOP_COURSE })
    const message = demoChannelMessage(next)
    const current = seedDemo()
    assert.equal(message.channel, DEMO_CHANNEL)
    assert.equal(message.type, 'replace')
    assert.deepEqual(readChannelMessage(current, message), next)
    assert.equal(readChannelMessage(current, { type: 'nope' }), current)
    assert.equal(readChannelMessage(next, null), next)
    assert.equal(readChannelMessage(next, { type: 'replace', state: { courses: 'nope' } }), next)
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
    assert.equal(castFilled(cast), true)
    assert.equal(castFilled({ ...cast, portalName: ' ' }), false)
    const made = rollCast(cast, 'learner', 0)
    assert.equal(made.learner, 'Yusuf')
    assert.equal(made.teacher, cast.teacher)
    const place = rollCast({ ...cast, kind: 'school' }, 'portal', 0)
    assert.equal(place.portalName, 'Willow Academy')
    assert.equal(fillCast('{learner} answered. {teacher} replied at {portal}.', cast), 'Abdallah answered. Sami replied at Al-Noor Mosque.')
  })
})

const MASTER_NAV = ['portals', 'learners', 'diaries', 'codes', 'safety', 'announcements', 'library', 'bring-in', 'packs', 'plans', 'live', 'nights', 'circle', 'missions', 'opening', 'lanes', 'insights', 'trends', 'simulator', 'personas', 'experiments', 'calendar', 'review', 'tiers', 'questions', 'ai', 'framing', 'see-how', 'sheet', 'transcripts', 'create']
const PORTAL_NAV = ['overview', 'teach', 'diaries', 'access', 'feedback', 'safety', 'announcements', 'library', 'content', 'bring-in', 'plans', 'gather', 'nights', 'live', 'circle', 'missions', 'insights', 'compass', 'experiments', 'calendar', 'ai', 'opening', 'questions', 'sheet', 'create', 'settings']
const TEACHER_NAV = ['overview', 'teach', 'diaries', 'feedback', 'compass', 'plans', 'gather', 'nights', 'live', 'safety', 'announcements']

describe('the demo door', () => {
  it('says this is practice data and does not ask for a login', () => {
    assert.equal(DEMO_ENTRY_TITLE.includes('HEARTS Demo stage'), true)
    assert.equal(DEMO_ENTRY_TITLE.includes('master, portal admin, teacher, learner'), true)
    assert.equal(DEMO_ENTRY_TITLE.includes('Practice data only'), true)
    assert.equal(DEMO_ENTRY_TITLE.includes('nothing you do here changes real portals'), true)
    assert.equal(DEMO_ENTRY_START, 'Start the Demo stage')
    const packed = `${DEMO_ENTRY_TITLE} ${DEMO_ENTRY_START}`.toLowerCase()
    assert.equal(packed.includes('password'), false)
    assert.equal(packed.includes('sign in'), false)
  })
})

describe('every left-nav item is covered', () => {
  it('lists the master, portal and teacher menus in the same order as the desks', () => {
    assert.deepEqual(COVERAGE.filter((row) => row.role === 'master').map((row) => row.key), MASTER_NAV)
    assert.deepEqual(COVERAGE.filter((row) => row.role === 'portal').map((row) => row.key), PORTAL_NAV)
    assert.deepEqual(COVERAGE.filter((row) => row.role === 'teacher').map((row) => row.key), TEACHER_NAV)
    assert.equal(COVERAGE.length, MASTER_NAV.length + PORTAL_NAV.length + TEACHER_NAV.length)
  })

  it('makes every works row change the shared place, and gives shown or not-applicable rows a reason', () => {
    for (const row of COVERAGE) {
      if (row.status === 'works') {
        assert.equal(coverageWorks(row), true, `${row.role} ${row.key}`)
        assert.equal(typeof row.make, 'function', row.key)
      } else {
        assert.equal(row.reason.trim().length > 0, true, `${row.role} ${row.key}`)
        assert.equal(row.status === 'shown' || row.status === 'na', true)
      }
    }
    const ai = COVERAGE.filter((row) => row.key === 'ai' || row.key === 'create')
    assert.equal(ai.length, 4)
    assert.equal(ai.every((row) => row.status === 'na'), true)
    const table = coverageMarkdown()
    assert.equal(table.includes('| Master · Library |'), true)
    assert.equal(table.split('\n').length, COVERAGE.length + 2)
  })

  it('sends a learner diary, a feeling and a help ask back up, and a night down to the phone', () => {
    const diary = reduceDemo(seedDemo(), { type: 'add-diary', text: 'I wrote this on the phone.' })
    assert.equal(diary.diary[0]?.text, 'I wrote this on the phone.')
    assert.deepEqual(alertsFor(diary, 'teacher').map((row) => row.text), ['{learner} wrote in the diary.', '3 notes are waiting for a reply.'])
    assert.equal(alertsFor(diary, 'portal')[0]?.text, '{learner} wrote in the diary.')
    assert.equal(alertsFor(diary, 'master')[0]?.text, '{learner} wrote in the diary.')
    assert.equal(diary.activity[0]?.text, '{learner} wrote in the diary.')

    const feeling = reduceDemo(seedDemo(), { type: 'add-compass', text: 'Hopeful' })
    assert.equal(feeling.compass[0]?.text, 'Hopeful')
    assert.equal(alertsFor(feeling, 'teacher')[0]?.text.includes('Hopeful'), true)

    const ask = reduceDemo(seedDemo(), { type: 'add-safety', text: 'Please check on me tonight.' })
    assert.equal(ask.safety[0]?.body, 'Please check on me tonight.')
    assert.equal(alertsFor(ask, 'portal')[0]?.text, '{learner} asked for someone to look today.')

    const night = reduceDemo(seedDemo(), { type: 'add-event', kind: 'calendar', title: 'Open evening' })
    assert.equal(learnerVisible(night).includes('Open evening'), true)
    assert.equal(alertsFor(night, 'learner')[0]?.text, 'Added an event: Open evening.')
    assert.equal(loopCounts(night).courses, loopCounts(seedDemo()).courses)
  })
})
