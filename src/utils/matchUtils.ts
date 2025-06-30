
import { supabase } from '@/integrations/supabase/client';
import { Player } from '@/types/darts';

export async function getPlayersById(playerIds: string[]): Promise<Player[]> {
  const { data: players, error } = await supabase
    .from('players')
    .select('*')
    .in('id', playerIds);
  
  if (error) throw error;
  return players as Player[];
}

export async function updatePlayerStats(
  playerId: string, 
  updates: {
    elo_rating: number;
    matches_played: number;
    wins?: number;
    losses?: number;
  }
) {
  const { error } = await supabase
    .from('players')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', playerId);
  
  if (error) throw error;
}

export async function createMatch(matchData: {
  winner_id: string;
  loser_id: string;
  winner_elo_before: number;
  loser_elo_before: number;
  winner_elo_after: number;
  loser_elo_after: number;
  elo_change: number;
  match_type: string;
  total_players: number;
}) {
  const { data, error } = await supabase
    .from('matches')
    .insert(matchData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function createMatchParticipants(participants: Array<{
  match_id: string;
  player_id: string;
  is_winner: boolean;
  elo_before: number;
  elo_after: number;
  elo_change: number;
}>) {
  const { error } = await supabase
    .from('match_participants')
    .insert(participants);
  
  if (error) throw error;
}
