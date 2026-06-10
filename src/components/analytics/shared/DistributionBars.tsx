interface DistributionBarItem {
  label: string;
  value: number;
}

interface DistributionBarsProps {
  items: DistributionBarItem[];
  emptyLabel?: string;
}

function toSafeValue(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function DistributionBars({ items, emptyLabel = 'No data yet' }: DistributionBarsProps) {
  const safeValues = items.map((item) => toSafeValue(item.value));
  const maxValue = Math.max(0, ...safeValues);

  if (items.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const width = maxValue === 0 ? 0 : Math.min(100, Math.max(0, (safeValues[index] / maxValue) * 100));

        return (
          <div key={`${item.label}-${index}`} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{item.label}</span>
              <span className="font-bold text-muted-foreground">{item.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-purple-600" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
