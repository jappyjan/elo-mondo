
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MatchWithPlayers } from '@/types/darts';

export function useMatches(groupId?: string) {
  return useQuery({
    queryKey: ['matches', groupId],
    queryFn: async () => {
      let query = supabase
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
      
      if (groupId) {
        query = query.eq('group_id', groupId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as MatchWithPlayers[];
    },
    enabled: !!groupId,
  });
}

// Re-export the mutation hooks for backward compatibility
export { useRecordMatch } from './useRecordMatch';
export { useRecordMultiPlayerMatch } from './useRecordMultiPlayerMatch';
