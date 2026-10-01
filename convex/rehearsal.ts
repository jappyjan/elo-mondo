// CLI-only cleanup of explicitly named synthetic migration accounts/groups.
import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { byId } from './data';

export const cleanup = internalMutation({
  args: { email: v.optional(v.string()), userId: v.optional(v.id('users')) },
  handler: async (ctx, { email, userId: targetId }) => {
    if ((!email && !targetId) || (email && targetId) || (email && !/^migration-(rehearsal|validation-\d+)@elomondo\.invalid$/.test(email))) throw new Error('Only synthetic migration accounts can be removed');
    const user = targetId ? await ctx.db.get(targetId) : await ctx.db.query('users').withIndex('email', q => q.eq('email', email!)).unique();
    if (!user) return { groups: 0, users: 0 };
    if (targetId && (user.legacyId || !/^Passkey QA /.test(user.name ?? ''))) throw new Error('Only synthetic passkey accounts can be removed');
    if (user.legacyId && user.legacyId !== 'migration-rehearsal') throw new Error('Cannot remove a migrated source account');
    const userId = user.legacyId ?? user._id;
    const groups = (await ctx.db.query('groups').collect()).filter(g => g.created_by === userId);
    const ownedPlayers = await ctx.db.query('players').withIndex('by_user', q => q.eq('user_id', userId)).collect();
    const candidatePlayers = new Set(ownedPlayers.map(p => p.id));
    if (email === 'migration-rehearsal@elomondo.invalid') candidatePlayers.add('migration-rehearsal-guest');
    for (const group of groups) {
      if (group.id === '8195d6b6-f5a5-455d-a9d6-a8adf37970cd' || !/^Migration (rehearsal|validation)/.test(group.name)) throw new Error('Cannot remove a real group');
      const members = await ctx.db.query('group_members').withIndex('by_group', q => q.eq('group_id', group.id)).collect();
      for (const member of members) {
        const player = await byId(ctx, 'players', member.player_id);
        if (!player || (player.user_id !== userId && !(player.user_id === null && /^Migration (QA|validation)/.test(player.name)))) throw new Error('Group contains real players');
        candidatePlayers.add(player.id);
      }
      const matches = await ctx.db.query('matches').withIndex('by_group_date', q => q.eq('group_id', group.id)).collect();
      for (const match of matches) {
        for (const p of await ctx.db.query('match_participants').withIndex('by_match', q => q.eq('match_id', match.id)).collect()) await ctx.db.delete(p._id);
        await ctx.db.delete(match._id);
      }
      const games = await ctx.db.query('live_games').withIndex('by_group', q => q.eq('group_id', group.id)).collect();
      for (const game of games) {
        for (const dart of await ctx.db.query('game_throws').withIndex('by_game_date', q => q.eq('game_id', game.id)).collect()) await ctx.db.delete(dart._id);
        for (const p of await ctx.db.query('live_game_players').withIndex('by_game', q => q.eq('game_id', game.id)).collect()) await ctx.db.delete(p._id);
        await ctx.db.delete(game._id);
      }
      for (const m of members) await ctx.db.delete(m._id);
      for (const code of await ctx.db.query('group_invite_codes').withIndex('by_group', q => q.eq('group_id', group.id)).collect()) await ctx.db.delete(code._id);
      for (const invite of await ctx.db.query('group_invites').withIndex('by_group_email', q => q.eq('group_id', group.id)).collect()) await ctx.db.delete(invite._id);
      await ctx.db.delete(group._id);
    }
    const remainingMatches = await ctx.db.query('matches').collect();
    const remainingParticipants = await ctx.db.query('match_participants').collect();
    const remainingGamePlayers = await ctx.db.query('live_game_players').collect();
    for (const id of candidatePlayers) {
      if ((await ctx.db.query('group_members').withIndex('by_player', q => q.eq('player_id', id)).first()) || remainingMatches.some(m => m.winner_id === id || m.loser_id === id) || remainingParticipants.some(p => p.player_id === id) || remainingGamePlayers.some(p => p.player_id === id)) throw new Error('Synthetic player is referenced outside its validation group');
      const player = await byId(ctx, 'players', id);
      if (player) await ctx.db.delete(player._id);
    }
    const sessions = await ctx.db.query('authSessions').withIndex('userId', q => q.eq('userId', user._id)).collect();
    for (const session of sessions) {
      for (const token of await ctx.db.query('authRefreshTokens').withIndex('sessionId', q => q.eq('sessionId', session._id)).collect()) await ctx.db.delete(token._id);
      for (const verifier of (await ctx.db.query('authVerifiers').collect()).filter(v => v.sessionId === session._id)) await ctx.db.delete(verifier._id);
      await ctx.db.delete(session._id);
    }
    for (const account of await ctx.db.query('authAccounts').withIndex('userIdAndProvider', q => q.eq('userId', user._id)).collect()) {
      for (const code of await ctx.db.query('authVerificationCodes').withIndex('accountId', q => q.eq('accountId', account._id)).collect()) await ctx.db.delete(code._id);
      await ctx.db.delete(account._id);
    }
    if (email) for (const limit of await ctx.db.query('authRateLimits').withIndex('identifier', q => q.eq('identifier', email)).collect()) await ctx.db.delete(limit._id);
    for (const proof of await ctx.db.query('passkeySessions').withIndex('by_user', q => q.eq('userId', user._id)).collect()) await ctx.db.delete(proof._id);
    for (const key of await ctx.db.query('passkeys').withIndex('by_user', q => q.eq('userId', user._id)).collect()) await ctx.db.delete(key._id);
    for (const grant of await ctx.db.query('passkeyGrants').withIndex('by_user', q => q.eq('userId', user._id)).collect()) await ctx.db.delete(grant._id);
    for (const event of await ctx.db.query('passkeyAudit').withIndex('by_user', q => q.eq('userId', user._id)).collect()) await ctx.db.delete(event._id);
    for (const challenge of await ctx.db.query('passkeyChallenges').collect()) if (challenge.userId === user._id) await ctx.db.delete(challenge._id);
    await ctx.db.delete(user._id);
    return { groups: groups.length, users: 1 };
  },
});
