
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { calculateMultiPlayerEloChanges } from '@/utils/eloCalculator';
import { toast } from '@/components/ui/use-toast';
import { MultiPlayerMatchRequest } from '@/types/darts';
import { getPlayersById, updatePlayerStats, createMatch, createMatchParticipants } from '@/utils/matchUtils';

export function useRecordMultiPlayerMatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ playerRankings }: MultiPlayerMatchRequest) => {
      // Get current player ratings
      const playerIds = playerRankings.map(pr => pr.playerId);
      const players = await getPlayersById(playerIds);
      
      // Create player ratings array with ranks
      const playerRatings = playerRankings.map(pr => {
        const player = players.find(p => p.id === pr.playerId);
        if (!player) throw new Error(`Player with id ${pr.playerId} not found`);
        return {
          playerId: pr.playerId,
          rating: player.elo_rating,
          rank: pr.rank
        };
      });

      // Calculate new ratings using the multi-player ranking system
      const eloResults = calculateMultiPlayerEloChanges(playerRatings);
      
      // Find winner (rank 1) and loser (highest rank) for backward compatibility
      const winner = playerRankings.find(pr => pr.rank === 1);
      const loser = playerRankings.reduce((prev, current) => 
        prev.rank > current.rank ? prev : current
      );
      
      if (!winner || !loser) throw new Error('Invalid rankings provided');
      
      const winnerPlayer = players.find(p => p.id === winner.playerId)!;
      const loserPlayer = players.find(p => p.id === loser.playerId)!;
      const winnerResult = eloResults.find(r => r.playerId === winner.playerId)!;
      const loserResult = eloResults.find(r => r.playerId === loser.playerId)!;

      // Create the match record
      const matchData = await createMatch({
        winner_id: winner.playerId,
        loser_id: loser.playerId,
        winner_elo_before: winnerPlayer.elo_rating,
        loser_elo_before: loserPlayer.elo_rating,
        winner_elo_after: winnerResult.newRating,
        loser_elo_after: loserResult.newRating,
        elo_change: winnerResult.eloChange,
        match_type: 'multiplayer',
        total_players: playerRankings.length
      });
      
      // Create match participants records
      const participantInserts = eloResults.map(result => {
        const player = players.find(p => p.id === result.playerId)!;
        return {
          match_id: matchData.id,
          player_id: result.playerId,
          is_winner: result.rank === 1,
          elo_before: player.elo_rating,
          elo_after: result.newRating,
          elo_change: result.eloChange,
          rank: result.rank
        };
      });
      
      await createMatchParticipants(participantInserts);
      
      // Update all players' stats
      for (const result of eloResults) {
        const player = players.find(p => p.id === result.playerId)!;
        await updatePlayerStats(result.playerId, {
          elo_rating: result.newRating,
          matches_played: player.matches_played + 1,
          wins: result.rank === 1 ? player.wins + 1 : player.wins,
          losses: result.rank !== 1 ? player.losses + 1 : player.losses
        });
      }
      
      return { 
        players: players.map(p => {
          const result = eloResults.find(r => r.playerId === p.id)!;
          return { ...p, ...result };
        })
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      
      const sortedPlayers = data.players.sort((a, b) => a.rank - b.rank);
      const winnerName = sortedPlayers[0].name;
      const totalPlayers = sortedPlayers.length;
      
      toast({
        title: "Multi-Player Match Recorded!",
        description: `${winnerName} won the ${totalPlayers}-player match!`,
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
