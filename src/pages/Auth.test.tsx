import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { BeginResult } from '../../convex/passkeys';
import type { Id } from '../../convex/_generated/dataModel';
import Auth from './Auth';

const mocks = vi.hoisted(() => ({ begin: vi.fn(), finish: vi.fn(), authenticate: vi.fn(), auth: { user: null as null | { id: string }, loading: false } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/usePasskeys', () => ({ usePasskeys: () => ({ finish: mocks.finish, authenticate: mocks.authenticate }), passkeyError: () => 'Try again' }));
vi.mock('@/integrations/convex/client', () => ({ convex: { action: mocks.begin }, api: { passkeys: { begin: 'begin' } } }));
vi.mock('@elomondo/webauthn-browser', () => ({ browserSupportsWebAuthn: () => true }));

const prepared: BeginResult = {
  challengeId: 'challenge' as Id<'passkeyChallenges'>, nonce: 'browser-secret', name: 'Legacy Player',
  kind: 'registration', recoveryCodes: ['offline-code-1', 'offline-code-2'],
  options: { rp: { name: 'EloMondo', id: 'localhost' }, user: { id: 'handle', name: 'Player', displayName: 'Player' }, challenge: 'random', pubKeyCredParams: [{ alg: -7, type: 'public-key' }] },
};
beforeEach(() => { vi.clearAllMocks(); mocks.auth.user = null; mocks.auth.loading = false; mocks.begin.mockResolvedValue(prepared); });
afterEach(cleanup);
const app = () => render(<MemoryRouter initialEntries={['/auth']}><Routes><Route path="/auth" element={<Auth />} /><Route path="/groups" element={<p>My groups destination</p>} /></Routes></MemoryRouter>);

describe('passkey login flow', () => {
  it('offers sign-in, signup, claiming and recovery without email/password inputs', () => {
    app();
    expect(screen.getByRole('button', { name: 'Sign in with passkey' })).toBeTruthy();
    expect(document.querySelector('input[type="email"],input[type="password"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(screen.getByLabelText('Display name')).toBeTruthy();
    expect(document.querySelectorAll('input')).toHaveLength(1);
  });

  it('confirms the existing player and keeps recovery codes visible until saved', async () => {
    mocks.finish.mockImplementation(async () => { mocks.auth.user = { id: 'legacy' }; return prepared.recoveryCodes; });
    app();
    fireEvent.click(screen.getByRole('button', { name: 'Already a player? Claim your account' }));
    fireEvent.change(screen.getByLabelText('Personal claim code'), { target: { value: 'personal-claim' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText('Create a passkey for Legacy Player');
    expect(mocks.begin).toHaveBeenCalledWith('begin', { purpose: 'claim', code: 'personal-claim' });
    expect(mocks.finish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Create passkey' }));
    await screen.findByText('Save your recovery codes');
    expect(screen.getByText('offline-code-1')).toBeTruthy();
    expect(screen.queryByText('My groups destination')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'I have saved my codes' }));
    await screen.findByText('My groups destination');
  });

  it('starts a new challenge after a cancelled passkey prompt', async () => {
    mocks.finish.mockRejectedValue(new Error('cancelled'));
    app();
    fireEvent.click(screen.getByRole('button', { name: 'Lost access to your passkeys?' }));
    fireEvent.change(screen.getByLabelText('Recovery code'), { target: { value: 'recovery-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('button', { name: 'Create passkey' });
    fireEvent.click(screen.getByRole('button', { name: 'Create passkey' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Recovery code')).toBeTruthy();
    expect(screen.queryByText('Save your recovery codes')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(mocks.begin).toHaveBeenCalledTimes(2));
  });
});
