import { describe, expect, it } from 'vitest';
import { calculateElo } from '../../../convex/eloCalculation';

const dates = ['2026-01-01T00:00:00.000Z', '2026-01-31T00:00:00.000Z', '2026-02-01T00:00:00.000Z'];
const players = ['winner', 'loser'].map(id => ({ id, name: id, created_at: dates[0], updated_at: dates[0] }));
const matches = dates.map((created_at, i) => ({ id: `match-${i}`, winner_id: 'winner', loser_id: 'loser', match_type: '1v1', total_players: 2, created_at, participants: [] }));

describe('migrated Elo decay', () => {
  it('preserves the deployed source history while decaying output ratings', () => {
    const result = calculateElo(players, matches, true, 2026, true, new Date('2026-04-01T00:00:00.000Z'));
    const history = result.matchHistory.map(match => match.results.find(player => player.playerId === 'winner')!);
    expect(history[0].eloAfter).toBe(1032);
    expect(history[1].eloBefore).toBe(1032);
    expect(history[2].eloBefore).toBe(history[1].eloAfter);
    expect(result.decayAppliedInMatches).toBe(false);
    const winner = result.players.find(p => p.playerId === 'winner')!;
    expect(winner.currentElo).toBeLessThan(winner.rawElo);
    expect(result.decayStartDay).toBe(14);
  });

  it('keeps historical ratings unchanged when decay is disabled', () => {
    const result = calculateElo(players, matches, false, 2026, true, new Date(dates[2]));
    const history = result.matchHistory.map(match => match.results.find(player => player.playerId === 'winner')!);
    expect(history[1].eloBefore).toBe(history[0].eloAfter);
    expect(history[2].eloBefore).toBe(history[1].eloAfter);
    expect(result.decayAppliedInMatches).toBe(false);
  });
});
