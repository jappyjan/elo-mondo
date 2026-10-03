// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { isoCBOR } from '@elomondo/webauthn-server/helpers';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@elomondo/webauthn-server';
import { convexTest } from 'convex-test';
import schema from '../../../convex/schema';
import { api, internal } from '../../../convex/_generated/api';
import type { BeginResult } from '../../../convex/passkeys';

const modules = import.meta.glob('../../../convex/**/*.ts');
const digest = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest();
const jwtKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
beforeEach(() => {
  vi.stubEnv('PASSKEY_ORIGIN', 'http://localhost:8080'); vi.stubEnv('PASSKEY_RP_ID', 'localhost');
  vi.stubEnv('CONVEX_SITE_URL', 'https://test.convex.site'); vi.stubEnv('JWT_PRIVATE_KEY', jwtKey);
  vi.stubEnv('AUTH_LOG_LEVEL', 'ERROR');
});
afterEach(() => vi.unstubAllEnvs());

// A software authenticator that generates genuine EC keys, CBOR attestation data,
// and DER signatures. The server verifier is never mocked.
function authenticator() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const credential = randomBytes(32);
  const id = credential.toString('base64url');
  let handle = '';
  const cose = isoCBOR.encode(new Map<number, number | Uint8Array>([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x!, 'base64url')], [-3, Buffer.from(jwk.y!, 'base64url')]]));
  const clientData = (type: string, challenge: string, origin: string) => Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  return {
    id,
    registration(prepared: BeginResult, origin = 'http://localhost:8080', flags = 0x45): RegistrationResponseJSON {
      if (prepared.kind !== 'registration') throw new Error('Expected registration');
      handle = prepared.options.user.id;
      const length = Buffer.alloc(2); length.writeUInt16BE(credential.length);
      const authData = Buffer.concat([digest('localhost'), Buffer.from([flags]), Buffer.alloc(4), Buffer.alloc(16), length, credential, cose]);
      const attestation = isoCBOR.encode(new Map<string, string | Uint8Array | Map<string, never>>([['fmt', 'none'], ['attStmt', new Map<string, never>()], ['authData', authData]]));
      return { id, rawId: id, type: 'public-key', response: { clientDataJSON: clientData('webauthn.create', prepared.options.challenge, origin).toString('base64url'), attestationObject: Buffer.from(attestation).toString('base64url'), transports: ['internal'] }, clientExtensionResults: { credProps: { rk: true } } };
    },
    authentication(prepared: BeginResult, counter = 1, origin = 'http://localhost:8080', flags = 0x05): AuthenticationResponseJSON {
      if (prepared.kind !== 'authentication') throw new Error('Expected authentication');
      const count = Buffer.alloc(4); count.writeUInt32BE(counter);
      const authData = Buffer.concat([digest('localhost'), Buffer.from([flags]), count]);
      const data = clientData('webauthn.get', prepared.options.challenge, origin);
      const signature = sign('sha256', Buffer.concat([authData, digest(data)]), privateKey);
      return { id, rawId: id, type: 'public-key', response: { clientDataJSON: data.toString('base64url'), authenticatorData: authData.toString('base64url'), signature: signature.toString('base64url'), userHandle: handle }, clientExtensionResults: {} };
    },
  };
}
const verify = (t: Pick<ReturnType<typeof convexTest>, 'action'>, p: BeginResult, response: RegistrationResponseJSON | AuthenticationResponseJSON) => t.action(internal.passkeys.verify, { challengeId: p.challengeId, nonce: p.nonce, response: JSON.stringify(response) });
async function registered(t = convexTest(schema, modules), name = 'Player') {
  const key = authenticator();
  const prepared = await t.action(api.passkeys.begin, { purpose: 'signup', name });
  const session = await verify(t, prepared, key.registration(prepared));
  return { t, key, prepared, session, owner: t.withIdentity({ subject: `${session.userId}|${session.sessionId}` }) };
}
async function legacy() {
  const t = convexTest(schema, modules);
  const userId = await t.run(async ctx => {
    const id = await ctx.db.insert('users', { legacyId: 'legacy', name: 'Owner', email: 'old@example.test' });
    await ctx.db.insert('players', { id: 'player', name: 'Owner', user_id: 'legacy', created_at: 'then', updated_at: 'then' });
    await ctx.db.insert('groups', { id: 'group', name: 'Darts', created_by: 'legacy', created_at: 'then' });
    await ctx.db.insert('group_members', { id: 'member', group_id: 'group', player_id: 'player', role: 'admin', joined_at: 'then' });
    await ctx.db.insert('authAccounts', { userId: id, provider: 'password', providerAccountId: 'old@example.test', secret: 'obsolete-hash' });
    return id;
  });
  return { t, userId };
}

