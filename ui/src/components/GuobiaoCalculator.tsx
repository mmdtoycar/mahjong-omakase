import React, { useState, useMemo } from 'react';
import { Tile } from '../logic/guobiao/tiles';
import { Meld, GameOptions, CalcResult } from '../logic/guobiao/types';
import { calculateBestScore } from '../logic/guobiao/fan';

type Mode = {
  name: string;
  label: string;
  add: (concealed: Tile[], mings: Meld[], tile: Tile) => { concealed: Tile[], mings: Meld[] };
  canUse: (concealed: Tile[], mings: Meld[]) => boolean;
  isDisabled: (concealed: Tile[], mings: Meld[], tile: Tile) => boolean;
};

const getTileKey = (tile: Tile): string => {
    if (tile.suit === 'm') return `Man${tile.rank}`;
    if (tile.suit === 'p') return `Pin${tile.rank}`;
    if (tile.suit === 's') return `Sou${tile.rank}`;
    if (tile.suit === 'z') {
        if (tile.rank <= 4) return ['Ton', 'Nan', 'Shaa', 'Pei'][tile.rank - 1];
        return ['Chun', 'Hatsu', 'Haku'][tile.rank - 5];
    }
    return 'Back';
};

const getTileName = (tile: Tile): string => {
    if (tile.suit === 'm') return `${tile.rank}万`;
    if (tile.suit === 'p') return `${tile.rank}饼`;
    if (tile.suit === 's') return `${tile.rank}条`;
    if (tile.suit === 'z') {
        if (tile.rank <= 4) return ['东', '南', '西', '北'][tile.rank - 1] + '风';
        return ['中', '发', '白'][tile.rank - 5];
    }
    return '未知';
};

const modes: Mode[] = [
  {
    name: 'normal', label: '单立',
    canUse: (c, m) => (c.length + m.length * 3) < 14,
    isDisabled: (c, m, t) => [...c, ...m.flatMap(x => x.tiles)].filter(x => x.equals(t)).length >= 4,
    add: (c, m, t) => ({ concealed: [...c, t], mings: m }),
  },
  {
    name: 'an-shun', label: '顺',
    canUse: (c, m) => (c.length + m.length * 3) <= 11,
    isDisabled: (c, m, t) => {
        if (t.suit === 'z' || t.rank >= 8) return true;
        const t1 = new Tile(t.suit, t.rank);
        const t2 = new Tile(t.suit, t.rank + 1);
        const t3 = new Tile(t.suit, t.rank + 2);
        const all = [...c, ...m.flatMap(x => x.tiles)];
        return all.filter(x => x.equals(t1)).length >= 4 || all.filter(x => x.equals(t2)).length >= 4 || all.filter(x => x.equals(t3)).length >= 4;
    },
    add: (c, m, t) => ({ concealed: [...c, t, new Tile(t.suit, t.rank + 1), new Tile(t.suit, t.rank + 2)], mings: m }),
  },
  {
    name: 'an-ke', label: '刻',
    canUse: (c, m) => (c.length + m.length * 3) <= 11,
    isDisabled: (c, m, t) => [...c, ...m.flatMap(x => x.tiles)].filter(x => x.equals(t)).length >= 2,
    add: (c, m, t) => ({ concealed: [...c, t, t, t], mings: m }),
  },
  {
    name: 'chi', label: '吃',
    canUse: (c, m) => (c.length + m.length * 3) <= 11,
    isDisabled: (c, m, t) => (t.suit === 'z' || t.rank >= 8),
    add: (c, m, t) => ({ concealed: c, mings: [...m, { type: 'shun', tiles: [t, new Tile(t.suit, t.rank + 1), new Tile(t.suit, t.rank + 2)], isOpen: true }] }),
  },
  {
    name: 'peng', label: '碰',
    canUse: (c, m) => (c.length + m.length * 3) <= 11,
    isDisabled: (c, m, t) => [...c, ...m.flatMap(x => x.tiles)].filter(x => x.equals(t)).length >= 2,
    add: (c, m, t) => ({ concealed: c, mings: [...m, { type: 'ke', tiles: [t, t, t], isOpen: true }] }),
  },
  {
    name: 'ming-gang', label: '明杠',
    canUse: (c, m) => (c.length + m.length * 3) <= 10,
    isDisabled: (c, m, t) => [...c, ...m.flatMap(x => x.tiles)].filter(x => x.equals(t)).length >= 1,
    add: (c, m, t) => ({ concealed: c, mings: [...m, { type: 'gang', tiles: [t, t, t, t], isOpen: true }] }),
  },
  {
    name: 'an-gang', label: '暗杠',
    canUse: (c, m) => (c.length + m.length * 3) <= 10,
    isDisabled: (c, m, t) => [...c, ...m.flatMap(x => x.tiles)].filter(x => x.equals(t)).length >= 1,
    add: (c, m, t) => ({ concealed: c, mings: [...m, { type: 'gang', tiles: [t, t, t, t], isOpen: false }] }),
  },
];

