import { Tile } from '../guobiao/tiles'

export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => a.compareTo(b))
}

export function countTiles(tiles: Tile[]): Map<string, number> {
  const counts = new Map<string, number>()
  tiles.forEach((t) => {
    const key = t.toString()
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return counts
}

export function tileCount(tiles: Tile[], target: Tile): number {
  return tiles.filter((t) => t.equals(target)).length
}

export function removeTilesOnce(all: Tile[], toRemove: Tile[]): Tile[] {
  const result = [...all]
  for (const r of toRemove) {
    const idx = result.findIndex((t) => t.equals(r))
    if (idx !== -1) result.splice(idx, 1)
  }
  return result
}
