import { Tile } from '../shared/tiles'
import { sortTiles, removeTilesOnce } from '../shared/tileUtils'
import { calculateShanten } from './shanten'
import { DiscardAnalysis } from './ukeire'
import { PracticeQuestion, WhatIfScenario } from '../../data/practiceQuestions'

export interface SimulationResult {
  drawTile: Tile
  label: string
  tag: 'optimal' | 'good' | 'trap' | 'neutral'
  newHandTiles: Tile[]
  newShanten: number
  shantenChange: 'improved' | 'same' | 'worse'
  outcomeText: string
  statusBadge: string
}

/**
 * Computes the simulated hand when a specific tile is drawn
 * after discarding discardedTile from handTiles.
 */
export function simulateDraw(
  handTiles: Tile[],
  discardedTile: Tile,
  drawTile: Tile,
  label: string,
  tag: 'optimal' | 'good' | 'trap' | 'neutral',
  outcomeCustomText?: string
): SimulationResult {
  const remaining = removeTilesOnce(handTiles, [discardedTile])
  const newHandTiles = [...sortTiles(remaining), drawTile]

  const initialShanten = calculateShanten(remaining)
  const newShanten = calculateShanten(newHandTiles)

  let shantenChange: 'improved' | 'same' | 'worse' = 'same'
  if (newShanten < initialShanten) {
    shantenChange = 'improved'
  } else if (newShanten > initialShanten) {
    shantenChange = 'worse'
  }

  let statusBadge = ''
  if (newShanten === -1) {
    statusBadge = '🎉 自摸和牌！'
  } else if (newShanten === 0) {
    statusBadge = '✨ 听牌达成 (Tenpai)'
  } else if (newShanten === 1) {
    statusBadge = '⏩ 前进至一向听'
  } else if (newShanten === 2) {
    statusBadge = '⏩ 前进至两向听'
  } else {
    statusBadge = `⏩ 前进至 ${newShanten} 向听`
  }

  if (tag === 'trap') {
    statusBadge = '🚫 进张受阻 / 无役陷阱'
  }

  let outcomeText = outcomeCustomText || ''
  if (!outcomeText) {
    if (tag === 'optimal' || tag === 'good') {
      outcomeText = `顺利摸入有效进张【${drawTile.toString()}】，手牌向听数前进至 ${
        newShanten === 0 ? '听牌' : `${newShanten}向听`
      }！手牌骨架进一步夯实，进张效率得到最大化释放。`
    } else if (tag === 'trap') {
      outcomeText = `摸入此牌【${drawTile.toString()}】暴露了切牌短板！若此前切错牌，此处进张将完全卡死，无法完成有效面子，严重拖慢做牌节奏。`
    } else {
      outcomeText = `摸入【${drawTile.toString()}】，手牌向听数未发生变化（维持 ${newShanten} 向听）。可等待下一巡摸入更优质的中张或改良牌。`
    }
  }

  return {
    drawTile,
    label,
    tag,
    newHandTiles,
    newShanten,
    shantenChange,
    outcomeText,
    statusBadge,
  }
}

/**
 * Generates an array of interactive What-If simulation scenarios
 * for the current hand and chosen/optimal discard.
 */
export function getWhatIfScenarios(
  handTiles: Tile[],
  effectiveDiscard: Tile,
  analyses: DiscardAnalysis[],
  question?: PracticeQuestion,
  userDiscard?: Tile | null
): SimulationResult[] {
  // 1. If question defines curated scenarios, use them
  if (question?.whatIfScenarios && question.whatIfScenarios.length > 0) {
    return question.whatIfScenarios.map((sc: WhatIfScenario) => {
      const drawTile = Tile.fromString(sc.drawTile)
      return simulateDraw(handTiles, effectiveDiscard, drawTile, sc.label, sc.tag, sc.outcome)
    })
  }

  // 2. Otherwise dynamically derive 3 realistic scenarios
  const bestAnalysis = analyses.find((a) => a.isOptimal) || analyses[0]
  const userAnalysis = userDiscard ? analyses.find((a) => a.discardTile.equals(userDiscard)) : null

  const results: SimulationResult[] = []

  // Scenario 1: Top optimal effective tile
  if (bestAnalysis && bestAnalysis.acceptanceTiles.length > 0) {
    const topUkeire = bestAnalysis.acceptanceTiles[0].tile
    results.push(
      simulateDraw(
        handTiles,
        effectiveDiscard,
        topUkeire,
        `摸入 ${topUkeire.toString()} (核心有效牌)`,
        'optimal',
        `摸入最佳有效牌【${topUkeire.toString()}】，手牌顺畅推进！面子顺利成型，向听数直接前进。`
      )
    )
  }

  // Scenario 2: Second effective tile or improvement
  if (bestAnalysis && bestAnalysis.acceptanceTiles.length > 1) {
    const secondUkeire = bestAnalysis.acceptanceTiles[1].tile
    results.push(
      simulateDraw(
        handTiles,
        effectiveDiscard,
        secondUkeire,
        `摸入 ${secondUkeire.toString()} (次选有效牌)`,
        'good',
        `摸入有效牌【${secondUkeire.toString()}】，同样达成有效进张推进，展现了多头进张的宽广面！`
      )
    )
  }

  // Scenario 3: Lost opportunity / Trap scenario (if user picked suboptimal)
  if (userAnalysis && !bestAnalysis.discardTile.equals(userAnalysis.discardTile)) {
    const lostTiles = bestAnalysis.acceptanceTiles.filter(
      (bt) => !userAnalysis.acceptanceTiles.some((ut) => ut.tile.equals(bt.tile))
    )
    if (lostTiles.length > 0) {
      const lostTile = lostTiles[0].tile
      results.push(
        simulateDraw(
          handTiles,
          effectiveDiscard,
          lostTile,
          `若切错错失: ${lostTile.toString()}`,
          'trap',
          `痛失好局！如果按推荐切牌，摸入【${lostTile.toString()}】本可直接成搭推进；但切错了牌，导致这 ${
            lostTiles[0].remaining
          } 张进张被亲手扼杀！`
        )
      )
    }
  }

  // If still fewer than 3 scenarios, add an honor/neutral tile
  if (results.length < 3) {
    const neutralTile = new Tile('z', 1) // East wind
    results.push(
      simulateDraw(
        handTiles,
        effectiveDiscard,
        neutralTile,
        `摸入 ${neutralTile.toString()} (无用浮牌)`,
        'neutral',
        `摸入无番客风【${neutralTile.toString()}】，手牌无法顺子靠搭，向听数不变。下一巡应毫不犹豫将其切除。`
      )
    )
  }

  return results.slice(0, 3)
}
