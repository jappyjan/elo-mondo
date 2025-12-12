import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { usePlayers } from '@/hooks/usePlayers';
import { GamePlayer, GameSettings, GameType, StartRule, EndRule } from '@/types/liveGame';
import { Plus, Shuffle, GripVertical, X, Users, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

const RULES_STORAGE_KEY = 'elomondo-game-rules';

interface SavedRules {
  gameType: GameType;
  startRule: StartRule;
  endRule: EndRule;
}

const loadSavedRules = (): SavedRules => {
  try {
    const stored = localStorage.getItem(RULES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return { gameType: '501', startRule: 'straight-in', endRule: 'double-out' };
};

interface GameSetupProps {
  onStartGame: (settings: GameSettings) => void;
}

export function GameSetup({ onStartGame }: GameSetupProps) {
  const { data: existingPlayers = [] } = usePlayers();
  
  const savedRules = loadSavedRules();
  
  const [gameType, setGameType] = useState<GameType>(savedRules.gameType);
  const [startRule, setStartRule] = useState<StartRule>(savedRules.startRule);
  const [endRule, setEndRule] = useState<EndRule>(savedRules.endRule);
  const [selectedPlayers, setSelectedPlayers] = useState<GamePlayer[]>([]);
  const [tempPlayerName, setTempPlayerName] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Persist rules to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify({ gameType, startRule, endRule }));
  }, [gameType, startRule, endRule]);

  const handleSelectPlayer = (playerId: string) => {
    const player = existingPlayers.find(p => p.id === playerId);
    if (player && !selectedPlayers.find(p => p.id === player.id)) {
      setSelectedPlayers(prev => [...prev, { id: player.id, name: player.name }]);
    }
  };

  const handleAddTempPlayer = () => {
    if (tempPlayerName.trim()) {
      const tempId = `temp-${Date.now()}`;
      setSelectedPlayers(prev => [
        ...prev,
        { id: tempId, name: tempPlayerName.trim(), isTemporary: true }
      ]);
      setTempPlayerName('');
    }
  };

  const handleRemovePlayer = (playerId: string) => {
    setSelectedPlayers(prev => prev.filter(p => p.id !== playerId));
  };

  const handleShuffle = () => {
    setSelectedPlayers(prev => [...prev].sort(() => Math.random() - 0.5));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newOrder = [...selectedPlayers];
    const draggedItem = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, draggedItem);
    setSelectedPlayers(newOrder);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleStartGame = () => {
    if (selectedPlayers.length < 2) return;
    
    onStartGame({
      gameType,
      startRule,
      endRule,
      players: selectedPlayers,
    });
  };

  const availablePlayers = existingPlayers.filter(
    p => !selectedPlayers.find(sp => sp.id === p.id)
  );

  return (
    <div className="space-y-6">
      {/* Game Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Game Type</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={gameType}
            onValueChange={(v) => setGameType(v as GameType)}
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="301" id="301" />
              <Label htmlFor="301" className="text-lg font-bold cursor-pointer">301</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="501" id="501" />
              <Label htmlFor="501" className="text-lg font-bold cursor-pointer">501</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Rules Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Game Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground">Start Rule</Label>
            <RadioGroup
              value={startRule}
              onValueChange={(v) => setStartRule(v as StartRule)}
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="straight-in" id="straight-in" />
                <Label htmlFor="straight-in" className="cursor-pointer">Straight In</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="double-in" id="double-in" />
                <Label htmlFor="double-in" className="cursor-pointer">Double In</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label className="text-sm text-muted-foreground">End Rule</Label>
            <RadioGroup
              value={endRule}
              onValueChange={(v) => setEndRule(v as EndRule)}
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="straight-out" id="straight-out" />
                <Label htmlFor="straight-out" className="cursor-pointer">Straight Out</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="double-out" id="double-out" />
                <Label htmlFor="double-out" className="cursor-pointer">Double Out</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Player Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Players ({selectedPlayers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Select from existing players */}
          {availablePlayers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Select Existing Players</Label>
              <div className="flex flex-wrap gap-2">
                {availablePlayers.map((player) => (
                  <Button
                    key={player.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectPlayer(player.id)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {player.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Add temporary player */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Add Temporary Player</Label>
            <div className="flex gap-2">
              <Input
                value={tempPlayerName}
                onChange={(e) => setTempPlayerName(e.target.value)}
                placeholder="Player name"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTempPlayer()}
              />
              <Button onClick={handleAddTempPlayer} disabled={!tempPlayerName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Selected players with drag-to-reorder */}
          {selectedPlayers.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">Throwing Order (drag to reorder)</Label>
                <Button variant="ghost" size="sm" onClick={handleShuffle}>
                  <Shuffle className="h-4 w-4 mr-1" />
                  Shuffle
                </Button>
              </div>
              <div className="space-y-1">
                {selectedPlayers.map((player, index) => (
                  <div
                    key={player.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-md border bg-card transition-colors cursor-grab active:cursor-grabbing",
                      draggedIndex === index && "opacity-50"
                    )}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                      {index + 1}
                    </span>
                    <span className="flex-1 font-medium">
                      {player.name}
                      {player.isTemporary && (
                        <span className="text-xs text-muted-foreground ml-2">(temp)</span>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePlayer(player.id)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Start Game Button */}
      <Button
        onClick={handleStartGame}
        disabled={selectedPlayers.length < 2}
        className="w-full h-14 text-lg"
        size="lg"
      >
        <Play className="h-5 w-5 mr-2" />
        Start Game ({gameType} - {startRule === 'double-in' ? 'DI' : 'SI'}/{endRule === 'double-out' ? 'DO' : 'SO'})
      </Button>
    </div>
  );
}
