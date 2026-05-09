// ============================================================
// StateMasker — mask game state per player view
// ============================================================

import type { GameState } from '../src/types/game';
import type { GameCard } from '../src/types/cards';

export interface MaskedStateResult {
  state: GameState;
  deckCount: number;
  discardCount: number;
}

export function maskState(state: GameState, viewerId: string): MaskedStateResult {
  const masked: GameState = JSON.parse(JSON.stringify(state));

  const deckCount = masked.deck.length;
  const discardCount = masked.discardPile.length;

  masked.deck = [];
  masked.discardPile = [];

  for (const player of masked.players) {
    if (player.id === viewerId) continue;

    player.hand = player.hand.map((card) => createMaskedCard(card.instanceId));

    if (!player.identityRevealed) {
      player.identity = 'rebel';
    }
  }

  return { state: masked, deckCount, discardCount };
}

function createMaskedCard(instanceId: string): GameCard {
  return {
    instanceId,
    definitionId: '',
    name: '?',
    category: 'basic',
    subtype: 'sha',
    suit: 'spade',
    rankNumber: 1,
    rankDisplay: '?',
    toolTiming: null,
    equipSlot: null,
    weaponRange: null,
    isFireElement: false,
    isThunderElement: false,
  };
}
