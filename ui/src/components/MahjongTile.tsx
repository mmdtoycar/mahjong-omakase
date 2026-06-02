import React from 'react'

interface MahjongTileProps {
  tile: string
  faceDown?: boolean
  selected?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
  size?: 'sm' | 'md' | 'lg'
}

interface TileDisplay {
  label: string
  suit: 'wan' | 'pin' | 'sou' | 'wind' | 'dragon' | 'unknown'
  colorClass: string
  sub?: string
}

export function parseTile(tile: string): TileDisplay {
  if (!tile) {
    return { label: '', suit: 'unknown', colorClass: 'tile-unknown' }
  }

  const num = parseInt(tile.slice(0, -1), 10)
  const suit = tile.slice(-1)

  if (suit === 'm') {
    const chars = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
    return { label: chars[num] || tile, suit: 'wan', colorClass: 'tile-color-wan', sub: '萬' }
  } else if (suit === 'p') {
    return { label: String(num), suit: 'pin', colorClass: 'tile-color-pin', sub: '筒' }
  } else if (suit === 's') {
    return { label: String(num), suit: 'sou', colorClass: 'tile-color-sou', sub: '條' }
  } else if (suit === 'z') {
    const winds = ['', '東', '南', '西', '北', '中', '發', '白']
    const windClasses = [
      '',
      'tile-color-wind-red',
      'tile-color-wind-black',
      'tile-color-wind-black',
      'tile-color-wind-black',
      'tile-color-dragon-red',
      'tile-color-dragon-green',
      'tile-color-dragon-white',
    ]
    const labels = winds[num] || tile
    return {
      label: labels,
      suit: num <= 4 ? 'wind' : 'dragon',
      colorClass: windClasses[num] || 'tile-color-unknown',
      sub: num <= 4 ? '风' : '箭',
    }
  }
  return { label: tile, suit: 'unknown', colorClass: 'tile-color-unknown' }
}

const MahjongTile: React.FC<MahjongTileProps> = ({
  tile,
  faceDown = false,
  selected = false,
  onClick,
  onDoubleClick,
  size = 'md',
}) => {
  const display = parseTile(tile)

  if (faceDown) {
    return (
      <div className={`mahjong-tile size-${size} face-down`} onClick={onClick}>
        <div className="tile-back"></div>
      </div>
    )
  }

  return (
    <div
      className={`mahjong-tile size-${size} ${selected ? 'selected' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="tile-face">
        <span className={`tile-label ${display.colorClass}`}>{display.label}</span>
        {display.sub && <span className="tile-sub">{display.sub}</span>}
      </div>
    </div>
  )
}

export default MahjongTile
