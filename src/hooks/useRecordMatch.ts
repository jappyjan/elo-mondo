
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { calculateNewRatings } from '@/utils/eloCalculator';
import { toast } from '@/components/ui/use-toast';
import { getPlayersById, updatePlayerStats, createMatch } from '@/utils/matchUtils';

export function useRecordMatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ winnerId, loserId }: { winnerId: string; loserId: string }) => {
      // Get current player ratings
      const players = await getPlayersById([winnerId, loserId]);
      
      const winner = players.find(p => p.id === winnerId);
      const loser = players.find(p => p.id === loserId);
      
      if (!winner || !loser) throw new Error('Players not found');
      
      // Calculate new ratings
      const { winnerNewRating, loserNewRating, eloChange } = calculateNewRatings(
        winner.elo_rating,
        loser.elo_rating
      );
      
      // Create match record
      await createMatch({
        winner_id: winnerId,
        loser_id: loserId,
        winner_elo_before: winner.elo_rating,
        loser_elo_before: loser.elo_rating,
        winner_elo_after: winnerNewRating,
        loser_elo_after: loserNewRating,
        elo_change: eloChange,
        match_type: '1v1',
        total_players: 2
      });
      
      // Update winner stats
      await updatePlayerStats(winnerId, {
        elo_rating: winnerNewRating,
        matches_played: winner.matches_played + 1,
        wins: winner.wins + 1
      });
      
      // Update loser stats
      await updatePlayerStats(loserId, {
        elo_rating: loserNewRating,
        matches_played: loser.matches_played + 1,
        losses: loser.losses + 1
      });
      
      return { winner, loser, eloChange };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      toast({
        title: "Match Recorded!",
        description: `${data.winner.name} defeated ${data.loser.name} (+${data.eloChange} Elo)`,
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
