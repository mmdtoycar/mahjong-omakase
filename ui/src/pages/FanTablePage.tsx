import React, { useState, useMemo } from 'react';
import { fanTableData, FanItem } from '../data/fanTableData';
import { riichiFanTableData, RiichiFanItem } from '../data/riichiFanTableData';
import { shenyangFanTableData, ShenyangFanItem } from '../data/shenyangFanTableData';

type TabType = 'guobiao' | 'riichi' | 'shenyang';

const FanTablePage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('guobiao');

  const filteredFanTable = useMemo(() => {
    let data;
    if (activeTab === 'guobiao') data = fanTableData;
    else if (activeTab === 'riichi') data = riichiFanTableData;
    else data = shenyangFanTableData;

    if (!search.trim()) return data;
    const lowerSearch = search.toLowerCase().trim();
    return data.filter(item => 
      item.name.toLowerCase().includes(lowerSearch) || 
      item.description.toLowerCase().includes(lowerSearch) ||
      item.fan.toString() === lowerSearch
    );
  }, [search, activeTab]);

  const groupedAndSortedFans = useMemo(() => {
    const grouped = filteredFanTable.reduce((acc, current) => {
      if (!acc[current.fan]) {
        acc[current.fan] = [];
      }
      acc[current.fan].push(current);
      return acc;
    }, {} as Record<number, FanItem[]>);
    
    return grouped;
  }, [filteredFanTable]);

  // Get sorting order ascending
  const fans = Object.keys(groupedAndSortedFans)
    .map(Number)
    .sort((a, b) => a - b);

  const getFanLabel = (fan: number) => {
    if (activeTab === 'riichi') {
      if (fan === 13) return '役满';
      if (fan === 26) return '双倍役满';
    }
    if (activeTab === 'shenyang') {
      if (fan === 0) return '规则概览';
      return `${fan} 番`;
    }
    return `${fan} 番`;
  };

  const getTitle = () => {
    if (activeTab === 'guobiao') return '国标麻将81番表';
    if (activeTab === 'riichi') return '日本麻将(雀魂)番表';
    return '东北沈阳穷胡麻将规则';
  };

  const getSubtitle = () => {
    if (activeTab === 'guobiao') return '快速对照查询中国麻将竞赛规则（国标麻将）的81种番型及分数。';
    if (activeTab === 'riichi') return '快速对照查询日本麻将（以雀魂规则为准）的各级役种及番数。';
    return '学习和查询带有闭门、飘、手把一、旋风杠等浓密地方特色的沈阳穷胡规则。';
  };

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
              雀魂日麻
            </button>
            <button
              className={`tab-btn ${activeTab === 'shenyang' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('shenyang')}
            >
              沈阳穷胡
            </button>
          </div>
        </div>
        <p style={{ color: 'var(--text-light)', marginBottom: '24px' }}>
          {getSubtitle()}
        </p>

        <div style={{ marginBottom: '24px' }}>
          <input
            type="text"
            placeholder="搜索番名、分数或描述..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {fans.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)' }}>
            没有找到匹配的番型
          </div>
        )}

        {fans.map(fan => (
          <div key={fan} className="fan-group">
            <h3 className="fan-group-title">{getFanLabel(fan)}</h3>
            <div className="fan-item-grid">
              {groupedAndSortedFans[fan].map(item => (
                <div key={item.name} className="fan-item-card">
                  <div className="fan-item-header">
                    <span className="fan-item-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {item.name}
                      {item.tags?.map(tag => (
                        <span key={tag} className="badge badge-completed" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>{tag}</span>
                      ))}
                    </span>
                    <span className="fan-item-score">{getFanLabel(item.fan)}</span>
                  </div>
                  <p className="fan-item-desc">{item.description}</p>
                  {item.example && item.example.length > 0 && (
                    <div className="fan-item-example">
                      {item.example.split('|').map((group, groupIdx) => {
                        const trimmedGroup = group.trim();
                        const isGroupHighlighted = trimmedGroup.startsWith('*');
                        const cleanGroup = isGroupHighlighted ? trimmedGroup.substring(1).trim() : trimmedGroup;
                        const tiles = cleanGroup.split(' ').map(t => t.trim()).filter(Boolean);

                        return (
                          <div key={groupIdx} className={`mahjong-group ${isGroupHighlighted ? 'highlighted-group' : ''}`}>
                            {tiles.map((tile, tileIdx) => {
                              const isTileHighlighted = tile.startsWith('*') || tile.startsWith('^');
                              const cleanTile = isTileHighlighted ? tile.substring(1) : tile;
                              return (
                                <img
                                  key={tileIdx}
                                  src={`https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/master/Regular/${cleanTile}.svg`}
                                  alt={cleanTile}
                                  className={`mahjong-tile ${isTileHighlighted ? 'highlighted-tile' : ''}`}
                                />
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FanTablePage;
