/** A course already in the clip feed is open now. The rest open one a day, in list order. */

export function courseIsOpen(input: { index: number; today: number; inFeed: boolean }) {
  return input.inFeed || input.index + 1 <= input.today
}

export function opensOnDay(input: { index: number; inFeed: boolean }) {
  return input.inFeed ? 1 : input.index + 1
}
