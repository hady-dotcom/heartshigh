/** Plain follow-ups for seeded or demo drafts only. A sheet import keeps the author's own words. */
export const DRAFT_FOLLOW_UPS = [
  'What from that stayed with you on the way home?',
  'Where might that show up this week?',
  'What would you hold onto from that?',
] as const

/** One question in a part: rotate the follow-up, and never open with "The speaker says:". */
export function draftPopupPrompt(quote: string, index: number) {
  const follow = DRAFT_FOLLOW_UPS[index % DRAFT_FOLLOW_UPS.length]
  const said = quote.trim()
  return index % 2 === 0 ? `He said: “${said}” ${follow}` : `“${said}” ${follow}`
}
