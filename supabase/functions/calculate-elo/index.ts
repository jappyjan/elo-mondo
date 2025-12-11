import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_ELO = 1000;
const K_FACTOR = 50;
// New players (< this many games) use double K-factor to converge faster
const PROVISIONAL_THRESHOLD = 10;
const PROVISIONAL_K_FACTOR = K_FACTOR * 2; // 64
// Decay half-life in days - after this many days, you're 50% back to 1000
// Choose ~45d half-life so ~90d of inactivity pulls you close to baseline
const DECAY_HALF_LIFE_DAYS = 45;

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
  matchesPlayed: number;
}

function getKFactor(matchesPlayed: number): number {
  return matchesPlayed < PROVISIONAL_THRESHOLD ? PROVISIONAL_K_FACTOR : K_FACTOR;
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
  return BASE_ELO + eloDiff * decayFactor;
}

function getEffectiveElo(state: PlayerEloState, matchDate: Date, applyDecay: boolean): number {
  if (!applyDecay || !state.lastMatchDate) return state.elo;
  return applyDecayFn(state.elo, state.lastMatchDate, matchDate);
}

function processMatch(
  match: Match,
  playerStates: Map<string, PlayerEloState>,
  matchDate: Date,
  applyDecayForMatches: boolean,
): Map<string, { eloBefore: number; eloAfter: number; eloChange: number }> {
  const matchResults = new Map<string, { eloBefore: number; eloAfter: number; eloChange: number }>();

  if (match.match_type === "1v1" || match.participants.length === 0) {
    // 1v1 match
    const winnerId = match.winner_id;
    const loserId = match.loser_id;

    const winnerState = playerStates.get(winnerId) || { elo: BASE_ELO, lastMatchDate: null, matchesPlayed: 0 };
    const loserState = playerStates.get(loserId) || { elo: BASE_ELO, lastMatchDate: null, matchesPlayed: 0 };

    const winnerEloBefore = getEffectiveElo(winnerState, matchDate, applyDecayForMatches);
    const loserEloBefore = getEffectiveElo(loserState, matchDate, applyDecayForMatches);

    // Calculate Elo change - use each player's K-factor (higher for new players)
    const winnerK = getKFactor(winnerState.matchesPlayed);
    const loserK = getKFactor(loserState.matchesPlayed);

    const expectedWinner = calculateExpectedScore(winnerEloBefore, loserEloBefore);
    const expectedLoser = 1 - expectedWinner;

    const winnerEloChange = Math.round(winnerK * (1 - expectedWinner));
    const loserEloChange = Math.round(loserK * (0 - expectedLoser));

    const winnerEloAfter = winnerEloBefore + winnerEloChange;
    const loserEloAfter = loserEloBefore + loserEloChange;

    // Update states (increment matches played)
    playerStates.set(winnerId, {
      elo: winnerEloAfter,
      lastMatchDate: matchDate,
      matchesPlayed: winnerState.matchesPlayed + 1,
    });
    playerStates.set(loserId, {
      elo: loserEloAfter,
      lastMatchDate: matchDate,
      matchesPlayed: loserState.matchesPlayed + 1,
    });

    matchResults.set(winnerId, { eloBefore: winnerEloBefore, eloAfter: winnerEloAfter, eloChange: winnerEloChange });
    matchResults.set(loserId, { eloBefore: loserEloBefore, eloAfter: loserEloAfter, eloChange: loserEloChange });
  } else {
    // Multi-player match
    const participants = match.participants;
    const playerRankings: Array<{
      playerId: string;
      eloBefore: number;
      rank: number;
      kFactor: number;
      matchesPlayed: number;
    }> = [];

    for (const p of participants) {
      const state = playerStates.get(p.player_id) || { elo: BASE_ELO, lastMatchDate: null, matchesPlayed: 0 };
      const eloBefore = getEffectiveElo(state, matchDate, applyDecayForMatches);
      const kFactor = getKFactor(state.matchesPlayed);
      playerRankings.push({
        playerId: p.player_id,
        eloBefore,
        rank: p.rank,
        kFactor,
        matchesPlayed: state.matchesPlayed,
      });
    }

    // Calculate multi-player Elo changes
    const totalPlayers = playerRankings.length;
    if (totalPlayers < 2) {
      for (const player of playerRankings) {
        const state = playerStates.get(player.playerId) || { elo: BASE_ELO, lastMatchDate: null, matchesPlayed: 0 };
        playerStates.set(player.playerId, {
          elo: player.eloBefore,
          lastMatchDate: matchDate,
          matchesPlayed: state.matchesPlayed + 1,
        });
      }
      return matchResults;
    }

    const provisionalChanges: Array<{
      playerId: string;
      eloBefore: number;
      roundedChange: number;
      diff: number;
      rank: number;
      matchesPlayed: number;
    }> = [];
    let sumRoundedChanges = 0;

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

        // Use player's own K-factor (higher for new players)
        totalEloChange += player.kFactor * (actualScore - expectedScore);
      }

      const rawChange = totalEloChange / (totalPlayers - 1);
      const roundedChange = Math.round(rawChange);
      const diff = rawChange - roundedChange;
      sumRoundedChanges += roundedChange;
      provisionalChanges.push({
        playerId: player.playerId,
        eloBefore: player.eloBefore,
        roundedChange,
        diff,
        rank: player.rank,
        matchesPlayed: player.matchesPlayed,
      });
    }

    let remainder = -sumRoundedChanges;
    if (remainder !== 0 && provisionalChanges.length > 0) {
      const ordered = provisionalChanges.slice().sort((a, b) => {
        if (remainder > 0) {
          if (b.diff !== a.diff) return b.diff - a.diff;
        } else {
          if (a.diff !== b.diff) return a.diff - b.diff;
        }
        return a.playerId.localeCompare(b.playerId);
      });

      for (let i = 0; i < Math.abs(remainder); i++) {
        const target = ordered[i % ordered.length];
        target.roundedChange += remainder > 0 ? 1 : -1;
      }
    }

    // Final guard to keep multi-player near zero-sum even after rounding drift
    const finalSum = provisionalChanges.reduce((sum, change) => sum + change.roundedChange, 0);
    if (finalSum !== 0 && provisionalChanges.length > 0) {
      const target = provisionalChanges.reduce((best, current) => {
        if (!best) return current;
        const bestScore = Math.abs(best.diff);
        const currentScore = Math.abs(current.diff);
        if (currentScore === bestScore) {
          return current.rank < best.rank ? current : best;
        }
        return currentScore < bestScore ? current : best;
      }, provisionalChanges[0]);
      target.roundedChange -= finalSum;
    }

    for (const change of provisionalChanges) {
      const eloAfter = change.eloBefore + change.roundedChange;
      playerStates.set(change.playerId, {
        elo: eloAfter,
        lastMatchDate: matchDate,
        matchesPlayed: change.matchesPlayed + 1,
      });
      matchResults.set(change.playerId, {
        eloBefore: change.eloBefore,
        eloAfter,
        eloChange: change.roundedChange,
      });
    }
  }

  return matchResults;
}

