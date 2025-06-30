
// Elo rating calculation for darts
export function calculateEloChange(winnerRating: number, loserRating: number, kFactor: number = 32): number {
  const expectedWinnerScore = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const eloChange = Math.round(kFactor * (1 - expectedWinnerScore));
  return eloChange;
}

export function calculateNewRatings(winnerRating: number, loserRating: number, kFactor: number = 32) {
  const eloChange = calculateEloChange(winnerRating, loserRating, kFactor);
  
  return {
    winnerNewRating: winnerRating + eloChange,
    loserNewRating: loserRating - eloChange,
    eloChange
  };
}

// Multi-player Elo calculation with proper ranking system
export function calculateMultiPlayerEloChanges(
  playerRatings: Array<{ playerId: string; rating: number; rank: number }>,
  kFactor: number = 32
) {
  const totalPlayers = playerRatings.length;
  const results: Array<{
    playerId: string;
    eloChange: number;
    newRating: number;
    rank: number;
  }> = [];

  // Sort players by rank (1st place, 2nd place, etc.)
  const sortedPlayers = [...playerRatings].sort((a, b) => a.rank - b.rank);

  for (const player of sortedPlayers) {
    let totalEloChange = 0;

    // Calculate Elo change against every other player
    for (const opponent of sortedPlayers) {
      if (player.playerId === opponent.playerId) continue;

      // Calculate expected score based on ratings
      const expectedScore = 1 / (1 + Math.pow(10, (opponent.rating - player.rating) / 400));
      
      // Determine actual score based on ranking
      let actualScore: number;
      if (player.rank < opponent.rank) {
        // Player ranked higher (better) than opponent
        actualScore = 1;
      } else if (player.rank > opponent.rank) {
        // Player ranked lower (worse) than opponent
        actualScore = 0;
      } else {
        // Same rank (tie)
        actualScore = 0.5;
      }

      // Calculate Elo change for this matchup
      const eloChangeVsOpponent = kFactor * (actualScore - expectedScore);
      totalEloChange += eloChangeVsOpponent;
    }

    // Average the total change by number of opponents faced
    const averageEloChange = Math.round(totalEloChange / (totalPlayers - 1));
    const newRating = player.rating + averageEloChange;

    results.push({
      playerId: player.playerId,
      eloChange: averageEloChange,
      newRating,
      rank: player.rank
    });
  }

  return results;
}

// Legacy function for backward compatibility
export function calculateMultiPlayerEloChanges_Legacy(
  winnerRating: number,
  loserRatings: number[],
  kFactor: number = 32
) {
  const numLosers = loserRatings.length;
  const averageLoserRating = loserRatings.reduce((sum, rating) => sum + rating, 0) / numLosers;
  
  // Calculate expected score for winner against average loser rating
  const expectedWinnerScore = 1 / (1 + Math.pow(10, (averageLoserRating - winnerRating) / 400));
  
  // Winner gains points based on beating multiple opponents
  const winnerEloChange = Math.round(kFactor * numLosers * (1 - expectedWinnerScore));
  
  // Each loser loses points proportionally
  const loserEloChanges = loserRatings.map(loserRating => {
    const expectedLoserScore = 1 / (1 + Math.pow(10, (winnerRating - loserRating) / 400));
    return Math.round(kFactor * expectedLoserScore);
  });
  
  return {
    winnerEloChange,
    loserEloChanges,
    winnerNewRating: winnerRating + winnerEloChange,
    loserNewRatings: loserRatings.map((rating, index) => rating - loserEloChanges[index])
  };
}
