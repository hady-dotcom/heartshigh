// Shuffles multiple-choice options so the right answer is not stuck in one slot.
// A seeded generator keeps a draft stable: the same prompt lands in the same place, and a batch does not.

export function seedFrom(text: string) {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** mulberry32. Same seed, same sequence. */
export function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Fisher-Yates. `correctIndex` follows the choice it names, even when two choices share the same words.
 * `random` defaults to Math.random. Pass a seeded function when a draft has to come out the same way twice.
 */
export function shuffleChoices<T>(choices: T[], correctIndex: number, random: () => number = Math.random) {
  const tagged = choices.map((choice, index) => ({ choice, correct: index === correctIndex }))
  for (let index = tagged.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const held = tagged[index]
    tagged[index] = tagged[swap]
    tagged[swap] = held
  }
  return { choices: tagged.map((item) => item.choice), correctIndex: tagged.findIndex((item) => item.correct) }
}
