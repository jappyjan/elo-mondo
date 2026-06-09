import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BarChart3, Loader2, Target, User, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { AnalyticsTimeScope, TimeScopeKind } from '@/lib/analytics/types';
import { scopeLabels } from '@/lib/analytics/scopeLabels';
import { AnalyticsOverviewSection } from '@/components/analytics/AnalyticsOverviewSection';
import { PlayerAnalyticsSection } from '@/components/analytics/PlayerAnalyticsSection';
import { HeadToHeadSection } from '@/components/analytics/HeadToHeadSection';
import { DartsAnalyticsSection } from '@/components/analytics/DartsAnalyticsSection';

const currentYear = new Date().getFullYear();

const Analytics = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const [scopeKind, setScopeKind] = useState<TimeScopeKind>('30d');
  const [year, setYear] = useState(currentYear);

  const timeScope: AnalyticsTimeScope = useMemo(() => ({ kind: scopeKind, year }), [scopeKind, year]);
  const { data, isLoading, isFetching, error } = useAnalyticsData(groupId, timeScope);

  useEffect(() => {
    if (data.availableYears.length > 0 && !data.availableYears.includes(year)) {
      setYear(data.availableYears.includes(currentYear) ? currentYear : data.availableYears[0]);
    }
  }, [data.availableYears, year]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive">
          Error loading analytics data: {(error as Error).message}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Recent form, rivalries, player profiles, and dart-level patterns.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Select value={scopeKind} onValueChange={(value) => setScopeKind(value as TimeScopeKind)}>
            <SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(scopeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
          {scopeKind === 'year' && (
            <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
              <SelectTrigger className="w-full sm:w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>{data.availableYears.map((availableYear) => <SelectItem key={availableYear} value={String(availableYear)}>{availableYear}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto">
          <TabsTrigger value="overview" className="gap-2"><BarChart3 className="hidden h-4 w-4 sm:inline" />Overview</TabsTrigger>
          <TabsTrigger value="players" className="gap-2"><User className="hidden h-4 w-4 sm:inline" />Players</TabsTrigger>
          <TabsTrigger value="h2h" className="gap-2"><Users className="hidden h-4 w-4 sm:inline" />Head-to-Head</TabsTrigger>
          <TabsTrigger value="darts" className="gap-2"><Target className="hidden h-4 w-4 sm:inline" />Darts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><AnalyticsOverviewSection league={data.league} players={data.playerMatchStats} darts={data.darts} /></TabsContent>
        <TabsContent value="players"><PlayerAnalyticsSection players={data.playerMatchStats} darts={data.darts} /></TabsContent>
        <TabsContent value="h2h"><HeadToHeadSection players={data.playerMatchStats} records={data.headToHead.records} rivalryLeaders={data.headToHead.rivalryLeaders} dominanceLeaders={data.headToHead.dominanceLeaders} /></TabsContent>
        <TabsContent value="darts"><DartsAnalyticsSection darts={data.darts} /></TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;
