import { Button } from '@/components/ui/button';
import { DartThrow } from '@/types/liveGame';
import { cn } from '@/lib/utils';

interface DartInputProps {
  onDartThrow: (dart: DartThrow) => void;
  disabled?: boolean;
  dartsThrown: number;
}

const createDart = (
  segment: number,
  multiplier: 1 | 2 | 3,
  label: string
): DartThrow => ({
  segment,
  multiplier,
  score: segment * multiplier,
  label,
});

export function DartInput({ onDartThrow, disabled, dartsThrown }: DartInputProps) {
  const handleSingle = (num: number) => {
    onDartThrow(createDart(num, 1, `${num}`));
  };

  const handleDouble = (num: number) => {
    onDartThrow(createDart(num, 2, `D${num}`));
  };

  const handleTriple = (num: number) => {
    onDartThrow(createDart(num, 3, `T${num}`));
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

  const numbers = Array.from({ length: 20 }, (_, i) => i + 1);
  
  // Arrange in dartboard-like order (20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5)
  const dartboardOrder = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

  const buttonBase = "h-12 sm:h-14 text-base sm:text-lg font-bold transition-all active:scale-95";
  const singleStyle = "bg-secondary hover:bg-secondary/80 text-secondary-foreground";
  const doubleStyle = "bg-primary hover:bg-primary/80 text-primary-foreground";
  const tripleStyle = "bg-destructive hover:bg-destructive/80 text-destructive-foreground";
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

      {/* Miss button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          onClick={handleMiss}
          disabled={disabled}
          className={cn(buttonBase, "w-full max-w-[200px]")}
        >
          MISS (0)
        </Button>
      </div>

      {/* Bulls */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleOuterBull}
          disabled={disabled}
          className={cn(buttonBase, bullStyle)}
        >
          OUTER 25
        </Button>
        <Button
          onClick={handleInnerBull}
          disabled={disabled}
          className={cn(buttonBase, bullStyle, "border-destructive")}
        >
          BULL 50
        </Button>
      </div>

      {/* Singles */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground text-center">Singles</h4>
        <div className="grid grid-cols-5 gap-1.5">
          {dartboardOrder.map((num) => (
            <Button
              key={`s${num}`}
              onClick={() => handleSingle(num)}
              disabled={disabled}
              className={cn(buttonBase, singleStyle, "h-10 sm:h-12 text-sm sm:text-base")}
            >
              {num}
            </Button>
          ))}
        </div>
      </div>

      {/* Doubles */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground text-center">Doubles</h4>
        <div className="grid grid-cols-5 gap-1.5">
          {dartboardOrder.map((num) => (
            <Button
              key={`d${num}`}
              onClick={() => handleDouble(num)}
              disabled={disabled}
              className={cn(buttonBase, doubleStyle, "h-10 sm:h-12 text-sm sm:text-base")}
            >
              D{num}
            </Button>
          ))}
        </div>
      </div>

      {/* Triples */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground text-center">Triples</h4>
        <div className="grid grid-cols-5 gap-1.5">
          {dartboardOrder.map((num) => (
            <Button
              key={`t${num}`}
              onClick={() => handleTriple(num)}
              disabled={disabled}
              className={cn(buttonBase, tripleStyle, "h-10 sm:h-12 text-sm sm:text-base")}
            >
              T{num}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
