import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameResults } from './GameResults';
import { PlayerGameState } from '@/types/liveGame';

const makePlayerState = (overrides: Partial<PlayerGameState>): PlayerGameState => ({
  playerId: 'game-player-1',
  actualPlayerId: 'player-1',
  playerName: 'Alice',
  startingScore: 501,
  currentScore: 0,
  hasDoubledIn: true,
  finishedRank: 1,
  turnHistory: [
    {
      darts: [{ segment: 20, multiplier: 3, score: 60, label: 'T20' }],
      scoreAtStart: 60,
      scoreAtEnd: 0,
      isBust: false,
      hadDoubledInBefore: true,
      doubledInThisTurn: false,
    },
  ],
  ...overrides,
});

const playerStates: Record<string, PlayerGameState> = {
  'game-player-1': makePlayerState({
    playerId: 'game-player-1',
    actualPlayerId: 'player-1',
    playerName: 'Alice',
    finishedRank: 1,
  }),
  'game-player-2': makePlayerState({
    playerId: 'game-player-2',
    actualPlayerId: 'player-2',
    playerName: 'Bob',
    currentScore: 12,
    finishedRank: 2,
  }),
};

function renderGameResults({
  canUndo = true,
  onUndo = vi.fn(),
}: {
  canUndo?: boolean;
  onUndo?: () => void;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <GameResults
          playerStates={playerStates}
          onNewGame={vi.fn()}
          onUndo={onUndo}
          canUndo={canUndo}
          groupId="group-1"
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { onUndo };
}

describe('GameResults', () => {
  afterEach(() => {
    cleanup();
  });

  it('calls undo when Undo Last Throw is clicked before saving', () => {
    const { onUndo } = renderGameResults();

    fireEvent.click(screen.getByRole('button', { name: /undo last throw/i }));

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('hides undo when no throw can be undone', () => {
    renderGameResults({ canUndo: false });

    expect(screen.queryByRole('button', { name: /undo last throw/i })).toBeNull();
  });
});
