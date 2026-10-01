import { ConvexError, v } from 'convex/values';
import { getAuthSessionId } from '@convex-dev/auth/server';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { CHALLENGE_LIFETIME, SESSION_LIFETIME, deleteSession, passkeyIdentity, requirePasskey } from './passkeySecurity';

const purpose = v.union(v.literal('authenticate'), v.literal('signup'), v.literal('claim'), v.literal('recover'), v.literal('add'));
const unavailable = () => new ConvexError('This code or passkey request is unavailable. Request a new one.');
const credentialFields = {
  credentialId: v.string(), publicKey: v.bytes(), counter: v.number(), transports: v.array(v.string()),
  deviceType: v.string(), backedUp: v.boolean(),
};

function validGrant(grant: Doc<'passkeyGrants'> | null) {
  return grant && grant.consumedAt === undefined && (grant.expiresAt === undefined || grant.expiresAt > Date.now());
}
async function revokeGrants(ctx: MutationCtx, userId: Id<'users'>, kind?: 'claim' | 'recovery') {
  for (const grant of await ctx.db.query('passkeyGrants').withIndex('by_user', q => q.eq('userId', userId)).collect()) {
    if (!kind || grant.kind === kind) await ctx.db.patch(grant._id, { consumedAt: Date.now() });
  }
}
async function revokeSessions(ctx: MutationCtx, userId: Id<'users'>) {
  for (const session of await ctx.db.query('authSessions').withIndex('userId', q => q.eq('userId', userId)).collect()) await deleteSession(ctx, session._id);
}

// Separate transaction: a subsequent failed action must not roll back rate-limit accounting.
export const consumeRate = internalMutation({
  args: { key: v.string(), limit: v.number() },
  handler: async (ctx, { key, limit }) => {
    const now = Date.now();
    const row = await ctx.db.query('passkeyRateLimits').withIndex('by_key', q => q.eq('key', key)).unique();
    if (!row) { await ctx.db.insert('passkeyRateLimits', { key, windowStart: now, count: 1 }); return true; }
    if (now - row.windowStart >= CHALLENGE_LIFETIME) { await ctx.db.patch(row._id, { windowStart: now, count: 1 }); return true; }
    if (row.count >= limit) return false;
    await ctx.db.patch(row._id, { count: row.count + 1 });
    return true;
  },
});

export const begin = internalMutation({
  args: { purpose, challenge: v.string(), nonceHash: v.string(), rpId: v.string(), origin: v.string(),
    handle: v.string(), name: v.string(), grantHash: v.string(), recoveryHashes: v.array(v.string()) },
  handler: async (ctx, args) => {
    let user: Doc<'users'> | null = null;
    let grant: Doc<'passkeyGrants'> | null = null;
    let sessionId: Id<'authSessions'> | undefined;
    let name = args.name.trim();
    if (args.purpose === 'signup') {
      if (name.length < 2 || name.length > 100) throw new ConvexError('Display name must be between 2 and 100 characters');
      if (await ctx.db.query('players').withIndex('by_name', q => q.eq('name', name)).first()) throw new ConvexError('That player name is already in use. Existing players need a claim code.');
    } else if (args.purpose === 'claim' || args.purpose === 'recover') {
      grant = await ctx.db.query('passkeyGrants').withIndex('by_hash', q => q.eq('hash', args.grantHash)).unique();
      if (!validGrant(grant) || grant!.kind !== (args.purpose === 'claim' ? 'claim' : 'recovery')) throw unavailable();
      user = await ctx.db.get(grant!.userId);
      if (!user || user.disabled || (args.purpose === 'claim' && (!user.claimEligible || user.passkeyMigratedAt !== undefined))) throw unavailable();
    } else if (args.purpose === 'add') {
      const identity = await requirePasskey(ctx, true);
      user = identity.user;
      sessionId = identity.session._id;
    }
    if (user) {
      const player = await ctx.db.query('players').withIndex('by_user', q => q.eq('user_id', user!.legacyId ?? user!._id)).unique();
      name = player?.name ?? user.name ?? 'Player';
    }
    const handle = user?.passkeyHandle ?? args.handle;
    if (args.recoveryHashes.length !== (args.purpose === 'authenticate' || args.purpose === 'add' ? 0 : 5)) throw unavailable();
    const id = await ctx.db.insert('passkeyChallenges', {
      purpose: args.purpose, challenge: args.challenge, nonceHash: args.nonceHash, rpId: args.rpId, origin: args.origin,
      ...(user ? { userId: user._id } : {}), ...(sessionId ? { sessionId } : {}), ...(grant ? { grantId: grant._id } : {}),
      name, handle, recoveryHashes: args.recoveryHashes, epoch: user?.passkeyEpoch ?? 0,
      expiresAt: Date.now() + CHALLENGE_LIFETIME, status: 'pending',
    });
    const credentials = user ? await ctx.db.query('passkeys').withIndex('by_user', q => q.eq('userId', user!._id)).collect() : [];
    if (credentials.length >= 20) throw new ConvexError('Remove an unused passkey before adding another');
    return { id, name, handle, excludeCredentials: credentials.map(c => ({ id: c.credentialId, transports: c.transports })) };
  },
});

