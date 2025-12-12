import { PlayerGameState } from '@/types/liveGame';
import { cn } from '@/lib/utils';
import { Trophy, Target } from 'lucide-react';

interface ScoreBoardProps {
  playerStates: Record<string, PlayerGameState>;
  playerOrder: string[];
  currentPlayerId: string;
  finishedPlayerIds: string[];
  requireDoubleIn: boolean;
}

export function ScoreBoard({
  playerStates,
  playerOrder,
  currentPlayerId,
  finishedPlayerIds,
  requireDoubleIn,
}: ScoreBoardProps) {
  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {playerOrder.map((playerId) => {
        const playerState = playerStates[playerId];
        const isCurrentPlayer = playerId === currentPlayerId;
        const isFinished = finishedPlayerIds.includes(playerId);

        return (
          <div
            key={playerId}
            className={cn(
              "p-3 rounded-lg border transition-all",
              isCurrentPlayer && !isFinished && "ring-2 ring-primary border-primary bg-primary/5",
              isFinished && "opacity-60 bg-muted/50",
              !isCurrentPlayer && !isFinished && "bg-card"
            )}
          >
            <div className="flex items-center gap-1 mb-1">
              {isFinished ? (
                <span className="text-sm">{getRankEmoji(playerState.finishedRank!)}</span>
              ) : isCurrentPlayer ? (
                <Target className="h-4 w-4 text-primary" />
              ) : null}
              <span className={cn(
                "text-sm font-medium truncate",
                isCurrentPlayer && "text-primary"
              )}>
                {playerState.playerName}
              </span>
            </div>
            <div className={cn(
              "text-2xl sm:text-3xl font-bold tabular-nums",
              isFinished && "text-muted-foreground",
              isCurrentPlayer && !isFinished && "text-primary"
            )}>
              {playerState.currentScore}
            </div>
            {requireDoubleIn && !playerState.hasDoubledIn && !isFinished && (
              <div className="text-xs text-muted-foreground">Need Double</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
