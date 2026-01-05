import { LiveGameProvider, useLiveGameContext } from '@/contexts/LiveGameContext';
import { GameSetup } from '@/components/live-game/GameSetup';
import { GameBoard } from '@/components/live-game/GameBoard';
import { GameSettings } from '@/types/liveGame';
import { useParams, Navigate } from 'react-router-dom';

function LiveGameContent() {
  const { gameState, startGame, resetGame } = useLiveGameContext();
  const { groupId } = useParams<{ groupId: string }>();

  const handleStartGame = (settings: GameSettings) => {
    startGame(settings);
  };

  const handleReset = () => {
    resetGame();
  };

  // Ensure groupId is defined before rendering the game
  if (!groupId) {
    throw new Error('Group ID is required');
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
  return (
    <LiveGameProvider>
      <LiveGameContent />
    </LiveGameProvider>
  );
}
