// ============================================================
// Game orchestrator - top-level game control
// ============================================================

import type { GameState, GameConfig, GameMode } from '../../types/game';
import type { GameAction } from '../../types/actions';
import type { GameEvent, EventHandler } from '../../types/events';
import { createInitialState, initializeDeck, dealInitialHands } from './GameState';
import { validateAction } from './RulesEngine';
import { resolveAction } from './ActionResolver';
import { EventBus } from '../../types/events';

export class Game {
  state: GameState;
  private eventBus: EventBus;

  constructor(config: GameConfig) {
    this.state = createInitialState(config);
    this.eventBus = new EventBus();
  }

  // Start the game (transition from character_select to playing)
  start(): void {
    this.state = initializeDeck(this.state);
    this.state = dealInitialHands(this.state);
    this.state.gamePhase = 'playing';
    this.state.currentTurnPhase = 'judge';

    // Start first turn
    const firstPlayerId = this.state.turnOrder[0];
    this.dispatch({ type: 'TURN_START', playerId: firstPlayerId });
    // Auto-draw 2 cards for first player
    this.dispatch({ type: 'DRAW_CARDS', playerId: firstPlayerId, count: 2 });
  }

  // Dispatch an action - validate, resolve, and check for follow-up actions
  dispatch(action: GameAction): GameAction[] {
    const allNewActions: GameAction[] = [];

    // Add to history
    this.state.actionHistory.push({
      timestamp: Date.now(),
      playerId: 'playerId' in action ? (action as Record<string, unknown>).playerId as string : '',
      playerName: '',
      action,
      description: `${action.type}`,
    });

    // Validate
    if (!validateAction(this.state, action)) {
      console.warn('Invalid action:', action);
      return allNewActions;
    }

    // Resolve
    const { state: newState, newActions } = resolveAction(this.state, action);
    this.state = newState;

    // Process follow-up actions recursively (with max depth to prevent infinite loops)
    const toProcess = [...newActions];
    let depth = 0;
    const maxDepth = 50;

    while (toProcess.length > 0 && depth < maxDepth) {
      const nextAction = toProcess.shift()!;
      allNewActions.push(nextAction);

      // System actions don't need validation
      if (['DRAW_CARDS', 'DEAL_DAMAGE', 'HEAL_HP', 'ENTER_DYING',
           'PLAYER_DIED', 'DISCARD_ALL_CARDS', 'DISCARD_TO_MAX_HP',
           'CHECK_VICTORY', 'TURN_START', 'PHASE_CHANGE', 'DESTROY_EQUIPMENT',
           'ENTER_JUDGMENT_PHASE', 'RESOLVE_JUDGMENT']
          .includes(nextAction.type)) {
        const { state: nextState, newActions: moreActions } = resolveAction(this.state, nextAction);
        this.state = nextState;
        toProcess.push(...moreActions);
      } else if (validateAction(this.state, nextAction)) {
        const { state: nextState, newActions: moreActions } = resolveAction(this.state, nextAction);
        this.state = nextState;
        toProcess.push(...moreActions);
      }

      depth++;
    }

    return allNewActions;
  }

  // Event subscription
  on(eventType: GameEvent['type'], handler: EventHandler): void {
    this.eventBus.on(eventType, handler);
  }

  off(eventType: GameEvent['type'], handler: EventHandler): void {
    this.eventBus.off(eventType, handler);
  }

  // Emit an event
  emit(event: GameEvent): void {
    this.eventBus.emit(event);
  }

  // Getters
  getState(): GameState {
    return this.state;
  }

  getCurrentPlayerId(): string {
    return this.state.turnOrder[this.state.currentPlayerIndex];
  }

  isGameOver(): boolean {
    return this.state.gamePhase === 'finished';
  }

  getWinner(): string | null {
    return this.state.winner;
  }

  // Static factory for convenience
  static create(mode: GameMode, playerNames: string[], aiIndices: number[]): Game {
    return new Game({
      mode,
      playerNames,
      aiPlayerIndices: aiIndices,
    });
  }
}

// Expose a simpler functional API for React
export function createGame(config: GameConfig): Game {
  return new Game(config);
}
