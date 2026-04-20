import { calcHuBest } from './hu';
import { Chi, Peng, Gang, Ming, Hand, Tiles, Hu } from './types';

export function calculateBestScore(concealedTiles: Tile[], melds: Meld[], options: GameOptions, lastTile?: Tile): CalcResult | null {
  const hand = new Hand(new Tiles(concealedTiles), melds.map(m => {
    if (m.type === 'shun') return new Chi(m.tiles[0]);
    if (m.type === 'ke') return new Peng(m.tiles[0]);
    if (m.type === 'gang') return new Gang(m.tiles[0], !!m.isOpen);
    return null;
  }).filter(x => x !== null) as Ming[], {
    zimo: options.zimo,
    lastTile: options.lastTile,
    gangShang: options.gangShang,
    juezhang: options.juezhang,
    menfeng: options.menfeng as any,
    quanfeng: options.quanfeng as any,
    hua: options.huaCount
  });
  
  const best = calcHuBest(hand);
  if (!best) return null;
  
  return {
    totalScore: best.totalScore,
    fans: best.fans.map(f => ({ name: f.name, score: f.score })),
    combination: {
      melds: best.combination.mians.map(m => ({
        type: m.type as any,
        tiles: m.toTiles.tiles,
        isOpen: (m as any).open || false
      })),
      isSpecial: best.combination.mians.some(m => !m.simple)
    }
  };
}

import {Tile, TileNumberTypes, TilePoint, TileType, TileTypes} from './tiles';
import {Combination, Dui, Hand, Ke, QiDui, Shun, Tiles, BuKao, Meld, GameOptions, CalcResult} from './types';
import {calcTing} from './ting';

// Simple assert replacement
function assert(condition: any, message?: string) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

export function calcFan(hand: Hand, comb: Combination): Fan[] {
  assert(comb.toTiles.length === 14, '和牌必须14张');
  const withoutLast = hand.tiles.withoutLast;
  const tings = calcTing(withoutLast);
  const res: Fan[] = [];
  for (const fan of ALL_FANS) {
    let match = fan.match(comb, hand, tings);
    if (match) {
      if (match === true) {
        match = 1;
      }
      for (let i = 0; i < match; i++) {
        for (const e of fan.exclude || []) {
          let ex: Fan[];
          if (typeof e === 'function') {
            ex = e(res, comb, hand);
          } else {
            ex = [e];
          }
          for (const f of ex) {
            const idx = res.indexOf(f);
            if (idx !== -1) {
              res.splice(idx, 1);
            }
          }
        }
        res.push(fan);
      }
    }
  }
  if (res.filter(e => e !== Hua).length === 0) {
    res.push(WuFanHu);
  }
  if (res.filter(e => e === XiXiangFeng).length === 2 && res.filter(e => e === YiBanGao).length === 1) {
    const idx = res.indexOf(YiBanGao);
    if (idx !== -1) res.splice(idx, 1);
  }
  if (res.filter(e => e === XiXiangFeng).length === 2 && res.filter(e => e === LaoShaoFu).length === 2) {
    const idx = res.indexOf(LaoShaoFu);
    if (idx !== -1) res.splice(idx, 1);
  }
  if (res.filter(e => e === XiXiangFeng).length === 2 && res.filter(e => e === LianLiu).length === 2) {
    const idx = res.indexOf(LianLiu);
    if (idx !== -1) res.splice(idx, 1);
  }
  return res;
}

export const ALL_FANS: Fan[] = [];

type FanExclude = Fan | ((fans: Fan[], comb: Combination, hand: Hand) => Fan[])

export class Fan {
  readonly name: string;
  readonly score: number;
  readonly match: (comb: Combination, hand: Hand, tings: Tile[]) => boolean | number;
  readonly exclude?: FanExclude[];
  readonly desc: string;

  constructor(
    props: {
      name: string;
      score: number;
      match(comb: Combination, hand: Hand, tings: Tile[]): boolean | number
      exclude?: FanExclude[]
      desc?: string
    },
  ) {
    this.name = props.name;
    this.score = props.score;
    this.match = props.match;
    this.exclude = props.exclude;
    this.desc = props.desc || '';
    ALL_FANS.push(this);
  }
}

// 1 Point
export const YiBanGao = new Fan({
  score: 1,
  name: '一般高',
  match: c => {
    const tiles = new Tiles(c.mians.filter(m => m.type === 'shun').map(m => (m as Shun).tile));
    let meet = 0;
    for (const pair of tiles.pairs()) {
      if (new Tiles(pair).hasSameTypeAndDiff(0)) {
        meet++;
      }
    }
    return Math.min(2, meet);
  },
  desc: '由一种花色2副相同的顺子组成的牌（既可看作三连对子）。',
});

