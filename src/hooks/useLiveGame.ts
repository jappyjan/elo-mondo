import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  LiveGameState,
  GameSettings,
  DartThrow,
  PlayerGameState,
  TurnRecord,
  GamePlayer,
} from '@/types/liveGame';
import { Tables, TablesInsert } from '@/integrations/supabase/types';

const STORAGE_KEY = 'elomondo-live-game-id';

type DbGame = Tables<'live_games'>;
type DbGamePlayer = Tables<'live_game_players'>;
type DbThrow = Tables<'game_throws'>;

interface DbData {
  game: DbGame;
  players: DbGamePlayer[];
  throws: DbThrow[];
}

const getStartingScore = (gameType: '301' | '501'): number => {
  return gameType === '301' ? 301 : 501;
};

const isDoubleThrow = (multiplier: number): boolean => {
  return multiplier === 2;
};

// Pure function that derives all game state from database records
function computeGameState(data: DbData): LiveGameState {
  const { game, players, throws } = data;
  
  // Sort players by play_order
  const sortedPlayers = [...players].sort((a, b) => a.play_order - b.play_order);
  const playerOrder = sortedPlayers.map(p => p.id);
  
  // Initialize player states
  const playerStates: Record<string, PlayerGameState> = {};
  const gamePlayers: GamePlayer[] = [];
  
  for (const dbPlayer of sortedPlayers) {
    gamePlayers.push({
      id: dbPlayer.id,
      actualPlayerId: dbPlayer.player_id,
      name: dbPlayer.player_name,
      isTemporary: dbPlayer.is_temporary,
    });
    
    playerStates[dbPlayer.id] = {
      playerId: dbPlayer.id,
      actualPlayerId: dbPlayer.player_id,
      playerName: dbPlayer.player_name,
      startingScore: dbPlayer.starting_score,
      currentScore: dbPlayer.starting_score,
      hasDoubledIn: false,
      finishedRank: dbPlayer.finished_rank,
      turnHistory: [],
    };
  }
  
  // Group throws by player and turn
  const throwsByPlayer = new Map<string, Map<number, DbThrow[]>>();
  for (const t of throws) {
    if (!throwsByPlayer.has(t.game_player_id)) {
      throwsByPlayer.set(t.game_player_id, new Map());
    }
    const playerThrows = throwsByPlayer.get(t.game_player_id)!;
    if (!playerThrows.has(t.turn_number)) {
      playerThrows.set(t.turn_number, []);
    }
    playerThrows.get(t.turn_number)!.push(t);
  }
  
  // Sort throws within each turn by throw_index
  for (const playerThrows of throwsByPlayer.values()) {
    for (const turnThrows of playerThrows.values()) {
      turnThrows.sort((a, b) => a.throw_index - b.throw_index);
    }
  }
  
  // Process throws for each player to derive state
  const finishedPlayerIds: string[] = [];
  
  for (const dbPlayer of sortedPlayers) {
    const playerState = playerStates[dbPlayer.id];
    const playerThrows = throwsByPlayer.get(dbPlayer.id);
    
    if (!playerThrows) continue;
    
    // Get all turn numbers sorted
    const turnNumbers = Array.from(playerThrows.keys()).sort((a, b) => a - b);
    
    let currentScore = dbPlayer.starting_score;
    let hasDoubledIn = game.start_rule === 'straight-in';
    
    for (const turnNum of turnNumbers) {
      const turnThrows = playerThrows.get(turnNum)!;
      const darts: DartThrow[] = turnThrows.map(t => ({
        segment: t.segment,
        multiplier: t.multiplier as 1 | 2 | 3,
        score: t.score,
        label: t.label,
      }));
      
      const scoreAtStart = currentScore;
      const hadDoubledInBefore = hasDoubledIn;
      let doubledInThisTurn = false;
      
      // Check for double-in
      if (!hasDoubledIn) {
        const doubleIdx = darts.findIndex(d => isDoubleThrow(d.multiplier));
        if (doubleIdx !== -1) {
          hasDoubledIn = true;
          doubledInThisTurn = true;
        }
      }
      
      // Calculate turn score (only counting darts after double-in if needed)
      let turnScore = 0;
      if (hasDoubledIn) {
        const countStart = doubledInThisTurn
          ? darts.findIndex(d => isDoubleThrow(d.multiplier))
          : 0;
        if (countStart >= 0) {
          for (let i = countStart; i < darts.length; i++) {
            turnScore += darts[i].score;
          }
        }
      }
      
      const potentialScore = scoreAtStart - turnScore;
      
      // Check for bust
      let isBust = false;
      if (potentialScore < 0) {
        isBust = true;
      } else if (potentialScore === 0) {
        if (game.end_rule === 'double-out' && !isDoubleThrow(darts[darts.length - 1].multiplier)) {
          isBust = true;
        }
      } else if (potentialScore === 1 && game.end_rule === 'double-out') {
        isBust = true;
      }
      
      const scoreAtEnd = isBust ? scoreAtStart : potentialScore;
      currentScore = scoreAtEnd;
      
      // Only record completed turns (3 darts or bust or finished)
      const isCompleteTurn = darts.length === 3 || isBust || scoreAtEnd === 0;
      if (isCompleteTurn) {
        playerState.turnHistory.push({
          darts,
          scoreAtStart,
          scoreAtEnd,
          isBust,
          hadDoubledInBefore,
          doubledInThisTurn,
        });
      }
    }
    
    playerState.currentScore = currentScore;
    playerState.hasDoubledIn = hasDoubledIn;
    
    if (dbPlayer.finished_rank !== null) {
      finishedPlayerIds.push(dbPlayer.id);
    }
  }
  
  // Determine current player and current turn darts
  // Find the last throw to determine whose turn it is
  const sortedThrows = [...throws].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  let currentPlayerIndex = 0;
  let currentTurnDarts: DartThrow[] = [];
  
  if (sortedThrows.length > 0) {
    const lastThrow = sortedThrows[0];
    const lastPlayerIdx = playerOrder.indexOf(lastThrow.game_player_id);
    
    // Get all throws in the last player's current turn
    const lastPlayerThrows = throwsByPlayer.get(lastThrow.game_player_id);
    if (lastPlayerThrows) {
      const maxTurn = Math.max(...lastPlayerThrows.keys());
      const lastTurnThrows = lastPlayerThrows.get(maxTurn) || [];
      
      // Check if turn is complete
      const lastTurnDarts = lastTurnThrows.map(t => ({
        segment: t.segment,
        multiplier: t.multiplier as 1 | 2 | 3,
        score: t.score,
        label: t.label,
      }));
      
      const playerState = playerStates[lastThrow.game_player_id];
      const isTurnComplete = lastTurnDarts.length === 3 || 
        playerState.finishedRank !== null ||
        (playerState.turnHistory.length > 0 && 
         playerState.turnHistory[playerState.turnHistory.length - 1].darts.length === lastTurnDarts.length);
      
      if (isTurnComplete) {
        // Move to next active player
        currentPlayerIndex = findNextActivePlayer(lastPlayerIdx, playerOrder, finishedPlayerIds);
        currentTurnDarts = [];
      } else {
        // Still this player's turn
        currentPlayerIndex = lastPlayerIdx;
        currentTurnDarts = lastTurnDarts;
      }
    }
  }
  
  // Calculate score before turn for current player
  const currentPlayerId = playerOrder[currentPlayerIndex];
  const currentPlayerState = playerStates[currentPlayerId];
  const scoreBeforeTurn = currentPlayerState.currentScore + 
    currentTurnDarts.reduce((sum, d) => sum + d.score, 0);
  
  // Calculate next rank
  const nextRank = finishedPlayerIds.length + 1;
  
  // Check if game is over
  const activePlayers = playerOrder.filter(id => !finishedPlayerIds.includes(id));
  const isGameOver = game.status === 'completed' || game.status === 'abandoned' || activePlayers.length <= 1;
  
  // Assign last rank if game just ended
  if (activePlayers.length === 1 && !playerStates[activePlayers[0]].finishedRank) {
    playerStates[activePlayers[0]].finishedRank = nextRank;
    finishedPlayerIds.push(activePlayers[0]);
  }

  return {
    gameId: game.id,
    gameType: game.game_type,
    startRule: game.start_rule,
    endRule: game.end_rule,
    players: gamePlayers,
    playerOrder,
    playerStates,
    currentPlayerIndex,
    currentTurnDarts,
    scoreBeforeTurn,
    finishedPlayerIds,
    nextRank,
    isGameOver,
    startedAt: game.started_at,
    finishedAt: game.finished_at,
  };
}

