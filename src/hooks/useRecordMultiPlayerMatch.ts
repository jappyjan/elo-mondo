
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { MultiPlayerMatchRequest } from '@/types/darts';
import { supabase } from '@/integrations/supabase/client';

export function useRecordMultiPlayerMatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ playerRankings }: MultiPlayerMatchRequest) => {
      // Get current player data
      const playerIds = playerRankings.map(pr => pr.playerId);
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .in('id', playerIds);
      
      if (playersError) throw playersError;
      if (!players || players.length !== playerIds.length) {
        throw new Error('Some players not found');
      }
      
      // Find winner (rank 1) and loser (highest rank) for match record
      const winner = playerRankings.find(pr => pr.rank === 1);
      const loser = playerRankings.reduce((prev, current) => 
        prev.rank > current.rank ? prev : current
      );
      
      if (!winner || !loser) throw new Error('Invalid rankings provided');
      
      // Create the match record (placeholder Elo values - calculated on-the-fly)
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .insert({
          winner_id: winner.playerId,
          loser_id: loser.playerId,
          winner_elo_before: 0,
          loser_elo_before: 0,
          winner_elo_after: 0,
          loser_elo_after: 0,
          elo_change: 0,
          match_type: 'multiplayer',
          total_players: playerRankings.length
        })
        .select()
        .single();
      
      if (matchError) throw matchError;
      
      // Create match participants records
      const participantInserts = playerRankings.map(pr => ({
        match_id: matchData.id,
        player_id: pr.playerId,
        is_winner: pr.rank === 1,
        elo_before: 0, // Placeholder
        elo_after: 0,
        elo_change: 0,
        rank: pr.rank
      }));
      
      const { error: participantsError } = await supabase
        .from('match_participants')
        .insert(participantInserts);
      
      if (participantsError) throw participantsError;
      
      // Update all players' stats (only win/loss counts)
      for (const ranking of playerRankings) {
        const player = players.find(p => p.id === ranking.playerId)!;
        const { error: updateError } = await supabase
          .from('players')
          .update({
            matches_played: player.matches_played + 1,
            wins: ranking.rank === 1 ? player.wins + 1 : player.wins,
            losses: ranking.rank !== 1 ? player.losses + 1 : player.losses,
            updated_at: new Date().toISOString()
          })
          .eq('id', ranking.playerId);
        
        if (updateError) throw updateError;
      }
      
      return { 
        players: players.map(p => {
          const ranking = playerRankings.find(r => r.playerId === p.id)!;
          return { ...p, rank: ranking.rank };
        })
      };
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
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record multi-player match",
        variant: "destructive",
      });
    }
  });
}
