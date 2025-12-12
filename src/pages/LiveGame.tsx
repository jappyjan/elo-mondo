import { useLiveGame } from '@/hooks/useLiveGame';
import { GameSetup } from '@/components/live-game/GameSetup';
import { GameBoard } from '@/components/live-game/GameBoard';
import { GameSettings } from '@/types/liveGame';

export default function LiveGame() {
  const { gameState, startGame, resetGame } = useLiveGame();

  const handleStartGame = (settings: GameSettings) => {
    startGame(settings);
  };

  const handleReset = () => {
    resetGame();
  };

  return (
    <main className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Live Game</h1>
        <p className="text-muted-foreground">
          {gameState ? 'Game in progress' : 'Set up a new dart game'}
        </p>
      </div>

      {gameState ? (
        <GameBoard onReset={handleReset} />
      ) : (
        <GameSetup onStartGame={handleStartGame} />
      )}
    </main>
  );
}
