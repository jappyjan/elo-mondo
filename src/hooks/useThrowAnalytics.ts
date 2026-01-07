import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ThrowData {
  id: string;
  game_id: string;
  game_player_id: string;
  turn_number: number;
  throw_index: number;
  segment: number;
  multiplier: number;
  score: number;
  label: string;
  created_at: string;
  player_id: string | null;
  player_name: string;
}

export interface PlayerThrowStats {
  playerId: string | null;
  playerName: string;
  totalThrows: number;
  t20Count: number;
  d20Count: number;
  s20Count: number;
  bullCount: number;
  doubleBullCount: number;
  outerBullCount: number;
  onesCount: number;
  doublesCount: number;
  triplesCount: number;
  singlesCount: number;
  count180s: number;
  count140Plus: number;
  count100Plus: number;
  count60Plus: number;
  totalTurns: number;
  avgTurnScore: number;
  bestTurn: number;
  longestT20Streak: number;
  longest100PlusStreak: number;
  segmentCounts: Record<number, number>;
  turnsOverTime: { month: string; avgScore: number; count: number }[];
}

export interface ThrowAnalytics {
  totalThrows: number;
  totalGames: number;
  total180s: number;
  avgTurnScore: number;
  playerStats: PlayerThrowStats[];
  turnScoreDistribution: { range: string; count: number }[];
  segmentHeatmap: { segment: string; count: number }[];
  records: {
    longestT20Streak: { player: string; count: number };
    longest100PlusStreak: { player: string; count: number };
    most180sInGame: { player: string; count: number; gameId: string };
    highestGameAverage: { player: string; average: number; gameId: string };
  };
}

function computeTurnScores(throws: ThrowData[]): Map<string, { playerId: string | null; playerName: string; turnNumber: number; gameId: string; scores: number[]; createdAt: string }> {
  const turns = new Map<string, { playerId: string | null; playerName: string; turnNumber: number; gameId: string; scores: number[]; createdAt: string }>();
  
  throws.forEach(t => {
    const key = `${t.game_player_id}-${t.turn_number}`;
    if (!turns.has(key)) {
      turns.set(key, {
        playerId: t.player_id,
        playerName: t.player_name,
        turnNumber: t.turn_number,
        gameId: t.game_id,
        scores: [],
        createdAt: t.created_at,
      });
    }
    const turn = turns.get(key)!;
    turn.scores[t.throw_index] = t.score;
  });
  
  return turns;
}

