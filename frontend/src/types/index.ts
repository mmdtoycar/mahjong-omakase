export interface Player {
  id: number;
  userName: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export type GameModeKey = 'DONGBEI' | 'RIICHI' | 'GUOBIAO';

export const GAME_MODES: { key: GameModeKey; label: string }[] = [
  { key: 'GUOBIAO', label: '国标麻将' },
  { key: 'DONGBEI', label: '抗日麻将' },
  { key: 'RIICHI', label: '立直麻将' },
];

export interface GameSession {
  id: number;
  name: string;
  gameMode: GameModeKey;
  gameModeDisplayName: string;
  playerCount: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
  createdAt: string;
}

export interface PlayerInfo {
  id: number;
  userName: string;
  firstName: string;
  lastName: string;
  displayName: string;
}

export interface RoundInfo {
  roundNumber: number;
  scores: Record<number, number>;
}

export interface SessionDetail {
  id: number;
  name: string;
  gameMode: GameModeKey;
  gameModeDisplayName: string;
  playerCount: number;
  status: 'IN_PROGRESS' | 'COMPLETED';
  createdAt: string;
  players: PlayerInfo[];
  rounds: RoundInfo[];
  totalScores: Record<number, number>;
}

export interface AddRoundData {
  roundType?: 'WIN' | 'DRAWN_GAME'; // default WIN
  winnerId?: number;
  score?: number;             // for Guobiao
  han?: number;               // for Riichi (han) / Dongbei (fan)
  fu?: number;                // for Riichi
  dealerId?: number;          // for Riichi/Dongbei: table dealer
  honba?: number;             // for Riichi: 本場 count
  kyoutaku?: number;          // for Riichi: 供托 points
  bimenPlayerIds?: number[];  // for Dongbei: 闭门 players
  dealInPlayerId?: number | null; // null = 自摸
  tenpaiPlayerIds?: number[]; // for drawn games
}

export const HAN_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
export const FU_OPTIONS = [20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 110];

export interface PlayerStats {
  playerId: number;
  userName: string;
  displayName: string;
  gamesPlayed: number;
  totalScore: number;
  avgScore: number;
  wins: number;
}

export interface Season {
  year: number;
  quarter: number;
  label: string;
}

const SEASON_NAMES: Record<number, string> = {
  1: '春之赛季',
  2: '夏之赛季',
  3: '秋之赛季',
  4: '冬之赛季',
};

export function getCurrentSeason(): Season {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return { year: now.getFullYear(), quarter, label: `${now.getFullYear()} ${SEASON_NAMES[quarter]}` };
}

export function getAvailableSeasons(startYear: number = 2026): Season[] {
  const seasons: Season[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

  for (let y = currentYear; y >= startYear; y--) {
    const maxQ = y === currentYear ? currentQuarter : 4;
    for (let q = maxQ; q >= 1; q--) {
      seasons.push({ year: y, quarter: q, label: `${y} ${SEASON_NAMES[q]}` });
    }
  }
  return seasons;
}

export interface PlayerGameEntry {
  sessionId: number;
  sessionName: string;
  gameMode: GameModeKey;
  gameModeDisplayName: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  createdAt: string;
  totalScore: number;
}

export interface PlayerDetail {
  playerId: number;
  userName: string;
  firstName: string;
  lastName: string;
  games: PlayerGameEntry[];
}