const TileComponent: React.FC<{ 
    tile: Tile; 
    onClick?: () => void; 
    isWinning?: boolean; 
    isBack?: boolean;
    disabled?: boolean;
    size?: 'normal' | 'small';
}> = ({ tile, onClick, isWinning, isBack, disabled, size = 'normal' }) => {
  const tileKey = isBack ? 'Back' : getTileKey(tile);
  return (
    <div 
      className={`calc-tile-container ${size} ${!disabled ? 'selectable' : 'disabled'}`} 
      onClick={!disabled ? onClick : undefined}
    >
      <img
        src={`https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/master/Regular/${tileKey}.svg`}
        alt={isBack ? 'Back' : getTileName(tile)}
        className={`calc-tile ${isWinning ? 'highlighted-tile' : ''} ${isBack ? 'back-tile-svg' : ''}`}
      />
    </div>
  );
};

interface GuobiaoCalculatorProps {
    onSelectScore: (score: number) => void;
    initialOptions?: Partial<GameOptions>;
}

export const GuobiaoCalculator: React.FC<GuobiaoCalculatorProps> = ({ onSelectScore, initialOptions }) => {
    const [concealedTiles, setConcealedTiles] = useState<Tile[]>([]);
    const [melds, setMelds] = useState<Meld[]>([]);
    const [mode, setMode] = useState(modes[0]);
    const [options, setOptions] = useState<GameOptions>({
        isSelfDraw: false, lastTile: false, gangShang: false, juezhang: false,
        quanfeng: 1, menfeng: 1, huaCount: 0, showTingFans: true,
        ...initialOptions
    });

    const currentCount = concealedTiles.length + melds.length * 3;

    const onTileClick = (t: Tile) => {
        if (!mode.canUse(concealedTiles, melds) || mode.isDisabled(concealedTiles, melds, t)) return;
        const result = mode.add(concealedTiles, melds, t);
        setConcealedTiles(result.concealed);
        setMelds(result.mings);
    };
    
    const onHandMingClick = (i: number) => setMelds(prev => prev.filter((_, idx) => idx !== i));

    const onHandTileClick = (tile: Tile) => {
        setConcealedTiles(prev => {
            const idx = prev.findIndex(t => t.equals(tile));
            if (idx === -1) return prev;
            const next = [...prev];
            next.splice(idx, 1);
            return next;
        });
    };

    const huResult: CalcResult | null = useMemo(() => {
        if (currentCount !== 14) return null;
        const lastTile = concealedTiles.length > 0 ? concealedTiles[concealedTiles.length - 1] : undefined;
        return calculateBestScore(concealedTiles, melds, options, lastTile);
    }, [concealedTiles, melds, options, currentCount]);

    const displayConcealed = useMemo(() => {
        const sorted = [...concealedTiles].sort((a, b) => a.compareTo(b));
        if (currentCount === 14 && concealedTiles.length > 0) {
            const last = concealedTiles[concealedTiles.length - 1];
            const idx = sorted.findIndex(t => t.equals(last));
            if (idx !== -1) sorted.splice(idx, 1);
            return sorted;
        }
        return sorted;
    }, [concealedTiles, currentCount]);

    return (
        <div className="guobiao-inline-calculator">
            <div className="calc-top-row">
                <div className="mini-option">
                    <span className="mini-opt-label">圈:</span>
                    {[1,2,3,4].map(v => (
                        <button key={v} className={`micro-btn ${options.quanfeng === v ? 'active' : ''}`} onClick={() => setOptions({...options, quanfeng: v})}>
                            {['东','南','西','北'][v-1]}
                        </button>
                    ))}
                </div>
                <div className="mini-option">
                    <span className="mini-opt-label">门:</span>
                    {[1,2,3,4].map(v => (
                        <button key={v} className={`micro-btn ${options.menfeng === v ? 'active' : ''}`} onClick={() => setOptions({...options, menfeng: v})}>
                            {['东','南','西','北'][v-1]}
                        </button>
                    ))}
                </div>
                <div className="mini-option">
                  <span className="mini-opt-label">花:</span>
                  <input 
                    type="number" 
                    className="hua-input" 
                    value={options.huaCount} 
                    onChange={e => setOptions({...options, huaCount: Number(e.target.value)})} 
                    min="0" max="8" 
                  />
                </div>
            </div>

            <div className="mode-selector-container">
                <div className="mode-group">
                    {modes.map(m => (
                        <button key={m.name} onClick={() => setMode(m)} className={`mode-btn ${mode.name === m.name ? 'active' : ''}`}>
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="tile-grid-compact">
                {Tile.all.map((tile, i) => (
                    <TileComponent 
                        key={i} tile={tile} onClick={() => onTileClick(tile)} 
                        disabled={!mode.canUse(concealedTiles, melds) || mode.isDisabled(concealedTiles, melds, tile)}
                    />
                ))}
            </div>

            <div className="hand-display-area compact">
                {melds.map((m, i) => (
                    <div key={i} className="meld-box small" onClick={() => onHandMingClick(i)}>
                        {m.tiles.map((t, ti) => (
                            <TileComponent key={ti} tile={t} isBack={m.type === 'gang' && !m.isOpen && (ti === 1 || ti === 2)} size="small" />
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
                        <TileComponent tile={concealedTiles[concealedTiles.length - 1]} onClick={() => onHandTileClick(concealedTiles[concealedTiles.length - 1])} size="small" />
                    </div>
                )}
            </div>

            <div className="winning-options-section">
                <div className="options-grid compact">
                    <button className={`opt-btn ${options.isSelfDraw ? 'active' : ''}`} onClick={() => setOptions({...options, isSelfDraw: !options.isSelfDraw})}>自摸</button>
                    <button className={`opt-btn ${options.juezhang ? 'active' : ''}`} onClick={() => setOptions({...options, juezhang: !options.juezhang})}>绝张</button>
                    <button className={`opt-btn ${options.gangShang ? 'active' : ''}`} onClick={() => setOptions({...options, gangShang: !options.gangShang})}>{options.isSelfDraw ? '杠开' : '抢杠'}</button>
                    <button className={`opt-btn ${options.lastTile ? 'active' : ''}`} onClick={() => setOptions({...options, lastTile: !options.lastTile})}>{options.isSelfDraw ? '妙手' : '海底'}</button>
                </div>
            </div>

            {huResult && (
                <div className="result-preview-mini">
                    <div className="score-badge small">
                        <span className="score-num">{huResult.totalScore}</span>
                        <span className="score-unit">番</span>
                    </div>
                    <div className="fan-list-mini">
                        {huResult.fans.map((f, i) => <span key={i} className="mini-fan-tag">{f.name}({f.score})</span>)}
                    </div>
                    <button className="btn btn-primary use-score-btn" disabled={huResult.totalScore < 8} onClick={() => onSelectScore(huResult.totalScore)}>
                        使用 ({huResult.totalScore})
                    </button>
                </div>
            )}
            <style>{`
                .guobiao-inline-calculator {
                    background: #fff; border: 2px solid var(--border); border-radius: 12px; padding: 12px; margin-top: 10px;
                }
                .calc-top-row { display: flex; gap: 12px; margin-bottom: 10px; border-bottom: 1px solid var(--border); padding-bottom: 8px; flex-wrap: wrap; }
                .mini-option { display: flex; align-items: center; gap: 4px; }
                .mini-opt-label { font-size: 0.8rem; font-weight: 700; color: var(--text-light); }
                .hua-input { width: 45px; padding: 2px 4px; border: 1px solid var(--border); border-radius: 4px; font-size: 0.8rem; }
                
                .tile-grid-compact { display: grid; grid-template-columns: repeat(9, 1fr); gap: 2px; margin-bottom: 12px; }
                .tile-grid-compact .calc-tile-container { height: 32px; padding: 1px; }
                
                .hand-display-area.compact { background: var(--bg); padding: 8px; border-radius: 8px; margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 2px; justify-content: center; min-height: 40px; }
                .result-preview-mini { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border); }
                .fan-list-mini { flex: 1; display: flex; flex-wrap: wrap; gap: 3px; max-height: 50px; overflow-y: auto; }
                .mini-fan-tag { font-size: 0.65rem; background: var(--bg); padding: 1px 4px; border-radius: 3px; }
                .use-score-btn { padding: 6px 10px; font-size: 0.85rem; white-space: nowrap; }
                
                .options-grid.compact { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
                .options-grid.compact .opt-btn { padding: 6px 0; font-size: 0.75rem; border: 1px solid var(--border); border-radius: 4px; background: #fff; cursor: pointer; }
                .options-grid.compact .opt-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
                
                .score-badge.small { background: var(--primary); color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
                .score-badge.small .score-num { font-size: 1.1rem; font-weight: 800; line-height: 1; }
                .score-badge.small .score-unit { font-size: 0.5rem; }
                
                .mode-selector-container { margin-bottom: 10px; }
                .mode-group { display: flex; flex-wrap: wrap; gap: 3px; }
                .mode-btn { padding: 4px 8px; font-size: 0.75rem; border: 1px solid var(--border); border-radius: 4px; background: #fff; cursor: pointer; }
                .mode-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
                
                .micro-btn { padding: 2px 6px; font-size: 0.7rem; border: 1px solid var(--border); border-radius: 3px; background: #fff; cursor: pointer; }
                .micro-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
            `}</style>
        </div>
    );
};
