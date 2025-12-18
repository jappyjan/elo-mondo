
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MatchHistoryEntry, CalculatedPlayer } from '@/types/darts';

type RangeOption = 'all' | 'last15' | 'lastMonth' | 'last3Months' | 'lastYear';

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
}

export function EloProgressionChart({ matchHistory, players, year }: EloProgressionChartProps) {
  const [range, setRange] = useState<RangeOption>('last15');

  const filteredMatchHistory = useMemo(() => {
    if (!matchHistory.length) return [];
    
    const now = new Date();
    const sortedHistory = [...matchHistory].sort((a, b) => 
      new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()
    );
    
    switch (range) {
      case 'last15':
        return sortedHistory.slice(-15);
      case 'lastMonth': {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return sortedHistory.filter(m => new Date(m.matchDate) >= oneMonthAgo);
      }
      case 'last3Months': {
        const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        return sortedHistory.filter(m => new Date(m.matchDate) >= threeMonthsAgo);
      }
      case 'lastYear': {
        const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        return sortedHistory.filter(m => new Date(m.matchDate) >= oneYearAgo);
      }
      default:
        return sortedHistory;
    }
  }, [matchHistory, range]);

  const chartData = useMemo(() => {
    if (!filteredMatchHistory.length || !players.length) return [];

    const playerNames = players.reduce((acc, p) => {
      acc[p.playerId] = p.playerName;
      return acc;
    }, {} as Record<string, string>);

    // Find the starting Elo for each player at the beginning of the filtered range
    const allSorted = [...matchHistory].sort((a, b) => 
      new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime()
    );
    
    const playerElos: Record<string, number> = {};
    players.forEach(p => { playerElos[p.playerId] = 1000; });
    
    // Find the global index of the first filtered match
    const firstFilteredMatchId = filteredMatchHistory[0]?.matchId;
    const firstFilteredGlobalIndex = allSorted.findIndex(m => m.matchId === firstFilteredMatchId);
    
    // Calculate Elo up to the start of filtered range
    allSorted.slice(0, firstFilteredGlobalIndex).forEach(entry => {
      entry.results.forEach(r => {
        playerElos[r.playerId] = r.eloAfter;
      });
    });

    // Starting point uses the global index
    const startMatchNumber = firstFilteredGlobalIndex > 0 ? firstFilteredGlobalIndex : 0;
    const data: any[] = [{ match: startMatchNumber, ...Object.fromEntries(Object.entries(playerElos).map(([id, elo]) => [playerNames[id], Math.round(elo)])) }];

    filteredMatchHistory.forEach((entry, index) => {
      entry.results.forEach(r => {
        playerElos[r.playerId] = r.eloAfter;
      });
      
      const dataPoint: any = { match: startMatchNumber + index + 1 };
      Object.entries(playerElos).forEach(([id, elo]) => {
        const name = playerNames[id];
        if (name) dataPoint[name] = Math.round(elo);
      });
      data.push(dataPoint);
    });

    return data;
  }, [filteredMatchHistory, players, matchHistory]);

  const chartConfig = useMemo(() => {
    const config: any = {};
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
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="font-medium mb-1">Match #{matchNum}</div>
                      <div className="grid gap-1">
                        {payload.map((entry: any) => (
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
