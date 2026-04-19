import React, { useState, useMemo, useCallback } from 'react';
import { Tile, TileType, TilePoint, TileNumberTypes } from '../logic/guobiao/tiles';
import { Hand, Tiles, Hu, Chi, Peng, Gang, Ming, Options } from '../logic/guobiao/types';
import { calcHuBest } from '../logic/guobiao/hu';
import { calcTing } from '../logic/guobiao/ting';

// Mode definition matching XDean logic
type Mode = {
  name: string;
  label: string;
  add: (hand: Hand, tile: Tile) => void;
  disableAll: (hand: Hand) => boolean;
  disable: (hand: Hand) => Tiles;
};

const modes: Mode[] = [
  {
    name: 'normal',
    label: '单立牌',
    add: (h, t) => h.tiles.tiles.push(t),
    disableAll: hand => hand.count === 14,
    disable: hand => hand.usedTiles.filterMoreThan(3),
  },
  {
    name: 'an-shun',
    label: '顺立牌',
    add: (h, t) => h.tiles.tiles.push(t, new Tile(t.type, (t.point + 1) as TilePoint), new Tile(t.type, (t.point + 2) as TilePoint)),
    disableAll: hand => hand.count > 11,
    disable: hand => new Tiles([...Tile.Z,
      ...Tile.All.filter(e => e.point >= 8),
      ...Tile.All.filter(t => {
          const t1 = new Tile(t.type, t.point);
          const t2 = new Tile(t.type, (t.point + 1) as TilePoint);
          const t3 = new Tile(t.type, (t.point + 2) as TilePoint);
          const used = hand.usedTiles;
          return used.count(t1) >= 4 || used.count(t2) >= 4 || used.count(t3) >= 4;
      })]),
  },
  {
    name: 'an-ke',
    label: '刻立牌',
    add: (h, t) => h.tiles.tiles.push(t, t, t),
    disableAll: hand => hand.count > 11,
    disable: hand => hand.usedTiles.filterMoreThan(1),
  },
  {
    name: 'an-dui',
    label: '对子立牌',
    add: (h, t) => h.tiles.tiles.push(t, t),
    disableAll: hand => hand.count > 12,
    disable: hand => hand.usedTiles.filterMoreThan(2),
  },
  {
    name: 'chi',
    label: '吃',
    add: (h, t) => h.mings.push(new Chi(t)),
    disableAll: hand => hand.count >= 12,
    disable: hand => new Tiles([...Tile.Z,
      ...Tile.All.filter(e => e.point >= 8),
      ...hand.usedTiles.filterType(...TileNumberTypes).filterMoreThan(3).tiles
        .flatMap(t => [0, 1, 2]
          .map(d => t.point - d)
          .filter(p => p > 0)
          .map(p => new Tile(t.type, p as TilePoint)))]),
  },
  {
    name: 'peng',
    label: '碰',
    add: (h, t) => h.mings.push(new Peng(t)),
    disableAll: hand => hand.count >= 12,
    disable: hand => hand.usedTiles.filterMoreThan(1),
  },
  {
    name: 'ming-gang',
    label: '明杠',
    add: (h, t) => h.mings.push(new Gang(t, true)),
    disableAll: hand => hand.count >= 12,
    disable: hand => hand.usedTiles.distinct,
  },
  {
    name: 'an-gang',
    label: '暗杠',
    add: (h, t) => h.mings.push(new Gang(t, false)),
    disableAll: hand => hand.count >= 12,
    disable: hand => hand.usedTiles.distinct,
  },
];

const getTileKey = (tile: Tile): string => {
    if (tile.type === 'w') return `Man${tile.point}`;
    if (tile.type === 'b') return `Pin${tile.point}`;
    if (tile.type === 't') return `Sou${tile.point}`;
    if (tile.type === 'z') {
        if (tile.point <= 4) return ['Ton', 'Nan', 'Shaa', 'Pei'][tile.point - 1];
        return ['Chun', 'Hatsu', 'Haku'][tile.point - 5];
    }
    return 'Back';
};

