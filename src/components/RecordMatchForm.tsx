
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePlayers } from '@/hooks/usePlayers';
import { useRecordMatch } from '@/hooks/useMatches';
import { Target } from 'lucide-react';

export function RecordMatchForm() {
  const [winnerId, setWinnerId] = useState('');
  const [loserId, setLoserId] = useState('');
  
  const { data: players = [] } = usePlayers();
  const recordMatchMutation = useRecordMatch();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (winnerId && loserId && winnerId !== loserId) {
      recordMatchMutation.mutate({ winnerId, loserId });
      setWinnerId('');
      setLoserId('');
    }
  };

  const availableWinners = players.filter(p => p.id !== loserId);
  const availableLosers = players.filter(p => p.id !== winnerId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Record Match Result
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="winner">Winner</Label>
              <Select value={winnerId} onValueChange={setWinnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select winner" />
                </SelectTrigger>
                <SelectContent>
                  {availableWinners.map(player => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="loser">Loser</Label>
              <Select value={loserId} onValueChange={setLoserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select loser" />
                </SelectTrigger>
                <SelectContent>
                  {availableLosers.map(player => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={
              !winnerId || 
              !loserId || 
              winnerId === loserId || 
              recordMatchMutation.isPending
            }
          >
            {recordMatchMutation.isPending ? 'Recording...' : 'Record Match'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
