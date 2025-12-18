
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

export async function createMatch(matchData: {
  winner_id: string;
  loser_id: string;
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
  rank: number;
}>) {
  const { error } = await supabase
    .from('match_participants')
    .insert(participants);
  
  if (error) throw error;
}
