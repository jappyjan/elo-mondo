import { describe, expect, it } from 'vitest';
import { buildLeagueSummary, mapThrowRowsToAnalyticsThrows } from './useAnalyticsData';
import { PlayerMatchStats, ThrowAnalyticsSummary } from '@/lib/analytics/types';

const players: PlayerMatchStats[] = [
  {
    key: 'alice',
    playerId: 'alice',
    playerName: 'Alice',
    matches: 3,
    wins: 2,
    losses: 1,
    winRate: 2 / 3,
    averageFinishRank: 1.3,
    totalEloChange: 28,
    bestEloGain: 16,
    worstEloLoss: -4,
    recentForm: ['1st', '2nd', '1st'],
    placements: [],
  },
  {
    key: 'bob',
    playerId: 'bob',
    playerName: 'Bob',
    matches: 5,
    wins: 1,
    losses: 4,
    winRate: 0.2,
    averageFinishRank: 2.4,
    totalEloChange: -12,
    bestEloGain: 8,
    worstEloLoss: -10,
    recentForm: ['3rd', '2nd', '2nd'],
    placements: [],
  },
];

const darts: ThrowAnalyticsSummary = {
  totalDarts: 90,
  totalTurns: 30,
  averageTurnScore: 52.5,
  averagePointsPerDart: 17.5,
  exactDarts: [],
  segments: [],
  turnPatterns: [],
  scoreDistribution: [],
  playerStats: [],
  funRecords: {
    mostOnes: [],
    mostMisses: [],
    mostFiveTwentyOne: [],
    mostTwentySixClub: [],
    mostNeighborHits: [],
    mostAllOverBoard: [],
    mostAlmost180: [],
    highestSingleRate: [],
    highestTripleRate: [],
  },
};

describe('buildLeagueSummary', () => {
  it('selects league headline stats from match and throw summaries', () => {
    const summary = buildLeagueSummary([{ matchId: 'm1' }, { matchId: 'm2' }], darts, players);

    expect(summary).toMatchObject({
      activePlayers: 2,
      matchesPlayed: 2,
      throwsTracked: 90,
      averageTurnScore: 52.5,
      averagePointsPerDart: 17.5,
    });
    expect(summary.mostImproved?.playerName).toBe('Alice');
    expect(summary.hottestPlayer?.playerName).toBe('Alice');
    expect(summary.mostActive?.playerName).toBe('Bob');
    expect(summary.biggestEloGain).toEqual({ playerName: 'Alice', value: 16 });
  });
});

describe('mapThrowRowsToAnalyticsThrows', () => {
  it('maps game_throws rows joined directly to live_games for group filtering', () => {
    const throws = mapThrowRowsToAnalyticsThrows([
      {
        id: 'throw-1',
        game_id: 'game-1',
        game_player_id: 'game-player-1',
        turn_number: 2,
        throw_index: 1,
        segment: 20,
        multiplier: 3,
        score: 60,
        label: 'T20',
        created_at: '2026-06-08T12:00:00.000Z',
        live_games: {
          group_id: 'group-1',
          status: 'completed',
          started_at: '2026-06-08T11:00:00.000Z',
          finished_at: '2026-06-08T12:30:00.000Z',
        },
        live_game_players: {
          player_id: 'alice',
          player_name: 'Alice',
        },
      },
    ]);

    expect(throws).toEqual([
      {
        id: 'throw-1',
        gameId: 'game-1',
        gamePlayerId: 'game-player-1',
        turnNumber: 2,
        throwIndex: 1,
        segment: 20,
        multiplier: 3,
        score: 60,
        label: 'T20',
        createdAt: '2026-06-08T12:30:00.000Z',
        playerId: 'alice',
        playerName: 'Alice',
        key: 'alice',
      },
    ]);
  });
});
