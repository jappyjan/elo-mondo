import { AnalyticsMatch, PlayerMatchStats } from './types';

interface MutablePlayerMatchStats extends PlayerMatchStats {
  finishRankTotal: number;
}

export function getPlayerKey(playerId: string | null | undefined, playerName: string): string {
  return playerId || `name:${playerName.trim().toLowerCase()}`;
}

function formatRank(rank: number): string {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `${rank}th`;
}

function createPlayerStats(key: string, playerId: string | null, playerName: string): MutablePlayerMatchStats {
  return {
    key,
    playerId,
    playerName,
    matches: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    averageFinishRank: 0,
    totalEloChange: 0,
    bestEloGain: 0,
    worstEloLoss: 0,
    recentForm: [],
    placements: [],
    finishRankTotal: 0,
  };
}

export function buildPlayerMatchStats(matches: AnalyticsMatch[]): PlayerMatchStats[] {
  const players = new Map<string, MutablePlayerMatchStats>();
  const placementCounts = new Map<string, Map<number, number>>();

  matches
    .slice()
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate))
    .forEach((match) => {
      match.participants.forEach((participant) => {
        const key = getPlayerKey(participant.playerId, participant.playerName);
        const existing = players.get(key) ?? createPlayerStats(key, participant.playerId, participant.playerName);
        const eloResult = participant.playerId
          ? match.eloResults.find((result) => result.playerId === participant.playerId)
          : undefined;

        existing.matches += 1;
        existing.wins += participant.rank === 1 ? 1 : 0;
        existing.losses += participant.rank === 1 ? 0 : 1;
        existing.finishRankTotal += participant.rank;
        existing.totalEloChange += eloResult?.eloChange ?? 0;
        existing.bestEloGain = Math.max(existing.bestEloGain, eloResult?.eloChange ?? 0);
        existing.worstEloLoss = Math.min(existing.worstEloLoss, eloResult?.eloChange ?? 0);
        existing.recentForm = [...existing.recentForm, formatRank(participant.rank)].slice(-10);

        const counts = placementCounts.get(key) ?? new Map<number, number>();
        counts.set(participant.rank, (counts.get(participant.rank) ?? 0) + 1);
        placementCounts.set(key, counts);
        players.set(key, existing);
      });
    });

  return Array.from(players.values())
    .map(({ finishRankTotal, ...player }) => ({
      ...player,
      winRate: player.matches > 0 ? player.wins / player.matches : 0,
      averageFinishRank: player.matches > 0 ? Math.round((finishRankTotal / player.matches) * 10) / 10 : 0,
      placements: Array.from(placementCounts.get(player.key)?.entries() ?? [])
        .map(([rank, count]) => ({ rank, count }))
        .sort((a, b) => a.rank - b.rank),
    }))
    .sort((a, b) => b.totalEloChange - a.totalEloChange || b.matches - a.matches);
}
