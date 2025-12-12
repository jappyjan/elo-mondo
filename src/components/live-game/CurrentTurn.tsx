import { DartThrow } from '@/types/liveGame';
import { cn } from '@/lib/utils';

interface CurrentTurnProps {
  darts: DartThrow[];
  turnScore: number;
  isBust?: boolean;
}

export function CurrentTurn({ darts, turnScore, isBust }: CurrentTurnProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "w-14 h-14 sm:w-16 sm:h-16 rounded-lg flex items-center justify-center text-lg sm:text-xl font-bold transition-all",
              darts[i]
                ? "bg-primary text-primary-foreground"
                : "bg-card border-2 border-dashed border-muted-foreground/30",
              isBust && darts[i] && "bg-destructive text-destructive-foreground"
            )}
          >
            {darts[i]?.label || '-'}
          </div>
        ))}
      </div>
      
      <div className={cn(
        "text-right",
        isBust && "text-destructive"
      )}>
        <div className="text-sm text-muted-foreground">Turn</div>
        <div className="text-2xl sm:text-3xl font-bold">
          {isBust ? 'BUST' : turnScore}
        </div>
      </div>
    </div>
  );
}
