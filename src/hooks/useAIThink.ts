// ============================================================
// AI Think hook - async AI decision-making (LLM or rule-based)
// ============================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import type { GameState } from '../types/game';
import type { GameAction } from '../types/actions';
import { getCurrentAIPlayer, aiDecide } from '../engine/ai/AIController';
import { llmDecide, hasApiKey } from '../engine/ai/LLMController';

interface AIThinkState {
  isThinking: boolean;
  thinkingPlayerId: string | null;
}

export function useAIThink(
  state: GameState,
  dispatch: React.Dispatch<GameAction>,
  delayMs: number = 800,
) {
  const [aiState, setAiState] = useState<AIThinkState>({
    isThinking: false,
    thinkingPlayerId: null,
  });

  const thinkingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const processAI = useCallback(() => {
    if (thinkingRef.current) return;

    const currentState = stateRef.current;
    const aiPlayer = getCurrentAIPlayer(currentState);
    if (!aiPlayer) return;

    thinkingRef.current = true;
    setAiState({ isThinking: true, thinkingPlayerId: aiPlayer.id });

    if (hasApiKey()) {
      const capturedState = currentState;
      llmDecide(capturedState, aiPlayer.id).then((action) => {
        if (!thinkingRef.current) return;
        // Dispatch LLM action. The gameReducer's validateAction will
        // reject it if state has diverged too far, and the next state
        // change will re-trigger this hook for a fresh decision.
        dispatch(action);
        thinkingRef.current = false;
        setAiState({ isThinking: false, thinkingPlayerId: null });
      });
    } else {
      // Rule-based AI (sync, with artificial delay)
      const action = aiDecide(currentState, aiPlayer.id);
      timeoutRef.current = setTimeout(() => {
        dispatch(action);
        thinkingRef.current = false;
        setAiState({ isThinking: false, thinkingPlayerId: null });
      }, delayMs + Math.random() * 300);
    }
  }, [dispatch, delayMs]);

  // Trigger AI on state changes
  useEffect(() => {
    if (state.gamePhase !== 'playing') return;

    const triggerTimeout = setTimeout(() => {
      processAI();
    }, 200);

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
      if (abortRef.current) {
        abortRef.current.abort();
      }
      thinkingRef.current = false;
    };
  }, []);

  return {
    isThinking: aiState.isThinking,
    thinkingPlayerId: aiState.thinkingPlayerId,
  };
}