const getTileName = (tile: Tile): string => {
    if (tile.type === 'w') return `${tile.point}万`;
    if (tile.type === 'b') return `${tile.point}饼`;
    if (tile.type === 't') return `${tile.point}条`;
    if (tile.type === 'z') {
        if (tile.point <= 4) return ['东', '南', '西', '北'][tile.point - 1] + '风';
        return ['中', '发', '白'][tile.point - 5];
    }
    return '未知';
};

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
    const [hand, setHand] = useState(() => new Hand(new Tiles([]), []));
    const [mode, setMode] = useState(modes[0]);

    const updateHand = useCallback((f: (h: Hand) => void) => setHand(h => {
        const copy = h.copy();
        f(copy);
        return copy;
    }), []);

    const onTileClick = useCallback((t: Tile) => updateHand(h => mode.add(h, t)), [mode, updateHand]);
    
    const onHandMingClick = useCallback((i: number) => updateHand(h => { h.mings.splice(i, 1); }), [updateHand]);
    const onHandTileClick = useCallback((tile: Tile, isLast: boolean) => updateHand(h => {
        if (isLast && h.count === 14) {
            h.tiles.tiles.splice(h.tiles.length - 1, 1);
        } else {
            const tiles = h.count === 14 ? h.tiles.withoutLast : h.tiles;
            const idx = tiles.indexOf(tile);
            if (idx !== -1) {
                h.tiles.tiles.splice(idx, 1);
            }
        }
    }), [updateHand]);

    const onOptionsChange = useCallback((o: Options) => updateHand(h => { h.option = o; }), [updateHand]);
    const onResetClick = useCallback(() => {
        setHand(new Hand(new Tiles([]), []));
        setMode(modes[0]);
    }, []);

    const allTiles = useMemo(() => Tile.All, []);
    const disableAll = useMemo(() => mode.disableAll(hand), [mode, hand]);
    const disabledTiles = useMemo(() => mode.disable(hand), [mode, hand]);

    const displayConcealed = useMemo(() => {
        const tiles = hand.count === 14 ? hand.tiles.withoutLast.tiles : hand.tiles.tiles;
        return [...tiles].sort((a, b) => a.compareTo(b));
    }, [hand]);

    const tingResults: [Tile, Hu][] | null = useMemo(() => {
        if (hand.count !== 13) return null;
        const tings = calcTing(hand.tiles);
        return tings.map(t => {
            const h = hand.copy();
            h.tiles.tiles.push(t);
            return [t, calcHuBest(h)!] as [Tile, Hu];
        });
    }, [hand]);

    const huResult: Hu | null = useMemo(() => {
        if (hand.count !== 14) return null;
        try {
            return calcHuBest(hand);
        } catch (e) {
            console.error(e);
            return null;
        }
    }, [hand]);

    const addTingedTile = (tile: Tile) => {
        updateHand(h => h.tiles.tiles.push(tile));
    };

    const fengStr = (point: number) => '东南西北'[point - 1];

    return (
        <div className="calculator-page solaris-theme">
            <div className="card glass-card">
                <header className="page-header">
                    <h2>国标麻将算番器 <span className="version-badge">XDean Logic</span></h2>
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
                                    disabled={disableAll || disabledTiles.indexOf(tile) !== -1}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="options-panel">
                        <div className="options-grid">
                            <button className={`opt-btn ${hand.option.zimo ? 'active' : ''}`} onClick={() => onOptionsChange({...hand.option, zimo: !hand.option.zimo})}>
                                自摸
                            </button>
                            <button className={`opt-btn ${hand.option.juezhang ? 'active' : ''}`} onClick={() => onOptionsChange({...hand.option, juezhang: !hand.option.juezhang})}>
                                和绝张
                            </button>
                            <button className={`opt-btn ${hand.option.gangShang ? 'active' : ''}`} onClick={() => onOptionsChange({...hand.option, gangShang: !hand.option.gangShang})}>
                                {hand.option.zimo ? '杠上开' : '抢杠和'}
                            </button>
                            <button className={`opt-btn ${hand.option.lastTile ? 'active' : ''}`} onClick={() => onOptionsChange({...hand.option, lastTile: !hand.option.lastTile})}>
                                {hand.option.zimo ? '妙手回春' : '海底捞月'}
                            </button>
                        </div>
                        
                        <div className="feng-controls">
                            <button className="opt-btn" onClick={() => onOptionsChange({...hand.option, quanfeng: (hand.option.quanfeng % 4 + 1) as TilePoint})}>
                                {fengStr(hand.option.quanfeng)}风圈
                            </button>
                            <button className="opt-btn" onClick={() => onOptionsChange({...hand.option, menfeng: (hand.option.menfeng % 4 + 1) as TilePoint})}>
                                {fengStr(hand.option.menfeng)}风位
                            </button>
                            <div className="flower-selector">
                                <span>花牌: </span>
                                <select 
                                    value={hand.option.hua} 
                                    onChange={e => onOptionsChange({...hand.option, hua: parseInt(e.target.value, 10)})}
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
                            {hand.mings.map((ming, i) => (
                                <div key={i} className="meld-display" onClick={() => onHandMingClick(i)}>
                                    {ming.toMian().toTiles.tiles.map((t, ti) => {
                                        const isConcealedGang = ming.type === 'gang' && !(ming as Gang).open && (ti === 1 || ti === 2);
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
                                    onClick={() => onHandTileClick(tile, false)} 
                                    isSelectable 
                                />
                            ))}
                        </div>
                        {hand.count === 14 && (
                            <div className="win-tile-area">
                                <span className="win-label">和张</span>
                                <TileComponent 
                                    tile={hand.tiles.last} 
                                    onClick={() => onHandTileClick(hand.tiles.last, true)} 
                                    isWinning 
                                    isSelectable 
                                />
                            </div>
                        )}
                    </div>
                    {hand.count < 14 && !tingResults && <div className="hand-placeholder">待选 {14 - hand.count} 张</div>}
                    
                    {tingResults && (
                        <div className="ting-display animate-up">
                            <span className="ting-title">听牌 ({tingResults.length} 张):</span>
                            <div className="ting-tiles">
                                {tingResults.length > 0 ? (
                                    tingResults.sort((a, b) => b[1].totalScore - a[1].totalScore).map(([tile, res], i) => (
                                        <div key={i} className="ting-tile-item" onClick={() => addTingedTile(tile)}>
                                            <TileComponent tile={tile} isSelectable />
                                            <span className="ting-fan">{res.totalScore}番</span>
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
                                <p className="combination-str">{huResult.combination.toString()}</p>
                            </div>
                        </div>
                        <div className="rules-grid">
                            {huResult.fans.map((f, i) => (
                                <div key={i} className="rule-card" title={f.desc}>
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
