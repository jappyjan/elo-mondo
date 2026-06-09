import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsOverviewSection } from './AnalyticsOverviewSection';
import { DartsAnalyticsSection } from './DartsAnalyticsSection';
import { HeadToHeadSection } from './HeadToHeadSection';
import { PlayerAnalyticsSection } from './PlayerAnalyticsSection';
import { LeagueAnalyticsSummary, PairwiseRecord, PlayerMatchStats, ThrowAnalyticsSummary } from '@/lib/analytics/types';

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: { children: React.ReactNode; onValueChange?: (value: string) => void; value?: string }) => (
    <div>
      <button type="button" data-testid={`select-${value}`} onClick={() => onValueChange?.(value === 'alice' ? 'bob' : 'alice')}>change</button>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <div data-select-item={value}>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

afterEach(() => {
  cleanup();
});

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
  scoreDistribution: [{ label: '100-139', count: 3 }],
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
    meetings: [{ matchId: 'match-1', matchDate: '2026-06-01', playerRank: 1, opponentRank: 2, eloChange: 12 }],
  },
];

describe('analytics sections', () => {
  it('renders league overview with headline and dart leaderboards', () => {
    const html = renderToStaticMarkup(<AnalyticsOverviewSection league={league} players={players} darts={darts} rivalryLeaders={records} />);

    expect(html).toContain('Active players');
    expect(html).toContain('League momentum');
    expect(html).toContain('Score distribution');
    expect(html).toContain('100-139');
    expect(html).toContain('Hottest form');
    expect(html).toContain('Most improved');
    expect(html).toContain('Most common darts');
    expect(html).toContain('T20');
  });

  it('renders player profile stats for the selected player', () => {
    const html = renderToStaticMarkup(<PlayerAnalyticsSection players={players} darts={darts} />);

    expect(html).toContain('Alice');
    expect(html).toContain('Win rate');
    expect(html).toContain('75%');
    expect(html).toContain('Player profile');
    expect(html).toContain('Placement distribution');
    expect(html).toContain('Throw type split');
    expect(html).toContain('Recent form');
    expect(html).toContain('Player dart profile');
  });

  it('does not overwrite controlled player selection when search has no matches', async () => {
    const onSelectedPlayerKeyChange = vi.fn();

    render(
      <PlayerAnalyticsSection
        players={players}
        darts={darts}
        selectedPlayerKey="bob"
        onSelectedPlayerKeyChange={onSelectedPlayerKeyChange}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Search player'), { target: { value: 'zzzz' } });

    expect(await screen.findByText('No matching players')).toBeTruthy();
    expect(onSelectedPlayerKeyChange).not.toHaveBeenCalled();
  });

  it('renders pairwise head-to-head records and leaderboards', () => {
    const html = renderToStaticMarkup(<HeadToHeadSection players={players} records={records} rivalryLeaders={records} dominanceLeaders={records} />);

    expect(html).toContain('Record');
    expect(html).toContain('3-1');
    expect(html).toContain('Rivalry snapshot');
    expect(html).toContain('Win-rate split');
    expect(html).toContain('Recent meetings');
    expect(html).toContain('Most-played rivalries');
    expect(html).toContain('Alice vs Bob');
  });

  it('defaults head-to-head comparison to an existing record when the first two players have not met', () => {
    const extraPlayers = [
      { ...players[0], key: 'marco', playerId: 'marco', playerName: 'Marco' },
      { ...players[1], key: 'marcus', playerId: 'marcus', playerName: 'Marcus' },
      { ...players[0], key: 'jappy', playerId: 'jappy', playerName: 'Jappy' },
      { ...players[1], key: 'jacob', playerId: 'jacob', playerName: 'Jacob' },
    ];
    const jappyRecord = { ...records[0], key: 'jappy', playerId: 'jappy', playerName: 'Jappy', opponentKey: 'jacob', opponentId: 'jacob', opponentName: 'Jacob', wins: 32, losses: 29, totalGames: 61 };

    const html = renderToStaticMarkup(<HeadToHeadSection players={extraPlayers} records={[jappyRecord]} rivalryLeaders={[jappyRecord]} dominanceLeaders={[jappyRecord]} />);

    expect(html).not.toContain('0-0');
    expect(html).toContain('32-29');
  });

  it('renders an empty win-rate split when selected head-to-head players have no record', () => {
    const extraPlayers = [
      ...players,
      { ...players[0], key: 'charlie', playerId: 'charlie', playerName: 'Charlie' },
    ];

    const html = renderToStaticMarkup(
      <HeadToHeadSection
        players={extraPlayers}
        records={records}
        rivalryLeaders={records}
        dominanceLeaders={records}
        selectedPlayerKey="alice"
        selectedOpponentKey="charlie"
      />
    );

    expect(html).toContain('Win-rate split');
    expect(html).toContain('No head-to-head record');
  });

  it('repairs same-player head-to-head selections with one pair update', async () => {
    const onSelectedPairChange = vi.fn();

    render(
      <HeadToHeadSection
        players={players}
        records={records}
        rivalryLeaders={records}
        dominanceLeaders={records}
        selectedPlayerKey="alice"
        selectedOpponentKey="alice"
        onSelectedPairChange={onSelectedPairChange}
      />
    );

    await waitFor(() => {
      expect(onSelectedPairChange).toHaveBeenCalledWith({ playerKey: 'alice', opponentKey: 'bob' });
    });
  });

  it('emits one atomic pair update when changing head-to-head selectors', () => {
    const onSelectedPairChange = vi.fn();
    const onSelectedPlayerKeyChange = vi.fn();
    const onSelectedOpponentKeyChange = vi.fn();

    render(
      <HeadToHeadSection
        players={players}
        records={records}
        rivalryLeaders={records}
        dominanceLeaders={records}
        selectedPlayerKey="alice"
        selectedOpponentKey="bob"
        onSelectedPairChange={onSelectedPairChange}
        onSelectedPlayerKeyChange={onSelectedPlayerKeyChange}
        onSelectedOpponentKeyChange={onSelectedOpponentKeyChange}
      />
    );

    fireEvent.click(screen.getByTestId('select-alice'));

    expect(onSelectedPairChange).toHaveBeenCalledTimes(1);
    expect(onSelectedPairChange).toHaveBeenCalledWith({ playerKey: 'bob', opponentKey: 'alice' });
    expect(onSelectedPlayerKeyChange).not.toHaveBeenCalled();
    expect(onSelectedOpponentKeyChange).not.toHaveBeenCalled();
  });

  it('renders serious and fun dart stats', () => {
    const html = renderToStaticMarkup(<DartsAnalyticsSection darts={darts} />);

    expect(html).toContain('Total darts');
    expect(html).toContain('Score distribution');
    expect(html).toContain('Throw type split');
    expect(html).toContain('Segment popularity');
    expect(html).toContain('Fun awards');
    expect(html).toContain('Most common exact darts');
    expect(html).toContain('Most 5 + 20 + 1');
  });

  it('renders empty states for dart visual cards when tracked darts lack chart source rows', () => {
    const html = renderToStaticMarkup(
      <DartsAnalyticsSection
        darts={{
          ...darts,
          totalDarts: 12,
          scoreDistribution: [],
          segments: [],
          playerStats: [],
        }}
      />
    );

    expect(html).toContain('No dart score buckets');
    expect(html).toContain('No throw type data yet');
    expect(html).toContain('No segment data yet');
  });

  it('renders an empty score distribution when all score buckets are zero', () => {
    const html = renderToStaticMarkup(
      <DartsAnalyticsSection
        darts={{
          ...darts,
          scoreDistribution: [
            { label: '0-59', count: 0 },
            { label: '60-99', count: 0 },
            { label: '100-139', count: 0 },
          ],
        }}
      />
    );

    expect(html).toContain('Score distribution');
    expect(html).toContain('No dart score buckets');
  });
});
