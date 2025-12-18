import { useState, useEffect, useCallback } from 'react';
import {
  LiveGameState,
  GameSettings,
  DartThrow,
  PlayerGameState,
  TurnRecord,
  GamePlayer,
  GlobalThrowRecord,
} from '@/types/liveGame';

const STORAGE_KEY = 'elomondo-live-game';

const getStartingScore = (gameType: '301' | '501'): number => {
  return gameType === '301' ? 301 : 501;
};

const createInitialPlayerState = (
  player: GamePlayer,
  startingScore: number
): PlayerGameState => ({
  playerId: player.id,
  playerName: player.name,
  startingScore,
  currentScore: startingScore,
  hasDoubledIn: false,
  finishedRank: null,
  turnHistory: [],
});

const createInitialGameState = (settings: GameSettings): LiveGameState => {
  const startingScore = getStartingScore(settings.gameType);
  const playerStates: Record<string, PlayerGameState> = {};
  
  settings.players.forEach((player) => {
    playerStates[player.id] = createInitialPlayerState(player, startingScore);
  });

  return {
    gameType: settings.gameType,
    startRule: settings.startRule,
    endRule: settings.endRule,
    players: settings.players,
    playerOrder: settings.players.map((p) => p.id),
    playerStates,
    currentPlayerIndex: 0,
    currentTurnDarts: [],
    scoreBeforeTurn: startingScore,
    finishedPlayerIds: [],
    nextRank: 1,
    isGameOver: false,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    globalThrowHistory: [],
  };
};

