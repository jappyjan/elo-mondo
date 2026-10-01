
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { convex, api } from '@/integrations/convex/client';
import { Player, EloCalculationResponse } from '@/types/darts';
import { toast } from '@/components/ui/use-toast';

// Fetch players with calculated Elo (with decay) from edge function
export function useCalculatedPlayers(
  groupId: string | undefined,
  applyDecay: boolean = true, 
  year?: number | null, 
  includeProvisional: boolean = true
) {
  return useQuery({
    queryKey: ['calculated-players', groupId, applyDecay, year, includeProvisional],
    queryFn: async (): Promise<EloCalculationResponse> => {
      return convex.query(api.data.elo, { groupId: groupId!, applyDecay, year: year ?? new Date().getFullYear(), includeProvisional });
    },
    staleTime: 10000,
    placeholderData: (previousData) => previousData,
    enabled: !!groupId, // Only fetch when groupId is provided
  });
}

// Fetch raw players from database (for forms/dropdowns)
export function usePlayers() {
  return useQuery({
    queryKey: ['players'],
    queryFn: async () => {
      return convex.query(api.data.players, {});
    }
  });
}

export function useAddPlayer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (name: string) => {
      return convex.mutation(api.data.addPlayer, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['calculated-players'] });
      toast({
        title: "Success",
        description: "Player added successfully!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add player",
        variant: "destructive",
      });
    }
  });
}
