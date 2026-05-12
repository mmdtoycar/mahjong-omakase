import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Tile } from '../logic/guobiao/tiles'
import { Meld, GameOptions, CalcResult } from '../logic/riichi/types'
import { calculateHand } from '../logic/riichi/score'
import { TileComponent, isSequenceDisabled } from './shared/TileComponent'

type Mode = {
  name: string
  label: string
  add: (concealed: Tile[], mings: Meld[], tile: Tile) => { concealed: Tile[]; mings: Meld[] }
  canUse: (concealed: Tile[], mings: Meld[]) => boolean
  isDisabled: (concealed: Tile[], mings: Meld[], tile: Tile) => boolean
}

const modes: Mode[] = [
  {
    name: 'normal',
    label: '单张',
    canUse: (c, m) => c.length + m.length * 3 < 14,
    isDisabled: (c, m, t) => [...c, ...m.flatMap((x) => x.tiles)].filter((x) => x.equals(t)).length >= 4,
    add: (c, m, t) => ({ concealed: [...c, t], mings: m }),
  },
  {
    name: 'an-shun',
    label: '暗顺',
    canUse: (c, m) => c.length + m.length * 3 <= 11,
    isDisabled: isSequenceDisabled,
    add: (c, m, t) => ({ concealed: [...c, t, new Tile(t.suit, t.rank + 1), new Tile(t.suit, t.rank + 2)], mings: m }),
  },
  {
    name: 'an-ke',
    label: '暗刻',
    canUse: (c, m) => c.length + m.length * 3 <= 11,
    isDisabled: (c, m, t) => [...c, ...m.flatMap((x) => x.tiles)].filter((x) => x.equals(t)).length >= 2,
    add: (c, m, t) => ({ concealed: [...c, t, t, t], mings: m }),
  },
  {
    name: 'chi',
    label: '吃',
    canUse: (c, m) => c.length + m.length * 3 <= 11,
    isDisabled: isSequenceDisabled,
    add: (c, m, t) => ({
      concealed: c,
      mings: [
        ...m,
        { type: 'shuntsu', tiles: [t, new Tile(t.suit, t.rank + 1), new Tile(t.suit, t.rank + 2)], isOpen: true },
      ],
    }),
  },
  {
    name: 'pon',
    label: '碰',
    canUse: (c, m) => c.length + m.length * 3 <= 11,
    isDisabled: (c, m, t) => [...c, ...m.flatMap((x) => x.tiles)].filter((x) => x.equals(t)).length >= 2,
    add: (c, m, t) => ({ concealed: c, mings: [...m, { type: 'koutsu', tiles: [t, t, t], isOpen: true }] }),
  },
  {
    name: 'ming-kan',
    label: '明杠',
    canUse: (c, m) => c.length + m.length * 3 <= 10,
    isDisabled: (c, m, t) => [...c, ...m.flatMap((x) => x.tiles)].filter((x) => x.equals(t)).length >= 1,
    add: (c, m, t) => ({ concealed: c, mings: [...m, { type: 'kantsu', tiles: [t, t, t, t], isOpen: true }] }),
  },
  {
    name: 'an-kan',
    label: '暗杠',
    canUse: (c, m) => c.length + m.length * 3 <= 10,
    isDisabled: (c, m, t) => [...c, ...m.flatMap((x) => x.tiles)].filter((x) => x.equals(t)).length >= 1,
    add: (c, m, t) => ({ concealed: c, mings: [...m, { type: 'kantsu', tiles: [t, t, t, t], isOpen: false }] }),
  },
]

interface RiichiCalculatorProps {
  onSelectScore: (fan: number | null, fu: number | null, hand?: string, fanDetails?: string) => void
  initialOptions?: Partial<GameOptions>
  resetTrigger?: number
  isSelfDraw: boolean
  onIsSelfDrawChange: (val: boolean) => void
}

