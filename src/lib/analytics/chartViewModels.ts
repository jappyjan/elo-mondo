import { CountStat, PlayerMatchStats, PlayerThrowStats } from './types';

export interface BarDatum {
  label: string;
  value: number;
}

export interface ToneBarDatum extends BarDatum {
  displayValue: string;
  tone: 'good' | 'warning' | 'default';
}

const scoreBucketOrder = ['0-59', '60-99', '100-139', '140-179', '180'];

export function buildTopMoverBars(players: PlayerMatchStats[], limit = 6): ToneBarDatum[] {
  return [...players]
    .sort((left, right) => Math.abs(right.totalEloChange) - Math.abs(left.totalEloChange))
    .slice(0, limit)
    .map((player) => ({
      label: player.playerName,
      value: Math.abs(player.totalEloChange),
      displayValue: player.totalEloChange > 0 ? `+${player.totalEloChange}` : String(player.totalEloChange),
      tone: player.totalEloChange > 0 ? 'good' : player.totalEloChange < 0 ? 'warning' : 'default',
    }));
}

export function buildScoreDistribution(rows: CountStat[]): BarDatum[] {
  const counts = new Map(rows.map((row) => [row.label, row.count]));

  return scoreBucketOrder.map((label) => ({
    label,
    value: counts.get(label) ?? 0,
  }));
}

export function buildThrowTypeSplit(player: PlayerThrowStats | null | undefined): BarDatum[] {
  if (!player) return [];

  return [
    { label: 'Singles', value: player.singles },
    { label: 'Doubles', value: player.doubles },
    { label: 'Triples', value: player.triples },
    { label: 'Bulls', value: player.bulls },
    { label: 'Misses', value: player.missCount },
  ];
}

export function buildSegmentPopularity(rows: CountStat[], limit = 20): BarDatum[] {
  return rows.slice(0, limit).map((row) => ({ label: row.label, value: row.count }));
}
