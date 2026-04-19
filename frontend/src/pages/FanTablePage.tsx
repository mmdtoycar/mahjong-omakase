import React, { useState, useMemo } from 'react';
import { fanTableData, FanItem } from '../data/fanTableData';

const FanTablePage: React.FC = () => {
  const [search, setSearch] = useState('');

  const filteredFanTable = useMemo(() => {
    if (!search.trim()) return fanTableData;
    const lowerSearch = search.toLowerCase().trim();
    return fanTableData.filter(item => 
      item.name.toLowerCase().includes(lowerSearch) || 
      item.description.toLowerCase().includes(lowerSearch) ||
      item.fan.toString() === lowerSearch
    );
  }, [search]);

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

  return (
    <div className="fan-table-page">
      <div className="card">
        <h2>国标麻将81番表</h2>
        <p style={{ color: 'var(--text-light)', marginBottom: '24px' }}>
          快速对照查询中国麻将竞赛规则（国标麻将）的81种番型及分数。
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
            <h3 className="fan-group-title">{fan} 番</h3>
            <div className="fan-item-grid">
              {groupedAndSortedFans[fan].map(item => (
                <div key={item.name} className="fan-item-card">
                  <div className="fan-item-header">
                    <span className="fan-item-name">{item.name}</span>
                    <span className="fan-item-score">{item.fan} 番</span>
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
