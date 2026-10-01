import { getAuthUserId } from '@convex-dev/auth/server';
import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { mutation, query, QueryCtx, MutationCtx } from './_generated/server';
import { Doc } from './_generated/dataModel';
import { businessTables } from './schema';
import { calculateElo } from './eloCalculation';

type ReadCtx = QueryCtx | MutationCtx;
export async function byId<T extends keyof typeof businessTables>(ctx: ReadCtx, table: T, id: string): Promise<Doc<T> | null> {
  return await ctx.db.query(table as keyof typeof businessTables).withIndex('by_business_id', q => q.eq('id', id)).unique() as unknown as Doc<T> | null;
}
export async function currentUser(ctx: ReadCtx) {
  const id = await getAuthUserId(ctx);
  const user = id ? await ctx.db.get(id) : null;
  return user && !user.disabled ? user : null;
}
export async function membership(ctx: ReadCtx, groupId: string) {
  const user = await currentUser(ctx);
  if (!user) return null;
  const player = await ctx.db.query('players').withIndex('by_user', q => q.eq('user_id', user.legacyId ?? user._id)).unique();
  return player ? ctx.db.query('group_members').withIndex('by_group_player', q => q.eq('group_id', groupId).eq('player_id', player.id)).unique() : null;
}
export async function requireMember(ctx: ReadCtx, groupId: string, admin = false) {
  const member = await membership(ctx, groupId);
  if (!member || (admin && member.role !== 'admin')) throw new ConvexError('Group access required');
  return member;
}
function publicPlayer(player: { id: string; name: string; created_at: string; updated_at: string }) {
  return { id: player.id, name: player.name, created_at: player.created_at, updated_at: player.updated_at };
}
export const viewer = query({ args: {}, handler: async ctx => {
  const user = await currentUser(ctx);
  return user ? { id: user.legacyId ?? user._id, email: user.email, name: user.name } : null;
}});
export const group = query({ args: { groupId: v.string() }, handler: async (ctx, { groupId }) => byId(ctx, 'groups', groupId) });
export const players = query({ args: { ids: v.optional(v.array(v.string())) }, handler: async (ctx, { ids }) => {
  const rows = ids ? await Promise.all(ids.map(id => byId(ctx, 'players', id))) : await ctx.db.query('players').withIndex('by_name').collect();
  return rows.filter(p => p !== null).map(publicPlayer);
}});
export const members = query({ args: { groupId: v.string() }, handler: async (ctx, { groupId }) => {
  const rows = await ctx.db.query('group_members').withIndex('by_group', q => q.eq('group_id', groupId)).collect();
  return Promise.all(rows.map(async row => {
    const player = await byId(ctx, 'players', row.player_id);
    return { ...row, player: player ? publicPlayer(player) : null };
  }));
}});
export const currentMembership = query({ args: { groupId: v.string() }, handler: (ctx, { groupId }) => membership(ctx, groupId) });
export const inviteCode = query({ args: { groupId: v.string() }, handler: async (ctx, { groupId }) => {
  if ((await membership(ctx, groupId))?.role !== 'admin') return null;
  const code = await ctx.db.query('group_invite_codes').withIndex('by_group', q => q.eq('group_id', groupId)).unique();
  return code ? { invite_code: code.invite_code } : null;
}});
export const myGroups = query({ args: {}, handler: async ctx => {
  const user = await currentUser(ctx);
  if (!user) return [];
  const player = await ctx.db.query('players').withIndex('by_user', q => q.eq('user_id', user.legacyId ?? user._id)).unique();
  if (!player) return [];
  const members = await ctx.db.query('group_members').withIndex('by_player', q => q.eq('player_id', player.id)).collect();
  const groups = await Promise.all(members.map(async member => ({ ...(await byId(ctx, 'groups', member.group_id)), role: member.role })));
  return groups.filter(g => g.id);
}});
export async function joinedMatches(ctx: ReadCtx, groupId: string) {
  const rows = await ctx.db.query('matches').withIndex('by_group_date', q => q.eq('group_id', groupId)).collect();
  const players = await ctx.db.query('players').collect();
  const lookup = new Map(players.map(p => [p.id, publicPlayer(p)]));
  return Promise.all(rows.map(async match => ({
    ...match, winner: lookup.get(match.winner_id)!, loser: lookup.get(match.loser_id)!,
    participants: (await ctx.db.query('match_participants').withIndex('by_match', q => q.eq('match_id', match.id)).collect()).map(p => ({ ...p, player: lookup.get(p.player_id)! })),
  })));
}
export const matches = query({ args: { groupId: v.string() }, handler: (ctx, { groupId }) => joinedMatches(ctx, groupId) });
export const elo = query({ args: { groupId: v.string(), applyDecay: v.boolean(), year: v.union(v.number(), v.null()), includeProvisional: v.boolean() }, handler: async (ctx, args) => {
  const members = await ctx.db.query('group_members').withIndex('by_group', q => q.eq('group_id', args.groupId)).collect();
  const players = (await Promise.all(members.map(m => byId(ctx, 'players', m.player_id)))).filter(p => p !== null);
  return calculateElo(players, await joinedMatches(ctx, args.groupId), args.applyDecay, args.year, args.includeProvisional);
}});
export const throwsPage = query({
  args: { groupId: v.string(), start: v.optional(v.string()), end: v.optional(v.string()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { groupId, start, end, paginationOpts }) => {
    const result = await ctx.db.query('game_throws').withIndex('by_group_date', q => {
      const base = q.eq('group_id', groupId);
      if (start && end) return base.gte('created_at', start).lte('created_at', end);
      if (start) return base.gte('created_at', start);
      if (end) return base.lte('created_at', end);
      return base;
    }).paginate(paginationOpts);
    const games = new Map((await ctx.db.query('live_games').withIndex('by_group', q => q.eq('group_id', groupId)).collect()).map(g => [g.id, g]));
    const page = await Promise.all(result.page.filter(t => games.get(t.game_id)?.status === 'completed').map(async dart => {
      const player = await byId(ctx, 'live_game_players', dart.game_player_id);
      return { ...dart, live_games: games.get(dart.game_id)!, live_game_players: player! };
    }));
    return { ...result, page };
  },
});

async function addMembership(ctx: MutationCtx, groupId: string, playerId: string, role: 'admin' | 'member' = 'member') {
  const existing = await ctx.db.query('group_members').withIndex('by_group_player', q => q.eq('group_id', groupId).eq('player_id', playerId)).unique();
  if (!existing) await ctx.db.insert('group_members', { id: crypto.randomUUID(), group_id: groupId, player_id: playerId, role, joined_at: new Date().toISOString() });
}
export const createGroup = mutation({ args: { name: v.string() }, handler: async (ctx, { name }) => {
  const user = await currentUser(ctx);
  if (!user) throw new ConvexError('Login required');
  name = name.trim();
  if (!name || name.length > 100) throw new ConvexError('Enter a group name');
  const player = await ctx.db.query('players').withIndex('by_user', q => q.eq('user_id', user.legacyId ?? user._id)).unique();
  if (!player) throw new ConvexError('Player profile is missing');
  const group = { id: crypto.randomUUID(), name, created_by: user.legacyId ?? user._id, created_at: new Date().toISOString() };
  await ctx.db.insert('groups', group);
  await addMembership(ctx, group.id, player.id, 'admin');
  await ctx.db.insert('group_invite_codes', { id: crypto.randomUUID(), group_id: group.id, invite_code: crypto.randomUUID().replace(/-/g, ''), created_at: group.created_at });
  return group;
}});
export const joinGroup = mutation({ args: { code: v.string() }, handler: async (ctx, { code }) => {
  const user = await currentUser(ctx);
  if (!user) throw new ConvexError('Login required');
  const invite = await ctx.db.query('group_invite_codes').withIndex('by_code', q => q.eq('invite_code', code.trim())).unique();
  if (!invite) throw new ConvexError('Invalid invite code');
  const player = await ctx.db.query('players').withIndex('by_user', q => q.eq('user_id', user.legacyId ?? user._id)).unique();
  if (!player) throw new ConvexError('Player profile is missing');
  await addMembership(ctx, invite.group_id, player.id);
  return invite.group_id;
}});
export const createInvite = mutation({ args: { groupId: v.string(), email: v.string() }, handler: async (ctx, { groupId, email }) => {
  await requireMember(ctx, groupId, true);
  const user = (await currentUser(ctx))!;
  email = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ConvexError('Enter a valid email');
  const existing = await ctx.db.query('group_invites').withIndex('by_group_email', q => q.eq('group_id', groupId).eq('email', email)).unique();
  if (existing) throw new ConvexError('This email has already been invited');
  await ctx.db.insert('group_invites', { id: crypto.randomUUID(), group_id: groupId, email, invited_by: user.legacyId ?? user._id, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 7 * 86400000).toISOString() });
}});
export const addPlayer = mutation({ args: { name: v.string(), groupId: v.optional(v.string()) }, handler: async (ctx, { name, groupId }) => {
  if (!await currentUser(ctx)) throw new ConvexError('Login required');
  if (groupId) await requireMember(ctx, groupId);
  name = name.trim();
  if (name.length < 2 || name.length > 100) throw new ConvexError('Enter a player name');
  if (await ctx.db.query('players').withIndex('by_name', q => q.eq('name', name)).first()) throw new ConvexError('Player already exists');
  const now = new Date().toISOString();
  const player = { id: crypto.randomUUID(), name, user_id: null, created_at: now, updated_at: now };
  await ctx.db.insert('players', player);
  if (groupId) await addMembership(ctx, groupId, player.id);
  return publicPlayer(player);
}});
export const ensureTempPlayer = mutation({ args: { groupId: v.string(), name: v.string() }, handler: async (ctx, { groupId, name }) => {
  await requireMember(ctx, groupId);
  name = name.trim();
  if (!name || name.length > 100) throw new ConvexError('Enter a player name');
  const all = await ctx.db.query('players').collect();
  const existing = all.find(p => p.name.trim().toLowerCase() === name.toLowerCase());
  const id = existing?.id ?? crypto.randomUUID();
  if (!existing) {
    const now = new Date().toISOString();
    await ctx.db.insert('players', { id, name, user_id: null, created_at: now, updated_at: now });
  }
  await addMembership(ctx, groupId, id);
  return id;
}});
export const recordMatch = mutation({
  args: { groupId: v.string(), rankings: v.array(v.object({ playerId: v.string(), rank: v.number() })), multiplayer: v.boolean() },
  handler: async (ctx, { groupId, rankings, multiplayer }) => {
    await requireMember(ctx, groupId);
    if (rankings.length < 2 || rankings.length > 32 || new Set(rankings.map(r => r.playerId)).size !== rankings.length || rankings.some(r => !Number.isInteger(r.rank) || r.rank < 1 || r.rank > rankings.length) || !rankings.some(r => r.rank === 1)) throw new ConvexError('Invalid rankings');
    const sorted = [...rankings].sort((a, b) => a.rank - b.rank);
    if (sorted[0].rank === sorted.at(-1)!.rank) throw new ConvexError('A match needs different placements');
    const players = await Promise.all(rankings.map(async r => {
      const p = await byId(ctx, 'players', r.playerId);
      if (!p) throw new ConvexError('Player not found');
      return { ...publicPlayer(p), rank: r.rank };
    }));
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await ctx.db.insert('matches', { id, group_id: groupId, winner_id: sorted[0].playerId, loser_id: sorted.at(-1)!.playerId, match_type: multiplayer ? 'multiplayer' : '1v1', total_players: rankings.length, created_at: now });
    for (const r of rankings) {
      await addMembership(ctx, groupId, r.playerId);
      if (multiplayer) await ctx.db.insert('match_participants', { id: crypto.randomUUID(), match_id: id, player_id: r.playerId, is_winner: r.rank === 1, rank: r.rank, created_at: now });
    }
    return { id, players, winner: players.find(p => p.id === sorted[0].playerId)!, loser: players.find(p => p.id === sorted.at(-1)!.playerId)! };
  },
});
