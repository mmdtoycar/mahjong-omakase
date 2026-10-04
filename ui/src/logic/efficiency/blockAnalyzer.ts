import { Tile } from '../shared/tiles'
import { sortTiles } from '../shared/tileUtils'

export type BlockType =
  | 'mentsu-shunzi'
  | 'mentsu-kezi'
  | 'taatsu-ryanmen'
  | 'taatsu-kanchan'
  | 'taatsu-penchan'
  | 'taatsu-complex'
  | 'jantou'
  | 'isolated'

export type BlockQuality = 'excellent' | 'good' | 'medium' | 'bad' | 'redundant'

export interface HandBlock {
  type: BlockType
  name: string
  label: string
  tiles: Tile[]
  quality: BlockQuality
  description: string
}

export interface HandStructure {
  blocks: HandBlock[]
  status: 'under-blocks' | 'five-blocks' | 'over-blocks'
  statusTitle: string
  statusExplanation: string
  totalBlockCount: number
}

/**
 * Decomposes a hand into visual blocks (melds, taatsus, pairs, isolated tiles)
 * to help beginners understand the 5-block structure (五面子理论).
 */
export function analyzeHandStructure(tiles: Tile[]): HandStructure {
  const sorted = sortTiles(tiles)
  const remaining: Tile[] = [...sorted]
  const blocks: HandBlock[] = []

  const removeTiles = (toRemove: Tile[]) => {
    for (const r of toRemove) {
      const idx = remaining.findIndex((t) => t.equals(r))
      if (idx !== -1) remaining.splice(idx, 1)
    }
  }

  const countOf = (t: Tile) => remaining.filter((x) => x.equals(t)).length
  const findTile = (suit: string, rank: number) => remaining.find((x) => x.suit === suit && x.rank === rank)

  // 1. Detect Special Complex Shapes First (中膨, 两坎, 延伸四连形)
  for (const s of ['m', 'p', 's'] as ('m' | 'p' | 's')[]) {
    // 中膨形 (Nakabukure: r-1, r, r, r+1)
    for (let r = 2; r <= 7; r++) {
      const t1 = findTile(s, r - 1)
      const t2Count = remaining.filter((x) => x.suit === s && x.rank === r).length
      const t3 = findTile(s, r + 1)
      if (t1 && t2Count >= 2 && t3) {
        const shapeTiles = [t1, new Tile(s, r), new Tile(s, r), t3]
        blocks.push({
          type: 'taatsu-complex',
          name: '中膨形',
          label: `${r - 1}${r}${r}${r + 1}${s} (中膨)`,
          tiles: shapeTiles,
          quality: 'excellent',
          description: '中间成对、两翼延伸。既有极高好形进张，又是极佳的潜在雀头候补。',
        })
        removeTiles(shapeTiles)
      }
    }

    // 两坎 (Ryankan: r, r+2, r+4)
    for (let r = 1; r <= 5; r++) {
      const t1 = findTile(s, r)
      const t2 = findTile(s, r + 2)
      const t3 = findTile(s, r + 4)
      if (t1 && t2 && t3 && countOf(t1) === 1 && countOf(t2) === 1 && countOf(t3) === 1) {
        // Ensure not part of consecutive sequence
        if (!findTile(s, r + 1) && !findTile(s, r + 3)) {
          const shapeTiles = [t1, t2, t3]
          blocks.push({
            type: 'taatsu-complex',
            name: '两坎复合形',
            label: `${r}${r + 2}${r + 4}${s} (两坎)`,
            tiles: shapeTiles,
            quality: 'good',
            description: `进 ${r + 1}${s} 或 ${r + 3}${s} 均成顺子，等同于 8 张受入，进张面媲美两面！`,
          })
          removeTiles(shapeTiles)
        }
      }
    }
  }

  // 2. Extract Triplets (刻子)
  for (let i = 0; i < remaining.length; ) {
    const t = remaining[i]
    if (countOf(t) >= 3) {
      const keziTiles = [t, t, t]
      blocks.push({
        type: 'mentsu-kezi',
        name: '完成刻子',
        label: `${t.rank}${t.suit} 刻子`,
        tiles: keziTiles,
        quality: 'excellent',
        description: '已完成的刻子面子，提供扎实的向听支撑。',
      })
      removeTiles(keziTiles)
      i = 0
    } else {
      i++
    }
  }

  // 3. Extract Pairs if they would avoid breaking obvious taatsus
  // We extract pairs first if countOf(t) == 2, unless t is part of an isolated sequence
  for (let i = 0; i < remaining.length; ) {
    const t = remaining[i]
    if (countOf(t) >= 2) {
      // Check if extracting this pair leaves adjacent tiles in reasonable shape
      const pairTiles = [t, t]
      blocks.push({
        type: 'jantou',
        name: '雀头/对子',
        label: `${t.rank}${t.suit} 对子`,
        tiles: pairTiles,
        quality: t.isHonor ? 'good' : 'excellent',
        description: '雀头候补，或与其他对子形成双碰待牌。',
      })
      removeTiles(pairTiles)
      i = 0
    } else {
      i++
    }
  }

  // 4. Extract Shunzi (顺子)
  for (let i = 0; i < remaining.length; ) {
    const t = remaining[i]
    if (t.isNumber && t.rank <= 7) {
      const t2 = findTile(t.suit, t.rank + 1)
      const t3 = findTile(t.suit, t.rank + 2)
      if (t2 && t3) {
        const shunziTiles = [t, t2, t3]
        blocks.push({
          type: 'mentsu-shunzi',
          name: '完成顺子',
          label: `${t.rank}${t.rank + 1}${t.rank + 2}${t.suit} 顺子`,
          tiles: shunziTiles,
          quality: 'excellent',
          description: '已完成的顺子面子，无需再消耗进张。',
        })
        removeTiles(shunziTiles)
        i = 0
        continue
      }
    }
    i++
  }

  // 5. Extract Two-sided (两面) and Terminal-edge (边张)
  for (let i = 0; i < remaining.length; ) {
    const t = remaining[i]
    if (t.isNumber && t.rank <= 8) {
      const t2 = findTile(t.suit, t.rank + 1)
      if (t2) {
        const taatsuTiles = [t, t2]
        if (t.rank === 1 || t.rank === 8) {
          blocks.push({
            type: 'taatsu-penchan',
            name: '边张搭子',
            label: `${t.rank}${t.rank + 1}${t.suit} (边张)`,
            tiles: taatsuTiles,
            quality: 'bad',
            description: `进张仅 ${t.rank === 1 ? '3' : '7'}${t.suit} 一种（4张），且无法两面改良，属最劣搭子。`,
          })
        } else {
          blocks.push({
            type: 'taatsu-ryanmen',
            name: '两面搭子',
            label: `${t.rank}${t.rank + 1}${t.suit} (两面)`,
            tiles: taatsuTiles,
            quality: 'excellent',
            description: `进 ${t.rank - 1}${t.suit} 或 ${t.rank + 2}${t.suit}（共8张），最优质高效搭子。`,
          })
        }
        removeTiles(taatsuTiles)
        i = 0
        continue
      }
    }
    i++
  }

  // 6. Extract Kanchan (坎张)
  for (let i = 0; i < remaining.length; ) {
    const t = remaining[i]
    if (t.isNumber && t.rank <= 7) {
      const t2 = findTile(t.suit, t.rank + 2)
      if (t2) {
        const kanchanTiles = [t, t2]
        blocks.push({
          type: 'taatsu-kanchan',
          name: '坎张搭子',
          label: `${t.rank}${t.rank + 2}${t.suit} (坎张)`,
          tiles: kanchanTiles,
          quality: 'medium',
          description: `进 ${t.rank + 1}${t.suit}（4张），质量优于死边张，摸临牌可改良为两面。`,
        })
        removeTiles(kanchanTiles)
        i = 0
        continue
      }
    }
    i++
  }

  // 7. Remaining are isolated tiles (孤张浮牌)
  for (const t of remaining) {
    let qual: BlockQuality = 'redundant'
    let desc = '多余孤张浮牌。'
    if (t.isHonor) {
      qual = 'redundant'
      desc = '客风/字牌孤张，无法靠出顺子搭子，价值最低。'
    } else if (t.isTerminal) {
      qual = 'bad'
      desc = '1/9端张孤张，只能靠出愚形边张或坎张，价值较低。'
    } else if (t.rank === 2 || t.rank === 8) {
      qual = 'medium'
      desc = '2/8近端张，靠出顺子效率中等。'
    } else {
      qual = 'good'
      desc = '4/5/6核心中张，靠张范围极广（两面率最高）。'
    }

    blocks.push({
      type: 'isolated',
      name: '孤张浮牌',
      label: `${t.rank}${t.suit} 孤张`,
      tiles: [t],
      quality: qual,
      description: desc,
    })
  }

  const functionalBlocks = blocks.filter((b) => b.type !== 'isolated')
  const totalBlockCount = functionalBlocks.length

  let status: 'under-blocks' | 'five-blocks' | 'over-blocks' = 'five-blocks'
  let statusTitle = '五块已齐（结构定型）'
  let statusExplanation =
    '手牌正好具备 5 个面子/搭子候补，结构已完全固定。此时手牌中的孤张失去靠搭价值，应切除多余孤张！'

  if (totalBlockCount < 5) {
    status = 'under-blocks'
    statusTitle = `不足五块（仅 ${totalBlockCount} 块）`
    statusExplanation =
      '手牌可用搭子不足 5 块，亟需靠张来形成新的搭子。应优先保留优质中张（456）靠出第 5 块，先切无用字牌与 19 端张。'
  } else if (totalBlockCount > 5) {
    status = 'over-blocks'
    statusTitle = `六块超额（共 ${totalBlockCount} 块，搭子臃肿）`
    statusExplanation =
      '手牌搭子已严重过剩！必须进行【搭子优劣比拼】，果断拆除最弱的一块（如死边张 12/89 或愚形坎张），让手牌恢复清爽高效的五块。'
  }

  return {
    blocks,
    status,
    statusTitle,
    statusExplanation,
    totalBlockCount,
  }
}
