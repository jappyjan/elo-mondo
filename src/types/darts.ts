
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

export interface Match {
  id: string;
  winner_id: string;
  loser_id: string;
  winner_elo_before: number;
  loser_elo_before: number;
  winner_elo_after: number;
  loser_elo_after: number;
  elo_change: number;
  created_at: string;
}

export interface MatchWithPlayers extends Match {
  winner: Player;
  loser: Player;
}
