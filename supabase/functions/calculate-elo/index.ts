import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_ELO = 1000;
const K_FACTOR = 32;
// Decay half-life in days - after this many days, you're 50% back to 1000
// For ~3 months (90 days) to fully decay, we use ~30 day half-life
const DECAY_HALF_LIFE_DAYS = 30;

interface Player {
  id: string;
  name: string;
  matches_played: number;
  wins: number;
  losses: number;
  created_at: string;
  updated_at: string;
}

interface MatchParticipant {
  match_id: string;
  player_id: string;
  is_winner: boolean;
  rank: number;
  created_at: string;
}

interface Match {
  id: string;
  winner_id: string;
  loser_id: string;
  match_type: string;
  total_players: number;
  created_at: string;
  participants: MatchParticipant[];
}

interface PlayerEloState {
  elo: number;
  lastMatchDate: Date | null;
}

function calculateExpectedScore(playerRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
}

function applyDecayFn(elo: number, lastMatchDate: Date, currentDate: Date): number {
  const daysSinceLastMatch = (currentDate.getTime() - lastMatchDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceLastMatch <= 0) return elo;
  
  // Exponential decay towards BASE_ELO
  // decay factor = 0.5^(days/half_life)
  const decayFactor = Math.pow(0.5, daysSinceLastMatch / DECAY_HALF_LIFE_DAYS);
  const eloDiff = elo - BASE_ELO;
  return BASE_ELO + (eloDiff * decayFactor);
}

