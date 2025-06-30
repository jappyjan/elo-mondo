
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MatchWithPlayers } from '@/types/darts';

export function useMatches() {
  return useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          winner:players!winner_id(*),
          loser:players!loser_id(*),
          participants:match_participants(
            *,
            player:players(*)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as MatchWithPlayers[];
    }
  });
}

// Re-export the mutation hooks for backward compatibility
export { useRecordMatch } from './useRecordMatch';
export { useRecordMultiPlayerMatch } from './useRecordMultiPlayerMatch';
