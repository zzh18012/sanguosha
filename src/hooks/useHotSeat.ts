// ============================================================
// Hot-seat mode hook - manages viewer switching between players
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import type { GameState } from '../types/game';

interface HotSeatState {
  currentViewerId: string | null;
  isGateOpen: boolean;
  gateTargetId: string | null;
}

export function useHotSeat(state: GameState, isHotSeat: boolean) {
  const [hs, setHs] = useState<HotSeatState>({
    currentViewerId: null,
    isGateOpen: false,
    gateTargetId: null,
  });

  const viewedPlayersRef = useRef<Set<string>>(new Set());

  // Initialize viewer
  useEffect(() => {
    if (!isHotSeat || state.players.length === 0) return;

    if (!hs.currentViewerId) {
      // Start with the first alive player
      const first = state.players.find(p => p.aliveStatus !== 'dead');
      if (first) {
        setHs({
          currentViewerId: first.id,
          isGateOpen: true,
          gateTargetId: first.id,
        });
      }
    }
  }, [isHotSeat, state.players]);

  const openGate = useCallback((targetId: string) => {
    setHs(prev => ({
      ...prev,
      isGateOpen: true,
      gateTargetId: targetId,
    }));
  }, []);

  const closeGate = useCallback(() => {
    setHs(prev => {
      const targetId = prev.gateTargetId;
      if (targetId) {
        viewedPlayersRef.current.add(targetId);
      }
      return {
        ...prev,
        isGateOpen: false,
        currentViewerId: targetId,
        gateTargetId: null,
      };
    });
  }, []);

  // Check if we need to show gate when turn changes
  useEffect(() => {
    if (!isHotSeat || !hs.currentViewerId) return;
    if (state.gamePhase !== 'playing') return;

    const currentId = state.turnOrder[state.currentPlayerIndex];
    const currentPlayer = state.players.find(p => p.id === currentId);

    if (currentPlayer && currentPlayer.aliveStatus !== 'dead') {
      // Show gate when it's a new player's turn and it's not the current viewer
      if (currentId !== hs.currentViewerId && !hs.isGateOpen) {
        openGate(currentId);
      }
    }
  }, [state.currentPlayerIndex, state.turnOrder, state.players, state.gamePhase]);

  // Show gate when there's a pending response and viewer isn't the responder
  useEffect(() => {
    if (!isHotSeat || !hs.currentViewerId || !state.pendingAction) return;

    const responderId = state.pendingAction.playerId;
    if (responderId !== hs.currentViewerId && !hs.isGateOpen) {
      openGate(responderId);
    }
  }, [state.pendingAction]);

  return {
    currentViewerId: hs.currentViewerId,
    isGateOpen: hs.isGateOpen,
    gateTargetId: hs.gateTargetId,
    closeGate,
    openGate,
  };
}

// Get the visibility-filtered state for the current viewer
export function getVisibleHand(playerId: string, viewerId: string | null, isViewer: boolean): boolean {
  if (!viewerId) return !isViewer; // no restriction if no hot-seat
  return viewerId === playerId;
}
