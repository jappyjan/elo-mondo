// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { convexTest } from 'convex-test';
import schema from '../../../convex/schema';
import { internal } from '../../../convex/_generated/api';

const modules = import.meta.glob('../../../convex/**/*.ts');
const now = '2026-01-01T00:00:00.000Z';

describe('migration rehearsal cleanup', () => {
  it('deletes synthetic data and authentication records while preserving source records', async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.migration.importAccounts, { rows: [
      { legacyId: 'migration-rehearsal', email: 'migration-rehearsal@elomondo.invalid', disabled: false },
      { legacyId: 'real', email: 'real@example.test', disabled: false },
    ] });
    await t.run(async ctx => {
      await ctx.db.insert('groups', { id: 'migration-rehearsal-group', name: 'Migration rehearsal', created_by: 'migration-rehearsal', created_at: now });
      await ctx.db.insert('groups', { id: '8195d6b6-f5a5-455d-a9d6-a8adf37970cd', name: 'DIGIMONDO', created_by: 'real', created_at: now });
      await ctx.db.insert('players', { id: 'qa', name: 'Migration QA', user_id: 'migration-rehearsal', created_at: now, updated_at: now });
      await ctx.db.insert('group_members', { id: 'qa-membership', group_id: 'migration-rehearsal-group', player_id: 'qa', role: 'admin', joined_at: now });
      const user = await ctx.db.query('users').withIndex('by_legacy_id', q => q.eq('legacyId', 'migration-rehearsal')).unique();
      const sessionId = await ctx.db.insert('authSessions', { userId: user!._id, expirationTime: 1000 });
      await ctx.db.insert('authRefreshTokens', { sessionId, expirationTime: 1000 });
      await ctx.db.insert('authVerifiers', { sessionId });
    });
    expect(await t.mutation(internal.rehearsal.cleanup, { email: 'migration-rehearsal@elomondo.invalid' })).toEqual({ groups: 1, users: 1 });
    await t.run(async ctx => {
      expect((await ctx.db.query('groups').collect()).map(g => g.name)).toEqual(['DIGIMONDO']);
      expect((await ctx.db.query('users').collect()).map(u => u.legacyId)).toEqual(['real']);
      expect(await ctx.db.query('authAccounts').collect()).toHaveLength(1);
      expect(await ctx.db.query('authSessions').collect()).toHaveLength(0);
      expect(await ctx.db.query('authRefreshTokens').collect()).toHaveLength(0);
      expect(await ctx.db.query('authVerifiers').collect()).toHaveLength(0);
      expect(await ctx.db.query('players').collect()).toHaveLength(0);
    });
    await expect(t.mutation(internal.rehearsal.cleanup, { email: 'real@example.test' })).rejects.toThrow('Only synthetic');
  });

  it('refuses cleanup atomically if a synthetic account owns DIGIMONDO', async () => {
    const t = convexTest(schema, modules);
    await t.mutation(internal.migration.importAccounts, { rows: [{ legacyId: 'migration-rehearsal', email: 'migration-rehearsal@elomondo.invalid', disabled: false }] });
    await t.run(ctx => ctx.db.insert('groups', { id: '8195d6b6-f5a5-455d-a9d6-a8adf37970cd', name: 'DIGIMONDO', created_by: 'migration-rehearsal', created_at: now }));
    await expect(t.mutation(internal.rehearsal.cleanup, { email: 'migration-rehearsal@elomondo.invalid' })).rejects.toThrow('real group');
    expect(await t.run(ctx => ctx.db.query('users').collect())).toHaveLength(1);
    expect(await t.run(ctx => ctx.db.query('groups').collect())).toHaveLength(1);
  });
});
