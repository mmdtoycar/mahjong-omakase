import React from 'react'
import { Tile } from '../../logic/shared/tiles'

export const getTileKey = (tile: Tile): string => {
  if (tile.suit === 'm') return `Man${tile.rank}`
  if (tile.suit === 'p') return `Pin${tile.rank}`
  if (tile.suit === 's') return `Sou${tile.rank}`
  if (tile.suit === 'z') {
    if (tile.rank <= 4) return ['Ton', 'Nan', 'Shaa', 'Pei'][tile.rank - 1]
    return ['Chun', 'Hatsu', 'Haku'][tile.rank - 5]
  }
  return 'Back'
}

export const getTileName = (tile: Tile): string => {
  if (tile.suit === 'm') return `${tile.rank}万`
  if (tile.suit === 'p') return `${tile.rank}饼`
  if (tile.suit === 's') return `${tile.rank}条`
  if (tile.suit === 'z') {
    if (tile.rank <= 4) return ['东', '南', '西', '北'][tile.rank - 1] + '风'
    return ['中', '发', '白'][tile.rank - 5]
  }
  return '未知'
}

export const TileComponent: React.FC<{
  tile: Tile
  onClick?: () => void
  isWinning?: boolean
  isBack?: boolean
  disabled?: boolean
  size?: 'normal' | 'small'
}> = ({ tile, onClick, isWinning, isBack, disabled, size = 'normal' }) => {
  const tileKey = isBack ? 'Back' : getTileKey(tile)
  return (
    <div
      className={`calc-tile-container ${size} ${!disabled ? 'selectable' : 'disabled'}`}
      onClick={!disabled ? onClick : undefined}
    >
      <img
        src={`https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/master/Regular/${tileKey}.svg`}
        alt={isBack ? 'Back' : getTileName(tile)}
        className={`calc-tile ${isWinning ? 'highlighted-tile' : ''}`}
      />
    </div>
  )
}

export const isSequenceDisabled = <M extends { tiles: Tile[] }>(c: Tile[], m: M[], t: Tile): boolean => {
  if (t.suit === 'z' || t.rank >= 8) return true
  const all = [...c, ...m.flatMap((x) => x.tiles)]
  return [0, 1, 2].some((offset) => all.filter((x) => x.equals(new Tile(t.suit, t.rank + offset))).length >= 4)
}
