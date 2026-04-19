import React, { useState, useMemo, useCallback } from 'react';
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
}> = ({ tile, onClick, isWinning, isBack, isSelectable, disabled, className = "" }) => {
  const tileKey = isBack ? 'Back' : getTileKey(tile);
  return (
    <div 
      className={`calc-tile-container ${isSelectable && !disabled ? 'selectable' : ''} ${disabled ? 'disabled' : ''} ${className}`} 
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
    const [concealedTiles, setConcealedTiles] = useState<Tile[]>([]);
    const [melds, setMelds] = useState<Meld[]>([]);
    const [mode, setMode] = useState(modes[0]);
    const [options, setOptions] = useState<GameOptions>({
        zimo: false,
        lastTile: false,
        gangShang: false,
        juezhang: false,
        quanfeng: 1,
        menfeng: 1,
        huaCount: 0
    });

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
    }, []);

    const allTiles = useMemo(() => Tile.all, []);

    const displayConcealed = useMemo(() => {
        return [...concealedTiles].sort((a, b) => a.compareTo(b));
    }, [concealedTiles]);

    const tingResults = useMemo(() => {
        if (currentCount !== 13) return null;
        return checkTing(concealedTiles, melds, options);
    }, [concealedTiles, melds, options, currentCount]);

    const huResult: CalcResult | null = useMemo(() => {
        if (currentCount !== 14) return null;
        return calculateBestScore(concealedTiles, melds, options);
    }, [concealedTiles, melds, options, currentCount]);

    const addTingedTile = (tile: Tile) => {
        setConcealedTiles(prev => [...prev, tile]);
    };

    const fengStr = (point: number) => '东南西北'[point - 1];

    return (
        <div className="calculator-page solaris-theme">
            <div className="card glass-card">
                <header className="page-header">
                    <h2>国标麻将算番器 <span className="version-badge">Clean Room Edition</span></h2>
                </header>

                <section className="input-control-section">
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

                    <div className="options-panel">
                        <div className="options-grid">
                            <button className={`opt-btn ${options.zimo ? 'active' : ''}`} onClick={() => setOptions({...options, zimo: !options.zimo})}>
                                自摸
                            </button>
                            <button className={`opt-btn ${options.juezhang ? 'active' : ''}`} onClick={() => setOptions({...options, juezhang: !options.juezhang})}>
                                和绝张
                            </button>
                            <button className={`opt-btn ${options.gangShang ? 'active' : ''}`} onClick={() => setOptions({...options, gangShang: !options.gangShang})}>
                                {options.zimo ? '杠上开' : '抢杠和'}
                            </button>
                            <button className={`opt-btn ${options.lastTile ? 'active' : ''}`} onClick={() => setOptions({...options, lastTile: !options.lastTile})}>
                                {options.zimo ? '妙手回春' : '海底捞月'}
                            </button>
                        </div>
                        
                        <div className="feng-controls">
                            <button className="opt-btn" onClick={() => setOptions({...options, quanfeng: (options.quanfeng % 4 + 1)})}>
                                {fengStr(options.quanfeng)}风圈
                            </button>
                            <button className="opt-btn" onClick={() => setOptions({...options, menfeng: (options.menfeng % 4 + 1)})}>
                                {fengStr(options.menfeng)}风位
                            </button>
                            <div className="flower-selector">
                                <span>花牌: </span>
                                <select 
                                    value={options.huaCount} 
                                    onChange={e => setOptions({...options, huaCount: parseInt(e.target.value, 10)})}
                                >
                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="hand-display-section">
                    <div className="hand-container">
                        <div className="mings-area">
                            {melds.map((ming, i) => (
                                <div key={i} className="meld-display" onClick={() => onHandMingClick(i)}>
                                    {ming.tiles.map((t, ti) => {
                                        const isConcealedGang = ming.type === 'gang' && !ming.isOpen && (ti === 1 || ti === 2);
                                        return (
                                            <TileComponent key={ti} tile={t} isBack={isConcealedGang} />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                        <div className="concealed-area">
                            {displayConcealed.map((tile, i) => (
                                <TileComponent 
                                    key={i} 
                                    tile={tile} 
                                    onClick={() => onHandTileClick(tile)} 
                                    isSelectable 
                                />
                            ))}
                        </div>
                    </div>
                    {currentCount < 14 && !tingResults && <div className="hand-placeholder">待选 {14 - currentCount} 张</div>}
                    
                    {tingResults && (
                        <div className="ting-display animate-up">
                            <span className="ting-title">听牌 ({tingResults.length} 张):</span>
                            <div className="ting-tiles">
                                {tingResults.length > 0 ? (
                                    tingResults.sort((a, b) => b.score - a.score).map((res, i) => (
                                        <div key={i} className="ting-tile-item" onClick={() => addTingedTile(res.tile)}>
                                            <TileComponent tile={res.tile} isSelectable />
                                            <span className="ting-fan">{res.score}番</span>
                                        </div>
                                    ))
                                ) : (
                                    <span className="no-ting">未下听</span>
                                )}
                            </div>
                        </div>
                    )}
                </section>

                {huResult && (
                    <section className="result-panel animate-up">
                        <div className="result-header">
                            <div className="score-badge">
                                <span className="score-num">{huResult.totalScore}</span>
                                <span className="score-unit">番</span>
                            </div>
                            <div className="hu-status">
                                <h3>{huResult.totalScore >= 8 ? '和牌成功！' : '点数不足 (需8番)'}</h3>
                            </div>
                        </div>
                        <div className="rules-grid">
                            {huResult.fans.map((f, i) => (
                                <div key={i} className="rule-card">
                                    <span className="rule-name">{f.name}</span>
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
                    width: 42px;
                    height: 56px;
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

                .calc-tile-container.selectable { cursor: pointer; }
                .calc-tile-container.selectable:hover { transform: translateY(-4px); box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
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
                    box-shadow: inset 0 0 0 2px var(--solaris-orange) !important;
                }

                .back-tile-svg { filter: saturate(0.5) brightness(0.9); }

                /* Layout */
                .calculator-page { max-width: 1100px; margin: 0 auto; padding: 20px; font-family: 'Outfit', sans-serif; }
                .glass-card { border-radius: 24px; padding: 25px; }
                .page-header { margin-bottom: 20px; text-align: center; }

                .input-control-section { 
                    display: grid; 
                    grid-template-columns: 1fr 260px; 
                    gap: 20px; 
                    margin-bottom: 25px; 
                    align-items: start;
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
                    grid-template-columns: repeat(9, 42px); 
                    gap: 4px; 
                    justify-content: start; 
                }

                .options-panel { display: flex; flex-direction: column; gap: 8px; }
                .options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
                .opt-btn { padding: 8px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; transition: all 0.2s; font-weight: 500; background: #fff; border: 1px solid var(--solaris-base1); }
                .opt-btn.active { background: var(--solaris-cyan); color: white; border-color: var(--solaris-cyan); }

                .feng-controls { display: flex; flex-direction: column; gap: 6px; }
                .flower-selector { display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: 8px; font-size: 0.8rem; background: #fff; border: 1px solid var(--solaris-base1); }

                .hand-display-section { padding: 25px 20px 15px; border-radius: 12px; margin-bottom: 25px; position: relative; background: var(--solaris-bg-alt); }
                .hand-container { display: flex; align-items: flex-end; gap: 20px; flex-wrap: wrap; min-height: 55px; }
                .mings-area { display: flex; gap: 8px; position: relative; }
                .mings-area::before { content: '副露 (MELDS)'; position: absolute; top: -18px; left: 0; font-size: 0.55rem; font-weight: 800; opacity: 0.5; letter-spacing: 0.05em; }
                .meld-display { display: flex; gap: 1px; cursor: pointer; }
                .concealed-area { display: flex; gap: 1px; padding-left: 20px; border-left: 4px solid var(--solaris-base1); position: relative; }
                .concealed-area::before { content: '立牌 (HAND)'; position: absolute; top: -18px; left: 20px; font-size: 0.55rem; font-weight: 800; opacity: 0.5; letter-spacing: 0.05em; }
                .win-tile-area { display: flex; flex-direction: column; align-items: center; gap: 2px; margin-left: 4px; padding-left: 12px; border-left: 1px dashed rgba(0,0,0,0.2); }
                .win-label { font-size: 0.55rem; font-weight: 800; color: var(--solaris-orange); text-transform: uppercase; }
                .hand-placeholder { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); opacity: 0.15; font-size: 1rem; pointer-events: none; }

                .ting-display { margin-top: 15px; padding-top: 12px; border-top: 1px dashed rgba(0,0,0,0.1); display: flex; align-items: center; gap: 12px; }
                .ting-title { font-size: 0.8rem; font-weight: 700; color: var(--solaris-base01); white-space: nowrap; }
                .ting-tiles { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
                .ting-tile-item { display: flex; flex-direction: column; align-items: center; gap: 2px; cursor: pointer; transition: transform 0.15s; }
                .ting-tile-item:hover { transform: translateY(-3px); }
                .ting-tile-item .calc-tile-container { width: 30px; height: 42px; }
                .ting-fan { font-size: 0.7rem; font-weight: 800; color: var(--solaris-green); }
                .no-ting { font-size: 0.85rem; color: var(--solaris-red); font-style: italic; }

                .hu-status p { font-size: 0.85rem; font-weight: 500; }
                
                .rules-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
                .rule-card { padding: 12px 16px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
                .rule-card:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.05); }
                .rule-name { font-weight: 600; font-size: 0.9rem; }
                .rule-score { font-weight: 900; }

                .animate-up { animation: fadeInUp 0.5s ease-out; }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

                @media (max-width: 900px) {
                    .input-control-section { grid-template-columns: 1fr; }
                    .options-panel { flex-direction: row; flex-wrap: wrap; }
                    .glass-card { padding: 20px; }
                }
            `}</style>
        </div>
    );
};

export default CalculatorPage;