function processMatch(
  match: Match,
  playerStates: Map<string, PlayerEloState>,
  matchDate: Date,
  applyDecay: boolean = true
): Map<string, { eloBefore: number; eloAfter: number; eloChange: number }> {
  const matchResults = new Map<string, { eloBefore: number; eloAfter: number; eloChange: number }>();
  
  if (match.match_type === '1v1' || match.participants.length === 0) {
    // 1v1 match
    const winnerId = match.winner_id;
    const loserId = match.loser_id;
    
    const winnerState = playerStates.get(winnerId) || { elo: BASE_ELO, lastMatchDate: null };
    const loserState = playerStates.get(loserId) || { elo: BASE_ELO, lastMatchDate: null };
    
    // Apply decay before this match (if enabled)
    const winnerEloBefore = (applyDecay && winnerState.lastMatchDate)
      ? applyDecayFn(winnerState.elo, winnerState.lastMatchDate, matchDate)
      : winnerState.elo;
    const loserEloBefore = (applyDecay && loserState.lastMatchDate)
      ? applyDecayFn(loserState.elo, loserState.lastMatchDate, matchDate)
      : loserState.elo;
    
    // Calculate Elo change
    const expectedWinner = calculateExpectedScore(winnerEloBefore, loserEloBefore);
    const eloChange = Math.round(K_FACTOR * (1 - expectedWinner));
    
    const winnerEloAfter = winnerEloBefore + eloChange;
    const loserEloAfter = loserEloBefore - eloChange;
    
    // Update states
    playerStates.set(winnerId, { elo: winnerEloAfter, lastMatchDate: matchDate });
    playerStates.set(loserId, { elo: loserEloAfter, lastMatchDate: matchDate });
    
    matchResults.set(winnerId, { eloBefore: winnerEloBefore, eloAfter: winnerEloAfter, eloChange });
    matchResults.set(loserId, { eloBefore: loserEloBefore, eloAfter: loserEloAfter, eloChange: -eloChange });
    
  } else {
    // Multi-player match
    const participants = match.participants;
    const playerRankings: Array<{ playerId: string; eloBefore: number; rank: number }> = [];
    
    for (const p of participants) {
      const state = playerStates.get(p.player_id) || { elo: BASE_ELO, lastMatchDate: null };
      const eloBefore = (applyDecay && state.lastMatchDate)
        ? applyDecayFn(state.elo, state.lastMatchDate, matchDate)
        : state.elo;
      playerRankings.push({ playerId: p.player_id, eloBefore, rank: p.rank });
    }
    
    // Calculate multi-player Elo changes
    const totalPlayers = playerRankings.length;
    for (const player of playerRankings) {
      let totalEloChange = 0;
      
      for (const opponent of playerRankings) {
        if (player.playerId === opponent.playerId) continue;
        
        const expectedScore = calculateExpectedScore(player.eloBefore, opponent.eloBefore);
        let actualScore: number;
        if (player.rank < opponent.rank) {
          actualScore = 1;
        } else if (player.rank > opponent.rank) {
          actualScore = 0;
        } else {
          actualScore = 0.5;
        }
        
        totalEloChange += K_FACTOR * (actualScore - expectedScore);
      }
      
      const avgEloChange = Math.round(totalEloChange / (totalPlayers - 1));
      const eloAfter = player.eloBefore + avgEloChange;
      
      playerStates.set(player.playerId, { elo: eloAfter, lastMatchDate: matchDate });
      matchResults.set(player.playerId, { 
        eloBefore: player.eloBefore, 
        eloAfter, 
        eloChange: avgEloChange 
      });
    }
  }
  
  return matchResults;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body for options
    let applyDecay = true;
    try {
      const body = await req.json();
      if (typeof body.applyDecay === 'boolean') {
        applyDecay = body.applyDecay;
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    console.log(`Starting Elo calculation (decay: ${applyDecay})...`);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*');
    
    if (playersError) {
      console.error("Error fetching players:", playersError);
      throw playersError;
    }
    
    console.log(`Found ${players.length} players`);

    // Fetch all matches with participants, ordered by date
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        *,
        participants:match_participants(*)
      `)
      .order('created_at', { ascending: true });
    
    if (matchesError) {
      console.error("Error fetching matches:", matchesError);
      throw matchesError;
    }
    
    console.log(`Found ${matches.length} matches`);

    // Initialize player states
    const playerStates = new Map<string, PlayerEloState>();
    for (const player of players) {
      playerStates.set(player.id, { elo: BASE_ELO, lastMatchDate: null });
    }

    // Process matches to build historical Elo data for chart
    const matchHistory: Array<{
      matchId: string;
      matchDate: string;
      results: Array<{
        playerId: string;
        eloBefore: number;
        eloAfter: number;
        eloChange: number;
      }>;
    }> = [];

    for (const match of matches) {
      const matchDate = new Date(match.created_at);
      const results = processMatch(match, playerStates, matchDate, applyDecay);
      
      matchHistory.push({
        matchId: match.id,
        matchDate: match.created_at,
        results: Array.from(results.entries()).map(([playerId, data]) => ({
          playerId,
          ...data
        }))
      });
    }

    // Apply decay to current time for final ratings
    const now = new Date();
    const currentRatings: Array<{
      playerId: string;
      playerName: string;
      currentElo: number;
      rawElo: number;
      decayApplied: number;
      daysSinceLastMatch: number | null;
      matchesPlayed: number;
      wins: number;
      losses: number;
    }> = [];

    for (const player of players) {
      const state = playerStates.get(player.id);
      const rawElo = state?.elo || BASE_ELO;
      const lastMatchDate = state?.lastMatchDate;
      
      let currentElo = rawElo;
      let daysSinceLastMatch: number | null = null;
      let decayApplied = 0;
      
      if (lastMatchDate) {
        daysSinceLastMatch = (now.getTime() - lastMatchDate.getTime()) / (1000 * 60 * 60 * 24);
        if (applyDecay) {
          currentElo = applyDecayFn(rawElo, lastMatchDate, now);
          decayApplied = rawElo - currentElo;
        }
      }
      
      currentRatings.push({
        playerId: player.id,
        playerName: player.name,
        currentElo: Math.round(currentElo),
        rawElo: Math.round(rawElo),
        decayApplied: Math.round(decayApplied),
        daysSinceLastMatch: daysSinceLastMatch !== null ? Math.round(daysSinceLastMatch) : null,
        matchesPlayed: player.matches_played,
        wins: player.wins,
        losses: player.losses
      });
    }

    // Sort by current Elo
    currentRatings.sort((a, b) => b.currentElo - a.currentElo);

    console.log("Elo calculation complete");

    return new Response(
      JSON.stringify({ 
        players: currentRatings,
        matchHistory,
        calculatedAt: now.toISOString(),
        decayHalfLifeDays: DECAY_HALF_LIFE_DAYS,
        decayEnabled: applyDecay
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error("Error in calculate-elo function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
