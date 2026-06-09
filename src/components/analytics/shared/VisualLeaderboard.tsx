import { ChartCard } from './ChartCard';

export interface VisualLeaderboardItem {
  label: string;
  value: number;
  displayValue?: string;
  detail?: string;
  tone?: 'default' | 'good' | 'warning';
}

interface VisualLeaderboardProps {
  title: string;
  description?: string;
  items: VisualLeaderboardItem[];
  emptyLabel?: string;
}

const barToneClass = {
  default: 'bg-foreground/60',
  good: 'bg-green-600',
  warning: 'bg-amber-600',
};

function toSafeValue(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function VisualLeaderboard({ title, description, items, emptyLabel }: VisualLeaderboardProps) {
  const safeValues = items.map((item) => toSafeValue(item.value));
  const maxValue = Math.max(0, ...safeValues);

  return ChartCard({
    title,
    description,
    isEmpty: items.length === 0,
    emptyLabel,
    children: (
      <div className="space-y-3">
        {items.map((item, index) => {
          const width = maxValue === 0 ? 0 : Math.min(100, Math.max(0, (safeValues[index] / maxValue) * 100));

          return (
            <div key={`${item.label}-${index}`} className="space-y-1.5">
              <div className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.label}</p>
                  {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
                </div>
                <span className="shrink-0 font-bold">{item.displayValue ?? item.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${barToneClass[item.tone ?? 'default']}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    ),
  });
}
