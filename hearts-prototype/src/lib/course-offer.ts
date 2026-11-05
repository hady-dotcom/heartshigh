export function offerOnCodeNotice(input: { course: string; code: string; copied: boolean; given: number; live: number }) {
  const bits = [`${input.course} is on ${input.code}.`]
  if (input.copied) bits.push('That code used a library set, so this portal now has its own set with this course added.')
  bits.push('People who join with that code from now on can open it.')
  if (input.given) bits.push(`Also given to ${input.given} ${input.given === 1 ? 'person who has' : 'people who have'} already joined and keep a saved list.`)
  if (input.live) bits.push(`${input.live} already read the set live, so they can open it now.`)
  return bits.join(' ')
}

export function offerJoinedNotice(count: number) {
  if (!count) return 'Nobody has joined yet. Add it to a code so the next person can open it.'
  return `Given to ${count} ${count === 1 ? 'person who has' : 'people who have'} already joined. A new person still needs it on a code.`
}
