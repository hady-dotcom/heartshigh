import { PARENT_NAME_GROUPS, type ParentCulture, type ParentNameGroup } from '@/lib/parent-name-data'
import { speakerGender } from '@/lib/speaker-gender'

export type { ParentCulture, ParentNameGroup }
export { PARENT_NAME_GROUPS }

const CULTURES: ParentCulture[] = ['uk', 'irish', 'south-asian', 'arab', 'african', 'east-asian', 'eastern-european']

function unique(names: readonly string[]) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of names) {
    const key = name.toLowerCase()
    if (!name || seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

type Stock = {
  culture: ParentCulture
  group: string
  women: string[]
  men: string[]
  surnames: string[]
  womenSurnames: string[] | null
  menSurnames: string[] | null
}

function stock(): Stock[] {
  return PARENT_NAME_GROUPS.map((group) => ({
    culture: group.culture,
    group: group.group,
    women: unique(group.women),
    men: unique(group.men),
    surnames: unique(group.surnames),
    womenSurnames: group.womenSurnames ? unique(group.womenSurnames) : null,
    menSurnames: group.menSurnames ? unique(group.menSurnames) : null,
  }))
}

/** The one group that owns this surname, if the pools are coherent. */
export function groupForSurname(surname: string) {
  const key = surname.toLowerCase()
  const found = PARENT_NAME_GROUPS.filter((group) => {
    const names = [...group.surnames, ...(group.womenSurnames || []), ...(group.menSurnames || [])]
    return names.some((name) => name.toLowerCase() === key)
  })
  return found.length === 1 ? found[0] : null
}

function take(queues: Stock[], culture: ParentCulture, gender: 'woman' | 'man', cursor: Map<ParentCulture, number>) {
  const groups = queues.filter((group) => group.culture === culture)
  const start = cursor.get(culture) || 0
  for (let offset = 0; offset < groups.length; offset += 1) {
    const group = groups[(start + offset) % groups.length]
    const firsts = gender === 'woman' ? group.women : group.men
    const lasts = gender === 'woman'
      ? (group.womenSurnames || group.surnames)
      : (group.menSurnames || group.surnames)
    const firstAt = firsts.findIndex((first) => lasts.some((last) => last.toLowerCase() !== first.toLowerCase()))
    if (firstAt < 0) continue
    const first = firsts.splice(firstAt, 1)[0]
    const lastAt = lasts.findIndex((last) => last.toLowerCase() !== first.toLowerCase())
    const last = lasts.splice(lastAt, 1)[0]
    cursor.set(culture, (start + offset + 1) % groups.length)
    return `${first} ${last}`
  }
  throw new Error(`Ran out of ${gender} names for ${culture}.`)
}

/** Five parents per film, each from a different culture, in a fixed rotation. */
export function assignBookParentNames(films: readonly { others: readonly { body: string }[] }[]) {
  const queues = stock()
  const cursor = new Map<ParentCulture, number>()
  return films.map((film, filmIndex) => film.others.map((row, slot) => {
    const culture = CULTURES[(filmIndex + slot) % CULTURES.length]
    const gender = speakerGender(row.body) || ((filmIndex + slot) % 2 === 0 ? 'woman' : 'man')
    return take(queues, culture, gender, cursor)
  }))
}
