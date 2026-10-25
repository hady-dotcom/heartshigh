/**
 * Per-portal feature switches — one registry, one gating helper.
 *
 * Beginner parts are always on and cannot be saved off. Intermediate parts
 * start on and can be switched off one by one. In-depth parts start off and
 * are chosen per portal.
 *
 * A portal with no saved map, or a map from before announcements / calendar /
 * AI steps existed, keeps every part it already had (the old defaults, all on),
 * plus the beginner parts forced on. A map that includes one of those new keys
 * is a new save: missing keys use the new defaults.
 */

export const FEATURE_KEYS = [
  'garden',
  'workbook',
  'planner',
  'announcements',
  'circle',
  'compass',
  'feedback',
  'gather',
  'live',
  'missions',
  'insights',
  'experiments',
  'calendar',
  'ai',
] as const

export type FeatureKey = (typeof FEATURE_KEYS)[number]

export type FeatureDepth = 'beginner' | 'intermediate' | 'in-depth'

export type BarKey = 'home' | 'lanes' | 'gather' | 'week' | 'garden' | 'me'

export type BarItem = {
  key: BarKey
  label: string
  path: string
}

export type FeatureMap = Record<FeatureKey, boolean>

export type FeatureRecord = {
  key: FeatureKey
  name: string
  /** One line: what learners get. */
  what: string
  defaultOn: boolean
  depth: FeatureDepth
  /** Already wired on this branch. */
  shipped: boolean
  dependsOn: FeatureKey[]
  /** Desk “?” copy, two to four short sentences. */
  help: string
  /** Where later PRs call `featureOn`. */
  plugIn: string[]
  deskNav?: string[]
  /** Bar slot, if this feature can occupy one. */
  bar?: { key: BarKey; label: string; path: string; slot: 'middle' | 'garden' }
}

export const FEATURE_UNAVAILABLE = 'This is not available in this portal.'

