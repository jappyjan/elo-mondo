import { Card, CardContent } from '@/components/ui/card';

interface MetricCardProps {
  label: string;
  value: string | number;
  detail?: string;
  tone?: 'default' | 'good' | 'warning' | 'fun';
}

const toneClass = {
  default: 'text-foreground',
  good: 'text-green-600',
  warning: 'text-amber-600',
  fun: 'text-purple-600',
};

export function MetricCard({ label, value, detail, tone = 'default' }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-2 text-2xl font-bold ${toneClass[tone]}`}>{value}</p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}