export const XiXiangFeng = new Fan({
  score: 1,
  name: '喜相逢',
  match: c => {
    const tiles = new Tiles(c.mians.filter(m => m.type === 'shun').map(m => (m as Shun).tile));
    let left = new Tiles(tiles);
    let meet = 0;
    for (const pair of tiles.pairs()) {
      if (!left.contains(pair)) {
        continue;
      }
      const t = new Tiles(pair);
      if (t.hasDiff(0) && t.mostType[1] === 1) {
        meet++;
        left = left.without(pair[0]).without(pair[1]);
      }
    }
    return Math.min(2, meet);
  },
  desc: '2种花色2副序数相同的顺子。',
});

export const LianLiu = new Fan({
  score: 1,
  name: '连六',
  match: c => {
    const tiles = new Tiles(c.mians.filter(m => m.type === 'shun').map(m => (m as Shun).tile));
    let meet = 0;
    for (const pair of tiles.pairs()) {
      const t = new Tiles(pair);
      if (t.hasDiff(3) && t.mostType[1] === 2) {
        meet++;
      }
    }
    return Math.min(2, meet);
  },
  desc: '一种花色6张相连接的序数牌。',
});

export const LaoShaoFu = new Fan({
  score: 1,
  name: '老少副',
  match: c => {
    const tiles = new Tiles(c.mians.filter(m => m.type === 'shun').map(m => (m as Shun).tile));
    let meet = 0;
    for (const pair of tiles.pairs()) {
      const t = new Tiles(pair);
      if (t.hasDiff(6) && t.mostType[1] === 2) {
        meet++;
      }
    }
    return Math.min(2, meet);
  },
  desc: '一种花色牌的123、789两副顺子。',
});

export const YaoJiuKe = new Fan({
  score: 1,
  name: '幺九刻',
  match: c => c.mians.filter(m => m.type === 'ke' && (m as Ke).tile.in(Tile.Yao)).length,
  desc: '一、九序数牌或非圈风门风的字牌组成的刻子（或杠）。',
});

export const MingGang = new Fan({
  score: 1,
  name: '明杠',
  match: c => c.mians.filter(m => m.type === 'ke' && (m as Ke).gang && (m as Ke).open).length === 1,
  desc: '自己有暗刻，碰别人打出的一张相同的牌开杠；或自己抓进一张与碰的明刻相同的牌开杠。',
});

export const QueYiMen = new Fan({
  score: 1,
  name: '缺一门',
  match: c => TileNumberTypes.filter(t => c.toTiles.filterType(t as TileType).length === 0).length === 1,
  desc: '和牌中缺少一种花色序数牌。',
});

export const WuZi = new Fan({
  score: 1,
  name: '无字',
  match: c => c.toTiles.filterType('z').length === 0,
  desc: '和牌中没有字牌。',
});

export const BianZhang = new Fan({
  score: 1,
  name: '边张',
  match: (c, h, ts) =>
    ts.length === 1 && (h.tiles.last.point === 3 || h.tiles.last.point === 7) && c.getMianWith(h.tiles.last)
      .some(m => !m.open && m.type === 'shun' && ((m as Shun).tile.point === 1 || (m as Shun).tile.point === 7)),
  desc: '单和123的3及789的7或1233和3、7789和7都为边张。手中有12345和3，56789和7不算和边张。',
});

export const KanZhang = new Fan({
  score: 1,
  name: '坎张',
  match: (c, h, ts) => {
    return ts.length === 1 && c.getMianWith(h.tiles.last)
      .some(m => !m.open && m.type === 'shun' && ((m as Shun).tile.point + 1 === h.tiles.last.point));
  },
  desc: '和2张牌之间的牌，俗称夹张。4556和5也为坎张，手中有45567和6不算坎张。',
  exclude: [BianZhang],
});

export const DanDiaoJiang = new Fan({
  score: 1,
  name: '单钓将',
  match: (c, h, ts) =>
    ts.length === 1 && c.getMianWith(h.tiles.last).some(e => e.type === 'dui'),
  desc: '钓单张牌做将牌成基本和牌型，且整手牌只听这一种牌。',
  exclude: [BianZhang, KanZhang],
});

