import React, { useState, useMemo, useEffect } from 'react'
import { fanTableData, FanItem } from '../data/fanTableData'
import { riichiFanTableData } from '../data/riichiFanTableData'
import { shenyangFanTableData } from '../data/shenyangFanTableData'
import { fetchFanDiscoveries } from '../api'
import { FanDiscovery, getCurrentSeason, GAME_MODES, GameModeKey } from '../types'
import { MahjongHand } from '../components/MahjongHand'
import { nameFontSize } from '../utils/fontSize'
import { useActiveSeasons } from '../hooks/useActiveSeasons'

const TAB_DATA_MAP: Record<GameModeKey, { data: () => FanItem[] }> = {
  GUOBIAO: { data: () => fanTableData },
  RIICHI: { data: () => riichiFanTableData },
  DONGBEI: { data: () => shenyangFanTableData },
}

const currentSeason = getCurrentSeason()

function keyDiscoveriesByMostRecent(discoveries: FanDiscovery[]): Record<string, FanDiscovery> {
  const sorted = [...discoveries].sort(
    (a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime()
  )
  return Object.fromEntries(sorted.map((d) => [d.fanName, d]))
}

const FanTablePage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<GameModeKey>('GUOBIAO')
  // Current season discoveries (for the selected season key)
  const [discoveries, setDiscoveries] = useState<FanDiscovery[]>([])
  // Previous season discoveries (fallback when current season has no record yet)
  const [prevDiscoveries, setPrevDiscoveries] = useState<FanDiscovery[]>([])
  const { seasons } = useActiveSeasons()
  const [seasonKey, setSeasonKey] = useState<string>(`${currentSeason.year}-${currentSeason.month}`)

  // Snap seasonKey to the first available season once seasons load.
  useEffect(() => {
    if (seasons.length === 0) return
    setSeasonKey((prev) =>
      seasons.some((s) => `${s.year}-${s.month}` === prev) ? prev : `${seasons[0].year}-${seasons[0].month}`
    )
  }, [seasons])

  // Load selected season discoveries
  useEffect(() => {
    if (seasonKey === 'all') {
      setDiscoveries([])
      return
    }

    setDiscoveries([])
    const controller = new AbortController()
    const [y, m] = seasonKey.split('-').map(Number)

    fetchFanDiscoveries(y, m, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setDiscoveries(data)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error(err)
      })
    return () => controller.abort()
  }, [seasonKey])

  // Load previous season discoveries as fallback (only when viewing current season)
  useEffect(() => {
    const isCurrentSeason = seasonKey === `${currentSeason.year}-${currentSeason.month}`
    if (!isCurrentSeason) {
      setPrevDiscoveries([])
      return
    }
    // Find the season just before current in the list
    const idx = seasons.findIndex((s) => `${s.year}-${s.month}` === seasonKey)
    const prev = seasons[idx + 1] // seasons are newest-first
    if (!prev) {
      setPrevDiscoveries([])
      return
    }
    setPrevDiscoveries([])
    const controller = new AbortController()
    fetchFanDiscoveries(prev.year, prev.month, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setPrevDiscoveries(data)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error(err)
      })
    return () => controller.abort()
  }, [seasonKey, seasons])

  const discoveriesMap = useMemo(() => keyDiscoveriesByMostRecent(discoveries), [discoveries])
  const prevDiscoveriesMap = useMemo(() => keyDiscoveriesByMostRecent(prevDiscoveries), [prevDiscoveries])

  const filteredFanTable = useMemo(() => {
    const data = TAB_DATA_MAP[activeTab].data()

    if (!search.trim()) return data
    const lowerSearch = search.toLowerCase().trim()
    return data.filter((item) => {
      if (
        item.name.toLowerCase().includes(lowerSearch) ||
        item.description.toLowerCase().includes(lowerSearch) ||
        item.fan.toString() === lowerSearch
      )
        return true
      // Also match against visible champion badges only (mirrors hasCurrent / hasPrev display logic)
      if (activeTab === 'GUOBIAO' && seasonKey !== 'all') {
        const currentDiscovery = discoveriesMap[item.name]
        const currentChampion = currentDiscovery?.playerName?.toLowerCase()
        if (currentChampion?.includes(lowerSearch)) return true
        // Only match prev champion if there is no current-season champion discovery object
        if (!currentDiscovery) {
          const prevChampion = prevDiscoveriesMap[item.name]?.playerName?.toLowerCase()
          if (prevChampion?.includes(lowerSearch)) return true
        }
      }
      return false
    })
  }, [search, activeTab, discoveriesMap, prevDiscoveriesMap, seasonKey])

  const groupedAndSortedFans = useMemo(() => {
    const grouped = filteredFanTable.reduce((acc, current) => {
      if (!acc[current.fan]) {
        acc[current.fan] = []
      }
      acc[current.fan].push(current)
      return acc
    }, {} as Record<number, FanItem[]>)

    return grouped
  }, [filteredFanTable])

  // Get sorting order ascending
  const fans = Object.keys(groupedAndSortedFans)
    .map(Number)
    .sort((a, b) => a - b)

  const getFanLabel = (fan: number) => {
    if (activeTab === 'RIICHI') {
      if (fan === 13) return '役满'
    }
    if (activeTab === 'DONGBEI') {
      if (fan === 0) return '规则概览'
      return `${fan} 番`
    }
    return `${fan} 番`
  }

  const activeMode = GAME_MODES.find((m) => m.key === activeTab)!

  return (
    <div className="fan-table-page">
      <div className="card">
        <div className="flex-between" style={{ marginBottom: 16 }}>
          <h2>{activeMode.fanTableTitle}</h2>
          <div className="tab-bar">
            {GAME_MODES.map((m) => (
              <button
                key={m.key}
                className={`tab-btn ${activeTab === m.key ? 'tab-active' : ''}`}
                onClick={() => setActiveTab(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-between" style={{ marginBottom: 24, flexWrap: 'wrap' }}>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            {activeMode.fanTableSubtitle}
          </p>
          {activeTab === 'GUOBIAO' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a
                href="/guobiao-rules-2014-cn.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-accent btn-small"
                style={{ whiteSpace: 'nowrap', textDecoration: 'none' }}
              >
                📖 官方规则 (中文版)
              </a>
              <a
                href="/guobiao-rules-2014-en.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-small"
                style={{ whiteSpace: 'nowrap', textDecoration: 'none' }}
              >
                🌐 Official Rules (EN)
              </a>
            </div>
          )}
        </div>

        <div className="filter-bar">
          <input
            type="text"
            placeholder="搜索番名、分数、描述或冠名玩家..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 0 }}
          />
          {activeTab === 'GUOBIAO' && seasons.length > 0 && (
            <select value={seasonKey} onChange={(e) => setSeasonKey(e.target.value)} className="select-inline">
              {seasons.map((s) => (
                <option key={`${s.year}-${s.month}`} value={`${s.year}-${s.month}`}>
                  {s.label}
                </option>
              ))}
              <option value="all">全部赛季</option>
            </select>
          )}
        </div>

        {fans.length === 0 && (
          <div className="empty-state">
            <p>没有找到匹配的番型</p>
          </div>
        )}

        {fans.map((fan) => (
          <div key={fan} className="fan-group">
            <h3 className="fan-group-title">{getFanLabel(fan)}</h3>
            <div className="fan-item-grid">
              {groupedAndSortedFans[fan].map((item) => {
                // Badge logic: only for guobiao tab and specific season
                const currentDiscovery =
                  activeTab === 'GUOBIAO' && seasonKey !== 'all' ? discoveriesMap[item.name] : null
                const prevDiscovery =
                  activeTab === 'GUOBIAO' && seasonKey !== 'all' ? prevDiscoveriesMap[item.name] : null
                const hasCurrent = !!currentDiscovery
                const hasPrev = !hasCurrent && !!prevDiscovery
                return (
                  <div key={item.name} className="fan-item-card">
                    <div className="fan-item-header">
                      <span
                        className="fan-item-name"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
                      >
                        {item.name}
                        {hasCurrent && (
                          <span
                            className="badge badge-discovery badge-sm"
                            style={{ fontSize: nameFontSize(currentDiscovery.playerName) }}
                            title={`首位达成者: ${currentDiscovery.playerName}${
                              (currentDiscovery.bonusRp ?? 0) > 0 ? ` (+${currentDiscovery.bonusRp} RP)` : ''
                            }`}
                          >
                            本月冠名: {currentDiscovery.playerName}
                            {(currentDiscovery.bonusRp ?? 0) > 0 && ` (+${currentDiscovery.bonusRp})`}
                          </span>
                        )}
                        {hasPrev && (
                          <span
                            className="badge badge-discovery-prev badge-sm"
                            style={{ fontSize: nameFontSize(prevDiscovery.playerName) }}
                            title={`历史冠名: ${prevDiscovery.playerName}（本月尚未被发现）`}
                          >
                            历史冠名: {prevDiscovery.playerName}
                          </span>
                        )}
                        {item.tags?.map((tag) => (
                          <span key={tag} className="badge badge-completed badge-sm">
                            {tag}
                          </span>
                        ))}
                      </span>
                      <span className="fan-item-score">{getFanLabel(item.fan)}</span>
                    </div>
                    <p className="fan-item-desc">{item.description}</p>
                    {item.example && item.example.length > 0 && (
                      <div className="fan-item-example-container">
                        <span className="example-hint reference">理论参考</span>
                        <div className="fan-item-example">
                          {item.example.split('|').map((group, groupIdx) => {
                            const trimmedGroup = group.trim()
                            const isGroupHighlighted = trimmedGroup.startsWith('*')
                            const cleanGroup = isGroupHighlighted ? trimmedGroup.substring(1).trim() : trimmedGroup
                            const tiles = cleanGroup
                              .split(' ')
                              .map((t) => t.trim())
                              .filter(Boolean)

                            return (
                              <div
                                key={groupIdx}
                                className={`mahjong-group ${isGroupHighlighted ? 'highlighted-group' : ''}`}
                              >
                                {tiles.map((tile, tileIdx) => {
                                  const isTileHighlighted = tile.startsWith('*') || tile.startsWith('^')
                                  const cleanTile = isTileHighlighted ? tile.substring(1) : tile
                                  return (
                                    <img
                                      key={tileIdx}
                                      src={`https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/master/Regular/${cleanTile}.svg`}
                                      alt={cleanTile}
                                      className={`mahjong-tile ${isTileHighlighted ? 'highlighted-tile' : ''}`}
                                    />
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {/* Show real example hand: current month priority, otherwise historical fallback */}
                    {(currentDiscovery?.exampleHand || prevDiscovery?.exampleHand) && (
                      <div className={`fan-item-example-real ${!currentDiscovery?.exampleHand ? 'prev-season' : ''}`}>
                        <MahjongHand
                          hand={(currentDiscovery?.exampleHand || prevDiscovery?.exampleHand) ?? undefined}
                        />
                        <span className={`example-hint ${!currentDiscovery?.exampleHand ? 'prev' : ''}`}>实战例子</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default FanTablePage
