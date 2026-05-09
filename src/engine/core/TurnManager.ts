// ============================================================
// Turn and phase management
// ============================================================

import type { GameState, TurnPhase } from '../../types/game';
import type { GameAction } from '../../types/actions';
import { cloneState, getNextAlivePlayerIndex } from './GameState';

// Phase order
const PHASE_ORDER: TurnPhase[] = ['judge', 'draw', 'play', 'discard', 'end'];

// Advance to the next phase within the current turn
export function advancePhase(state: GameState): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const actions: GameAction[] = [];

  const currentIdx = PHASE_ORDER.indexOf(next.currentTurnPhase);
  const currentPlayerId = next.turnOrder[next.currentPlayerIndex];

  if (currentIdx < PHASE_ORDER.length - 1) {
    // Move to next phase within the turn
    next.currentTurnPhase = PHASE_ORDER[currentIdx + 1];
  } else {
    // End of turn - advance to next alive player
    next.currentTurnPhase = 'judge';
    const nextIdx = getNextAlivePlayerIndex(next, next.currentPlayerIndex);

    if (nextIdx <= next.currentPlayerIndex) {
      // Wrapped around - new round
      next.roundNumber++;
    }

    next.currentPlayerIndex = nextIdx;
    next.turnNumber++;

    const newPlayerId = next.turnOrder[nextIdx];
    actions.push({ type: 'TURN_START', playerId: newPlayerId });

    // Reset turn flags for the new player
    const newPlayer = next.players.find(p => p.id === newPlayerId);
    if (newPlayer) {
      newPlayer.shaUsedThisTurn = false;
      newPlayer.jiuUsedThisTurn = false;
    }
  }

  actions.push({ type: 'PHASE_CHANGE', phase: next.currentTurnPhase });

  return { state: next, actions };
}

// Get what actions are available in a given phase
export function getPhaseActions(phase: TurnPhase): string[] {
  switch (phase) {
    case 'judge':
      return ['resolve_judgments'];
    case 'draw':
      return ['draw_cards'];
    case 'play':
      return ['play_card', 'use_skill', 'equip_card', 'end_phase'];
    case 'discard':
      return ['discard_to_hp'];
    case 'end':
      return ['advance_turn'];
    default:
      return [];
  }
}

// Process judge phase: resolve all delayed tool cards on the current player
export function startJudgePhase(state: GameState): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const actions: GameAction[] = [];
  const currentPlayerId = next.turnOrder[next.currentPlayerIndex];
  const player = next.players.find(p => p.id === currentPlayerId);

  if (player && player.judgmentArea.length > 0) {
    for (const card of player.judgmentArea) {
      actions.push({ type: 'ENTER_JUDGMENT_PHASE', playerId: currentPlayerId });
      // Actual judgment resolution is handled by JudgmentSystem
    }
  }

  return { state: next, actions };
}

// Process draw phase: draw 2 cards (default)
export function startDrawPhase(state: GameState): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const currentPlayerId = next.turnOrder[next.currentPlayerIndex];
  const actions: GameAction[] = [
    { type: 'DRAW_CARDS', playerId: currentPlayerId, count: 2 },
  ];
  return { state: next, actions };
}

// Process play phase: player can freely play cards
export function startPlayPhase(state: GameState): GameState {
  const next = cloneState(state);
  next.currentTurnPhase = 'play';
  return next;
}

// Process discard phase: discard down to current HP
export function startDiscardPhase(state: GameState): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const actions: GameAction[] = [];
  const currentPlayerId = next.turnOrder[next.currentPlayerIndex];
  const player = next.players.find(p => p.id === currentPlayerId);

  if (player && player.hand.length > player.hp) {
    actions.push({ type: 'DISCARD_TO_MAX_HP', playerId: currentPlayerId });
  }

  return { state: next, actions };
}

// Start a new turn for the given player
export function startTurn(state: GameState): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  next.currentTurnPhase = 'judge';
  const currentPlayerId = next.turnOrder[next.currentPlayerIndex];

  // Reset per-turn flags
  const player = next.players.find(p => p.id === currentPlayerId);
  if (player) {
    player.shaUsedThisTurn = false;
    player.jiuUsedThisTurn = false;
    player.isIntoxicated = false; // 酒 effect wears off each turn
  }

  return {
    state: next,
    actions: [{ type: 'TURN_START', playerId: currentPlayerId }],
  };
}

// End current turn
export function endTurn(state: GameState): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const currentPlayerId = next.turnOrder[next.currentPlayerIndex];

  const actions: GameAction[] = [
    { type: 'END_TURN', playerId: currentPlayerId },
  ];

  // Advance to next alive player
  const nextIdx = getNextAlivePlayerIndex(next, next.currentPlayerIndex);
  if (nextIdx <= next.currentPlayerIndex) {
    next.roundNumber++;
  }

  next.currentPlayerIndex = nextIdx;
  next.turnNumber++;
  next.currentTurnPhase = 'judge';

  const newPlayerId = next.turnOrder[nextIdx];
  actions.push({ type: 'TURN_START', playerId: newPlayerId });

  return { state: next, actions };
}
