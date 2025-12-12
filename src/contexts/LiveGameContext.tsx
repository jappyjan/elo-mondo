import React, { createContext, useContext, ReactNode } from 'react';
import { useLiveGame } from '@/hooks/useLiveGame';

type LiveGameContextType = ReturnType<typeof useLiveGame>;

const LiveGameContext = createContext<LiveGameContextType | null>(null);

export function LiveGameProvider({ children }: { children: ReactNode }) {
  const liveGame = useLiveGame();
  
  return (
    <LiveGameContext.Provider value={liveGame}>
      {children}
    </LiveGameContext.Provider>
  );
}

export function useLiveGameContext() {
  const context = useContext(LiveGameContext);
  if (!context) {
    throw new Error('useLiveGameContext must be used within a LiveGameProvider');
  }
  return context;
}
