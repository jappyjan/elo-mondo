import { describe, expect, it } from 'vitest';
import { buildPlayerMatchStats, getPlayerKey } from './matchStats';
import { AnalyticsMatch } from './types';

const matches: AnalyticsMatch[] = [
  {
    matchId: 'm1',
    matchDate: '2026-06-01T00:00:00.000Z',
    totalPlayers: 3,
    participants: [
      { key: 'alice', playerId: 'alice', playerName: 'Alice', rank: 1, isWinner: true },
      { key: 'bob', playerId: 'bob', playerName: 'Bob', rank: 2, isWinner: false },
      { key: 'cara', playerId: 'cara', playerName: 'Cara', rank: 3, isWinner: false },
    ],
    eloResults: [
      { playerId: 'alice', eloBefore: 1000, eloAfter: 1018, eloChange: 18 },
      { playerId: 'bob', eloBefore: 1000, eloAfter: 1001, eloChange: 1 },
      { playerId: 'cara', eloBefore: 1000, eloAfter: 981, eloChange: -19 },
    ],
  },
  {
    matchId: 'm2',
    matchDate: '2026-06-03T00:00:00.000Z',
    totalPlayers: 2,
    participants: [
      { key: 'bob', playerId: 'bob', playerName: 'Bob', rank: 1, isWinner: true },
      { key: 'alice', playerId: 'alice', playerName: 'Alice', rank: 2, isWinner: false },
    ],
    eloResults: [
      { playerId: 'bob', eloBefore: 1001, eloAfter: 1017, eloChange: 16 },
      { playerId: 'alice', eloBefore: 1018, eloAfter: 1002, eloChange: -16 },
    ],
  },
];

describe('getPlayerKey', () => {
  it('uses real player id before fallback name identity', () => {
    expect(getPlayerKey('p1', 'Alice')).toBe('p1');
    expect(getPlayerKey(null, 'Guest Player')).toBe('name:guest player');
  });
});

describe('buildPlayerMatchStats', () => {
  it('aggregates wins, losses, placements, and Elo change from participant ranks', () => {
    const stats = buildPlayerMatchStats(matches);
    const alice = stats.find((player) => player.key === 'alice');
    const bob = stats.find((player) => player.key === 'bob');

    expect(alice).toMatchObject({ matches: 2, wins: 1, losses: 1, totalEloChange: 2, bestEloGain: 18, worstEloLoss: -16 });
    expect(alice?.averageFinishRank).toBe(1.5);
    expect(alice?.recentForm).toEqual(['1st', '2nd']);
    expect(bob).toMatchObject({ matches: 2, wins: 1, losses: 1, totalEloChange: 17 });
  });
});