function computePlayerStats(throws: ThrowData[]): PlayerThrowStats[] {
  // Group throws by player
  const playerThrows = new Map<string, ThrowData[]>();
  
  throws.forEach(t => {
    const key = t.player_id || t.player_name;
    if (!playerThrows.has(key)) {
      playerThrows.set(key, []);
    }
    playerThrows.get(key)!.push(t);
  });
  
  const stats: PlayerThrowStats[] = [];
  
  playerThrows.forEach((playerData, key) => {
    const firstThrow = playerData[0];
    const segmentCounts: Record<number, number> = {};
    let t20Count = 0, d20Count = 0, s20Count = 0;
    let bullCount = 0, doubleBullCount = 0, outerBullCount = 0;
    let onesCount = 0;
    let doublesCount = 0, triplesCount = 0, singlesCount = 0;
    
    // Count throws by type
    playerData.forEach(t => {
      segmentCounts[t.segment] = (segmentCounts[t.segment] || 0) + 1;
      
      if (t.segment === 20) {
        if (t.multiplier === 3) t20Count++;
        else if (t.multiplier === 2) d20Count++;
        else s20Count++;
      }
      
      if (t.segment === 50) {
        doubleBullCount++;
        bullCount++;
      } else if (t.segment === 25) {
        outerBullCount++;
        bullCount++;
      }
      
      if (t.segment === 1 && t.multiplier === 1) onesCount++;
      
      if (t.multiplier === 1) singlesCount++;
      else if (t.multiplier === 2) doublesCount++;
      else if (t.multiplier === 3) triplesCount++;
    });
    
    // Compute turns for this player
    const playerTurns = computeTurnScores(playerData);
    const turnScores: number[] = [];
    let count180s = 0, count140Plus = 0, count100Plus = 0, count60Plus = 0;
    let bestTurn = 0;
    
    // Track turns by month for time series
    const monthlyTurns = new Map<string, { total: number; count: number }>();
    
    playerTurns.forEach(turn => {
      const total = turn.scores.reduce((a, b) => a + (b || 0), 0);
      turnScores.push(total);
      
      if (total > bestTurn) bestTurn = total;
      if (total === 180) count180s++;
      if (total >= 140) count140Plus++;
      if (total >= 100) count100Plus++;
      if (total >= 60) count60Plus++;
      
      // Group by month
      const month = turn.createdAt.substring(0, 7); // YYYY-MM
      if (!monthlyTurns.has(month)) {
        monthlyTurns.set(month, { total: 0, count: 0 });
      }
      const m = monthlyTurns.get(month)!;
      m.total += total;
      m.count++;
    });
    
    // Compute T20 streak
    let longestT20Streak = 0;
    let currentT20Streak = 0;
    const sortedThrows = [...playerData].sort((a, b) => 
      a.created_at.localeCompare(b.created_at)
    );
    
    sortedThrows.forEach(t => {
      if (t.segment === 20 && t.multiplier === 3) {
        currentT20Streak++;
        longestT20Streak = Math.max(longestT20Streak, currentT20Streak);
      } else {
        currentT20Streak = 0;
      }
    });
    
    // Compute 100+ turn streak
    let longest100PlusStreak = 0;
    let current100PlusStreak = 0;
    const sortedTurns = Array.from(playerTurns.values()).sort((a, b) => 
      a.createdAt.localeCompare(b.createdAt)
    );
    
    sortedTurns.forEach(turn => {
      const total = turn.scores.reduce((a, b) => a + (b || 0), 0);
      if (total >= 100) {
        current100PlusStreak++;
        longest100PlusStreak = Math.max(longest100PlusStreak, current100PlusStreak);
      } else {
        current100PlusStreak = 0;
      }
    });
    
    const totalTurns = turnScores.length;
    const avgTurnScore = totalTurns > 0 
      ? turnScores.reduce((a, b) => a + b, 0) / totalTurns 
      : 0;
    
    // Convert monthly data to array
    const turnsOverTime = Array.from(monthlyTurns.entries())
      .map(([month, data]) => ({
        month,
        avgScore: data.count > 0 ? Math.round(data.total / data.count * 10) / 10 : 0,
        count: data.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
    
    stats.push({
      playerId: firstThrow.player_id,
      playerName: firstThrow.player_name,
      totalThrows: playerData.length,
      t20Count,
      d20Count,
      s20Count,
      bullCount,
      doubleBullCount,
      outerBullCount,
      onesCount,
      doublesCount,
      triplesCount,
      singlesCount,
      count180s,
      count140Plus,
      count100Plus,
      count60Plus,
      totalTurns,
      avgTurnScore: Math.round(avgTurnScore * 10) / 10,
      bestTurn,
      longestT20Streak,
      longest100PlusStreak,
      segmentCounts,
      turnsOverTime,
    });
  });
  
  return stats.sort((a, b) => b.totalThrows - a.totalThrows);
}

function computeRecords(playerStats: PlayerThrowStats[], throws: ThrowData[]): ThrowAnalytics['records'] {
  let longestT20Streak = { player: '', count: 0 };
  let longest100PlusStreak = { player: '', count: 0 };
  let most180sInGame = { player: '', count: 0, gameId: '' };
  let highestGameAverage = { player: '', average: 0, gameId: '' };
  
  playerStats.forEach(p => {
    if (p.longestT20Streak > longestT20Streak.count) {
      longestT20Streak = { player: p.playerName, count: p.longestT20Streak };
    }
    if (p.longest100PlusStreak > longest100PlusStreak.count) {
      longest100PlusStreak = { player: p.playerName, count: p.longest100PlusStreak };
    }
  });
  
  // Group throws by game and player for game-specific records
  const gamePlayerThrows = new Map<string, ThrowData[]>();
  throws.forEach(t => {
    const key = `${t.game_id}-${t.game_player_id}`;
    if (!gamePlayerThrows.has(key)) {
      gamePlayerThrows.set(key, []);
    }
    gamePlayerThrows.get(key)!.push(t);
  });
  
  gamePlayerThrows.forEach((gameThrows, key) => {
    const [gameId] = key.split('-');
    const playerName = gameThrows[0].player_name;
    const turns = computeTurnScores(gameThrows);
    
    let game180s = 0;
    let gameTotalScore = 0;
    let gameTurnCount = 0;
    
    turns.forEach(turn => {
      const total = turn.scores.reduce((a, b) => a + (b || 0), 0);
      gameTotalScore += total;
      gameTurnCount++;
      if (total === 180) game180s++;
    });
    
    if (game180s > most180sInGame.count) {
      most180sInGame = { player: playerName, count: game180s, gameId };
    }
    
    const gameAvg = gameTurnCount > 0 ? gameTotalScore / gameTurnCount : 0;
    if (gameAvg > highestGameAverage.average && gameTurnCount >= 3) {
      highestGameAverage = { player: playerName, average: Math.round(gameAvg * 10) / 10, gameId };
    }
  });
  
  return { longestT20Streak, longest100PlusStreak, most180sInGame, highestGameAverage };
}

function computeTurnScoreDistribution(throws: ThrowData[]): { range: string; count: number }[] {
  const turns = computeTurnScores(throws);
  const buckets: Record<string, number> = {
    '0-20': 0,
    '21-40': 0,
    '41-60': 0,
    '61-80': 0,
    '81-100': 0,
    '101-120': 0,
    '121-140': 0,
    '141-160': 0,
    '161-180': 0,
  };
  
  turns.forEach(turn => {
    const total = turn.scores.reduce((a, b) => a + (b || 0), 0);
    if (total <= 20) buckets['0-20']++;
    else if (total <= 40) buckets['21-40']++;
    else if (total <= 60) buckets['41-60']++;
    else if (total <= 80) buckets['61-80']++;
    else if (total <= 100) buckets['81-100']++;
    else if (total <= 120) buckets['101-120']++;
    else if (total <= 140) buckets['121-140']++;
    else if (total <= 160) buckets['141-160']++;
    else buckets['161-180']++;
  });
  
  return Object.entries(buckets).map(([range, count]) => ({ range, count }));
}

function computeSegmentHeatmap(throws: ThrowData[]): { segment: string; count: number }[] {
  const counts: Record<number, number> = {};
  
  throws.forEach(t => {
    counts[t.segment] = (counts[t.segment] || 0) + 1;
  });
  
  // Build array for segments 1-20 plus bulls
  const segments: { segment: string; count: number }[] = [];
  for (let i = 1; i <= 20; i++) {
    segments.push({ segment: i.toString(), count: counts[i] || 0 });
  }
  segments.push({ segment: '25', count: counts[25] || 0 });
  segments.push({ segment: 'Bull', count: counts[50] || 0 });
  
  return segments;
}

export function useThrowAnalytics(groupId: string | undefined) {
  return useQuery({
    queryKey: ['throw-analytics', groupId],
    queryFn: async (): Promise<ThrowAnalytics> => {
      // Fetch throws with player info
      const { data: throws, error } = await supabase
        .from('game_throws')
        .select(`
          id,
          game_id,
          game_player_id,
          turn_number,
          throw_index,
          segment,
          multiplier,
          score,
          label,
          created_at,
          live_game_players!inner (
            player_id,
            player_name,
            live_games!inner (
              group_id,
              status
            )
          )
        `)
        .eq('live_game_players.live_games.group_id', groupId)
        .eq('live_game_players.live_games.status', 'completed')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Transform data
      const throwData: ThrowData[] = (throws || []).map((t: any) => ({
        id: t.id,
        game_id: t.game_id,
        game_player_id: t.game_player_id,
        turn_number: t.turn_number,
        throw_index: t.throw_index,
        segment: t.segment,
        multiplier: t.multiplier,
        score: t.score,
        label: t.label,
        created_at: t.created_at,
        player_id: t.live_game_players.player_id,
        player_name: t.live_game_players.player_name,
      }));
      
      if (throwData.length === 0) {
        return {
          totalThrows: 0,
          totalGames: 0,
          total180s: 0,
          avgTurnScore: 0,
          playerStats: [],
          turnScoreDistribution: computeTurnScoreDistribution([]),
          segmentHeatmap: computeSegmentHeatmap([]),
          records: {
            longestT20Streak: { player: '-', count: 0 },
            longest100PlusStreak: { player: '-', count: 0 },
            most180sInGame: { player: '-', count: 0, gameId: '' },
            highestGameAverage: { player: '-', average: 0, gameId: '' },
          },
        };
      }
      
      // Count unique games
      const uniqueGames = new Set(throwData.map(t => t.game_id));
      
      // Compute player stats
      const playerStats = computePlayerStats(throwData);
      
      // Compute global stats
      const total180s = playerStats.reduce((sum, p) => sum + p.count180s, 0);
      const totalTurns = playerStats.reduce((sum, p) => sum + p.totalTurns, 0);
      const totalTurnScore = playerStats.reduce((sum, p) => sum + p.avgTurnScore * p.totalTurns, 0);
      const avgTurnScore = totalTurns > 0 ? Math.round(totalTurnScore / totalTurns * 10) / 10 : 0;
      
      return {
        totalThrows: throwData.length,
        totalGames: uniqueGames.size,
        total180s,
        avgTurnScore,
        playerStats,
        turnScoreDistribution: computeTurnScoreDistribution(throwData),
        segmentHeatmap: computeSegmentHeatmap(throwData),
        records: computeRecords(playerStats, throwData),
      };
    },
    staleTime: 30000,
    enabled: !!groupId,
  });
}

