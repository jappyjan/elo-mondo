
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Match, MatchWithPlayers, MultiPlayerMatchRequest } from '@/types/darts';
import { calculateNewRatings, calculateMultiPlayerEloChanges } from '@/utils/eloCalculator';
import { toast } from '@/components/ui/use-toast';

export function useMatches() {
  return useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          winner:players!winner_id(*),
          loser:players!loser_id(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as MatchWithPlayers[];
    }
  });
}

export function useRecordMatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ winnerId, loserId }: { winnerId: string; loserId: string }) => {
      // Get current player ratings
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .in('id', [winnerId, loserId]);
      
      if (playersError) throw playersError;
      
      const winner = players.find(p => p.id === winnerId);
      const loser = players.find(p => p.id === loserId);
      
      if (!winner || !loser) throw new Error('Players not found');
      
      // Calculate new ratings
      const { winnerNewRating, loserNewRating, eloChange } = calculateNewRatings(
        winner.elo_rating,
        loser.elo_rating
      );
      
      // Start transaction to update both players and record match
      const { error: matchError } = await supabase
        .from('matches')
        .insert({
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
      
      if (matchError) throw matchError;
      
      // Update winner stats
      const { error: winnerError } = await supabase
        .from('players')
        .update({
          elo_rating: winnerNewRating,
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
          elo_rating: loserNewRating,
          matches_played: loser.matches_played + 1,
          losses: loser.losses + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', loserId);
      
      if (loserError) throw loserError;
      
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

export function useRecordMultiPlayerMatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ winnerId, loserIds }: MultiPlayerMatchRequest) => {
      // Get current player ratings
      const allPlayerIds = [winnerId, ...loserIds];
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .in('id', allPlayerIds);
      
      if (playersError) throw playersError;
      
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
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .insert({
          winner_id: winnerId,
          loser_id: loserIds[0], // Keep first loser for backward compatibility
          winner_elo_before: winner.elo_rating,
          loser_elo_before: losers[0]!.elo_rating,
          winner_elo_after: winnerNewRating,
          loser_elo_after: loserNewRatings[0],
          elo_change: winnerEloChange,
          match_type: 'multiplayer',
          total_players: allPlayerIds.length
        })
        .select()
        .single();
      
      if (matchError) throw matchError;
      
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
      
      const { error: participantsError } = await supabase
        .from('match_participants')
        .insert(participantInserts);
      
      if (participantsError) throw participantsError;
      
      // Update winner stats
      const { error: winnerError } = await supabase
        .from('players')
        .update({
          elo_rating: winnerNewRating,
          matches_played: winner.matches_played + 1,
          wins: winner.wins + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', winnerId);
      
      if (winnerError) throw winnerError;
      
      // Update losers stats
      for (let i = 0; i < losers.length; i++) {
        const loser = losers[i]!;
        const { error: loserError } = await supabase
          .from('players')
          .update({
            elo_rating: loserNewRatings[i],
            matches_played: loser.matches_played + 1,
            losses: loser.losses + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', loser.id);
        
        if (loserError) throw loserError;
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
