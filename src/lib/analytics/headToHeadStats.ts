import { AnalyticsMatch, PairwiseRecord } from './types';

interface HeadToHeadResult {
  records: PairwiseRecord[];
  rivalryLeaders: PairwiseRecord[];
  dominanceLeaders: PairwiseRecord[];
}

function emptyRecord(player: { key: string; playerId: string | null; playerName: string }, opponent: { key: string; playerId: string | null; playerName: string }): PairwiseRecord {
  return {
    key: player.key,
    playerId: player.playerId,
    playerName: player.playerName,
    opponentKey: opponent.key,
    opponentId: opponent.playerId,
    opponentName: opponent.playerName,
    wins: 0,
    losses: 0,
    totalGames: 0,
    winRate: 0,
    eloChange: 0,
    meetings: [],
  };
}

export function buildHeadToHeadStats(matches: AnalyticsMatch[]): HeadToHeadResult {
  const records = new Map<string, PairwiseRecord>();

  matches
    .slice()
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate))
    .forEach((match) => {
      match.participants.forEach((player) => {
        match.participants.forEach((opponent) => {
          if (player.key === opponent.key || player.rank === opponent.rank) return;

          const recordKey = `${player.key}__${opponent.key}`;
          const record = records.get(recordKey) ?? emptyRecord(player, opponent);
          const eloChange = player.playerId
            ? match.eloResults.find((result) => result.playerId === player.playerId)?.eloChange ?? 0
            : 0;

          record.totalGames += 1;
          record.wins += player.rank < opponent.rank ? 1 : 0;
          record.losses += player.rank > opponent.rank ? 1 : 0;
          record.eloChange += eloChange;
          record.meetings.push({
            matchId: match.matchId,
            matchDate: match.matchDate,
            playerRank: player.rank,
            opponentRank: opponent.rank,
            eloChange,
          });
          records.set(recordKey, record);
        });
      });
    });

  const finalized = Array.from(records.values()).map((record) => ({
    ...record,
    winRate: record.totalGames > 0 ? record.wins / record.totalGames : 0,
  }));

  return {
    records: finalized,
    rivalryLeaders: finalized.slice().sort((a, b) => b.totalGames - a.totalGames || b.wins - a.wins).slice(0, 10),
    dominanceLeaders: finalized
      .filter((record) => record.totalGames >= 1)
      .sort((a, b) => b.winRate - a.winRate || b.totalGames - a.totalGames)
      .slice(0, 10),
  };
}