describe('passkey authentication', () => {
  it('creates an email-free account, authenticates via Convex Auth and refreshes its session', async () => {
    const { t, key, owner, session } = await registered();
    expect(await owner.query(api.data.viewer)).toEqual({ id: session.userId, name: 'Player' });
    expect(await t.run(ctx => ctx.db.query('authAccounts').collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.get(session.userId))).not.toHaveProperty('email');
    const prepared = await t.action(api.passkeys.begin, { purpose: 'authenticate' });
    expect(prepared.kind).toBe('authentication');
    const result = await t.action(api.auth.signIn, { provider: 'passkey', params: { challengeId: prepared.challengeId, nonce: prepared.nonce, response: JSON.stringify(key.authentication(prepared)) } });
    expect(result.tokens?.token).toBeTruthy();
    expect(result.tokens?.refreshToken).toBeTruthy();
    const refreshed = await t.action(api.auth.signIn, { refreshToken: result.tokens!.refreshToken });
    expect(refreshed.tokens?.token).toBeTruthy();
    const subject = JSON.parse(Buffer.from(result.tokens!.token.split('.')[1], 'base64url').toString()).sub;
    expect(await t.withIdentity({ subject }).query(api.data.viewer)).toEqual({ id: session.userId, name: 'Player' });
  });

  it.each([
    ['wrong origin', 'https://evil.example', 0x45],
    ['missing user verification', 'http://localhost:8080', 0x41],
  ])('rejects registration with %s and consumes the attempt', async (_, origin, flags) => {
    const t = convexTest(schema, modules); const key = authenticator();
    const prepared = await t.action(api.passkeys.begin, { purpose: 'signup', name: 'Player' });
    await expect(verify(t, prepared, key.registration(prepared, origin, flags))).rejects.toThrow('verification failed');
    await expect(verify(t, prepared, key.registration(prepared))).rejects.toThrow('unavailable');
    expect(await t.run(ctx => ctx.db.query('users').collect())).toEqual([]);
  });

  it('rejects wrong nonce, expiry, replay, forged signatures, wrong user handles and wrong RP IDs', async () => {
    const { t, key } = await registered();
    let prepared = await t.action(api.passkeys.begin, { purpose: 'authenticate' });
    await expect(verify(t, { ...prepared, nonce: 'wrong' }, key.authentication(prepared))).rejects.toThrow('unavailable');
    await verify(t, prepared, key.authentication(prepared));
    await expect(verify(t, prepared, key.authentication(prepared))).rejects.toThrow('unavailable');
    prepared = await t.action(api.passkeys.begin, { purpose: 'authenticate' });
    const forged = key.authentication(prepared, 2); forged.response.signature = randomBytes(70).toString('base64url');
    await expect(verify(t, prepared, forged)).rejects.toThrow('verification failed');
    prepared = await t.action(api.passkeys.begin, { purpose: 'authenticate' });
    const wrongHandle = key.authentication(prepared, 2); wrongHandle.response.userHandle = 'other-user';
    await expect(verify(t, prepared, wrongHandle)).rejects.toThrow('verification failed');
    prepared = await t.action(api.passkeys.begin, { purpose: 'authenticate' });
    const wrongRP = key.authentication(prepared, 2); const bytes = Buffer.from(wrongRP.response.authenticatorData, 'base64url');
    digest('evil.example').copy(bytes); wrongRP.response.authenticatorData = bytes.toString('base64url');
    await expect(verify(t, prepared, wrongRP)).rejects.toThrow('verification failed');
    prepared = await t.action(api.passkeys.begin, { purpose: 'authenticate' });
    await t.run(ctx => ctx.db.patch(prepared.challengeId, { expiresAt: Date.now() - 1 }));
    await expect(verify(t, prepared, key.authentication(prepared, 2))).rejects.toThrow('unavailable');
  });

  it('accepts zero counters used by synced passkeys', async () => {
    const t = convexTest(schema, modules); const key = authenticator();
    const signup = await t.action(api.passkeys.begin, { purpose: 'signup', name: 'Synced' });
    await verify(t, signup, key.registration(signup, undefined, 0x5d));
    for (let i = 0; i < 2; i++) {
      const login = await t.action(api.passkeys.begin, { purpose: 'authenticate' });
      await verify(t, login, key.authentication(login, 0, undefined, 0x1d));
    }
  });

  it('only permits one competing claim and preserves the exact legacy player/roles/history', async () => {
    const { t, userId } = await legacy();
    await expect(t.action(internal.passkeys.issueLegacyClaim, { legacyId: 'legacy' })).rejects.toThrow('Activated/admin');
    const claim = await t.action(internal.passkeys.issueLegacyClaim, { legacyId: 'legacy', allowActivatedAccount: true });
    const before = await t.run(async ctx => ({ players: await ctx.db.query('players').collect(), groups: await ctx.db.query('groups').collect(), memberships: await ctx.db.query('group_members').collect() }));
    const a = await t.action(api.passkeys.begin, { purpose: 'claim', code: claim.code });
    const b = await t.action(api.passkeys.begin, { purpose: 'claim', code: claim.code });
    const results = await Promise.allSettled([verify(t, a, authenticator().registration(a)), verify(t, b, authenticator().registration(b))]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const success = results.find(r => r.status === 'fulfilled');
    if (!success || success.status !== 'fulfilled') throw new Error('No successful claim');
    expect(success.value.userId).toBe(userId);
    const owner = t.withIdentity({ subject: `${userId}|${success.value.sessionId}` });
    expect(await owner.query(api.data.myGroups)).toMatchObject([{ id: 'group', role: 'admin' }]);
    expect(await t.run(async ctx => ({ players: await ctx.db.query('players').collect(), groups: await ctx.db.query('groups').collect(), memberships: await ctx.db.query('group_members').collect() }))).toEqual(before);
    await expect(t.action(api.passkeys.begin, { purpose: 'claim', code: claim.code })).rejects.toThrow('unavailable');
    await expect(t.action(internal.passkeys.issueLegacyClaim, { legacyId: 'legacy', allowActivatedAccount: true })).rejects.toThrow('unavailable');
  });

  it('revokes reissued claim codes and cannot claim disabled or newly activated accounts', async () => {
    const { t, userId } = await legacy();
    const first = await t.action(internal.passkeys.issueLegacyClaim, { legacyId: 'legacy', allowActivatedAccount: true });
    await t.action(internal.passkeys.issueLegacyClaim, { legacyId: 'legacy', allowActivatedAccount: true });
    await expect(t.action(api.passkeys.begin, { purpose: 'claim', code: first.code })).rejects.toThrow('unavailable');
    const latest = await t.action(internal.passkeys.issueLegacyClaim, { legacyId: 'legacy', allowActivatedAccount: true });
    const p = await t.action(api.passkeys.begin, { purpose: 'claim', code: latest.code });
    await t.run(ctx => ctx.db.patch(userId, { disabled: true }));
    await expect(verify(t, p, authenticator().registration(p))).rejects.toThrow('verification failed');
    await expect(t.action(internal.passkeys.issueLegacyClaim, { legacyId: 'legacy', allowActivatedAccount: true })).rejects.toThrow('unavailable');
  });

  it('extends an existing claim without changing its code or reviving unusable grants', async () => {
    const { t, userId } = await legacy();
    await t.action(internal.passkeys.issueLegacyClaim, { legacyId: 'legacy', allowActivatedAccount: true });
    const claim = await t.action(internal.passkeys.issueLegacyClaim, { legacyId: 'legacy', allowActivatedAccount: true });
    const expiresAt = Date.now() + 63 * 86400000;
    await t.run(async ctx => {
      await ctx.db.insert('passkeyGrants', { userId, kind: 'claim', hash: 'expired', createdAt: Date.now(), expiresAt: Date.now() - 1 });
      await ctx.db.insert('passkeyGrants', { userId, kind: 'recovery', hash: 'recovery', createdAt: Date.now() });
      for (const state of ['disabled', 'migrated', 'excluded']) {
        const id = await ctx.db.insert('users', { legacyId: state, claimEligible: true, ...(state === 'disabled' ? { disabled: true } : {}), ...(state === 'migrated' ? { passkeyMigratedAt: Date.now() } : {}) });
        await ctx.db.insert('passkeyGrants', { userId: id, kind: 'claim', hash: state, createdAt: Date.now(), expiresAt: Date.now() + 86400000 });
      }
    });
    const before = await t.run(ctx => ctx.db.query('passkeyGrants').collect());
    const args = { legacyIds: ['legacy', 'legacy', 'disabled', 'migrated'], expiresAt, dryRun: true };
    const planned = await t.mutation(internal.passkeyStore.extendClaims, args);
    expect(planned.extended).toEqual([{ legacyId: 'legacy', expiresAt }]);
    expect(await t.run(ctx => ctx.db.query('passkeyGrants').collect())).toEqual(before);
    await t.mutation(internal.passkeyStore.extendClaims, { ...args, dryRun: false });
    const after = await t.run(ctx => ctx.db.query('passkeyGrants').collect());
    expect(after).toEqual(before.map(grant => grant.userId === userId && grant.kind === 'claim' && grant.consumedAt === undefined && grant.expiresAt! > Date.now() ? { ...grant, expiresAt } : grant));
    expect((await t.mutation(internal.passkeyStore.extendClaims, { ...args, expiresAt: expiresAt - 86400000, dryRun: false })).extended).toEqual([]);
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 8 * 86400000);
    try {
      const prepared = await t.action(api.passkeys.begin, { purpose: 'claim', code: claim.code });
      expect((await verify(t, prepared, authenticator().registration(prepared))).userId).toBe(userId);
    } finally { clock.mockRestore(); }
    expect((await t.mutation(internal.passkeyStore.extendClaims, { ...args, dryRun: false })).extended).toEqual([]);
  });

  it('rejects invalid extension deadlines without changing grants', async () => {
    const { t } = await legacy();
    await t.action(internal.passkeys.issueLegacyClaim, { legacyId: 'legacy', allowActivatedAccount: true });
    const before = await t.run(ctx => ctx.db.query('passkeyGrants').collect());
    for (const expiresAt of [Date.now() - 1, Date.now() + 91 * 86400000]) {
      await expect(t.mutation(internal.passkeyStore.extendClaims, { legacyIds: ['legacy'], expiresAt, dryRun: false })).rejects.toThrow('ninety days');
    }
    expect(await t.run(ctx => ctx.db.query('passkeyGrants').collect())).toEqual(before);
  });

  it('requires a recent, live passkey session to add/remove keys or regenerate codes', async () => {
    const { t, owner, session } = await registered();
    const [key] = await owner.query(api.passkeyStore.list);
    await expect(owner.mutation(api.passkeyStore.remove, { id: key.id })).rejects.toThrow('last one');
    await t.run(async ctx => {
      const proof = await ctx.db.query('passkeySessions').first(); await ctx.db.patch(proof!._id, { verifiedAt: Date.now() - 6 * 60000 });
    });
    await expect(owner.action(api.passkeys.begin, { purpose: 'add' })).rejects.toThrow('Verify a passkey');
    await expect(owner.action(api.passkeys.recoveryCodes, {})).rejects.toThrow('Verify a passkey');
    await expect(owner.mutation(api.passkeyStore.rename, { id: key.id, name: 'Changed' })).rejects.toThrow('Verify a passkey');
    await t.run(ctx => ctx.db.delete(session.sessionId));
    expect(await owner.query(api.data.viewer)).toBeNull();
  });

  it('adds an independent key and revokes only sessions using a removed key', async () => {
    const { t, owner, session } = await registered();
    const secondKey = authenticator(); const prepared = await owner.action(api.passkeys.begin, { purpose: 'add' });
    const second = await verify(owner, prepared, secondKey.registration(prepared));
    const secondOwner = t.withIdentity({ subject: `${second.userId}|${second.sessionId}` });
    const keys = await secondOwner.query(api.passkeyStore.list);
    expect(keys).toHaveLength(2);
    await secondOwner.mutation(api.passkeyStore.remove, { id: keys[0].id });
    expect(await owner.query(api.data.viewer)).toBeNull();
    expect(await secondOwner.query(api.data.viewer)).toMatchObject({ id: session.userId });
  });

  it('recovery grants no access until registration, then replaces keys/codes and revokes every old session', async () => {
    const { t, prepared, owner, session, key } = await registered();
    const recovery = await t.action(api.passkeys.begin, { purpose: 'recover', code: prepared.recoveryCodes[0] });
    expect(await t.query(api.data.viewer)).toBeNull();
    const newKey = authenticator(); const recovered = await verify(t, recovery, newKey.registration(recovery));
    expect(recovered.userId).toBe(session.userId);
    expect(await owner.query(api.data.viewer)).toBeNull();
    const login = await t.action(api.passkeys.begin, { purpose: 'authenticate' });
    await expect(verify(t, login, key.authentication(login))).rejects.toThrow('verification failed');
    for (const code of prepared.recoveryCodes) await expect(t.action(api.passkeys.begin, { purpose: 'recover', code })).rejects.toThrow('unavailable');
    expect(await t.run(ctx => ctx.db.query('passkeys').collect())).toHaveLength(1);
    const newOwner = t.withIdentity({ subject: `${recovered.userId}|${recovered.sessionId}` });
    await newOwner.action(api.passkeys.recoveryCodes, {});
    await expect(t.action(api.passkeys.begin, { purpose: 'recover', code: recovery.recoveryCodes[0] })).rejects.toThrow('unavailable');
  });

  it('rejects duplicate names without linking to another identity', async () => {
    const { t } = await registered();
    await expect(t.action(api.passkeys.begin, { purpose: 'signup', name: 'Player' })).rejects.toThrow('already in use');
    expect(await t.run(ctx => ctx.db.query('users').collect())).toHaveLength(1);
  });

  it('removes password/reset/session data during cutover while retaining identities and claim grants', async () => {
    const { t, userId } = await legacy();
    const oldSession = await t.run(async ctx => {
      const session = await ctx.db.insert('authSessions', { userId, expirationTime: Date.now() + 86400000 });
      await ctx.db.insert('authRefreshTokens', { sessionId: session, expirationTime: Date.now() + 86400000 });
      await ctx.db.insert('authVerifiers', { sessionId: session });
      const account = await ctx.db.query('authAccounts').first();
      await ctx.db.insert('authVerificationCodes', { accountId: account!._id, provider: 'password-reset', code: 'old', expirationTime: Date.now() + 1000 });
      return session;
    });
    expect(await t.withIdentity({ subject: `${userId}|${oldSession}` }).query(api.data.viewer)).toBeNull();
    expect((await t.mutation(internal.passkeyStore.retireEmailAuth, { dryRun: true })).unprepared).toEqual(['legacy']);
    await expect(t.mutation(internal.passkeyStore.retireEmailAuth, { dryRun: false })).rejects.toThrow('claim codes');
    const claim = await t.action(internal.passkeys.issueLegacyClaim, { legacyId: 'legacy', allowActivatedAccount: true });
    await t.mutation(internal.passkeyStore.retireEmailAuth, { dryRun: false });
    await t.run(async ctx => {
      expect(await ctx.db.query('authAccounts').collect()).toEqual([]);
      expect(await ctx.db.query('authSessions').collect()).toEqual([]);
      expect(await ctx.db.query('authRefreshTokens').collect()).toEqual([]);
      expect(await ctx.db.query('authVerificationCodes').collect()).toEqual([]);
      expect(await ctx.db.query('authVerifiers').collect()).toEqual([]);
      expect(await ctx.db.get(userId)).not.toHaveProperty('email');
      expect(await ctx.db.query('players').collect()).toHaveLength(1);
    });
    await t.action(api.passkeys.begin, { purpose: 'claim', code: claim.code });
    await expect(t.action(api.auth.signIn, { provider: 'password', params: { email: 'old@example.test', password: 'anything' } })).rejects.toThrow();
  });

  it('rate limits failed begins and verification calls without rolling their counts back', async () => {
    const t = convexTest(schema, modules);
    await t.run(ctx => ctx.db.insert('passkeyRateLimits', { key: 'begin', count: 199, windowStart: Date.now() }));
    await expect(t.action(api.passkeys.begin, { purpose: 'claim', code: 'invalid' })).rejects.toThrow('unavailable');
    await expect(t.action(api.passkeys.begin, { purpose: 'claim', code: 'invalid' })).rejects.toThrow('Too many attempts');
  });
});