export const ZiMo = new Fan({
  score: 1,
  name: '自摸',
  match: (_c, h) => h.option.zimo,
  desc: '自己抓进牌成和牌。',
});

export const Hua = new Fan({
  score: 1,
  name: '花牌',
  match: (_c, h) => h.option.hua,
  desc: '即春夏秋冬，梅兰竹菊，每花计一分。不计在起和番内，和牌后才能计分。',
});

// 2 Points
export const JianKe = new Fan({
  score: 2,
  name: '箭刻',
  match: c => c.mians.filter(m => m.type === 'ke' && (m as Ke).tile.in(Tile.Y)).length === 1,
  exclude: [YaoJiuKe],
  desc: '由中、发、白3张相同的牌组成的刻子。',
});

export const QuanFengKe: Fan = new Fan({
  score: 2,
  name: '圈风刻',
  match: (c, h) => c.mians.filter(m => m.type === 'ke' && (m as Ke).tile.type === 'z' && (m as Ke).tile.point === h.option.quanfeng).length === 1,
  exclude: [
    fans => fans.indexOf(MenFengKe) === -1 && fans.indexOf(YaoJiuKe) !== -1 ? [YaoJiuKe] : [],
  ],
  desc: '与圈风相同的风刻。不计幺九刻。',
});

export const MenFengKe = new Fan({
  score: 2,
  name: '门风刻',
  match: (c, h) => c.mians.filter(m => m.type === 'ke' && (m as Ke).tile.type === 'z' && (m as Ke).tile.point === h.option.menfeng).length === 1,
  exclude: [
    fans => fans.indexOf(QuanFengKe) === -1 && fans.indexOf(YaoJiuKe) !== -1 ? [YaoJiuKe] : [],
  ],
  desc: '与本门风相同的风刻。不计幺九刻。',
});

export const MenQianQing = new Fan({
  score: 2,
  name: '门前清',
  match: c => c.mians.every(m => !m.open),
  desc: '没有吃、碰、明杠。',
});

export const PingHu = new Fan({
  score: 2,
  name: '平和',
  match: c => c.mians.map<number>(m => m.type === 'shun' ? 1 : (m.type === 'zu-he-long' ? 3 : 0))
      .reduce((a, b) => a + b) === 4 &&
    c.toTiles.filterType('z').length === 0,
  exclude: [WuZi],
  desc: '由4副顺子及序数牌作将组成的和牌。不计无字。',
});

export const SiGuiYi = new Fan({
  score: 2,
  name: '四归一',
  match: c => c.toTiles.distinct.tiles.map(t => c.toTiles.count(t)).filter(count => count === 4).length,
  desc: '和牌中，有4张相同的牌，不包括杠牌。',
});

export const ShuangTongKe = new Fan({
  score: 2,
  name: '双同刻',
  match: c => {
    const tiles = new Tiles(c.mians.filter(m => m.type === 'ke' && (m as Ke).tile.type !== 'z').map(m => (m as Ke).tile));
    let meet = 0;
    for (const pair of tiles.pairs()) {
      if (new Tiles(pair).hasDiff(0)) {
        meet++;
      }
    }
    return Math.min(2, meet);
  },
  desc: '2副序数相同的刻子。',
});

export const ShuangAnKe = new Fan({
  score: 2,
  name: '双暗刻',
  match: (c, h) => c.mians.filter(m => m.type === 'ke' && (m as Ke).isAnKe(h)).length === 2,
  desc: '2个暗刻',
});

export const AnGang = new Fan({
  score: 2,
  name: '暗杠',
  match: c => c.mians.filter(m => m.type === 'ke' && !(m as Ke).open && (m as Ke).gang).length === 1,
  desc: '自抓4张相同的牌开杠。',
});

export const DuanYao = new Fan({
  score: 2,
  name: '断幺',
  match: c => Tile.Yao.every(t => c.toTiles.count(t) === 0),
  exclude: [WuZi],
  desc: '和牌中没有一、九及字牌。不计无字。',
});

// 4-88 Points
export const QuanDaiYao = new Fan({
  score: 4,
  name: '全带幺',
  match: c => c.mians.every(m => m.simple && m.toTiles.tiles.some(t => t.in(Tile.Yao))),
  desc: '和牌时，每副牌、将牌都有幺九牌。',
});

export const BuQiuRen = new Fan({
  score: 4,
  name: '不求人',
  match: (c, h) => h.option.zimo && c.mians.every(m => !m.open && m.type !== '13yao'),
  exclude: [ZiMo, MenQianQing],
  desc: '自摸和牌，没有吃碰杠（允许暗杠）。不计门前清、自摸。',
});

