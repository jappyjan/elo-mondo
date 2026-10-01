import { useAuthActions } from '@convex-dev/auth/react';
import { startAuthentication, startRegistration } from '@elomondo/webauthn-browser';
import { convex, api } from '@/integrations/convex/client';
import { ConvexError } from 'convex/values';
import type { BeginResult } from '../../convex/passkeys';

export function passkeyError(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === 'string') return error.data;
  if (error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'AbortError')) return 'The passkey prompt was cancelled or timed out. You can try again.';
  return 'Unable to complete this request. Check your code or passkey and try again. If you have tried repeatedly, wait five minutes.';
}

export function usePasskeys() {
  const { signIn } = useAuthActions();
  const finish = async (prepared: BeginResult) => {
    const response = prepared.kind === 'authentication'
      ? await startAuthentication({ optionsJSON: prepared.options })
      : await startRegistration({ optionsJSON: prepared.options });
    const result = await signIn('passkey', { challengeId: prepared.challengeId, nonce: prepared.nonce, response: JSON.stringify(response) });
    if (!result.signingIn) throw new Error('Authentication did not complete');
    return prepared.recoveryCodes;
  };
  const authenticate = async () => finish(await convex.action(api.passkeys.begin, { purpose: 'authenticate' }));
  return { finish, authenticate };
}
