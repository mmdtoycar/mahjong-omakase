import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Tile } from '../logic/guobiao/tiles';
import { Meld, GameOptions, CalcResult } from '../logic/guobiao/types';
import { calculateBestScore } from '../logic/guobiao/fan';
import { checkTing } from '../logic/guobiao/ting';

// Mode definition for the UI
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
    name: 'normal',
    label: '单立牌',
    canUse: (c, m) => (c.length + m.length * 3) < 14,
    isDisabled: (c, m, t) => [...c, ...m.flatMap(x => x.tiles)].filter(x => x.equals(t)).length >= 4,
    add: (c, m, t) => ({ concealed: [...c, t], mings: m }),
  },
  {
    name: 'an-shun',
    label: '顺立牌',
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
    name: 'an-ke',
    label: '刻立牌',
    canUse: (c, m) => (c.length + m.length * 3) <= 11,
    isDisabled: (c, m, t) => [...c, ...m.flatMap(x => x.tiles)].filter(x => x.equals(t)).length >= 2,
    add: (c, m, t) => ({ concealed: [...c, t, t, t], mings: m }),
  },
  {
    name: 'an-dui',
    label: '对子立牌',
    canUse: (c, m) => (c.length + m.length * 3) <= 12,
    isDisabled: (c, m, t) => [...c, ...m.flatMap(x => x.tiles)].filter(x => x.equals(t)).length >= 3,
    add: (c, m, t) => ({ concealed: [...c, t, t], mings: m }),
  },
  {
    name: 'chi',
    label: '吃',
    canUse: (c, m) => (c.length + m.length * 3) <= 11,
    isDisabled: (c, m, t) => {
        if (t.suit === 'z' || t.rank >= 8) return true;
        return false; // Simplified
    },
    add: (c, m, t) => ({ concealed: c, mings: [...m, { type: 'shun', tiles: [t, new Tile(t.suit, t.rank + 1), new Tile(t.suit, t.rank + 2)], isOpen: true }] }),
  },
  {
    name: 'peng',
    label: '碰',
    canUse: (c, m) => (c.length + m.length * 3) <= 11,
    isDisabled: (c, m, t) => [...c, ...m.flatMap(x => x.tiles)].filter(x => x.equals(t)).length >= 2,
    add: (c, m, t) => ({ concealed: c, mings: [...m, { type: 'ke', tiles: [t, t, t], isOpen: true }] }),
  },
  {
    name: 'ming-gang',
    label: '明杠',
    canUse: (c, m) => (c.length + m.length * 3) <= 10,
    isDisabled: (c, m, t) => [...c, ...m.flatMap(x => x.tiles)].filter(x => x.equals(t)).length >= 1,
    add: (c, m, t) => ({ concealed: c, mings: [...m, { type: 'gang', tiles: [t, t, t, t], isOpen: true }] }),
  },
  {
    name: 'an-gang',
    label: '暗杠',
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
    isSelectable?: boolean; 
    disabled?: boolean;
    className?: string;
    size?: 'normal' | 'small';
}> = ({ tile, onClick, isWinning, isBack, isSelectable, disabled, className = "", size = 'normal' }) => {
  const tileKey = isBack ? 'Back' : getTileKey(tile);
  return (
    <div 
      className={`calc-tile-container ${size} ${isSelectable && !disabled ? 'selectable' : ''} ${disabled ? 'disabled' : ''} ${className}`} 
      onClick={!disabled ? onClick : undefined}
      title={isBack ? '暗面' : getTileName(tile)}
    >
      <img
        src={`https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/master/Regular/${tileKey}.svg`}
        alt={isBack ? 'Back' : getTileName(tile)}
        className={`calc-tile ${isWinning ? 'highlighted-tile' : ''} ${isBack ? 'back-tile-svg' : ''}`}
      />
    </div>
  );
};