export function useLiveGame() {
  const [gameState, setGameState] = useState<LiveGameState | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Migrate old game states that don't have globalThrowHistory
        if (parsed && !parsed.globalThrowHistory) {
          parsed.globalThrowHistory = [];
        }
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  // Persist to localStorage
  useEffect(() => {
    if (gameState) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    }
  }, [gameState]);

  const startGame = useCallback((settings: GameSettings) => {
    const newState = createInitialGameState(settings);
    setGameState(newState);
  }, []);

  const resetGame = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setGameState(null);
  }, []);

  const shuffleOrder = useCallback(() => {
    if (!gameState) return;
    
    const shuffled = [...gameState.playerOrder].sort(() => Math.random() - 0.5);
    setGameState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        playerOrder: shuffled,
        currentPlayerIndex: 0,
        scoreBeforeTurn: prev.playerStates[shuffled[0]].currentScore,
      };
    });
  }, [gameState]);

  const setPlayerOrder = useCallback((newOrder: string[]) => {
    setGameState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        playerOrder: newOrder,
        currentPlayerIndex: 0,
        scoreBeforeTurn: prev.playerStates[newOrder[0]].currentScore,
      };
    });
  }, []);

  const getCurrentPlayer = useCallback((): PlayerGameState | null => {
    if (!gameState) return null;
    const currentPlayerId = gameState.playerOrder[gameState.currentPlayerIndex];
    return gameState.playerStates[currentPlayerId] || null;
  }, [gameState]);

  const getActivePlayerOrder = useCallback((): string[] => {
    if (!gameState) return [];
    return gameState.playerOrder.filter(
      (id) => !gameState.finishedPlayerIds.includes(id)
    );
  }, [gameState]);

  const isDoubleThrow = (dart: DartThrow): boolean => {
    return dart.multiplier === 2;
  };

  const validateAndThrowDart = useCallback(
    (dart: DartThrow): { success: boolean; isBust: boolean; isFinished: boolean } => {
      if (!gameState) return { success: false, isBust: false, isFinished: false };

      const currentPlayer = getCurrentPlayer();
      if (!currentPlayer || currentPlayer.finishedRank !== null) {
        return { success: false, isBust: false, isFinished: false };
      }

      if (gameState.currentTurnDarts.length >= 3) {
        return { success: false, isBust: false, isFinished: false };
      }

      // Create snapshot before this throw for undo capability
      const throwRecord: GlobalThrowRecord = {
        playerId: currentPlayer.playerId,
        dart,
        snapshot: {
          currentPlayerIndex: gameState.currentPlayerIndex,
          currentTurnDarts: [...gameState.currentTurnDarts],
          scoreBeforeTurn: gameState.scoreBeforeTurn,
          playerStates: JSON.parse(JSON.stringify(gameState.playerStates)),
          finishedPlayerIds: [...gameState.finishedPlayerIds],
          nextRank: gameState.nextRank,
          isGameOver: gameState.isGameOver,
          finishedAt: gameState.finishedAt,
        },
      };

      let newDarts = [...gameState.currentTurnDarts, dart];
      let hasDoubledIn = currentPlayer.hasDoubledIn;
      let doubledInThisTurn = false;

      // Handle double-in rule
      if (gameState.startRule === 'double-in' && !hasDoubledIn) {
        if (isDoubleThrow(dart)) {
          hasDoubledIn = true;
          doubledInThisTurn = true;
        }
      }

      // Calculate score only if doubled in (or straight-in)
      let turnScore = 0;
      if (gameState.startRule === 'straight-in' || hasDoubledIn) {
        // For double-in, only count darts from the double onwards
        const countableStart = gameState.startRule === 'double-in' && doubledInThisTurn
          ? newDarts.length - 1
          : currentPlayer.hasDoubledIn || gameState.startRule === 'straight-in'
            ? 0
            : newDarts.findIndex((d) => isDoubleThrow(d));
        
        if (countableStart >= 0) {
          for (let i = countableStart; i < newDarts.length; i++) {
            turnScore += newDarts[i].score;
          }
        }
      }

      const potentialScore = gameState.scoreBeforeTurn - turnScore;

      // Check for bust conditions
      let isBust = false;
      if (potentialScore < 0) {
        isBust = true;
      } else if (potentialScore === 0) {
        // Check double-out rule
        if (gameState.endRule === 'double-out' && !isDoubleThrow(dart)) {
          isBust = true;
        }
      } else if (potentialScore === 1 && gameState.endRule === 'double-out') {
        // Can't finish with 1 when double-out required
        isBust = true;
      }

      if (isBust) {
        // Bust - void entire turn, reset to start-of-turn score
        const turnRecord: TurnRecord = {
          darts: newDarts,
          scoreAtStart: gameState.scoreBeforeTurn,
          scoreAtEnd: gameState.scoreBeforeTurn,
          isBust: true,
          hadDoubledInBefore: currentPlayer.hasDoubledIn,
          doubledInThisTurn: false,
        };

        setGameState((prev) => {
          if (!prev) return null;
          const playerId = prev.playerOrder[prev.currentPlayerIndex];
          const updatedPlayerState = {
            ...prev.playerStates[playerId],
            turnHistory: [...prev.playerStates[playerId].turnHistory, turnRecord],
          };

          return moveToNextPlayer({
            ...prev,
            playerStates: {
              ...prev.playerStates,
              [playerId]: updatedPlayerState,
            },
            currentTurnDarts: [],
            globalThrowHistory: [...prev.globalThrowHistory, throwRecord],
          });
        });

        return { success: true, isBust: true, isFinished: false };
      }

      const isFinished = potentialScore === 0;

      setGameState((prev) => {
        if (!prev) return null;
        const playerId = prev.playerOrder[prev.currentPlayerIndex];
        const playerState = prev.playerStates[playerId];

        // Update player state with new dart
        const updatedPlayerState: PlayerGameState = {
          ...playerState,
          hasDoubledIn: hasDoubledIn || playerState.hasDoubledIn,
        };

        let newState: LiveGameState = {
          ...prev,
          currentTurnDarts: newDarts,
          playerStates: {
            ...prev.playerStates,
            [playerId]: updatedPlayerState,
          },
          globalThrowHistory: [...prev.globalThrowHistory, throwRecord],
        };

        // If finished or 3 darts thrown, end turn
        if (isFinished || newDarts.length >= 3) {
          const finalScore = isFinished ? 0 : potentialScore;
          
          const turnRecord: TurnRecord = {
            darts: newDarts,
            scoreAtStart: prev.scoreBeforeTurn,
            scoreAtEnd: finalScore,
            isBust: false,
            hadDoubledInBefore: playerState.hasDoubledIn,
            doubledInThisTurn: doubledInThisTurn,
          };

          const finishedRank = isFinished ? prev.nextRank : null;

          const finalPlayerState: PlayerGameState = {
            ...updatedPlayerState,
            currentScore: finalScore,
            finishedRank,
            turnHistory: [...updatedPlayerState.turnHistory, turnRecord],
          };

          newState = {
            ...newState,
            playerStates: {
              ...newState.playerStates,
              [playerId]: finalPlayerState,
            },
            currentTurnDarts: [],
          };

          if (isFinished) {
            newState = {
              ...newState,
              finishedPlayerIds: [...newState.finishedPlayerIds, playerId],
              nextRank: newState.nextRank + 1,
            };
          }

          // Check if game is over (only one or zero players left)
          const remainingPlayers = newState.playerOrder.filter(
            (id) => !newState.finishedPlayerIds.includes(id)
          );

          if (remainingPlayers.length <= 1) {
            // Assign final rank to last remaining player
            if (remainingPlayers.length === 1) {
              const lastPlayerId = remainingPlayers[0];
              newState = {
                ...newState,
                playerStates: {
                  ...newState.playerStates,
                  [lastPlayerId]: {
                    ...newState.playerStates[lastPlayerId],
                    finishedRank: newState.nextRank,
                  },
                },
                finishedPlayerIds: [...newState.finishedPlayerIds, lastPlayerId],
              };
            }
            
            newState = {
              ...newState,
              isGameOver: true,
              finishedAt: new Date().toISOString(),
            };
          } else {
            newState = moveToNextPlayer(newState);
          }
        }

        return newState;
      });

      return { success: true, isBust: false, isFinished };
    },
    [gameState, getCurrentPlayer]
  );

  const moveToNextPlayer = (state: LiveGameState): LiveGameState => {
    const activePlayers = state.playerOrder.filter(
      (id) => !state.finishedPlayerIds.includes(id)
    );

    if (activePlayers.length === 0) {
      return state;
    }

    // Find next active player
    let nextIndex = state.currentPlayerIndex;
    let attempts = 0;
    do {
      nextIndex = (nextIndex + 1) % state.playerOrder.length;
      attempts++;
    } while (
      state.finishedPlayerIds.includes(state.playerOrder[nextIndex]) &&
      attempts < state.playerOrder.length
    );

    const nextPlayerId = state.playerOrder[nextIndex];
    const nextPlayerScore = state.playerStates[nextPlayerId].currentScore;

    return {
      ...state,
      currentPlayerIndex: nextIndex,
      currentTurnDarts: [],
      scoreBeforeTurn: nextPlayerScore,
    };
  };

  const undoLastDart = useCallback(() => {
    if (!gameState || gameState.globalThrowHistory.length === 0) return;

    setGameState((prev) => {
      if (!prev || prev.globalThrowHistory.length === 0) return prev;

      const lastThrow = prev.globalThrowHistory[prev.globalThrowHistory.length - 1];
      const { snapshot } = lastThrow;

      return {
        ...prev,
        currentPlayerIndex: snapshot.currentPlayerIndex,
        currentTurnDarts: snapshot.currentTurnDarts,
        scoreBeforeTurn: snapshot.scoreBeforeTurn,
        playerStates: snapshot.playerStates,
        finishedPlayerIds: snapshot.finishedPlayerIds,
        nextRank: snapshot.nextRank,
        isGameOver: snapshot.isGameOver,
        finishedAt: snapshot.finishedAt,
        globalThrowHistory: prev.globalThrowHistory.slice(0, -1),
      };
    });
  }, [gameState]);

  const getCurrentTurnScore = useCallback((): number => {
    if (!gameState) return 0;
    
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) return 0;

    if (gameState.startRule === 'double-in' && !currentPlayer.hasDoubledIn) {
      // Find if any dart in current turn is a double
      const doubleIndex = gameState.currentTurnDarts.findIndex((d) => isDoubleThrow(d));
      if (doubleIndex === -1) return 0;
      
      return gameState.currentTurnDarts
        .slice(doubleIndex)
        .reduce((sum, d) => sum + d.score, 0);
    }

    return gameState.currentTurnDarts.reduce((sum, d) => sum + d.score, 0);
  }, [gameState, getCurrentPlayer]);

  const getPotentialScore = useCallback((): number => {
    if (!gameState) return 0;
    const turnScore = getCurrentTurnScore();
    return gameState.scoreBeforeTurn - turnScore;
  }, [gameState, getCurrentTurnScore]);

  const getRankings = useCallback(() => {
    if (!gameState) return [];
    
    return Object.values(gameState.playerStates)
      .filter((ps) => ps.finishedRank !== null)
      .sort((a, b) => (a.finishedRank || 0) - (b.finishedRank || 0))
      .map((ps) => ({
        playerId: ps.playerId,
        playerName: ps.playerName,
        rank: ps.finishedRank!,
      }));
  }, [gameState]);

  return {
    gameState,
    startGame,
    resetGame,
    shuffleOrder,
    setPlayerOrder,
    getCurrentPlayer,
    getActivePlayerOrder,
    validateAndThrowDart,
    undoLastDart,
    getCurrentTurnScore,
    getPotentialScore,
    getRankings,
  };
}
