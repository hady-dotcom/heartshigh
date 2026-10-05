/**
 * Per-portal feature switches — one registry, one gating helper.
 *
 * Missing or null `portal.features` means “use each feature’s default”.
 * Features that already exist on live default ON, so existing portals do not
 * change when this lands. Unmerged work (Live, missions, insights, experiments)
 * is listed here with exact plug-in points; those branches add one
 * `featureOn(portal, key)` check each.
 */

export const FEATURE_KEYS = [
  'garden',
  'workbook',
  'circle',
  'planner',
  'compass',
  'feedback',
  'gather',
  'live',
  'missions',
  'insights',
  'experiments',
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
    name: 'Garden',
    what: 'A living picture of what they have watched, sown and harvested.',
    defaultOn: true,
    depth: 'beginner',
    shipped: true,
    dependsOn: [],
    help: 'The Garden is where growth shows: rings, the course path, harvest and the doors of Hadith Jibril. Switch it off if this portal is only for films and questions. The bottom bar still looks complete without it.',
    plugIn: [
      'Learner /p/:slug/garden and garden/* (except workbook, which is its own switch)',
      'Home grow banner, rings and “See what you have sown”',
      'TabBar garden item via learnerBar()',
    ],
    deskNav: [],
    bar: { key: 'garden', label: 'Garden', path: '/garden', slot: 'garden' },
  },
  {
    key: 'workbook',
    name: 'Workbook',
    what: 'Their answers in one place, to reopen and sit with.',
    defaultOn: true,
    depth: 'beginner',
    shipped: true,
    dependsOn: [],
    help: 'The workbook holds answers and reflections. Teachers can still teach without it; they just will not open a learner’s written work from the desk.',
    plugIn: [
      'Learner /p/:slug/garden/workbook and the Me workbook link',
      'Garden rings Workbook tile',
      'GET /api/workbook and /api/workbook/:learnerId',
      'Teach desk workbook inbox and download',
    ],
  },
  {
    key: 'circle',
    name: 'Circle answers',
    what: 'Gentle example answers so a question is never empty.',
    defaultOn: true,
    depth: 'intermediate',
    shipped: true,
    dependsOn: [],
    help: 'Circle answers sit beside real shared answers on a talk, so the first people in are not staring at a blank page. They are never counted as progress. The portal desk writes and switches them.',
    plugIn: [
      'Course player swarm / “What others said”',
      'Portal desk /admin/circle',
      'handle.ts actions that start with circle-',
    ],
    deskNav: ['circle'],
  },
  {
    key: 'planner',
    name: 'Study planner and My week',
    what: 'A gentle spread of one course across the days that suit them.',
    defaultOn: true,
    depth: 'intermediate',
    shipped: true,
    dependsOn: [],
    help: 'My week is the study plan: pick a course, tick days, and the parts are shared out evenly. When Gather is off, this takes the middle spot on the bottom bar so the bar still looks complete.',
    plugIn: [
      'Learner /p/:slug/me/plan and Home “Your plan” card',
      'Course “Plan the rest of this course”',
      'Desk /admin/plans and handle.ts action schedule',
      'TabBar My week item via learnerBar() when Gather is off',
    ],
    deskNav: ['plans'],
    bar: { key: 'week', label: 'My week', path: '/me/plan', slot: 'middle' },
  },
  {
    key: 'compass',
    name: 'Compass',
    what: 'A monthly look at how they are doing, in plain words only.',
    defaultOn: true,
    depth: 'intermediate',
    shipped: true,
    dependsOn: [],
    help: 'Compass is a gentle monthly check-in. Learners never see a number — only a line about what to focus on. Teachers see the scales on the desk.',
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
    help: 'When a learner shares an answer, a teacher can reply or leave a mark on the film. Switch this off if the portal is self-guided. Private answers stay private either way.',
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
    defaultOn: true,
    depth: 'in-depth',
    shipped: true,
    dependsOn: [],
    help: 'Gather is for evenings at the masjid — classes, circles and open nights. Learners pick up a ticket; the desk takes the register. Some pools never meet in person, so you can leave this off.',
    plugIn: [
      'Learner /p/:slug/gather and public /gather/:event',
      'Home gather cards, course gather notices, nights on Circle',
      'Desk /admin/gather, /admin/nights',
      'POST/GET /api/gather and handle.ts rsvp, checkin',
      'TabBar gather item via learnerBar() when Gather is on',
    ],
    deskNav: ['gather', 'nights'],
    bar: { key: 'gather', label: 'Gather', path: '/gather', slot: 'middle' },
  },
  {
    key: 'live',
    name: 'Live sessions',
    what: 'Teacher live streams, with a Live now banner on Home.',
    defaultOn: true,
    depth: 'in-depth',
    shipped: false,
    dependsOn: [],
    help: 'Live is a teacher going live for this portal only. Learners see a Live now banner under the Home title. It is built on PR #20; the switch is ready so that work adds one check.',
    plugIn: [
      'PR #20 — Learner Home Live now / Coming up banner (src/screens/app/home.tsx)',
      'PR #20 — Learner watch page /p/:slug/live/:id',
      'PR #20 — Desk Go live /admin/live and /master/live',
      'PR #20 — GET/POST /api/live (src/app/(frontend)/api/live/route.ts)',
    ],
    deskNav: ['live'],
  },
  {
    key: 'missions',
    name: 'Help shape HEARTS missions',
    what: 'A quiet way to say which missions HEARTS should take on next.',
    defaultOn: true,
    depth: 'in-depth',
    shipped: false,
    dependsOn: [],
    help: 'Missions let people help shape what HEARTS works on next. It is built on PR #27. Turning it off hides the learner card and the desk tools once that work lands.',
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
    defaultOn: true,
    depth: 'in-depth',
    shipped: false,
    dependsOn: [],
    help: 'Insights are counts and patterns for the portal team, never a named learner. Built on PR #27. The switch is here so that desk can hide in one line.',
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
    defaultOn: true,
    depth: 'in-depth',
    shipped: false,
    dependsOn: [],
    help: 'Experiments try two wordings of a button or label. Learners never see that they are in a test. Built on PR #22. Only the master desk starts one; a portal can switch the whole thing off.',
    plugIn: [
      'PR #22 — useVariant / track() in the learner app (src/lib/use-variant.ts, experiment-track.ts)',
      'PR #22 — Desk /master/experiments and portal results',
      'PR #22 — GET/POST /api/experiments (src/app/(frontend)/api/experiments/route.ts)',
    ],
    deskNav: ['experiments'],
  },
] as const

