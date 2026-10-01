
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MatchHistoryEntry, CalculatedPlayer } from '@/types/darts';
import { buildEloProgressionSeries, EloRangeOption } from '@/lib/eloProgression';

type RangeOption = EloRangeOption;

type ChartConfig = Record<string, { label: string; color: string }>;
type TooltipEntry = {
  dataKey?: string | number;
  color?: string;
  value?: string | number;
};

function getPastelColor(index: number): string {
  const pastelColors = [
    "#AEC6CF", "#FFB347", "#B39EB5", "#77DD77", "#FF6961",
    "#FDFD96", "#CFCFC4", "#FFD1DC", "#CB99C9", "#F49AC2",
    "#B0E0E6", "#E6E6FA", "#D1E231", "#FFDAC1", "#C1E1C1",
    "#FFFACD", "#E0BBE4", "#D9F9A5", "#AFCBFF", "#FFE0AC"
  ];
  return pastelColors[index % pastelColors.length];
}

interface EloProgressionChartProps {
  matchHistory: MatchHistoryEntry[];
  players: CalculatedPlayer[];
  year?: number | null;
  decayEnabled?: boolean;
  decayHalfLifeDays?: number;
  decayStartDay?: number;
}

export function EloProgressionChart({
  matchHistory,
  players,
  year,
  decayEnabled = false,
  decayHalfLifeDays = 30,
  decayStartDay = 14,
}: EloProgressionChartProps) {
  const [range, setRange] = useState<RangeOption>('last15');

  const chartData = useMemo(
    () =>
      buildEloProgressionSeries({
        matchHistory,
        players,
        range,
        decay: decayEnabled ? { halfLifeDays: decayHalfLifeDays, startDay: decayStartDay } : null,
        now: new Date(),
      }),
    [matchHistory, players, range, decayEnabled, decayHalfLifeDays, decayStartDay],
  );

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    players.forEach((player, index) => {
      config[player.playerName] = {
        label: player.playerName,
        color: getPastelColor(index),
      };
    });
    return config;
  }, [players]);

  if (!matchHistory.length || !players.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Elo Progression
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No match data available to display Elo progression
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Elo Progression {year ? `(${year})` : 'Over Time'}
        </CardTitle>
        <Select value={range} onValueChange={(v) => setRange(v as RangeOption)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Matches</SelectItem>
            <SelectItem value="last15">Last 15</SelectItem>
            <SelectItem value="lastMonth">Last Month</SelectItem>
            <SelectItem value="last3Months">Last 3 Months</SelectItem>
            <SelectItem value="lastYear">Last Year</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-2 sm:p-6">
        <div className="w-full overflow-x-auto">
          <ChartContainer config={chartConfig} className="h-[300px] sm:h-[400px] w-full min-w-[300px]">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="match" label={{ value: 'Match Number', position: 'insideBottom', offset: -5 }} fontSize={12} />
              <YAxis domain={['auto', 'auto']} label={{ value: 'Elo Rating', angle: -90, position: 'insideLeft' }} fontSize={12} />
              <ChartTooltip 
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const matchNum = payload[0]?.payload?.match;
                  const isNow = payload[0]?.payload?.isNow;
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="font-medium mb-1">{isNow ? 'Today (after decay)' : `Match #${matchNum}`}</div>
                      <div className="grid gap-1">
                        {(payload as TooltipEntry[]).map((entry) => (
                          <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-sm">
                            <div className="flex items-center gap-1.5">
                              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                              <span className="text-muted-foreground">{entry.dataKey}</span>
                            </div>
                            <span className="font-medium">{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }}
              />
              {players.map((player, index) => (
                <Line
                  key={player.playerId}
                  type="monotone"
                  dataKey={player.playerName}
                  stroke={chartConfig[player.playerName]?.color}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              ))}
            </LineChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
