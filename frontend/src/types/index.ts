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
  winnerId: number;
  score?: number;             // for Guobiao
  han?: number;               // for Riichi (han) / Dongbei (fan)
  fu?: number;                // for Riichi
  dealerId?: number;          // for Riichi/Dongbei: table dealer
  honba?: number;             // for Riichi: 本場 count
  bimenPlayerIds?: number[];  // for Dongbei: 闭门 players
  dealInPlayerId: number | null; // null = 自摸
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