export const ShuangMingGang = new Fan({
  score: 4,
  name: '双明杠',
  match: c => c.mians.filter(m => m.type === 'ke' && (m as Ke).gang && (m as Ke).open).length >= 2,
  exclude: [MingGang, MingGang],
  desc: '2个明杠。',
});

export const HuJueZhang = new Fan({
  score: 4,
  name: '和绝张',
  match: (c, h) =>
    (h.option.juezhang && h.tiles.count(h.tiles.last) === 1) ||
    new Tiles(c.mians.filter(m => m.open).flatMap(m => m.toTiles.tiles)).count(h.tiles.last) === 3,
  desc: '若牌池、桌面已亮明同一种牌的3张牌，和所剩的第4张牌。',
});

export const PengPengHu = new Fan({
  score: 6,
  name: '碰碰和',
  match: c => c.mians.filter(m => m.type === 'ke').length === 4,
  desc: '由4副刻子（或杠）、将牌组成的和牌。',
});

export const HunYiSe = new Fan({
  score: 6,
  name: '混一色',
  match: c => c.toTiles.distinctTypes.length === 2 && c.toTiles.filterType('z').length > 0,
  desc: '由一种花色序数牌及字牌组成的和牌。',
});

export const SanSeSanBuGao = new Fan({
  score: 6,
  name: '三色三步高',
  match: c => {
    const tiles = new Tiles(c.mians.filter(m => m.type === 'shun').map(m => (m as Shun).tile));
    for (const triple of tiles.triples()) {
      const t = new Tiles(triple);
      if (t.mostType[1] === 1 && t.hasDiff(1)) {
        return true;
      }
    }
    return false;
  },
  desc: '3种花色3副依次递增一位序数的顺子。',
});

export const WuMenQi = new Fan({
  score: 6,
  name: '五门齐',
  match: c => TileTypes.every(t => c.toTiles.filterType(t).length > 0) &&
    Tile.F.some(f => f.in(c.toTiles.tiles)) &&
    Tile.Y.some(f => f.in(c.toTiles.tiles)),
  desc: '和牌时3种序数牌、风、箭牌齐全。',
});

export const QuanQiuRen = new Fan({
  score: 6,
  name: '全求人',
  match: (c, h) => !h.option.zimo && c.mians.filter(m => m.open).length === 4,
  exclude: [DanDiaoJiang],
  desc: '全靠吃碰明杠点和牌。不计单钓将。',
});

export const ShuangJianKe = new Fan({
  score: 6,
  name: '双箭刻',
  match: c => c.mians.filter(m => m.type === 'ke' && (m as Ke).tile.in(Tile.Y)).length === 2,
  exclude: [JianKe, YaoJiuKe, YaoJiuKe],
  desc: '2副箭刻（或杠）。',
});

export const MingAnGang = new Fan({
  score: 6,
  name: '明暗杠',
  match: c => c.mians.filter(m => m.type === 'ke' && (m as Ke).gang).length === 2 &&
    c.mians.filter(m => m.type === 'ke' && (m as Ke).gang && (m as Ke).open).length === 1,
  exclude: [MingGang, AnGang],
  desc: '一个明杠，一个暗杠。',
});

export const HuaLong = new Fan({
  score: 8,
  name: '花龙',
  match: c => {
    const tiles = new Tiles(c.mians.filter(m => m.type === 'shun').map(m => (m as Shun).tile));
    for (const triple of tiles.triples()) {
      const t = new Tiles(triple);
      if (t.mostType[1] === 1 && t.hasDiff(3)) {
        return true;
      }
    }
    return false;
  },
  exclude: [LianLiu, LaoShaoFu],
  desc: '3种花色的3副顺子分别为123,456,789。',
});

export const TuiBuDao = new Fan({
  score: 8,
  name: '推不到',
  match: c => c.toTiles.allIn(Tile.TuiBuDao),
  exclude: [QueYiMen],
  desc: '由牌面图形中心对称的牌组成的和牌。',
});

export const SanSeSanTongShun = new Fan({
  score: 8,
  name: '三色三同順',
  match: c => {
    const tiles = new Tiles(c.mians.filter(m => m.type === 'shun').map(m => (m as Shun).tile));
    for (const triple of tiles.triples()) {
      const t = new Tiles(triple);
      if (t.mostPoint[1] === 3 && t.distinctTypes.length === 3) {
        return true;
      }
    }
    return false;
  },
  exclude: [XiXiangFeng, XiXiangFeng],
  desc: '3种花色3副序数相同的顺子。',
});

