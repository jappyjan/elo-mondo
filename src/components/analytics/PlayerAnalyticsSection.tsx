import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { buildThrowTypeSplit } from '@/lib/analytics/chartViewModels';
import { PlayerMatchStats, ThrowAnalyticsSummary } from '@/lib/analytics/types';
import { MetricCard } from './shared/MetricCard';
import { AnalyticsEmptyState } from './shared/AnalyticsEmptyState';
import { SimpleLeaderboard } from './shared/SimpleLeaderboard';
import { ChartCard } from './shared/ChartCard';
import { DistributionBars } from './shared/DistributionBars';
import { StoryStatCard } from './shared/StoryStatCard';

interface PlayerAnalyticsSectionProps {
  players: PlayerMatchStats[];
  darts: ThrowAnalyticsSummary;
  selectedPlayerKey?: string | null;
  onSelectedPlayerKeyChange?: (playerKey: string) => void;
}

export function PlayerAnalyticsSection({ players, darts, selectedPlayerKey, onSelectedPlayerKeyChange }: PlayerAnalyticsSectionProps) {
  const [query, setQuery] = useState('');
  const filteredPlayers = useMemo(
    () => players.filter((player) => player.playerName.toLowerCase().includes(query.toLowerCase())),
    [players, query]
  );
  const hasSearchQuery = query.trim().length > 0;
  const selected = filteredPlayers.find((player) => player.key === selectedPlayerKey) ?? filteredPlayers[0] ?? (hasSearchQuery ? null : players[0] ?? null);
  const dartStats = selected ? darts.playerStats.find((player) => player.key === selected.key) : null;

  useEffect(() => {
    if (selected && selected.key !== selectedPlayerKey) {
      onSelectedPlayerKeyChange?.(selected.key);
    }
  }, [onSelectedPlayerKeyChange, selected, selectedPlayerKey]);

  if (!selected && hasSearchQuery) {
    return (
      <section className="space-y-6">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player" className="max-w-sm" />
        <AnalyticsEmptyState title="No matching players" description="Try a different player search." />
      </section>
    );
  }

  if (!selected) {
    return <AnalyticsEmptyState title="No player analytics" description="Record matches in this period to see individual player stats." />;
  }

  return (
    <section className="space-y-6">
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player" className="max-w-sm" />

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Player profile" description="Selected player performance snapshot">
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-bold">{selected.playerName}</p>
              <p className="text-sm text-muted-foreground">{selected.matches} matches</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StoryStatCard title="Win rate" value={`${Math.round(selected.winRate * 100)}%`} />
              <StoryStatCard title="Elo change" value={selected.totalEloChange > 0 ? `+${selected.totalEloChange}` : selected.totalEloChange} tone={selected.totalEloChange >= 0 ? 'good' : 'warning'} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent form</p>
              <div className="flex flex-wrap gap-2">
                {selected.recentForm.length > 0 ? selected.recentForm.map((finish, index) => (
                  <span key={`${finish}-${index}`} className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs font-medium">{finish}</span>
                )) : <span className="text-sm text-muted-foreground">No recent form</span>}
              </div>
            </div>
          </div>
        </ChartCard>
        <ChartCard title="Placement distribution" description="Finishing positions in scope">
          <DistributionBars items={selected.placements.map(({ rank, count }) => ({ label: `Rank ${rank}`, value: count }))} />
        </ChartCard>
        <ChartCard title="Throw type split" description="Dart result mix for this player">
          <DistributionBars items={buildThrowTypeSplit(dartStats)} />
        </ChartCard>
      </div>

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
