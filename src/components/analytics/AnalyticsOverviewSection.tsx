import { buildScoreDistribution, buildTopMoverBars } from '@/lib/analytics/chartViewModels';
import { LeagueAnalyticsSummary, PairwiseRecord, PlayerMatchStats, ThrowAnalyticsSummary } from '@/lib/analytics/types';
import { MetricCard } from './shared/MetricCard';
import { SimpleLeaderboard } from './shared/SimpleLeaderboard';
import { ChartCard } from './shared/ChartCard';
import { DistributionBars } from './shared/DistributionBars';
import { StoryStatCard } from './shared/StoryStatCard';
import { VisualLeaderboard } from './shared/VisualLeaderboard';

interface AnalyticsOverviewSectionProps {
  league: LeagueAnalyticsSummary;
  players: PlayerMatchStats[];
  darts: ThrowAnalyticsSummary;
  rivalryLeaders: PairwiseRecord[];
}

export function AnalyticsOverviewSection({ league, players, darts, rivalryLeaders }: AnalyticsOverviewSectionProps) {
  const movers = players.slice(0, 10).map((player) => ({
    label: player.playerName,
    value: player.totalEloChange > 0 ? `+${player.totalEloChange}` : player.totalEloChange,
    detail: `${player.matches} matches, avg rank ${player.averageFinishRank}`,
  }));
  const topRivalry = rivalryLeaders[0];
  const hasScoreDistribution = darts.scoreDistribution.some((item) => item.count > 0);

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard label="Active players" value={league.activePlayers} />
        <MetricCard label="Matches" value={league.matchesPlayed} />
        <MetricCard label="Darts tracked" value={league.throwsTracked.toLocaleString()} />
        <MetricCard label="Avg turn" value={league.averageTurnScore} tone="good" />
        <MetricCard label="Avg dart" value={league.averagePointsPerDart} tone="good" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard label="Most improved" value={league.mostImproved?.playerName ?? '-'} detail={league.mostImproved ? `${league.mostImproved.totalEloChange} Elo` : 'No matches in scope'} tone="good" />
        <MetricCard label="Hottest form" value={league.hottestPlayer?.playerName ?? '-'} detail={league.hottestPlayer ? league.hottestPlayer.recentForm.join(' · ') : 'No form data'} tone="warning" />
        <MetricCard label="Biggest Elo gain" value={league.biggestEloGain?.playerName ?? '-'} detail={league.biggestEloGain ? `+${league.biggestEloGain.value}` : 'No Elo movement'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <VisualLeaderboard title="League momentum" description="Biggest Elo swings in scope" items={buildTopMoverBars(players)} emptyLabel="No player movement yet" />
        <ChartCard title="Score distribution" description="Turn-score buckets from tracked darts" isEmpty={!hasScoreDistribution} emptyLabel="No dart score buckets">
          <DistributionBars items={buildScoreDistribution(darts.scoreDistribution)} emptyLabel="No dart score buckets" />
        </ChartCard>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <StoryStatCard title="Hottest form" value={league.hottestPlayer?.playerName ?? '-'} detail={league.hottestPlayer ? league.hottestPlayer.recentForm.join(' · ') : 'No form data'} tone="warning" />
          <StoryStatCard title="Most improved" value={league.mostImproved?.playerName ?? '-'} detail={league.mostImproved ? `${league.mostImproved.totalEloChange} Elo` : 'No matches in scope'} tone="good" />
          <StoryStatCard title="Biggest Elo gain" value={league.biggestEloGain?.playerName ?? '-'} detail={league.biggestEloGain ? `+${league.biggestEloGain.value}` : 'No Elo movement'} tone="good" />
          <StoryStatCard title="Top rivalry" value={topRivalry ? `${topRivalry.wins}-${topRivalry.losses}` : 'No rivalry data'} detail={topRivalry ? `${topRivalry.playerName} vs ${topRivalry.opponentName}` : undefined} tone="fun" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SimpleLeaderboard title="Top movers" description="Total Elo change in selected period" items={movers} />
        <SimpleLeaderboard title="Most common darts" description="Exact individual dart labels" items={darts.exactDarts.slice(0, 10).map((item) => ({ label: item.label, value: item.count }))} />
        <SimpleLeaderboard title="Common turn patterns" description="Three-dart combinations" items={darts.turnPatterns.slice(0, 10).map((item) => ({ label: item.label, value: item.count }))} />
      </div>
    </section>
  );
}
