import { describe, expect, it } from 'vitest';
import { buildHeadToHeadStats } from './headToHeadStats';
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
    matchDate: '2026-06-02T00:00:00.000Z',
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

describe('buildHeadToHeadStats', () => {
  it('counts multiplayer matches pairwise from finish ranks', () => {
    const result = buildHeadToHeadStats(matches);
    const aliceVsBob = result.records.find((record) => record.key === 'alice' && record.opponentKey === 'bob');
    const bobVsCara = result.records.find((record) => record.key === 'bob' && record.opponentKey === 'cara');

    expect(aliceVsBob).toMatchObject({ wins: 1, losses: 1, totalGames: 2, winRate: 0.5, eloChange: 2 });
    expect(aliceVsBob?.meetings.map((meeting) => meeting.matchId)).toEqual(['m1', 'm2']);
    expect(bobVsCara).toMatchObject({ wins: 1, losses: 0, totalGames: 1, winRate: 1 });
  });

  it('builds rivalry and dominance leaderboards', () => {
    const result = buildHeadToHeadStats(matches);

    expect(result.rivalryLeaders[0].totalGames).toBe(2);
    expect(result.dominanceLeaders.some((record) => record.key === 'alice' && record.opponentKey === 'cara')).toBe(true);
  });
});
