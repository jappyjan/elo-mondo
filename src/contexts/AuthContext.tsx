import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useQuery } from 'convex/react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/integrations/convex/client';

type AuthResult = { error: Error | null; needsVerification?: boolean };
interface AuthContextType {
  user: { id: string; email?: string; name?: string } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, name: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.data.viewer, isAuthenticated ? {} : 'skip');
  const actions = useAuthActions();
  const queryClient = useQueryClient();
  useEffect(() => { void queryClient.invalidateQueries(); }, [viewer?.id, queryClient]);

  const passwordFlow = async (email: string, password: string, name?: string): Promise<AuthResult> => {
    try {
      const result = await actions.signIn('password', { email, password, flow: name === undefined ? 'signIn' : 'signUp', ...(name === undefined ? {} : { name }) });
      return { error: null, needsVerification: !result.signingIn };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Authentication failed') };
    }
  };
  const signOut = async () => { await actions.signOut(); queryClient.clear(); };
  return <AuthContext.Provider value={{
    user: isAuthenticated ? viewer ?? null : null,
    loading: isLoading || (isAuthenticated && viewer === undefined),
    signIn: (email, password) => passwordFlow(email, password),
    signUp: (email, password, name) => passwordFlow(email, password, name), signOut,
  }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
