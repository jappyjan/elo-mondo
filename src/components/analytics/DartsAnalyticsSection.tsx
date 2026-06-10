import { Badge } from '@/components/ui/badge';
import { buildScoreDistribution, buildSegmentPopularity } from '@/lib/analytics/chartViewModels';
import { ThrowAnalyticsSummary } from '@/lib/analytics/types';
import { MetricCard } from './shared/MetricCard';
import { AnalyticsEmptyState } from './shared/AnalyticsEmptyState';
import { ChartCard } from './shared/ChartCard';
import { DistributionBars } from './shared/DistributionBars';
import { SimpleLeaderboard } from './shared/SimpleLeaderboard';
import { VisualLeaderboard } from './shared/VisualLeaderboard';

interface DartsAnalyticsSectionProps {
  darts: ThrowAnalyticsSummary;
}

export function DartsAnalyticsSection({ darts }: DartsAnalyticsSectionProps) {
  if (darts.totalDarts === 0) {
    return <AnalyticsEmptyState title="No dart-level data" description="Complete live games with dart tracking to unlock throw analytics." />;
  }

  const throwTypeSplit = [
    { label: 'Singles', value: darts.playerStats.reduce((total, player) => total + player.singles, 0) },
    { label: 'Doubles', value: darts.playerStats.reduce((total, player) => total + player.doubles, 0) },
    { label: 'Triples', value: darts.playerStats.reduce((total, player) => total + player.triples, 0) },
    { label: 'Bulls', value: darts.playerStats.reduce((total, player) => total + player.bulls, 0) },
    { label: 'Misses', value: darts.playerStats.reduce((total, player) => total + player.missCount, 0) },
  ];
  const hasScoreDistribution = darts.scoreDistribution.some((item) => item.count > 0);

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Total darts" value={darts.totalDarts.toLocaleString()} />
        <MetricCard label="Total turns" value={darts.totalTurns.toLocaleString()} />
        <MetricCard label="Avg turn" value={darts.averageTurnScore} />
        <MetricCard label="Avg dart" value={darts.averagePointsPerDart} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Score distribution" description="Turn-score buckets from tracked darts" isEmpty={!hasScoreDistribution} emptyLabel="No dart score buckets">
          <DistributionBars items={buildScoreDistribution(darts.scoreDistribution)} emptyLabel="No dart score buckets" />
        </ChartCard>
        <ChartCard title="Throw type split" description="Aggregate dart result mix" isEmpty={darts.playerStats.length === 0} emptyLabel="No throw type data yet">
          <DistributionBars items={throwTypeSplit} />
        </ChartCard>
        <VisualLeaderboard title="Segment popularity" description="Most targeted board segments" items={buildSegmentPopularity(darts.segments)} emptyLabel="No segment data yet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SimpleLeaderboard title="Most common numbers" items={darts.segments.map((item) => ({ label: item.label, value: item.count }))} />
        <SimpleLeaderboard title="Most common exact darts" items={darts.exactDarts.map((item) => ({ label: item.label, value: item.count }))} />
        <SimpleLeaderboard title="Most common turns" items={darts.turnPatterns.map((item) => ({ label: item.label, value: item.count }))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SimpleLeaderboard title="Best turn averages" items={darts.playerStats.slice().sort((a, b) => b.averageTurnScore - a.averageTurnScore).map((player) => ({ label: player.playerName, value: player.averageTurnScore, detail: `${player.totalTurns} turns` }))} />
        <SimpleLeaderboard title="Most 180s" items={darts.playerStats.slice().sort((a, b) => b.count180 - a.count180).map((player) => ({ label: player.playerName, value: player.count180 }))} />
        <SimpleLeaderboard title="Most T20s" items={darts.playerStats.slice().sort((a, b) => b.t20Count - a.t20Count).map((player) => ({ label: player.playerName, value: player.t20Count }))} />
      </div>

      <div className="rounded-lg border p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Fun awards</Badge>
          <span className="text-sm text-muted-foreground">Joke awards from individual darts and turn patterns</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <SimpleLeaderboard title="Most 1s" items={darts.funRecords.mostOnes.map((item) => ({ label: item.label, value: item.count }))} />
          <SimpleLeaderboard title="Most misses" items={darts.funRecords.mostMisses.map((item) => ({ label: item.label, value: item.count }))} />
          <SimpleLeaderboard title="Most 5 + 20 + 1" items={darts.funRecords.mostFiveTwentyOne.map((item) => ({ label: item.label, value: item.count }))} />
          <SimpleLeaderboard title="Most 26 club" items={darts.funRecords.mostTwentySixClub.map((item) => ({ label: item.label, value: item.count }))} />
          <SimpleLeaderboard title="Almost 180s" items={darts.funRecords.mostAlmost180.map((item) => ({ label: item.label, value: item.count }))} />
          <SimpleLeaderboard title="Treble hunters" items={darts.funRecords.highestTripleRate.map((item) => ({ label: item.label, value: `${Math.round(item.rate * 100)}%`, detail: `${item.count} triples` }))} />
        </div>
      </div>
    </section>
  );
}
