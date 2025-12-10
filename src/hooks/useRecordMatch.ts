
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function useRecordMatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ winnerId, loserId }: { winnerId: string; loserId: string }) => {
      // Get current player data for stats update
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .in('id', [winnerId, loserId]);
      
      if (playersError) throw playersError;
      
      const winner = players?.find(p => p.id === winnerId);
      const loser = players?.find(p => p.id === loserId);
      
      if (!winner || !loser) throw new Error('Players not found');
      
      // Create match record (Elo fields are kept for historical display but will be recalculated on-the-fly)
      // We store placeholder values since real Elo is calculated by edge function
      const { error: matchError } = await supabase
        .from('matches')
        .insert({
          winner_id: winnerId,
          loser_id: loserId,
          winner_elo_before: 0, // Placeholder - real values calculated on-the-fly
          loser_elo_before: 0,
          winner_elo_after: 0,
          loser_elo_after: 0,
          elo_change: 0,
          match_type: '1v1',
          total_players: 2
        });
      
      if (matchError) throw matchError;
      
      // Update winner stats (only win/loss counts, not Elo)
      const { error: winnerError } = await supabase
        .from('players')
        .update({
          matches_played: winner.matches_played + 1,
          wins: winner.wins + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', winnerId);
      
      if (winnerError) throw winnerError;
      
      // Update loser stats
      const { error: loserError } = await supabase
        .from('players')
        .update({
          matches_played: loser.matches_played + 1,
          losses: loser.losses + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', loserId);
      
      if (loserError) throw loserError;
      
      return { winner, loser };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['calculated-players'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      toast({
        title: "Match Recorded!",
        description: `${data.winner.name} defeated ${data.loser.name}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record match",
        variant: "destructive",
      });
    }
  });
}
