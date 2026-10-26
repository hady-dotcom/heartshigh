import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { modulesInSheetOrder, parseCourseSheet, sectionGroups } from '../../src/lib/sequence'

const root = new URL('../../', import.meta.url)
const read = (file: string) => readFileSync(new URL(file, root), 'utf8')

test('a master sheet becomes sections of films, with callouts', () => {
  const sheet = [
    'order,module,title,public_title,vimeo_id,vimeo_link,final_video_drive,transcript,callouts',
    '1,Welcome,Internal,Public one,496862893,https://vimeo.com/496862893,,, "[171 freetype] How would you describe it?"',
    '2,Welcome,Next,Public two,496862894,https://vimeo.com/496862894,,, "[end freetype] What will you try?"',
    '3,Practice,Third,Public three,496862895,https://vimeo.com/496862895,,,',
  ].join('\n')
  const parsed = parseCourseSheet(sheet)
  assert.equal(parsed.error, undefined)
  assert.deepEqual(modulesInSheetOrder(parsed.films), ['Welcome', 'Practice'])
  const sections = sectionGroups(parsed.films, (film) => film.module)
  assert.equal(sections.length, 2)
  assert.equal(sections[0].rows.length, 2)
  assert.equal(sections[0].rows[0].item.callouts.length, 1)
  assert.equal(sections[0].rows[1].item.callouts[0].atEnd, true)
  assert.equal(sections[1].rows[0].index, 2)
})

test('the generic course screens reuse Guide Core, and the player is not a plain video page', () => {
  const course = read('src/screens/app/course.tsx')
  const guest = read('src/screens/app/guest-courses.tsx')
  const player = read('src/components/app/course-player.tsx')
  const desk = read('src/server/sequence-desk.ts')
  const agents = readFileSync(new URL('../../../AGENTS.md', import.meta.url), 'utf8')
  assert.match(desk, /modulesInSheetOrder/)
  assert.match(course, /sectionGroups/)
  assert.match(course, /data-testid=\{sequence \? 'sequence-module' : undefined\}/)
  assert.match(course, /sequence-progress/)
  assert.match(course, /sequence-question/)
  assert.match(course, /shareChoice = sequence \|\| Boolean\(user\.shareWithLearners\)/)
  assert.match(course, /garden-prev|prevPart/)
  assert.match(guest, /CoursePlayer/)
  assert.match(guest, /sequence-module/)
  assert.match(guest, /guest/)
  assert.doesNotMatch(guest, /GuestFilmView/)
  assert.match(player, /question-strip/)
  assert.match(player, /answer-share/)
  assert.match(player, /film-share-link/)
  assert.match(player, /rememberGuestAnswer/)
  assert.match(read('src/screens/desk/sequence.tsx'), /teacher-shared-answer/)
  assert.match(agents, /Reuse proven Guide Core behaviour/)
  assert.match(agents, /Never rebuild it/)
})
