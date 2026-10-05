import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  APPETISER_TARGET_MINUTES,
  HORS_TARGET_MINUTES,
  arcOfHors,
  attachHorsToAppetisers,
  densityReport,
  densityTargets,
  expandTalkExtracts,
  extractKindFromSheet,
  extractParents,
  extractStatusFromSheet,
  extractsFromTier,
  groupExtractSummary,
  horsInsideAppetiser,
  nestForTimeline,
  nudgeBySentence,
  sameTypeOverlapProblem,
  timeInTalkProblem,
  verbatimProblem,
  windowInside,
  kineticExtractLine,
  neighborSuggested,
  parseExtractStatus,
  reviewAfterDecision,
  suggestedQueue,
  withExtractParam,
  withoutBackToBackExtract,
  type TalkExtract,
} from './extracts'

function extract(partial: Partial<TalkExtract> & Pick<TalkExtract, 'kind' | 'start' | 'end'>): TalkExtract {
  return {
    lesson: 1,
    quote: '',
    status: 'approved',
    order: 1,
    parent: null,
    arc: null,
    ...partial,
  }
}

test('a 60 minute talk wants about 10 hors d\'oeuvres and 4 appetisers', () => {
  const targets = densityTargets(3600)
  assert.equal(HORS_TARGET_MINUTES, 6)
  assert.equal(APPETISER_TARGET_MINUTES, 15)
  assert.equal(targets.hors, 10)
  assert.equal(targets.appetiser, 4)
})

test('density counts approved extracts against the target and keeps suggested separate', () => {
  const extracts = [
    extract({ id: 1, kind: 'appetiser', start: 0, end: 90, status: 'approved' }),
    extract({ id: 2, kind: 'hors', start: 10, end: 30, status: 'approved' }),
    extract({ id: 3, kind: 'hors', start: 40, end: 60, status: 'draft' }),
    extract({ id: 4, kind: 'appetiser', start: 200, end: 290, status: 'rejected' }),
    extract({ id: 5, kind: 'hors', start: 70, end: 88, status: 'suggested' }),
    extract({ id: 6, kind: 'appetiser', start: 300, end: 390, status: 'suggested' }),
  ]
  const report = densityReport(3600, extracts)
  assert.equal(report.hors, 1)
  assert.equal(report.appetiser, 1)
  assert.equal(report.horsDraft, 1)
  assert.equal(report.horsSuggested, 1)
  assert.equal(report.appetiserSuggested, 1)
  assert.equal(report.horsMet, false)
  assert.equal(report.appetiserMet, false)
})

test('a hors whose window sits inside an appetiser is attached and marked on the arc', () => {
  const appetiser = extract({ id: 10, kind: 'appetiser', start: 100, end: 250, hook: 'Hook', turn: 'Turn', land: 'Land' })
  const hookHors = extract({ id: 11, kind: 'hors', start: 105, end: 125 })
  const landHors = extract({ id: 12, kind: 'hors', start: 220, end: 240 })
  const stray = extract({ id: 13, kind: 'hors', start: 400, end: 420 })
  const linked = attachHorsToAppetisers([appetiser, hookHors, landHors, stray])
  assert.equal(linked.find((row) => row.id === 11)?.parent, 10)
  assert.equal(linked.find((row) => row.id === 11)?.arc, 'hook')
  assert.equal(linked.find((row) => row.id === 12)?.parent, 10)
  assert.equal(linked.find((row) => row.id === 12)?.arc, 'land')
  assert.equal(linked.find((row) => row.id === 13)?.parent, null)
  assert.equal(horsInsideAppetiser(appetiser, linked).length, 2)
})

test('the tightest appetiser wins when two windows could hold a hors', () => {
  const wide = extract({ id: 1, kind: 'appetiser', start: 0, end: 400 })
  const tight = extract({ id: 2, kind: 'appetiser', start: 80, end: 160 })
  const hors = extract({ id: 3, kind: 'hors', start: 90, end: 110 })
  const linked = attachHorsToAppetisers([wide, tight, hors])
  assert.equal(linked.find((row) => row.id === 3)?.parent, 2)
})

