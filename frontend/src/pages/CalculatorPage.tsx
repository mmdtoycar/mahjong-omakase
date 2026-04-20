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
        const t1 = new Tile(t.type, t.point);
        const t2 = new Tile(t.type, (t.point + 1) as any);
        const t3 = new Tile(t.type, (t.point + 2) as any);
        const all = [...c, ...m.flatMap(x => x.tiles)];
        return all.filter(x => x.equals(t1)).length >= 4 || all.filter(x => x.equals(t2)).length >= 4 || all.filter(x => x.equals(t3)).length >= 4;
    },
    add: (c, m, t) => ({ concealed: [...c, t, Tile.fromString(`${t.rank + 1}${t.suit}`), Tile.fromString(`${t.rank + 2}${t.suit}`)], mings: m }),
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
        return false;
    },
    add: (c, m, t) => ({ concealed: c, mings: [...m, { type: 'shun', tiles: [t, Tile.fromString(`${t.rank + 1}${t.suit}`), Tile.fromString(`${t.rank + 2}${t.suit}`)], isOpen: true }] }),
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

    const onTileClick = useCallback((t: Tile) => {
        if (!mode.canUse(concealedTiles, melds) || mode.isDisabled(concealedTiles, melds, t)) return;
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
                    return countInHand >= 1; 
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
                                <span className="group-hint">副露区:</span>
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
                        
                        {melds.length > 0 && concealedTiles.length > 0 && <div className="hand-divider"></div>}
                        
                        {concealedTiles.length > 0 && (
                            <div className="hand-group animate-right">
                                <span className="group-hint">立牌区:</span>
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
                                        <span className="win-label">和</span>
                                        <TileComponent 
                                            tile={concealedTiles[concealedTiles.length - 1]} 
                                            onClick={() => onHandTileClick(concealedTiles[concealedTiles.length - 1])}
                                            isWinning
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
        </div>
    );
};

export default CalculatorPage;

// --- Styles ---
// Note: These are kept inside the component file for now to avoid global CSS conflicts.
const STYLES = `
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
        padding: 20px;
        font-family: 'Inter', system-ui, sans-serif;
    }

    .solaris-theme .glass-card {
        background: rgba(238, 232, 213, 0.6);
        backdrop-filter: blur(15px);
        border: 1px solid rgba(147, 161, 161, 0.2);
        box-shadow: 0 10px 30px rgba(0,0,0,0.05);
        border-radius: 16px;
        padding: 24px;
        max-width: 1000px;
        margin: 0 auto;
    }

    .solaris-theme .page-header h2 {
        background: linear-gradient(135deg, var(--solaris-base01) 0%, var(--solaris-blue) 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 800;
        margin: 0;
    }

    .compact-header {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 24px;
    }

    .back-home-link {
        text-decoration: none;
        color: var(--solaris-blue);
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    /* Tile Picker Styles */
    .tile-picker-card {
        background: var(--solaris-bg-alt);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 24px;
    }

    .mode-selector-container {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 16px;
    }

    .mode-group {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(0,0,0,0.03);
        padding: 4px 12px;
        border-radius: 20px;
    }

    .group-hint {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        opacity: 0.6;
    }

    .mode-btn {
        border: none;
        background: transparent;
        padding: 6px 12px;
        border-radius: 16px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
        color: var(--solaris-base01);
    }

    .mode-btn.active {
        background: var(--solaris-blue);
        color: white;
    }

    .btn-reset {
        background: var(--solaris-red);
        color: white;
    }

    .tile-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(42px, 1fr));
        gap: 4px;
    }

    /* Tile Styles */
    .calc-tile-container {
        width: 42px;
        height: 56px;
        background: white;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: default;
        transition: transform 0.1s;
    }

    .calc-tile-container.selectable:hover {
        transform: translateY(-4px);
        cursor: pointer;
    }

    .calc-tile-container.disabled {
        opacity: 0.3;
        filter: grayscale(1);
    }

    .calc-tile-container.small {
        width: 32px;
        height: 42px;
    }

    .calc-tile {
        width: 90%;
        height: 90%;
    }

    .highlighted-tile {
        filter: drop-shadow(0 0 4px var(--solaris-blue));
    }

    /* Hand Display Area */
    .hand-display-area {
        display: flex;
        align-items: flex-end;
        gap: 16px;
        padding: 20px;
        background: rgba(255,255,255,0.4);
        border-radius: 12px;
        min-height: 100px;
        margin-bottom: 24px;
        overflow-x: auto;
    }

    .hand-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .tiles-row {
        display: flex;
        gap: 2px;
    }

    .meld-box {
        display: flex;
        gap: 1px;
        background: rgba(0,0,0,0.05);
        padding: 2px;
        border-radius: 4px;
        cursor: pointer;
    }

    .win-tile-area {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }

    .win-label {
        font-size: 10px;
        font-weight: 800;
        color: var(--solaris-red);
        background: rgba(220, 50, 47, 0.1);
        padding: 2px 6px;
        border-radius: 10px;
    }

    /* Result Panel */
    .result-panel {
        background: white;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }

    .result-header {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 20px;
        border-bottom: 1px solid var(--solaris-bg-alt);
        padding-bottom: 16px;
    }

    .score-badge {
        background: var(--solaris-blue);
        color: white;
        width: 80px;
        height: 80px;
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    .score-badge.low-score {
        background: var(--solaris-base1);
    }

    .score-num {
        font-size: 32px;
        font-weight: 800;
        line-height: 1;
    }

    .score-unit {
        font-size: 12px;
        font-weight: 600;
        opacity: 0.8;
    }

    .rules-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 12px;
    }

    .rule-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 16px;
        background: var(--solaris-bg-alt);
        border-radius: 8px;
    }

    .rule-name {
        font-weight: 600;
    }

    .rule-score {
        color: var(--solaris-orange);
        font-weight: 700;
    }

    /* Ting Display */
    .ting-display {
        background: rgba(38, 139, 210, 0.05);
        padding: 16px;
        border-radius: 12px;
        margin-bottom: 24px;
    }

    .ting-tiles {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 8px;
    }

    .ting-tile-item {
        display: flex;
        align-items: center;
        gap: 10px;
        background: white;
        padding: 6px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .ting-tile-item:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }

    .ting-fan {
        font-weight: 700;
        color: var(--solaris-blue);
    }

    .options-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 10px;
        margin-top: 8px;
    }

    .opt-btn {
        background: white;
        border: 1px solid var(--solaris-base1);
        padding: 10px;
        border-radius: 8px;
        cursor: pointer;
        text-align: left;
        color: var(--solaris-base01);
    }

    .opt-btn.active {
        background: var(--solaris-cyan);
        color: white;
        border-color: var(--solaris-cyan);
    }

    .btn-hint {
        font-size: 10px;
        opacity: 0.7;
        display: block;
    }

    .validation-alert {
        background: rgba(220, 50, 47, 0.1);
        color: var(--solaris-red);
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 24px;
        font-weight: 600;
        display: flex;
        gap: 10px;
    }

    .animate-up { animation: slideUp 0.4s ease-out; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleId = 'calculator-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = STYLES;
        document.head.appendChild(style);
    }
}
