/** British wipe copy. Counts appear once, with a real singular when the number is 1. */

const PAIR: Record<string, [string, string]> = {
  'watch history': ['watch history entry', 'watch history entries'],
  'parts watched': ['part watched', 'parts watched'],
  'courses made here': ['course made here', 'courses made here'],
  'talks made here': ['talk made here', 'talks made here'],
  'the portal itself': ['the portal itself', 'the portal itself'],
  'compass mix': ['compass mix', 'compass mixes'],
  'garden notes': ['garden note', 'garden notes'],
  'board notes': ['board note', 'board notes'],
  'workbook entries': ['workbook entry', 'workbook entries'],
  'harvest entries': ['harvest entry', 'harvest entries'],
  'night check-ins': ['night check-in', 'night check-ins'],
  'compass check-ins': ['compass check-in', 'compass check-ins'],
  'gather check-ins': ['gather check-in', 'gather check-ins'],
  'access codes': ['access code', 'access codes'],
  'library links': ['library link', 'library links'],
  'course packs': ['course pack', 'course packs'],
  'study plans': ['study plan', 'study plans'],
  'night tickets': ['night ticket', 'night tickets'],
  'gather replies': ['gather reply', 'gather replies'],
  'gather photos': ['gather photo', 'gather photos'],
  'gather reflections': ['gather reflection', 'gather reflections'],
  'opening answers': ['opening answer', 'opening answers'],
  'circle answers': ['circle answer', 'circle answers'],
  'joining answers': ['joining answer', 'joining answers'],
  'teacher notes': ['teacher note', 'teacher notes'],
  'short clip notes': ['short clip note', 'short clip notes'],
  'talk visits': ['talk visit', 'talk visits'],
  'seat visits': ['seat visit', 'seat visits'],
  'trend counts': ['trend count', 'trend counts'],
  'compass suggestions': ['compass suggestion', 'compass suggestions'],
}

function pairFor(label: string): [string, string] {
  const key = label.trim().toLowerCase()
  if (PAIR[key]) return PAIR[key]
  if (key.endsWith(' entries')) return [key.replace(/ entries$/, ' entry'), key]
  if (key.endsWith(' notes')) return [key.replace(/ notes$/, ' note'), key]
  if (key.endsWith(' answers')) return [key.replace(/ answers$/, ' answer'), key]
  if (key.endsWith('ies')) return [key.replace(/ies$/, 'y'), key]
  if (key.endsWith('ses') || key.endsWith('ches') || key.endsWith('xes') || key.endsWith('zes')) return [key.slice(0, -2), key]
  if (key.endsWith('s') && !key.endsWith('ss')) return [key.slice(0, -1), key]
  return [key, key]
}

export function formatCount(n: number, label: string) {
  const [one, many] = pairFor(label)
  return `${n} ${n === 1 ? one : many}`
}

export function wipeIntro(kind: 'portal' | 'user', name: string) {
  if (kind === 'user') {
    return `This wipes everything ${name.trim() || 'this person'} has done on HEARTS. It cannot be undone.`
  }
  return 'This wipes everything this portal has stored on HEARTS. It cannot be undone.'
}