test('a named parent is kept when it still holds the hors', () => {
  const wide = extract({ id: 1, kind: 'appetiser', start: 0, end: 400 })
  const tight = extract({ id: 2, kind: 'appetiser', start: 80, end: 160 })
  const hors = extract({ id: 3, kind: 'hors', start: 90, end: 110, parent: 1, arc: 'turn' })
  const linked = attachHorsToAppetisers([wide, tight, hors])
  assert.equal(linked.find((row) => row.id === 3)?.parent, 1)
  assert.equal(linked.find((row) => row.id === 3)?.arc, 'turn')
})

test('arc uses hook, turn and land spans when they are given', () => {
  const spans = [
    { role: 'hook' as const, start: 10, end: 40 },
    { role: 'turn' as const, start: 80, end: 110 },
    { role: 'land' as const, start: 140, end: 170 },
  ]
  assert.equal(arcOfHors({ start: 85, end: 105 }, { start: 10, end: 170 }, spans), 'turn')
})

test('same type extracts may not overlap; hors and appetiser may share a stretch', () => {
  const hors = [
    extract({ kind: 'hors', start: 10, end: 30 }),
    extract({ kind: 'hors', start: 25, end: 45 }),
  ]
  assert.match(sameTypeOverlapProblem(hors) || '', /hors/)
  const mixed = [extract({ kind: 'hors', start: 10, end: 30 }), extract({ kind: 'appetiser', start: 10, end: 120 })]
  assert.equal(sameTypeOverlapProblem(mixed), null)
  assert.equal(sameTypeOverlapProblem([extract({ kind: 'hors', start: 10, end: 30, status: 'rejected' }), extract({ kind: 'hors', start: 20, end: 40 })]), null)
})

test('times must sit inside the talk', () => {
  assert.equal(timeInTalkProblem({ start: 10, end: 30 }, 600), null)
  assert.match(timeInTalkProblem({ start: 10, end: 8 }, 600) || '', /end after/)
  assert.match(timeInTalkProblem({ start: 590, end: 620 }, 600) || '', /after the talk/)
})

test('the old single pair becomes two extracts with the hors inside the appetiser', () => {
  const [appetiser, hors] = extractsFromTier({
    lesson: 7,
    horsStart: 20,
    horsEnd: 40,
    horsQuote: 'A short line.',
    horsLines: [{ at: 20, text: 'A short line.' }],
    appetiserStart: 10,
    appetiserEnd: 160,
    hook: 'Hook',
    turn: 'Turn',
    land: 'Land',
    status: 'checked',
  })
  assert.equal(appetiser.kind, 'appetiser')
  assert.equal(appetiser.status, 'approved')
  assert.equal(hors.kind, 'hors')
  assert.equal(hors.quote, 'A short line.')
  assert.equal(hors.arc, 'hook')
  assert.ok(windowInside(hors, appetiser))
  const [draftAppetiser] = extractsFromTier({
    lesson: 7,
    horsStart: 20,
    horsEnd: 40,
    appetiserStart: 10,
    appetiserEnd: 160,
    status: 'draft',
  })
  assert.equal(draftAppetiser.status, 'suggested')
})

test('learn more parents name the parent appetiser, then the talk', () => {
  const appetiser = extract({ id: 4, kind: 'appetiser', start: 10, end: 160 })
  const hors = extract({ id: 5, kind: 'hors', start: 20, end: 40, parent: 4 })
  const parents = extractParents(hors, appetiser, 9)
  assert.equal(parents.hors.parentId, 'appetiser:4')
  assert.equal(parents.hors.parentLevel, 'appetiser')
  assert.equal(parents.appetiser.parentId, 'talk:9')
  assert.equal(parents.appetiser.parentLevel, 'talk')
})

