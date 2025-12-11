
import { CalculatedPlayer } from '@/types/darts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const PROVISIONAL_THRESHOLD = 10;

interface LeaderboardTableProps {
  players: CalculatedPlayer[];
  showDecay?: boolean;
}

export function LeaderboardTable({ players, showDecay = true }: LeaderboardTableProps) {
  // Filter out provisional players (those with fewer matches than threshold)
  const qualifiedPlayers = players.filter(p => p.matchesPlayed >= PROVISIONAL_THRESHOLD);
  const provisionalCount = players.length - qualifiedPlayers.length;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Rank</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-center">Elo Rating</TableHead>
            <TableHead className="text-center">Matches</TableHead>
            <TableHead className="text-center">Wins</TableHead>
            <TableHead className="text-center">Losses</TableHead>
            <TableHead className="text-center">Win Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {qualifiedPlayers.map((player) => (
            <TableRow key={player.playerId}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {getRankIcon(player.rank)}
                  #{player.rank}
                </div>
              </TableCell>
              <TableCell className="font-semibold">{player.playerName}</TableCell>
              <TableCell className="text-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center gap-1">
                        <Badge variant="secondary" className="text-lg font-bold">
                          {player.currentElo}
                        </Badge>
                        {showDecay && player.decayApplied > 0 && (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">
                        <p>Raw Elo: {player.rawElo}</p>
                        {showDecay && player.decayApplied > 0 && (
                          <>
                            <p className="text-destructive">Decay: -{player.decayApplied}</p>
                            <p className="text-muted-foreground">
                              {player.daysSinceLastMatch} days since last match
                            </p>
                          </>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
              <TableCell className="text-center">{player.matchesPlayed}</TableCell>
              <TableCell className="text-center text-green-600 font-semibold">
                {player.wins}
              </TableCell>
              <TableCell className="text-center text-red-600 font-semibold">
                {player.losses}
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={player.winRate >= 0.5 ? "default" : "secondary"}>
                  {Math.round(player.winRate * 100)}%
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {provisionalCount > 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          {provisionalCount} player{provisionalCount !== 1 ? 's' : ''} hidden (fewer than {PROVISIONAL_THRESHOLD} matches played)
        </p>
      )}
    </div>
  );
}