function findNextActivePlayer(
  currentIndex: number, 
  playerOrder: string[], 
  finishedPlayerIds: string[]
): number {
  const activePlayers = playerOrder.filter(id => !finishedPlayerIds.includes(id));
  if (activePlayers.length === 0) return currentIndex;
  
  let nextIndex = currentIndex;
  let attempts = 0;
  do {
    nextIndex = (nextIndex + 1) % playerOrder.length;
    attempts++;
  } while (
    finishedPlayerIds.includes(playerOrder[nextIndex]) &&
    attempts < playerOrder.length
  );
  
  return nextIndex;
}

export function useLiveGame(groupId: string) {
  const [gameState, setGameState] = useState<LiveGameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gameId, setGameId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY);
  });

  // Load game from database
  const loadGame = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      // Fetch game
      const { data: game, error: gameError } = await supabase
        .from('live_games')
        .select('*')
        .eq('id', id)
        .eq('group_id', groupId)
        .single();
      
      if (gameError || !game) {
        localStorage.removeItem(STORAGE_KEY);
        setGameId(null);
        setGameState(null);
        return;
      }
      
      // Only load in-progress games
      if (game.status !== 'in_progress') {
        localStorage.removeItem(STORAGE_KEY);
        setGameId(null);
        setGameState(null);
        return;
      }
      
      // Fetch players
      const { data: players, error: playersError } = await supabase
        .from('live_game_players')
        .select('*')
        .eq('game_id', id)
        .order('play_order');
      
      if (playersError || !players) {
        throw playersError;
      }
      
      // Fetch throws
      const { data: throws, error: throwsError } = await supabase
        .from('game_throws')
        .select('*')
        .eq('game_id', id)
        .order('created_at');
      
      if (throwsError) {
        throw throwsError;
      }
      
      const state = computeGameState({ game, players, throws: throws || [] });
      setGameState(state);
    } catch (error) {
      console.error('Failed to load game:', error);
      localStorage.removeItem(STORAGE_KEY);
      setGameId(null);
      setGameState(null);
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  // Initial load
  useEffect(() => {
    if (gameId) {
      loadGame(gameId);
    } else {
      setIsLoading(false);
    }
  }, [gameId, loadGame]);

  const startGame = useCallback(async (settings: GameSettings) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Must be logged in to start a game');
    }
    
    const startingScore = getStartingScore(settings.gameType);
    
    // Create game
    const { data: game, error: gameError } = await supabase
      .from('live_games')
      .insert({
        group_id: groupId,
        created_by: user.id,
        game_type: settings.gameType,
        start_rule: settings.startRule,
        end_rule: settings.endRule,
      })
      .select()
      .single();
    
    if (gameError || !game) {
      throw gameError || new Error('Failed to create game');
    }
    
    // Create players
    const playerInserts: TablesInsert<'live_game_players'>[] = settings.players.map((player, index) => ({
      game_id: game.id,
      player_id: player.isTemporary ? null : player.id,
      player_name: player.name,
      is_temporary: player.isTemporary || false,
      play_order: index + 1,
      starting_score: startingScore,
    }));
    
    const { data: players, error: playersError } = await supabase
      .from('live_game_players')
      .insert(playerInserts)
      .select();
    
    if (playersError || !players) {
      // Clean up game if players failed
      await supabase.from('live_games').delete().eq('id', game.id);
      throw playersError || new Error('Failed to create players');
    }
    
    // Store game ID in localStorage
    localStorage.setItem(STORAGE_KEY, game.id);
    setGameId(game.id);
    
    // Compute initial state
    const state = computeGameState({ game, players, throws: [] });
    setGameState(state);
  }, [groupId]);

  const resetGame = useCallback(async () => {
    if (gameId) {
      // Update game status to abandoned
      await supabase
        .from('live_games')
        .update({ status: 'abandoned' })
        .eq('id', gameId);
    }
    
    localStorage.removeItem(STORAGE_KEY);
    setGameId(null);
    setGameState(null);
  }, [gameId]);

  const validateAndThrowDart = useCallback(
    async (dart: DartThrow): Promise<{ success: boolean; isBust: boolean; isFinished: boolean }> => {
      if (!gameState || !gameId) {
        return { success: false, isBust: false, isFinished: false };
      }

      const currentPlayerId = gameState.playerOrder[gameState.currentPlayerIndex];
      const currentPlayer = gameState.playerStates[currentPlayerId];
      
      if (!currentPlayer || currentPlayer.finishedRank !== null) {
        return { success: false, isBust: false, isFinished: false };
      }

      if (gameState.currentTurnDarts.length >= 3) {
        return { success: false, isBust: false, isFinished: false };
      }

      // Calculate the new state
      const newDarts = [...gameState.currentTurnDarts, dart];
      let hasDoubledIn = currentPlayer.hasDoubledIn;
      let doubledInThisTurn = false;

      // Handle double-in rule
      if (gameState.startRule === 'double-in' && !hasDoubledIn) {
        if (isDoubleThrow(dart.multiplier)) {
          hasDoubledIn = true;
          doubledInThisTurn = true;
        }
      }

      // Calculate score only if doubled in (or straight-in)
      let turnScore = 0;
      if (gameState.startRule === 'straight-in' || hasDoubledIn) {
        const countableStart = gameState.startRule === 'double-in' && doubledInThisTurn
          ? newDarts.length - 1
          : currentPlayer.hasDoubledIn || gameState.startRule === 'straight-in'
            ? 0
            : newDarts.findIndex((d) => isDoubleThrow(d.multiplier));
        
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
        if (gameState.endRule === 'double-out' && !isDoubleThrow(dart.multiplier)) {
          isBust = true;
        }
      } else if (potentialScore === 1 && gameState.endRule === 'double-out') {
        isBust = true;
      }

      const isFinished = potentialScore === 0 && !isBust;

      // Determine turn number
      const turnNumber = currentPlayer.turnHistory.length + 1;
      const throwIndex = gameState.currentTurnDarts.length;

      // Insert throw into database (fire and forget for UI responsiveness)
      supabase
        .from('game_throws')
        .insert({
          game_id: gameId,
          game_player_id: currentPlayerId,
          turn_number: turnNumber,
          throw_index: throwIndex,
          segment: dart.segment,
          multiplier: dart.multiplier,
          score: dart.score,
          label: dart.label,
        })
        .then(({ error }) => {
          if (error) {
            console.error('Failed to record throw:', error);
          }
        });

      // Build updated player state optimistically
      const updatedPlayerStates = { ...gameState.playerStates };
      const updatedCurrentPlayer = { ...currentPlayer };
      
      // Determine if turn is complete
      const isTurnComplete = newDarts.length === 3 || isBust || isFinished;
      
      if (isTurnComplete) {
        // Add turn to history
        updatedCurrentPlayer.turnHistory = [
          ...updatedCurrentPlayer.turnHistory,
          {
            darts: newDarts,
            scoreAtStart: gameState.scoreBeforeTurn,
            scoreAtEnd: isBust ? gameState.scoreBeforeTurn : potentialScore,
            isBust,
            hadDoubledInBefore: currentPlayer.hasDoubledIn,
            doubledInThisTurn,
          },
        ];
        updatedCurrentPlayer.currentScore = isBust ? gameState.scoreBeforeTurn : potentialScore;
        updatedCurrentPlayer.hasDoubledIn = hasDoubledIn;
      } else {
        updatedCurrentPlayer.hasDoubledIn = hasDoubledIn;
      }

      // Handle finish
      let updatedFinishedPlayerIds = [...gameState.finishedPlayerIds];
      let updatedNextRank = gameState.nextRank;
      let isGameOver = gameState.isGameOver;
      let finishedAt = gameState.finishedAt;
      
      if (isFinished) {
        updatedCurrentPlayer.finishedRank = gameState.nextRank;
        updatedFinishedPlayerIds.push(currentPlayerId);
        updatedNextRank = gameState.nextRank + 1;
        
        // Update database asynchronously
        supabase
          .from('live_game_players')
          .update({ finished_rank: gameState.nextRank })
          .eq('id', currentPlayerId)
          .then(({ error }) => {
            if (error) console.error('Failed to update finished rank:', error);
          });
        
        // Check if game should end
        const remainingPlayers = gameState.playerOrder.filter(
          id => !updatedFinishedPlayerIds.includes(id)
        );

        if (remainingPlayers.length <= 1) {
          isGameOver = true;
          finishedAt = new Date().toISOString();
          
          // Assign last rank if there's one player left
          if (remainingPlayers.length === 1) {
            const lastPlayerId = remainingPlayers[0];
            const lastPlayer = { ...updatedPlayerStates[lastPlayerId] };
            lastPlayer.finishedRank = updatedNextRank;
            updatedPlayerStates[lastPlayerId] = lastPlayer;
            updatedFinishedPlayerIds.push(lastPlayerId);
            
            supabase
              .from('live_game_players')
              .update({ finished_rank: updatedNextRank })
              .eq('id', lastPlayerId)
              .then(({ error }) => {
                if (error) console.error('Failed to update last player rank:', error);
              });
          }
          
          supabase
            .from('live_games')
            .update({ status: 'completed', finished_at: finishedAt })
            .eq('id', gameId)
            .then(({ error }) => {
              if (error) console.error('Failed to complete game:', error);
            });
        }
      }

      updatedPlayerStates[currentPlayerId] = updatedCurrentPlayer;

      // Calculate next player index and turn state
      let nextPlayerIndex = gameState.currentPlayerIndex;
      let nextTurnDarts: DartThrow[] = newDarts;
      let nextScoreBeforeTurn = gameState.scoreBeforeTurn;
      
      if (isTurnComplete && !isGameOver) {
        // Move to next active player
        const activePlayers = gameState.playerOrder.filter(id => !updatedFinishedPlayerIds.includes(id));
        if (activePlayers.length > 0) {
          nextPlayerIndex = findNextActivePlayer(
            gameState.currentPlayerIndex,
            gameState.playerOrder,
            updatedFinishedPlayerIds
          );
          nextTurnDarts = [];
          nextScoreBeforeTurn = updatedPlayerStates[gameState.playerOrder[nextPlayerIndex]].currentScore;
        }
      }

      // Update state optimistically
      setGameState({
        ...gameState,
        playerStates: updatedPlayerStates,
        currentPlayerIndex: nextPlayerIndex,
        currentTurnDarts: nextTurnDarts,
        scoreBeforeTurn: nextScoreBeforeTurn,
        finishedPlayerIds: updatedFinishedPlayerIds,
        nextRank: updatedNextRank,
        isGameOver,
        finishedAt,
      });

      return { success: true, isBust, isFinished };
    },
    [gameState, gameId]
  );

  const undoLastDart = useCallback(async () => {
    if (!gameState || !gameId) return;

    const currentPlayerId = gameState.playerOrder[gameState.currentPlayerIndex];
    const currentPlayer = gameState.playerStates[currentPlayerId];
    
    // Check if we're undoing from current turn or need to go back to previous player
    if (gameState.currentTurnDarts.length > 0) {
      // Undo from current turn
      const newDarts = gameState.currentTurnDarts.slice(0, -1);
      
      // Delete from database asynchronously
      supabase
        .from('game_throws')
        .delete()
        .eq('game_id', gameId)
        .eq('game_player_id', currentPlayerId)
        .eq('turn_number', currentPlayer.turnHistory.length + 1)
        .eq('throw_index', gameState.currentTurnDarts.length - 1)
        .then(({ error }) => {
          if (error) console.error('Failed to delete throw:', error);
        });
      
      // Recalculate hasDoubledIn based on remaining darts
      let hasDoubledIn = currentPlayer.hasDoubledIn;
      if (gameState.startRule === 'double-in') {
        // Check if the removed dart was the double-in dart
        const removedDart = gameState.currentTurnDarts[gameState.currentTurnDarts.length - 1];
        if (removedDart.multiplier === 2) {
          // Check if there's another double in the remaining darts or turn history
          const hasDoubleInRemaining = newDarts.some(d => d.multiplier === 2);
          const hadDoubleInHistory = currentPlayer.turnHistory.some(
            turn => turn.darts.some(d => d.multiplier === 2)
          );
          hasDoubledIn = hasDoubleInRemaining || hadDoubleInHistory;
        }
      }
      
      const updatedPlayerStates = { ...gameState.playerStates };
      updatedPlayerStates[currentPlayerId] = {
        ...currentPlayer,
        hasDoubledIn,
      };
      
      setGameState({
        ...gameState,
        playerStates: updatedPlayerStates,
        currentTurnDarts: newDarts,
      });
    } else {
      // Need to go back to the previous player's last turn
      // Find the last throw in the database to know which player/turn to undo
      const { data: lastThrow, error: fetchError } = await supabase
        .from('game_throws')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !lastThrow) {
        console.error('No throw to undo');
        return;
      }

      const lastPlayerId = lastThrow.game_player_id;
      const lastPlayer = gameState.playerStates[lastPlayerId];
      
      if (!lastPlayer || lastPlayer.turnHistory.length === 0) {
        return;
      }

      // Check if we need to undo a finished rank
      const wasFinished = lastPlayer.finishedRank !== null;
      if (wasFinished) {
        // Reset the player's finished rank in database
        supabase
          .from('live_game_players')
          .update({ finished_rank: null })
          .eq('id', lastPlayerId)
          .then(({ error }) => {
            if (error) console.error('Failed to reset finished rank:', error);
          });

        // If game was completed, revert to in_progress
        if (gameState.isGameOver) {
          supabase
            .from('live_games')
            .update({ status: 'in_progress', finished_at: null })
            .eq('id', gameId)
            .then(({ error }) => {
              if (error) console.error('Failed to revert game status:', error);
            });
        }
      }

      // Delete the last throw from database
      supabase
        .from('game_throws')
        .delete()
        .eq('id', lastThrow.id)
        .then(({ error }) => {
          if (error) console.error('Failed to delete throw:', error);
        });

      // Rebuild state: restore the last turn minus the last dart
      const lastTurn = lastPlayer.turnHistory[lastPlayer.turnHistory.length - 1];
      const restoredDarts = lastTurn.darts.slice(0, -1);
      
      const updatedPlayerStates = { ...gameState.playerStates };
      const updatedLastPlayer = { ...lastPlayer };
      
      // Remove the completed turn from history
      updatedLastPlayer.turnHistory = lastPlayer.turnHistory.slice(0, -1);
      updatedLastPlayer.currentScore = lastTurn.scoreAtStart;
      updatedLastPlayer.finishedRank = null;
      
      // Recalculate hasDoubledIn
      if (gameState.startRule === 'double-in') {
        const hasDoubleInHistory = updatedLastPlayer.turnHistory.some(
          turn => turn.darts.some(d => d.multiplier === 2)
        );
        const hasDoubleInRestoredDarts = restoredDarts.some(d => d.multiplier === 2);
        updatedLastPlayer.hasDoubledIn = hasDoubleInHistory || hasDoubleInRestoredDarts;
      }
      
      updatedPlayerStates[lastPlayerId] = updatedLastPlayer;
      
      // Update finished players list
      let updatedFinishedPlayerIds = gameState.finishedPlayerIds.filter(id => id !== lastPlayerId);
      
      // If game was over and we're undoing, also remove the last place player if they were auto-assigned
      if (gameState.isGameOver) {
        // Find any player who was assigned last place automatically
        for (const playerId of gameState.playerOrder) {
          const player = gameState.playerStates[playerId];
          if (player.finishedRank === gameState.nextRank - 1 && playerId !== lastPlayerId) {
            const updatedPlayer = { ...updatedPlayerStates[playerId] };
            updatedPlayer.finishedRank = null;
            updatedPlayerStates[playerId] = updatedPlayer;
            updatedFinishedPlayerIds = updatedFinishedPlayerIds.filter(id => id !== playerId);
            
            supabase
              .from('live_game_players')
              .update({ finished_rank: null })
              .eq('id', playerId)
              .then(({ error }) => {
                if (error) console.error('Failed to reset auto-assigned rank:', error);
              });
          }
        }
      }
      
      const lastPlayerIndex = gameState.playerOrder.indexOf(lastPlayerId);
      
      setGameState({
        ...gameState,
        playerStates: updatedPlayerStates,
        currentPlayerIndex: lastPlayerIndex,
        currentTurnDarts: restoredDarts,
        scoreBeforeTurn: lastTurn.scoreAtStart,
        finishedPlayerIds: updatedFinishedPlayerIds,
        nextRank: updatedFinishedPlayerIds.length + 1,
        isGameOver: false,
        finishedAt: null,
      });
    }
  }, [gameState, gameId]);

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

  const getCurrentTurnScore = useCallback((): number => {
    if (!gameState) return 0;
    
    const currentPlayer = getCurrentPlayer();
    if (!currentPlayer) return 0;

    if (gameState.startRule === 'double-in' && !currentPlayer.hasDoubledIn) {
      const doubleIndex = gameState.currentTurnDarts.findIndex((d) => isDoubleThrow(d.multiplier));
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
    isLoading,
    startGame,
    resetGame,
    getCurrentPlayer,
    getActivePlayerOrder,
    validateAndThrowDart,
    undoLastDart,
    getCurrentTurnScore,
    getPotentialScore,
    getRankings,
  };
}