export const RiichiCalculator: React.FC<RiichiCalculatorProps> = ({
  onSelectScore,
  initialOptions,
  resetTrigger,
  isSelfDraw,
  onIsSelfDrawChange,
}) => {
  const [concealedTiles, setConcealedTiles] = useState<Tile[]>([])
  const [melds, setMelds] = useState<Meld[]>([])
  const [mode, setMode] = useState(modes[0])
  const [options, setOptions] = useState<GameOptions>({
    isTsumo: isSelfDraw,
    bakaze: 1,
    jikaze: 1,
    isRiichi: false,
    isDoubleRiichi: false,
    isIppatsu: false,
    isChankan: false,
    isRinshan: false,
    isHaitei: false,
    isTenhou: false,
    isChiihou: false,
    doraCount: 0,
    ...initialOptions,
  })

  useEffect(() => {
    setOptions((prev) => ({ ...prev, isTsumo: isSelfDraw }))
  }, [isSelfDraw])

  const resetHandState = useCallback(() => {
    setConcealedTiles([])
    setMelds([])
    setOptions((prev) => ({
      ...prev,
      isRiichi: false,
      isDoubleRiichi: false,
      isIppatsu: false,
      isChankan: false,
      isRinshan: false,
      isHaitei: false,
      isTenhou: false,
      isChiihou: false,
      doraCount: 0,
    }))
    setMode(modes[0])
  }, [])

  const [prevResetTrigger, setPrevResetTrigger] = useState(resetTrigger)
  if (resetTrigger !== prevResetTrigger) {
    setPrevResetTrigger(resetTrigger)
    resetHandState()
  }

  useEffect(() => {
    if (initialOptions) {
      setOptions((prev) => ({
        ...prev,
        bakaze: initialOptions.bakaze ?? prev.bakaze,
        jikaze: initialOptions.jikaze ?? prev.jikaze,
      }))
    }
  }, [JSON.stringify(initialOptions)])

  const currentCount = concealedTiles.length + melds.length * 3

  const onTileClick = (t: Tile) => {
    if (!mode.canUse(concealedTiles, melds) || mode.isDisabled(concealedTiles, melds, t)) return
    const result = mode.add(concealedTiles, melds, t)
    setConcealedTiles(result.concealed)
    setMelds(result.mings)
  }

  const onHandMingClick = (i: number) => setMelds((prev) => prev.filter((_, idx) => idx !== i))

  const onHandTileClick = (tile: Tile) => {
    setConcealedTiles((prev) => {
      const idx = prev.findIndex((t) => t.equals(tile))
      if (idx === -1) return prev
      const next = [...prev]
      next.splice(idx, 1)
      return next
    })
  }

  const huResult: CalcResult | null = useMemo(() => {
    if (currentCount !== 14) return null
    const winTile = concealedTiles[concealedTiles.length - 1]
    const hand = concealedTiles.slice(0, -1)
    return calculateHand(hand, melds, winTile, options)
  }, [concealedTiles, melds, options, currentCount])

  useEffect(() => {
    if (currentCount === 14 && huResult) {
      const winTile = concealedTiles[concealedTiles.length - 1]
      const others = concealedTiles.slice(0, -1).sort((a, b) => a.compareTo(b))
      const concealedStr = others.map((t) => t.toString()).join('')
      const winTileStr = `^${winTile.toString()}`
      const meldsStr = melds
        .map((m) => {
          const tStr = m.tiles.map((t) => t.toString()).join('')
          return m.isOpen ? `[${tStr}]` : `(${tStr})`
        })
        .join('')
      const handStr = concealedStr + winTileStr + meldsStr

      const fanDetailsStr = huResult.yakuList.map((y) => `${y.name}(${y.han})`).join(', ')

      onSelectScore(huResult.han, huResult.fu, handStr, fanDetailsStr)
    } else {
      onSelectScore(null, null)
    }
  }, [huResult, onSelectScore, currentCount, concealedTiles, melds, options.doraCount])

  const displayConcealed = useMemo(() => {
    const sorted = [...concealedTiles].sort((a, b) => a.compareTo(b))
    if (currentCount === 14 && concealedTiles.length > 0) {
      const last = concealedTiles[concealedTiles.length - 1]
      const idx = sorted.findIndex((t) => t.equals(last))
      if (idx !== -1) sorted.splice(idx, 1)
      return sorted
    }
    return sorted
  }, [concealedTiles, currentCount])

  return (
    <div className="guobiao-inline-calculator">
      <div className="mode-selector-container">
        <div className="mode-group">
          {modes.map((m) => (
            <button
              key={m.name}
              onClick={() => setMode(m)}
              className={`mode-btn ${mode.name === m.name ? 'active' : ''}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tile-grid-compact">
        {Tile.all.map((tile, i) => (
          <TileComponent
            key={i}
            tile={tile}
            onClick={() => onTileClick(tile)}
            disabled={!mode.canUse(concealedTiles, melds) || mode.isDisabled(concealedTiles, melds, tile)}
          />
        ))}
        <div
          className={`calc-tile-container selectable hua-tile-btn ${options.doraCount >= 20 ? 'disabled' : ''}`}
          onClick={() => options.doraCount < 20 && setOptions((prev) => ({ ...prev, doraCount: prev.doraCount + 1 }))}
        >
          <span className="hua-tile-char">宝</span>
        </div>
      </div>

      <div className="hand-display-area compact">
        {melds.map((m, i) => (
          <div key={i} className="meld-box small" onClick={() => onHandMingClick(i)}>
            {m.tiles.map((t, ti) => (
              <TileComponent
                key={ti}
                tile={t}
                isBack={m.type === 'kantsu' && !m.isOpen && (ti === 1 || ti === 2)}
                size="small"
              />
            ))}
          </div>
        ))}
        <div className="tiles-row small">
          {displayConcealed.map((tile, i) => (
            <TileComponent key={i} tile={tile} onClick={() => onHandTileClick(tile)} size="small" />
          ))}
        </div>
        {currentCount === 14 && concealedTiles.length > 0 && (
          <div className="win-tile-area small">
            <TileComponent
              tile={concealedTiles[concealedTiles.length - 1]}
              onClick={() => onHandTileClick(concealedTiles[concealedTiles.length - 1])}
              size="small"
            />
          </div>
        )}
        {options.doraCount > 0 && (
          <div
            className="calc-tile-container small selectable hua-tile-btn hua-hand-tile"
            onClick={() => setOptions((prev) => ({ ...prev, doraCount: Math.max(0, prev.doraCount - 1) }))}
          >
            <span className="hua-tile-char">宝</span>
            {options.doraCount > 1 && <span className="hua-count-badge">x{options.doraCount}</span>}
          </div>
        )}
      </div>

      <div className="winning-options-section">
        <div className="options-grid compact cols-3">
          <button
            className={`opt-btn ${options.isRiichi ? 'active' : ''}`}
            onClick={() => setOptions({ ...options, isRiichi: !options.isRiichi, isDoubleRiichi: false })}
          >
            立直
          </button>
          <button
            className={`opt-btn ${options.isIppatsu ? 'active' : ''}`}
            onClick={() => setOptions({ ...options, isIppatsu: !options.isIppatsu })}
          >
            一发
          </button>
          <button
            className={`opt-btn ${options.isHaitei ? 'active' : ''}`}
            onClick={() => setOptions({ ...options, isHaitei: !options.isHaitei })}
          >
            {isSelfDraw ? '海底' : '河底'}
          </button>
          <button
            className={`opt-btn ${options.isRinshan ? 'active' : ''}`}
            onClick={() => setOptions({ ...options, isRinshan: !options.isRinshan })}
          >
            岭上
          </button>
          <button
            className={`opt-btn ${options.isChankan ? 'active' : ''}`}
            onClick={() => setOptions({ ...options, isChankan: !options.isChankan })}
          >
            抢杠
          </button>
          <button
            className={`opt-btn ${options.isDoubleRiichi ? 'active' : ''}`}
            onClick={() =>
              setOptions({ ...options, isDoubleRiichi: !options.isDoubleRiichi, isRiichi: !options.isDoubleRiichi })
            }
          >
            两立直
          </button>
        </div>
      </div>

      {huResult && (
        <div className={`result-preview-mini ${huResult.yakuList.length === 0 ? 'error' : ''}`}>
          <div className="fan-list-mini">
            <strong>{huResult.han} 番:</strong>
            {huResult.yakuList.map((y, i) => (
              <span key={i} className="mini-fan-tag">
                {y.name} {y.isYakuman ? '役满' : `${y.han}番`}
              </span>
            ))}
          </div>
          {huResult.fuDetails.length > 0 && (
            <div className="fan-list-mini">
              <strong>{huResult.fu} 符:</strong>
              {huResult.fuDetails.map((f, i) => (
                <span key={i} className="mini-fan-tag">
                  {f.reason} {f.fu}符
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {currentCount === 14 && !huResult && (
        <div className="result-preview-mini error">
          <div className="score-warning-text">和了不成立 — 无役</div>
        </div>
      )}
    </div>
  )
}
