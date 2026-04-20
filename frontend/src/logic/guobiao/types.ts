import { contentEquals } from './util';
import { Fan } from './fan';
import { Tile, TilePoint, TileType, TileTypes } from './tiles';

/**
 * Meld (面子) Definitions - Compatibility
 */
export type MeldType = 'shun' | 'ke' | 'gang' | 'dui' | 'single' | 'knitted' | 'zuhelong';

export interface Meld {
  type: MeldType;
  tiles: Tile[];
  isOpen: boolean;
  isGang?: boolean; 
}

/**
 * Hand Combination (胡牌组合) - Compatibility
 */
export interface HandCombination {
  melds: Meld[];
  isSpecial?: boolean;
  isBuKao?: boolean;     
  isZuHeLong?: boolean;  
}

/**
 * Game Options - Compatibility
 */
export interface GameOptions {
  zimo: boolean;
  lastTile: boolean;
  gangShang: boolean;
  juezhang: boolean;
  quanfeng: number;
  menfeng: number;
  huaCount: number;
  showTingFans: boolean;
}

/**
 * Fan Result - Compatibility
 */
export interface FanResult {
  name: string;
  score: number;
  count?: number;
}

/**
 * Calculation Result - Compatibility
 */
export interface CalcResult {
  totalScore: number;
  fans: FanResult[];
  combination: HandCombination;
}

// Simple assert replacement
function assert(condition: any, message?: string) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => a.compareTo(b));
}