test('the timeline nests hors under their appetiser and notes an empty one without treating it as an error', () => {
  const nest = nestForTimeline([
    extract({ id: 1, kind: 'appetiser', start: 0, end: 90 }),
    extract({ id: 2, kind: 'hors', start: 10, end: 30, parent: 1 }),
    extract({ id: 3, kind: 'appetiser', start: 200, end: 290 }),
    extract({ id: 4, kind: 'hors', start: 400, end: 420 }),
  ])
  assert.equal(nest.groups[0].hors.length, 1)
  assert.equal(nest.groups[1].empty, true)
  assert.equal(nest.orphans.length, 1)
  assert.match(groupExtractSummary(nest.groups, nest.orphans), /no hors d'oeuvre yet/)
})

test('a nudge moves the edge by one sentence', () => {
  const sentences = [
    { start: 10, end: 18 },
    { start: 20, end: 28 },
    { start: 32, end: 40 },
  ]
  const hors = extract({ kind: 'hors', start: 20, end: 28 })
  const earlier = nudgeBySentence(hors, sentences, 'start', -1)
  assert.equal(earlier?.start, 10)
  const later = nudgeBySentence(hors, sentences, 'end', 1)
  assert.equal(later?.end, 40)
  assert.equal(nudgeBySentence(extract({ kind: 'hors', start: 10, end: 18 }), sentences, 'start', -1), null)
})

test('the feed does not repeat the same extract back to back', () => {
  const items = withoutBackToBackExtract([
    { id: 'a', extractId: 1 },
    { id: 'b', extractId: 1 },
    { id: 'c', extractId: 2 },
    { id: 'd', extractId: 1 },
  ])
  assert.deepEqual(items.map((row) => row.extractId), [1, 2, 1])
})

test('sheet kinds and statuses fold into hors, appetiser, draft, suggested, approved or rejected', () => {
  assert.equal(extractKindFromSheet("hors d'oeuvre"), 'hors')
  assert.equal(extractKindFromSheet('appetizer'), 'appetiser')
  assert.equal(extractKindFromSheet('hook'), null)
  assert.equal(extractStatusFromSheet('live'), 'approved')
  assert.equal(extractStatusFromSheet('checked'), 'approved')
  assert.equal(extractStatusFromSheet('draft'), 'draft')
  assert.equal(extractStatusFromSheet('pass'), 'suggested')
  assert.equal(extractStatusFromSheet('ai'), 'suggested')
  assert.equal(extractStatusFromSheet('suggested'), 'suggested')
  assert.equal(parseExtractStatus('suggested'), 'suggested')
  assert.equal(parseExtractStatus(''), 'draft')
})

test('verbatim text must be the speaker\'s words', () => {
  const source = 'The one who nurtures you from one stage to the next stage.'
  assert.equal(verbatimProblem('The one who nurtures you from one stage to the next stage.', source), null)
  assert.match(verbatimProblem('A title we wrote ourselves', source) || '', /speaker's words/)
})

test('the talk extracts migration copies the old pair and points the hors at its appetiser', async () => {
  const { readFileSync } = await import('node:fs')
  const { fileURLToPath } = await import('node:url')
  const src = readFileSync(fileURLToPath(new URL('../migrations/20261004_233000_talk_extracts.ts', import.meta.url)), 'utf8')
  assert.match(src, /CREATE TABLE IF NOT EXISTS "talk_extracts"/)
  assert.match(src, /parent_id/)
  assert.match(src, /INSERT INTO "talk_extracts"/)
  assert.match(src, /FROM "talk_tiers"/)
  assert.match(src, /a\."id"/)
  assert.match(src, /enum_talk_extracts_arc/)
  assert.match(src, /'draft', 'suggested', 'approved', 'rejected'/)
})

test('a talk with one hors stays one feed item; several hors expand', () => {
  const appetiser = extract({ id: 10, kind: 'appetiser', start: 0, end: 180, hook: 'Hook', turn: 'Turn', land: 'Land' })
  const one = {
    id: 'cut-1',
    lessonId: 1,
    extractId: null as number | null,
    extracts: [appetiser, extract({ id: 11, kind: 'hors', start: 10, end: 30, parent: 10, quote: 'A line.' })],
    hors: { start: 10, end: 30, quote: 'A line.', lines: undefined as { at: number; text: string }[] | undefined },
    appetiser: { start: 0, end: 180, quote: 'Land' },
    hook: 'Hook',
    turn: 'Turn',
    land: 'Land',
    parents: extractParents(extract({ id: 11, kind: 'hors', start: 10, end: 30, parent: 10 }), appetiser, 1),
  }
  assert.equal(expandTalkExtracts(one).length, 1)
  assert.equal(expandTalkExtracts(one)[0].id, 'cut-1')
  assert.equal(expandTalkExtracts(one)[0].extractId, 11)
  assert.equal(expandTalkExtracts({ ...one, extractId: 11 })[0].extractId, 11)
  const many = {
    ...one,
    extracts: [
      appetiser,
      extract({ id: 11, kind: 'hors', start: 10, end: 30, parent: 10, quote: 'Hook line.', words: [{ at: 10, text: 'Hook line.' }] }),
      extract({ id: 12, kind: 'hors', start: 150, end: 170, parent: 10, quote: 'Land line.' }),
    ],
  }
  const expanded = expandTalkExtracts(many)
  assert.equal(expanded.length, 2)
  assert.equal(expanded[0].extractId, 11)
  assert.equal(expanded[0].parents.hors.parentId, 'appetiser:10')
  assert.equal(expanded[1].extractId, 12)
  assert.equal(expanded[1].hors.quote, 'Land line.')
  assert.equal(expanded[0].hors.lines?.[0]?.text, 'Hook line.')
  assert.equal(expanded[1].hors.lines, undefined)
  assert.equal(expandTalkExtracts({ ...many, extractId: 11 }).length, 2)
})

test('kinetic extract lines drop a repeated word and a false start next to its restart', () => {
  const said = "You're not You're not the uncle doing parking duty."
  assert.equal(kineticExtractLine(said), "You're not the uncle doing parking duty.")
  assert.equal(kineticExtractLine('the the uncle'), 'the uncle')
  assert.equal(kineticExtractLine('You You ever put in a dozen'), 'You ever put in a dozen')
  assert.equal(kineticExtractLine('A clear line.'), 'A clear line.')
  assert.equal(said, "You're not You're not the uncle doing parking duty.")
})

test('suggested hors stay off the learner feed until they are approved', () => {
  const appetiser = extract({ id: 10, kind: 'appetiser', start: 0, end: 180, status: 'suggested' })
  const item = {
    id: 'cut-1',
    lessonId: 1,
    extractId: null as number | null,
    extracts: [
      appetiser,
      extract({ id: 11, kind: 'hors', start: 10, end: 30, parent: 10, status: 'suggested', quote: 'A line.' }),
      extract({ id: 12, kind: 'hors', start: 150, end: 170, parent: 10, status: 'approved', quote: 'Land line.' }),
    ],
    hors: { start: 10, end: 30, quote: 'A line.', lines: undefined as { at: number; text: string }[] | undefined },
    appetiser: { start: 0, end: 180, quote: 'Land' },
    hook: 'Hook',
    turn: 'Turn',
    land: 'Land',
    parents: extractParents(extract({ id: 11, kind: 'hors', start: 10, end: 30, parent: 10 }), appetiser, 1),
  }
  const shown = expandTalkExtracts(item)
  assert.equal(shown.length, 1)
  assert.equal(shown[0].extractId, 12)
  assert.equal(shown[0].id, 'cut-1')
})

test('the review queue walks suggested picks and skips the one just decided', () => {
  const rows = [
    extract({ id: 1, kind: 'hors', start: 10, end: 20, status: 'suggested' }),
    extract({ id: 2, kind: 'hors', start: 40, end: 50, status: 'approved' }),
    extract({ id: 3, kind: 'hors', start: 70, end: 80, status: 'suggested' }),
  ]
  assert.deepEqual(suggestedQueue(rows).map((row) => row.id), [1, 3])
  assert.equal(neighborSuggested(rows, 1, 1), 3)
  assert.equal(neighborSuggested(rows, 3, -1), 1)
  assert.equal(neighborSuggested(rows, 3, 1), null)
  assert.equal(reviewAfterDecision(rows, 1), 3)
  assert.equal(reviewAfterDecision(rows, 3), 1)
  assert.equal(withExtractParam('/master/library/4?part=9', 3), '/master/library/4?part=9&extract=3')
  assert.equal(withExtractParam('/master/library/4?part=9&extract=1', null), '/master/library/4?part=9')
})
