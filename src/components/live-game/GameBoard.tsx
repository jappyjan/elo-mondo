import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLiveGameContext } from '@/contexts/LiveGameContext';
import { DartInput } from './DartInput';
import { CurrentTurn } from './CurrentTurn';
import { ScoreBoard } from './ScoreBoard';
import { TurnHistory } from './TurnHistory';
import { GameResults } from './GameResults';
import { DartThrow } from '@/types/liveGame';
import { cn } from '@/lib/utils';
import { Undo2, RotateCcw, History, AlertTriangle, FastForward } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface GameBoardProps {
  onReset: () => void;
}

export function GameBoard({ onReset }: GameBoardProps) {
  const {
    gameState,
    resetGame,
    getCurrentPlayer,
    validateAndThrowDart,
    undoLastDart,
    undoLastTurn,
    endTurnEarly,
    getCurrentTurnScore,
    getPotentialScore,
  } = useLiveGameContext();

  const [showBust, setShowBust] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (showBust) {
      const timer = setTimeout(() => setShowBust(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [showBust]);

  if (!gameState) return null;

  if (gameState.isGameOver) {
    return (
      <GameResults
        playerStates={gameState.playerStates}
        onNewGame={() => {
          resetGame();
        }}
        onReset={onReset}
      />
    );
  }

  const currentPlayer = getCurrentPlayer();
  const currentPlayerId = gameState.playerOrder[gameState.currentPlayerIndex];
  const turnScore = getCurrentTurnScore();
  const potentialScore = getPotentialScore();

  const handleDartThrow = (dart: DartThrow) => {
    const result = validateAndThrowDart(dart);
    if (result.isBust) {
      setShowBust(true);
    }
  };

  const getRuleLabels = () => {
    const labels = [];
    labels.push(gameState.gameType);
    labels.push(gameState.startRule === 'double-in' ? 'Double In' : 'Straight In');
    labels.push(gameState.endRule === 'double-out' ? 'Double Out' : 'Straight Out');
    return labels;
  };

  const needsDoubleIn = gameState.startRule === 'double-in' && currentPlayer && !currentPlayer.hasDoubledIn;

  return (
    <div className="space-y-4">
      {/* Game Info Bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {getRuleLabels().map((label, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive">
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Game?</AlertDialogTitle>
              <AlertDialogDescription>
                This will end the current game and return to setup. Progress will be lost.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onReset}>Reset Game</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Score Board */}
      <ScoreBoard
        playerStates={gameState.playerStates}
        playerOrder={gameState.playerOrder}
        currentPlayerId={currentPlayerId}
        finishedPlayerIds={gameState.finishedPlayerIds}
      />

      {/* Current Player Display */}
      <Card className={cn(
        "transition-all",
        showBust && "animate-pulse bg-destructive/10 border-destructive"
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span className="text-lg">
              {currentPlayer?.playerName}'s Turn
            </span>
            <span className={cn(
              "text-4xl sm:text-5xl font-bold tabular-nums transition-colors",
              showBust && "text-destructive"
            )}>
              {showBust ? 'BUST!' : potentialScore}
            </span>
          </CardTitle>
          {needsDoubleIn && (
            <div className="flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Hit a double to start scoring
            </div>
          )}
        </CardHeader>
        <CardContent>
          <CurrentTurn
            darts={gameState.currentTurnDarts}
            turnScore={turnScore}
            isBust={showBust}
          />
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={undoLastDart}
          disabled={gameState.currentTurnDarts.length === 0}
          className="flex-1"
        >
          <Undo2 className="h-4 w-4 mr-1" />
          Undo Dart
        </Button>
        <Button
          variant="outline"
          onClick={undoLastTurn}
          className="flex-1"
        >
          <Undo2 className="h-4 w-4 mr-1" />
          Undo Turn
        </Button>
        <Button
          variant="outline"
          onClick={endTurnEarly}
          disabled={gameState.currentTurnDarts.length === 0}
          className="flex-1"
        >
          <FastForward className="h-4 w-4 mr-1" />
          End Turn
        </Button>
      </div>

      {/* Dart Input */}
      <DartInput
        onDartThrow={handleDartThrow}
        disabled={gameState.currentTurnDarts.length >= 3}
        dartsThrown={gameState.currentTurnDarts.length}
      />

      {/* Turn History (Collapsible) */}
      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Turn History
            </span>
            <span className="text-muted-foreground text-sm">
              {historyOpen ? 'Hide' : 'Show'}
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Card className="mt-2">
            <CardContent className="pt-4">
              <TurnHistory
                playerStates={gameState.playerStates}
                playerOrder={gameState.playerOrder}
              />
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
