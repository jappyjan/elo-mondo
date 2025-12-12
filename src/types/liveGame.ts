export type GameType = '301' | '501';
export type StartRule = 'straight-in' | 'double-in';
export type EndRule = 'straight-out' | 'double-out';

export interface GamePlayer {
  id: string;
  name: string;
  isTemporary?: boolean;
}

export interface PlayerGameState {
  playerId: string;
  playerName: string;
  startingScore: number;
  currentScore: number;
  hasDoubledIn: boolean; // For double-in rule
  finishedRank: number | null; // null if still playing, 1 = 1st place, etc.
  turnHistory: TurnRecord[];
}

export interface DartThrow {
  segment: number; // 1-20, 25 (outer bull), 50 (inner bull)
  multiplier: 1 | 2 | 3; // single, double, triple (bulls can only be 1 or 2)
  score: number; // calculated score
  label: string; // display label e.g. "T20", "D16", "25"
}

export interface TurnRecord {
  darts: DartThrow[];
  scoreAtStart: number;
  scoreAtEnd: number;
  isBust: boolean;
  hadDoubledInBefore: boolean;
  doubledInThisTurn: boolean;
}

export interface LiveGameState {
  // Game configuration
  gameType: GameType;
  startRule: StartRule;
  endRule: EndRule;
  
  // Players
  players: GamePlayer[];
  playerOrder: string[]; // player IDs in throwing order
  playerStates: Record<string, PlayerGameState>;
  
  // Current turn
  currentPlayerIndex: number; // index into playerOrder
  currentTurnDarts: DartThrow[];
  scoreBeforeTurn: number;
  
  // Game progress
  finishedPlayerIds: string[];
  nextRank: number; // next rank to assign (starts at 1)
  isGameOver: boolean;
  
  // Timestamps
  startedAt: string;
  finishedAt: string | null;
}

export interface GameSettings {
  gameType: GameType;
  startRule: StartRule;
  endRule: EndRule;
  players: GamePlayer[];
}
