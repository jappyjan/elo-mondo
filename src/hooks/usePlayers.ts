
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Player, EloCalculationResponse } from '@/types/darts';
import { toast } from '@/components/ui/use-toast';

const SUPABASE_URL = "https://stzilnijaoxwqyuyryts.supabase.co";

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
      const body: { applyDecay: boolean; year?: number; includeProvisional: boolean; groupId?: string } = { 
        applyDecay, 
        includeProvisional 
      };
      if (year) {
        body.year = year;
      }
      if (groupId) {
        body.groupId = groupId;
      }
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/calculate-elo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to calculate Elo');
      }
      
      return response.json();
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
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as Player[];
    }
  });
}

export function useAddPlayer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('players')
        .insert({ name })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['calculated-players'] });
      toast({
        title: "Success",
        description: "Player added successfully!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add player",
        variant: "destructive",
      });
    }
  });
}
