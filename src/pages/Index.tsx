
import { usePlayers } from '@/hooks/usePlayers';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { AddPlayerForm } from '@/components/AddPlayerForm';
import { RecordMatchForm } from '@/components/RecordMatchForm';
import { RecordMultiPlayerMatchForm } from '@/components/RecordMultiPlayerMatchForm';
import { RecentMatches } from '@/components/RecentMatches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, Users, Trophy } from 'lucide-react';

const Index = () => {
  const { data: players = [], isLoading } = usePlayers();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Target className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-xl text-muted-foreground">Loading EloMondo...</p>
        </div>
      </div>
    );
  }

  const totalMatches = players.reduce((sum, player) => sum + player.matches_played, 0) / 2;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center justify-center gap-3">
            <Target className="h-10 w-10 text-primary" />
            EloMondo
          </h1>
          <p className="text-xl text-muted-foreground">
            Track your dart games with Elo ratings
          </p>
        </div>

        {/* Mobile Priority Content - Forms and Leaderboard */}
        <div className="block lg:hidden space-y-6 mb-8">
          {/* Leaderboard First on Mobile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              {players.length > 0 ? (
                <LeaderboardTable players={players} />
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

          {/* Forms Second on Mobile */}
          <div className="space-y-6">
            <Tabs defaultValue="1v1" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="1v1">1v1 Match</TabsTrigger>
                <TabsTrigger value="multiplayer">Multi-Player</TabsTrigger>
              </TabsList>
              <TabsContent value="1v1">
                <RecordMatchForm />
              </TabsContent>
              <TabsContent value="multiplayer">
                <RecordMultiPlayerMatchForm />
              </TabsContent>
            </Tabs>
            <AddPlayerForm />
          </div>

          {/* Recent Matches on Mobile */}
          <RecentMatches />
        </div>

        {/* Stats Cards - Lower Priority on Mobile */}
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
                {players.length > 0 ? players[0].name : 'None yet'}
              </div>
              {players.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {players[0].elo_rating} Elo
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Desktop Layout - Hidden on Mobile */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-8">
          {/* Left Column - Forms */}
          <div className="space-y-6">
            <AddPlayerForm />
            <Tabs defaultValue="1v1" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="1v1">1v1 Match</TabsTrigger>
                <TabsTrigger value="multiplayer">Multi-Player</TabsTrigger>
              </TabsList>
              <TabsContent value="1v1">
                <RecordMatchForm />
              </TabsContent>
              <TabsContent value="multiplayer">
                <RecordMultiPlayerMatchForm />
              </TabsContent>
            </Tabs>
          </div>

          {/* Middle Column - Leaderboard */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Leaderboard
                </CardTitle>
              </CardHeader>
              <CardContent>
                {players.length > 0 ? (
                  <LeaderboardTable players={players} />
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

            <RecentMatches />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
