// ============================================================
// Combat system - handles 杀, 闪, 桃, 酒, damage, and combat chains
// ============================================================

import type { GameState } from '../../types/game';
import type { GameAction } from '../../types/actions';
import type { GameCard } from '../../types/cards';
import { findPlayer, cloneState } from '../core/GameState';
import { isInRange } from './DistanceSystem';

// Resolve a 杀 → 闪 chain
export function resolveSha(
  state: GameState,
  sourceId: string,
  targetId: string,
  card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const actions: GameAction[] = [];
  const source = findPlayer(next, sourceId);
  const target = findPlayer(next, targetId);

  if (!source || !target) return { state: next, actions };

  // Check range
  if (!isInRange(next, sourceId, targetId)) {
    return { state: next, actions }; // Invalid - out of range
  }

  // Move card from hand to processing area
  const cardIdx = source.hand.findIndex(c => c.instanceId === card.instanceId);
  if (cardIdx !== -1) {
    source.hand.splice(cardIdx, 1);
  }
  next.discardPile.push(card);

  source.shaUsedThisTurn = true;

  // Calculate damage amount
  let damageAmount = 1;
  // 酒 effect: next 杀 +1 damage
  if (source.isIntoxicated) {
    damageAmount += 1;
    source.isIntoxicated = false;
  }

  // 藤甲: immune to normal 杀
  if (target.equipment.armor?.subtype === 'tengjia') {
    if (!card.isFireElement && !card.isThunderElement) {
      // 藤甲 negates normal 杀 entirely
      return { state: next, actions };
    }
    // 藤甲 takes +1 from fire damage
    if (card.isFireElement) {
      damageAmount += 1;
    }
  }

  // 仁王盾: immune to black 杀
  if (target.equipment.armor?.subtype === 'renwangdun') {
    if (card.suit === 'spade' || card.suit === 'club') {
      return { state: next, actions }; // Negated
    }
  }

  // Set up response pending action (target can play 闪)
  const validShan = target.hand.filter(c => c.subtype === 'shan');
  next.pendingAction = {
    type: 'respond_to_sha',
    playerId: targetId,
    sourceCardId: card.instanceId,
    validResponseCards: validShan.map(c => c.instanceId),
    timeoutAction: {
      type: 'DEAL_DAMAGE',
      sourceId,
      targetId,
      amount: damageAmount,
      element: card.isFireElement ? 'fire' : card.isThunderElement ? 'thunder' : 'normal',
    },
  };

  return { state: next, actions };
}

// Resolve a 决斗
export function resolveJuedou(
  state: GameState,
  sourceId: string,
  targetId: string,
  _card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const actions: GameAction[] = [];
  const target = findPlayer(next, targetId);

  if (!target) return { state: next, actions };

  // Remove card from source hand
  const source = findPlayer(next, sourceId);
  if (source) {
    const cardIdx = source.hand.findIndex(c => c.instanceId === _card.instanceId);
    if (cardIdx !== -1) {
      source.hand.splice(cardIdx, 1);
    }
  }
  next.discardPile.push(_card);

  // Target must play 杀 or take damage
  const validSha = target.hand.filter(c => c.subtype === 'sha');
  next.pendingAction = {
    type: 'respond_to_juedou',
    playerId: targetId,
    sourceCardId: _card.instanceId,
    validResponseCards: validSha.map(c => c.instanceId),
    timeoutAction: { type: 'DEAL_DAMAGE', sourceId, targetId, amount: 1 },
  };

  return { state: next, actions };
}

// Resolve 南蛮入侵: everyone else must play 杀 or take damage
export function resolveNanman(
  state: GameState,
  sourceId: string,
  card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const actions: GameAction[] = [];
  const source = findPlayer(next, sourceId);

  if (source) {
    const cardIdx = source.hand.findIndex(c => c.instanceId === card.instanceId);
    if (cardIdx !== -1) {
      source.hand.splice(cardIdx, 1);
    }
  }
  next.discardPile.push(card);

  // Queue responses from all other alive players in turn order
  // Start from the player after the source
  const alivePlayers = next.players.filter(
    p => p.aliveStatus !== 'dead' && p.id !== sourceId
  );

  // 藤甲 grants immunity to 南蛮入侵
  for (const player of alivePlayers) {
    if (player.equipment.armor?.subtype === 'tengjia') continue;

    // Find first valid 杀 in hand
    const validSha = player.hand.filter(c => c.subtype === 'sha');
    // We'll process these sequentially in the game loop
    next.pendingAction = {
      type: 'respond_to_nanman',
      playerId: player.id,
      sourceCardId: card.instanceId,
      validResponseCards: validSha.map(c => c.instanceId),
      timeoutAction: { type: 'DEAL_DAMAGE', sourceId, targetId: player.id, amount: 1 },
    };
    break; // Process one at a time
  }

  return { state: next, actions };
}

// Resolve 万箭齐发: everyone else must play 闪 or take damage
export function resolveWanjian(
  state: GameState,
  sourceId: string,
  card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const actions: GameAction[] = [];
  const source = findPlayer(next, sourceId);

  if (source) {
    const cardIdx = source.hand.findIndex(c => c.instanceId === card.instanceId);
    if (cardIdx !== -1) {
      source.hand.splice(cardIdx, 1);
    }
  }
  next.discardPile.push(card);

  const alivePlayers = next.players.filter(
    p => p.aliveStatus !== 'dead' && p.id !== sourceId
  );

  for (const player of alivePlayers) {
    if (player.equipment.armor?.subtype === 'tengjia') continue;

    const validShan = player.hand.filter(c => c.subtype === 'shan');
    next.pendingAction = {
      type: 'respond_to_wanjian',
      playerId: player.id,
      sourceCardId: card.instanceId,
      validResponseCards: validShan.map(c => c.instanceId),
      timeoutAction: { type: 'DEAL_DAMAGE', sourceId, targetId: player.id, amount: 1 },
    };
    break;
  }

  return { state: next, actions };
}

// 八卦阵 judgment: when targeted by 杀, can judge instead of playing 闪
export function tryBaguazhen(
  state: GameState,
  targetId: string,
): { success: boolean; judgeCard: GameCard | null } {
  const target = findPlayer(state, targetId);
  if (!target || target.equipment.armor?.subtype !== 'baguazhen') {
    return { success: false, judgeCard: null };
  }

  // Draw top card for judgment
  if (state.deck.length === 0) return { success: false, judgeCard: null };

  const judgeCard = state.deck[state.deck.length - 1];
  // Success if red suit (heart or diamond)
  const success = judgeCard.suit === 'heart' || judgeCard.suit === 'diamond';

  return { success, judgeCard };
}
