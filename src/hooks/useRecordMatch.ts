
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { convex, api } from '@/integrations/convex/client';

export function useRecordMatch(groupId?: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ winnerId, loserId }: { winnerId: string; loserId: string }) => {
      if (!groupId) throw new Error('Group ID is required');
      
      return convex.mutation(api.data.recordMatch, { groupId, rankings: [{ playerId: winnerId, rank: 1 }, { playerId: loserId, rank: 2 }], multiplayer: false });
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
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record match",
        variant: "destructive",
      });
    }
  });
}
