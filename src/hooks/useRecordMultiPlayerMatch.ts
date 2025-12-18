
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { MultiPlayerMatchRequest } from '@/types/darts';
import { supabase } from '@/integrations/supabase/client';

export function useRecordMultiPlayerMatch(groupId?: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ playerRankings }: MultiPlayerMatchRequest) => {
      if (!groupId) throw new Error('Group ID is required');
      
      // Get player names for the success message
      const playerIds = playerRankings.map(pr => pr.playerId);
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('id, name')
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
      
      // Create the match record with group_id
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .insert({
          winner_id: winner.playerId,
          loser_id: loser.playerId,
          match_type: 'multiplayer',
          total_players: playerRankings.length,
          group_id: groupId
        })
        .select()
        .single();
      
      if (matchError) throw matchError;
      
      // Create match participants records
      const participantInserts = playerRankings.map(pr => ({
        match_id: matchData.id,
        player_id: pr.playerId,
        is_winner: pr.rank === 1,
        rank: pr.rank
      }));
      
      const { error: participantsError } = await supabase
        .from('match_participants')
        .insert(participantInserts);
      
      if (participantsError) throw participantsError;
      
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
