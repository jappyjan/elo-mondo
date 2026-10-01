'use node';

import { createHash, randomBytes } from 'node:crypto';
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@elomondo/webauthn-server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@elomondo/webauthn-server';
import { ConvexError, v } from 'convex/values';
import { action, internalAction } from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { ActionCtx } from './_generated/server';

const randomSecret = () => randomBytes(32).toString('base64url');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const purpose = v.union(v.literal('authenticate'), v.literal('signup'), v.literal('claim'), v.literal('recover'), v.literal('add'));

function configuration() {
  const origin = process.env.PASSKEY_ORIGIN ?? 'https://elo.janjaap.de';
  const url = new URL(origin);
  const rpId = process.env.PASSKEY_RP_ID ?? url.hostname;
  if (url.origin !== origin || (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) || rpId !== url.hostname) {
    throw new Error('Configure PASSKEY_ORIGIN as an exact HTTPS origin and PASSKEY_RP_ID as its hostname');
  }
  return { origin, rpId };
}
async function rate(ctx: ActionCtx, key: string, limit: number) {
  if (!await ctx.runMutation(internal.passkeyStore.consumeRate, { key, limit })) throw new ConvexError('Too many attempts. Please try again in five minutes.');
}

export type BeginResult = {
  challengeId: Id<'passkeyChallenges'>; nonce: string; name: string; recoveryCodes: string[];
} & ({ kind: 'authentication'; options: PublicKeyCredentialRequestOptionsJSON } | { kind: 'registration'; options: PublicKeyCredentialCreationOptionsJSON });

export const begin = action({
  args: { purpose, name: v.optional(v.string()), code: v.optional(v.string()) },
  handler: async (ctx, args): Promise<BeginResult> => {
    await rate(ctx, 'begin', 200);
    if ((args.name?.length ?? 0) > 100 || (args.code?.length ?? 0) > 100) throw new ConvexError('Invalid passkey request');
    const { origin, rpId } = configuration();
    const nonce = randomSecret();
    const challengeBytes = randomBytes(32);
    const recoveryCodes = args.purpose === 'authenticate' || args.purpose === 'add' ? [] : Array.from({ length: 5 }, () => `elo-recovery-${randomSecret()}`);
    const prepared = await ctx.runMutation(internal.passkeyStore.begin, {
      purpose: args.purpose, name: args.name ?? '', grantHash: hash((args.code ?? '').trim()),
      challenge: challengeBytes.toString('base64url'), nonceHash: hash(nonce), origin, rpId,
      handle: randomSecret(), recoveryHashes: recoveryCodes.map(hash),
    });
    const common = { challengeId: prepared.id, nonce, name: prepared.name, recoveryCodes };
    if (args.purpose === 'authenticate') {
      return { ...common, kind: 'authentication', options: await generateAuthenticationOptions({ rpID: rpId, challenge: challengeBytes, allowCredentials: [], userVerification: 'required' }) };
    }
    return { ...common, kind: 'registration', options: await generateRegistrationOptions({
      rpName: 'EloMondo', rpID: rpId, userName: `${prepared.name} (${prepared.handle.slice(0, 6)})`, userDisplayName: prepared.name,
      userID: Buffer.from(prepared.handle, 'base64url'), challenge: challengeBytes, attestationType: 'none',
      excludeCredentials: prepared.excludeCredentials, supportedAlgorithmIDs: [-7, -257, -8],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' }, extensions: { credProps: true },
    }) };
  },
});

