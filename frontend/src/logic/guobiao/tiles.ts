/**
 * Guobiao Mahjong Tile Definitions
 * Clean-room implementation for Mahjong Omakase
 */

export type TileSuit = 'm' | 'p' | 's' | 'z';

export class Tile {
  constructor(public suit: TileSuit, public rank: number) {}

  get isHonor(): boolean { return this.suit === 'z'; }
  get isNumber(): boolean { return this.suit !== 'z'; }
  get isTerminal(): boolean { return this.isNumber && (this.rank === 1 || this.rank === 9); }
  get isTerminalOrHonor(): boolean { return this.isTerminal || this.isHonor; }
  get isWind(): boolean { return this.suit === 'z' && this.rank >= 1 && this.rank <= 4; }
  get isDragon(): boolean { return this.suit === 'z' && this.rank >= 5 && this.rank <= 7; }
  get isGreen(): boolean {
    return (this.suit === 's' && [2, 3, 4, 6, 8].includes(this.rank)) ||
           (this.suit === 'z' && this.rank === 6);
  }

  toString(): string { return `${this.rank}${this.suit}`; }

  equals(other: Tile): boolean {
    return this.suit === other.suit && this.rank === other.rank;
  }

  compareTo(other: Tile): number {
    const suitOrder: Record<string, number> = { m: 0, p: 1, s: 2, z: 3 };
    if (this.suit !== other.suit) return suitOrder[this.suit] - suitOrder[other.suit];
    return this.rank - other.rank;
  }

  static fromString(s: string): Tile {
    const rank = parseInt(s[0], 10);
    const suit = s[1] as TileSuit;
    return new Tile(suit, rank);
  }

  static get all(): Tile[] {
    const tiles: Tile[] = [];
    (['m', 'p', 's'] as TileSuit[]).forEach(s => {
      for (let r = 1; r <= 9; r++) tiles.push(new Tile(s, r));
    });
    for (let r = 1; r <= 7; r++) tiles.push(new Tile('z', r));
    return tiles;
  }

  // All terminal + honor tiles (幺九牌)
  static get yao(): Tile[] {
    const res: Tile[] = [];
    (['m', 'p', 's'] as TileSuit[]).forEach(s => {
      res.push(new Tile(s, 1));
      res.push(new Tile(s, 9));
    });
    for (let r = 1; r <= 7; r++) res.push(new Tile('z', r));
    return res;
  }
}
