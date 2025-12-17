import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalculatedPlayer, MatchHistoryEntry } from '@/types/darts';
import { TrendingUp, TrendingDown, Minus, Flame, Snowflake } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';

interface IndividualPerformanceProps {
  players: CalculatedPlayer[];
  matchHistory: MatchHistoryEntry[];
}

const IndividualPerformance = ({ players, matchHistory }: IndividualPerformanceProps) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');

  const selectedPlayer = useMemo(() => {
    return players.find(p => p.playerId === selectedPlayerId);
  }, [players, selectedPlayerId]);

  // Calculate Elo progression for selected player
  const eloProgression = useMemo(() => {
    if (!selectedPlayerId) return [];

    const progression: { match: number; elo: number; change: number; date: string }[] = [];
    let currentElo = 1000;

    matchHistory.forEach((match, index) => {
      const playerResult = match.results.find(r => r.playerId === selectedPlayerId);
      if (playerResult) {
        currentElo = playerResult.eloAfter;
        progression.push({
          match: index + 1,
          elo: currentElo,
          change: playerResult.eloChange,
          date: new Date(match.matchDate).toLocaleDateString(),
        });
      }
    });

    return progression;
  }, [selectedPlayerId, matchHistory]);

  // Calculate streaks
  const streaks = useMemo(() => {
    if (!selectedPlayerId) return { current: 0, best: 0, worst: 0 };

    let currentStreak = 0;
    let bestStreak = 0;
    let worstStreak = 0;
    let tempStreak = 0;

    matchHistory.forEach(match => {
      const playerResult = match.results.find(r => r.playerId === selectedPlayerId);
      if (playerResult) {
        if (playerResult.eloChange > 0) {
          if (tempStreak > 0) tempStreak++;
          else tempStreak = 1;
          bestStreak = Math.max(bestStreak, tempStreak);
        } else if (playerResult.eloChange < 0) {
          if (tempStreak < 0) tempStreak--;
          else tempStreak = -1;
          worstStreak = Math.min(worstStreak, tempStreak);
        }
        currentStreak = tempStreak;
      }
    });

    return { current: currentStreak, best: bestStreak, worst: Math.abs(worstStreak) };
  }, [selectedPlayerId, matchHistory]);

  // Calculate radar chart data
  const radarData = useMemo(() => {
    if (!selectedPlayer) return [];

    const allPlayers = players.filter(p => !p.isProvisional && p.matchesPlayed >= 5);
    if (allPlayers.length === 0) return [];

    // Normalize metrics to 0-100 scale
    const maxElo = Math.max(...allPlayers.map(p => p.currentElo));
    const minElo = Math.min(...allPlayers.map(p => p.currentElo));
    const maxGames = Math.max(...allPlayers.map(p => p.matchesPlayed));

    // Calculate consistency (inverse of Elo volatility)
    const playerChanges = eloProgression.map(e => Math.abs(e.change));
    const avgChange = playerChanges.length > 0 
      ? playerChanges.reduce((a, b) => a + b, 0) / playerChanges.length 
      : 0;
    const consistency = Math.max(0, 100 - avgChange * 2);

    return [
      {
        metric: 'Elo Rating',
        value: minElo === maxElo ? 50 : ((selectedPlayer.currentElo - minElo) / (maxElo - minElo)) * 100,
        fullMark: 100,
      },
      {
        metric: 'Win Rate',
        value: selectedPlayer.winRate * 100,
        fullMark: 100,
      },
      {
        metric: 'Experience',
        value: (selectedPlayer.matchesPlayed / maxGames) * 100,
        fullMark: 100,
      },
      {
        metric: 'Consistency',
        value: consistency,
        fullMark: 100,
      },
      {
        metric: 'Form',
        value: eloProgression.length >= 5
          ? Math.min(100, Math.max(0, 50 + eloProgression.slice(-5).reduce((a, b) => a + b.change, 0)))
          : 50,
        fullMark: 100,
      },
    ];
  }, [selectedPlayer, players, eloProgression]);

  // Recent form (last 10 matches)
  const recentForm = useMemo(() => {
    if (!selectedPlayerId) return [];
    return eloProgression.slice(-10).map(e => ({
      ...e,
      result: e.change > 0 ? 'W' : e.change < 0 ? 'L' : 'D',
    }));
  }, [selectedPlayerId, eloProgression]);

  return (
    <div className="space-y-6">
      {/* Player Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Player</CardTitle>
          <CardDescription>Choose a player to view detailed performance</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="Select a player" />
            </SelectTrigger>
            <SelectContent>
              {players
                .sort((a, b) => a.playerName.localeCompare(b.playerName))
                .map(player => (
                  <SelectItem key={player.playerId} value={player.playerId}>
                    {player.playerName} ({player.currentElo} Elo)
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedPlayer && (
        <>
          {/* Player Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold">{selectedPlayer.currentElo}</p>
                <p className="text-sm text-muted-foreground">Current Elo</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold">{(selectedPlayer.winRate * 100).toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">Win Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold">{selectedPlayer.matchesPlayed}</p>
                <p className="text-sm text-muted-foreground">Games Played</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold">#{selectedPlayer.rank}</p>
                <p className="text-sm text-muted-foreground">Rank</p>
              </CardContent>
            </Card>
          </div>

          {/* Streaks */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center gap-2">
                  {streaks.current > 0 ? (
                    <Flame className="h-5 w-5 text-green-500" />
                  ) : streaks.current < 0 ? (
                    <Snowflake className="h-5 w-5 text-blue-500" />
                  ) : (
                    <Minus className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className={`text-2xl font-bold ${
                    streaks.current > 0 ? 'text-green-500' : 
                    streaks.current < 0 ? 'text-destructive' : ''
                  }`}>
                    {Math.abs(streaks.current)}
                  </span>
                </div>
                <p className="text-xs text-center text-muted-foreground mt-1">
                  Current {streaks.current >= 0 ? 'Win' : 'Loss'} Streak
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <span className="text-2xl font-bold text-green-500">{streaks.best}</span>
                </div>
                <p className="text-xs text-center text-muted-foreground mt-1">Best Win Streak</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-center gap-2">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                  <span className="text-2xl font-bold text-destructive">{streaks.worst}</span>
                </div>
                <p className="text-xs text-center text-muted-foreground mt-1">Worst Loss Streak</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Form */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Form</CardTitle>
              <CardDescription>Last 10 matches</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {recentForm.map((match, index) => (
                  <div
                    key={index}
                    className={`
                      w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold
                      ${match.result === 'W' ? 'bg-green-500/20 text-green-600' : ''}
                      ${match.result === 'L' ? 'bg-destructive/20 text-destructive' : ''}
                      ${match.result === 'D' ? 'bg-muted text-muted-foreground' : ''}
                    `}
                    title={`${match.date}: ${match.change > 0 ? '+' : ''}${match.change} Elo`}
                  >
                    {match.result}
                  </div>
                ))}
                {recentForm.length === 0 && (
                  <p className="text-muted-foreground">No matches yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Elo Progression */}
          <Card>
            <CardHeader>
              <CardTitle>Elo Progression</CardTitle>
              <CardDescription>Rating changes over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {eloProgression.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={eloProgression}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="match" 
                        label={{ value: 'Match #', position: 'bottom', offset: -5 }}
                        className="text-muted-foreground"
                      />
                      <YAxis 
                        domain={['dataMin - 20', 'dataMax + 20']}
                        className="text-muted-foreground"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number, name: string, props: any) => [
                          `${value} (${props.payload.change > 0 ? '+' : ''}${props.payload.change})`,
                          'Elo'
                        ]}
                        labelFormatter={(label) => `Match ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="elo"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 3 }}
                        activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No match data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Performance Radar */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Profile</CardTitle>
              <CardDescription>Multi-dimensional analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid className="stroke-muted" />
                      <PolarAngleAxis 
                        dataKey="metric" 
                        className="text-muted-foreground"
                        tick={{ fontSize: 12 }}
                      />
                      <PolarRadiusAxis 
                        angle={90} 
                        domain={[0, 100]} 
                        className="text-muted-foreground"
                      />
                      <Radar
                        name={selectedPlayer.playerName}
                        dataKey="value"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.3}
                      />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Need more data for analysis
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!selectedPlayer && (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Select a player above to view their detailed performance analytics
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default IndividualPerformance;
