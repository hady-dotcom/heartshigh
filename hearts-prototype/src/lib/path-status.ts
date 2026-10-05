/** Plain-words progress, only when a real count backs it. */

export type PathCounts = {
  talks: number
  talksThisWeek: number
  doors: number
  readings: number
  lines: number
  answers: number
  minutes: number
}

export type PathCard = { title: string; reason: string }

export function pathCards(counts: PathCounts): PathCard[] {
  const cards: PathCard[] = []
  if (counts.talksThisWeek > 0) {
    cards.push({
      title: 'Growing',
      reason: `Growing: you have watched ${counts.talksThisWeek} talk${counts.talksThisWeek === 1 ? '' : 's'} this week.`,
    })
  }
  if (counts.talks === 0 && counts.answers === 0 && counts.lines === 0 && counts.readings === 0) {
    return [{ title: 'Just starting', reason: 'Just starting: a first full talk will begin the path.' }]
  }
  if (counts.doors > 0) {
    cards.push({
      title: 'Doors',
      reason: `Doors: ${counts.doors} door${counts.doors === 1 ? '' : 's'} have a finished talk in them.`,
    })
  }
  if (counts.answers > 0) {
    cards.push({
      title: 'Answers',
      reason: `Answers: you have sat with ${counts.answers} question${counts.answers === 1 ? '' : 's'}.`,
    })
  }
  if (counts.lines > 0) {
    cards.push({
      title: 'Lines kept',
      reason: `Lines kept: ${counts.lines} verse${counts.lines === 1 ? '' : 's'}, hadith or saying.`,
    })
  }
  if (!cards.length) {
    cards.push({
      title: 'Habits',
      reason: 'Habits: a few minutes this week will help.',
    })
  }
  return cards
}

export function minutesLabel(minutes: number) {
  if (!minutes) return '0 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}
