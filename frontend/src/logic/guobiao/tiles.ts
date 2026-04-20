import {Tiles} from './types';

export type TileType = 'b' | 't' | 'w' | 'z';
export type TileSuit = 'm' | 'p' | 's' | 'z'; // HEAD compatibility

export const TileNumberTypes: TileType[] = ['t', 'b', 'w'];
export const TileTypes: TileType[] = ['b', 't', 'w', 'z'];
export type TilePoint = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export const TilePoints: TilePoint[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const suitToType: Record<string, TileType> = {
  'm': 'w',
  'p': 'b',
  's': 't',
  'z': 'z'
};

const typeToSuit: Record<string, TileSuit> = {
  'w': 'm',
  'b': 'p',
  't': 's',
  'z': 'z'
};

export class Tile {
  constructor(
    readonly type: TileType,
    readonly point: TilePoint,
  ) {
  }

  // HEAD compatibility getters
  get suit(): TileSuit { return typeToSuit[this.type]; }
  get rank(): number { return this.point; }

  // HEAD compatibility methods
  get isHonor(): boolean { return this.type === 'z'; }
  get isNumber(): boolean { return this.type !== 'z'; }
  get isTerminal(): boolean { return this.isNumber && (this.point === 1 || this.point === 9); }
  get isTerminalOrHonor(): boolean { return this.isTerminal || this.isHonor; }
  get isWind(): boolean { return this.type === 'z' && this.point >= 1 && this.point <= 4; }
  get isDragon(): boolean { return this.type === 'z' && this.point >= 5 && this.point <= 7; }
  get isGreen(): boolean {
    return (this.type === 't' && [2, 3, 4, 6, 8].includes(this.point)) ||
           (this.type === 'z' && this.point === 6);
  }

  toString(): string { return `${this.point}${this.suit}`; }

  get prev() {
    if (this.type === 'z' || this.point === 1) {
      throw new Error('cannot get prev tile');
    }
    return new Tile(this.type, (this.point - 1) as TilePoint);
  }

  get next() {
    if (this.type === 'z' || this.point === 9) {
      throw new Error('cannot get next tile');
    }
    return new Tile(this.type, (this.point + 1) as TilePoint);
  }

  in(tiles: Tile[] | Tiles) {
    return new Tiles(tiles).indexOf(this) !== -1;
  }

  indexIn(tiles: Tile[] | Tiles) {
    return new Tiles(tiles).indexOf(this);
  }

  toNumber() {
    switch (this.type) {
      case 't':
        return this.point;
      case 'b':
        return this.point + 9;
      case 'w':
        return this.point + 18;
      case 'z':
        return this.point + 27;
    }
  }

  compareTo(o: Tile) {
    return this.toNumber() - o.toNumber();
  }

  equals(tile: Tile) {
    if (!tile) return false;
    return this.type === tile.type && this.point === tile.point;
  }

  get unicode() {
    let start = 0;
    switch (this.type) {
      case 'b':
        start = 0x1F019;
        break;
      case 'w':
        start = 0x1F007;
        break;
      case 'z':
        start = 0x1F000;
        break;
      case 't':
        start = 0x1F010;
        break;
    }
    return String.fromCodePoint(start + this.point - 1);
  }

  static fromString(s: string): Tile {
    const point = parseInt(s[0], 10) as TilePoint;
    const suit = s[1] as TileSuit;
    return new Tile(suitToType[suit], point);
  }

  static get all(): Tile[] {
    return Tile.All;
  }

  static T = TilePoints.map(p => new Tile('t', p));
  static B = TilePoints.map(p => new Tile('b', p));
  static W = TilePoints.map(p => new Tile('w', p));
  static F = [1, 2, 3, 4].map(p => new Tile('z', p as TilePoint));
  static Fs = {
    dong: Tile.F[0],
    nan: Tile.F[1],
    xi: Tile.F[2],
    bei: Tile.F[3],
  };
  static Y = [5, 6, 7].map(p => new Tile('z', p as TilePoint));
  static Ys = {
    zhong: Tile.Y[0],
    fa: Tile.Y[1],
    bai: Tile.Y[2],
  };
  static Z = [...Tile.F, ...Tile.Y];
  static All = [...Tile.T, ...Tile.B, ...Tile.W, ...Tile.Z];

  static YaoJiu = [Tile.T[0], Tile.T[8], Tile.B[0], Tile.B[8], Tile.W[0], Tile.W[8]];
  static Yao = [...Tile.Z, ...Tile.YaoJiu];

  static Lv = [Tile.T[1], Tile.T[2], Tile.T[3], Tile.T[5], Tile.T[7], Tile.Ys.fa];
  static TuiBuDao = [
    Tile.T[1], Tile.T[3], Tile.T[4], Tile.T[5], Tile.T[7], Tile.T[8],
    Tile.B[0], Tile.B[1], Tile.B[2], Tile.B[3], Tile.B[4], Tile.B[7], Tile.B[8],
    Tile.Ys.bai,
  ];
}
