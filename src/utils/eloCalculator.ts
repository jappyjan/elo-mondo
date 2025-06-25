
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

// Multi-player Elo calculation
export function calculateMultiPlayerEloChanges(
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
