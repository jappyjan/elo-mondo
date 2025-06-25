
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
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-green-600">
                      {match.winner.name}
                    </span>
                    <span className="text-muted-foreground">defeated</span>
                    <span className="font-semibold text-red-600">
                      {match.loser.name}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(match.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
              
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
