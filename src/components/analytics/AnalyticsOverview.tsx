import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalculatedPlayer, MatchHistoryEntry } from '@/types/darts';
import { Trophy, Target, Users, TrendingUp, Medal } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface AnalyticsOverviewProps {
  players: CalculatedPlayer[];
  matchHistory: MatchHistoryEntry[];
  selectedYear: number | null;
}

const AnalyticsOverview = ({ players, matchHistory, selectedYear }: AnalyticsOverviewProps) => {
  // Calculate key metrics
  const metrics = useMemo(() => {
    const activePlayers = players.filter(p => !p.isProvisional);
    const totalMatches = matchHistory.length;
    const avgWinRate = activePlayers.length > 0
      ? activePlayers.reduce((sum, p) => sum + p.winRate, 0) / activePlayers.length
      : 0;
    const avgElo = activePlayers.length > 0
      ? activePlayers.reduce((sum, p) => sum + p.currentElo, 0) / activePlayers.length
      : 1000;
    const highestElo = activePlayers.length > 0
      ? Math.max(...activePlayers.map(p => p.currentElo))
      : 1000;

    return {
      totalPlayers: players.length,
      activePlayers: activePlayers.length,
      totalMatches,
      avgWinRate,
      avgElo: Math.round(avgElo),
      highestElo,
    };
  }, [players, matchHistory]);

  // Elo distribution data
  const eloDistribution = useMemo(() => {
    const buckets: Record<string, number> = {
      '< 900': 0,
      '900-950': 0,
      '950-1000': 0,
      '1000-1050': 0,
      '1050-1100': 0,
      '1100-1150': 0,
      '> 1150': 0,
    };

    players.forEach(player => {
      const elo = player.currentElo;
      if (elo < 900) buckets['< 900']++;
      else if (elo < 950) buckets['900-950']++;
      else if (elo < 1000) buckets['950-1000']++;
      else if (elo < 1050) buckets['1000-1050']++;
      else if (elo < 1100) buckets['1050-1100']++;
      else if (elo < 1150) buckets['1100-1150']++;
      else buckets['> 1150']++;
    });

    return Object.entries(buckets).map(([range, count]) => ({
      range,
      count,
    }));
  }, [players]);

  // Top players
  const topPlayers = useMemo(() => {
    return [...players]
      .filter(p => !p.isProvisional)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 5);
  }, [players]);

  // Win rate leaders
  const winRateLeaders = useMemo(() => {
    return [...players]
      .filter(p => !p.isProvisional && p.matchesPlayed >= 5)
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 5);
  }, [players]);

  const getBarColor = (elo: string) => {
    if (elo.includes('< 900') || elo.includes('900-950')) return 'hsl(var(--destructive))';
    if (elo.includes('950-1000')) return 'hsl(var(--muted-foreground))';
    if (elo.includes('1000-1050')) return 'hsl(var(--primary))';
    return 'hsl(142, 76%, 36%)'; // green for above average
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.activePlayers}</p>
                <p className="text-xs text-muted-foreground">Active Players</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.totalMatches}</p>
                <p className="text-xs text-muted-foreground">Total Matches</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.avgElo}</p>
                <p className="text-xs text-muted-foreground">Avg Elo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics.highestElo}</p>
                <p className="text-xs text-muted-foreground">Highest Elo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Elo Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Elo Distribution</CardTitle>
          <CardDescription>
            How players are spread across rating brackets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={eloDistribution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="range" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  allowDecimals={false}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {eloDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.range)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top by Elo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top Players by Elo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPlayers.map((player, index) => (
                <div 
                  key={player.playerId}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                      ${index === 0 ? 'bg-yellow-500/20 text-yellow-600' : ''}
                      ${index === 1 ? 'bg-slate-400/20 text-slate-500' : ''}
                      ${index === 2 ? 'bg-amber-600/20 text-amber-700' : ''}
                      ${index > 2 ? 'bg-muted text-muted-foreground' : ''}
                    `}>
                      {index + 1}
                    </div>
                    <span className="font-medium">{player.playerName}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{player.currentElo}</div>
                    <div className="text-xs text-muted-foreground">
                      {player.matchesPlayed} games
                    </div>
                  </div>
                </div>
              ))}
              {topPlayers.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No active players yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top by Win Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Medal className="h-5 w-5 text-green-500" />
              Best Win Rate
            </CardTitle>
            <CardDescription>Minimum 5 games played</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {winRateLeaders.map((player, index) => (
                <div 
                  key={player.playerId}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                      ${index === 0 ? 'bg-green-500/20 text-green-600' : 'bg-muted text-muted-foreground'}
                    `}>
                      {index + 1}
                    </div>
                    <span className="font-medium">{player.playerName}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">
                      {(player.winRate * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {player.wins}W - {player.losses}L
                    </div>
                  </div>
                </div>
              ))}
              {winRateLeaders.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No players with 5+ games yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsOverview;
