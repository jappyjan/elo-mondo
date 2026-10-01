// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../../../convex/schema';
import { api, internal } from '../../../convex/_generated/api';

const modules = import.meta.glob('../../../convex/**/*.ts');
const now = '2026-01-01T00:00:00.000Z';
async function fixture() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.migration.importAccounts, { rows: [{ legacyId: 'legacy-owner', email: 'owner@example.test', disabled: false, emailVerificationTime: 1000 }] });
  await t.mutation(internal.migration.importBatch, { batch: { table: 'groups', rows: [{ id: 'group', name: 'DIGIMONDO', created_by: 'legacy-owner', created_at: now }] } });
  await t.mutation(internal.migration.importBatch, { batch: { table: 'players', rows: [
    { id: 'owner', name: 'Owner', user_id: 'legacy-owner', created_at: now, updated_at: now },
    { id: 'guest', name: 'Guest', user_id: null, created_at: now, updated_at: now },
  ] } });
  await t.mutation(internal.migration.importBatch, { batch: { table: 'group_members', rows: [{ id: 'membership', group_id: 'group', player_id: 'owner', role: 'admin', joined_at: now }] } });
  const user = await t.run(ctx => ctx.db.query('users').first());
  const owner = t.withIdentity({ subject: `${user!._id}|session` });
  return { t, owner };
}

describe('Convex migration and authorization', () => {
  it('preserves a migrated account-to-player mapping and requires a password reset', async () => {
    const { t, owner } = await fixture();
    expect(await owner.query(api.data.viewer)).toMatchObject({ id: 'legacy-owner', email: 'owner@example.test' });
    expect(await owner.query(api.data.myGroups)).toMatchObject([{ id: 'group', role: 'admin' }]);
    const accounts = await t.run(ctx => ctx.db.query('authAccounts').collect());
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ provider: 'password', providerAccountId: 'owner@example.test', emailVerified: 'owner@example.test' });
    expect(accounts[0].secret).toBeUndefined();
    expect((await t.query(api.data.players, {}))[0]).not.toHaveProperty('user_id');
  });

  it('rejects anonymous writes and hides private invite codes', async () => {
    const { t } = await fixture();
    await expect(t.mutation(api.data.recordMatch, { groupId: 'group', rankings: [{ playerId: 'owner', rank: 1 }, { playerId: 'guest', rank: 2 }], multiplayer: true })).rejects.toThrow('Group access');
    expect(await t.query(api.data.inviteCode, { groupId: 'group' })).toBeNull();
    expect(await t.query(api.data.viewer)).toBeNull();
  });

  it('records the match, all rankings, and memberships atomically', async () => {
    const { t, owner } = await fixture();
    const result = await owner.mutation(api.data.recordMatch, { groupId: 'group', rankings: [{ playerId: 'owner', rank: 1 }, { playerId: 'guest', rank: 2 }], multiplayer: true });
    expect(result.players).toHaveLength(2);
    const matches = await t.query(api.data.matches, { groupId: 'group' });
    expect(matches).toHaveLength(1);
    expect(matches[0].participants).toHaveLength(2);
    expect((await t.query(api.data.members, { groupId: 'group' })).map(m => m.player_id)).toContain('guest');
    await expect(owner.mutation(api.data.recordMatch, { groupId: 'group', rankings: [{ playerId: 'owner', rank: 1 }, { playerId: 'missing', rank: 2 }], multiplayer: true })).rejects.toThrow('Player not found');
    expect(await t.query(api.data.matches, { groupId: 'group' })).toHaveLength(1);
  });

  it('retries imports without duplicates and rejects conflicting rows', async () => {
    const { t } = await fixture();
    const row = { id: 'group', name: 'DIGIMONDO', created_by: 'legacy-owner', created_at: now };
    expect(await t.mutation(internal.migration.importBatch, { batch: { table: 'groups', rows: [row] } })).toEqual({ inserted: 0, existing: 1 });
    await expect(t.mutation(internal.migration.importBatch, { batch: { table: 'groups', rows: [{ ...row, name: 'Changed' }] } })).rejects.toThrow('refusing overwrite');
  });

  it('saves a finishing dart and ranks together, and undo restores the game', async () => {
    const { t, owner } = await fixture();
    const { game, players } = await owner.mutation(api.live.start, { groupId: 'group', gameType: '301', startRule: 'straight-in', endRule: 'straight-out', players: [{ id: 'owner', name: 'Owner' }, { id: 'guest', name: 'Guest' }] });
    const dart = { segment: 20, multiplier: 3, score: 60, label: 'T20' };
    await expect(t.mutation(api.live.addThrow, { gameId: game.id, gamePlayerId: players[0].id, turnNumber: 1, throwIndex: 0, dart, finishedRanks: [], completed: false })).rejects.toThrow('creator');
    await owner.mutation(api.live.addThrow, { gameId: game.id, gamePlayerId: players[0].id, turnNumber: 1, throwIndex: 0, dart, finishedRanks: players.map((p, i) => ({ playerId: p.id, rank: i + 1 })), completed: true });
    let loaded = await owner.query(api.live.load, { gameId: game.id, groupId: 'group' });
    expect(loaded?.game.status).toBe('completed');
    expect(loaded?.throws).toHaveLength(1);
    expect(loaded?.players.map(p => p.finished_rank)).toEqual([1, 2]);
    await owner.mutation(api.live.undo, { gameId: game.id, gamePlayerId: players[0].id, turnNumber: 1, throwIndex: 0, resetPlayerIds: players.map(p => p.id) });
    loaded = await owner.query(api.live.load, { gameId: game.id, groupId: 'group' });
    expect(loaded?.game.status).toBe('in_progress');
    expect(loaded?.throws).toHaveLength(0);
    expect(loaded?.players.every(p => p.finished_rank === null)).toBe(true);
  });
});
