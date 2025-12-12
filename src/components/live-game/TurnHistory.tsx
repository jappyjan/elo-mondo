import { PlayerGameState } from '@/types/liveGame';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TurnHistoryProps {
  playerStates: Record<string, PlayerGameState>;
  playerOrder: string[];
}

export function TurnHistory({ playerStates, playerOrder }: TurnHistoryProps) {
  // Collect all turns with player info
  const allTurns: Array<{
    playerName: string;
    turnIndex: number;
    darts: string[];
    scoreAtStart: number;
    scoreAtEnd: number;
    isBust: boolean;
  }> = [];

  playerOrder.forEach((playerId) => {
    const playerState = playerStates[playerId];
    playerState.turnHistory.forEach((turn, index) => {
      allTurns.push({
        playerName: playerState.playerName,
        turnIndex: index,
        darts: turn.darts.map((d) => d.label),
        scoreAtStart: turn.scoreAtStart,
        scoreAtEnd: turn.scoreAtEnd,
        isBust: turn.isBust,
      });
    });
  });

  // Sort by most recent first (approximate by turn index sum)
  const recentTurns = allTurns.slice(-10).reverse();

  if (recentTurns.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        No turns recorded yet
      </div>
    );
  }

  return (
    <ScrollArea className="h-40">
      <div className="space-y-1">
        {recentTurns.map((turn, idx) => (
          <div
            key={idx}
            className={cn(
              "flex items-center justify-between px-2 py-1 rounded text-sm",
              turn.isBust && "bg-destructive/10 text-destructive"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="font-medium w-20 truncate">{turn.playerName}</span>
              <span className="text-muted-foreground">
                {turn.darts.join(' • ')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {turn.isBust ? (
                <span className="text-destructive font-medium">BUST</span>
              ) : (
                <>
                  <span className="text-muted-foreground">{turn.scoreAtStart}</span>
                  <span>→</span>
                  <span className="font-medium">{turn.scoreAtEnd}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