export const FEATURES: readonly FeatureRecord[] = [
  {
    key: 'garden',
    name: 'Courses',
    what: 'A living picture of what they have watched, sown and harvested.',
    defaultOn: true,
    depth: 'beginner',
    shipped: true,
    dependsOn: [],
    help: 'The Garden shows time someone has given: five trees from the hadith of Jibril (Islam, Iman, Ihsan, the Hour and the Sitting), rings, this course, harvest and the twenty doors. Every portal includes it. Learners can see what they have watched, sown and harvested.',
    plugIn: [
      'Learner /p/:slug/garden and garden/* (except workbook, which is its own switch)',
      'Home grow banner, rings and “See what you have sown”',
      'TabBar garden item via learnerBar()',
    ],
    deskNav: [],
    bar: { key: 'garden', label: 'Courses', path: '/courses', slot: 'garden' },
  },
  {
    key: 'workbook',
    name: 'Workbook',
    what: 'Their answers in one place, to reopen and sit with.',
    defaultOn: true,
    depth: 'beginner',
    shipped: true,
    dependsOn: [],
    help: 'The workbook keeps answers and reflections in one place. Every portal includes it, so a learner can reopen what they wrote. Teachers can open that written work from the desk.',
    plugIn: [
      'Learner /p/:slug/garden/workbook and the Me workbook link',
      'Garden rings Workbook tile',
      'GET /api/workbook and /api/workbook/:learnerId',
      'Teach desk workbook inbox and download',
      'Desk journals list',
    ],
    deskNav: ['diaries'],
  },
  {
    key: 'planner',
    name: 'Study plans',
    what: 'A course spread across the days that suit them.',
    defaultOn: true,
    depth: 'beginner',
    shipped: true,
    dependsOn: [],
    help: 'My week is the study plan. Pick a course, tick the days, and the talks are shared out evenly. It always sits on the learner bar, and Gather never takes its place. Every portal includes it.',
    plugIn: [
      'Learner /p/:slug/week, /me/plan and Home “Your plan” card',
      'Course “Plan the rest of this course”',
      'Desk /admin/plans and handle.ts action schedule',
      'TabBar My week item via learnerBar()',
    ],
    deskNav: ['plans'],
    bar: { key: 'week', label: 'My week', path: '/week', slot: 'middle' },
  },
  {
    key: 'announcements',
    name: 'Announcements',
    what: 'A short note on Home that they can dismiss.',
    defaultOn: true,
    depth: 'beginner',
    shipped: true,
    dependsOn: [],
    help: 'Announcements are short notes on Home, for everyone, for teachers, or for one code. A learner can dismiss a note once they have read it. Every portal includes this.',
    plugIn: [
      'Learner Home announcement cards (src/screens/app/home.tsx)',
      'Desk /admin/announcements and /master/announcements',
      'POST announce and announce-dismiss in safety-actions.ts',
    ],
    deskNav: ['announcements'],
  },
  {
    key: 'circle',
    name: 'Circle answers',
    what: 'Gentle example answers so a question is never empty.',
    defaultOn: true,
    depth: 'intermediate',
    shipped: true,
    dependsOn: [],
    help: 'Circle answers sit beside real shared answers, so the first people in are not staring at a blank page. They never count as progress. The desk writes them and can switch them off.',
    plugIn: [
      'Course player swarm / “What others said”',
      'Portal desk /admin/circle',
      'handle.ts actions that start with circle-',
    ],
    deskNav: ['circle'],
  },
  {
    key: 'compass',
    name: 'Compass',
    what: 'A monthly look at how they are doing, in plain words only.',
    defaultOn: true,
    depth: 'intermediate',
    shipped: true,
    dependsOn: [],
    help: 'Compass is a gentle check-in once a month. Learners never see a number, only a line about what to focus on. Teachers see the detail on the desk.',
    plugIn: [
      'Learner /p/:slug/recalibrate and /me/path',
      'Home recalibrate card',
      'Desk /admin/compass',
      'GET/POST /api/compass',
    ],
    deskNav: ['compass'],
  },
  {
    key: 'feedback',
    name: 'Teacher replies and feedback',
    what: 'Notes from their teacher on shared answers and in a film.',
    defaultOn: true,
    depth: 'intermediate',
    shipped: true,
    dependsOn: [],
    help: 'When a learner shares an answer, a teacher can reply or leave a mark on the film. Switch this off if people study on their own. Private answers stay private either way.',
    plugIn: [
      'Learner in-video feedback on the course page and workbook replies',
      'Desk /admin/feedback and Teach reply forms',
      'GET/POST /api/feedback and handle.ts actions reply, feedback',
    ],
    deskNav: ['feedback'],
  },
  {
    key: 'gather',
    name: 'Gather',
    what: 'In-person nights and meetups, with check-in and tickets.',
    defaultOn: false,
    depth: 'in-depth',
    shipped: true,
    dependsOn: [],
    help: 'Gather is for evenings at the masjid: classes, circles and open nights. Learners say if they are coming, and the desk takes the register. Leave it off if this group never meets in person.',
    plugIn: [
      'Learner /p/:slug/gather and public /gather/:event',
      'Home gather cards, course gather notices, nights on Circle',
      'Desk /admin/gather, /admin/nights',
      'POST/GET /api/gather and handle.ts rsvp, checkin',
      'Learner /p/:slug/gather, a Gather link on Home and on Lanes — never the learner tab bar',
    ],
    deskNav: ['gather', 'nights'],
    bar: { key: 'gather', label: 'Gather', path: '/gather', slot: 'middle' },
  },
  {
    key: 'live',
    name: 'Live recordings',
    what: 'Video sessions for this portal, with a Live now banner on Home.',
    defaultOn: false,
    depth: 'in-depth',
    shipped: true,
    dependsOn: [],
    help: 'Live recordings are video sessions for this portal. Learners see a Live now banner under the Home title while one is on. Switch it off to hide the banner, the watch page and the desk tools.',
    plugIn: [
      'PR #20 — Learner Home Live now / Coming up banner (src/screens/app/home.tsx)',
      'Learner live page /p/:slug/live and watch page /p/:slug/live/:id',
      'PR #20 — Desk Live recordings /admin/live and /master/live',
      'PR #20 — GET/POST /api/live (src/app/(frontend)/api/live/route.ts)',
    ],
    deskNav: ['live'],
  },
  {
    key: 'missions',
    name: 'Help shape HEARTS missions',
    what: 'A quiet way to say which missions HEARTS should take on next.',
    defaultOn: false,
    depth: 'in-depth',
    shipped: true,
    dependsOn: [],
    help: 'Missions let people help choose what HEARTS works on next. Turning it off hides the card learners see, and the tools on the desk.',
    plugIn: [
      'PR #27 — Learner missions surfaces (Home / Me card and /p/:slug/missions)',
      'PR #27 — Master desk /master/missions',
      'PR #27 — GET/POST /api/missions (src/app/(frontend)/api/missions/route.ts)',
    ],
    deskNav: ['missions'],
  },
  {
    key: 'insights',
    name: 'Insights',
    what: 'A calm picture of how the portal is being used, without names.',
    defaultOn: false,
    depth: 'in-depth',
    shipped: true,
    dependsOn: [],
    help: 'Insights are counts for the portal team. A learner’s name is never shown. The switch hides the desk tools.',
    plugIn: [
      'PR #27 — Desk /admin/insights and /master/insights',
      'PR #27 — GET/POST /api/insights (src/app/(frontend)/api/insights/route.ts)',
    ],
    deskNav: ['insights'],
  },
  {
    key: 'experiments',
    name: 'Experiments',
    what: 'Quiet wording tests. Learners are never told they are in one.',
    defaultOn: false,
    depth: 'in-depth',
    shipped: true,
    dependsOn: [],
    help: 'Experiments try two wordings of a button or a label. Learners never see that they are in a test. Only the master desk starts one, and a portal can switch the whole thing off.',
    plugIn: [
      'PR #22 — useVariant / track() in the learner app (src/lib/use-variant.ts, experiment-track.ts)',
      'PR #22 — Desk /master/experiments and portal results',
      'PR #22 — GET/POST /api/experiments (src/app/(frontend)/api/experiments/route.ts)',
    ],
    deskNav: ['experiments'],
  },
  {
    key: 'calendar',
    name: 'Event Calendar',
    what: 'Special days, and the words that go with them.',
    defaultOn: false,
    depth: 'in-depth',
    shipped: true,
    dependsOn: [],
    help: 'Event Calendar is for special days: Friday, Ramadan, the Eids and seasons you add. A suggested line never reaches a learner until you approve it. Switch it on when this portal wants its own calendar desk.',
    plugIn: [
      'Portal desk /admin/calendar',
      'Master desk /master/calendar stays available to the master',
      'GET/POST /api/calendar',
    ],
    deskNav: ['calendar'],
  },
  {
    key: 'ai',
    name: 'AI steps',
    what: 'The steps this portal can run when it uses its own AI.',
    defaultOn: false,
    depth: 'in-depth',
    shipped: true,
    dependsOn: [],
    help: 'AI steps are the instructions this portal can run when its own AI account is connected. The list lives on the desk, and learners do not see it. Switch it on when this portal should edit those steps.',
    plugIn: [
      'Portal desk /admin/ai',
      'Master desk /master/ai stays available to the master',
      'POST /api/ai-steps',
    ],
    deskNav: ['ai'],
  },
] as const

