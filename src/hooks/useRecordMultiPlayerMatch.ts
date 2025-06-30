
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { calculateMultiPlayerEloChanges } from '@/utils/eloCalculator';
import { toast } from '@/components/ui/use-toast';
import { MultiPlayerMatchRequest } from '@/types/darts';
import { getPlayersById, updatePlayerStats, createMatch, createMatchParticipants } from '@/utils/matchUtils';

export function useRecordMultiPlayerMatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ winnerId, loserIds }: MultiPlayerMatchRequest) => {
      // Get current player ratings
      const allPlayerIds = [winnerId, ...loserIds];
      const players = await getPlayersById(allPlayerIds);
      
      const winner = players.find(p => p.id === winnerId);
      const losers = loserIds.map(id => players.find(p => p.id === id)).filter(Boolean);
      
      if (!winner || losers.length !== loserIds.length) {
        throw new Error('Players not found');
      }
      
      // Calculate new ratings for multi-player match
      const loserRatings = losers.map(loser => loser!.elo_rating);
      const { winnerEloChange, loserEloChanges, winnerNewRating, loserNewRatings } = 
        calculateMultiPlayerEloChanges(winner.elo_rating, loserRatings);
      
      // Create the match record
      const matchData = await createMatch({
        winner_id: winnerId,
        loser_id: loserIds[0], // Keep first loser for backward compatibility
        winner_elo_before: winner.elo_rating,
        loser_elo_before: losers[0]!.elo_rating,
        winner_elo_after: winnerNewRating,
        loser_elo_after: loserNewRatings[0],
        elo_change: winnerEloChange,
        match_type: 'multiplayer',
        total_players: allPlayerIds.length
      });
      
      // Create match participants records
      const participantInserts = [
        {
          match_id: matchData.id,
          player_id: winnerId,
          is_winner: true,
          elo_before: winner.elo_rating,
          elo_after: winnerNewRating,
          elo_change: winnerEloChange
        },
        ...losers.map((loser, index) => ({
          match_id: matchData.id,
          player_id: loser!.id,
          is_winner: false,
          elo_before: loser!.elo_rating,
          elo_after: loserNewRatings[index],
          elo_change: -loserEloChanges[index]
        }))
      ];
      
      await createMatchParticipants(participantInserts);
      
      // Update winner stats
      await updatePlayerStats(winnerId, {
        elo_rating: winnerNewRating,
        matches_played: winner.matches_played + 1,
        wins: winner.wins + 1
      });
      
      // Update losers stats
      for (let i = 0; i < losers.length; i++) {
        const loser = losers[i]!;
        await updatePlayerStats(loser.id, {
          elo_rating: loserNewRatings[i],
          matches_played: loser.matches_played + 1,
          losses: loser.losses + 1
        });
      }
      
      return { winner, losers, winnerEloChange, loserEloChanges };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      const loserNames = data.losers.map(loser => loser!.name).join(', ');
      toast({
        title: "Multi-Player Match Recorded!",
        description: `${data.winner.name} defeated ${loserNames} (+${data.winnerEloChange} Elo)`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record multi-player match",
        variant: "destructive",
      });
    }
  });
}
