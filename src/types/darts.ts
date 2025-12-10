
export interface Player {
  id: string;
  name: string;
  elo_rating: number;
  matches_played: number;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
}

// Player with calculated Elo from edge function
export interface CalculatedPlayer {
  playerId: string;
  playerName: string;
  currentElo: number;
  rawElo: number;
  decayApplied: number;
  daysSinceLastMatch: number | null;
  matchesPlayed: number;
  wins: number;
  losses: number;
}

export interface Match {
  id: string;
  winner_id: string;
  loser_id: string;
  winner_elo_before: number;
  loser_elo_before: number;
  winner_elo_after: number;
  loser_elo_after: number;
  elo_change: number;
  match_type: string;
  total_players: number;
  created_at: string;
}

export interface MatchParticipant {
  id: string;
  match_id: string;
  player_id: string;
  is_winner: boolean;
  elo_before: number;
  elo_after: number;
  elo_change: number;
  rank: number;
  created_at: string;
}

export interface MatchWithPlayers extends Match {
  winner: Player;
  loser: Player;
  participants?: (MatchParticipant & { player: Player })[];
}

// Calculated match history from edge function
export interface MatchHistoryEntry {
  matchId: string;
  matchDate: string;
  results: Array<{
    playerId: string;
    eloBefore: number;
    eloAfter: number;
    eloChange: number;
  }>;
}

export interface EloCalculationResponse {
  players: CalculatedPlayer[];
  matchHistory: MatchHistoryEntry[];
  calculatedAt: string;
  decayHalfLifeDays: number;
}

export interface MultiPlayerMatchRequest {
  playerRankings: Array<{
    playerId: string;
    rank: number;
  }>;
}

export interface PlayerRanking {
  playerId: string;
  rank: number;
}
