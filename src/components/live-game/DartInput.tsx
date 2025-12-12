import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DartThrow } from '@/types/liveGame';
import { cn } from '@/lib/utils';

interface DartInputProps {
  onDartThrow: (dart: DartThrow) => void;
  disabled?: boolean;
  dartsThrown: number;
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

export function DartInput({ onDartThrow, disabled, dartsThrown }: DartInputProps) {
  const [multiplier, setMultiplier] = useState<Multiplier>(1);

  const getLabel = (num: number, mult: Multiplier): string => {
    if (mult === 1) return `${num}`;
    if (mult === 2) return `D${num}`;
    return `T${num}`;
  };

  const handleNumberClick = (num: number) => {
    onDartThrow(createDart(num, multiplier, getLabel(num, multiplier)));
  };

  const handleOuterBull = () => {
    onDartThrow(createDart(25, 1, '25'));
  };

  const handleInnerBull = () => {
    onDartThrow(createDart(25, 2, 'BULL'));
  };

  const handleMiss = () => {
    onDartThrow(createDart(0, 1, 'MISS'));
  };

  // Dartboard order
  const dartboardOrder = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

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
        {dartboardOrder.map((num) => (
          <Button
            key={num}
            onClick={() => handleNumberClick(num)}
            disabled={disabled}
            className={cn(buttonBase, getNumberButtonStyle())}
          >
            {multiplier === 1 ? num : multiplier === 2 ? `D${num}` : `T${num}`}
          </Button>
        ))}
      </div>

      {/* Bulls and Miss */}
      <div className="grid grid-cols-3 gap-2">
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
      </div>
    </div>
  );
}
