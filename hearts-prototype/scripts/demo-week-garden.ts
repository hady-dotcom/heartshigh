import { getPayload } from 'payload'
import config from '../src/payload.config'
import { DEMO_WALK_EMAIL, DEMO_WALK_PORTAL, demoWeekGardenGuard } from '../src/lib/demo-week'
import { seedDemoWeekGarden } from '../src/seed/demo-week-garden'

const guard = demoWeekGardenGuard()
if (guard) {
  console.error(guard)
  process.exit(1)
}

const email = process.argv.includes('--email') ? process.argv[process.argv.indexOf('--email') + 1] : DEMO_WALK_EMAIL
const portalSlug = process.argv.includes('--portal') ? process.argv[process.argv.indexOf('--portal') + 1] : DEMO_WALK_PORTAL
const payload = await getPayload({ config })
const result = await seedDemoWeekGarden(payload, { email, portalSlug })
if (!result.ok) {
  console.error(result.reason)
  process.exit(1)
}
console.log(`Afternoon walk on /p/${result.portal} for ${result.email}: ${result.slots} talks across the week, ${result.talks} garden talks, ${result.completions} new parts watched, ${result.answers} new answers. Nothing else was wiped.`)
process.exit(0)
