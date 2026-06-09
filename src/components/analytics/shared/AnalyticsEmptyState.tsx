import { Card, CardContent } from '@/components/ui/card';

interface AnalyticsEmptyStateProps {
  title: string;
  description: string;
}

export function AnalyticsEmptyState({ title, description }: AnalyticsEmptyStateProps) {
  return (
    <Card>
      <CardContent className="py-10 text-center">
        <p className="text-lg font-semibold">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
