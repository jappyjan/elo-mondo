import { Card, CardContent } from '@/components/ui/card';

interface StoryStatCardProps {
  title: string;
  value: string | number;
  detail?: string;
  badge?: string;
  tone?: 'default' | 'good' | 'warning' | 'fun';
}

const toneClass = {
  default: 'text-foreground',
  good: 'text-green-600',
  warning: 'text-amber-600',
  fun: 'text-purple-600',
};

export function StoryStatCard({ title, value, detail, badge, tone = 'default' }: StoryStatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          {badge && <span className="rounded-full border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">{badge}</span>}
        </div>
        <p className={`mt-3 text-2xl font-bold ${toneClass[tone]}`}>{value}</p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}