const CalculatorPage: React.FC = () => {
    const initialOptions: GameOptions = {
        zimo: false,
        lastTile: false,
        gangShang: false,
        juezhang: false,
        quanfeng: 1,
        menfeng: 1,
        huaCount: 0,
        showTingFans: true
    };

    const [concealedTiles, setConcealedTiles] = useState<Tile[]>([]);
    const [melds, setMelds] = useState<Meld[]>([]);
    const [mode, setMode] = useState(modes[0]);
    const [options, setOptions] = useState<GameOptions>(initialOptions);

    const currentCount = useMemo(() => concealedTiles.length + melds.length * 3, [concealedTiles, melds]);

    const lastClickRef = React.useRef<{ time: number; tile: string | null }>({ time: 0, tile: null });

    const onTileClick = useCallback((t: Tile) => {
        const now = Date.now();
        // Simple debounce: prevent clicking the exact same tile within 150ms (common ghost click window)
        if (now - lastClickRef.current.time < 150 && lastClickRef.current.tile === t.toString()) {
            return;
        }
        lastClickRef.current = { time: now, tile: t.toString() };

        if (!mode.canUse(concealedTiles, melds) || mode.isDisabled(concealedTiles, melds, t)) return;
        
        // Use a single batch to avoid intermediate inconsistent states
        const result = mode.add(concealedTiles, melds, t);
        setConcealedTiles(result.concealed);
        setMelds(result.mings);
    }, [mode, concealedTiles, melds]);
    
    const onHandMingClick = useCallback((i: number) => {
        setMelds(prev => prev.filter((_, idx) => idx !== i));
    }, []);

    const onHandTileClick = useCallback((tile: Tile) => {
        setConcealedTiles(prev => {
            const idx = prev.findIndex(t => t.equals(tile));
            if (idx === -1) return prev;
            const next = [...prev];
            next.splice(idx, 1);
            return next;
        });
    }, []);

    const onResetClick = useCallback(() => {
        setConcealedTiles([]);
        setMelds([]);
        setMode(modes[0]);
        setOptions(prev => ({
            ...initialOptions
        }));
    }, [initialOptions]);

    const allTiles = useMemo(() => Tile.all, []);

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

    const tingResults = useMemo(() => {
        if (currentCount !== 13) return null;
        return checkTing(concealedTiles, melds, options);
    }, [concealedTiles, melds, options, currentCount]);

    const huResult: CalcResult | null = useMemo(() => {
        if (currentCount !== 14) return null;
        const lastTile = concealedTiles.length > 0 ? concealedTiles[concealedTiles.length - 1] : undefined;
        return calculateBestScore(concealedTiles, melds, options, lastTile);
    }, [concealedTiles, melds, options, currentCount]);

    const validationError = useMemo(() => {
        if (currentCount === 13 && options.juezhang) {
            const rawTings = checkTing(concealedTiles, melds, { ...options, juezhang: false });
            if (rawTings.length > 0) {
                const impossibleTings = rawTings.filter(res => {
                    const countInHand = concealedTiles.filter(t => t.equals(res.tile)).length + 
                                       melds.reduce((acc, m) => acc + m.tiles.filter(t => t.equals(res.tile)).length, 0);
                    return countInHand >= 1; // If I already have 1, winning on the 2nd (pair) makes 5 tiles needed for Juezhang (3 table + 2 hand)
                });
                if (impossibleTings.length === rawTings.length) {
                    return `绝张错误：当前为“单调将”或类似听牌（手牌已持有所听之牌），不可能凑齐场面显现 3 张且你和第 4 张（共需 5 张）。`;
                }
            }
        }

        if (currentCount === 14 && options.gangShang && !options.zimo) {
            const lastTile = concealedTiles[concealedTiles.length - 1];
            if (lastTile) {
                const countInHand = concealedTiles.filter(t => t.equals(lastTile)).length + 
                                   melds.reduce((acc, m) => acc + m.tiles.filter(t => t.equals(lastTile)).length, 0);
                if (countInHand > 1) {
                    return `抢杠逻辑错误：你手牌已有 ${countInHand-1} 张 ${getTileName(lastTile)}，对方不可能有刻子来给你抢杠。`;
                }
            }
        }
        if (currentCount === 14 && options.juezhang) {
            const lastTile = concealedTiles[concealedTiles.length - 1];
            if (lastTile) {
                const countInHand = concealedTiles.filter(t => t.equals(lastTile)).length + 
                                   melds.reduce((acc, m) => acc + m.tiles.filter(t => t.equals(lastTile)).length, 0);
                if (countInHand > 1) {
                    return `绝张逻辑错误：你手牌已有 ${countInHand-1} 张 ${getTileName(lastTile)}，场面上不可能已显现 3 张。`;
                }
            }
        }
        if (options.zimo && options.gangShang) {
            const hasGang = melds.some(m => m.type === 'gang');
            if (!hasGang) {
                return `逻辑错误：当前手牌中没有“杠”牌，无法达成“杠上开花”。`;
            }
        }
        return null;
    }, [concealedTiles, melds, options, currentCount]);

    const addTingedTile = (tile: Tile) => {
        setConcealedTiles(prev => [...prev, tile]);
    };

    const fengStr = (point: number) => '东南西北'[point - 1];

    return (
        <div className="calculator-page solaris-theme">
            <div className="card glass-card">
                <header className="page-header compact-header">
                    <Link to="/home" className="back-home-link">
                        <span className="back-icon">←</span> 返回首页
                    </Link>
                    <h2>国标麻将算番器</h2>
                </header>

                <section className="input-control-section">
                    <div className="options-panel-top">
                        <div className="extra-options-row">
                            <div className="mini-option">
                                <span className="mini-opt-label">圈:</span>
                                {[1,2,3,4].map(v => (
                                    <button key={v} className={`micro-btn ${options.quanfeng === v ? 'active' : ''}`} onClick={() => setOptions({...options, quanfeng: v})}>{fengStr(v)}</button>
                                ))}
                            </div>
                            <div className="mini-option">
                                <span className="mini-opt-label">门:</span>
                                {[1,2,3,4].map(v => (
                                    <button key={v} className={`micro-btn ${options.menfeng === v ? 'active' : ''}`} onClick={() => setOptions({...options, menfeng: v})}>{fengStr(v)}</button>
                                ))}
                            </div>
                            <div className="mini-option flowers">
                                <span className="mini-opt-label">花:</span>
                                <select className="micro-select" value={options.huaCount} onChange={(e) => setOptions({...options, huaCount: parseInt(e.target.value)})}>
                                    {[0,1,2,3,4,5,6,7,8].map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="tile-picker-card">
                        <div className="mode-selector-container">
                            <div className="mode-group">
                                <span className="group-hint">入立牌:</span>
                                {modes.filter(m => (m.name === 'normal' || m.name.startsWith('an-')) && m.name !== 'an-gang').map(m => (
                                    <button 
                                        key={m.name} 
                                        onClick={() => setMode(m)}
                                        className={`mode-btn ${mode.name === m.name ? 'active' : ''}`}
                                    >
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                            <div className="mode-group">
                                <span className="group-hint">入副露:</span>
                                {modes.filter(m => (!m.name.startsWith('an-') && m.name !== 'normal') || m.name === 'an-gang').map(m => (
                                    <button 
                                        key={m.name} 
                                        onClick={() => setMode(m)}
                                        className={`mode-btn ${mode.name === m.name ? 'active' : ''}`}
                                    >
                                        {m.label}
                                    </button>
                                ))}
                                <button className="mode-btn btn-reset" onClick={onResetClick}>重置</button>
                            </div>
                        </div>
                        <div className="tile-grid">
                            {allTiles.map((tile, i) => (
                                <TileComponent 
                                    key={i} 
                                    tile={tile} 
                                    onClick={() => onTileClick(tile)} 
                                    isSelectable 
                                    disabled={!mode.canUse(concealedTiles, melds) || mode.isDisabled(concealedTiles, melds, tile)}
                                />
                            ))}
                        </div>
                    </div>
                </section>

                <section className="hand-display-section">
                    <div className="hand-display-area">
                        {melds.length > 0 && (
                            <div className="hand-group animate-left">
                                {melds.map((m, i) => (
                                    <div key={i} className="meld-box" onClick={() => onHandMingClick(i)}>
                                        {m.tiles.map((t, ti) => {
                                            const isConcealedGang = m.type === 'gang' && !m.isOpen && (ti === 1 || ti === 2);
                                            return <TileComponent key={ti} tile={t} isBack={isConcealedGang} size="small" />;
                                        })}
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {concealedTiles.length > 0 && (
                            <div className="hand-group animate-right">
                                <div className="tiles-row">
                                    {displayConcealed.map((tile, i) => (
                                        <TileComponent 
                                            key={i} 
                                            tile={tile} 
                                            onClick={() => onHandTileClick(tile)} 
                                            isSelectable 
                                        />
                                    ))}
                                </div>
                                {currentCount === 14 && concealedTiles.length > 0 && (
                                    <div className="win-tile-area">
                                        <TileComponent 
                                            tile={concealedTiles[concealedTiles.length - 1]} 
                                            onClick={() => onHandTileClick(concealedTiles[concealedTiles.length - 1])}
                                            isSelectable
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    {currentCount < 14 && !tingResults && concealedTiles.length === 0 && melds.length === 0 && (
                        <div className="hand-placeholder">待选 {14 - currentCount} 张</div>
                    )}
                    
                    {tingResults && !validationError && (
                        <div className="ting-display animate-up">
                            <span className="ting-title">听牌 ({tingResults.length} 张):</span>
                            <div className="ting-tiles">
                                {tingResults.length > 0 ? (
                                    tingResults.sort((a, b) => b.score - a.score).map((res, i) => (
                                        <div key={i} className="ting-tile-item with-fans" onClick={() => addTingedTile(res.tile)}>
                                            <TileComponent tile={res.tile} isSelectable />
                                            <div className="ting-info">
                                                <span className={`ting-fan ${res.score < 8 ? 'low-score' : ''}`}>
                                                    {res.score}番 {res.score < 8 && <span className="low-status-tag">起和不足</span>}
                                                </span>
                                                {res.fans && (
                                                    <div className="ting-fan-labels">
                                                        {res.fans.map((f: any, fi: number) => (
                                                            <span key={fi} className="mini-fan-name">
                                                                {f.name}({f.score}){f.count && f.count > 1 ? `x${f.count}` : ''}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <span className="no-ting">未下听</span>
                                )}
                            </div>
                        </div>
                    )}

                    {(tingResults || currentCount === 14) && (
                        <div className="winning-options-section animate-up">
                            <span className="section-label">和牌状态:</span>
                            <div className="options-grid">
                                <button className={`opt-btn ${options.zimo ? 'active' : ''}`} onClick={() => setOptions({...options, zimo: !options.zimo})}>
                                    自摸 <span className="btn-hint">+{options.zimo && melds.filter(m=>m.isOpen).length===0 ? '4 (不求人)' : '1'}</span>
                                </button>
                                <button className={`opt-btn ${options.juezhang ? 'active' : ''}`} onClick={() => setOptions({...options, juezhang: !options.juezhang})}>
                                    和绝张 <span className="btn-hint">+4</span>
                                </button>
                                <button className={`opt-btn ${options.gangShang ? 'active' : ''}`} onClick={() => setOptions({...options, gangShang: !options.gangShang})}>
                                    {options.zimo ? '杠上开花' : '抢杠和'} <span className="btn-hint">+8</span>
                                </button>
                                <button className={`opt-btn ${options.lastTile ? 'active' : ''}`} onClick={() => setOptions({...options, lastTile: !options.lastTile})}>
                                    {options.zimo ? '妙手回春' : '海底捞月'} <span className="btn-hint">+8</span>
                                </button>
                            </div>
                        </div>
                    )}
                </section>

                {validationError && (
                    <div className="validation-alert animate-up">
                        <span className="alert-icon">⚠️</span>
                        {validationError}
                    </div>
                )}

                {huResult && !validationError && (
                    <section className="result-panel animate-up">
                        <div className="result-header">
                            <div className={`score-badge ${huResult.totalScore < 8 ? 'low-score' : ''}`}>
                                <span className="score-num">{huResult.totalScore}</span>
                                <span className="score-unit">番</span>
                            </div>
                            <div className="hu-status">
                                <h3>{huResult.totalScore >= 8 ? '和牌成功！' : '及点不足'}</h3>
                                <p style={{opacity: 0.6, margin: '4px 0 0 0'}}>{huResult.totalScore >= 8 ? '符合国标8番起和点数' : '还差 ' + (8 - huResult.totalScore) + ' 番'}</p>
                            </div>
                        </div>
                        <div className="rules-grid">
                            {huResult.fans.map((f, i) => (
                                <div key={i} className="rule-card">
                                    <div className="rule-info">
                                        <span className="rule-name">{f.name}</span>
                                        {f.count !== undefined && f.count > 1 && <span className="rule-count"> x {f.count}</span>}
                                    </div>
                                    <span className="rule-score">+{f.score}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            <style>{`
                /* Solaris (Solarized Light) Palette */
                .solaris-theme {
                    --solaris-bg: #fdf6e3;
                    --solaris-bg-alt: #eee8d5;
                    --solaris-base01: #586e75;
                    --solaris-base02: #073642;
                    --solaris-base1: #93a1a1;
                    --solaris-yellow: #b58900;
                    --solaris-orange: #cb4b16;
                    --solaris-red: #dc322f;
                    --solaris-magenta: #d33682;
                    --solaris-violet: #6c71c4;
                    --solaris-blue: #268bd2;
                    --solaris-cyan: #2aa198;
                    --solaris-green: #859900;
                    
                    background-color: var(--solaris-bg);
                    color: var(--solaris-base01);
                    min-height: 100vh;
                }

                .solaris-theme .glass-card {
                    background: rgba(238, 232, 213, 0.6);
                    backdrop-filter: blur(15px);
                    border: 1px solid rgba(147, 161, 161, 0.2);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.05);
                }

                .solaris-theme .page-header h2 {
                    background: linear-gradient(135deg, var(--solaris-base01) 0%, var(--solaris-blue) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    font-weight: 800;
                }

                /* Unified Tile Style - Using calc prefix to avoid global index.css conflicts */
                .calc-tile-container {
                    width: 38px;
                    height: 50px;
                    flex-shrink: 0;
                    background: #fff;
                    border-radius: 4px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    transition: all 0.15s ease;
                    overflow: hidden;
                    box-sizing: border-box;
                    padding: 4px; /* Further increased white margin */
                    margin: 0;
                }

                .calc-tile-container.selectable { cursor: pointer; touch-action: manipulation; }
                @media (hover: hover) {
                    .calc-tile-container.selectable:hover { transform: translateY(-4px); box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
                }
                .calc-tile-container.selectable:active { transform: scale(0.95); opacity: 0.8; }
                .calc-tile-container.disabled { opacity: 0.15; cursor: not-allowed; pointer-events: none; }

                .calc-tile {
                    width: 100% !important;
                    height: 100% !important;
                    max-width: none !important;
                    object-fit: contain !important; /* Changed back to contain to honor aspect ratio with padding */
                    display: block !important;
                    border: none !important;
                    background: transparent !important;
                    box-shadow: none !important;
                    transform: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }

                .highlighted-tile {
                    box-shadow: inset 0 0 0 3px var(--solaris-yellow) !important;
                    filter: drop-shadow(0 0 8px rgba(181, 137, 0, 0.4));
                }

                .back-tile-svg { filter: saturate(0.5) brightness(0.9); }

                /* Layout */
                .calculator-page { max-width: 1100px; margin: 0 auto; padding: 20px; font-family: 'Outfit', sans-serif; }
                .glass-card { border-radius: 24px; padding: 25px; }
                .page-header { margin-bottom: 20px; text-align: center; }

                .input-control-section { 
                    display: flex;
                    flex-direction: column;
                    gap: 15px; 
                    margin-bottom: 25px; 
                    align-items: flex-start;
                }
                .tile-picker-card { padding: 15px; border-radius: 12px; background: rgba(0,0,0,0.03); width: fit-content; }

                .mode-selector-container { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
                .mode-group { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
                .group-hint { font-size: 0.65rem; font-weight: 800; opacity: 0.6; width: 60px; text-align: right; margin-right: 4px; color: var(--solaris-base02); }
                .mode-btn { padding: 4px 10px; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-weight: 500; font-size: 0.75rem; background: var(--solaris-bg); color: var(--solaris-base01); border: 1px solid var(--solaris-base1); }
                .mode-btn.active { background: var(--solaris-blue); color: white; border-color: var(--solaris-blue); }
                .mode-btn.btn-reset { margin-left: auto; border-color: var(--solaris-red); color: var(--solaris-red); }
                .mode-btn.btn-reset:hover { background: var(--solaris-red); color: white; }

                .tile-grid { 
                    display: grid; 
                    grid-template-columns: repeat(9, 38px); 
                    gap: 8px; 
                    justify-content: start; 
                }

                .options-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
                .opt-btn { padding: 10px 6px; border-radius: 10px; cursor: pointer; font-size: 0.8rem; transition: all 0.2s; font-weight: 700; background: #fff; border: 1px solid var(--solaris-base1); color: var(--solaris-base01); }
                .opt-btn.active { background: var(--solaris-cyan); color: white; border-color: var(--solaris-cyan); box-shadow: 0 4px 10px rgba(42, 161, 152, 0.3); }

                .winning-options-section { margin-top: 20px; padding-top: 15px; border-top: 1px dashed rgba(0,0,0,0.1); }
                .section-label { display: block; font-size: 0.75rem; font-weight: 800; color: var(--solaris-base1); margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }

                 .extra-options { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; padding: 12px; background: rgba(0,0,0,0.02); border-radius: 12px; }
                .option-group { display: flex; align-items: center; gap: 10px; }
                .opt-label { font-size: 0.75rem; font-weight: 700; color: var(--solaris-base01); min-width: 40px; }
                .opt-btns-row { display: flex; gap: 4px; }
                .hua-btns-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; flex: 1; }
                .mini-opt-btn { padding: 4px 0; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-weight: 600; font-size: 0.8rem; background: #fff; border: 1px solid var(--solaris-base1); min-width: 28px; text-align: center; }
                .mini-opt-btn.active { background: var(--solaris-blue); color: white; border-color: var(--solaris-blue); box-shadow: 0 2px 6px rgba(38, 139, 210, 0.4); }
                .mini-opt-btn:hover:not(.active) { background: var(--solaris-bg); }

                .hand-display-section { padding: 45px 25px 35px; border-radius: 20px; margin-bottom: 25px; position: relative; background: var(--solaris-bg-alt); box-shadow: inset 0 0 30px rgba(0,0,0,0.06); }
                .hand-display-area { display: flex; align-items: flex-end; gap: 8px; min-height: 80px; justify-content: center; flex-wrap: wrap; }
                .hand-group { display: flex; align-items: flex-end; gap: 4px; position: relative; flex-wrap: wrap; justify-content: center; }
                .hand-group .group-hint { position: absolute; top: -28px; left: 0; margin: 0; width: auto; font-size: 0.7rem; font-weight: 700; color: var(--solaris-blue); opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px; }
                .meld-box { 
                    display: flex; gap: 1px; align-items: flex-end; transition: transform 0.2s; cursor: pointer; flex-shrink: 0; 
                    padding: 3px; border: 2px solid var(--solaris-cyan); border-radius: 10px; background: rgba(42, 161, 152, 0.05);
                }
                .meld-box:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(42, 161, 152, 0.2); }
                .tiles-row { display: flex; gap: 1px; align-items: flex-end; flex-wrap: wrap; justify-content: center; padding: 5px; }
                .win-tile-area { 
                    display: flex; align-items: flex-end; margin-left: 8px; padding: 3px; 
                    border: 2px solid var(--solaris-yellow); border-radius: 10px; background: rgba(181, 137, 0, 0.05);
                    position: relative; flex-shrink: 0; 
                }
                .win-label { font-size: 0.65rem; font-weight: 800; color: var(--solaris-yellow); position: absolute; top: -22px; width: 100%; text-align: center; }
                .hand-placeholder { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.15; font-size: 1.1rem; font-weight: 700; pointer-events: none; }

                .ting-display { margin-top: 15px; padding-top: 12px; border-top: 1px dashed rgba(0,0,0,0.1); display: flex; align-items: center; gap: 12px; }
                .ting-title { font-size: 0.8rem; font-weight: 700; color: var(--solaris-base01); white-space: nowrap; }
                .ting-tiles { display: flex; flex-wrap: wrap; gap: 8px; padding-bottom: 4px; }
                 .ting-tile-item { display: flex; flex-direction: column; align-items: center; gap: 2px; cursor: pointer; transition: transform 0.15s; position: relative; touch-action: manipulation; }
                .ting-tile-item.with-fans { flex-direction: row; align-items: flex-start; gap: 8px; padding: 6px 10px; background: rgba(0,0,0,0.03); border-radius: 12px; }
                @media (hover: hover) {
                    .ting-tile-item:hover { transform: translateY(-3px); }
                }
                .ting-tile-item:active { transform: scale(0.98); }
                .ting-tile-item .calc-tile-container { width: 30px; height: 42px; flex-shrink: 0; }
                .ting-info { display: flex; flex-direction: column; gap: 2px; align-items: center; }
                .ting-tile-item.with-fans .ting-info { align-items: flex-start; }
                .ting-fan { font-size: 0.85rem; font-weight: 900; color: var(--solaris-blue); display: flex; align-items: center; gap: 6px; }
                .ting-fan.low-score { color: var(--solaris-base1); }
                .low-status-tag { 
                    font-size: 0.6rem; background: var(--solaris-bg); color: var(--solaris-base1); 
                    padding: 1px 4px; border-radius: 4px; border: 1px solid var(--solaris-base1);
                    text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;
                }
                .ting-fan-labels { display: flex; flex-wrap: wrap; gap: 2px; max-width: 100%; }
                .mini-fan-name { font-size: 0.6rem; font-weight: 700; background: var(--solaris-bg-alt); padding: 1px 4px; border-radius: 4px; color: var(--solaris-base01); white-space: nowrap; }
                .no-ting { font-size: 0.85rem; color: var(--solaris-red); font-style: italic; }

                .result-panel { margin-top: 30px; padding: 30px; border-radius: 24px; background: rgba(255,255,255,0.4); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 15px 35px rgba(0,0,0,0.05); }
                .result-header { display: flex; align-items: center; gap: 30px; margin-bottom: 30px; }
                
                .score-badge { 
                    width: 100px; height: 100px; border-radius: 50%; 
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    background: linear-gradient(135deg, var(--solaris-yellow), #d4a017);
                    color: white; box-shadow: 0 10px 25px rgba(181, 137, 0, 0.3);
                    animation: pulse-yellow 2s infinite;
                    flex-shrink: 0;
                }
                .score-badge.low-score { background: linear-gradient(135deg, var(--solaris-base01), var(--solaris-base02)); box-shadow: none; animation: none; opacity: 0.8; }
                .score-num { font-size: 2.2rem; font-weight: 900; line-height: 1; }
                .score-unit { font-size: 0.8rem; font-weight: 700; opacity: 0.9; }
                
                @keyframes pulse-yellow {
                    0% { box-shadow: 0 0 0 0 rgba(181, 137, 0, 0.4); }
                    70% { box-shadow: 0 0 0 15px rgba(181, 137, 0, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(181, 137, 0, 0); }
                }

                .hu-status h3 { font-size: 1.8rem; font-weight: 900; margin: 0; background: linear-gradient(to right, var(--solaris-base01), var(--solaris-base00)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
                
                .rules-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
                .rule-card { 
                    padding: 14px 20px; border-radius: 16px; 
                    display: flex; justify-content: space-between; align-items: center; 
                    background: #fff; border: 1px solid var(--solaris-base2);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .rule-card:hover { transform: scale(1.03) translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.06); border-color: var(--solaris-blue); }
                .rule-info { display: flex; align-items: center; gap: 6px; }
                .rule-name { font-weight: 700; font-size: 1rem; color: var(--solaris-base01); }
                .rule-count { font-size: 0.8rem; font-weight: 800; color: var(--solaris-orange); font-style: italic; opacity: 0.8; }
                .rule-score { 
                    background: var(--solaris-bg); padding: 4px 10px; border-radius: 6px;
                    color: var(--solaris-blue); font-weight: 900; font-size: 0.9rem;
                    border: 1px solid var(--solaris-base1);
                }

                .animate-up { animation: fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }

                .validation-alert { 
                    margin-top: 25px; padding: 15px 20px; border-radius: 16px; 
                    background: #fff5f5; border: 1px solid #feb2b2; color: #c53030;
                    display: flex; align-items: center; gap: 12px; font-weight: 700;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }
                .alert-icon { font-size: 1.4rem; }
                .btn-hint { font-size: 0.65rem; opacity: 0.7; display: block; font-weight: 500; font-family: monospace; }
                .opt-btn.active .btn-hint { color: rgba(255,255,255,0.9); }

                .compact-header { 
                    display: flex; align-items: center; justify-content: space-between; 
                    margin-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 8px;
                }
                .compact-header h2 { margin: 0; font-size: 1.2rem; }
                .back-home-link { 
                    display: flex; align-items: center; gap: 4px; color: var(--solaris-blue); 
                    text-decoration: none; font-size: 0.85rem; font-weight: 700;
                }

                .options-panel-top { margin-bottom: 12px; padding: 10px; background: rgba(0,0,0,0.03); border-radius: 12px; }
                .extra-options-row { display: flex; gap: 15px; align-items: center; flex-wrap: wrap; }
                .mini-option { display: flex; align-items: center; gap: 4px; }
                .mini-opt-label { font-size: 0.75rem; font-weight: 700; color: var(--solaris-base01); }
                .micro-btn { 
                    padding: 2px 6px; border-radius: 4px; border: 1px solid var(--solaris-base1);
                    background: #fff; font-size: 0.7rem; font-weight: 700; cursor: pointer;
                }
                .micro-btn.active { background: var(--solaris-blue); color: white; border-color: var(--solaris-blue); }
                .micro-select { padding: 1px 4px; border-radius: 4px; border: 1px solid var(--solaris-base1); font-size: 0.75rem; font-weight: 700; }

                .mobile-back-home { display: none; }
                @media (max-width: 600px) {
                    .app-header { display: none !important; }
                    .mobile-back-home { display: none; }
                    .compact-header { padding: 4px 0; margin-bottom: 8px; }
                    .compact-header h2 { font-size: 1.1rem; }
                    .back-home-link { font-size: 0.8rem; }
                    
                    .calculator-page { padding: 0; }
                    .glass-card { border-radius: 0; padding: 10px 8px; border: none; box-shadow: none; }
                    .input-control-section { grid-template-columns: 1fr; gap: 8px; }
                    .tile-picker-card { padding: 6px; width: 100%; border: none; background: transparent; }
                    .tile-grid { grid-template-columns: repeat(9, 1fr); width: 100%; gap: 6px; }
                    .calc-tile-container { width: auto; height: 42px; padding: 2px; }
                    .mode-selector-container { gap: 4px; margin-bottom: 8px; }
                    .mode-group { gap: 2px; }
                    .group-hint { width: 45px; font-size: 0.6rem; }
                    .mode-btn { padding: 2px 5px; font-size: 0.65rem; }
                    .btn-reset { font-size: 0.65rem; padding: 2px 8px; }
                    
                    .options-panel-top { padding: 6px; margin-bottom: 6px; }
                    .extra-options-row { gap: 8px; justify-content: space-around; }
                    .mini-option.flowers { margin-left: auto; }

                    .hand-display-section { padding: 30px 8px 15px; margin-bottom: 12px; }
                    .hand-group .group-hint { top: -22px; font-size: 0.6rem; }
                    .hand-divider { margin: 0 6px; height: 35px; }
                    .win-tile-area { margin-left: 6px; padding-left: 6px; }
                    .win-label { top: -18px; }
                    
                    .hand-display-area .calc-tile-container { height: 44px; width: 33px; }
                    .ting-display { flex-direction: column; align-items: flex-start; margin-top: 10px; padding-top: 8px; }
                    .ting-tile-item.with-fans { width: 100%; padding: 4px 8px; }
                    .options-grid { grid-template-columns: repeat(2, 1fr); gap: 6px; }
                    .opt-btn { padding: 6px 4px; border-radius: 8px; font-size: 0.75rem; }
                    
                    .score-badge { width: 60px; height: 60px; }
                    .score-num { font-size: 1.4rem; }
                    .hu-status h3 { font-size: 1.2rem; }
                    .rules-grid { grid-template-columns: 1fr; gap: 8px; }
                    .rule-card { padding: 8px 12px; border-radius: 12px; }
                    .rule-name { font-size: 0.85rem; }
                }
            `}</style>
        </div>
    );
};

export default CalculatorPage;
