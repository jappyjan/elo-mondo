
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { MultiPlayerMatchRequest } from '@/types/darts';
import { convex, api } from '@/integrations/convex/client';

export function useRecordMultiPlayerMatch(groupId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ playerRankings }: MultiPlayerMatchRequest) => {
      if (!groupId) throw new Error('Group ID is required');
      
      return convex.mutation(api.data.recordMatch, { groupId, rankings: playerRankings, multiplayer: true });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['calculated-players'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      
      const sortedPlayers = data.players.sort((a, b) => a.rank - b.rank);
      const winnerName = sortedPlayers[0].name;
      const totalPlayers = sortedPlayers.length;
      
      toast({
        title: "Multi-Player Match Recorded!",
        description: `${winnerName} won the ${totalPlayers}-player match!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record multi-player match",
        variant: "destructive",
      });
    }
  });
}
