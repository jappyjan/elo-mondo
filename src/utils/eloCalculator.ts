
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
