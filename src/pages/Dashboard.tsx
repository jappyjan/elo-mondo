
import { useState } from 'react';
import { useCalculatedPlayers } from '@/hooks/usePlayers';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { EloProgressionChart } from '@/components/EloProgressionChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Target, Users, Trophy, Clock } from 'lucide-react';

const Dashboard = () => {
  const [decayEnabled, setDecayEnabled] = useState(true);
  const { data: eloData, isLoading, error } = useCalculatedPlayers(decayEnabled);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Target className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-xl text-muted-foreground">Calculating Elo ratings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center text-destructive">
          <p className="text-xl">Error loading data</p>
          <p className="text-sm">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  const players = eloData?.players || [];
  const matchHistory = eloData?.matchHistory || [];
  const totalMatches = players.reduce((sum, player) => sum + player.matchesPlayed, 0) / 2;
  const topPlayer = players[0];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your dart league performance
        </p>
        
        {/* Decay Toggle */}
        <div className="flex items-center justify-center gap-3 mt-4 p-3 bg-muted/50 rounded-lg max-w-md mx-auto">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="decay-toggle" className="text-sm cursor-pointer">
            Inactivity Decay
          </Label>
          <Switch
            id="decay-toggle"
            checked={decayEnabled}
            onCheckedChange={setDecayEnabled}
          />
          <span className="text-xs text-muted-foreground">
            {decayEnabled ? 'ON' : 'OFF'}
          </span>
        </div>
        {decayEnabled && (
          <p className="text-xs text-muted-foreground mt-2">
            Elo decays towards 1000 after ~3 months of inactivity
          </p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{players.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.floor(totalMatches)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Player</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {topPlayer ? topPlayer.playerName : 'None yet'}
            </div>
            {topPlayer && (
              <p className="text-xs text-muted-foreground">
                {topPlayer.currentElo} Elo
                {decayEnabled && topPlayer.decayApplied > 0 && ` (-${topPlayer.decayApplied} decay)`}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Leaderboard
              {!decayEnabled && (
                <span className="text-xs font-normal text-muted-foreground">(Raw Elo)</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {players.length > 0 ? (
              <LeaderboardTable players={players} showDecay={decayEnabled} />
            ) : (
              <div className="text-center py-8">
                <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No players yet</h3>
                <p className="text-muted-foreground">
                  Add your first player to get started!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Elo Progression Chart */}
      <EloProgressionChart matchHistory={matchHistory} players={players} />
    </div>
  );
};

export default Dashboard;