export const SanSeSanJieGao = new Fan({
  score: 8,
  name: '三色三节高',
  match: c => {
    const tiles = new Tiles(c.mians.filter(m => m.type === 'ke').map(m => (m as Ke).tile).filter(t => t.type !== 'z'));
    for (const triple of tiles.triples()) {
      const t = new Tiles(triple);
      if (t.mostType[1] === 1 && t.hasDiff(1)) {
        return true;
      }
    }
    return false;
  },
  desc: '3种花色3副依次递增一位数的刻子。',
});

export const WuFanHu = new Fan({
  score: 8,
  name: '无番和',
  match: _ => false, // Handled specially in calcFan
  desc: '和牌后，数不出任何番（不计花牌）。',
});

export const MiaoShouHuiChun = new Fan({
  score: 8,
  name: '妙手回春',
  match: (_c, h) => h.option.lastTile && h.option.zimo,
  exclude: [ZiMo],
  desc: '自摸最后一张牌和牌。',
});

export const HaiDiLaoYue = new Fan({
  score: 8,
  name: '海底捞月',
  match: (_c, h) => h.option.lastTile && !h.option.zimo,
  desc: '和最后一张打出的牌。',
});

export const GangShangKaiHua = new Fan({
  score: 8,
  name: '杠上开花',
  match: (c, h) => h.option.gangShang && h.option.zimo &&
    c.mians.filter(m => m.type === 'ke' && (m as Ke).gang).length > 0,
  exclude: [ZiMo],
  desc: '开杠抓进的牌成和牌。',
});

export const QiangGangHu = new Fan({
  score: 8,
  name: '抢杠和',
  match: (c, h) => h.option.gangShang && !h.option.zimo &&
    c.toTiles.count(h.tiles.last) === 1,
  exclude: [HuJueZhang],
  desc: '和别人加杠的牌。',
});

export const ShuangAnGang = new Fan({
  score: 8,
  name: '双暗杠',
  match: c => c.mians.filter(m => m.type === 'ke' && !(m as Ke).open && (m as Ke).gang).length === 2,
  exclude: [ShuangAnKe],
  desc: '和牌时有两个暗杠。',
});

export const QuanBuKao = new Fan({
  score: 12,
  name: '全不靠',
  match: c => c.mians.filter(m => m.type === 'bu-kao').length === 1,
  exclude: [WuMenQi, MenQianQing, DanDiaoJiang],
  desc: '由单张3种花色147、258、369不能错位的序数牌及东南西北中发白中的任何14张牌组成的和牌。',
});

export const ZuHeLongFan = new Fan({
  score: 12,
  name: '组合龙',
  match: c => {
    const bukao = c.mians.filter(m => m.type === 'bu-kao');
    if (bukao.length > 0) {
      return (bukao[0] as BuKao).toTiles.filterType(...TileNumberTypes).length === 9;
    }
    return c.mians.filter(m => m.type === 'zu-he-long').length === 1;
  },
  desc: '3种花色的147、258、369不能错位的序数牌。',
});

export const DaYuWu = new Fan({
  score: 12,
  name: '大于五',
  match: c => c.toTiles.tiles.every(t => t.type !== 'z' && t.point > 5),
  exclude: [WuZi],
  desc: '由序数牌6~9组成的和牌。',
});

export const XiaoYuWu = new Fan({
  score: 12,
  name: '小于五',
  match: c => c.toTiles.tiles.every(t => t.type !== 'z' && t.point < 5),
  exclude: [WuZi],
  desc: '由序数牌1~4组成的和牌。',
});

export const SanFengKe = new Fan({
  score: 12,
  name: '三风刻',
  match: c => c.mians.filter(m => m.type === 'ke' && (m as Ke).tile.in(Tile.F)).length === 3,
  exclude: [YaoJiuKe, YaoJiuKe, YaoJiuKe],
  desc: '3个风刻。',
});

export const QingLong = new Fan({
  score: 16,
  name: '清龙',
  match: c => {
    const tiles = new Tiles(c.mians.filter(m => m.type === 'shun').map(m => (m as Shun).tile));
    for (const triple of tiles.triples()) {
      if (new Tiles(triple).hasSameTypeAndDiff(3)) {
        return true;
      }
    }
    return false;
  },
  exclude: [LianLiu, LianLiu, LaoShaoFu, LaoShaoFu],
  desc: '一种花色的123,456,789三组顺子。',
});

