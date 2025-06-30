
import { useMatches } from '@/hooks/useMatches';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, TrendingUp, TrendingDown } from 'lucide-react';
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
              <div className="flex items-center gap-3">
                <div className="text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-green-600">
                      {match.winner.name}
                    </span>
                    <span className="text-muted-foreground">defeated</span>
                    {match.match_type === 'multiplayer' && match.participants ? (
                      <span className="font-semibold text-red-600">
                        {match.participants
                          .filter(p => !p.is_winner)
                          .map(p => p.player.name)
                          .join(', ')}
                      </span>
                    ) : (
                      <span className="font-semibold text-red-600">
                        {match.loser.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span>
                      {formatDistanceToNow(new Date(match.created_at), { addSuffix: true })}
                    </span>
                    {match.match_type === 'multiplayer' && (
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        {match.total_players}P
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {match.match_type === 'multiplayer' && match.participants ? (
                  <>
                    {/* Winner Elo */}
                    <div className="text-xs text-center">
                      <div className="flex items-center gap-1 text-green-600">
                        <TrendingUp className="h-3 w-3" />
                        <span>{match.participants.find(p => p.is_winner)?.elo_after}</span>
                      </div>
                      <div className="text-muted-foreground">
                        (+{match.participants.find(p => p.is_winner)?.elo_change})
                      </div>
                    </div>
                    
                    {/* Losers Elo - show average or range */}
                    <div className="text-xs text-center">
                      <div className="flex items-center gap-1 text-red-600">
                        <TrendingDown className="h-3 w-3" />
                        <span>
                          {Math.round(
                            match.participants
                              .filter(p => !p.is_winner)
                              .reduce((sum, p) => sum + p.elo_after, 0) / 
                            match.participants.filter(p => !p.is_winner).length
                          )}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        (avg)
                      </div>
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
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
