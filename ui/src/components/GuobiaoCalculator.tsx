import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
    isDisabled: (c, m, t) => {
        if (t.suit === 'z' || t.rank >= 8) return true;
        const all = [...c, ...m.flatMap(x => x.tiles)];
        return all.filter(x => x.equals(new Tile(t.suit, t.rank))).length >= 4 ||
               all.filter(x => x.equals(new Tile(t.suit, t.rank + 1))).length >= 4 ||
               all.filter(x => x.equals(new Tile(t.suit, t.rank + 2))).length >= 4;
    },
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
    onSelectScore: (score: number | null) => void;
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
        isSelfDraw: isSelfDraw, lastTile: false, gangShang: false, juezhang: false,
        quanfeng: 1, menfeng: 1, huaCount: 0, showTingFans: true,
        ...initialOptions
    });

    // Sync from parent
    useEffect(() => {
        setOptions(prev => ({ ...prev, isSelfDraw }));
    }, [isSelfDraw]);

    const resetHandState = useCallback(() => {
        setConcealedTiles([]);
        setMelds([]);
        setOptions(prev => ({
            ...prev,
            huaCount: 0,
            juezhang: false,
            gangShang: false,
            lastTile: false
        }));
        setMode(modes[0]);
    }, []);

    // Adjusting state during render pattern - resets tiles when parent triggers reset
    // This is more efficient than useEffect as it avoids an extra render pass.
    // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
    const [prevResetTrigger, setPrevResetTrigger] = useState(resetTrigger);
    if (resetTrigger !== prevResetTrigger) {
        setPrevResetTrigger(resetTrigger);
        resetHandState();
    }

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

    const addTingedTile = (t: Tile) => {
        if (currentCount === 13) {
            setConcealedTiles(prev => [...prev, t]);
        }
    };

    const huResult: CalcResult | null = useMemo(() => {
        if (currentCount !== 14) return null;
        const lastTile = concealedTiles.length > 0 ? concealedTiles[concealedTiles.length - 1] : undefined;
        const res = calculateBestScore(concealedTiles, melds, options, lastTile);
        return res;
    }, [concealedTiles, melds, options, currentCount]);

    useEffect(() => {
        if (currentCount === 14 && huResult && huResult.totalScore >= 8) {
            onSelectScore(huResult.totalScore);
        } else {
            onSelectScore(null);
        }
    }, [huResult, onSelectScore, currentCount]);

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
                  <button className="micro-btn" style={{ marginLeft: '4px' }} onClick={resetHandState}>重置</button>
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
                    <button className={`opt-btn ${options.isSelfDraw ? 'active' : ''}`} onClick={() => onIsSelfDrawChange(!options.isSelfDraw)}>自摸</button>
                    <button className={`opt-btn ${options.juezhang ? 'active' : ''}`} onClick={() => setOptions({...options, juezhang: !options.juezhang})}>绝张</button>
                    <button className={`opt-btn ${options.gangShang ? 'active' : ''}`} onClick={() => setOptions({...options, gangShang: !options.gangShang})}>{isSelfDraw ? '杠开' : '抢杠'}</button>
                    <button className={`opt-btn ${options.lastTile ? 'active' : ''}`} onClick={() => setOptions({...options, lastTile: !options.lastTile})}>{isSelfDraw ? '妙手' : '海底'}</button>
                </div>
            </div>

            {currentCount === 13 && (
                <div className="ting-display-area">
                    <div className="ting-header">
                        <span className="ting-label">听牌提示:</span>
                        {tingResults.length === 0 && <span className="no-ting-text">未听牌</span>}
                    </div>
                    <div className="ting-list">
                        {tingResults.map((r, i) => (
                            <div key={i} className={`ting-row-item ${r.score < 8 ? 'invalid' : ''}`} onClick={() => addTingedTile(r.tile)}>
                                <div className="ting-row-left">
                                    <div className="ting-tile-wrap">
                                        <TileComponent tile={r.tile} />
                                    </div>
                                    <div className={`score-badge small ${r.score < 8 ? 'badge-error' : ''}`}>
                                        <span className="score-num">{r.score}</span>
                                        <span className="score-unit">番</span>
                                    </div>
                                </div>
                                <div className="fan-list-mini">
                                    {r.fans.map((f, fi) => (
                                        <span key={fi} className="mini-fan-tag">
                                            {f.name}{f.count && f.count > 1 ? ` x${f.count}` : ''} +{f.score}
                                        </span>
                                    ))}
                                </div>
                                {r.score < 8 && <div className="ting-row-status">起和不足</div>}
                            </div>
                        ))}
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
                            {huResult.fans.map((f, i) => (
                                <span key={i} className="mini-fan-tag">
                                    {f.name}{f.count && f.count > 1 ? ` x${f.count}` : ''} +{f.score}
                                </span>
                            ))}
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
                .ting-row-item .fan-list-mini { max-width: 200px; }
                .mini-fan-tag { font-size: 0.65rem; font-weight: 600; background: white; border: 1px solid var(--border); padding: 1px 5px; border-radius: 4px; color: var(--primary); white-space: nowrap; }
                .use-score-btn { flex: 1; padding: 10px; font-size: 0.95rem; font-weight: 700; }
                
                .score-badge.small.badge-error { background: var(--danger); }
                .score-warning-text { color: var(--danger); font-size: 0.85rem; font-weight: 600; text-align: center; padding: 4px; }

                .ting-display-area { display: flex; flex-direction: column; gap: 8px; padding: 12px; background: rgba(212, 160, 23, 0.05); border-radius: 10px; border: 1px solid rgba(212, 160, 23, 0.2); margin-top: 12px; }
                .ting-header { display: flex; align-items: center; justify-content: space-between; width: 100%; border-bottom: 1px dashed rgba(212, 160, 23, 0.2); padding-bottom: 6px; }
                .ting-label { font-size: 0.85rem; font-weight: 800; color: var(--accent); }
                .ting-list { display: flex; flex-direction: column; gap: 6px; width: 100%; }
                .ting-row-item { display: flex; align-items: center; gap: 10px; cursor: pointer; transition: all 0.2s; background: #fff; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border); position: relative; }
                .ting-row-item.invalid { border-color: rgba(192, 57, 43, 0.2); background: rgba(192, 57, 43, 0.02); }
                .ting-row-item:hover { transform: translateX(4px); border-color: var(--accent); box-shadow: 2px 2px 8px rgba(212, 160, 23, 0.15); }
                .ting-row-item.invalid:hover { border-color: var(--danger); }
                .ting-row-left { display: flex; align-items: center; gap: 8px; }
                .ting-tile-wrap { width: 32px; flex-shrink: 0; }
                .ting-tile-wrap .calc-tile-container { width: 100%; height: auto; padding: 2px; }
                .ting-row-status { margin-left: auto; font-size: 0.7rem; font-weight: 700; color: var(--danger); background: rgba(192, 57, 43, 0.1); padding: 2px 6px; border-radius: 4px; white-space: nowrap; }
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