export const SanSesHuangLongHui = new Fan({
  score: 16,
  name: '三色双龙会',
  match: c => {
    if (c.toTiles.filterType('z').length > 0) return false;
    const duis = c.mians.filter(m => m.type === 'dui');
    if (duis.length !== 1) return false;
    const duiTile = (duis[0] as Dui).tile;
    if (duiTile.point !== 5) return false;
    const types = [...TileTypes];
    types.splice(types.indexOf('z'), 1);
    types.splice(types.indexOf(duiTile.type), 1);
    const shuns = new Tiles(c.mians.filter(m => m.type === 'shun').map(m => (m as Shun).tile));
    return shuns.length === 4 && shuns.equals([1, 7].flatMap(p => types.map(t => new Tile(t, p as TilePoint))));
  },
  exclude: [XiXiangFeng, XiXiangFeng, LaoShaoFu, LaoShaoFu, PingHu],
  desc: '2种花色2个老少副、另一种花色5作将的和牌。',
});

export const YiSeSanBuGao = new Fan({
  score: 16,
  name: '一色三步高',
  match: c => {
    const tiles = new Tiles(c.mians.filter(m => m.type === 'shun').map(m => (m as Shun).tile));
    for (const triple of tiles.triples()) {
      const t = new Tiles(triple);
      if (t.hasSameTypeAndDiff(1) || t.hasSameTypeAndDiff(2)) {
        return true;
      }
    }
    return false;
  },
  desc: '一种花色3副依次递增一位或二位数字的顺子。',
});

export const QuanDaiWu = new Fan({
  score: 16,
  name: '全带五',
  match: c => c.mians.every(m => m.simple && m.toTiles.tiles.some(t => t.type !== 'z' && t.point === 5)),
  exclude: [DuanYao],
  desc: '每副牌及将牌必须有5的序数牌。',
});

export const SanTongKe = new Fan({
  score: 16,
  name: '三同刻',
  match: c => {
    const kes = new Tiles(c.mians.filter(m => m.type === 'ke' && (m as Ke).tile.type !== 'z').map(m => (m as Ke).tile));
    for (const triple of kes.triples()) {
      if (new Tiles(triple).hasDiff(0)) {
        return true;
      }
    }
    return false;
  },
  exclude: [ShuangTongKe, ShuangTongKe],
  desc: '3个序数相同的刻子（杠）。',
});

export const SanAnKe = new Fan({
  score: 16,
  name: '三暗刻',
  match: (c, h) => c.mians.filter(m => m.type === 'ke' && (m as Ke).isAnKe(h)).length === 3,
  desc: '3个暗刻。',
});

export const QiDuiFan = new Fan({
  score: 24,
  name: '七对',
  match: c => c.mians.filter(m => m.type === 'qi-dui').length === 1,
  exclude: [MenQianQing, DanDiaoJiang],
  desc: '由7个对子组成的和牌。',
});

export const QiXingBuKao = new Fan({
  score: 24,
  name: '七星不靠',
  match: c => c.mians.filter(m => m.type === 'bu-kao').length === 1 && c.toTiles.contains(Tile.Z),
  exclude: [WuMenQi, MenQianQing, QuanBuKao],
  desc: '7个单张字牌加上3种花色的7张对应序数牌。',
});

export const QuanShuangKe = new Fan({
  score: 24,
  name: '全双刻',
  match: c =>
    c.mians.filter(m => m.type === 'ke' && (m as Ke).tile.point % 2 === 0 && (m as Ke).tile.type !== 'z').length === 4 &&
    c.mians.filter(m => m.type === 'dui' && (m as Dui).tile.point % 2 === 0 && (m as Dui).tile.type !== 'z').length === 1,
  exclude: [PengPengHu, DuanYao],
  desc: '由2、4、6、8序数牌组成。',
});

export const QingYiSe = new Fan({
  score: 24,
  name: '清一色',
  match: c => c.toTiles.filterType().length === 14 && c.toTiles.filterType('z').length === 0,
  exclude: [WuZi],
  desc: '由一种花色的序数牌组成。',
});

export const YiSeSanTongShun = new Fan({
  score: 24,
  name: '一色三同顺',
  match: c => {
    const shuns = new Tiles(c.mians.filter(m => m.type === 'shun').map(m => (m as Shun).tile));
    for (const triple of shuns.triples()) {
      if (new Tiles(triple).hasSameTypeAndDiff(0)) {
        return true;
      }
    }
    return false;
  },
  exclude: [YiBanGao, YiBanGao],
  desc: '一种花色3副序数相同的顺子。',
});

