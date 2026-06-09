import { LeagueAnalyticsSummary, PlayerMatchStats, ThrowAnalyticsSummary } from '@/lib/analytics/types';
import { MetricCard } from './shared/MetricCard';
import { SimpleLeaderboard } from './shared/SimpleLeaderboard';

interface AnalyticsOverviewSectionProps {
  league: LeagueAnalyticsSummary;
  players: PlayerMatchStats[];
  darts: ThrowAnalyticsSummary;
}

export function AnalyticsOverviewSection({ league, players, darts }: AnalyticsOverviewSectionProps) {
  const movers = players.slice(0, 10).map((player) => ({
    label: player.playerName,
    value: player.totalEloChange > 0 ? `+${player.totalEloChange}` : player.totalEloChange,
    detail: `${player.matches} matches, avg rank ${player.averageFinishRank}`,
  }));

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

      <div className="grid gap-4 lg:grid-cols-3">
        <SimpleLeaderboard title="Top movers" description="Total Elo change in selected period" items={movers} />
        <SimpleLeaderboard title="Most common darts" description="Exact individual dart labels" items={darts.exactDarts.slice(0, 10).map((item) => ({ label: item.label, value: item.count }))} />
        <SimpleLeaderboard title="Common turn patterns" description="Three-dart combinations" items={darts.turnPatterns.slice(0, 10).map((item) => ({ label: item.label, value: item.count }))} />
      </div>
    </section>
  );
}
