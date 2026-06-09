import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface LeaderboardItem {
  label: string;
  value: string | number;
  detail?: string;
}

interface SimpleLeaderboardProps {
  title: string;
  description?: string;
  items: LeaderboardItem[];
  emptyLabel?: string;
}

export function SimpleLeaderboard({ title, description, items, emptyLabel = 'No data yet' }: SimpleLeaderboardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 10).map((item, index) => (
              <div key={`${item.label}-${index}`} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-xs font-bold text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
                  </div>
                </div>
                <span className="text-sm font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