// Reserving consumes an attempt before crypto verification. Even failed signatures cannot reuse it.
export const reserve = internalMutation({
  args: { challengeId: v.id('passkeyChallenges'), nonceHash: v.string() },
  handler: async (ctx, { challengeId, nonceHash }) => {
    const challenge = await ctx.db.get(challengeId);
    if (!challenge || challenge.status !== 'pending' || challenge.expiresAt <= Date.now() || challenge.nonceHash !== nonceHash) throw unavailable();
    await ctx.db.patch(challengeId, { status: 'verifying' });
    return challenge;
  },
});
export const credential = internalQuery({
  args: { credentialId: v.string() },
  handler: async (ctx, { credentialId }) => ctx.db.query('passkeys').withIndex('by_credential', q => q.eq('credentialId', credentialId)).unique(),
});

export const complete = internalMutation({
  args: { challengeId: v.id('passkeyChallenges'), nonceHash: v.string(), credential: v.object(credentialFields),
    previousCounter: v.optional(v.number()), userHandle: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ userId: Id<'users'>; sessionId: Id<'authSessions'> }> => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge || challenge.status !== 'verifying' || challenge.expiresAt <= Date.now() || challenge.nonceHash !== args.nonceHash) throw unavailable();
    const existing = await ctx.db.query('passkeys').withIndex('by_credential', q => q.eq('credentialId', args.credential.credentialId)).unique();
    let user = challenge.userId ? await ctx.db.get(challenge.userId) : null;
    let credentialId: Id<'passkeys'>;
    if (challenge.purpose === 'authenticate') {
      if (!existing || existing.counter !== args.previousCounter) throw unavailable();
      user = await ctx.db.get(existing.userId);
      if (!user || user.disabled || (args.userHandle !== undefined && args.userHandle !== user.passkeyHandle)) throw unavailable();
      // The verifier handles valid zero counters used by synced passkeys.
      await ctx.db.patch(existing._id, { counter: args.credential.counter, backedUp: args.credential.backedUp, lastUsedAt: Date.now() });
      credentialId = existing._id;
    } else {
      if (existing) throw new ConvexError('This passkey is already registered');
      if (challenge.purpose === 'signup') {
        if (await ctx.db.query('players').withIndex('by_name', q => q.eq('name', challenge.name)).first()) throw new ConvexError('That player name is already in use');
        const userId = await ctx.db.insert('users', { name: challenge.name, passkeyHandle: challenge.handle, passkeyEpoch: 0 });
        user = (await ctx.db.get(userId))!;
        const now = new Date().toISOString();
        await ctx.db.insert('players', { id: crypto.randomUUID(), name: challenge.name, user_id: userId, created_at: now, updated_at: now });
      } else {
        if (!user || user.disabled || (user.passkeyEpoch ?? 0) !== challenge.epoch) throw unavailable();
        if (challenge.purpose === 'add') {
          const identity = await requirePasskey(ctx, true);
          if (identity.user._id !== user._id || identity.session._id !== challenge.sessionId) throw unavailable();
        } else {
          const grant = challenge.grantId ? await ctx.db.get(challenge.grantId) : null;
          if (!validGrant(grant) || grant!.userId !== user._id || grant!.kind !== (challenge.purpose === 'claim' ? 'claim' : 'recovery')) throw unavailable();
          if (challenge.purpose === 'claim' && (!user.claimEligible || user.passkeyMigratedAt !== undefined)) throw unavailable();
          await revokeGrants(ctx, user._id);
          await revokeSessions(ctx, user._id);
          if (challenge.purpose === 'recover') {
            // A stolen/lost authenticator must not be able to regain access after recovery.
            for (const key of await ctx.db.query('passkeys').withIndex('by_user', q => q.eq('userId', user!._id)).collect()) await ctx.db.delete(key._id);
            await ctx.db.patch(user._id, { passkeyEpoch: challenge.epoch + 1 });
            user = (await ctx.db.get(user._id))!;
          }
        }
      }
      credentialId = await ctx.db.insert('passkeys', { ...args.credential, userId: user!._id, name: 'Passkey', createdAt: Date.now() });
      await ctx.db.patch(user!._id, { passkeyHandle: challenge.handle, passkeyMigratedAt: user!.passkeyMigratedAt ?? Date.now(), claimEligible: false });
      for (const hash of challenge.recoveryHashes) await ctx.db.insert('passkeyGrants', { userId: user!._id, kind: 'recovery', hash, createdAt: Date.now() });
    }
    if (!user || user.disabled) throw unavailable();
    // Final checks and session proof are atomic with the credential/grant commit. Convex Auth
    // receives this session ID and handles token generation/refresh rather than creating one.
    const previousSessionId = await getAuthSessionId(ctx);
    if (previousSessionId) await deleteSession(ctx, previousSessionId);
    const sessionId = await ctx.db.insert('authSessions', { userId: user._id, expirationTime: Date.now() + SESSION_LIFETIME });
    await ctx.db.insert('passkeySessions', { sessionId, userId: user._id, credentialId, verifiedAt: Date.now(), epoch: user.passkeyEpoch ?? 0 });
    await ctx.db.patch(challenge._id, { status: 'consumed' });
    await ctx.db.insert('passkeyAudit', { userId: user._id, event: challenge.purpose, at: Date.now() });
    return { userId: user._id, sessionId };
  },
});

