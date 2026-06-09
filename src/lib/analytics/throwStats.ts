import { AnalyticsThrow, CountStat, FunDartRecords, PlayerThrowStats, RateStat, ThrowAnalyticsSummary } from './types';
import { formatSegment, groupThrowsIntoTurns, isAllOverBoardTurn, isAlmost180Turn, isFiveTwentyOneTurn, isMiss, isTwentySixClubTurn, normalizeDartLabel } from './dartPatternStats';

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function increment(map: Map<string, number>, label: string, count = 1): void {
  map.set(label, (map.get(label) ?? 0) + count);
}

function toCountStats(map: Map<string, number>): CountStat[] {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function emptyFunRecords(): FunDartRecords {
  return {
    mostOnes: [],
    mostMisses: [],
    mostFiveTwentyOne: [],
    mostTwentySixClub: [],
    mostNeighborHits: [],
    mostAllOverBoard: [],
    mostAlmost180: [],
    highestSingleRate: [],
    highestTripleRate: [],
  };
}

function rateStats(players: PlayerThrowStats[], getCount: (player: PlayerThrowStats) => number): RateStat[] {
  return players
    .filter((player) => player.totalDarts >= 1)
    .map((player) => ({ label: player.playerName, count: getCount(player), rate: getCount(player) / player.totalDarts }))
    .sort((a, b) => b.rate - a.rate || b.count - a.count)
    .slice(0, 10);
}

export function buildThrowAnalytics(throws: AnalyticsThrow[]): ThrowAnalyticsSummary {
  const turns = groupThrowsIntoTurns(throws);
  const exactDarts = new Map<string, number>();
  const segments = new Map<string, number>();
  const turnPatterns = new Map<string, number>();
  const scoreDistribution = new Map<string, number>();
  const playerThrows = new Map<string, AnalyticsThrow[]>();
  const playerTurns = new Map<string, typeof turns>();

  throws.forEach((dart) => {
    increment(exactDarts, normalizeDartLabel(dart.label) || String(dart.score));
    increment(segments, formatSegment(dart.segment, dart.label));
    playerThrows.set(dart.key, [...(playerThrows.get(dart.key) ?? []), dart]);
  });

  turns.forEach((turn) => {
    increment(turnPatterns, turn.labels.join(' + '));
    const bucket = turn.totalScore >= 180 ? '180' : turn.totalScore >= 140 ? '140-179' : turn.totalScore >= 100 ? '100-139' : turn.totalScore >= 60 ? '60-99' : '0-59';
    increment(scoreDistribution, bucket);
    playerTurns.set(turn.playerKey, [...(playerTurns.get(turn.playerKey) ?? []), turn]);
  });

  const playerStats: PlayerThrowStats[] = Array.from(playerThrows.entries()).map(([key, darts]) => {
    const first = darts[0];
    const turnsForPlayer = playerTurns.get(key) ?? [];
    const playerExact = new Map<string, number>();
    const playerSegments = new Map<string, number>();
    const playerPatterns = new Map<string, number>();
    let singles = 0;
    let doubles = 0;
    let triples = 0;
    let bulls = 0;
    let missCount = 0;
    let t20Count = 0;
    let oneCount = 0;

    darts.forEach((dart) => {
      const label = normalizeDartLabel(dart.label);
      increment(playerExact, label || String(dart.score));
      increment(playerSegments, formatSegment(dart.segment, dart.label));
      if (isMiss(dart)) missCount += 1;
      else if (dart.multiplier === 1) singles += 1;
      else if (dart.multiplier === 2) doubles += 1;
      else if (dart.multiplier === 3) triples += 1;
      if (dart.segment === 25 || dart.segment === 50) bulls += 1;
      if (dart.segment === 20 && dart.multiplier === 3) t20Count += 1;
      if (dart.segment === 1 && dart.multiplier === 1) oneCount += 1;
    });

    turnsForPlayer.forEach((turn) => increment(playerPatterns, turn.labels.join(' + ')));

    const totalTurnScore = turnsForPlayer.reduce((sum, turn) => sum + turn.totalScore, 0);
    const count100Plus = turnsForPlayer.filter((turn) => turn.totalScore >= 100).length;
    const count140Plus = turnsForPlayer.filter((turn) => turn.totalScore >= 140).length;
    const count180 = turnsForPlayer.filter((turn) => turn.totalScore === 180).length;

    return {
      key,
      playerId: first.playerId,
      playerName: first.playerName,
      totalDarts: darts.length,
      totalTurns: turnsForPlayer.length,
      averageTurnScore: turnsForPlayer.length > 0 ? round1(totalTurnScore / turnsForPlayer.length) : 0,
      averagePointsPerDart: darts.length > 0 ? round1(darts.reduce((sum, dart) => sum + dart.score, 0) / darts.length) : 0,
      missCount,
      missRate: darts.length > 0 ? missCount / darts.length : 0,
      singles,
      doubles,
      triples,
      bulls,
      t20Count,
      oneCount,
      count100Plus,
      count140Plus,
      count180,
      bestTurn: Math.max(0, ...turnsForPlayer.map((turn) => turn.totalScore)),
      mostCommonSegment: toCountStats(playerSegments)[0]?.label ?? '-',
      mostCommonDart: toCountStats(playerExact)[0]?.label ?? '-',
      mostCommonTurnPattern: toCountStats(playerPatterns)[0]?.label ?? '-',
    };
  }).sort((a, b) => b.totalDarts - a.totalDarts);

  const funByPlayer = {
    ones: new Map<string, number>(),
    misses: new Map<string, number>(),
    fiveTwentyOne: new Map<string, number>(),
    twentySixClub: new Map<string, number>(),
    neighborHits: new Map<string, number>(),
    allOverBoard: new Map<string, number>(),
    almost180: new Map<string, number>(),
  };

  playerStats.forEach((player) => {
    increment(funByPlayer.ones, player.playerName, player.oneCount);
    increment(funByPlayer.misses, player.playerName, player.missCount);
  });

  turns.forEach((turn) => {
    const playerName = turn.playerName;
    if (isFiveTwentyOneTurn(turn)) increment(funByPlayer.fiveTwentyOne, playerName);
    if (isTwentySixClubTurn(turn)) increment(funByPlayer.twentySixClub, playerName);
    if (isAllOverBoardTurn(turn)) increment(funByPlayer.allOverBoard, playerName);
    if (isAlmost180Turn(turn)) increment(funByPlayer.almost180, playerName);
    const neighborHitCount = turn.darts.filter((dart) => [1, 5, 20].includes(dart.segment) && !isMiss(dart)).length;
    if (neighborHitCount > 0) increment(funByPlayer.neighborHits, playerName, neighborHitCount);
  });

  const totalScore = throws.reduce((sum, dart) => sum + dart.score, 0);
  const totalTurnScore = turns.reduce((sum, turn) => sum + turn.totalScore, 0);

  return {
    totalDarts: throws.length,
    totalTurns: turns.length,
    averageTurnScore: turns.length > 0 ? round1(totalTurnScore / turns.length) : 0,
    averagePointsPerDart: throws.length > 0 ? round1(totalScore / throws.length) : 0,
    exactDarts: toCountStats(exactDarts),
    segments: toCountStats(segments),
    turnPatterns: toCountStats(turnPatterns),
    scoreDistribution: toCountStats(scoreDistribution),
    playerStats,
    funRecords: {
      ...emptyFunRecords(),
      mostOnes: toCountStats(funByPlayer.ones),
      mostMisses: toCountStats(funByPlayer.misses),
      mostFiveTwentyOne: toCountStats(funByPlayer.fiveTwentyOne),
      mostTwentySixClub: toCountStats(funByPlayer.twentySixClub),
      mostNeighborHits: toCountStats(funByPlayer.neighborHits),
      mostAllOverBoard: toCountStats(funByPlayer.allOverBoard),
      mostAlmost180: toCountStats(funByPlayer.almost180),
      highestSingleRate: rateStats(playerStats, (player) => player.singles),
      highestTripleRate: rateStats(playerStats, (player) => player.triples),
    },
  };
}