export const YiSeSanJieGao = new Fan({
  score: 24,
  name: '一色三节高',
  match: c => {
    const tiles = new Tiles(c.mians.filter(m => m.type === 'ke').map(m => (m as Ke).tile).filter(t => t.type !== 'z'));
    for (const triple of tiles.triples()) {
      if (new Tiles(triple).hasSameTypeAndDiff(1)) {
        return true;
      }
    }
    return false;
  },
  desc: '一种花色3副依次递增一位数字的刻子。',
});

export const QuanDa = new Fan({
  score: 24,
  name: '全大',
  match: c => c.toTiles.tiles.every(t => t.type !== 'z' && t.point >= 7),
  exclude: [WuZi, DaYuWu],
  desc: '由序数牌789组成。',
});

export const QuanZhong = new Fan({
  score: 24,
  name: '全中',
  match: c => c.toTiles.tiles.every(t => t.type !== 'z' && t.point >= 4 && t.point <= 6),
  exclude: [WuZi, DuanYao],
  desc: '由序数牌456组成。',
});

export const QuanXiao = new Fan({
  score: 24,
  name: '全小',
  match: c => c.toTiles.tiles.every(t => t.type !== 'z' && t.point <= 3),
  exclude: [WuZi, XiaoYuWu],
  desc: '由序数牌123组成。',
});

export const YiSeSiBuGao = new Fan({
  score: 32,
  name: '一色四步高',
  match: c => {
    const tiles = new Tiles(c.mians.filter(m => m.type === 'shun').map(m => (m as Shun).tile));
    return tiles.length === 4 && (tiles.hasSameTypeAndDiff(1) || tiles.hasSameTypeAndDiff(2));
  },
  exclude: [YiSeSanBuGao, LianLiu, LaoShaoFu],
  desc: '一种花色4副依次递增一位或二位数的顺子。',
});

export const SanGang = new Fan({
  score: 32,
  name: '三杠',
  match: c => c.mians.filter(m => m.type === 'ke' && (m as Ke).gang).length >= 3,
  exclude: [ShuangMingGang, MingAnGang, MingGang],
  desc: '3个杠。',
});

export const HunYaoJiu = new Fan({
  score: 32,
  name: '混幺九',
  match: c => {
    const tiles = c.toTiles;
    const yaojiu = tiles.filterTiles(Tile.YaoJiu).length;
    const zi = tiles.filterType('z').length;
    return c.mians.every(m => m.type !== '13yao') && yaojiu + zi === 14 && yaojiu !== 0 && zi !== 0;
  },
  exclude: [PengPengHu, QuanDaiYao, YaoJiuKe, YaoJiuKe, YaoJiuKe, YaoJiuKe],
  desc: '由字牌和序数牌一、九的刻子及将牌组成。',
});

export const YiSeSiTongShun = new Fan({
  score: 48,
  name: '一色四同顺',
  match: c => {
    const tiles = new Tiles(c.mians.filter(m => m.type === 'shun').map(m => (m as Shun).tile));
    return tiles.length === 4 && tiles.distinct.length === 1;
  },
  exclude: [YiSeSanJieGao, YiSeSanTongShun, YiBanGao, YiBanGao, SiGuiYi, SiGuiYi, SiGuiYi, SiGuiYi],
  desc: '一种花色4副序数相同的顺子。',
});

export const YiSeSiJieGao = new Fan({
  score: 48,
  name: '一色四节高',
  match: c => {
    const tiles = new Tiles(c.mians.filter(m => m.type === 'ke').map(m => (m as Ke).tile).filter(t => t.type !== 'z'));
    return tiles.length === 4 && tiles.hasSameTypeAndDiff(1);
  },
  exclude: [YiSeSanTongShun, YiSeSanJieGao, PengPengHu],
  desc: '一种花色4副依次递增一位数的刻子。',
});

export const QingYaoJiu = new Fan({
  score: 64,
  name: '清幺九',
  match: c => c.toTiles.allIn(Tile.YaoJiu),
  exclude: [HunYaoJiu, PengPengHu, ShuangTongKe, ShuangTongKe, QuanDaiYao, YaoJiuKe, YaoJiuKe, YaoJiuKe, YaoJiuKe, WuZi],
  desc: '由序数牌一、九刻子组成。',
});

