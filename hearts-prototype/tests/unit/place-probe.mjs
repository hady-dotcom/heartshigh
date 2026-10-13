import { loadPlaceCatalogue, scoreBringInTalk } from '../../src/lib/bring-in-place.ts'

const cat = loadPlaceCatalogue()
function vtt(rows) {
  return ['WEBVTT', '', ...rows.map(([s, e, t]) => `${s} --> ${e}\n${t}\n`)].join('\n')
}
const brief = vtt([
  ['00:00:00.000', '00:10:00.000', 'We bought bread and apples at the market for supper'],
  ['00:10:00.000', '00:10:30.000', 'Then someone mentioned zakat'],
])
console.log('BRIEF', JSON.stringify(scoreBringInTalk(brief, cat), null, 2))

const tie = vtt([
  ['00:00:00.000', '00:05:00.000', 'Establish the prayer and keep the five daily prayers'],
  ['00:05:00.000', '00:10:00.000', 'Fasting beyond Ramadan and fasting Ramadan through the month'],
])
console.log('TIE', JSON.stringify(scoreBringInTalk(tie, cat), null, 2))

const weight = vtt([
  ['00:00:00.000', '00:09:00.000', 'The five daily prayers and establish the prayer'],
  ['00:09:00.000', '00:09:30.000', 'Fasting beyond Ramadan'],
])
console.log('WEIGHT', JSON.stringify(scoreBringInTalk(weight, cat), null, 2))
