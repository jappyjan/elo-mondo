import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlayerGameState } from '@/types/liveGame';
import { Trophy, Save, RotateCcw, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRecordMultiPlayerMatch } from '@/hooks/useRecordMultiPlayerMatch';
import { useState } from 'react';
import { toast } from '@/components/ui/use-toast';

interface GameResultsProps {
  playerStates: Record<string, PlayerGameState>;
  onNewGame: () => void;
  onReset: () => void;
}

export function GameResults({ playerStates, onNewGame, onReset }: GameResultsProps) {
  const navigate = useNavigate();
  const recordMatch = useRecordMultiPlayerMatch();
  const [isSaved, setIsSaved] = useState(false);

  const rankings = Object.values(playerStates)
    .filter((ps) => ps.finishedRank !== null)
    .sort((a, b) => (a.finishedRank || 0) - (b.finishedRank || 0));

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const handleSaveToElo = async () => {
    // Filter out temporary players
    const eligiblePlayers = rankings.filter(
      (ps) => !ps.playerId.startsWith('temp-')
    );

    if (eligiblePlayers.length < 2) {
      toast({
        title: 'Cannot Save',
        description: 'Need at least 2 registered players to save match to ELO rankings.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await recordMatch.mutateAsync({
        playerRankings: eligiblePlayers.map((ps) => ({
          playerId: ps.playerId,
          rank: ps.finishedRank!,
        })),
      });
      setIsSaved(true);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const hasEligiblePlayers = rankings.filter(
    (ps) => !ps.playerId.startsWith('temp-')
  ).length >= 2;

  return (
    <Card className="border-2 border-primary">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <Trophy className="h-12 w-12 text-yellow-500" />
        </div>
        <CardTitle className="text-2xl">Game Complete!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rankings */}
        <div className="space-y-2">
          {rankings.map((ps) => (
            <div
              key={ps.playerId}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getRankIcon(ps.finishedRank!)}</span>
                <div>
                  <div className="font-bold">{ps.playerName}</div>
                  {ps.playerId.startsWith('temp-') && (
                    <div className="text-xs text-muted-foreground">Temporary Player</div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">
                  {ps.turnHistory.length} turns
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {hasEligiblePlayers && !isSaved && (
            <Button
              onClick={handleSaveToElo}
              disabled={recordMatch.isPending}
              className="w-full"
              size="lg"
            >
              <Save className="h-4 w-4 mr-2" />
              {recordMatch.isPending ? 'Saving...' : 'Save to ELO Rankings'}
            </Button>
          )}

          {isSaved && (
            <div className="text-center text-sm text-muted-foreground py-2">
              ✓ Match saved to ELO rankings
            </div>
          )}

          {!hasEligiblePlayers && (
            <div className="text-center text-sm text-muted-foreground py-2">
              No registered players to save ELO for
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onNewGame}>
              <RotateCcw className="h-4 w-4 mr-2" />
              New Game
            </Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