export const list = query({ args: {}, handler: async ctx => {
  const identity = await passkeyIdentity(ctx);
  if (!identity) return [];
  const { user } = identity;
  return (await ctx.db.query('passkeys').withIndex('by_user', q => q.eq('userId', user._id)).collect()).map(key => ({
    id: key._id, name: key.name, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt,
  }));
}});
export const rename = mutation({ args: { id: v.id('passkeys'), name: v.string() }, handler: async (ctx, { id, name }) => {
  const { user } = await requirePasskey(ctx, true);
  const key = await ctx.db.get(id);
  if (!key || key.userId !== user._id) throw unavailable();
  name = name.trim();
  if (!name || name.length > 100) throw new ConvexError('Enter a passkey name of at most 100 characters');
  await ctx.db.patch(id, { name });
}});
export const remove = mutation({ args: { id: v.id('passkeys') }, handler: async (ctx, { id }) => {
  const { user } = await requirePasskey(ctx, true);
  const keys = await ctx.db.query('passkeys').withIndex('by_user', q => q.eq('userId', user._id)).collect();
  if (!keys.some(key => key._id === id)) throw unavailable();
  if (keys.length <= 1) throw new ConvexError('Add another passkey before removing your last one');
  for (const proof of await ctx.db.query('passkeySessions').withIndex('by_user', q => q.eq('userId', user._id)).collect()) {
    if (proof.credentialId === id) await deleteSession(ctx, proof.sessionId);
  }
  await ctx.db.delete(id);
  await ctx.db.insert('passkeyAudit', { userId: user._id, event: 'remove-passkey', at: Date.now() });
}});
export const replaceRecovery = internalMutation({ args: { hashes: v.array(v.string()) }, handler: async (ctx, { hashes }) => {
  const { user } = await requirePasskey(ctx, true);
  if (hashes.length !== 5) throw unavailable();
  await revokeGrants(ctx, user._id, 'recovery');
  for (const hash of hashes) await ctx.db.insert('passkeyGrants', { userId: user._id, kind: 'recovery', hash, createdAt: Date.now() });
  await ctx.db.insert('passkeyAudit', { userId: user._id, event: 'replace-recovery-codes', at: Date.now() });
}});

// Internal administration only. An explicit override records that the operator checked
// ownership of an activated/admin account; ordinary claim issuance cannot touch it.
export const issueClaim = internalMutation({ args: {
  legacyId: v.string(), hash: v.string(), expiresAt: v.number(), allowActivatedAccount: v.boolean(),
}, handler: async (ctx, args) => {
  const user = await ctx.db.query('users').withIndex('by_legacy_id', q => q.eq('legacyId', args.legacyId)).unique();
  if (!user || user.disabled || user.passkeyMigratedAt !== undefined
    || await ctx.db.query('passkeys').withIndex('by_user', q => q.eq('userId', user._id)).first()) throw unavailable();
  const accounts = await ctx.db.query('authAccounts').withIndex('userIdAndProvider', q => q.eq('userId', user._id)).collect();
  const sessions = await ctx.db.query('authSessions').withIndex('userId', q => q.eq('userId', user._id)).collect();
  const player = await ctx.db.query('players').withIndex('by_user', q => q.eq('user_id', user.legacyId!)).unique();
  const isAdmin = player && (await ctx.db.query('group_members').withIndex('by_player', q => q.eq('player_id', player.id)).collect()).some(m => m.role === 'admin');
  if (!args.allowActivatedAccount && (accounts.some(a => a.secret !== undefined) || sessions.length || isAdmin)) throw new ConvexError('Activated/admin account: check ownership, then explicitly allow its migration');
  if (args.expiresAt <= Date.now() || args.expiresAt > Date.now() + 7 * 86400000) throw unavailable();
  await revokeGrants(ctx, user._id, 'claim');
  await ctx.db.patch(user._id, { claimEligible: true });
  await ctx.db.insert('passkeyGrants', { userId: user._id, kind: 'claim', hash: args.hash, createdAt: Date.now(), expiresAt: args.expiresAt });
  await ctx.db.insert('passkeyAudit', { userId: user._id, event: args.allowActivatedAccount ? 'issue-reviewed-claim' : 'issue-claim', at: Date.now() });
  return { name: player?.name ?? user.name ?? 'Player', legacyId: user.legacyId };
}});