// Lightweight simulation harness for regressions:
// run with ELO_SIMULATE=1 to log deterministic scenarios to stdout.
function runSimulationHarness() {
  const scenarios: Array<{ name: string; matches: Match[]; decayProbeDays?: number; applyDecayInMatches?: boolean }> = [
    {
      name: "1v1_inactivity_then_return",
      matches: [
        {
          id: "m1",
          winner_id: "alice",
          loser_id: "bob",
          match_type: "1v1",
          total_players: 2,
          created_at: "2024-01-01T00:00:00.000Z",
          participants: [],
        },
        {
          id: "m2",
          winner_id: "bob",
          loser_id: "alice",
          match_type: "1v1",
          total_players: 2,
          created_at: "2024-03-31T00:00:00.000Z", // ~90d later
          participants: [],
        },
      ],
    },
    {
      name: "ffa_three_players",
      matches: [
        {
          id: "m3",
          winner_id: "carol",
          loser_id: "bob",
          match_type: "ffa",
          total_players: 3,
          created_at: "2024-02-01T00:00:00.000Z",
          participants: [
            { match_id: "m3", player_id: "carol", is_winner: true, rank: 1, created_at: "2024-02-01T00:00:00.000Z" },
            { match_id: "m3", player_id: "alice", is_winner: false, rank: 2, created_at: "2024-02-01T00:00:00.000Z" },
            { match_id: "m3", player_id: "bob", is_winner: false, rank: 3, created_at: "2024-02-01T00:00:00.000Z" },
          ],
        },
      ],
    },
    {
      name: "idle_decay_120d",
      matches: [
        {
          id: "m4",
          winner_id: "dave",
          loser_id: "erin",
          match_type: "1v1",
          total_players: 2,
          created_at: "2024-01-01T00:00:00.000Z",
          participants: [],
        },
      ],
      decayProbeDays: 120,
    },
    {
      name: "decay_applied_in_matches",
      matches: [
        {
          id: "dm1",
          winner_id: "alice",
          loser_id: "bob",
          match_type: "1v1",
          total_players: 2,
          created_at: "2024-01-01T00:00:00.000Z",
          participants: [],
        },
        {
          id: "dm2",
          winner_id: "alice",
          loser_id: "bob",
          match_type: "1v1",
          total_players: 2,
          created_at: "2024-01-02T00:00:00.000Z",
          participants: [],
        },
        {
          id: "dm3",
          winner_id: "alice",
          loser_id: "bob",
          match_type: "1v1",
          total_players: 2,
          created_at: "2024-01-03T00:00:00.000Z",
          participants: [],
        },
        {
          id: "dm4",
          winner_id: "bob",
          loser_id: "alice",
          match_type: "1v1",
          total_players: 2,
          created_at: "2024-06-02T00:00:00.000Z",
          participants: [],
        },
      ],
      applyDecayInMatches: true,
    },
    {
      name: "ffa_rounding_zero_sum",
      matches: [
        {
          id: "m5",
          winner_id: "w1",
          loser_id: "l1",
          match_type: "ffa",
          total_players: 4,
          created_at: "2024-02-15T00:00:00.000Z",
          participants: [
            { match_id: "m5", player_id: "p1", is_winner: true, rank: 1, created_at: "2024-02-15T00:00:00.000Z" },
            { match_id: "m5", player_id: "p2", is_winner: false, rank: 2, created_at: "2024-02-15T00:00:00.000Z" },
            { match_id: "m5", player_id: "p3", is_winner: false, rank: 3, created_at: "2024-02-15T00:00:00.000Z" },
            { match_id: "m5", player_id: "p4", is_winner: false, rank: 4, created_at: "2024-02-15T00:00:00.000Z" },
          ],
        },
      ],
    },
  ];

  const results: Array<{
    name: string;
    final: Array<{ playerId: string; rawElo: number; decayedElo: number }>;
  }> = [];
  const checks: Array<{ scenario: string; message: string; ok: boolean }> = [];

  function expectApproximately(scenario: string, message: string, actual: number, expected: number, tolerance = 1) {
    const ok = Math.abs(actual - expected) <= tolerance;
    checks.push({ scenario, message: `${message} (expected ~${expected}±${tolerance}, got ${actual})`, ok });
  }

  for (const scenario of scenarios) {
    const states = new Map<string, PlayerEloState>();
    const allPlayers = new Set<string>();
    const matchResultsPerScenario: Array<Map<string, { eloBefore: number; eloAfter: number; eloChange: number }>> = [];
    for (const m of scenario.matches) {
      allPlayers.add(m.winner_id);
      allPlayers.add(m.loser_id);
      (m.participants || []).forEach((p) => allPlayers.add(p.player_id));
    }
    for (const pid of allPlayers) {
      states.set(pid, { elo: BASE_ELO, lastMatchDate: null, matchesPlayed: 0 });
    }

    for (const m of scenario.matches) {
      const result = processMatch(m, states, new Date(m.created_at), scenario.applyDecayInMatches ?? true);
      matchResultsPerScenario.push(result);
    }

    const finalRatings: Array<{ playerId: string; rawElo: number; decayedElo: number }> = [];
    const now = new Date(scenario.matches[scenario.matches.length - 1].created_at);
    const probeDays = scenario.decayProbeDays ?? 30;
    const probeDate = new Date(now.getTime() + probeDays * 24 * 60 * 60 * 1000);
    for (const pid of allPlayers) {
      const state = states.get(pid)!;
      const rawElo = state.elo;
      const decayedElo = state.lastMatchDate ? applyDecayFn(rawElo, state.lastMatchDate, probeDate) : rawElo;
      finalRatings.push({ playerId: pid, rawElo: Math.round(rawElo), decayedElo: Math.round(decayedElo) });
    }

    results.push({ name: scenario.name, final: finalRatings });

    if (scenario.name === "1v1_inactivity_then_return") {
      const alice = finalRatings.find((r) => r.playerId === "alice")!;
      const bob = finalRatings.find((r) => r.playerId === "bob")!;
      // With provisional K=64 (doubled), changes are larger
      expectApproximately(scenario.name, "alice raw", alice.rawElo, 975);
      expectApproximately(scenario.name, "bob raw", bob.rawElo, 1025);
      expectApproximately(
        scenario.name,
        "alice decayed@+30d",
        alice.decayedElo,
        Math.round(applyDecayFn(975, new Date("2024-03-31T00:00:00.000Z"), probeDate)),
      );
      expectApproximately(
        scenario.name,
        "bob decayed@+30d",
        bob.decayedElo,
        Math.round(applyDecayFn(1025, new Date("2024-03-31T00:00:00.000Z"), probeDate)),
      );
    }

    if (scenario.name === "ffa_three_players") {
      const carol = finalRatings.find((r) => r.playerId === "carol")!;
      const alice = finalRatings.find((r) => r.playerId === "alice")!;
      const bob = finalRatings.find((r) => r.playerId === "bob")!;
      // With provisional K=64 (doubled), changes are larger
      expectApproximately(scenario.name, "carol raw", carol.rawElo, 1032);
      expectApproximately(scenario.name, "alice raw", alice.rawElo, 1000);
      expectApproximately(scenario.name, "bob raw", bob.rawElo, 968);
      expectApproximately(
        scenario.name,
        "carol decayed@+30d",
        carol.decayedElo,
        Math.round(applyDecayFn(1032, now, probeDate)),
      );
      expectApproximately(scenario.name, "alice decayed@+30d", alice.decayedElo, 1000);
      expectApproximately(
        scenario.name,
        "bob decayed@+30d",
        bob.decayedElo,
        Math.round(applyDecayFn(968, now, probeDate)),
      );
    }

    if (scenario.name === "idle_decay_120d") {
      const dave = finalRatings.find((r) => r.playerId === "dave")!;
      const erin = finalRatings.find((r) => r.playerId === "erin")!;
      // With provisional K=64 (doubled), changes are larger
      expectApproximately(
        scenario.name,
        "dave decayed@+120d",
        dave.decayedElo,
        Math.round(applyDecayFn(1032, now, probeDate)),
      );
      expectApproximately(
        scenario.name,
        "erin decayed@+120d",
        erin.decayedElo,
        Math.round(applyDecayFn(968, now, probeDate)),
      );
    }

    if (scenario.name === "decay_applied_in_matches") {
      const alice = finalRatings.find((r) => r.playerId === "alice")!;
      const bob = finalRatings.find((r) => r.playerId === "bob")!;
      // With provisional K=64 (doubled), changes are larger
      expectApproximately(scenario.name, "alice raw after long gap (decay applied)", alice.rawElo, 975);
      expectApproximately(scenario.name, "bob raw after long gap (decay applied)", bob.rawElo, 1025);
    }

    if (scenario.name === "ffa_rounding_zero_sum") {
      const ffaResult = matchResultsPerScenario[matchResultsPerScenario.length - 1];
      const totalChange = Array.from(ffaResult.values()).reduce((sum, change) => sum + change.eloChange, 0);
      expectApproximately(scenario.name, "ffa rounding remains zero-sum", totalChange, 0, 0);
    }
  }

  return { results, checks };
}

