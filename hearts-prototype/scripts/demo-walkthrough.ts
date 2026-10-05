import { getPayload } from 'payload'
import config from '../src/payload.config'
import { DEFAULT_WALKTHROUGH_PASSWORD, WALKTHROUGH_LEARNER_EMAIL } from '../src/lib/walkthrough-demo'
import { seedWalkthroughDemo } from '../src/seed/walkthrough-demo'

function countLine(label: string, created: Record<string, number>, reused: Record<string, number>) {
  const add = created[label] || 0
  const keep = reused[label] || 0
  if (!add && !keep) return null
  return `  ${label}: ${add} added, ${keep} already there`
}

const payload = await getPayload({ config })
const result = await seedWalkthroughDemo(payload)
if (!result.ok) {
  console.error(result.reason)
  process.exit(1)
}

console.log(`Walkthrough fill on /p/${result.portal}. Additive only. Other portals were left alone.`)
console.log(`Learner join path: ${result.joinPath}`)
console.log(`Named account: ${result.learnerEmail}`)
if (result.createdLearner && result.password) {
  console.log(`New password for ${result.learnerEmail}: ${result.password}`)
} else {
  console.log(`Password for ${WALKTHROUGH_LEARNER_EMAIL} was left as it is. If this run created it earlier, it was ${DEFAULT_WALKTHROUGH_PASSWORD} unless HEARTS_DEMO_WALKTHROUGH_PASSWORD was set.`)
}
if (result.alsoFilled.length) console.log(`Also filled: ${result.alsoFilled.join(', ')}`)
if (result.courses.length) {
  console.log('Talks marked on the walkthrough account:')
  for (const course of result.courses) console.log(`  ${course.percent}% · ${course.title}`)
} else {
  console.log('No matching talks were found. Run npm run seed:starters first, then run this again.')
}
for (const line of Object.keys({ ...result.created, ...result.reused }).sort().map((key) => countLine(key, result.created, result.reused))) {
  if (line) console.log(line)
}
for (const note of result.notes) console.log(note)
process.exit(0)
