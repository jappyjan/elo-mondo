import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Account from './Account';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(), finish: vi.fn(), action: vi.fn(),
  auth: { user: { id: 'owner', name: 'Owner' } as { id: string; name: string } | null, loading: false },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/usePasskeys', () => ({ usePasskeys: () => ({ finish: mocks.finish, authenticate: mocks.authenticate }), passkeyError: () => 'Try again' }));
vi.mock('convex/react', () => ({ useQuery: () => [] }));
vi.mock('@/integrations/convex/client', () => ({ convex: { action: mocks.action }, api: { passkeys: { begin: 'begin' }, passkeyStore: { list: 'list' } } }));
beforeEach(() => { vi.clearAllMocks(); mocks.auth.user = { id: 'owner', name: 'Owner' }; });
afterEach(cleanup);
const App = () => <MemoryRouter initialEntries={['/account']}><Routes><Route path="/account" element={<Account />} /><Route path="/auth" element={<p>Login destination</p>} /></Routes></MemoryRouter>;

describe('account security', () => {
  it('does not redirect away while reauthentication rotates the session', async () => {
    let resolve!: () => void;
    mocks.authenticate.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    mocks.action.mockResolvedValue({});
    const view = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a passkey' }));
    await waitFor(() => expect(mocks.authenticate).toHaveBeenCalled());
    mocks.auth.user = null;
    view.rerender(<App />);
    expect(screen.getByLabelText('Verifying passkey')).toBeTruthy();
    expect(screen.queryByText('Login destination')).toBeNull();
    mocks.auth.user = { id: 'owner', name: 'Owner' };
    await act(async () => { resolve(); });
    await waitFor(() => expect(mocks.finish).toHaveBeenCalled());
    expect(screen.getByText('Account security')).toBeTruthy();
  });
});
