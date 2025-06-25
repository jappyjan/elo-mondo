
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { usePlayers } from '@/hooks/usePlayers';
import { useRecordMultiPlayerMatch } from '@/hooks/useMatches';
import { Users, X } from 'lucide-react';

export function RecordMultiPlayerMatchForm() {
  const [winnerId, setWinnerId] = useState('');
  const [loserIds, setLoserIds] = useState<string[]>([]);
  
  const { data: players = [] } = usePlayers();
  const recordMatchMutation = useRecordMultiPlayerMatch();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (winnerId && loserIds.length > 0 && !loserIds.includes(winnerId)) {
      recordMatchMutation.mutate({ winnerId, loserIds });
      setWinnerId('');
      setLoserIds([]);
    }
  };

  const handleAddLoser = (loserId: string) => {
    if (loserId && !loserIds.includes(loserId) && loserId !== winnerId) {
      setLoserIds([...loserIds, loserId]);
    }
  };

  const handleRemoveLoser = (loserIdToRemove: string) => {
    setLoserIds(loserIds.filter(id => id !== loserIdToRemove));
  };

  const availableWinners = players.filter(p => !loserIds.includes(p.id));
  const availableLosers = players.filter(p => p.id !== winnerId && !loserIds.includes(p.id));
  const selectedLosers = players.filter(p => loserIds.includes(p.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Record Multi-Player Match
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="winner">Winner</Label>
            <Select value={winnerId} onValueChange={setWinnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select winner" />
              </SelectTrigger>
              <SelectContent>
                {availableWinners.map(player => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.name} ({player.elo_rating})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="losers">Add Losers</Label>
            <Select value="" onValueChange={handleAddLoser}>
              <SelectTrigger>
                <SelectValue placeholder="Select losers to add" />
              </SelectTrigger>
              <SelectContent>
                {availableLosers.map(player => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.name} ({player.elo_rating})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedLosers.length > 0 && (
            <div>
              <Label>Selected Losers ({selectedLosers.length})</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedLosers.map(loser => (
                  <Badge 
                    key={loser.id} 
                    variant="secondary" 
                    className="flex items-center gap-1"
                  >
                    {loser.name} ({loser.elo_rating})
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-red-500" 
                      onClick={() => handleRemoveLoser(loser.id)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={
              !winnerId || 
              loserIds.length === 0 || 
              loserIds.includes(winnerId) || 
              recordMatchMutation.isPending
            }
          >
            {recordMatchMutation.isPending ? 'Recording...' : `Record Match (1 vs ${loserIds.length})`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
