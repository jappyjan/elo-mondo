import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { convex, api, fetchAnalyticsThrows } from '@/integrations/convex/client';
import { useCalculatedPlayers } from '@/hooks/usePlayers';
import { AnalyticsMatch, AnalyticsThrow, AnalyticsTimeScope, LeagueAnalyticsSummary, PlayerMatchStats, ThrowAnalyticsSummary } from '@/lib/analytics/types';
import { filterByScope, getScopeEnd, getScopeStart } from '@/lib/analytics/timeScope';
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
  live_games: {
    group_id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
  };
  live_game_players: {
    player_id: string | null;
    player_name: string;
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

export function mapThrowRowsToAnalyticsThrows(rows: ThrowRow[]): AnalyticsThrow[] {
  return rows.map((dart) => ({
    id: dart.id,
    gameId: dart.game_id,
    gamePlayerId: dart.game_player_id,
    turnNumber: dart.turn_number,
    throwIndex: dart.throw_index,
    segment: dart.segment,
    multiplier: dart.multiplier,
    score: dart.score,
    label: dart.label,
    createdAt: dart.created_at,
    playerId: dart.live_game_players.player_id,
    playerName: dart.live_game_players.player_name,
    key: getPlayerKey(dart.live_game_players.player_id, dart.live_game_players.player_name),
  }));
}

export function getAnalyticsThrowDateRange(scope: AnalyticsTimeScope): { start: string | null; end: string | null } {
  return {
    start: getScopeStart(scope)?.toISOString() ?? null,
    end: getScopeEnd(scope)?.toISOString() ?? null,
  };
}

export function useAnalyticsData(groupId: string | undefined, timeScope: AnalyticsTimeScope) {
  const yearForElo = timeScope.kind === 'year' ? timeScope.year ?? new Date().getFullYear() : null;
  const eloQuery = useCalculatedPlayers(groupId, false, yearForElo, true);

  const matchesQuery = useQuery({
    queryKey: ['analytics-matches', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      return convex.query(api.data.matches, { groupId: groupId! });
    },
  });

  const throwsQuery = useQuery({
    queryKey: ['analytics-throws', groupId, timeScope.kind, timeScope.year, timeScope.now?.toISOString()],
    enabled: !!groupId,
    queryFn: async () => {
      const range = getAnalyticsThrowDateRange(timeScope);
      return fetchAnalyticsThrows(groupId!, range.start ?? undefined, range.end ?? undefined);
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

    const rawThrows = mapThrowRowsToAnalyticsThrows(throwsQuery.data ?? []);

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