export const verify = internalAction({
  args: { challengeId: v.id('passkeyChallenges'), nonce: v.string(), response: v.string() },
  handler: async (ctx, args): Promise<{ userId: Id<'users'>; sessionId: Id<'authSessions'> }> => {
    await rate(ctx, 'verify', 200);
    if (args.nonce.length > 100 || args.response.length > 65536) throw new ConvexError('Invalid passkey response');
    const nonceHash = hash(args.nonce);
    const challenge = await ctx.runMutation(internal.passkeyStore.reserve, { challengeId: args.challengeId, nonceHash });
    // Reject ceremonies opened before a configuration change as well.
    const config = configuration();
    if (challenge.origin !== config.origin || challenge.rpId !== config.rpId) throw new ConvexError('Request a new passkey prompt');
    try {
      const response = JSON.parse(args.response) as RegistrationResponseJSON | AuthenticationResponseJSON;
      if (!response || typeof response.id !== 'string' || response.id.length > 2048) throw new Error('Invalid credential');
      if (challenge.purpose === 'authenticate') {
        const authentication = response as AuthenticationResponseJSON;
        const credential = await ctx.runQuery(internal.passkeyStore.credential, { credentialId: response.id });
        if (!credential || !authentication.response.userHandle) throw new Error('Unknown passkey');
        await rate(ctx, `user:${credential.userId}`, 30);
        const result = await verifyAuthenticationResponse({
          response: authentication, expectedChallenge: challenge.challenge, expectedOrigin: challenge.origin, expectedRPID: challenge.rpId,
          requireUserVerification: true,
          credential: { id: credential.credentialId, publicKey: new Uint8Array(credential.publicKey), counter: credential.counter },
        });
        if (!result.verified) throw new Error('Verification failed');
        return await ctx.runMutation(internal.passkeyStore.complete, {
          challengeId: args.challengeId, nonceHash, previousCounter: credential.counter, userHandle: authentication.response.userHandle,
          credential: { credentialId: credential.credentialId, publicKey: credential.publicKey, counter: result.authenticationInfo.newCounter,
            transports: credential.transports, deviceType: result.authenticationInfo.credentialDeviceType, backedUp: result.authenticationInfo.credentialBackedUp },
        });
      }
      if (challenge.userId) await rate(ctx, `user:${challenge.userId}`, 30);
      const registration = response as RegistrationResponseJSON;
      const result = await verifyRegistrationResponse({
        response: registration, expectedChallenge: challenge.challenge, expectedOrigin: challenge.origin, expectedRPID: challenge.rpId,
        requireUserVerification: true, supportedAlgorithmIDs: [-7, -257, -8],
      });
      if (!result.verified || registration.clientExtensionResults.credProps?.rk === false) throw new Error('A discoverable passkey is required');
      const info = result.registrationInfo;
      return await ctx.runMutation(internal.passkeyStore.complete, {
        challengeId: args.challengeId, nonceHash,
        credential: { credentialId: info.credential.id, publicKey: Uint8Array.from(info.credential.publicKey).buffer,
          counter: info.credential.counter, transports: info.credential.transports ?? [], deviceType: info.credentialDeviceType, backedUp: info.credentialBackedUp },
      });
    } catch {
      // Avoid exposing account details, grant secrets, verifier internals, or raw browser responses.
      throw new ConvexError('Passkey verification failed. Start again and use a passkey for this account.');
    }
  },
});

export const recoveryCodes = action({ args: {}, handler: async (ctx): Promise<string[]> => {
  const codes = Array.from({ length: 5 }, () => `elo-recovery-${randomSecret()}`);
  await ctx.runMutation(internal.passkeyStore.replaceRecovery, { hashes: codes.map(hash) });
  return codes;
}});

export const issueLegacyClaim = internalAction({
  args: { legacyId: v.string(), allowActivatedAccount: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<{ code: string; name: string; legacyId: string | undefined; expiresAt: number }> => {
    const code = `elo-claim-${randomSecret()}`;
    const expiresAt = Date.now() + 7 * 86400000;
    const account = await ctx.runMutation(internal.passkeyStore.issueClaim, {
      legacyId: args.legacyId, allowActivatedAccount: args.allowActivatedAccount ?? false, hash: hash(code), expiresAt,
    });
    return { ...account, code, expiresAt };
  },
});
