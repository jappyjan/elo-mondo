import { describe, expect, it } from 'vitest';
import { buildLeagueSummary } from './useAnalyticsData';
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
