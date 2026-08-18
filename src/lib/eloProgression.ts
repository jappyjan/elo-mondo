import { CalculatedPlayer, MatchHistoryEntry } from '@/types/darts';

export type EloRangeOption = 'all' | 'last15' | 'lastMonth' | 'last3Months' | 'lastYear';

export interface EloDecaySettings {
  halfLifeDays: number;
  startDay: number;
}

export type EloChartPoint = { match: number; isNow: boolean } & Record<string, number | boolean>;

const BASE_ELO = 1000;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Mirror of applyDecayFn in supabase/functions/calculate-elo/index.ts */
export function applyEloDecay(
  elo: number,
  lastMatchDate: Date,
  at: Date,
  { halfLifeDays, startDay }: EloDecaySettings,
): number {
  const days = (at.getTime() - lastMatchDate.getTime()) / MS_PER_DAY;
  if (days <= startDay) return elo;
  return BASE_ELO + (elo - BASE_ELO) * Math.pow(0.5, days / halfLifeDays);
}

function filterByRange(sorted: MatchHistoryEntry[], range: EloRangeOption, now: Date): MatchHistoryEntry[] {
  const since = (days: number) => new Date(now.getTime() - days * MS_PER_DAY);
  switch (range) {
    case 'last15':
      return sorted.slice(-15);
    case 'lastMonth':
      return sorted.filter((m) => new Date(m.matchDate) >= since(30));
    case 'last3Months':
      return sorted.filter((m) => new Date(m.matchDate) >= since(90));
    case 'lastYear':
      return sorted.filter((m) => new Date(m.matchDate) >= since(365));
    default:
      return sorted;
  }
}

/**
 * Builds the Elo progression series. Stored Elo is undecayed; decay is a function of
 * time since a player's last match, so every plotted point is evaluated at its own
 * timestamp — that is what makes idle players sag instead of holding a flat line.
 */
export function buildEloProgressionSeries({
  matchHistory,
  players,
  range,
  decay,
  now,
}: {
  matchHistory: MatchHistoryEntry[];
  players: CalculatedPlayer[];
  range: EloRangeOption;
  decay: EloDecaySettings | null;
  now: Date;
}): EloChartPoint[] {
  if (!matchHistory.length || !players.length) return [];

  const sorted = [...matchHistory].sort(
    (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime(),
  );
  const filtered = filterByRange(sorted, range, now);
  if (!filtered.length) return [];

  const names = new Map(players.map((p) => [p.playerId, p.playerName]));
  const elos = new Map<string, number>(players.map((p) => [p.playerId, BASE_ELO]));
  const lastPlayed = new Map<string, Date>();

  const applyEntry = (entry: MatchHistoryEntry) => {
    const date = new Date(entry.matchDate);
    entry.results.forEach((r) => {
      elos.set(r.playerId, r.eloAfter);
      lastPlayed.set(r.playerId, date);
    });
  };

  const firstIndex = Math.max(
    0,
    sorted.findIndex((m) => m.matchId === filtered[0].matchId),
  );
  sorted.slice(0, firstIndex).forEach(applyEntry);

  const pointAt = (match: number, at: Date, isNow: boolean): EloChartPoint => {
    const point = { match, isNow } as EloChartPoint;
    elos.forEach((elo, playerId) => {
      const name = names.get(playerId);
      if (!name) return;
      const last = lastPlayed.get(playerId);
      point[name] = Math.round(decay && last ? applyEloDecay(elo, last, at, decay) : elo);
    });
    return point;
  };

  // Baseline point: state as of the last match before the visible range.
  const baselineDate = firstIndex > 0 ? new Date(sorted[firstIndex - 1].matchDate) : new Date(filtered[0].matchDate);
  const points: EloChartPoint[] = [pointAt(firstIndex, baselineDate, false)];

  filtered.forEach((entry, index) => {
    applyEntry(entry);
    points.push(pointAt(firstIndex + index + 1, new Date(entry.matchDate), false));
  });

  // The visible range ends at the newest match, so decay since then is still ongoing.
  const endsAtNewest = filtered.at(-1)?.matchId === sorted.at(-1)?.matchId;
  if (decay && endsAtNewest) {
    points.push(pointAt(firstIndex + filtered.length + 1, now, true));
  }

  return points;
}
