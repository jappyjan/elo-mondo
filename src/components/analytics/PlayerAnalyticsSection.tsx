import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { PlayerMatchStats, ThrowAnalyticsSummary } from '@/lib/analytics/types';
import { MetricCard } from './shared/MetricCard';
import { AnalyticsEmptyState } from './shared/AnalyticsEmptyState';
import { SimpleLeaderboard } from './shared/SimpleLeaderboard';

interface PlayerAnalyticsSectionProps {
  players: PlayerMatchStats[];
  darts: ThrowAnalyticsSummary;
}

export function PlayerAnalyticsSection({ players, darts }: PlayerAnalyticsSectionProps) {
  const [query, setQuery] = useState('');
  const filteredPlayers = useMemo(
    () => players.filter((player) => player.playerName.toLowerCase().includes(query.toLowerCase())),
    [players, query]
  );
  const selected = filteredPlayers[0] ?? players[0] ?? null;
  const dartStats = selected ? darts.playerStats.find((player) => player.key === selected.key) : null;

  if (!selected) {
    return <AnalyticsEmptyState title="No player analytics" description="Record matches in this period to see individual player stats." />;
  }

  return (
    <section className="space-y-6">
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player" className="max-w-sm" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard label="Player" value={selected.playerName} detail={`${selected.matches} matches`} />
        <MetricCard label="Win rate" value={`${Math.round(selected.winRate * 100)}%`} />
        <MetricCard label="Avg finish" value={selected.averageFinishRank} />
        <MetricCard label="Elo change" value={selected.totalEloChange > 0 ? `+${selected.totalEloChange}` : selected.totalEloChange} tone={selected.totalEloChange >= 0 ? 'good' : 'warning'} />
        <MetricCard label="Recent form" value={selected.recentForm.join(' · ') || '-'} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard label="Avg turn" value={dartStats?.averageTurnScore ?? '-'} />
        <MetricCard label="Avg dart" value={dartStats?.averagePointsPerDart ?? '-'} />
        <MetricCard label="180s" value={dartStats?.count180 ?? 0} />
        <MetricCard label="Most common dart" value={dartStats?.mostCommonDart ?? '-'} />
        <MetricCard label="Miss rate" value={dartStats ? `${Math.round(dartStats.missRate * 100)}%` : '-'} tone="fun" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SimpleLeaderboard title="Placement distribution" items={selected.placements.map((placement) => ({ label: `Rank ${placement.rank}`, value: placement.count }))} />
        <SimpleLeaderboard title="Player dart profile" items={dartStats ? [
          { label: 'T20s', value: dartStats.t20Count },
          { label: 'Doubles', value: dartStats.doubles },
          { label: 'Triples', value: dartStats.triples },
          { label: 'Bulls', value: dartStats.bulls },
          { label: 'Misses', value: dartStats.missCount },
        ] : []} />
      </div>
    </section>
  );
}
