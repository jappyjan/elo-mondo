
import { useQuery } from '@tanstack/react-query';
import { convex, api } from '@/integrations/convex/client';
import { MatchWithPlayers } from '@/types/darts';

export function useMatches(groupId?: string) {
  return useQuery({
    queryKey: ['matches', groupId],
    queryFn: async () => {
      const data = await convex.query(api.data.matches, { groupId: groupId! });
      return data.slice().reverse() as MatchWithPlayers[];
    },
    enabled: !!groupId,
  });
}

// Re-export the mutation hooks for backward compatibility
export { useRecordMatch } from './useRecordMatch';
export { useRecordMultiPlayerMatch } from './useRecordMultiPlayerMatch';
