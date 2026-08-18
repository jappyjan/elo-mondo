import { describe, expect, it } from 'vitest';
import { applyEloDecay, buildEloProgressionSeries, type EloDecaySettings } from './eloProgression';
import { CalculatedPlayer, MatchHistoryEntry } from '@/types/darts';

const DECAY: EloDecaySettings = { halfLifeDays: 30, startDay: 14 };

const day = 24 * 60 * 60 * 1000;

function player(id: string, name: string): CalculatedPlayer {
  return {
    playerId: id,
    playerName: name,
    currentElo: 1000,
    rawElo: 1000,
    decayApplied: 0,
    daysSinceLastMatch: null,
    matchesPlayed: 1,
    wins: 0,
    losses: 0,
    winRate: 0,
    rank: 0,
    isProvisional: false,
  };
}

function entry(matchId: string, date: Date, results: Array<[string, number]>): MatchHistoryEntry {
  return {
    matchId,
    matchDate: date.toISOString(),
    results: results.map(([playerId, eloAfter]) => ({
      playerId,
      eloBefore: 1000,
      eloAfter,
      eloChange: eloAfter - 1000,
    })),
  };
}

describe('applyEloDecay', () => {
  it('leaves Elo untouched inside the grace period', () => {
    const last = new Date('2026-01-01T00:00:00Z');
    const at = new Date(last.getTime() + 10 * day);
    expect(applyEloDecay(1200, last, at, DECAY)).toBe(1200);
  });

  it('halves the distance to 1000 after one half-life', () => {
    const last = new Date('2026-01-01T00:00:00Z');
    const at = new Date(last.getTime() + 30 * day);
    expect(applyEloDecay(1200, last, at, DECAY)).toBeCloseTo(1100, 6);
  });
});

describe('buildEloProgressionSeries', () => {
  const start = new Date('2026-01-01T00:00:00Z');
  const players = [player('a', 'Alice'), player('b', 'Bob'), player('c', 'Carol'), player('d', 'Dave')];
  const matchHistory: MatchHistoryEntry[] = [
    entry('m1', start, [['a', 1200], ['b', 800]]),
    // 90 days later two other players play: Alice and Bob have been idle
    entry('m2', new Date(start.getTime() + 90 * day), [['c', 1100], ['d', 900]]),
  ];
  const now = new Date(start.getTime() + 120 * day);

  it('returns raw Elo when decay is disabled', () => {
    const points = buildEloProgressionSeries({ matchHistory, players, range: 'all', decay: null, now });
    expect(points.at(-1)?.Alice).toBe(1200);
    expect(points.some((p) => p.isNow)).toBe(false);
  });

  it('decays idle players at later match points', () => {
    const points = buildEloProgressionSeries({ matchHistory, players, range: 'all', decay: DECAY, now });
    const m2Point = points.find((p) => p.match === 2)!;
    // Alice idle for 90 days: 1000 + 200 * 0.5^3 = 1025
    expect(m2Point.Alice).toBe(1025);
    expect(m2Point.Bob).toBe(975);
    // Carol just played, no decay
    expect(m2Point.Carol).toBe(1100);
  });

  it('appends a decayed "now" point when the series ends at the newest match', () => {
    const points = buildEloProgressionSeries({ matchHistory, players, range: 'all', decay: DECAY, now });
    const last = points.at(-1)!;
    expect(last.isNow).toBe(true);
    // Carol idle 30 days: 1000 + 100 * 0.5 = 1050
    expect(last.Carol).toBe(1050);
    // Alice idle 120 days: 1000 + 200 * 0.5^4 = 1012.5 -> 1013
    expect(last.Alice).toBe(1013);
  });

  it('does not append a now point when the range cuts off older matches only', () => {
    const trimmed = buildEloProgressionSeries({
      matchHistory,
      players,
      range: 'lastMonth',
      decay: DECAY,
      now,
    });
    // only m2 is inside the last 30 days, and it is still the newest match
    expect(trimmed.at(-1)?.isNow).toBe(true);
    expect(trimmed.filter((p) => p.isNow)).toHaveLength(1);
  });
});
