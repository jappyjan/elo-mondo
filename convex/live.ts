import { ConvexError, v } from 'convex/values';
import { mutation, query, MutationCtx } from './_generated/server';
import { byId, currentUser, requireMember } from './data';

async function requireOwner(ctx: MutationCtx, gameId: string) {
  const game = await byId(ctx, 'live_games', gameId);
  const user = await currentUser(ctx);
  if (!game || !user || game.created_by !== (user.legacyId ?? user._id)) throw new ConvexError('Only the game creator can change this game');
  return game;
}
export const load = query({ args: { gameId: v.string(), groupId: v.string() }, handler: async (ctx, { gameId, groupId }) => {
  const game = await byId(ctx, 'live_games', gameId);
  if (!game || game.group_id !== groupId) return null;
  if (game.status !== 'completed') await requireMember(ctx, groupId);
  const players = await ctx.db.query('live_game_players').withIndex('by_game', q => q.eq('game_id', gameId)).collect();
  const throws = await ctx.db.query('game_throws').withIndex('by_game_date', q => q.eq('game_id', gameId)).collect();
  return { game, players, throws };
}});
export const start = mutation({
  args: { groupId: v.string(), gameType: v.union(v.literal('301'), v.literal('501')), startRule: v.union(v.literal('straight-in'), v.literal('double-in')), endRule: v.union(v.literal('straight-out'), v.literal('double-out')), players: v.array(v.object({ id: v.string(), name: v.string(), isTemporary: v.optional(v.boolean()) })) },
  handler: async (ctx, args) => {
    await requireMember(ctx, args.groupId);
    if (args.players.length < 2 || args.players.length > 32 || new Set(args.players.map(p => p.id)).size !== args.players.length) throw new ConvexError('Choose at least two different players');
    const user = (await currentUser(ctx))!;
    const game = { id: crypto.randomUUID(), group_id: args.groupId, created_by: user.legacyId ?? user._id, game_type: args.gameType, start_rule: args.startRule, end_rule: args.endRule, status: 'in_progress' as const, started_at: new Date().toISOString(), finished_at: null };
    await ctx.db.insert('live_games', game);
    const players = [];
    for (const [i, p] of args.players.entries()) {
      const registered = p.isTemporary ? null : await byId(ctx, 'players', p.id);
      if (!p.isTemporary && !registered) throw new ConvexError('Player not found');
      if (!p.name.trim() || p.name.length > 100) throw new ConvexError('Invalid player name');
      const player = { id: crypto.randomUUID(), game_id: game.id, player_id: registered?.id ?? null, player_name: registered?.name ?? p.name.trim(), is_temporary: !!p.isTemporary, play_order: i + 1, starting_score: Number(args.gameType), finished_rank: null };
      await ctx.db.insert('live_game_players', player);
      players.push(player);
    }
    return { game, players, throws: [] };
  },
});
export const abandon = mutation({ args: { gameId: v.string() }, handler: async (ctx, { gameId }) => {
  const game = await requireOwner(ctx, gameId);
  // Starting a new game must not hide a previously completed game from analytics.
  if (game.status === 'in_progress') await ctx.db.patch(game._id, { status: 'abandoned' });
}});
export const addThrow = mutation({
  args: { gameId: v.string(), gamePlayerId: v.string(), turnNumber: v.number(), throwIndex: v.number(), dart: v.object({ segment: v.number(), multiplier: v.number(), score: v.number(), label: v.string() }), finishedRanks: v.array(v.object({ playerId: v.string(), rank: v.number() })), completed: v.boolean() },
  handler: async (ctx, args) => {
    const game = await requireOwner(ctx, args.gameId);
    if (game.status !== 'in_progress') throw new ConvexError('Game is not in progress');
    const player = await byId(ctx, 'live_game_players', args.gamePlayerId);
    if (!player || player.game_id !== args.gameId) throw new ConvexError('Invalid game player');
    const { segment, multiplier, score } = args.dart;
    if (!Number.isInteger(segment) || ![0, ...Array.from({ length: 20 }, (_, i) => i + 1), 25, 50].includes(segment) || ![1, 2, 3].includes(multiplier) || !Number.isInteger(score) || score < 0 || score > 60 || args.dart.label.length > 20 || !Number.isInteger(args.turnNumber) || args.turnNumber < 1 || ![0, 1, 2].includes(args.throwIndex)) throw new ConvexError('Invalid dart');
    const prior = await ctx.db.query('game_throws').withIndex('by_throw', q => q.eq('game_id', args.gameId).eq('game_player_id', args.gamePlayerId).eq('turn_number', args.turnNumber).eq('throw_index', args.throwIndex)).first();
    if (prior) throw new ConvexError('This dart was already recorded. Reload the game.');
    const now = new Date().toISOString();
    await ctx.db.insert('game_throws', { id: crypto.randomUUID(), group_id: game.group_id, game_id: args.gameId, game_player_id: args.gamePlayerId, turn_number: args.turnNumber, throw_index: args.throwIndex, ...args.dart, created_at: now });
    const gamePlayers = await ctx.db.query('live_game_players').withIndex('by_game', q => q.eq('game_id', args.gameId)).collect();
    for (const rank of args.finishedRanks) {
      const target = gamePlayers.find(p => p.id === rank.playerId);
      if (!target || !Number.isInteger(rank.rank) || rank.rank < 1 || rank.rank > gamePlayers.length) throw new ConvexError('Invalid finished rank');
      await ctx.db.patch(target._id, { finished_rank: rank.rank });
    }
    if (args.completed) await ctx.db.patch(game._id, { status: 'completed', finished_at: now });
  },
});
export const lastThrow = query({ args: { gameId: v.string() }, handler: async (ctx, { gameId }) => {
  const game = await byId(ctx, 'live_games', gameId);
  if (!game) return null;
  await requireMember(ctx, game.group_id);
  return ctx.db.query('game_throws').withIndex('by_game_date', q => q.eq('game_id', gameId)).order('desc').first();
}});
export const undo = mutation({
  args: { gameId: v.string(), gamePlayerId: v.string(), turnNumber: v.number(), throwIndex: v.number(), resetPlayerIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const game = await requireOwner(ctx, args.gameId);
    const last = await ctx.db.query('game_throws').withIndex('by_game_date', q => q.eq('game_id', args.gameId)).order('desc').first();
    if (!last || last.game_player_id !== args.gamePlayerId || last.turn_number !== args.turnNumber || last.throw_index !== args.throwIndex) throw new ConvexError('Game changed. Reload before undoing.');
    await ctx.db.delete(last._id);
    for (const id of args.resetPlayerIds) {
      const player = await byId(ctx, 'live_game_players', id);
      if (!player || player.game_id !== game.id) throw new ConvexError('Invalid game player');
      await ctx.db.patch(player._id, { finished_rank: null });
    }
    if (game.status === 'completed') await ctx.db.patch(game._id, { status: 'in_progress', finished_at: null });
  },
});
