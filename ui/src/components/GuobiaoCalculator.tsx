import React, { useState, useMemo, useEffect } from 'react';
import { Tile } from '../logic/guobiao/tiles';
import { Meld, GameOptions, CalcResult } from '../logic/guobiao/types';
import { calculateBestScore } from '../logic/guobiao/fan';
import { checkTing } from '../logic/guobiao/ting';

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
    name: 'normal', label: '单张',
    canUse: (c, m) => (c.length + m.length * 3) < 14,
    isDisabled: (c, m, t) => [...c, ...m.flatMap(x => x.tiles)].filter(x => x.equals(t)).length >= 4,
    add: (c, m, t) => ({ concealed: [...c, t], mings: m }),
  },
  {
    name: 'an-shun', label: '暗顺',
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
    name: 'an-ke', label: '暗刻',
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
    resetTrigger?: number;
    isSelfDraw: boolean;
    onIsSelfDrawChange: (val: boolean) => void;
    onClose: () => void;
}

export const GuobiaoCalculator: React.FC<GuobiaoCalculatorProps> = ({ onSelectScore, initialOptions, resetTrigger, isSelfDraw, onIsSelfDrawChange, onClose }) => {
    const [concealedTiles, setConcealedTiles] = useState<Tile[]>([]);
    const [melds, setMelds] = useState<Meld[]>([]);
    const [mode, setMode] = useState(modes[0]);
    const [options, setOptions] = useState<GameOptions>({
        zimo: isSelfDraw, lastTile: false, gangShang: false, juezhang: false,
        quanfeng: 1, menfeng: 1, huaCount: 0, showTingFans: true,
        ...initialOptions
    });

    // Sync from parent
    useEffect(() => {
        setOptions(prev => ({ ...prev, zimo: isSelfDraw }));
    }, [isSelfDraw]);

    // Handle Reset
    useEffect(() => {
        if (resetTrigger) {
            setConcealedTiles([]);
            setMelds([]);
        }
    }, [resetTrigger]);

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
        const res = calculateBestScore(concealedTiles, melds, options, lastTile);
        // Auto-push score to parent if 8+
        if (res && res.totalScore >= 8) {
            onSelectScore(res.totalScore);
        }
        return res;
    }, [concealedTiles, melds, options, currentCount, onSelectScore]);

    const tingResults = useMemo(() => {
        if (currentCount !== 13) return [];
        return checkTing(concealedTiles, melds, options);
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
                  <button className="micro-btn" style={{ marginLeft: '4px' }} onClick={() => { setConcealedTiles([]); setMelds([]); }}>重置</button>
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
                    <button className={`opt-btn ${options.zimo ? 'active' : ''}`} onClick={() => onIsSelfDrawChange(!options.zimo)}>自摸</button>
                    <button className={`opt-btn ${options.juezhang ? 'active' : ''}`} onClick={() => setOptions({...options, juezhang: !options.juezhang})}>绝张</button>
                    <button className={`opt-btn ${options.gangShang ? 'active' : ''}`} onClick={() => setOptions({...options, gangShang: !options.gangShang})}>{options.zimo ? '杠开' : '抢杠'}</button>
                    <button className={`opt-btn ${options.lastTile ? 'active' : ''}`} onClick={() => setOptions({...options, lastTile: !options.lastTile})}>{options.zimo ? '妙手' : '海底'}</button>
                </div>
            </div>

            {currentCount === 13 && (
                <div className="ting-display-area">
                    <span className="ting-label">听牌提示:</span>
                    <div className="ting-tiles">
                        {tingResults.length === 0 ? (
                            <span className="no-ting-text">未听牌</span>
                        ) : (
                            tingResults.map((r: { tile: Tile; score: number; fans: { name: string }[] }, i: number) => (
                                <div key={i} className={`ting-tile-item ${r.score < 8 ? 'invalid' : ''}`} onClick={() => onTileClick(r.tile)}>
                                    <TileComponent tile={r.tile} size="small" />
                                    <div className="ting-info-stack">
                                        <span className={`ting-score ${r.score < 8 ? 'text-error' : ''}`}>{r.score}</span>
                                        <span className="ting-fan-preview">{r.fans.map((f: { name: string }) => f.name).join(',')}</span>
                                    </div>
                                    {r.score < 8 && <div className="ting-invalid-badge">!</div>}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {huResult && (
                <div className={`result-preview-mini ${huResult.totalScore < 8 ? 'error' : ''}`}>
                    <div className="result-main-row">
                        <div className={`score-badge small ${huResult.totalScore < 8 ? 'badge-error' : ''}`}>
                            <span className="score-num">{huResult.totalScore}</span>
                            <span className="score-unit">番</span>
                        </div>
                        <div className="fan-list-mini">
                            {huResult.fans.map((f, i) => <span key={i} className="mini-fan-tag">{f.name} +{f.score}</span>)}
                        </div>
                    </div>
                    {huResult.totalScore < 8 ? (
                        <div className="score-warning-text">
                            ⚠️ 状态无效：当前组合仅 {huResult.totalScore} 番，不足 8 番起和。
                        </div>
                    ) : (
                        <button className="btn btn-primary use-score-btn" onClick={onClose}>
                            收起算番器 (当前 {huResult.totalScore} 番)
                        </button>
                    )}
                </div>
            )}
            <style>{`
                .guobiao-inline-calculator {
                    background: #fff; border: 2px solid var(--border); border-radius: 12px; padding: 10px; margin-top: 10px;
                    box-sizing: border-box; width: 100%; max-width: 100%; overflow: hidden;
                }
                .calc-top-row { display: flex; gap: 12px; margin-bottom: 10px; border-bottom: 1px solid var(--border); padding-bottom: 8px; flex-wrap: wrap; }
                .mini-option { display: flex; align-items: center; gap: 4px; }
                .mini-opt-label { font-size: 0.8rem; font-weight: 700; color: var(--text-light); }
                .hua-input { width: 45px; padding: 2px 4px; border: 1px solid var(--border); border-radius: 4px; font-size: 0.8rem; }
                
                .tile-grid-compact { display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px; margin-bottom: 12px; }
                .tile-grid-compact .calc-tile-container { height: auto; width: 100%; padding: 2px; border-radius: 4px; background: white; border: 1px solid var(--border); box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
                .calc-tile-container.small { width: 22px; padding: 2px; border-radius: 3px; background: white; border: 1px solid var(--border); box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
                .calc-tile { width: 100%; height: auto; display: block; }
                .calc-tile-container.disabled { opacity: 0.3; filter: grayscale(1); pointer-events: none; }
                .calc-tile-container.selectable:hover { border-color: var(--primary); transform: translateY(-2px); box-shadow: 0 3px 6px rgba(0,0,0,0.15); }
                
                .hand-display-area.compact { background: var(--bg); padding: 8px; border-radius: 8px; margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; min-height: 48px; border: 1px solid var(--border); }
                .tiles-row { display: flex; flex-wrap: wrap; gap: 2px; }
                .meld-box { display: flex; gap: 1px; border: 1px solid var(--border); padding: 1px; border-radius: 4px; background: rgba(0,0,0,0.03); }
                .win-tile-area { border-left: 2px solid var(--accent); padding-left: 6px; margin-left: 4px; display: flex; align-items: center; }
                
                .result-preview-mini { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; padding: 12px; border-top: 1px solid var(--border); background: rgba(26, 71, 42, 0.03); border-radius: 8px; }
                .result-preview-mini.error { background: rgba(192, 57, 43, 0.05); border-top-color: rgba(192, 57, 43, 0.2); }
                .result-main-row { display: flex; align-items: center; gap: 12px; }
                .fan-list-mini { display: flex; flex-wrap: wrap; gap: 4px; }
                .mini-fan-tag { font-size: 0.75rem; font-weight: 600; background: white; border: 1px solid var(--border); padding: 2px 6px; border-radius: 4px; color: var(--primary); }
                .use-score-btn { flex: 1; padding: 10px; font-size: 0.95rem; font-weight: 700; }
                
                .score-badge.small.badge-error { background: var(--danger); }
                .score-warning-text { color: var(--danger); font-size: 0.85rem; font-weight: 600; text-align: center; padding: 4px; }

                .ting-display-area { display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(212, 160, 23, 0.05); border-radius: 8px; border: 1px solid rgba(212, 160, 23, 0.2); margin-top: 12px; }
                .ting-label { font-size: 0.85rem; font-weight: 700; color: var(--accent); }
                .ting-tiles { display: flex; flex-wrap: wrap; gap: 8px; }
                .ting-tile-item { position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: transform 0.2s; background: white; padding: 4px; border-radius: 4px; border: 1px solid rgba(212, 160, 23, 0.2); }
                .ting-tile-item.invalid { border-color: rgba(192, 57, 43, 0.2); background: rgba(192, 57, 43, 0.02); }
                .ting-tile-item:hover { transform: translateY(-2px); border-color: var(--accent); box-shadow: 0 2px 6px rgba(212, 160, 23, 0.2); }
                .ting-tile-item.invalid:hover { border-color: var(--danger); box-shadow: 0 2px 6px rgba(192, 57, 43, 0.2); }
                .ting-info-stack { display: flex; flex-direction: column; align-items: center; margin-top: 4px; padding: 0 4px; }
                .ting-score { font-size: 0.85rem; font-weight: 800; color: var(--accent); line-height: 1.2; }
                .ting-score.text-error { color: var(--danger); }
                .ting-fan-preview { font-size: 0.7rem; color: var(--text-light); text-align: center; word-break: break-all; margin-top: 2px; line-height: 1.2; }
                .ting-invalid-badge { position: absolute; top: -5px; right: -5px; background: var(--danger); color: white; font-size: 0.55rem; width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
                .no-ting-text { font-size: 0.8rem; color: var(--text-light); font-style: italic; }
                
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
