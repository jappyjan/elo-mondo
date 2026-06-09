import { describe, expect, it } from 'vitest';
import { groupThrowsIntoTurns, isAlmost180Turn, isFiveTwentyOneTurn, isMiss, normalizeDartLabel } from './dartPatternStats';
import { AnalyticsThrow } from './types';

const base = { key: 'alice', playerId: 'alice', playerName: 'Alice', gameId: 'g1', gamePlayerId: 'gp1', createdAt: '2026-06-01T00:00:00.000Z' };

const throws: AnalyticsThrow[] = [
  { ...base, id: 't1', turnNumber: 1, throwIndex: 0, segment: 20, multiplier: 1, score: 20, label: 'S20' },
  { ...base, id: 't2', turnNumber: 1, throwIndex: 1, segment: 5, multiplier: 1, score: 5, label: 'S5' },
  { ...base, id: 't3', turnNumber: 1, throwIndex: 2, segment: 1, multiplier: 1, score: 1, label: 'S1' },
  { ...base, id: 't4', turnNumber: 2, throwIndex: 0, segment: 20, multiplier: 3, score: 60, label: 'T20' },
  { ...base, id: 't5', turnNumber: 2, throwIndex: 1, segment: 20, multiplier: 3, score: 60, label: 'T20' },
  { ...base, id: 't6', turnNumber: 2, throwIndex: 2, segment: 5, multiplier: 1, score: 5, label: 'S5' },
];

describe('dart pattern helpers', () => {
  it('normalizes labels and detects misses', () => {
    expect(normalizeDartLabel(' miss ')).toBe('MISS');
    expect(isMiss({ ...throws[0], label: 'MISS', score: 0 })).toBe(true);
    expect(isMiss({ ...throws[0], label: '', score: 0 })).toBe(true);
  });

  it('groups throws into ordered turns', () => {
    const turns = groupThrowsIntoTurns(throws);

    expect(turns).toHaveLength(2);
    expect(turns[0].labels).toEqual(['S20', 'S5', 'S1']);
    expect(turns[0].totalScore).toBe(26);
  });

  it('detects 5 + 20 + 1 and almost-180 turns', () => {
    const turns = groupThrowsIntoTurns(throws);

    expect(isFiveTwentyOneTurn(turns[0])).toBe(true);
    expect(isAlmost180Turn(turns[1])).toBe(true);
  });
});
