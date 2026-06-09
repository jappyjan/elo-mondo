import { AnalyticsThrow, DartTurn } from './types';

export function normalizeDartLabel(label: string | null | undefined): string {
  return (label || '').trim().toUpperCase();
}

export function isMiss(dart: Pick<AnalyticsThrow, 'label' | 'score'>): boolean {
  return normalizeDartLabel(dart.label) === 'MISS' || (dart.score === 0 && normalizeDartLabel(dart.label) === '');
}

export function formatSegment(segment: number, label: string): string {
  if (normalizeDartLabel(label) === 'MISS') return 'MISS';
  if (segment === 50) return 'Bull';
  if (segment === 25) return '25';
  return String(segment);
}

export function groupThrowsIntoTurns(throws: AnalyticsThrow[]): DartTurn[] {
  const turns = new Map<string, AnalyticsThrow[]>();

  throws.forEach((dart) => {
    const key = `${dart.gamePlayerId}:${dart.turnNumber}`;
    turns.set(key, [...(turns.get(key) ?? []), dart]);
  });

  return Array.from(turns.entries())
    .map(([key, darts]) => {
      const sorted = darts.slice().sort((a, b) => a.throwIndex - b.throwIndex);
      const first = sorted[0];

      return {
        turnKey: key,
        playerKey: first.key,
        gameId: first.gameId,
        gamePlayerId: first.gamePlayerId,
        playerId: first.playerId,
        playerName: first.playerName,
        turnNumber: first.turnNumber,
        createdAt: first.createdAt,
        darts: sorted,
        labels: sorted.map((dart) => normalizeDartLabel(dart.label)),
        segments: sorted.map((dart) => dart.segment),
        totalScore: sorted.reduce((sum, dart) => sum + dart.score, 0),
      } satisfies DartTurn;
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.turnNumber - b.turnNumber);
}

function isSingleSegment(dart: AnalyticsThrow, segment: number): boolean {
  return dart.segment === segment && dart.multiplier === 1 && !isMiss(dart);
}

export function isFiveTwentyOneTurn(turn: DartTurn): boolean {
  return [1, 5, 20].every((segment) => turn.darts.some((dart) => isSingleSegment(dart, segment)));
}

export function isTwentySixClubTurn(turn: DartTurn): boolean {
  return isFiveTwentyOneTurn(turn);
}

export function isAlmost180Turn(turn: DartTurn): boolean {
  const t20Count = turn.darts.filter((dart) => dart.segment === 20 && dart.multiplier === 3).length;
  return t20Count === 2 && turn.darts.length >= 3;
}

export function isAllOverBoardTurn(turn: DartTurn): boolean {
  const lowScoringSegments = new Set(
    turn.darts
      .filter((dart) => !isMiss(dart) && dart.score > 0 && dart.score <= 20)
      .map((dart) => dart.segment)
  );

  return lowScoringSegments.size >= 3;
}

export function countNeighborHits(turns: DartTurn[]): Map<string, number> {
  const counts = new Map<string, number>();

  turns.forEach((turn) => {
    const hits = turn.darts.filter((dart) => [1, 5, 20].includes(dart.segment) && !isMiss(dart)).length;
    counts.set(turn.turnKey, hits);
  });

  return counts;
}
