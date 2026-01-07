import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useThrowAnalytics, PlayerThrowStats } from '@/hooks/useThrowAnalytics';
import { 
  Target, 
  Flame, 
  Trophy, 
  Crosshair, 
  CircleDot, 
  Frown, 
  Zap, 
  TrendingUp,
  Award,
  Loader2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 76%, 36%)',
  'hsl(45, 93%, 47%)',
  'hsl(280, 87%, 65%)',
  'hsl(199, 89%, 48%)',
  'hsl(0, 84%, 60%)',
];

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(142, 76%, 36%)', 'hsl(45, 93%, 47%)'];

interface LeaderboardCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  data: { name: string; value: number }[];
  suffix?: string;
  iconColor?: string;
}

const LeaderboardCard = ({ title, description, icon, data, suffix = '', iconColor = 'text-primary' }: LeaderboardCardProps) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base">
        <span className={iconColor}>{icon}</span>
        {title}
      </CardTitle>
      <CardDescription className="text-xs">{description}</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {data.slice(0, 5).map((item, index) => (
          <div 
            key={item.name}
            className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <div className={`
                w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${index === 0 ? 'bg-yellow-500/20 text-yellow-600' : ''}
                ${index === 1 ? 'bg-slate-400/20 text-slate-500' : ''}
                ${index === 2 ? 'bg-amber-600/20 text-amber-700' : ''}
                ${index > 2 ? 'bg-muted text-muted-foreground' : ''}
              `}>
                {index + 1}
              </div>
              <span className="text-sm font-medium truncate max-w-[100px]">{item.name}</span>
            </div>
            <span className="font-bold text-sm">{item.value}{suffix}</span>
          </div>
        ))}
        {data.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-2">No data yet</p>
        )}
      </div>
    </CardContent>
  </Card>
);

interface RecordCardProps {
  title: string;
  value: string | number;
  player: string;
  icon: React.ReactNode;
}

const RecordCard = ({ title, value, player, icon }: RecordCardProps) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground mt-1">{player}</p>
        </div>
        <div className="p-2 bg-primary/10 rounded-lg">
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

