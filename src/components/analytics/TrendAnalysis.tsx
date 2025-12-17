import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalculatedPlayer, MatchHistoryEntry } from '@/types/darts';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, isWithinInterval } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
} from 'recharts';

interface TrendAnalysisProps {
  players: CalculatedPlayer[];
  matchHistory: MatchHistoryEntry[];
  selectedYear: number | null;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 76%, 36%)',
  'hsl(45, 93%, 47%)',
  'hsl(280, 87%, 65%)',
  'hsl(199, 89%, 48%)',
  'hsl(0, 84%, 60%)',
];

const TrendAnalysis = ({ players, matchHistory, selectedYear }: TrendAnalysisProps) => {
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

  // Monthly performance data
  const monthlyData = useMemo(() => {
    if (matchHistory.length === 0) return [];

    const dates = matchHistory.map(m => parseISO(m.matchDate));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    const months = eachMonthOfInterval({ start: minDate, end: maxDate });

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const matchesInMonth = matchHistory.filter(m => {
        const matchDate = parseISO(m.matchDate);
        return isWithinInterval(matchDate, { start: monthStart, end: monthEnd });
      });

      // Calculate average Elo change per player
      const playerChanges: Record<string, number[]> = {};
      matchesInMonth.forEach(match => {
        match.results.forEach(result => {
          if (!playerChanges[result.playerId]) {
            playerChanges[result.playerId] = [];
          }
          playerChanges[result.playerId].push(result.eloChange);
        });
      });

      const data: Record<string, any> = {
        month: format(month, 'MMM yyyy'),
        totalMatches: matchesInMonth.length,
      };

      // Add selected players' average changes
      selectedPlayers.forEach(playerId => {
        const changes = playerChanges[playerId] || [];
        data[playerId] = changes.length > 0
          ? Math.round(changes.reduce((a, b) => a + b, 0) / changes.length)
          : null;
      });

      return data;
    });
  }, [matchHistory, selectedPlayers]);

  // Elo volatility (rolling standard deviation)
  const volatilityData = useMemo(() => {
    if (!selectedPlayers.length || matchHistory.length === 0) return [];

    const data: { match: number; [key: string]: number | null }[] = [];
    const windowSize = 5;

    // Track each player's Elo changes
    const playerChanges: Record<string, number[]> = {};
    selectedPlayers.forEach(id => {
      playerChanges[id] = [];
    });

    matchHistory.forEach((match, matchIndex) => {
      // Record changes for this match
      match.results.forEach(result => {
        if (selectedPlayers.includes(result.playerId)) {
          playerChanges[result.playerId].push(result.eloChange);
        }
      });

      // Calculate rolling std dev for each player
      const point: { match: number; [key: string]: number | null } = { match: matchIndex + 1 };
      
      selectedPlayers.forEach(playerId => {
        const changes = playerChanges[playerId];
        if (changes.length >= windowSize) {
          const window = changes.slice(-windowSize);
          const mean = window.reduce((a, b) => a + b, 0) / windowSize;
          const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / windowSize;
          point[playerId] = Math.round(Math.sqrt(variance) * 10) / 10;
        } else {
          point[playerId] = null;
        }
      });

      data.push(point);
    });

    return data;
  }, [matchHistory, selectedPlayers]);

  // Position probability (finish positions)
  const positionProbability = useMemo(() => {
    const playerPositions: Record<string, Record<number, number>> = {};

    matchHistory.forEach(match => {
      // Sort results by Elo change (highest = 1st place)
      const sorted = [...match.results].sort((a, b) => b.eloChange - a.eloChange);
      
      sorted.forEach((result, index) => {
        const position = index + 1;
        if (!playerPositions[result.playerId]) {
          playerPositions[result.playerId] = {};
        }
        playerPositions[result.playerId][position] = 
          (playerPositions[result.playerId][position] || 0) + 1;
      });
    });

    // Convert to percentage for each selected player
    return selectedPlayers.map(playerId => {
      const positions = playerPositions[playerId] || {};
      const totalGames = Object.values(positions).reduce((a, b) => a + b, 0);
      const player = players.find(p => p.playerId === playerId);
      
      return {
        name: player?.playerName || 'Unknown',
        '1st': totalGames > 0 ? Math.round((positions[1] || 0) / totalGames * 100) : 0,
        '2nd': totalGames > 0 ? Math.round((positions[2] || 0) / totalGames * 100) : 0,
        '3rd+': totalGames > 0 ? Math.round(
          Object.entries(positions)
            .filter(([pos]) => parseInt(pos) >= 3)
            .reduce((sum, [, count]) => sum + count, 0) / totalGames * 100
        ) : 0,
      };
    });
  }, [matchHistory, selectedPlayers, players]);

  // Player rankings over time
  const rankingsOverTime = useMemo(() => {
    if (!selectedPlayers.length) return [];

    const data: { match: number; [key: string]: number | null }[] = [];
    const playerElos: Record<string, number> = {};
    
    // Initialize all players
    players.forEach(p => {
      playerElos[p.playerId] = 1000;
    });

    matchHistory.forEach((match, matchIndex) => {
      // Update Elos from this match
      match.results.forEach(result => {
        playerElos[result.playerId] = result.eloAfter;
      });

      // Calculate current rankings
      const rankings = Object.entries(playerElos)
        .sort(([, a], [, b]) => b - a)
        .map(([id], index) => ({ id, rank: index + 1 }));

      const point: { match: number; [key: string]: number | null } = { match: matchIndex + 1 };
      
      selectedPlayers.forEach(playerId => {
        const ranking = rankings.find(r => r.id === playerId);
        point[playerId] = ranking?.rank || null;
      });

      data.push(point);
    });

    return data;
  }, [matchHistory, selectedPlayers, players]);

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers(prev => 
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : prev.length < 6
          ? [...prev, playerId]
          : prev
    );
  };

  return (
    <div className="space-y-6">
      {/* Player Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Players to Compare</CardTitle>
          <CardDescription>Choose up to 6 players for trend analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {players
              .filter(p => !p.isProvisional)
              .sort((a, b) => a.playerName.localeCompare(b.playerName))
              .map((player, index) => {
                const isSelected = selectedPlayers.includes(player.playerId);
                const colorIndex = selectedPlayers.indexOf(player.playerId);
                
                return (
                  <button
                    key={player.playerId}
                    onClick={() => togglePlayer(player.playerId)}
                    className={`
                      px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                      ${isSelected 
                        ? 'text-white' 
                        : 'bg-muted hover:bg-muted/80 text-foreground'
                      }
                    `}
                    style={isSelected ? { backgroundColor: COLORS[colorIndex % COLORS.length] } : {}}
                  >
                    {player.playerName}
                  </button>
                );
              })}
          </div>
          {selectedPlayers.length === 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              Click on players above to select them for analysis
            </p>
          )}
        </CardContent>
      </Card>

      {selectedPlayers.length > 0 && (
        <>
          {/* Rankings Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Rankings Over Time</CardTitle>
              <CardDescription>Position changes throughout the season</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rankingsOverTime}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="match" 
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      reversed
                      domain={[1, players.length]}
                      allowDecimals={false}
                      className="text-muted-foreground"
                      label={{ value: 'Rank', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string) => {
                        const player = players.find(p => p.playerId === name);
                        return [`#${value}`, player?.playerName || name];
                      }}
                    />
                    <Legend 
                      formatter={(value) => {
                        const player = players.find(p => p.playerId === value);
                        return player?.playerName || value;
                      }}
                    />
                    {selectedPlayers.map((playerId, index) => (
                      <Line
                        key={playerId}
                        type="monotone"
                        dataKey={playerId}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Performance</CardTitle>
              <CardDescription>Average Elo change per month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      className="text-muted-foreground"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string) => {
                        const player = players.find(p => p.playerId === name);
                        return [value !== null ? `${value > 0 ? '+' : ''}${value}` : 'N/A', player?.playerName || name];
                      }}
                    />
                    <Legend 
                      formatter={(value) => {
                        const player = players.find(p => p.playerId === value);
                        return player?.playerName || value;
                      }}
                    />
                    {selectedPlayers.map((playerId, index) => (
                      <Bar
                        key={playerId}
                        dataKey={playerId}
                        fill={COLORS[index % COLORS.length]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Elo Volatility */}
          <Card>
            <CardHeader>
              <CardTitle>Elo Volatility</CardTitle>
              <CardDescription>
                Rolling standard deviation of Elo changes (5-game window) - lower is more consistent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={volatilityData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="match" 
                      className="text-muted-foreground"
                    />
                    <YAxis className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string) => {
                        const player = players.find(p => p.playerId === name);
                        return [value?.toFixed(1) || 'N/A', player?.playerName || name];
                      }}
                    />
                    <Legend 
                      formatter={(value) => {
                        const player = players.find(p => p.playerId === value);
                        return player?.playerName || value;
                      }}
                    />
                    {selectedPlayers.map((playerId, index) => (
                      <Line
                        key={playerId}
                        type="monotone"
                        dataKey={playerId}
                        stroke={COLORS[index % COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Position Probability */}
          <Card>
            <CardHeader>
              <CardTitle>Finish Position Distribution</CardTitle>
              <CardDescription>Historical probability of finishing positions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={positionProbability} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" domain={[0, 100]} unit="%" className="text-muted-foreground" />
                    <YAxis type="category" dataKey="name" className="text-muted-foreground" width={80} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`${value}%`]}
                    />
                    <Legend />
                    <Bar dataKey="1st" stackId="a" fill="hsl(142, 76%, 36%)" name="1st Place" />
                    <Bar dataKey="2nd" stackId="a" fill="hsl(45, 93%, 47%)" name="2nd Place" />
                    <Bar dataKey="3rd+" stackId="a" fill="hsl(var(--muted-foreground))" name="3rd+" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {selectedPlayers.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Select players above to view trend analysis
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TrendAnalysis;
