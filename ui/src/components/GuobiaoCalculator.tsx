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

    // Sync options when initialOptions prop changes (e.g. from SessionPage)
    useEffect(() => {
        if (initialOptions) {
            setOptions(prev => ({
                ...prev,
                quanfeng: initialOptions.quanfeng ?? prev.quanfeng,
                menfeng: initialOptions.menfeng ?? prev.menfeng,
                huaCount: initialOptions.huaCount ?? prev.huaCount,
            }));
        }
    }, [JSON.stringify(initialOptions)]);

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
                {initialOptions ? (
                    <div className="mini-option">
                        <span className="mini-opt-label">场况:</span>
                        <span className="mini-opt-val">
                            {['东','南','西','北'][options.quanfeng-1]}圈 · {['东','南','西','北'][options.menfeng-1]}风
                        </span>
                    </div>
                ) : (
                    <>
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
                    </>
                )}
                <div className="mini-option">
                  <span className="mini-opt-label">花:</span>
                  <div className="hua-stepper">
                    <button 
                      className="micro-btn" 
                      onClick={() => setOptions(prev => ({ ...prev, huaCount: Math.max(0, prev.huaCount - 1) }))}
                    >
                      -
                    </button>
                    <span className="hua-count">{options.huaCount}</span>
                    <button 
                      className="micro-btn" 
                      onClick={() => setOptions(prev => ({ ...prev, huaCount: Math.min(8, prev.huaCount + 1) }))}
                    >
                      +
                    </button>
                  </div>
                  <button className="micro-btn" style={{ marginLeft: '8px' }} onClick={resetHandState}>重置</button>
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
                    <button className={`opt-btn ${isSelfDraw ? 'active' : ''}`} onClick={() => onIsSelfDrawChange(!isSelfDraw)}>自摸</button>
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

        </div>
    );
};
