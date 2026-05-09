// ============================================================
// AI Think hook - artificial delay for AI decision-making
// ============================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import type { GameState } from '../types/game';
import type { GameAction } from '../types/actions';
import { getCurrentAIPlayer, aiDecide } from '../engine/ai/AIController';

interface AIThinkState {
  isThinking: boolean;
  thinkingPlayerId: string | null;
}

export function useAIThink(
  state: GameState,
  dispatch: React.Dispatch<GameAction>,
  delayMs: number = 1500,
) {
  const [aiState, setAiState] = useState<AIThinkState>({
    isThinking: false,
    thinkingPlayerId: null,
  });

  const thinkingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processAI = useCallback(() => {
    if (thinkingRef.current) return;

    const aiPlayer = getCurrentAIPlayer(state);
    if (!aiPlayer) return;

    thinkingRef.current = true;
    setAiState({ isThinking: true, thinkingPlayerId: aiPlayer.id });

    const action = aiDecide(state, aiPlayer.id);

    timeoutRef.current = setTimeout(() => {
      dispatch(action);
      thinkingRef.current = false;
      setAiState({ isThinking: false, thinkingPlayerId: null });
    }, delayMs + Math.random() * 500);
  }, [state, dispatch, delayMs]);

  // Trigger AI on state changes
  useEffect(() => {
    if (state.gamePhase !== 'playing') return;

    // Small delay before AI acts
    const triggerTimeout = setTimeout(() => {
      processAI();
    }, 300);

    return () => clearTimeout(triggerTimeout);
  }, [
    state.currentPlayerIndex,
    state.currentTurnPhase,
    state.pendingAction,
    state.gamePhase,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isThinking: aiState.isThinking,
    thinkingPlayerId: aiState.thinkingPlayerId,
  };
}
