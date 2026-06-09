import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PairwiseRecord, PlayerMatchStats } from '@/lib/analytics/types';
import { MetricCard } from './shared/MetricCard';
import { AnalyticsEmptyState } from './shared/AnalyticsEmptyState';
import { SimpleLeaderboard } from './shared/SimpleLeaderboard';

interface HeadToHeadSectionProps {
  players: PlayerMatchStats[];
  records: PairwiseRecord[];
  rivalryLeaders: PairwiseRecord[];
  dominanceLeaders: PairwiseRecord[];
}

export function HeadToHeadSection({ players, records, rivalryLeaders, dominanceLeaders }: HeadToHeadSectionProps) {
  const defaultPlayerKey = records[0]?.key ?? players[0]?.key ?? '';
  const defaultOpponentKey = records[0]?.opponentKey ?? players.find((player) => player.key !== defaultPlayerKey)?.key ?? '';
  const [playerKey, setPlayerKey] = useState(defaultPlayerKey);
  const [opponentKey, setOpponentKey] = useState(defaultOpponentKey);

  const selectedRecord = useMemo(
    () => records.find((record) => record.key === playerKey && record.opponentKey === opponentKey),
    [records, playerKey, opponentKey]
  );

  if (players.length < 2) {
    return <AnalyticsEmptyState title="No head-to-head data" description="At least two players need matches in this period." />;
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <Select value={playerKey} onValueChange={setPlayerKey}>
          <SelectTrigger><SelectValue placeholder="Select player" /></SelectTrigger>
          <SelectContent>{players.map((player) => <SelectItem key={player.key} value={player.key}>{player.playerName}</SelectItem>)}</SelectContent>
        </Select>
        <span className="self-center text-center text-sm text-muted-foreground">vs</span>
        <Select value={opponentKey} onValueChange={setOpponentKey}>
          <SelectTrigger><SelectValue placeholder="Select opponent" /></SelectTrigger>
          <SelectContent>{players.filter((player) => player.key !== playerKey).map((player) => <SelectItem key={player.key} value={player.key}>{player.playerName}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Record" value={selectedRecord ? `${selectedRecord.wins}-${selectedRecord.losses}` : '0-0'} />
        <MetricCard label="Win rate" value={selectedRecord ? `${Math.round(selectedRecord.winRate * 100)}%` : '-'} />
        <MetricCard label="Meetings" value={selectedRecord?.totalGames ?? 0} />
        <MetricCard label="Elo in meetings" value={selectedRecord ? (selectedRecord.eloChange > 0 ? `+${selectedRecord.eloChange}` : selectedRecord.eloChange) : 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SimpleLeaderboard title="Most-played rivalries" items={rivalryLeaders.map((record) => ({ label: `${record.playerName} vs ${record.opponentName}`, value: record.totalGames, detail: `${record.wins}-${record.losses}` }))} />
        <SimpleLeaderboard title="Dominance records" description="Minimum one meeting in this period" items={dominanceLeaders.map((record) => ({ label: `${record.playerName} over ${record.opponentName}`, value: `${Math.round(record.winRate * 100)}%`, detail: `${record.wins}-${record.losses}` }))} />
      </div>
    </section>
  );
}
