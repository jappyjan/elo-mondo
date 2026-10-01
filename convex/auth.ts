import { ConvexCredentials } from '@convex-dev/auth/providers/ConvexCredentials';
import { convexAuth } from '@convex-dev/auth/server';
import { ConvexError } from 'convex/values';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [ConvexCredentials({
    id: 'passkey',
    authorize: async (params, ctx): Promise<{ userId: Id<'users'>; sessionId: Id<'authSessions'> }> => {
      if (typeof params.challengeId !== 'string' || typeof params.nonce !== 'string' || typeof params.response !== 'string') {
        throw new ConvexError('Complete a passkey prompt to sign in');
      }
      return ctx.runAction(internal.passkeys.verify, {
        challengeId: params.challengeId as Id<'passkeyChallenges'>, nonce: params.nonce, response: params.response,
      });
    },
  })],
});
