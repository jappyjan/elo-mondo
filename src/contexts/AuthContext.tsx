import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useQuery } from 'convex/react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/integrations/convex/client';

interface AuthContextType {
  user: { id: string; name?: string } | null;
  loading: boolean;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.data.viewer, isAuthenticated ? {} : 'skip');
  const actions = useAuthActions();
  const queryClient = useQueryClient();
  useEffect(() => { void queryClient.invalidateQueries(); }, [viewer?.id, queryClient]);

  const signOut = async () => { await actions.signOut(); queryClient.clear(); };
  return <AuthContext.Provider value={{
    user: isAuthenticated ? viewer ?? null : null,
    loading: isLoading || (isAuthenticated && viewer === undefined),
    signOut,
  }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
