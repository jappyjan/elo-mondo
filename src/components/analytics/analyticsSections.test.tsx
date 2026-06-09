import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AnalyticsOverviewSection } from './AnalyticsOverviewSection';
import { DartsAnalyticsSection } from './DartsAnalyticsSection';
import { HeadToHeadSection } from './HeadToHeadSection';
import { PlayerAnalyticsSection } from './PlayerAnalyticsSection';
import { LeagueAnalyticsSummary, PairwiseRecord, PlayerMatchStats, ThrowAnalyticsSummary } from '@/lib/analytics/types';

const players: PlayerMatchStats[] = [
  {
    key: 'alice',
    playerId: 'alice',
    playerName: 'Alice',
    matches: 4,
    wins: 3,
    losses: 1,
    winRate: 0.75,
    averageFinishRank: 1.2,
    totalEloChange: 24,
    bestEloGain: 14,
    worstEloLoss: -3,
    recentForm: ['1st', '1st', '2nd'],
    placements: [{ rank: 1, count: 3 }, { rank: 2, count: 1 }],
  },
  {
    key: 'bob',
    playerId: 'bob',
    playerName: 'Bob',
    matches: 4,
    wins: 1,
    losses: 3,
    winRate: 0.25,
    averageFinishRank: 2.1,
    totalEloChange: -12,
    bestEloGain: 5,
    worstEloLoss: -9,
    recentForm: ['2nd', '3rd', '1st'],
    placements: [{ rank: 1, count: 1 }, { rank: 2, count: 2 }],
  },
];

const league: LeagueAnalyticsSummary = {
  activePlayers: 2,
  matchesPlayed: 4,
  throwsTracked: 120,
  averageTurnScore: 54.2,
  averagePointsPerDart: 18.1,
  mostImproved: players[0],
  hottestPlayer: players[0],
  mostActive: players[0],
  biggestEloGain: { playerName: 'Alice', value: 14 },
};

const darts: ThrowAnalyticsSummary = {
  totalDarts: 120,
  totalTurns: 40,
  averageTurnScore: 54.2,
  averagePointsPerDart: 18.1,
  exactDarts: [{ label: 'T20', count: 12 }],
  segments: [{ label: '20', count: 22 }],
  turnPatterns: [{ label: 'T20, T20, T20', count: 2 }],
  scoreDistribution: [],
  playerStats: [
    {
      key: 'alice',
      playerId: 'alice',
      playerName: 'Alice',
      totalDarts: 60,
      totalTurns: 20,
      averageTurnScore: 60,
      averagePointsPerDart: 20,
      missCount: 3,
      missRate: 0.05,
      singles: 20,
      doubles: 6,
      triples: 16,
      bulls: 1,
      t20Count: 8,
      oneCount: 2,
      count100Plus: 4,
      count140Plus: 2,
      count180: 1,
      bestTurn: 180,
      mostCommonSegment: '20',
      mostCommonDart: 'T20',
      mostCommonTurnPattern: 'T20, T20, T20',
    },
  ],
  funRecords: {
    mostOnes: [{ label: 'Alice', count: 2 }],
    mostMisses: [{ label: 'Bob', count: 5 }],
    mostFiveTwentyOne: [{ label: 'Alice', count: 1 }],
    mostTwentySixClub: [{ label: 'Bob', count: 2 }],
    mostNeighborHits: [],
    mostAllOverBoard: [],
    mostAlmost180: [{ label: 'Alice', count: 1 }],
    highestSingleRate: [],
    highestTripleRate: [{ label: 'Alice', count: 16, rate: 0.27 }],
  },
};

const records: PairwiseRecord[] = [
  {
    key: 'alice',
    playerId: 'alice',
    playerName: 'Alice',
    opponentKey: 'bob',
    opponentId: 'bob',
    opponentName: 'Bob',
    wins: 3,
    losses: 1,
    totalGames: 4,
    winRate: 0.75,
    eloChange: 18,
    meetings: [],
  },
];

describe('analytics sections', () => {
  it('renders league overview with headline and dart leaderboards', () => {
    const html = renderToStaticMarkup(<AnalyticsOverviewSection league={league} players={players} darts={darts} />);

    expect(html).toContain('Active players');
    expect(html).toContain('Most improved');
    expect(html).toContain('Most common darts');
    expect(html).toContain('T20');
  });

  it('renders player profile stats for the selected player', () => {
    const html = renderToStaticMarkup(<PlayerAnalyticsSection players={players} darts={darts} />);

    expect(html).toContain('Alice');
    expect(html).toContain('Win rate');
    expect(html).toContain('75%');
    expect(html).toContain('Player dart profile');
  });

  it('renders pairwise head-to-head records and leaderboards', () => {
    const html = renderToStaticMarkup(<HeadToHeadSection players={players} records={records} rivalryLeaders={records} dominanceLeaders={records} />);

    expect(html).toContain('Record');
    expect(html).toContain('3-1');
    expect(html).toContain('Most-played rivalries');
    expect(html).toContain('Alice vs Bob');
  });

  it('renders serious and fun dart stats', () => {
    const html = renderToStaticMarkup(<DartsAnalyticsSection darts={darts} />);

    expect(html).toContain('Total darts');
    expect(html).toContain('Most common exact darts');
    expect(html).toContain('Fun stats');
    expect(html).toContain('Most 5 + 20 + 1');
  });
});
