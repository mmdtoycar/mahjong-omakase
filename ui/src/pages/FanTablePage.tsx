import React, { useState, useMemo, useEffect } from 'react'
import { fanTableData, FanItem } from '../data/fanTableData'
import { riichiFanTableData } from '../data/riichiFanTableData'
import { shenyangFanTableData } from '../data/shenyangFanTableData'
import { fetchFanDiscoveries, fetchActiveSeasons } from '../api'
import { FanDiscovery, getCurrentSeason, getSeasonLabel, Season } from '../types'
import { MahjongHand } from '../components/MahjongHand'

type TabType = 'guobiao' | 'riichi' | 'shenyang'

const currentSeason = getCurrentSeason()

const FanTablePage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('guobiao')
  // Current season discoveries (for the selected season key)
  const [discoveries, setDiscoveries] = useState<FanDiscovery[]>([])
  // Previous season discoveries (fallback when current season has no record yet)
  const [prevDiscoveries, setPrevDiscoveries] = useState<FanDiscovery[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [seasonKey, setSeasonKey] = useState<string>(`${currentSeason.year}-${currentSeason.month}`)

  // Load active seasons from backend (same as StatsPage)
  useEffect(() => {
    let mounted = true
    fetchActiveSeasons()
      .then((data) => {
        if (!mounted) return
        const list = data
          .map((s) => ({
            year: s.year,
            month: s.month,
            label: getSeasonLabel(s.year, s.month),
          }))
          .sort((a, b) => b.year - a.year || b.month - a.month)
        setSeasons(list)
        if (list.length > 0) {
          setSeasonKey((prev) =>
            list.some((s) => `${s.year}-${s.month}` === prev) ? prev : `${list[0].year}-${list[0].month}`
          )
        }
      })
      .catch((e) => {
        if (!mounted) return
        console.error(e)
      })
    return () => {
      mounted = false
    }
  }, [])

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

  const discoveriesMap = useMemo(() => {
    const sorted = [...discoveries].sort(
      (a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime()
    )
    return Object.fromEntries(sorted.map((d) => [d.fanName, d]))
  }, [discoveries])
  const prevDiscoveriesMap = useMemo(() => {
    const sorted = [...prevDiscoveries].sort(
      (a, b) => new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime()
    )
    return Object.fromEntries(sorted.map((d) => [d.fanName, d]))
  }, [prevDiscoveries])

  const filteredFanTable = useMemo(() => {
    let data
    if (activeTab === 'guobiao') data = fanTableData
    else if (activeTab === 'riichi') data = riichiFanTableData
    else data = shenyangFanTableData

    if (!search.trim()) return data
    const lowerSearch = search.toLowerCase().trim()
    return data.filter(
      (item) =>
        item.name.toLowerCase().includes(lowerSearch) ||
        item.description.toLowerCase().includes(lowerSearch) ||
        item.fan.toString() === lowerSearch
    )
  }, [search, activeTab])

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
    if (activeTab === 'riichi') {
      if (fan === 13) return '役满'
      if (fan === 26) return '双倍役满'
    }
    if (activeTab === 'shenyang') {
      if (fan === 0) return '规则概览'
      return `${fan} 番`
    }
    return `${fan} 番`
  }

  const getTitle = () => {
    if (activeTab === 'guobiao') return '国标麻将81番表'
    if (activeTab === 'riichi') return '日本麻将(雀魂)番表'
    return '东北沈阳穷胡麻将规则'
  }

  const getSubtitle = () => {
    if (activeTab === 'guobiao') return '快速对照查询中国麻将竞赛规则（国标麻将）的81种番型及分数。'
    if (activeTab === 'riichi') return '快速对照查询日本麻将（以雀魂规则为准）的各级役种及番数。'
    return '学习和查询带有闭门、飘、手把一、旋风杠等浓密地方特色的沈阳穷胡规则。'
  }

  return (
    <div className="fan-table-page">
      <div className="card">
        <div className="flex-between" style={{ marginBottom: '16px' }}>
          <h2>{getTitle()}</h2>
          <div className="tab-bar">
            <button
              className={`tab-btn ${activeTab === 'guobiao' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('guobiao')}
            >
              国标麻将
            </button>
            <button
              className={`tab-btn ${activeTab === 'riichi' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('riichi')}
            >
              立直麻将
            </button>
            <button
              className={`tab-btn ${activeTab === 'shenyang' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('shenyang')}
            >
              东北麻将
            </button>
          </div>
        </div>
        <p style={{ color: 'var(--text-light)', marginBottom: '24px' }}>{getSubtitle()}</p>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="搜索番名、分数或描述..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '200px' }}
          />
          {activeTab === 'guobiao' && seasons.length > 0 && (
            <select value={seasonKey} onChange={(e) => setSeasonKey(e.target.value)} className="select-inline">
              {seasons.map((s: Season) => (
                <option key={`${s.year}-${s.month}`} value={`${s.year}-${s.month}`}>
                  {s.label}
                </option>
              ))}
              <option value="all">全部赛季</option>
            </select>
          )}
        </div>

        {fans.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>没有找到匹配的番型</div>
        )}

        {fans.map((fan) => (
          <div key={fan} className="fan-group">
            <h3 className="fan-group-title">{getFanLabel(fan)}</h3>
            <div className="fan-item-grid">
              {groupedAndSortedFans[fan].map((item) => {
                // Badge logic: only for guobiao tab and specific season
                const currentDiscovery =
                  activeTab === 'guobiao' && seasonKey !== 'all' ? discoveriesMap[item.name] : null
                const prevDiscovery =
                  activeTab === 'guobiao' && seasonKey !== 'all' ? prevDiscoveriesMap[item.name] : null
                const hasCurrent = !!currentDiscovery
                const hasPrev = !hasCurrent && !!prevDiscovery
                return (
                  <div key={item.name} className="fan-item-card">
                    <div className="fan-item-header">
                      <span className="fan-item-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {item.name}
                        {hasCurrent && (
                          <span
                            className="badge badge-accent"
                            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                            title={`首位达成者: ${currentDiscovery.playerName}${
                              (currentDiscovery.bonusRp ?? 0) > 0 ? ` (+${currentDiscovery.bonusRp} RP)` : ''
                            }`}
                          >
                            🏆 {currentDiscovery.playerName}
                            {(currentDiscovery.bonusRp ?? 0) > 0 && ` (+${currentDiscovery.bonusRp})`}
                          </span>
                        )}
                        {hasPrev && (
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 6px',
                              background: 'var(--text-light)',
                              color: 'white',
                              opacity: 0.6,
                            }}
                            title={`上月冠名: ${prevDiscovery.playerName}（本月尚未被发现）`}
                          >
                            🏆 {prevDiscovery.playerName}
                          </span>
                        )}
                        {item.tags?.map((tag) => (
                          <span
                            key={tag}
                            className="badge badge-completed"
                            style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                          >
                            {tag}
                          </span>
                        ))}
                      </span>
                      <span className="fan-item-score">{getFanLabel(item.fan)}</span>
                    </div>
                    <p className="fan-item-desc">{item.description}</p>
                    {item.example && item.example.length > 0 && (
                      <div className="fan-item-example">
                        <span className="example-hint reference">理论参考</span>
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
                    )}
                    {currentDiscovery?.exampleHand && (
                      <div className="fan-item-example-real">
                        <MahjongHand hand={currentDiscovery.exampleHand ?? undefined} />
                        <span className="example-hint">实战例子</span>
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
