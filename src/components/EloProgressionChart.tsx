
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { MatchHistoryEntry, CalculatedPlayer } from '@/types/darts';

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
}

export function EloProgressionChart({ matchHistory, players }: EloProgressionChartProps) {
  const chartData = useMemo(() => {
    if (!matchHistory.length || !players.length) return [];

    const playerNames = players.reduce((acc, p) => {
      acc[p.playerId] = p.playerName;
      return acc;
    }, {} as Record<string, string>);

    // Track Elo after each match
    const playerElos: Record<string, number> = {};
    players.forEach(p => { playerElos[p.playerId] = 1000; });

    const data: any[] = [{ match: 0, ...Object.fromEntries(players.map(p => [p.playerName, 1000])) }];

    matchHistory.forEach((entry, index) => {
      entry.results.forEach(r => {
        playerElos[r.playerId] = r.eloAfter;
      });
      
      const dataPoint: any = { match: index + 1 };
      Object.entries(playerElos).forEach(([id, elo]) => {
        const name = playerNames[id];
        if (name) dataPoint[name] = Math.round(elo);
      });
      data.push(dataPoint);
    });

    return data;
  }, [matchHistory, players]);

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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Elo Progression Over Time
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-6">
        <div className="w-full overflow-x-auto">
          <ChartContainer config={chartConfig} className="h-[300px] sm:h-[400px] w-full min-w-[300px]">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="match" label={{ value: 'Match Number', position: 'insideBottom', offset: -5 }} fontSize={12} />
              <YAxis label={{ value: 'Elo Rating', angle: -90, position: 'insideLeft' }} fontSize={12} />
              <ChartTooltip content={<ChartTooltipContent />} />
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