export const XiaoSiXi = new Fan({
  score: 64,
  name: '小四喜',
  match: c => c.toTiles.filterTiles(Tile.F).length === 11,
  exclude: [SanFengKe, YaoJiuKe, YaoJiuKe, YaoJiuKe],
  desc: '风牌3副刻子及将牌。',
});

export const XiaoSanYuan = new Fan({
  score: 64,
  name: '小三元',
  match: c => c.toTiles.filterTiles(Tile.Y).length === 8 && c.mians.filter(m => m.type === 'qi-dui').length === 0,
  exclude: [ShuangJianKe, JianKe],
  desc: '箭牌2副刻子及将牌。',
});

export const ZiYiSe = new Fan({
  score: 64,
  name: '字一色',
  match: c => c.toTiles.filterType('z').length === 14,
  exclude: [PengPengHu, QuanDaiYao, YaoJiuKe, YaoJiuKe, YaoJiuKe, YaoJiuKe],
  desc: '由字牌组成。',
});

export const SiAnKe = new Fan({
  score: 64,
  name: '四暗刻',
  match: (c, h) => c.mians.filter(m => m.type === 'ke' && (m as Ke).isAnKe(h)).length === 4,
  exclude: [PengPengHu, MenQianQing],
  desc: '4个暗刻（暗杠）。',
});

export const YiSeShuangLong = new Fan({
  score: 64,
  name: '一色双龙会',
  match: c => {
    const tiles = c.toTiles;
    return c.mians.length === 5 && tiles.equals([1, 1, 2, 2, 3, 3, 5, 5, 7, 7, 8, 8, 9, 9].map(p => new Tile(tiles.last.type, p as TilePoint)));
  },
  exclude: [QingYiSe, PingHu, YiBanGao, YiBanGao, LaoShaoFu, LaoShaoFu],
  desc: '一种花色的两个老少副，5为将牌。',
});

export const DaSiXi = new Fan({
  score: 88,
  name: '大四喜',
  match: c => c.hasKe(Tile.F),
  exclude: [QuanFengKe, MenFengKe, SanFengKe, PengPengHu, QuanDaiYao, YaoJiuKe, YaoJiuKe, YaoJiuKe, YaoJiuKe],
  desc: '4副风刻（杠）。',
});

export const DaSanYuan = new Fan({
  score: 88,
  name: '大三元',
  match: c => c.hasKe(Tile.Y),
  exclude: [JianKe, ShuangJianKe, YaoJiuKe, YaoJiuKe, YaoJiuKe],
  desc: '中发白3副刻子。',
});

export const LvYiSe = new Fan({
  score: 88,
  name: '绿一色',
  match: c => c.toTiles.allIn(Tile.Lv),
  exclude: [HunYiSe],
  desc: '由23468条及发字组成。',
});

export const JiuLianBaoDeng = new Fan({
  score: 88,
  name: '九莲宝灯',
  match: (c, h) => {
    const tiles = c.toTiles;
    const last = h.tiles.last;
    return c.mians.every(m => !m.open) && 
      tiles.split(last)[0].equals([1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 9].map(p => new Tile(last.type, p as TilePoint)));
  },
  exclude: [QingYiSe, MenQianQing, YaoJiuKe],
  desc: '1112345678999组成的特定牌型。',
});

export const SiGang = new Fan({
  score: 88,
  name: '四杠',
  match: c => c.mians.filter(m => m.type === 'ke' && (m as Ke).gang).length === 4,
  exclude: [PengPengHu, DanDiaoJiang, SanGang],
  desc: '4个杠。',
});

export const LianQiDui = new Fan({
  score: 88,
  name: '连七对',
  match: c => {
    const find = c.mians.filter(m => m.type === 'qi-dui');
    if (find.length === 0) return false;
    const qidui = find[0] as QiDui;
    const tiles = qidui.tiles.filterType(qidui.tiles.last.type).distinct;
    return tiles.last.type !== 'z' && tiles.length === 7 && tiles.maxPointTile.point - tiles.minPointTile.point === 6;
  },
  exclude: [QiDuiFan, QingYiSe, MenQianQing, DanDiaoJiang],
  desc: '一种花色序数相连的7个对子。',
});

export const ShiSanYaoSplit = new Fan({
  score: 88,
  name: '十三幺',
  match: c => c.mians.filter(m => m.type === '13yao').length === 1,
  exclude: [WuMenQi, MenQianQing, HunYaoJiu],
  desc: '3种序数牌的一、九牌，7种字牌及其中一对。',
});
