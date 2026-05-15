// ============================================================
// Turn timer hook — countdown for play and discard phases
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';
import type { GameState } from '../types/game';
import type { GameAction } from '../types/actions';
import { findPlayer } from '../engine/core/GameState';

const PLAY_TIMEOUT_SEC = 30;
const DISCARD_TIMEOUT_SEC = 15;

export function useTurnTimer(
  state: GameState,
  dispatch: React.Dispatch<GameAction>,
) {
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  useEffect(() => {
    clearTimers();
    setRemainingSec(null);

    if (state.gamePhase !== 'playing' || state.pendingAction) return;

    const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
    const player = findPlayer(state, currentPlayerId);
    if (!player || player.isAI) return;

    const phase = state.currentTurnPhase;
    let timeout: number;
    if (phase === 'play') {
      timeout = PLAY_TIMEOUT_SEC;
    } else if (phase === 'discard') {
      timeout = DISCARD_TIMEOUT_SEC;
    } else {
      return;
    }

    setRemainingSec(timeout);

    timerRef.current = setInterval(() => {
      setRemainingSec(prev => {
        if (prev === null || prev <= 1) return prev;
        return prev - 1;
      });
    }, 1000);

    timeoutRef.current = setTimeout(() => {
      clearTimers();
      setRemainingSec(null);
      const latestState = stateRef.current;
      if (phase === 'play') {
        dispatch({ type: 'END_PHASE', playerId: currentPlayerId });
      } else if (phase === 'discard') {
        const p = findPlayer(latestState, currentPlayerId);
        if (p && p.hand.length > p.hp) {
          const toDiscard = p.hand.length - p.hp;
          const shuffled = [...p.hand].sort(() => Math.random() - 0.5);
          for (let i = 0; i < toDiscard; i++) {
            dispatch({ type: 'DISCARD_CARD', playerId: currentPlayerId, cardId: shuffled[i].instanceId });
          }
        }
        dispatch({ type: 'END_TURN', playerId: currentPlayerId });
      }
    }, timeout * 1000);

    return clearTimers;
  }, [
    state.currentPlayerIndex,
    state.currentTurnPhase,
    state.pendingAction,
    state.gamePhase,
  ]);

  return { remainingSec };
}
