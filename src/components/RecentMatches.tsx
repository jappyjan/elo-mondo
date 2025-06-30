
import { useMatches } from '@/hooks/useMatches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, TrendingUp, TrendingDown, Trophy, Medal, Award } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function RecentMatches() {
  const { data: matches = [], isLoading } = useMatches();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Matches
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Loading matches...</p>
        </CardContent>
      </Card>
    );
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="h-3 w-3 text-yellow-500" />;
      case 2: return <Medal className="h-3 w-3 text-gray-400" />;
      case 3: return <Award className="h-3 w-3 text-amber-600" />;
      default: return <span className="text-xs">#{rank}</span>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Recent Matches
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {matches.slice(0, 10).map((match) => (
            <div
              key={match.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="text-sm flex-1">
                  {match.match_type === 'multiplayer' && match.participants ? (
                    <div>
                      <div className="font-semibold text-sm mb-2">
                        {match.total_players}-Player Match
                      </div>
                      <div className="space-y-1">
                        {match.participants
                          .sort((a, b) => a.rank - b.rank)
                          .map((participant, index) => (
                          <div key={participant.id} className="flex items-center gap-2 text-xs">
                            {getRankIcon(participant.rank)}
                            <span className={participant.is_winner ? 'text-green-600 font-semibold' : 'text-muted-foreground'}>
                              {participant.player.name}
                            </span>
                            <span className="text-muted-foreground">
                              {participant.elo_after} 
                              <span className={participant.elo_change >= 0 ? 'text-green-600' : 'text-red-600'}>
                                ({participant.elo_change >= 0 ? '+' : ''}{participant.elo_change})
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-green-600">
                        {match.winner.name}
                      </span>
                      <span className="text-muted-foreground">defeated</span>
                      <span className="font-semibold text-red-600">
                        {match.loser.name}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span>
                      {formatDistanceToNow(new Date(match.created_at), { addSuffix: true })}
                    </span>
                    <Badge variant="secondary" className="text-xs px-1 py-0">
                      {match.match_type === '1v1' ? '1v1' : `${match.total_players}P`}
                    </Badge>
                  </div>
                </div>
              </div>
              
              {match.match_type !== 'multiplayer' && (
                <div className="flex items-center gap-2">
                  <div className="text-xs text-center">
                    <div className="flex items-center gap-1 text-green-600">
                      <TrendingUp className="h-3 w-3" />
                      <span>{match.winner_elo_after}</span>
                    </div>
                    <div className="text-muted-foreground">
                      (+{match.elo_change})
                    </div>
                  </div>
                  
                  <div className="text-xs text-center">
                    <div className="flex items-center gap-1 text-red-600">
                      <TrendingDown className="h-3 w-3" />
                      <span>{match.loser_elo_after}</span>
                    </div>
                    <div className="text-muted-foreground">
                      (-{match.elo_change})
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {matches.length === 0 && (
            <p className="text-muted-foreground text-center py-4">
              No matches recorded yet
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
