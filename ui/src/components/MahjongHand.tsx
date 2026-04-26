import React from 'react'

interface Props {
  hand?: string
  details?: string
}

const TILE_MAP: Record<string, string> = {
  '1m': 'Man1',
  '2m': 'Man2',
  '3m': 'Man3',
  '4m': 'Man4',
  '5m': 'Man5',
  '6m': 'Man6',
  '7m': 'Man7',
  '8m': 'Man8',
  '9m': 'Man9',
  '1p': 'Pin1',
  '2p': 'Pin2',
  '3p': 'Pin3',
  '4p': 'Pin4',
  '5p': 'Pin5',
  '6p': 'Pin6',
  '7p': 'Pin7',
  '8p': 'Pin8',
  '9p': 'Pin9',
  '1s': 'Sou1',
  '2s': 'Sou2',
  '3s': 'Sou3',
  '4s': 'Sou4',
  '5s': 'Sou5',
  '6s': 'Sou6',
  '7s': 'Sou7',
  '8s': 'Sou8',
  '9s': 'Sou9',
  '1z': 'Ton',
  '2z': 'Nan',
  '3z': 'Shaa',
  '4z': 'Pei',
  '5z': 'Chun',
  '6z': 'Hatsu',
  '7z': 'Haku',
}

export const MahjongHand: React.FC<Props> = ({ hand, details }) => {
  if (!hand) return null

  const elements: React.ReactNode[] = []
  let i = 0
  let currentGroup: { tile: string; isWin: boolean }[] = []
  let isGroupOpen = true

  while (i < hand.length) {
    const char = hand[i]
    if (char === '[' || char === '(') {
      if (currentGroup.length > 0) {
        elements.push(
          <div key={`group-${elements.length}`} className="mahjong-group">
            {currentGroup.map((g, idx) => (
              <img
                key={idx}
                src={`https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/master/Regular/${
                  TILE_MAP[g.tile] || 'Back'
                }.svg`}
                alt={g.tile}
                className={`mahjong-tile ${g.isWin ? 'highlighted-tile' : ''}`}
              />
            ))}
          </div>
        )
        currentGroup = []
      }
      isGroupOpen = char === '['
      i++
    } else if (char === ']' || char === ')') {
      elements.push(
        <div key={`group-${elements.length}`} className={`mahjong-group ${!isGroupOpen ? 'highlighted-group' : ''}`}>
          {currentGroup.map((g, idx) => (
            <img
              key={idx}
              src={`https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/master/Regular/${
                TILE_MAP[g.tile] || 'Back'
              }.svg`}
              alt={g.tile}
              className={`mahjong-tile ${g.isWin ? 'highlighted-tile' : ''}`}
            />
          ))}
        </div>
      )
      currentGroup = []
      i++
    } else if (char === '^') {
      i++
      const tile = hand.substring(i, i + 2)
      currentGroup.push({ tile, isWin: true })
      i += 2
    } else {
      const tile = hand.substring(i, i + 2)
      if (TILE_MAP[tile]) {
        currentGroup.push({ tile, isWin: false })
      }
      i += 2
    }
  }

  // Final flush for concealed
  if (currentGroup.length > 0) {
    elements.push(
      <div key={`group-last`} className="mahjong-group">
        {currentGroup.map((g, idx) => (
          <img
            key={idx}
            src={`https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/master/Regular/${
              TILE_MAP[g.tile] || 'Back'
            }.svg`}
            alt={g.tile}
            className={`mahjong-tile ${g.isWin ? 'highlighted-tile' : ''}`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="mahjong-hand-container">
      <div className="mahjong-hand">{elements}</div>
      {details && <div className="fan-details">{details}</div>}
    </div>
  )
}
