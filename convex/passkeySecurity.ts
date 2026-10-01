import { getAuthSessionId, getAuthUserId } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';

export const CHALLENGE_LIFETIME = 5 * 60 * 1000;
export const SESSION_LIFETIME = 30 * 86400000;

export async function passkeyIdentity(ctx: QueryCtx | MutationCtx, recent = false) {
  const userId = await getAuthUserId(ctx);
  const sessionId = await getAuthSessionId(ctx);
  if (!userId || !sessionId) return null;
  const user = await ctx.db.get(userId);
  const session = await ctx.db.get(sessionId);
  const proof = await ctx.db.query('passkeySessions').withIndex('by_session', q => q.eq('sessionId', sessionId)).unique();
  if (!user || user.disabled || !session || session.userId !== userId || session.expirationTime <= Date.now()
    || !proof || proof.userId !== userId || proof.epoch !== (user.passkeyEpoch ?? 0)
    || (recent && proof.verifiedAt < Date.now() - CHALLENGE_LIFETIME)) return null;
  const credential = await ctx.db.get(proof.credentialId);
  if (!credential || credential.userId !== userId) return null;
  return { user, session, proof };
}

export async function requirePasskey(ctx: QueryCtx | MutationCtx, recent = false) {
  const identity = await passkeyIdentity(ctx, recent);
  if (!identity) throw new ConvexError(recent ? 'Verify a passkey again to continue' : 'Sign in with a passkey to continue');
  return identity;
}

export async function deleteSession(ctx: MutationCtx, sessionId: Id<'authSessions'>) {
  for (const row of await ctx.db.query('authRefreshTokens').withIndex('sessionId', q => q.eq('sessionId', sessionId)).collect()) await ctx.db.delete(row._id);
  for (const row of await ctx.db.query('authVerifiers').collect()) if (row.sessionId === sessionId) await ctx.db.delete(row._id);
  for (const row of await ctx.db.query('passkeySessions').withIndex('by_session', q => q.eq('sessionId', sessionId)).collect()) await ctx.db.delete(row._id);
  if (await ctx.db.get(sessionId)) await ctx.db.delete(sessionId);
}
