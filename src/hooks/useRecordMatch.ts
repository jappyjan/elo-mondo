
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function useRecordMatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ winnerId, loserId }: { winnerId: string; loserId: string }) => {
      // Get player names for the success message
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('id, name')
        .in('id', [winnerId, loserId]);
      
      if (playersError) throw playersError;
      
      const winner = players?.find(p => p.id === winnerId);
      const loser = players?.find(p => p.id === loserId);
      
      if (!winner || !loser) throw new Error('Players not found');
      
      // Create match record - Elo is calculated on-the-fly by edge function
      const { error: matchError } = await supabase
        .from('matches')
        .insert({
          winner_id: winnerId,
          loser_id: loserId,
          match_type: '1v1',
          total_players: 2
        });
      
      if (matchError) throw matchError;
      
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