if (Deno.env.get("ELO_SIMULATE") === "1") {
  console.log("Elo simulation harness:", JSON.stringify(runSimulationHarness(), null, 2));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body for options
    let applyDecayForOutput = true;
    let applyDecayInMatches: boolean | undefined;
    let selectedYear: number | null = null;
    try {
      const body = await req.json();
      if (typeof body.applyDecay === "boolean") {
        applyDecayForOutput = body.applyDecay;
      }
      if (typeof body.applyDecayInMatches === "boolean") {
        applyDecayInMatches = body.applyDecayInMatches;
      }
      if (typeof body.year === "number") {
        selectedYear = body.year;
      }
    } catch {
      // No body or invalid JSON, use defaults
    }
    const applyDecayForMatches = applyDecayInMatches ?? applyDecayForOutput;

    console.log(
      `Starting Elo calculation (decay in matches: ${applyDecayForMatches}, decay on output: ${applyDecayForOutput}, year: ${selectedYear || "all"})...`,
    );

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all players
    const { data: players, error: playersError } = await supabase.from("players").select("*");

    if (playersError) {
      console.error("Error fetching players:", playersError);
      throw playersError;
    }

    console.log(`Found ${players.length} players`);

    // Fetch all matches with participants, ordered by date
    const { data: allMatches, error: matchesError } = await supabase
      .from("matches")
      .select(
        `
        *,
        participants:match_participants(*)
      `,
      )
      .order("created_at", { ascending: true });

    if (matchesError) {
      console.error("Error fetching matches:", matchesError);
      throw matchesError;
    }

    // Extract available years from matches
    const availableYears = [...new Set(allMatches.map((m: any) => new Date(m.created_at).getFullYear()))].sort(
      (a, b) => b - a,
    );

    // Filter matches by year if specified
    const matches = selectedYear
      ? allMatches.filter((m: any) => new Date(m.created_at).getFullYear() === selectedYear)
      : allMatches;

    console.log(`Found ${allMatches.length} total matches, ${matches.length} in selected period`);

    // Initialize player states and track year-specific stats
    const playerStates = new Map<string, PlayerEloState>();
    const playerYearStats = new Map<string, { wins: number; losses: number; matchesPlayed: number }>();
    for (const player of players) {
      playerStates.set(player.id, { elo: BASE_ELO, lastMatchDate: null, matchesPlayed: 0 });
      playerYearStats.set(player.id, { wins: 0, losses: 0, matchesPlayed: 0 });
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
      const results = processMatch(match, playerStates, matchDate, applyDecayForMatches);

      // Track year-specific stats
      if (match.match_type === "1v1" || !match.participants?.length) {
        // 1v1 match
        const winnerStats = playerYearStats.get(match.winner_id) || { wins: 0, losses: 0, matchesPlayed: 0 };
        const loserStats = playerYearStats.get(match.loser_id) || { wins: 0, losses: 0, matchesPlayed: 0 };
        winnerStats.wins += 1;
        winnerStats.matchesPlayed += 1;
        loserStats.losses += 1;
        loserStats.matchesPlayed += 1;
        playerYearStats.set(match.winner_id, winnerStats);
        playerYearStats.set(match.loser_id, loserStats);
      } else {
        // Multi-player match
        for (const p of match.participants) {
          const stats = playerYearStats.get(p.player_id) || { wins: 0, losses: 0, matchesPlayed: 0 };
          stats.matchesPlayed += 1;
          if (p.rank === 1) stats.wins += 1;
          if (p.rank === match.total_players) stats.losses += 1;
          playerYearStats.set(p.player_id, stats);
        }
      }

      matchHistory.push({
        matchId: match.id,
        matchDate: match.created_at,
        results: Array.from(results.entries()).map(([playerId, data]) => ({
          playerId,
          ...data,
        })),
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
      winRate: number;
      rank: number;
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
        if (applyDecayForOutput) {
          currentElo = applyDecayFn(rawElo, lastMatchDate, now);
          decayApplied = rawElo - currentElo;
        }
      }

      // Use year-specific stats instead of all-time stats
      const yearStats = playerYearStats.get(player.id) || { wins: 0, losses: 0, matchesPlayed: 0 };
      const winRate = yearStats.matchesPlayed > 0 ? yearStats.wins / yearStats.matchesPlayed : 0;

      // Only include players who played in the selected year (or all if no year selected)
      if (!selectedYear || yearStats.matchesPlayed > 0) {
        currentRatings.push({
          playerId: player.id,
          playerName: player.name,
          currentElo: Math.round(currentElo),
          rawElo: Math.round(rawElo),
          decayApplied: Math.round(decayApplied),
          daysSinceLastMatch: daysSinceLastMatch !== null ? Math.round(daysSinceLastMatch) : null,
          matchesPlayed: yearStats.matchesPlayed,
          wins: yearStats.wins,
          losses: yearStats.losses,
          winRate: Math.round(winRate * 1000) / 1000, // Round to 3 decimal places
          rank: 0, // Will be assigned after sorting
        });
      }
    }

    // Sort by current Elo (descending), then by win rate (descending)
    currentRatings.sort((a, b) => {
      if (b.currentElo !== a.currentElo) {
        return b.currentElo - a.currentElo;
      }
      return b.winRate - a.winRate;
    });

    // Assign ranks - players with same Elo AND winRate share rank, next rank skips
    for (let i = 0; i < currentRatings.length; i++) {
      if (i === 0) {
        currentRatings[i].rank = 1;
      } else {
        const prev = currentRatings[i - 1];
        const curr = currentRatings[i];
        // Same Elo and winRate = same rank, otherwise rank = position + 1
        if (curr.currentElo === prev.currentElo && curr.winRate === prev.winRate) {
          curr.rank = prev.rank;
        } else {
          curr.rank = i + 1;
        }
      }
    }

    console.log("Elo calculation complete");

    return new Response(
      JSON.stringify({
        players: currentRatings,
        matchHistory,
        calculatedAt: now.toISOString(),
        decayHalfLifeDays: DECAY_HALF_LIFE_DAYS,
        decayEnabled: applyDecayForOutput,
        decayAppliedInMatches: applyDecayForMatches,
        availableYears,
        selectedYear,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error in calculate-elo function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
