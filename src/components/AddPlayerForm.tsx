
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAddPlayer } from '@/hooks/usePlayers';
import { UserPlus } from 'lucide-react';

export function AddPlayerForm() {
  const [name, setName] = useState('');
  const addPlayerMutation = useAddPlayer();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      addPlayerMutation.mutate(name.trim());
      setName('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Add New Player
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="playerName" className="sr-only">
              Player Name
            </Label>
            <Input
              id="playerName"
              type="text"
              placeholder="Enter player name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={addPlayerMutation.isPending}
            />
          </div>
          <Button 
            type="submit" 
            disabled={!name.trim() || addPlayerMutation.isPending}
          >
            {addPlayerMutation.isPending ? 'Adding...' : 'Add Player'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
