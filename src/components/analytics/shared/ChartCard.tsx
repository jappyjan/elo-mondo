import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartCardProps {
  title: string;
  description?: string;
  isEmpty?: boolean;
  emptyLabel?: string;
  children?: ReactNode;
}

export function ChartCard({ title, description, isEmpty = false, emptyLabel = 'No data yet', children }: ChartCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {isEmpty ? <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p> : children}
      </CardContent>
    </Card>
  );
}