export const DEPTH_ORDER: FeatureDepth[] = ['beginner', 'intermediate', 'in-depth']

export const DEPTH_LABEL: Record<FeatureDepth, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  'in-depth': 'In-depth',
}

export const PRESETS = {
  small: {
    key: 'small' as const,
    label: 'Start small',
    hint: 'Videos, questions and the Garden.',
    keys: ['garden', 'workbook'] as readonly FeatureKey[],
  },
  community: {
    key: 'community' as const,
    label: 'Add the community',
    hint: 'Start small, plus circle answers and the planner.',
    keys: ['garden', 'workbook', 'circle', 'planner'] as readonly FeatureKey[],
  },
  everything: {
    key: 'everything' as const,
    label: 'Everything',
    hint: 'Every switch on this list.',
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

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === 'string' && (FEATURE_KEYS as readonly string[]).includes(value)
}

export function defaultFeatures(): FeatureMap {
  return Object.fromEntries(FEATURES.map((row) => [row.key, row.defaultOn])) as FeatureMap
}

export function presetFeatures(preset: PresetKey): FeatureMap {
  const chosen = new Set<FeatureKey>(PRESETS[preset].keys)
  return Object.fromEntries(FEATURE_KEYS.map((key) => [key, chosen.has(key)])) as FeatureMap
}

/** Read stored JSON (or null) into a full map, filling gaps from defaults. */
export function parseFeatures(raw: unknown): FeatureMap {
  const base = defaultFeatures()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const input = raw as Record<string, unknown>
  for (const key of FEATURE_KEYS) {
    if (typeof input[key] === 'boolean') base[key] = input[key]
  }
  return base
}

export type FeatureSource = { features?: unknown } | null | undefined

export function featuresOf(portal: FeatureSource): FeatureMap {
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
  return Object.fromEntries(FEATURE_KEYS.map((key) => [key, on.has(key)])) as FeatureMap
}

/**
 * Bottom bar. Always Home · (middle) · Garden · Me, driven by the registry.
 * Gather takes the middle slot when it is on, so live does not change.
 * When Gather is off, My week fills that slot if the planner is on.
 */
export function learnerBar(portal: FeatureSource): BarItem[] {
  const items = [...ALWAYS_BAR]
  const gather = featureByKey('gather')?.bar
  const planner = featureByKey('planner')?.bar
  if (gather && featureOn(portal, 'gather')) items.push(gather)
  else if (planner && featureOn(portal, 'planner')) items.push(planner)
  const garden = featureByKey('garden')?.bar
  if (garden && featureOn(portal, 'garden')) items.push(garden)
  items.push(ME_BAR)
  return items
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
