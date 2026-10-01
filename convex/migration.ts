// Administrative migration functions are internal: browsers cannot invoke them.
import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { businessTables } from './schema';
import { byId } from './data';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}

export const importAccounts = internalMutation({
  args: { rows: v.array(v.object({ legacyId: v.string(), email: v.string(), name: v.optional(v.string()), emailVerificationTime: v.optional(v.number()), disabled: v.boolean() })) },
  handler: async (ctx, { rows }) => {
    if (rows.length > 100) throw new Error('Batch is too large');
    let inserted = 0;
    for (const row of rows) {
      const existing = await ctx.db.query('users').withIndex('by_legacy_id', q => q.eq('legacyId', row.legacyId)).unique();
      if (existing) {
        if (existing.email !== row.email || !!existing.disabled !== row.disabled) throw new Error('Account conflicts with the source');
        continue;
      }
      if (await ctx.db.query('users').withIndex('email', q => q.eq('email', row.email)).first()) throw new Error('Email already belongs to another user');
      const userId = await ctx.db.insert('users', row);
      // No old hashes or shared temporary password: email reset is required.
      await ctx.db.insert('authAccounts', { userId, provider: 'password', providerAccountId: row.email, ...(row.emailVerificationTime ? { emailVerified: row.email } : {}) });
      inserted++;
    }
    return { inserted, existing: rows.length - inserted };
  },
});

export const importBatch = internalMutation({
  args: { batch: v.union(
    v.object({ table: v.literal('groups'), rows: v.array(businessTables.groups.validator) }),
    v.object({ table: v.literal('players'), rows: v.array(businessTables.players.validator) }),
    v.object({ table: v.literal('group_members'), rows: v.array(businessTables.group_members.validator) }),
    v.object({ table: v.literal('group_invite_codes'), rows: v.array(businessTables.group_invite_codes.validator) }),
    v.object({ table: v.literal('group_invites'), rows: v.array(businessTables.group_invites.validator) }),
    v.object({ table: v.literal('matches'), rows: v.array(businessTables.matches.validator) }),
    v.object({ table: v.literal('match_participants'), rows: v.array(businessTables.match_participants.validator) }),
    v.object({ table: v.literal('live_games'), rows: v.array(businessTables.live_games.validator) }),
    v.object({ table: v.literal('live_game_players'), rows: v.array(businessTables.live_game_players.validator) }),
    v.object({ table: v.literal('game_throws'), rows: v.array(businessTables.game_throws.validator) }),
  ) },
  handler: async (ctx, { batch }) => {
    if (batch.rows.length > 200) throw new Error('Batch is too large');
    let inserted = 0;
    for (const row of batch.rows) {
      const existing = await byId(ctx, batch.table, row.id);
      if (existing) {
        const { _id, _creationTime, ...businessFields } = existing;
        if (canonical(businessFields) !== canonical(row)) throw new Error(`Existing ${batch.table} record differs from source; refusing overwrite`);
      } else {
        await ctx.db.insert(batch.table, row);
        inserted++;
      }
    }
    return { inserted, existing: batch.rows.length - inserted };
  },
});