export function countTiles(tiles: Tile[]): Map<string, number> {
  const counts = new Map<string, number>();
  tiles.forEach(t => {
    const key = t.toString();
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

export function tileCount(tiles: Tile[], target: Tile): number {
  return tiles.filter(t => t.equals(target)).length;
}

export function removeTilesOnce(all: Tile[], toRemove: Tile[]): Tile[] {
  const result = [...all];
  for (const r of toRemove) {
    const idx = result.findIndex(t => t.equals(r));
    if (idx !== -1) result.splice(idx, 1);
  }
  return result;
}

export type Options = {
  zimo: boolean
  lastTile: boolean
  gangShang: boolean
  juezhang: boolean
  menfeng: TilePoint
  quanfeng: TilePoint
  hua: number
}

export class Tiles {
  static of(map: { 't'?: TilePoint[], 'b'?: TilePoint[], 'w'?: TilePoint[], 'z'?: TilePoint[] }) {
    const tiles: Tile[] = [];
    map.t?.forEach(p => tiles.push(new Tile('t', p)));
    map.b?.forEach(p => tiles.push(new Tile('b', p)));
    map.w?.forEach(p => tiles.push(new Tile('w', p)));
    map.z?.forEach(p => tiles.push(new Tile('z', p)));
    return new Tiles(tiles);
  }

  readonly tiles: Tile[];

  constructor(
    tiles: Tile[] | Tiles,
  ) {
    if (tiles instanceof Tiles) {
      this.tiles = [...tiles.tiles];
    } else {
      this.tiles = tiles;
    }
  }

  static from(str: string) {
    const tiles: Tile[] = [];
    let type: TileType = 'z';
    for (const c of str) {
      switch (c) {
        case 'z':
        case 'b':
        case 't':
        case 'w':
          type = c;
          break;
        default:
          const point = Number(c) as TilePoint;
          if (!isNaN(point)) {
            tiles.push(new Tile(type, point));
          }
      }
    }
    return new Tiles(tiles);
  }

  get sorted() {
    return new Tiles(this.tiles.sort((a, b) => a.compareTo(b)));
  }

  get length() {
    return this.tiles.length;
  }

  indexOf(tile: Tile) {
    return this.tiles.findIndex(t => t.equals(tile));
  }

  withTile = (tile: Tile) => new Tiles([...this.tiles, tile]);

  split(...removes: Tile[]): [Tiles, Tiles] {
    const copy = [...this.tiles];
    const removed = [];
    for (const remove of removes) {
      const index = remove.indexIn(copy);
      if (index !== -1) {
        copy.splice(index, 1);
        removed.push(remove);
      }
    }
    return [new Tiles(copy), new Tiles(removed)];
  }

  filterType(...types: TileType[]) {
    if (this.length === 0) return new Tiles([]);
    if (types.length === 0) {
      types = [this.last.type];
    }
    return new Tiles(this.tiles.filter(t => types.indexOf(t.type) !== -1));
  }

  removeType(...types: TileType[]) {
    if (this.length === 0) return new Tiles([]);
    if (types.length === 0) {
      types = [this.last.type];
    }
    return new Tiles(this.tiles.filter(t => types.indexOf(t.type) === -1));
  }

  filterPoint(...points: TilePoint[]) {
    if (this.length === 0) return new Tiles([]);
    return new Tiles(this.tiles.filter(t => points.indexOf(t.point) !== -1));
  }

  filterTiles(tiles: Tiles | Tile[]) {
    if (this.length === 0) return new Tiles([]);
    return new Tiles(this.tiles.filter(t => t.in(tiles)));
  }

  filterMoreThan(count: number) {
    const res = [];
    for (const tile of this.distinct.tiles) {
      if (this.count(tile) > count) {
        res.push(tile);
      }
    }
    return new Tiles(res);
  }

  * pairs() {
    for (let i = 0; i < this.tiles.length; i++) {
      for (let j = i + 1; j < this.tiles.length; j++) {
        yield [this.tiles[i], this.tiles[j]];
      }
    }
  }

  * triples() {
    for (let i = 0; i < this.tiles.length; i++) {
      for (let j = i + 1; j < this.tiles.length; j++) {
        for (let k = j + 1; k < this.tiles.length; k++) {
          yield [this.tiles[i], this.tiles[j], this.tiles[k]];
        }
      }
    }
  }

  get minPointTile(): Tile {
    let min = this.tiles[0];
    for (const tile of this.tiles) {
      if (tile.point < min.point) {
        min = tile;
      }
    }
    return min;
  }

  get maxPointTile(): Tile {
    let max = this.tiles[0];
    for (const tile of this.tiles) {
      if (tile.point > max.point) {
        max = tile;
      }
    }
    return max;
  }

  get distinct(): Tiles {
    const result: Tile[] = [];
    for (const tile of this.tiles) {
      if (!tile.in(result)) {
        result.push(tile);
      }
    }
    return new Tiles(result);
  }

  get distinctTypes(): TileType[] {
    const result: TileType[] = [];
    for (const tile of this.tiles) {
      if (result.indexOf(tile.type) === -1) {
        result.push(tile.type);
      }
    }
    return result;
  }

  get distinctPoints(): TilePoint[] {
    const result: TilePoint[] = [];
    for (const tile of this.tiles) {
      if (result.indexOf(tile.point) === -1) {
        result.push(tile.point);
      }
    }
    return result;
  }

  get last(): Tile {
    return this.tiles[this.tiles.length - 1];
  }

  get withoutLast(): Tiles {
    return new Tiles(this.tiles.slice(0, this.tiles.length - 1));
  }

  without(tile: Tile): Tiles {
    const idx = this.indexOf(tile);
    if (idx !== -1) {
      const copy = [...this.tiles];
      copy.splice(idx, 1);
      return new Tiles(copy);
    } else {
      return this;
    }
  }

  allIn(tiles: Tile[] | Tiles) {
    return this.tiles.every(t => t.in(tiles));
  }

  equals(tiles: Tile[] | Tiles) {
    const other = new Tiles(tiles);
    return this.tiles.length === other.length && this.contains(other);
  }

  contains(tiles: Tile[] | Tiles) {
    const copy = [...this.tiles];
    for (const tile of new Tiles(tiles).tiles) {
      const index = tile.indexIn(copy);
      if (index === -1) {
        return false;
      }
      copy.splice(index, 1);
    }
    return true;
  }

  hasSameTypeAndDiff(diff: number = 1) {
    if (this.length === 0) return false;
    return this.filterType(this.minPointTile.type).length === this.length && this.hasDiff(diff);
  }

  hasDiff(diff: number = 1) {
    if (this.length === 0) return false;
    const min = this.minPointTile;
    let left = this as Tiles;
    for (let i = 0; i < this.length; i++) {
      const p = min.point + i * diff;
      const finds = left.filterPoint(p as TilePoint);
      if (p > 9 || finds.length === 0) {
        return false;
      }
      left = left.split(finds.last)[0];
    }
    return true;
  }

  get mostType(): [TileType, number] {
    let maxLen = 0;
    let maxType = TileTypes[0];
    for (const t of TileTypes) {
      const len = this.filterType(t).length;
      if (len > maxLen) {
        maxType = t;
        maxLen = len;
      }
    }
    return [maxType, maxLen];
  }

  get mostPoint(): [number, number] {
    let maxLen = 0;
    let mostPoint = 0;
    for (let t = 1; t <= 9; t++) {
      const len = this.filterType('t', 'b', 'w').filterPoint(t as TilePoint).length;
      if (len > maxLen) {
        mostPoint = t;
        maxLen = len;
      }
    }
    return [mostPoint, maxLen];
  }

  count(tile: Tile) {
    return this.filterType(tile.type).filterPoint(tile.point).length;
  }

  get unicode() {
    return [...this.tiles].map(t => t.unicode).join('');
  }
}

export const defaultOptions: Options = {
  hua: 0,
  lastTile: false,
  gangShang: false,
  juezhang: false,
  quanfeng: 1,
  menfeng: 1,
  zimo: false,
};

type ModeChar = 'c' | 'p' | 'g' | 'a' | 'l';

export class Hand {
  option: Options;

  constructor(
    readonly tiles: Tiles, // last one is last card
    readonly mings: Ming[] = [],
    option: Partial<Options> = defaultOptions,
  ) {
    this.option = {
      ...defaultOptions,
      ...option,
    };
  }

  static create(str: string, opt: Partial<Options> = {}) {
    const tiles: Tile[] = [];
    const mings: Ming[] = [];
    let mode: ModeChar = 'l';
    let type: TileType = 'z';
    const parts = str.split('@', 2);
    for (const c of parts[0]) {
      switch (c) {
        case 'c':
        case 'p':
        case 'g':
        case 'a': // 暗杠
        case 'l':
          mode = c;
          break;
        case 'z':
        case 'b':
        case 't':
        case 'w':
          type = c;
          break;
        case ' ':
          break;
        default:
          const point = Number(c) as TilePoint;
          if (!isNaN(point)) {
            const tile = new Tile(type, point);
            switch (mode) {
              case 'c':
                mings.push(new Chi(tile));
                break;
              case 'p':
                mings.push(new Peng(tile));
                break;
              case 'g':
                mings.push(new Gang(tile, true));
                break;
              case 'a':
                mings.push(new Gang(tile, false));
                break;
              case 'l':
                tiles.push(tile);
                break;
            }
          }
      }
    }
    const option = { ...defaultOptions };
    if (parts.length === 2) {
      for (const o of parts[1].split(',')) {
        const trimmed = o.trim();
        switch (trimmed) {
          case 'z':
            option.zimo = true;
            break;
          case 'g':
            option.gangShang = true;
            break;
          case 'l':
            option.lastTile = true;
            break;
          case 'j':
            option.juezhang = true;
            break;
          default:
            const p = Number(trimmed.slice(1));
            if (!isNaN(p)) {
              if (trimmed.startsWith('q')) {
                option.quanfeng = (p % 4) + 1 as TilePoint;
              } else if (trimmed.startsWith('m')) {
                option.menfeng = (p % 4) + 1 as TilePoint;
              } else if (trimmed.startsWith('h')) {
                option.hua = p % 8;
              }
            }
        }
      }
    }
    return new Hand(new Tiles(tiles), mings, {
      ...option,
      ...opt,
    });
  }

  get count() {
    return this.tiles.length + 3 * this.mings.length;
  }

  get allTiles() {
    const mingTiles = this.mings.flatMap(m => m.toMian().toTiles.tiles);
    return new Tiles([...mingTiles, ...this.tiles.tiles]);
  }

  get usedTiles() {
    const mingTiles = this.mings.flatMap(m => m.toMian().toTiles.tiles);
    const gangTiles = (this.mings.filter(m => m.type === 'gang') as Gang[]).map(m => m.tile);
    return new Tiles([...mingTiles, ...gangTiles, ...this.tiles.tiles]);
  }

  copy = () => new Hand(new Tiles(this.tiles), [...this.mings], {...this.option});
}

export class Combination {
  constructor(
    readonly mians: Mian[],
  ) {
  }

  with = (...ms: Mian[]) => new Combination([...this.mians, ...ms]);

  get toTiles(): Tiles {
    return new Tiles(this.mians.flatMap(m => m.toTiles.tiles));
  }

  hasKe(tiles: Tile[]) {
    for (const tile of tiles) {
      let found = false;
      for (const mian of this.mians) {
        if (mian.type === 'ke' && (mian as Ke).tile.equals(tile)) {
          found = true;
          break;
        }
      }
      if (!found) {
        return false;
      }
    }
    return true;
  }

  getMianWith(tile: Tile) {
    return this.mians.filter(m => tile.in(m.toTiles.tiles));
  }

  equals(other: Combination) {
    return contentEquals(this.mians, other.mians, (a, b) => a.type === b.type && a.equals(b as any));
  }

  toString() {
    return this.mians.map(e => e.toString()).sort().join(' ');
  }
}

export class Hu {
  constructor(
    readonly combination: Combination,
    readonly fans: Fan[],
  ) {
  }

  get totalScore() {
      if (this.fans.length === 0) return 0;
      return this.fans.map(f => f.score).reduce((a, b) => a + b);
  }
}

export class Chi {
  readonly type = 'chi';
  constructor(readonly tile: Tile) {}
  toMian = () => new Shun(this.tile, true);
}

export class Peng {
  readonly type = 'peng';
  constructor(readonly tile: Tile) {}
  toMian = () => new Ke(this.tile, true);
}

export class Gang {
  readonly type = 'gang';
  constructor(readonly tile: Tile, readonly open: boolean) {}
  toMian = () => new Ke(this.tile, this.open, true);
}

export type Ming = Chi | Peng | Gang

export class Shun {
  readonly type = 'shun';
  readonly simple = true;
  constructor(readonly tile: Tile, readonly open: boolean = false) {
    assert(tile.type !== 'z', '字牌不能顺');
    assert(tile.point < 8, '8,9不能顺');
  }
  get toTiles() {
    return new Tiles([this.tile, this.tile.next, this.tile.next.next]);
  }
  equals(other: Shun) {
    return this.tile.equals(other.tile) && this.open === other.open;
  }
  toString() {
    return `${this.open ? '吃' : '顺'}${this.toTiles.unicode}`;
  }
}

export class Ke {
  readonly type = 'ke';
  readonly simple = true;
  constructor(readonly tile: Tile, readonly open: boolean = false, readonly gang: boolean = false) {}
  get toTiles() {
    const count = this.gang ? 4 : 3;
    return new Tiles(Array(count).fill(this.tile));
  }
  equals(other: Ke) {
    return this.tile.equals(other.tile) && this.open === other.open && this.gang === other.gang;
  }
  isAnKe(h: Hand) {
    const tiles = h.option.zimo ? h.tiles : h.tiles.withoutLast;
    return !this.open && (this.gang || tiles.count(this.tile) >= 3);
  }
  toString() {
    return `${this.gang ? (this.open ? '明杠' : '暗杠') : (this.open ? '碰' : '暗刻')}${this.tile.unicode}`;
  }
}

export class Dui {
  readonly type = 'dui';
  readonly open = false;
  readonly simple = true;
  constructor(readonly tile: Tile) {}
  get toTiles() {
    return new Tiles([this.tile, this.tile]);
  }
  equals(other: Dui) {
    return this.tile.equals(other.tile);
  }
  toString() {
    return `对${this.tile.unicode}`;
  }
}

export class QiDui {
  readonly type = 'qi-dui';
  readonly open = false;
  readonly simple = false;
  constructor(readonly tiles: Tiles) {
    assert(tiles.length === 7);
  }
  get toTiles() {
    return new Tiles([...this.tiles.tiles, ...this.tiles.tiles]);
  }
  equals(other: QiDui) {
    return this.tiles.equals(other.tiles);
  }
  toString() {
    return `七对${this.tiles.sorted.unicode}`;
  }
}

export class ZuHeLong {
  readonly type = 'zu-he-long';
  readonly open = false;
  readonly simple = false;
  constructor(readonly tiles: Tiles) {
    assert(tiles.length === 9);
  }
  get toTiles() {
    return this.tiles;
  }
  equals(other: ZuHeLong) {
    return this.tiles.equals(other.tiles);
  }
  toString() {
    return `组合龙${this.tiles.sorted.unicode}`;
  }
}

export class BuKao {
  readonly type = 'bu-kao';
  readonly open = false;
  readonly simple = false;
  constructor(readonly tiles: Tiles) {
    assert(tiles.length === 14);
  }
  get toTiles() {
    return this.tiles;
  }
  equals(other: BuKao) {
    return this.tiles.equals(other.tiles);
  }
  toString() {
    return `不靠${this.tiles.sorted.unicode}`;
  }
}

export class Yao13 {
  readonly type = '13yao';
  readonly open = false;
  readonly simple = false;
  constructor(readonly tile: Tile) {
    assert(tile.in(Tile.Yao), '不是幺牌');
  }
  get toTiles() {
    return new Tiles([this.tile, ...Tile.Yao]);
  }
  equals(other: Yao13) {
    return this.tile.equals(other.tile);
  }
  toString() {
    return `十三幺${this.tile.unicode}`;
  }
}

export type Mian = Dui | Shun | Ke | QiDui | BuKao | Yao13 | ZuHeLong