export const DEPTH_ORDER: FeatureDepth[] = ['beginner', 'intermediate', 'in-depth']

/** Plain names for the three groups in the portal studio. */
export const DEPTH_SECTION: Record<FeatureDepth, { title: string; line: string }> = {
  beginner: {
    title: 'Always included',
    line: 'These stay on. You cannot switch them off.',
  },
  intermediate: {
    title: 'On unless you switch it off',
    line: 'These start on. Switch one off if you do not need it.',
  },
  'in-depth': {
    title: 'Extras you choose',
    line: 'These start off. Switch one on if you want it.',
  },
}

export const DEPTH_LABEL: Record<FeatureDepth, string> = {
  beginner: DEPTH_SECTION.beginner.title,
  intermediate: DEPTH_SECTION.intermediate.title,
  'in-depth': DEPTH_SECTION['in-depth'].title,
}

/** Keys added with this change. A saved map that contains one of them is a new save. */
const NEW_FEATURE_KEYS = ['announcements', 'calendar', 'ai'] as const

export const PRESETS = {
  standard: {
    key: 'standard' as const,
    label: 'Standard',
    hint: 'The usual set: the parts that stay on, plus the ones that start on.',
    keys: ['garden', 'workbook', 'planner', 'announcements', 'circle', 'compass', 'feedback'] as readonly FeatureKey[],
  },
  everything: {
    key: 'everything' as const,
    label: 'Everything',
    hint: 'Every part on this list, switched on.',
    keys: FEATURE_KEYS,
  },
} as const

export type PresetKey = keyof typeof PRESETS

export const ALWAYS_BAR: BarItem[] = [
  { key: 'home', label: 'Home', path: '' },
  { key: 'lanes', label: 'Lanes', path: '/lanes' },
]

export const ME_BAR: BarItem = { key: 'me', label: 'Me', path: '/me' }

export function featureByKey(key: string): FeatureRecord | undefined {
  return FEATURES.find((row) => row.key === key)
}

/** Beginner parts stay on. The studio cannot switch them off, and a save cannot either. */
export function featureLocked(key: FeatureKey): boolean {
  return featureByKey(key)?.depth === 'beginner'
}

export function lockBeginner(map: FeatureMap): FeatureMap {
  const next = { ...map }
  for (const feature of FEATURES) {
    if (feature.depth === 'beginner') next[feature.key] = true
  }
  return next
}

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === 'string' && (FEATURE_KEYS as readonly string[]).includes(value)
}

export function defaultFeatures(): FeatureMap {
  return Object.fromEntries(FEATURES.map((row) => [row.key, row.defaultOn])) as FeatureMap
}

