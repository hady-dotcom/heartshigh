/** Course parts follow the part order field. Unit rank only breaks a tie. */

export function sortParts<T extends { id: number; order?: number | null }>(
  lessons: T[],
  unitRank: (row: T) => number = () => 0,
) {
  return [...lessons].sort(
    (a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || unitRank(a) - unitRank(b) || a.id - b.id,
  )
}
