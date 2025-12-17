import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalculatedPlayer, MatchHistoryEntry } from '@/types/darts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ZAxis,
  Cell,
} from 'recharts';

interface HeadToHeadProps {
  players: CalculatedPlayer[];
  matchHistory: MatchHistoryEntry[];
}

interface H2HRecord {
  playerId: string;
  playerName: string;
  opponentId: string;
  opponentName: string;
  wins: number;
  losses: number;
  totalGames: number;
  winRate: number;
}

const HeadToHead = ({ players, matchHistory }: HeadToHeadProps) => {
  const [selectedPlayer1, setSelectedPlayer1] = useState<string>('');
  const [selectedPlayer2, setSelectedPlayer2] = useState<string>('');

  // Build H2H matrix
  const h2hMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, { wins: number; losses: number }>> = {};

    // Initialize matrix
    players.forEach(p1 => {
      matrix[p1.playerId] = {};
      players.forEach(p2 => {
        if (p1.playerId !== p2.playerId) {
          matrix[p1.playerId][p2.playerId] = { wins: 0, losses: 0 };
        }
      });
    });

    // Fill matrix from match history
    matchHistory.forEach(match => {
      const results = match.results.sort((a, b) => {
        // Lower rank change = winner
        if (a.eloChange > 0 && b.eloChange <= 0) return -1;
        if (a.eloChange <= 0 && b.eloChange > 0) return 1;
        return b.eloChange - a.eloChange;
      });

      // For each pair of players in the match
      for (let i = 0; i < results.length; i++) {
        for (let j = i + 1; j < results.length; j++) {
          const winner = results[i];
          const loser = results[j];
          
          if (matrix[winner.playerId]?.[loser.playerId]) {
            matrix[winner.playerId][loser.playerId].wins++;
          }
          if (matrix[loser.playerId]?.[winner.playerId]) {
            matrix[loser.playerId][winner.playerId].losses++;
          }
        }
      }
    });

    return matrix;
  }, [players, matchHistory]);

  // Get all H2H records for heatmap
  const h2hRecords = useMemo(() => {
    const records: H2HRecord[] = [];
    
    players.forEach(p1 => {
      players.forEach(p2 => {
        if (p1.playerId !== p2.playerId && h2hMatrix[p1.playerId]?.[p2.playerId]) {
          const record = h2hMatrix[p1.playerId][p2.playerId];
          const total = record.wins + record.losses;
          if (total > 0) {
            records.push({
              playerId: p1.playerId,
              playerName: p1.playerName,
              opponentId: p2.playerId,
              opponentName: p2.playerName,
              wins: record.wins,
              losses: record.losses,
              totalGames: total,
              winRate: record.wins / total,
            });
          }
        }
      });
    });

    return records;
  }, [players, h2hMatrix]);

  // Specific H2H comparison
  const specificH2H = useMemo(() => {
    if (!selectedPlayer1 || !selectedPlayer2 || selectedPlayer1 === selectedPlayer2) {
      return null;
    }

    const player1 = players.find(p => p.playerId === selectedPlayer1);
    const player2 = players.find(p => p.playerId === selectedPlayer2);
    
    if (!player1 || !player2) return null;

    const p1vsP2 = h2hMatrix[selectedPlayer1]?.[selectedPlayer2] || { wins: 0, losses: 0 };
    
    // Get match history between these two
    const matchesBetween = matchHistory.filter(m => {
      const playerIds = m.results.map(r => r.playerId);
      return playerIds.includes(selectedPlayer1) && playerIds.includes(selectedPlayer2);
    });

    return {
      player1,
      player2,
      p1Wins: p1vsP2.wins,
      p2Wins: p1vsP2.losses,
      totalGames: p1vsP2.wins + p1vsP2.losses,
      matches: matchesBetween,
    };
  }, [selectedPlayer1, selectedPlayer2, players, h2hMatrix, matchHistory]);

  // Scatter data for Elo change vs opponent strength
  const scatterData = useMemo(() => {
    if (!selectedPlayer1) return [];

    const data: { opponentElo: number; eloChange: number; opponent: string; date: string }[] = [];

    matchHistory.forEach(match => {
      const playerResult = match.results.find(r => r.playerId === selectedPlayer1);
      if (!playerResult) return;

      // Get opponents
      match.results
        .filter(r => r.playerId !== selectedPlayer1)
        .forEach(opponent => {
          const opponentPlayer = players.find(p => p.playerId === opponent.playerId);
          data.push({
            opponentElo: opponent.eloBefore,
            eloChange: playerResult.eloChange,
            opponent: opponentPlayer?.playerName || 'Unknown',
            date: new Date(match.matchDate).toLocaleDateString(),
          });
        });
    });

    return data;
  }, [selectedPlayer1, matchHistory, players]);

  // Count matches for selected player
  const playerMatchCount = useMemo(() => {
    if (!selectedPlayer1) return 0;
    return matchHistory.filter(m => 
      m.results.some(r => r.playerId === selectedPlayer1)
    ).length;
  }, [selectedPlayer1, matchHistory]);

  // Get unique players sorted by name
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => a.playerName.localeCompare(b.playerName));
  }, [players]);

  // Heatmap grid
  const heatmapPlayers = useMemo(() => {
    return players.filter(p => p.matchesPlayed >= 3).slice(0, 10);
  }, [players]);

  const getHeatmapColor = (winRate: number | null) => {
    if (winRate === null) return 'bg-muted';
    if (winRate >= 0.7) return 'bg-green-500';
    if (winRate >= 0.5) return 'bg-green-300 dark:bg-green-700';
    if (winRate >= 0.3) return 'bg-red-300 dark:bg-red-700';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Player Comparison Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Head-to-Head Comparison</CardTitle>
          <CardDescription>Compare two players directly</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedPlayer1} onValueChange={setSelectedPlayer1}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select Player 1" />
              </SelectTrigger>
              <SelectContent>
                {sortedPlayers.map(player => (
                  <SelectItem key={player.playerId} value={player.playerId}>
                    {player.playerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-center text-muted-foreground self-center">vs</span>

            <Select value={selectedPlayer2} onValueChange={setSelectedPlayer2}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select Player 2" />
              </SelectTrigger>
              <SelectContent>
                {sortedPlayers
                  .filter(p => p.playerId !== selectedPlayer1)
                  .map(player => (
                    <SelectItem key={player.playerId} value={player.playerId}>
                      {player.playerName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Specific H2H Result */}
      {specificH2H && specificH2H.totalGames > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <p className="text-2xl font-bold">{specificH2H.player1.playerName}</p>
                <p className="text-sm text-muted-foreground">{specificH2H.player1.currentElo} Elo</p>
              </div>
              
              <div className="text-center px-8">
                <div className="flex items-center gap-4 text-4xl font-bold">
                  <span className={specificH2H.p1Wins > specificH2H.p2Wins ? 'text-green-500' : ''}>
                    {specificH2H.p1Wins}
                  </span>
                  <span className="text-muted-foreground">-</span>
                  <span className={specificH2H.p2Wins > specificH2H.p1Wins ? 'text-green-500' : ''}>
                    {specificH2H.p2Wins}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {specificH2H.totalGames} games played
                </p>
              </div>

              <div className="text-center flex-1">
                <p className="text-2xl font-bold">{specificH2H.player2.playerName}</p>
                <p className="text-sm text-muted-foreground">{specificH2H.player2.currentElo} Elo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {specificH2H && specificH2H.totalGames === 0 && (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              These players haven't played against each other yet
            </p>
          </CardContent>
        </Card>
      )}

      {/* H2H Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Win Rate Heatmap</CardTitle>
          <CardDescription>
            Head-to-head win rates (row player vs column player)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {heatmapPlayers.length >= 2 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left"></th>
                    {heatmapPlayers.map(p => (
                      <th key={p.playerId} className="p-2 text-center min-w-[60px]">
                        <div className="truncate max-w-[60px]" title={p.playerName}>
                          {p.playerName.slice(0, 6)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapPlayers.map(p1 => (
                    <tr key={p1.playerId}>
                      <td className="p-2 font-medium truncate max-w-[80px]" title={p1.playerName}>
                        {p1.playerName}
                      </td>
                      {heatmapPlayers.map(p2 => {
                        if (p1.playerId === p2.playerId) {
                          return (
                            <td key={p2.playerId} className="p-1">
                              <div className="w-full h-10 bg-muted rounded flex items-center justify-center text-muted-foreground">
                                -
                              </div>
                            </td>
                          );
                        }

                        const record = h2hMatrix[p1.playerId]?.[p2.playerId];
                        const total = record ? record.wins + record.losses : 0;
                        const winRate = total > 0 ? record.wins / total : null;

                        return (
                          <td key={p2.playerId} className="p-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div 
                                  className={`
                                    w-full h-10 rounded flex items-center justify-center 
                                    text-xs font-medium cursor-default
                                    ${getHeatmapColor(winRate)}
                                    ${winRate !== null ? 'text-white' : ''}
                                  `}
                                >
                                  {total > 0 ? `${record.wins}-${record.losses}` : '-'}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{p1.playerName} vs {p2.playerName}</p>
                                <p>{record?.wins || 0} wins, {record?.losses || 0} losses</p>
                                {winRate !== null && (
                                  <p>Win rate: {(winRate * 100).toFixed(0)}%</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Need more players with games to show heatmap
            </p>
          )}
          
          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>70%+</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-green-300 dark:bg-green-700 rounded"></div>
              <span>50-70%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-red-300 dark:bg-red-700 rounded"></div>
              <span>30-50%</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>&lt;30%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Elo Change vs Opponent Strength */}
      {selectedPlayer1 && (
        <Card>
          <CardHeader>
            <CardTitle>Elo Change vs Opponent Strength</CardTitle>
            <CardDescription>
              How {players.find(p => p.playerId === selectedPlayer1)?.playerName} performs against different skill levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {scatterData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="opponentElo" 
                      name="Opponent Elo"
                      type="number"
                      domain={['dataMin - 50', 'dataMax + 50']}
                      label={{ value: 'Opponent Elo', position: 'bottom', offset: 0 }}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      dataKey="eloChange" 
                      name="Elo Change"
                      domain={['dataMin - 5', 'dataMax + 5']}
                      label={{ value: 'Elo Change', angle: -90, position: 'left' }}
                      className="text-muted-foreground"
                    />
                    <ZAxis range={[50, 50]} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string) => [value, name]}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          return `vs ${payload[0].payload.opponent} (${payload[0].payload.date})`;
                        }
                        return '';
                      }}
                    />
                    <Scatter dataKey="eloChange">
                      {scatterData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.eloChange > 0 ? 'hsl(142, 76%, 36%)' : 'hsl(var(--destructive))'}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <p>No match data found for this player</p>
                  <p className="text-xs">
                    Found {playerMatchCount} matches in history
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default HeadToHead;
