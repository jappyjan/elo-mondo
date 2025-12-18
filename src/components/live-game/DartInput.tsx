import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DartThrow } from '@/types/liveGame';
import { cn } from '@/lib/utils';
import { Undo2 } from 'lucide-react';

interface DartInputProps {
  onDartThrow: (dart: DartThrow) => void;
  disabled?: boolean;
  dartsThrown: number;
  onUndo?: () => void;
  canUndo?: boolean;
}

type Multiplier = 1 | 2 | 3;

const createDart = (
  segment: number,
  multiplier: Multiplier,
  label: string
): DartThrow => ({
  segment,
  multiplier,
  score: segment * multiplier,
  label,
});

export function DartInput({ onDartThrow, disabled, dartsThrown, onUndo, canUndo }: DartInputProps) {
  const [multiplier, setMultiplier] = useState<Multiplier>(1);

  const getLabel = (num: number, mult: Multiplier): string => {
    if (mult === 1) return `${num}`;
    if (mult === 2) return `D${num}`;
    return `T${num}`;
  };

  const handleNumberClick = (num: number) => {
    onDartThrow(createDart(num, multiplier, getLabel(num, multiplier)));
    setMultiplier(1);
  };

  const handleOuterBull = () => {
    onDartThrow(createDart(25, 1, '25'));
    setMultiplier(1);
  };

  const handleInnerBull = () => {
    onDartThrow(createDart(25, 2, 'BULL'));
    setMultiplier(1);
  };

  const handleMiss = () => {
    onDartThrow(createDart(0, 1, 'MISS'));
    setMultiplier(1);
  };

  // Sequential number order
  const numberOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

  const buttonBase = "h-12 sm:h-14 text-base sm:text-lg font-bold transition-all active:scale-95";
  
  const getNumberButtonStyle = () => {
    if (multiplier === 1) return "bg-secondary hover:bg-secondary/80 text-secondary-foreground";
    if (multiplier === 2) return "bg-primary hover:bg-primary/80 text-primary-foreground";
    return "bg-destructive hover:bg-destructive/80 text-destructive-foreground";
  };

  const bullStyle = "bg-accent hover:bg-accent/80 text-accent-foreground border-2 border-primary";

  return (
    <div className="space-y-4">
      {/* Darts thrown indicator */}
      <div className="flex justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "w-3 h-3 rounded-full transition-colors",
              i < dartsThrown ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Multiplier Selection */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant={multiplier === 1 ? "default" : "outline"}
          onClick={() => setMultiplier(1)}
          className={cn(
            "h-12 text-base font-bold",
            multiplier === 1 && "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          Single
        </Button>
        <Button
          variant={multiplier === 2 ? "default" : "outline"}
          onClick={() => setMultiplier(2)}
          className={cn(
            "h-12 text-base font-bold",
            multiplier === 2 && "bg-primary text-primary-foreground hover:bg-primary/80"
          )}
        >
          Double
        </Button>
        <Button
          variant={multiplier === 3 ? "default" : "outline"}
          onClick={() => setMultiplier(3)}
          className={cn(
            "h-12 text-base font-bold",
            multiplier === 3 && "bg-destructive text-destructive-foreground hover:bg-destructive/80"
          )}
        >
          Triple
        </Button>
      </div>

      {/* Number Grid */}
      <div className="grid grid-cols-5 gap-1.5">
        {numberOrder.map((num) => (
          <Button
            key={num}
            onClick={() => handleNumberClick(num)}
            disabled={disabled}
            className={cn(buttonBase, getNumberButtonStyle())}
          >
            {num}
          </Button>
        ))}
      </div>

      {/* Bulls, Miss and Undo */}
      <div className="grid grid-cols-4 gap-2">
        <Button
          onClick={handleOuterBull}
          disabled={disabled}
          className={cn(buttonBase, bullStyle)}
        >
          25
        </Button>
        <Button
          onClick={handleInnerBull}
          disabled={disabled}
          className={cn(buttonBase, bullStyle, "border-destructive")}
        >
          BULL
        </Button>
        <Button
          variant="outline"
          onClick={handleMiss}
          disabled={disabled}
          className={cn(buttonBase)}
        >
          MISS
        </Button>
        <Button
          variant="destructive"
          onClick={onUndo}
          disabled={!canUndo}
          className={cn(buttonBase)}
        >
          <Undo2 className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
