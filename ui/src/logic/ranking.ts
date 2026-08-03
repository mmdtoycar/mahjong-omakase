/**
 * Standard competition ranking: sort by score descending, tied scores share the
 * same rank, and the next distinct score skips (e.g. [100,50,30,30] → ranks
 * [1,2,3,3]; [50,50,30,10] → [1,1,3,4]). Sort is stable, so tied items keep their
 * input order. This is the single source of truth for per-game rank across the UI
 * and matches the backend RankCalculator.
 */
export function rankByScore<T extends object>(items: T[], getScore: (t: T) => number): (T & { rank: number })[] {
  const sorted = [...items].sort((a, b) => getScore(b) - getScore(a))
  const result: (T & { rank: number })[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j < sorted.length && getScore(sorted[j]) === getScore(sorted[i])) j++
    const rank = i + 1
    for (let k = i; k < j; k++) result.push({ ...sorted[k], rank })
    i = j
  }
  return result
}
