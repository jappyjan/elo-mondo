
import { usePlayers } from '@/hooks/usePlayers';
import { useMatches } from '@/hooks/useMatches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useMemo } from 'react';

export function EloProgressionChart() {
  const { data: players = [] } = usePlayers();
  const { data: matches = [] } = useMatches();

  const chartData = useMemo(() => {
    if (!matches.length || !players.length) return [];

    // Create a map of player names for easier lookup
    const playerNames = players.reduce((acc, player) => {
      acc[player.id] = player.name;
      return acc;
    }, {} as Record<string, string>);

    // Create initial Elo tracking for each player
    const playerProgress = players.reduce((acc, player) => {
      acc[player.id] = [{ 
        match: 0, 
        elo: 1000, 
        name: player.name,
        timestamp: new Date(player.created_at).getTime()
      }];
      return acc;
    }, {} as Record<string, Array<{ match: number; elo: number; name: string; timestamp: number }>>);

    // Process matches in chronological order
    const sortedMatches = [...matches].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    sortedMatches.forEach((match, index) => {
      const matchNumber = index + 1;
      const timestamp = new Date(match.created_at).getTime();

      if (match.match_type === 'multiplayer' && match.participants) {
        // Handle multiplayer matches
        match.participants.forEach(participant => {
          if (playerProgress[participant.player_id]) {
            playerProgress[participant.player_id].push({
              match: matchNumber,
              elo: participant.elo_after,
              name: participant.player.name,
              timestamp
            });
          }
        });
      } else {
        // Handle 1v1 matches
        if (playerProgress[match.winner_id]) {
          playerProgress[match.winner_id].push({
            match: matchNumber,
            elo: match.winner_elo_after,
            name: playerNames[match.winner_id] || 'Unknown',
            timestamp
          });
        }

        if (playerProgress[match.loser_id]) {
          playerProgress[match.loser_id].push({
            match: matchNumber,
            elo: match.loser_elo_after,
            name: playerNames[match.loser_id] || 'Unknown',
            timestamp
          });
        }
      }
    });

    // Convert to chart format
    const allMatches = Array.from({ length: sortedMatches.length + 1 }, (_, i) => i);
    
    return allMatches.map(matchNumber => {
      const dataPoint: any = { match: matchNumber };
      
      Object.entries(playerProgress).forEach(([playerId, progress]) => {
        const playerName = playerNames[playerId] || 'Unknown';
        // Find the latest Elo for this match number
        const relevantProgress = progress.filter(p => p.match <= matchNumber);
        const latestElo = relevantProgress[relevantProgress.length - 1]?.elo || 1000;
        dataPoint[playerName] = latestElo;
      });
      
      return dataPoint;
    });
  }, [matches, players]);

  const chartConfig = useMemo(() => {
    const config: any = {};
    const colors = [
      'hsl(var(--chart-1))',
      'hsl(var(--chart-2))',
      'hsl(var(--chart-3))',
      'hsl(var(--chart-4))',
      'hsl(var(--chart-5))',
    ];

    players.forEach((player, index) => {
      config[player.name] = {
        label: player.name,
        color: colors[index % colors.length],
      };
    });

    return config;
  }, [players]);

  if (!matches.length || !players.length) {
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Elo Progression Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[400px]">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="match" 
              label={{ value: 'Match Number', position: 'insideBottom', offset: -5 }}
            />
            <YAxis 
              label={{ value: 'Elo Rating', angle: -90, position: 'insideLeft' }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            {players.map((player, index) => (
              <Line
                key={player.id}
                type="monotone"
                dataKey={player.name}
                stroke={chartConfig[player.name]?.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
