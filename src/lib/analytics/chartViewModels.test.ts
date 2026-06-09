import { describe, expect, it } from 'vitest';
import {
  buildScoreDistribution,
  buildSegmentPopularity,
  buildThrowTypeSplit,
  buildTopMoverBars,
} from './chartViewModels';
import { CountStat, PlayerMatchStats, PlayerThrowStats } from './types';

function matchStats(playerName: string, totalEloChange: number): PlayerMatchStats {
  return {
    key: playerName,
    playerId: playerName,
    playerName,
    matches: 1,
    wins: 0,
    losses: 1,
    winRate: 0,
    averageFinishRank: 2,
    totalEloChange,
    bestEloGain: Math.max(totalEloChange, 0),
    worstEloLoss: Math.min(totalEloChange, 0),
    recentForm: [],
    placements: [],
  };
}

function throwStats(overrides: Partial<PlayerThrowStats>): PlayerThrowStats {
  return {
    key: 'alice',
    playerId: 'alice',
    playerName: 'Alice',
    totalDarts: 0,
    totalTurns: 0,
    averageTurnScore: 0,
    averagePointsPerDart: 0,
    missCount: 0,
    missRate: 0,
    singles: 0,
    doubles: 0,
    triples: 0,
    bulls: 0,
    t20Count: 0,
    oneCount: 0,
    count100Plus: 0,
    count140Plus: 0,
    count180: 0,
    bestTurn: 0,
    mostCommonSegment: '',
    mostCommonDart: '',
    mostCommonTurnPattern: '',
    ...overrides,
  };
}

describe('chart view models', () => {
  it('builds top mover bars sorted by absolute Elo movement with signed display values and tone', () => {
    const players = [matchStats('C', 0), matchStats('B', 12), matchStats('A', -20)];

    expect(buildTopMoverBars(players)).toEqual([
      { label: 'A', value: 20, displayValue: '-20', tone: 'warning' },
      { label: 'B', value: 12, displayValue: '+12', tone: 'good' },
      { label: 'C', value: 0, displayValue: '0', tone: 'default' },
    ]);
  });

  it('orders score distribution buckets consistently', () => {
    const rows: CountStat[] = [
      { label: '180', count: 1 },
      { label: '60-99', count: 4 },
      { label: '0-59', count: 3 },
      { label: '140-179', count: 2 },
      { label: '100-139', count: 5 },
    ];

    expect(buildScoreDistribution(rows)).toEqual([
      { label: '0-59', value: 3 },
      { label: '60-99', value: 4 },
      { label: '100-139', value: 5 },
      { label: '140-179', value: 2 },
      { label: '180', value: 1 },
    ]);
  });

  it('builds throw type split from player throw stats', () => {
    const player = throwStats({ singles: 9, doubles: 3, triples: 2, bulls: 1, missCount: 4 });

    expect(buildThrowTypeSplit(player)).toEqual([
      { label: 'Singles', value: 9 },
      { label: 'Doubles', value: 3 },
      { label: 'Triples', value: 2 },
      { label: 'Bulls', value: 1 },
      { label: 'Misses', value: 4 },
    ]);
    expect(buildThrowTypeSplit(null)).toEqual([]);
    expect(buildThrowTypeSplit(undefined)).toEqual([]);
  });

  it('limits segment popularity to the top 20 rows while preserving order', () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      label: String(index + 1),
      count: index + 1,
    }));

    expect(buildSegmentPopularity(rows)).toHaveLength(20);
    expect(buildSegmentPopularity(rows).at(0)).toEqual({ label: '1', value: 1 });
    expect(buildSegmentPopularity(rows).at(19)).toEqual({ label: '20', value: 20 });
  });
});
