
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { usePlayers } from '@/hooks/usePlayers';
import { useRecordMultiPlayerMatch } from '@/hooks/useMatches';
import { Users, X, Trophy, Medal, Award } from 'lucide-react';
import { PlayerRanking } from '@/types/darts';

export function RecordMultiPlayerMatchForm() {
  const [playerRankings, setPlayerRankings] = useState<PlayerRanking[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [selectedRank, setSelectedRank] = useState('');
  
  const { data: players = [] } = usePlayers();
  const recordMatchMutation = useRecordMultiPlayerMatch();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerRankings.length >= 2 && hasValidRankings()) {
      recordMatchMutation.mutate({ playerRankings });
      setPlayerRankings([]);
      setSelectedPlayerId('');
      setSelectedRank('');
    }
  };

  const handleAddPlayer = () => {
    if (selectedPlayerId && selectedRank) {
      const rank = parseInt(selectedRank);
      if (!playerRankings.some(pr => pr.playerId === selectedPlayerId) &&
          !playerRankings.some(pr => pr.rank === rank)) {
        setPlayerRankings([...playerRankings, { 
          playerId: selectedPlayerId, 
          rank 
        }]);
        setSelectedPlayerId('');
        setSelectedRank('');
      }
    }
  };

  const handleRemovePlayer = (playerIdToRemove: string) => {
    setPlayerRankings(playerRankings.filter(pr => pr.playerId !== playerIdToRemove));
  };

  const hasValidRankings = () => {
    if (playerRankings.length < 2) return false;
    
    // Check if ranks are consecutive starting from 1
    const ranks = playerRankings.map(pr => pr.rank).sort((a, b) => a - b);
    for (let i = 0; i < ranks.length; i++) {
      if (ranks[i] !== i + 1) return false;
    }
    return true;
  };

  const availablePlayers = players.filter(p => 
    !playerRankings.some(pr => pr.playerId === p.id)
  );

  const usedRanks = playerRankings.map(pr => pr.rank);
  const availableRanks = Array.from(
    { length: Math.max(players.length, playerRankings.length + 5) }, 
    (_, i) => i + 1
  ).filter(rank => !usedRanks.includes(rank));

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 2: return <Medal className="h-4 w-4 text-gray-400" />;
      case 3: return <Award className="h-4 w-4 text-amber-600" />;
      default: return <span className="text-xs font-bold">#{rank}</span>;
    }
  };

  const sortedPlayerRankings = [...playerRankings].sort((a, b) => a.rank - b.rank);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Record Multi-Player Match (With Rankings)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="player">Add Player</Label>
              <Select value={selectedPlayerId} onValueChange={setSelectedPlayerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select player" />
                </SelectTrigger>
                <SelectContent>
                  {availablePlayers.map(player => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.name} ({player.elo_rating})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="rank">Rank (Position)</Label>
              <Select value={selectedRank} onValueChange={setSelectedRank}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rank" />
                </SelectTrigger>
                <SelectContent>
                  {availableRanks.slice(0, 10).map(rank => (
                    <SelectItem key={rank} value={rank.toString()}>
                      {rank === 1 ? '1st Place' : 
                       rank === 2 ? '2nd Place' : 
                       rank === 3 ? '3rd Place' : 
                       `${rank}th Place`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            type="button" 
            onClick={handleAddPlayer}
            disabled={!selectedPlayerId || !selectedRank}
            className="w-full"
            variant="outline"
          >
            Add Player to Match
          </Button>

          {sortedPlayerRankings.length > 0 && (
            <div>
              <Label>Match Results ({sortedPlayerRankings.length} players)</Label>
              <div className="space-y-2 mt-2">
                {sortedPlayerRankings.map(pr => {
                  const player = players.find(p => p.id === pr.playerId);
                  return (
                    <div key={pr.playerId} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getRankIcon(pr.rank)}
                        <div>
                          <div className="font-semibold">{player?.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Current Elo: {player?.elo_rating}
                          </div>
                        </div>
                      </div>
                      <X 
                        className="h-4 w-4 cursor-pointer hover:text-red-500" 
                        onClick={() => handleRemovePlayer(pr.playerId)}
                      />
                    </div>
                  );
                })}
              </div>
              
              {!hasValidRankings() && playerRankings.length >= 2 && (
                <div className="text-sm text-red-600 mt-2">
                  Rankings must be consecutive starting from 1st place
                </div>
              )}
            </div>
          )}
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={
              !hasValidRankings() || 
              playerRankings.length < 2 || 
              recordMatchMutation.isPending
            }
          >
            {recordMatchMutation.isPending ? 'Recording...' : 
              `Record ${playerRankings.length}-Player Match`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