export function presetFeatures(preset: PresetKey): FeatureMap {
  const chosen = new Set<FeatureKey>(PRESETS[preset].keys)
  return lockBeginner(Object.fromEntries(FEATURE_KEYS.map((key) => [key, chosen.has(key)])) as FeatureMap)
}

/**
 * A save from before this change, or an empty column.
 * Missing keys stay on, because that is what the portal has today.
 * Beginner parts are forced on even if an older save turned them off.
 */
export function isLegacyFeatureRecord(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return true
  const input = raw as Record<string, unknown>
  return !NEW_FEATURE_KEYS.some((key) => key in input)
}

export function legacyPortalFeatures(raw?: unknown): FeatureMap {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const map = Object.fromEntries(
    FEATURE_KEYS.map((key) => [key, typeof input[key] === 'boolean' ? input[key] : true]),
  ) as FeatureMap
  return lockBeginner(map)
}

/**
 * Read stored JSON into a full map.
 * Empty or pre-change maps keep the parts a portal already has.
 * A new save fills gaps from the current defaults, then forces beginner on.
 */
export function parseFeatures(raw: unknown): FeatureMap {
  if (isLegacyFeatureRecord(raw)) return legacyPortalFeatures(raw)
  const base = defaultFeatures()
  const input = raw as Record<string, unknown>
  for (const key of FEATURE_KEYS) {
    if (typeof input[key] === 'boolean') base[key] = input[key]
  }
  return lockBeginner(base)
}

export type FeatureSource = { features?: unknown; shape?: string | null } | null | undefined

/**
 * A sequenced course stores each switch as saved. Missing switches are off.
 * Beginner parts are not forced on, so a clean course can start with them off.
 */
export function sequenceFeatureMap(raw: unknown): FeatureMap {
  const map = Object.fromEntries(FEATURE_KEYS.map((key) => [key, false])) as FeatureMap
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return map
  const input = raw as Record<string, unknown>
  for (const key of FEATURE_KEYS) {
    if (typeof input[key] === 'boolean') map[key] = input[key]
  }
  return map
}

export function featuresOf(portal: FeatureSource): FeatureMap {
  if (portal && typeof portal === 'object' && portal.shape === 'sequence') return sequenceFeatureMap(portal.features)
  return parseFeatures(portal?.features)
}

/**
 * The one place a feature should ask “is this on?”.
 * A feature whose dependency is off is treated as off.
 */
export function featureOn(portal: FeatureSource, key: FeatureKey): boolean {
  const map = featuresOf(portal)
  const feature = featureByKey(key)
  if (!feature) return false
  if (!map[key]) return false
  return feature.dependsOn.every((dep) => featureOn(portal, dep))
}

export function featuresFromForm(form: FormData, field = 'feature'): FeatureMap {
  const on = new Set(form.getAll(field).map(String).filter(isFeatureKey))
  return lockBeginner(Object.fromEntries(FEATURE_KEYS.map((key) => [key, on.has(key)])) as FeatureMap)
}

/**
 * Bottom bar. Always Home · Lanes · My week · Courses · Me.
 * Gather must never replace My week on the learner bar.
 */
export function learnerBar(_portal: FeatureSource): BarItem[] {
  return [
    { key: 'home', label: 'Home', path: '' },
    { key: 'lanes', label: 'Lanes', path: '/lanes' },
    { key: 'week', label: 'My week', path: '/week' },
    { key: 'garden', label: 'Courses', path: '/courses' },
    { key: 'me', label: 'Me', path: '/me' },
  ]
}

export function deskNavAllowed(portal: FeatureSource, navKey: string): boolean {
  const owner = FEATURES.find((row) => row.deskNav?.includes(navKey))
  if (!owner) return true
  return featureOn(portal, owner.key)
}

export function matchingPreset(map: FeatureMap): PresetKey | null {
  for (const key of Object.keys(PRESETS) as PresetKey[]) {
    const want = presetFeatures(key)
    if (FEATURE_KEYS.every((item) => want[item] === map[item])) return key
  }
  return null
}

export function featuresEqual(a: FeatureMap, b: FeatureMap) {
  return FEATURE_KEYS.every((key) => a[key] === b[key])
}

export function withDependencyClosure(map: FeatureMap): FeatureMap {
  const next = { ...map }
  let changed = true
  while (changed) {
    changed = false
    for (const feature of FEATURES) {
      if (!next[feature.key]) continue
      for (const dep of feature.dependsOn) {
        if (!next[dep]) {
          next[dep] = true
          changed = true
        }
      }
    }
  }
  return next
}

export function unavailableCopy(key?: FeatureKey) {
  const feature = key ? featureByKey(key) : undefined
  return {
    title: 'Not available in this portal',
    body: feature
      ? `${feature.name} is not switched on here.`
      : FEATURE_UNAVAILABLE,
  }
}
