// Preserved from the Supabase edge function; shared pure calculation for migration parity.
const BASE_ELO = 1000;
const K_FACTOR = 32;
// New players (< this many games) use double K-factor to converge faster
const PROVISIONAL_THRESHOLD = 10;
const PROVISIONAL_K_FACTOR = K_FACTOR * 2; // 64
// Decay half-life in days - after this many days, you're 50% back to 1000
// Choose ~45d half-life so ~90d of inactivity pulls you close to baseline
const DECAY_HALF_LIFE_DAYS = 30;
const DECAY_START_DAY = 14;

interface Player {
  id: string;
  name: string;
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

interface GroupMemberRow {
  player_id: string;
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
  if (daysSinceLastMatch <= DECAY_START_DAY) return elo;

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

    const winnerRawChange = winnerK * (1 - expectedWinner);
    const loserRawChange = loserK * (0 - expectedLoser); // negative

    let winnerEloChange = Math.round(winnerRawChange);
    let loserEloChange = Math.round(loserRawChange);

    // Enforce zero-sum by adjusting the side that introduces the least additional rounding error.
    const drift = winnerEloChange + loserEloChange;
    if (drift !== 0) {
      const winnerCandidate = winnerEloChange - drift;
      const winnerError = Math.abs(winnerCandidate - winnerRawChange) + Math.abs(loserEloChange - loserRawChange);
      const loserCandidate = loserEloChange - drift;
      const loserError = Math.abs(winnerEloChange - winnerRawChange) + Math.abs(loserCandidate - loserRawChange);

      if (winnerError <= loserError) {
        winnerEloChange = winnerCandidate;
      } else {
        loserEloChange = loserCandidate;
      }
    }

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

    const remainder = -sumRoundedChanges;
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
export function calculateElo(players: Player[], allMatches: Match[], applyDecayForOutput = true, selectedYear: number | null = null, includeProvisional = true, calculationTime = new Date()) {
  // The deployed Supabase function applies decay only to output ratings.
  // Preserve its historical calculation during the backend migration.
  const applyDecayForMatches = false;
    // Extract available years from matches
    const typedMatches = allMatches;

    const availableYears = [...new Set(typedMatches.map((m) => new Date(m.created_at).getFullYear()))].sort(
      (a, b) => b - a,
    );

    // Filter matches by year if specified
    const matches = selectedYear
      ? typedMatches.filter((m) => new Date(m.created_at).getFullYear() === selectedYear)
      : typedMatches;


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
        const ranks = match.participants.map((p) => p.rank);
        const minRank = Math.min(...ranks);
        const maxRank = Math.max(...ranks);

        for (const p of match.participants) {
          const stats = playerYearStats.get(p.player_id) || { wins: 0, losses: 0, matchesPlayed: 0 };
          stats.matchesPlayed += 1;
          if (p.rank === minRank) stats.wins += 1;
          if (p.rank === maxRank) stats.losses += 1;
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
    const now = calculationTime;
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
      isProvisional: boolean;
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
      const isProvisional = yearStats.matchesPlayed < PROVISIONAL_THRESHOLD;

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
          winRate: Math.round(winRate * 1000) / 1000,
          rank: 0, // Will be assigned after sorting
          isProvisional,
        });
      }
    }

    // Optionally filter out provisional players before ranking to avoid gaps
    const filteredRatings = includeProvisional ? currentRatings : currentRatings.filter((p) => !p.isProvisional);

    // Sort players by current Elo (descending), then by win rate (descending)
    filteredRatings.sort((a, b) => {
      if (b.currentElo !== a.currentElo) return b.currentElo - a.currentElo;
      return b.winRate - a.winRate;
    });

    // Assign ranks after filtering to avoid gaps when provisional players are hidden
    for (let i = 0; i < filteredRatings.length; i++) {
      if (i === 0) {
        filteredRatings[i].rank = 1;
      } else {
        const prev = filteredRatings[i - 1];
        const curr = filteredRatings[i];
        if (curr.currentElo === prev.currentElo && curr.winRate === prev.winRate) {
          curr.rank = prev.rank;
        } else {
          curr.rank = i + 1;
        }
      }
    }

    const sortedRatings = filteredRatings;


  return { players: sortedRatings, matchHistory, calculatedAt: now.toISOString(), decayHalfLifeDays: DECAY_HALF_LIFE_DAYS, decayStartDay: DECAY_START_DAY, decayEnabled: applyDecayForOutput, decayAppliedInMatches: applyDecayForMatches, availableYears, selectedYear };
}
