// ============================================================
// Game event types - for EventBus communication
// ============================================================

import type { CardSuit } from './cards';

export type GameEvent =
  | { type: 'CARD_PLAYED'; playerId: string; cardId: string; targets: string[] }
  | { type: 'CARD_DISCARDED'; playerId: string; cardId: string }
  | { type: 'CARD_DRAWN'; playerId: string; count: number }
  | { type: 'DAMAGE_DEALT'; sourceId: string; targetId: string; amount: number; element?: string }
  | { type: 'HP_CHANGED'; playerId: string; delta: number; newHp: number }
  | { type: 'DYING'; playerId: string; requiredTaos: number }
  | { type: 'PLAYER_DIED'; playerId: string; identity: string }
  | { type: 'TURN_STARTED'; playerId: string }
  | { type: 'TURN_ENDED'; playerId: string }
  | { type: 'PHASE_CHANGED'; phase: string }
  | { type: 'EQUIPPED'; playerId: string; cardId: string; slot: string }
  | { type: 'UNEQUIPPED'; playerId: string; cardId: string; slot: string }
  | { type: 'JUDGMENT_REVEALED'; playerId: string; cardId: string; suit: CardSuit; result: boolean }
  | { type: 'SKILL_USED'; playerId: string; skillId: string }
  | { type: 'GAME_OVER'; winner: string }
  | { type: 'IDENTITY_REVEALED'; playerId: string; identity: string };

export type EventHandler = (event: GameEvent) => void;

// Simple typed event bus
export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  on(eventType: GameEvent['type'], handler: EventHandler): void {
    const existing = this.handlers.get(eventType) || [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }

  off(eventType: GameEvent['type'], handler: EventHandler): void {
    const existing = this.handlers.get(eventType);
    if (existing) {
      this.handlers.set(eventType, existing.filter(h => h !== handler));
    }
  }

  emit(event: GameEvent): void {
    const handlers = this.handlers.get(event.type) || [];
    for (const handler of handlers) {
      handler(event);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
