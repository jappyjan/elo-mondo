
import { CalculatedPlayer } from '@/types/darts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface LeaderboardTableProps {
  players: CalculatedPlayer[];
}

export function LeaderboardTable({ players }: LeaderboardTableProps) {
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

  const getWinRate = (wins: number, matchesPlayed: number) => {
    if (matchesPlayed === 0) return 0;
    return Math.round((wins / matchesPlayed) * 100);
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
          {players.map((player, index) => (
            <TableRow key={player.playerId}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {getRankIcon(index + 1)}
                  #{index + 1}
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
                        {player.decayApplied > 0 && (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-sm">
                        <p>Raw Elo: {player.rawElo}</p>
                        {player.decayApplied > 0 && (
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
                <Badge variant={getWinRate(player.wins, player.matchesPlayed) >= 50 ? "default" : "secondary"}>
                  {getWinRate(player.wins, player.matchesPlayed)}%
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