export const auditLegacy = internalQuery({ args: {}, handler: async ctx => {
  return Promise.all((await ctx.db.query('users').collect()).map(async user => {
    const player = await ctx.db.query('players').withIndex('by_user', q => q.eq('user_id', user.legacyId ?? user._id)).unique();
    const accounts = await ctx.db.query('authAccounts').withIndex('userIdAndProvider', q => q.eq('userId', user._id)).collect();
    const sessions = await ctx.db.query('authSessions').withIndex('userId', q => q.eq('userId', user._id)).collect();
    const memberships = player ? await ctx.db.query('group_members').withIndex('by_player', q => q.eq('player_id', player.id)).collect() : [];
    return { id: user._id, legacyId: user.legacyId, name: player?.name ?? user.name, disabled: !!user.disabled,
      migrated: user.passkeyMigratedAt !== undefined, hasPassword: accounts.some(a => a.secret !== undefined),
      hasSessions: sessions.length > 0, isAdmin: memberships.some(m => m.role === 'admin') };
  }));
}});

export const retireEmailAuth = internalMutation({ args: { dryRun: v.boolean() }, handler: async (ctx, { dryRun }) => {
  const users = await ctx.db.query('users').collect();
  const unprepared: string[] = [];
  for (const user of users) {
    if (user.disabled || user.passkeyMigratedAt !== undefined) continue;
    const grants = await ctx.db.query('passkeyGrants').withIndex('by_user', q => q.eq('userId', user._id)).collect();
    if (!user.claimEligible || !grants.some(g => g.kind === 'claim' && validGrant(g))) unprepared.push(user.legacyId ?? user._id);
  }
  if (dryRun) return { unprepared, retired: false };
  if (unprepared.length) throw new ConvexError('Issue and distribute individual claim codes before retiring email authentication');
  for (const user of users) {
    const proofs = await ctx.db.query('passkeySessions').withIndex('by_user', q => q.eq('userId', user._id)).collect();
    for (const session of await ctx.db.query('authSessions').withIndex('userId', q => q.eq('userId', user._id)).collect()) {
      if (!proofs.some(p => p.sessionId === session._id)) await deleteSession(ctx, session._id);
    }
    await ctx.db.patch(user._id, { email: undefined, emailVerificationTime: undefined });
  }
  for (const code of await ctx.db.query('authVerificationCodes').collect()) await ctx.db.delete(code._id);
  // Clean up orphaned records as well as tokens attached to removed sessions.
  for (const token of await ctx.db.query('authRefreshTokens').collect()) {
    if (!await ctx.db.get(token.sessionId)) await ctx.db.delete(token._id);
  }
  for (const verifier of await ctx.db.query('authVerifiers').collect()) {
    if (!verifier.sessionId || !await ctx.db.get(verifier.sessionId)) await ctx.db.delete(verifier._id);
  }
  for (const account of await ctx.db.query('authAccounts').collect()) await ctx.db.delete(account._id);
  for (const invite of await ctx.db.query('group_invites').collect()) await ctx.db.delete(invite._id);
  for (const limit of await ctx.db.query('authRateLimits').collect()) await ctx.db.delete(limit._id);
  return { unprepared, retired: true };
}});

export const cleanupChallenges = internalMutation({ args: {}, handler: async ctx => {
  const rows = await ctx.db.query('passkeyChallenges').withIndex('by_expiry', q => q.lt('expiresAt', Date.now() - 86400000)).take(500);
  for (const row of rows) await ctx.db.delete(row._id);
  for (const proof of await ctx.db.query('passkeySessions').take(500)) {
    const session = await ctx.db.get(proof.sessionId);
    if (!session || session.expirationTime <= Date.now()) await deleteSession(ctx, proof.sessionId);
  }
}});
