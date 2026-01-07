import { LiveGameProvider, useLiveGameContext } from '@/contexts/LiveGameContext';
import { GameSetup } from '@/components/live-game/GameSetup';
import { GameBoard } from '@/components/live-game/GameBoard';
import { GameSettings } from '@/types/liveGame';
import { useParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

function LiveGameContent({ groupId }: { groupId: string }) {
  const { gameState, isLoading, startGame, resetGame } = useLiveGameContext();

  const handleStartGame = async (settings: GameSettings) => {
    await startGame(settings);
  };

  const handleReset = async () => {
    await resetGame();
  };

  if (isLoading) {
    return (
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Live Game</h1>
        <p className="text-muted-foreground">
          {gameState ? 'Game in progress' : 'Set up a new dart game'}
        </p>
      </div>

      {gameState ? (
        <GameBoard onReset={handleReset} groupId={groupId} />
      ) : (
        <GameSetup onStartGame={handleStartGame} />
      )}
    </main>
  );
}

export default function LiveGame() {
  const { groupId } = useParams<{ groupId: string }>();

  if (!groupId) {
    throw new Error('Group ID is required');
  }

  return (
    <LiveGameProvider groupId={groupId}>
      <LiveGameContent groupId={groupId} />
    </LiveGameProvider>
  );
}
