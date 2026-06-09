import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCalculatedPlayers } from '@/hooks/usePlayers';
import { AnalyticsMatch, AnalyticsThrow, AnalyticsTimeScope, LeagueAnalyticsSummary, PlayerMatchStats, ThrowAnalyticsSummary } from '@/lib/analytics/types';
import { filterByScope } from '@/lib/analytics/timeScope';
import { getPlayerKey, buildPlayerMatchStats } from '@/lib/analytics/matchStats';
import { buildHeadToHeadStats } from '@/lib/analytics/headToHeadStats';
import { buildThrowAnalytics } from '@/lib/analytics/throwStats';

type MatchRow = {
  id: string;
  created_at: string;
  total_players: number;
  participants: Array<{
    player_id: string;
    rank: number;
    is_winner: boolean;
    player: { id: string; name: string } | null;
  }> | null;
};

type ThrowRow = {
  id: string;
  game_id: string;
  game_player_id: string;
  turn_number: number;
  throw_index: number;
  segment: number;
  multiplier: number;
  score: number;
  label: string;
  created_at: string;
  live_game_players: {
    player_id: string | null;
    player_name: string;
    live_games: {
      group_id: string;
      status: string;
      started_at: string;
      finished_at: string | null;
    };
  };
};

export function buildLeagueSummary(matches: Array<unknown>, throws: ThrowAnalyticsSummary, playerStats: PlayerMatchStats[]): LeagueAnalyticsSummary {
  const activePlayers = playerStats.filter((player) => player.matches > 0);
  const mostImproved = activePlayers[0] ?? null;
  const hottestPlayer = activePlayers.slice().sort((a, b) => b.recentForm.filter((form) => form === '1st').length - a.recentForm.filter((form) => form === '1st').length)[0] ?? null;
  const mostActive = activePlayers.slice().sort((a, b) => b.matches - a.matches)[0] ?? null;
  const biggestEloGainPlayer = activePlayers.slice().sort((a, b) => b.bestEloGain - a.bestEloGain)[0];

  return {
    activePlayers: activePlayers.length,
    matchesPlayed: matches.length,
    throwsTracked: throws.totalDarts,
    averageTurnScore: throws.averageTurnScore,
    averagePointsPerDart: throws.averagePointsPerDart,
    mostImproved,
    hottestPlayer,
    mostActive,
    biggestEloGain: biggestEloGainPlayer ? { playerName: biggestEloGainPlayer.playerName, value: biggestEloGainPlayer.bestEloGain } : null,
  };
}

export function useAnalyticsData(groupId: string | undefined, timeScope: AnalyticsTimeScope) {
  const yearForElo = timeScope.kind === 'year' ? timeScope.year ?? new Date().getFullYear() : null;
  const eloQuery = useCalculatedPlayers(groupId, false, yearForElo, true);

  const matchesQuery = useQuery({
    queryKey: ['analytics-matches', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('id, created_at, total_players, participants:match_participants(player_id, rank, is_winner, player:players(id, name))')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as MatchRow[];
    },
  });

  const throwsQuery = useQuery({
    queryKey: ['analytics-throws', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('game_throws')
        .select(`
          id,
          game_id,
          game_player_id,
          turn_number,
          throw_index,
          segment,
          multiplier,
          score,
          label,
          created_at,
          live_game_players!inner (
            player_id,
            player_name,
            live_games!inner (
              group_id,
              status,
              started_at,
              finished_at
            )
          )
        `)
        .eq('live_game_players.live_games.group_id', groupId)
        .eq('live_game_players.live_games.status', 'completed')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data ?? []) as unknown as ThrowRow[];
    },
  });

  const data = useMemo(() => {
    const eloHistory = eloQuery.data?.matchHistory ?? [];
    const eloResultsByMatch = new Map(eloHistory.map((match) => [match.matchId, match.results]));

    const rawMatches: AnalyticsMatch[] = (matchesQuery.data ?? []).map((match) => ({
      matchId: match.id,
      matchDate: match.created_at,
      totalPlayers: match.total_players,
      participants: (match.participants ?? [])
        .map((participant) => ({
          key: getPlayerKey(participant.player_id, participant.player?.name ?? 'Unknown player'),
          playerId: participant.player_id,
          playerName: participant.player?.name ?? 'Unknown player',
          rank: participant.rank,
          isWinner: participant.is_winner,
        }))
        .sort((a, b) => a.rank - b.rank),
      eloResults: eloResultsByMatch.get(match.id) ?? [],
    }));

    const scopedMatches = filterByScope(rawMatches, (match) => match.matchDate, timeScope);

    const rawThrows: AnalyticsThrow[] = (throwsQuery.data ?? []).map((dart) => ({
      id: dart.id,
      gameId: dart.game_id,
      gamePlayerId: dart.game_player_id,
      turnNumber: dart.turn_number,
      throwIndex: dart.throw_index,
      segment: dart.segment,
      multiplier: dart.multiplier,
      score: dart.score,
      label: dart.label,
      createdAt: dart.live_game_players.live_games.finished_at ?? dart.live_game_players.live_games.started_at ?? dart.created_at,
      playerId: dart.live_game_players.player_id,
      playerName: dart.live_game_players.player_name,
      key: getPlayerKey(dart.live_game_players.player_id, dart.live_game_players.player_name),
    }));

    const scopedThrows = filterByScope(rawThrows, (dart) => dart.createdAt, timeScope);
    const playerMatchStats = buildPlayerMatchStats(scopedMatches);
    const headToHead = buildHeadToHeadStats(scopedMatches);
    const darts = buildThrowAnalytics(scopedThrows);

    return {
      availableYears: eloQuery.data?.availableYears ?? [],
      calculatedPlayers: eloQuery.data?.players ?? [],
      matches: scopedMatches,
      playerMatchStats,
      headToHead,
      darts,
      league: buildLeagueSummary(scopedMatches, darts, playerMatchStats),
    };
  }, [eloQuery.data, matchesQuery.data, throwsQuery.data, timeScope]);

  return {
    data,
    isLoading: eloQuery.isLoading || matchesQuery.isLoading || throwsQuery.isLoading,
    isFetching: eloQuery.isFetching || matchesQuery.isFetching || throwsQuery.isFetching,
    error: eloQuery.error || matchesQuery.error || throwsQuery.error,
  };
}