const DartsAnalytics = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const { data: analytics, isLoading } = useThrowAnalytics(groupId);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  
  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId || !analytics) return null;
    return analytics.playerStats.find(p => 
      (p.playerId || p.playerName) === selectedPlayerId
    );
  }, [selectedPlayerId, analytics]);
  
  // Prepare leaderboard data
  const leaderboards = useMemo(() => {
    if (!analytics) return null;
    
    const stats = analytics.playerStats;
    
    return {
      t20s: stats
        .filter(p => p.t20Count > 0)
        .sort((a, b) => b.t20Count - a.t20Count)
        .map(p => ({ name: p.playerName, value: p.t20Count })),
      
      count180s: stats
        .filter(p => p.count180s > 0)
        .sort((a, b) => b.count180s - a.count180s)
        .map(p => ({ name: p.playerName, value: p.count180s })),
      
      bulls: stats
        .filter(p => p.bullCount > 0)
        .sort((a, b) => b.bullCount - a.bullCount)
        .map(p => ({ name: p.playerName, value: p.bullCount })),
      
      doubles: stats
        .filter(p => p.doublesCount > 0)
        .sort((a, b) => b.doublesCount - a.doublesCount)
        .map(p => ({ name: p.playerName, value: p.doublesCount })),
      
      ones: stats
        .filter(p => p.onesCount > 0)
        .sort((a, b) => b.onesCount - a.onesCount)
        .map(p => ({ name: p.playerName, value: p.onesCount })),
      
      avgScore: stats
        .filter(p => p.totalTurns >= 10)
        .sort((a, b) => b.avgTurnScore - a.avgTurnScore)
        .map(p => ({ name: p.playerName, value: p.avgTurnScore })),
      
      bestTurn: stats
        .filter(p => p.bestTurn > 0)
        .sort((a, b) => b.bestTurn - a.bestTurn)
        .map(p => ({ name: p.playerName, value: p.bestTurn })),
    };
  }, [analytics]);
  
  // Prepare player throw type breakdown for pie chart
  const throwTypeBreakdown = useMemo(() => {
    if (!selectedPlayer) return [];
    return [
      { name: 'Singles', value: selectedPlayer.singlesCount, color: PIE_COLORS[0] },
      { name: 'Doubles', value: selectedPlayer.doublesCount, color: PIE_COLORS[1] },
      { name: 'Triples', value: selectedPlayer.triplesCount, color: PIE_COLORS[2] },
    ].filter(d => d.value > 0);
  }, [selectedPlayer]);
  
  // Top segments for selected player
  const topSegments = useMemo(() => {
    if (!selectedPlayer) return [];
    return Object.entries(selectedPlayer.segmentCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([segment, count]) => ({
        segment: segment === '50' ? 'Bull' : segment === '25' ? 'Outer Bull' : segment,
        count,
      }));
  }, [selectedPlayer]);
  
  // Radar data for selected player comparison
  const radarData = useMemo(() => {
    if (!selectedPlayer || !analytics) return [];
    
    const maxT20 = Math.max(...analytics.playerStats.map(p => p.t20Count), 1);
    const maxDoubles = Math.max(...analytics.playerStats.map(p => p.doublesCount), 1);
    const maxBulls = Math.max(...analytics.playerStats.map(p => p.bullCount), 1);
    const maxAvg = Math.max(...analytics.playerStats.map(p => p.avgTurnScore), 1);
    const max180s = Math.max(...analytics.playerStats.map(p => p.count180s), 1);
    
    return [
      { metric: 'T20s', value: (selectedPlayer.t20Count / maxT20) * 100, fullMark: 100 },
      { metric: 'Doubles', value: (selectedPlayer.doublesCount / maxDoubles) * 100, fullMark: 100 },
      { metric: 'Bulls', value: (selectedPlayer.bullCount / maxBulls) * 100, fullMark: 100 },
      { metric: 'Avg Turn', value: (selectedPlayer.avgTurnScore / maxAvg) * 100, fullMark: 100 },
      { metric: '180s', value: (selectedPlayer.count180s / max180s) * 100, fullMark: 100 },
    ];
  }, [selectedPlayer, analytics]);
  
  // Time series data for all players (for comparison chart)
  const timeSeriesData = useMemo(() => {
    if (!analytics) return [];
    
    // Get all unique months
    const allMonths = new Set<string>();
    analytics.playerStats.forEach(p => {
      p.turnsOverTime.forEach(t => allMonths.add(t.month));
    });
    
    const months = Array.from(allMonths).sort();
    
    return months.map(month => {
      const point: Record<string, any> = { month: formatMonth(month) };
      analytics.playerStats.slice(0, 5).forEach(p => {
        const monthData = p.turnsOverTime.find(t => t.month === month);
        point[p.playerName] = monthData?.avgScore || null;
      });
      return point;
    });
  }, [analytics]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!analytics || analytics.totalThrows === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No dart throw data yet</p>
            <p className="text-sm mt-1">Play some live games to start tracking your throws!</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.totalThrows.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Throws</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Crosshair className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.totalGames}</p>
                <p className="text-xs text-muted-foreground">Games Tracked</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.avgTurnScore}</p>
                <p className="text-xs text-muted-foreground">Avg Turn Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Flame className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.total180s}</p>
                <p className="text-xs text-muted-foreground">Total 180s</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Tabs for different views */}
      <Tabs defaultValue="leaderboards" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="player">Player Stats</TabsTrigger>
        </TabsList>
        
        {/* Leaderboards Tab */}
        <TabsContent value="leaderboards" className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leaderboards && (
              <>
                <LeaderboardCard
                  title="Most Triple 20s"
                  description="The T20 machines"
                  icon={<Crosshair className="h-4 w-4" />}
                  data={leaderboards.t20s}
                  iconColor="text-red-500"
                />
                
                <LeaderboardCard
                  title="Most 180s"
                  description="Perfect turns"
                  icon={<Flame className="h-4 w-4" />}
                  data={leaderboards.count180s}
                  iconColor="text-yellow-500"
                />
                
                <LeaderboardCard
                  title="Best Turn Average"
                  description="Min 10 turns"
                  icon={<TrendingUp className="h-4 w-4" />}
                  data={leaderboards.avgScore}
                  iconColor="text-green-500"
                />
                
                <LeaderboardCard
                  title="Most Bulls"
                  description="Bullseye masters"
                  icon={<CircleDot className="h-4 w-4" />}
                  data={leaderboards.bulls}
                  iconColor="text-red-600"
                />
                
                <LeaderboardCard
                  title="Most Doubles"
                  description="Checkout kings"
                  icon={<Target className="h-4 w-4" />}
                  data={leaderboards.doubles}
                  iconColor="text-blue-500"
                />
                
                <LeaderboardCard
                  title="Wall of Shame (Most 1s)"
                  description="We've all been there..."
                  icon={<Frown className="h-4 w-4" />}
                  data={leaderboards.ones}
                  iconColor="text-muted-foreground"
                />
              </>
            )}
          </div>
        </TabsContent>
        
        {/* Distribution Tab */}
        <TabsContent value="distribution" className="space-y-6">
          {/* Turn Score Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Turn Score Distribution</CardTitle>
              <CardDescription>How often each score range is hit</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.turnScoreDistribution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="range" 
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                    />
                    <YAxis className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`${value} turns`, 'Count']}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          {/* Segment Popularity */}
          <Card>
            <CardHeader>
              <CardTitle>Segment Popularity</CardTitle>
              <CardDescription>Which segments get hit the most</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.segmentHeatmap}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="segment" 
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                    />
                    <YAxis className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`${value} hits`, 'Count']}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="hsl(142, 76%, 36%)" 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          {/* Average Score Over Time */}
          {timeSeriesData.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Average Turn Score Over Time</CardTitle>
                <CardDescription>Top 5 players monthly progression</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeSeriesData}>
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
                      />
                      <Legend />
                      {analytics.playerStats.slice(0, 5).map((player, index) => (
                        <Line
                          key={player.playerName}
                          type="monotone"
                          dataKey={player.playerName}
                          stroke={COLORS[index % COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* Records Tab */}
        <TabsContent value="records" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            <RecordCard
              title="Longest T20 Streak"
              value={`${analytics.records.longestT20Streak.count} in a row`}
              player={analytics.records.longestT20Streak.player}
              icon={<Zap className="h-5 w-5 text-primary" />}
            />
            
            <RecordCard
              title="Longest 100+ Turn Streak"
              value={`${analytics.records.longest100PlusStreak.count} turns`}
              player={analytics.records.longest100PlusStreak.player}
              icon={<Flame className="h-5 w-5 text-primary" />}
            />
            
            <RecordCard
              title="Most 180s in a Game"
              value={analytics.records.most180sInGame.count}
              player={analytics.records.most180sInGame.player}
              icon={<Trophy className="h-5 w-5 text-primary" />}
            />
            
            <RecordCard
              title="Highest Game Average"
              value={analytics.records.highestGameAverage.average}
              player={analytics.records.highestGameAverage.player}
              icon={<Award className="h-5 w-5 text-primary" />}
            />
          </div>
          
          {/* High Score Counts */}
          <Card>
            <CardHeader>
              <CardTitle>High Score Achievements</CardTitle>
              <CardDescription>Who hits the big scores most often</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Player</th>
                      <th className="text-center p-2">180s</th>
                      <th className="text-center p-2">140+</th>
                      <th className="text-center p-2">100+</th>
                      <th className="text-center p-2">60+</th>
                      <th className="text-center p-2">Best</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.playerStats
                      .filter(p => p.totalTurns >= 5)
                      .sort((a, b) => b.count180s - a.count180s || b.count140Plus - a.count140Plus)
                      .slice(0, 10)
                      .map(player => (
                        <tr key={player.playerId || player.playerName} className="border-b">
                          <td className="p-2 font-medium">{player.playerName}</td>
                          <td className="text-center p-2">
                            <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-600 font-bold">
                              {player.count180s}
                            </span>
                          </td>
                          <td className="text-center p-2">{player.count140Plus}</td>
                          <td className="text-center p-2">{player.count100Plus}</td>
                          <td className="text-center p-2">{player.count60Plus}</td>
                          <td className="text-center p-2 font-bold">{player.bestTurn}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Player Stats Tab */}
        <TabsContent value="player" className="space-y-6">
          {/* Player Selector */}
          <Card>
            <CardHeader>
              <CardTitle>Select Player</CardTitle>
              <CardDescription>View detailed statistics for a specific player</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="Select a player" />
                </SelectTrigger>
                <SelectContent>
                  {analytics.playerStats
                    .sort((a, b) => a.playerName.localeCompare(b.playerName))
                    .map(player => (
                      <SelectItem 
                        key={player.playerId || player.playerName} 
                        value={player.playerId || player.playerName}
                      >
                        {player.playerName} ({player.totalThrows} throws)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          
          {selectedPlayer && (
            <>
              {/* Player Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold">{selectedPlayer.totalThrows}</p>
                    <p className="text-sm text-muted-foreground">Total Throws</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold">{selectedPlayer.avgTurnScore}</p>
                    <p className="text-sm text-muted-foreground">Avg Turn</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold">{selectedPlayer.count180s}</p>
                    <p className="text-sm text-muted-foreground">180s</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <p className="text-3xl font-bold">{selectedPlayer.bestTurn}</p>
                    <p className="text-sm text-muted-foreground">Best Turn</p>
                  </CardContent>
                </Card>
              </div>
              
              {/* Personal Records */}
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-500/10 rounded-lg">
                        <Crosshair className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{selectedPlayer.t20Count}</p>
                        <p className="text-xs text-muted-foreground">Triple 20s</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-600/10 rounded-lg">
                        <CircleDot className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{selectedPlayer.bullCount}</p>
                        <p className="text-xs text-muted-foreground">Bulls ({selectedPlayer.doubleBullCount} D-Bull)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-yellow-500/10 rounded-lg">
                        <Zap className="h-5 w-5 text-yellow-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{selectedPlayer.longestT20Streak}</p>
                        <p className="text-xs text-muted-foreground">Best T20 Streak</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Charts */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Throw Type Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle>Throw Type Breakdown</CardTitle>
                    <CardDescription>Singles vs Doubles vs Triples</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      {throwTypeBreakdown.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={throwTypeBreakdown}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                              {throwTypeBreakdown.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                          No throw data
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                
                {/* Favorite Segments */}
                <Card>
                  <CardHeader>
                    <CardTitle>Favorite Segments</CardTitle>
                    <CardDescription>Most frequently hit segments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      {topSegments.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={topSegments} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" className="text-muted-foreground" />
                            <YAxis 
                              type="category" 
                              dataKey="segment" 
                              className="text-muted-foreground"
                              width={60}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                              formatter={(value: number) => [`${value} hits`, 'Count']}
                            />
                            <Bar 
                              dataKey="count" 
                              fill="hsl(var(--primary))" 
                              radius={[0, 4, 4, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                          No segment data
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Performance Profile Radar */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Profile</CardTitle>
                  <CardDescription>Compared to other players in the group</CardDescription>
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
                        Need more data for comparison
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Player Progress Over Time */}
              {selectedPlayer.turnsOverTime.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Progress Over Time</CardTitle>
                    <CardDescription>Monthly average turn score</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedPlayer.turnsOverTime.map(t => ({
                          ...t,
                          month: formatMonth(t.month),
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="month" 
                            className="text-muted-foreground"
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis 
                            className="text-muted-foreground"
                            domain={['dataMin - 10', 'dataMax + 10']}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                            formatter={(value: number, name: string, props: any) => [
                              `${value} (${props.payload.count} turns)`,
                              'Avg Score'
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey="avgScore"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
          
          {!selectedPlayer && (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">
                  Select a player above to view their detailed dart statistics
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[parseInt(m, 10) - 1]} ${year.slice(2)}`;
}

export default DartsAnalytics;

