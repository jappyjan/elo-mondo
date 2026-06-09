import { describe, expect, it } from 'vitest';
import { buildThrowAnalytics } from './throwStats';
import { AnalyticsThrow } from './types';

function dart(id: string, playerName: string, turnNumber: number, throwIndex: number, segment: number, multiplier: number, score: number, label: string): AnalyticsThrow {
  const playerId = playerName.toLowerCase();
  return {
    id,
    key: playerId,
    playerId,
    playerName,
    gameId: 'g1',
    gamePlayerId: `gp-${playerId}`,
    turnNumber,
    throwIndex,
    segment,
    multiplier,
    score,
    label,
    createdAt: `2026-06-01T00:0${turnNumber}:0${throwIndex}.000Z`,
  };
}

const throws = [
  dart('a1', 'Alice', 1, 0, 20, 1, 20, 'S20'),
  dart('a2', 'Alice', 1, 1, 5, 1, 5, 'S5'),
  dart('a3', 'Alice', 1, 2, 1, 1, 1, 'S1'),
  dart('a4', 'Alice', 2, 0, 20, 3, 60, 'T20'),
  dart('a5', 'Alice', 2, 1, 20, 3, 60, 'T20'),
  dart('a6', 'Alice', 2, 2, 20, 3, 60, 'T20'),
  dart('b1', 'Bob', 1, 0, 0, 0, 0, 'MISS'),
  dart('b2', 'Bob', 1, 1, 1, 1, 1, 'S1'),
  dart('b3', 'Bob', 1, 2, 1, 1, 1, 'S1'),
];

describe('buildThrowAnalytics', () => {
  it('aggregates team and player throw stats', () => {
    const stats = buildThrowAnalytics(throws);
    const alice = stats.playerStats.find((player) => player.playerName === 'Alice');

    expect(stats.totalDarts).toBe(9);
    expect(stats.totalTurns).toBe(3);
    expect(stats.averageTurnScore).toBe(69.3);
    expect(alice).toMatchObject({ totalDarts: 6, totalTurns: 2, count180: 1, oneCount: 1, mostCommonDart: 'T20' });
  });

  it('builds fun records from individual darts and turn patterns', () => {
    const stats = buildThrowAnalytics(throws);

    expect(stats.funRecords.mostOnes[0]).toMatchObject({ label: 'Bob', count: 2 });
    expect(stats.funRecords.mostMisses[0]).toMatchObject({ label: 'Bob', count: 1 });
    expect(stats.funRecords.mostFiveTwentyOne[0]).toMatchObject({ label: 'Alice', count: 1 });
  });
});
