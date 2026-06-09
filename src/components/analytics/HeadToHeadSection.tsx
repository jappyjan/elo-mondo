import { useEffect, useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PairwiseRecord, PlayerMatchStats } from '@/lib/analytics/types';
import { AnalyticsEmptyState } from './shared/AnalyticsEmptyState';
import { ChartCard } from './shared/ChartCard';
import { DistributionBars } from './shared/DistributionBars';
import { SimpleLeaderboard } from './shared/SimpleLeaderboard';
import { StoryStatCard } from './shared/StoryStatCard';

interface HeadToHeadSectionProps {
  players: PlayerMatchStats[];
  records: PairwiseRecord[];
  rivalryLeaders: PairwiseRecord[];
  dominanceLeaders: PairwiseRecord[];
  selectedPlayerKey?: string | null;
  selectedOpponentKey?: string | null;
  onSelectedPairChange?: (selection: { playerKey: string; opponentKey: string }) => void;
  onSelectedPlayerKeyChange?: (playerKey: string) => void;
  onSelectedOpponentKeyChange?: (opponentKey: string) => void;
}

export function HeadToHeadSection({
  players,
  records,
  rivalryLeaders,
  dominanceLeaders,
  selectedPlayerKey,
  selectedOpponentKey,
  onSelectedPairChange,
  onSelectedPlayerKeyChange,
  onSelectedOpponentKeyChange,
}: HeadToHeadSectionProps) {
  const defaultPlayerKey = records[0]?.key ?? players[0]?.key ?? '';
  const defaultOpponentKey = records[0]?.opponentKey ?? players.find((player) => player.key !== defaultPlayerKey)?.key ?? '';
  const [localPlayerKey, setLocalPlayerKey] = useState(defaultPlayerKey);
  const [localOpponentKey, setLocalOpponentKey] = useState(defaultOpponentKey);

  const hasPlayer = (key: string | null | undefined) => players.some((player) => player.key === key);
  const playerKey = hasPlayer(selectedPlayerKey) ? selectedPlayerKey! : hasPlayer(localPlayerKey) ? localPlayerKey : defaultPlayerKey;
  const fallbackOpponentKey = records.find((record) => record.key === playerKey)?.opponentKey ?? players.find((player) => player.key !== playerKey)?.key ?? '';
  const opponentKey = hasPlayer(selectedOpponentKey) && selectedOpponentKey !== playerKey
    ? selectedOpponentKey!
    : hasPlayer(localOpponentKey) && localOpponentKey !== playerKey
      ? localOpponentKey
      : fallbackOpponentKey;

  const setPlayerKey = (nextPlayerKey: string) => {
    const nextOpponentKey = opponentKey === nextPlayerKey ? players.find((player) => player.key !== nextPlayerKey)?.key ?? '' : opponentKey;

    if (onSelectedPairChange) {
      onSelectedPairChange({ playerKey: nextPlayerKey, opponentKey: nextOpponentKey });
      return;
    }

    if (onSelectedPlayerKeyChange) {
      onSelectedPlayerKeyChange(nextPlayerKey);
    } else {
      setLocalPlayerKey(nextPlayerKey);
    }

    if (nextOpponentKey !== opponentKey) {
      if (onSelectedOpponentKeyChange) {
        onSelectedOpponentKeyChange(nextOpponentKey);
      } else {
        setLocalOpponentKey(nextOpponentKey);
      }
    }
  };

  const setOpponentKey = (nextOpponentKey: string) => {
    if (onSelectedPairChange) {
      onSelectedPairChange({ playerKey, opponentKey: nextOpponentKey });
      return;
    }

    if (onSelectedOpponentKeyChange) {
      onSelectedOpponentKeyChange(nextOpponentKey);
    } else {
      setLocalOpponentKey(nextOpponentKey);
    }
  };

  const selectedRecord = useMemo(
    () => records.find((record) => record.key === playerKey && record.opponentKey === opponentKey),
    [records, playerKey, opponentKey]
  );
  const selectedPlayer = players.find((player) => player.key === playerKey);
  const selectedOpponent = players.find((player) => player.key === opponentKey);
  const recentMeetings = selectedRecord?.meetings
    .slice()
    .sort((left, right) => right.matchDate.localeCompare(left.matchDate))
    .slice(0, 5) ?? [];

  useEffect(() => {
    if (onSelectedPairChange && playerKey && opponentKey && (playerKey !== selectedPlayerKey || opponentKey !== selectedOpponentKey)) {
      onSelectedPairChange({ playerKey, opponentKey });
      return;
    }

    if (playerKey && playerKey !== selectedPlayerKey) {
      onSelectedPlayerKeyChange?.(playerKey);
    }

    if (opponentKey && opponentKey !== selectedOpponentKey) {
      onSelectedOpponentKeyChange?.(opponentKey);
    }
  }, [onSelectedOpponentKeyChange, onSelectedPairChange, onSelectedPlayerKeyChange, opponentKey, playerKey, selectedOpponentKey, selectedPlayerKey]);

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

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Rivalry snapshot" description="Selected pair performance in this period">
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-bold">{selectedPlayer?.playerName ?? 'Player'} vs {selectedOpponent?.playerName ?? 'Opponent'}</p>
              <p className="text-sm text-muted-foreground">{selectedRecord?.totalGames ?? 0} meetings</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StoryStatCard title="Record" value={selectedRecord ? `${selectedRecord.wins}-${selectedRecord.losses}` : '0-0'} />
              <StoryStatCard title="Win rate" value={selectedRecord ? `${Math.round(selectedRecord.winRate * 100)}%` : '-'} />
              <StoryStatCard title="Meetings" value={selectedRecord?.totalGames ?? 0} />
              <StoryStatCard title="Elo movement" value={selectedRecord ? (selectedRecord.eloChange > 0 ? `+${selectedRecord.eloChange}` : selectedRecord.eloChange) : 0} tone={(selectedRecord?.eloChange ?? 0) >= 0 ? 'good' : 'warning'} />
            </div>
          </div>
        </ChartCard>

        <ChartCard title="Win-rate split" description="Wins and losses for the selected player" isEmpty={!selectedRecord} emptyLabel="No head-to-head record">
          <DistributionBars items={[
            { label: `${selectedPlayer?.playerName ?? 'Player'} wins`, value: selectedRecord?.wins ?? 0 },
            { label: `${selectedOpponent?.playerName ?? 'Opponent'} wins`, value: selectedRecord?.losses ?? 0 },
          ]} />
        </ChartCard>

        <ChartCard title="Recent meetings" isEmpty={recentMeetings.length === 0} emptyLabel="No meetings in this period">
          <div className="space-y-2">
            {recentMeetings.map((meeting) => (
              <div key={meeting.matchId} className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
                <div>
                  <p className="font-medium">{meeting.matchDate}</p>
                  <p className="text-xs text-muted-foreground">Ranks {meeting.playerRank}-{meeting.opponentRank}</p>
                </div>
                <span className="font-bold">{meeting.eloChange > 0 ? `+${meeting.eloChange}` : meeting.eloChange}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SimpleLeaderboard title="Most-played rivalries" items={rivalryLeaders.map((record) => ({ label: `${record.playerName} vs ${record.opponentName}`, value: record.totalGames, detail: `${record.wins}-${record.losses}` }))} />
        <SimpleLeaderboard title="Dominance records" description="Minimum one meeting in this period" items={dominanceLeaders.map((record) => ({ label: `${record.playerName} over ${record.opponentName}`, value: `${Math.round(record.winRate * 100)}%`, detail: `${record.wins}-${record.losses}` }))} />
      </div>
    </section>
  );
}
