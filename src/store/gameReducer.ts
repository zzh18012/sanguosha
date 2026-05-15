// ============================================================
// Game reducer - thin bridge between React and game engine
// ============================================================

import type { GameState } from '../types/game';
import type { GameAction } from '../types/actions';
import { validateAction } from '../engine/core/RulesEngine';
import { resolveAction } from '../engine/core/ActionResolver';
import { cloneState } from '../engine/core/GameState';
import { checkTriggers, executeSkill } from '../engine/characters/SkillEngine';

export function gameReducer(state: GameState, action: GameAction): GameState {
  // Only validate user-facing actions; system actions skip validation
  const systemActions = [
    'DRAW_CARDS', 'DRAW_CARDS_SPECIFIC', 'DEAL_DAMAGE', 'HEAL_HP',
    'ENTER_DYING', 'PLAYER_DIED', 'DISCARD_ALL_CARDS', 'DISCARD_TO_MAX_HP',
    'CHECK_VICTORY', 'TURN_START', 'PHASE_CHANGE', 'DESTROY_EQUIPMENT',
    'ENTER_JUDGMENT_PHASE', 'RESOLVE_JUDGMENT', 'PLACE_DELAYED_TOOL',
    'REMOVE_DELAYED_TOOL', 'STEAL_CARD', 'CHAIN_PLAYERS', 'TURN_OVER',
    'START_GAME', 'SELECT_CHARACTER', 'REQUEST_CHARACTER_SELECTION', 'AI_THINK',
  ];

  if (!systemActions.includes(action.type)) {
    if (!validateAction(state, action)) {
      console.warn('Invalid action rejected:', action);
      return state;
    }
  }

  const { state: newState, newActions } = resolveAction(state, action);

  // Process follow-up actions (up to a limit)
  let current = cloneState(newState);
  const pending: GameAction[] = [...newActions];

  // Check triggers for the initial dispatched action
  const initTriggers = checkTriggers(current, action);
  for (const t of initTriggers) {
    const skillResult = executeSkill(current, t.playerId, t.skill.id, action);
    pending.push(...skillResult.actions);
  }

  let depth = 0;

  while (pending.length > 0 && depth < 50) {
    const nextAction = pending.shift()!;
    const { state: result, newActions: more } = resolveAction(current, nextAction);
    current = result;
    pending.push(...more);

    // After resolving the action, check for skill triggers
    const triggered = checkTriggers(current, nextAction);
    for (const t of triggered) {
      const skillResult = executeSkill(current, t.playerId, t.skill.id, nextAction);
      pending.push(...skillResult.actions);
    }

    depth++;
  }

  return current;
}
