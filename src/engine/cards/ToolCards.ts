// ============================================================
// Tool card effect resolvers - all non-delayed and delayed tools
// ============================================================

import type { GameState } from '../../types/game';
import type { GameAction } from '../../types/actions';
import type { GameCard } from '../../types/cards';
import { findPlayer, cloneState } from '../core/GameState';
import { drawCards } from '../core/DeckFactory';
import { getTargetsInRange } from '../systems/DistanceSystem';

// ================================================================
// Non-delayed tool cards
// ================================================================

// 过河拆桥: discard one card from target's hand/equipment/judgment area
export function resolveGuoheChaiqiao(
  state: GameState, sourceId: string, targetId: string, card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const source = findPlayer(next, sourceId);
  const target = findPlayer(next, targetId);
  if (!source || !target) return { state: next, actions: [] };

  // Remove card from hand
  removeCardFromHand(source, card, next);

  // Target player must discard one card (chosen by source in real game; simplified: random discard from target)
  const targetCards = [
    ...target.hand,
    ...Object.values(target.equipment).filter(Boolean) as GameCard[],
    ...target.judgmentArea,
  ];

  if (targetCards.length > 0) {
    // For now, discard a random card. In full implementation, source picks.
    const randomIdx = Math.floor(Math.random() * targetCards.length);
    const toDiscard = targetCards[randomIdx];
    removeCardFromZone(target, toDiscard, next);
    next.discardPile.push(toDiscard);
  }

  return { state: next, actions: [] };
}

// 顺手牵羊: steal one card from target's hand/equipment/judgment area
export function resolveShunshouQianyang(
  state: GameState, sourceId: string, targetId: string, card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const source = findPlayer(next, sourceId);
  const target = findPlayer(next, targetId);
  if (!source || !target) return { state: next, actions: [] };

  removeCardFromHand(source, card, next);

  // Steal a random card from target (simplified)
  const targetCards = [
    ...target.hand,
    ...Object.values(target.equipment).filter(Boolean) as GameCard[],
    ...target.judgmentArea,
  ];

  if (targetCards.length > 0) {
    const randomIdx = Math.floor(Math.random() * targetCards.length);
    const toSteal = targetCards[randomIdx];
    removeCardFromZone(target, toSteal, next);
    source.hand.push(toSteal);
  }

  return { state: next, actions: [] };
}

// 无中生有: draw 2 cards
export function resolveWuzhongShengyou(
  state: GameState, sourceId: string, card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const source = findPlayer(next, sourceId);
  if (!source) return { state: next, actions: [] };

  removeCardFromHand(source, card, next);

  const { drawnCards, newDeck, newDiscardPile } = drawCards(next.deck, next.discardPile, 2);
  next.deck = newDeck;
  next.discardPile = newDiscardPile;
  source.hand.push(...drawnCards);

  return { state: next, actions: [] };
}

// 决斗: target must play 杀 or take 1 damage (handled by CombatSystem)
export function resolveJuedou(
  state: GameState, sourceId: string, targetId: string, card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const source = findPlayer(next, sourceId);
  const target = findPlayer(next, targetId);
  if (!source || !target) return { state: next, actions: [] };

  removeCardFromHand(source, card, next);

  // Target must play 杀
  const validSha = target.hand.filter(c => c.subtype === 'sha');
  next.pendingAction = {
    type: 'respond_to_juedou',
    playerId: targetId,
    sourceCardId: card.instanceId,
    validResponseCards: validSha.map(c => c.instanceId),
    timeoutAction: { type: 'DEAL_DAMAGE', sourceId, targetId, amount: 1 },
  };

  return { state: next, actions: [] };
}

// 南蛮入侵: everyone else must play 杀 or take 1 damage
export function resolveNanmanRuqin(
  state: GameState, sourceId: string, card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const source = findPlayer(next, sourceId);
  if (!source) return { state: next, actions: [] };

  removeCardFromHand(source, card, next);

  // Queue responses for all alive players except source
  const targets = next.players.filter(
    p => p.id !== sourceId && p.aliveStatus !== 'dead'
  );

  // Will be processed one-by-one via pendingAction in game loop
  for (const target of targets) {
    if (target.equipment.armor?.subtype === 'tengjia') continue; // 藤甲 immune
    const validSha = target.hand.filter(c => c.subtype === 'sha');
    if (validSha.length === 0) {
      // Auto-damage if they have no 杀
      target.hp -= 1;
      if (target.hp <= 0) {
        target.hp = 0;
        target.aliveStatus = 'dying';
      }
    }
    // If they have 杀, they'll be prompted individually via pendingAction
  }

  return { state: next, actions: [] };
}

// 万箭齐发: everyone else must play 闪 or take 1 damage
export function resolveWanjianQifa(
  state: GameState, sourceId: string, card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const source = findPlayer(next, sourceId);
  if (!source) return { state: next, actions: [] };

  removeCardFromHand(source, card, next);

  const targets = next.players.filter(
    p => p.id !== sourceId && p.aliveStatus !== 'dead'
  );

  for (const target of targets) {
    if (target.equipment.armor?.subtype === 'tengjia') continue; // 藤甲 immune
    const validShan = target.hand.filter(c => c.subtype === 'shan');
    if (validShan.length === 0) {
      target.hp -= 1;
      if (target.hp <= 0) {
        target.hp = 0;
        target.aliveStatus = 'dying';
      }
    }
  }

  return { state: next, actions: [] };
}

// 桃园结义: all alive players heal 1 HP
export function resolveTaoyuanJieyi(
  state: GameState, sourceId: string, card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const source = findPlayer(next, sourceId);
  if (!source) return { state: next, actions: [] };

  removeCardFromHand(source, card, next);

  for (const player of next.players) {
    if (player.aliveStatus !== 'dead' && player.hp < player.maxHp) {
      player.hp = Math.min(player.hp + 1, player.maxHp);
    }
  }

  return { state: next, actions: [] };
}

// 五谷丰登: reveal cards equal to alive players, each picks one in turn order
export function resolveWuguFengdeng(
  state: GameState, sourceId: string, card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const source = findPlayer(next, sourceId);
  if (!source) return { state: next, actions: [] };

  removeCardFromHand(source, card, next);

  const aliveCount = next.players.filter(p => p.aliveStatus !== 'dead').length;
  const { drawnCards, newDeck, newDiscardPile } = drawCards(next.deck, next.discardPile, aliveCount);
  next.deck = newDeck;
  next.discardPile = newDiscardPile;

  // Each alive player draws 1 from the revealed set
  // Simplified: distribute one to each alive player
  const alivePlayers = next.players.filter(p => p.aliveStatus !== 'dead');
  for (let i = 0; i < Math.min(drawnCards.length, alivePlayers.length); i++) {
    alivePlayers[i].hand.push(drawnCards[i]);
  }
  // Remaining cards go to discard
  for (let i = alivePlayers.length; i < drawnCards.length; i++) {
    next.discardPile.push(drawnCards[i]);
  }

  return { state: next, actions: [] };
}

// 借刀杀人: ask target to 杀 another player or give you their weapon
export function resolveJiedaoSharen(
  state: GameState, sourceId: string, targetId: string, secondaryTargetId: string, card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const source = findPlayer(next, sourceId);
  const target = findPlayer(next, targetId);
  if (!source || !target) return { state: next, actions: [] };

  removeCardFromHand(source, card, next);

  // If target has a weapon and can attack the secondary target, they must either:
  // 1. Play 杀 targeting the secondary target
  // 2. Give their weapon to the source
  if (target.equipment.weapon) {
    const validSha = target.hand.filter(c => c.subtype === 'sha');
    if (validSha.length > 0) {
      // Target should play 杀 on secondary target
      // If they don't, their weapon goes to source
      // (Simplified: auto-give weapon to source if target has no 杀)
      return { state: next, actions: [] };
    } else {
      // Give weapon to source
      const weapon = target.equipment.weapon!;
      target.equipment.weapon = null;
      source.hand.push(weapon);
    }
  }

  return { state: next, actions: [] };
}

// ================================================================
// Delayed tool cards (placed in judgment area)
// ================================================================

// 乐不思蜀: skip play phase
export function resolveLebuSishu(
  state: GameState, sourceId: string, targetId: string, card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const source = findPlayer(next, sourceId);
  const target = findPlayer(next, targetId);
  if (!source || !target) return { state: next, actions: [] };

  removeCardFromHand(source, card, next);

  // Can't place duplicate 乐不思蜀 on same player
  const existing = target.judgmentArea.find(c => c.subtype === 'lebu_sishu');
  if (!existing) {
    target.judgmentArea.push(card);
  } else {
    next.discardPile.push(card); // Can't place, goes to discard
  }

  return { state: next, actions: [] };
}

// 兵粮寸断: skip draw phase
export function resolveBingliangCunduan(
  state: GameState, sourceId: string, targetId: string, card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const source = findPlayer(next, sourceId);
  const target = findPlayer(next, targetId);
  if (!source || !target) return { state: next, actions: [] };

  removeCardFromHand(source, card, next);

  const existing = target.judgmentArea.find(c => c.subtype === 'bingliang_cunduan');
  if (!existing) {
    target.judgmentArea.push(card);
  } else {
    next.discardPile.push(card);
  }

  return { state: next, actions: [] };
}

// 闪电: at judge phase, if spade 2-9, take 3 thunder damage; else pass to next player
export function resolveShandian(
  state: GameState, sourceId: string, card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const source = findPlayer(next, sourceId);
  if (!source) return { state: next, actions: [] };

  removeCardFromHand(source, card, next);
  source.judgmentArea.push(card);

  return { state: next, actions: [] };
}

// ================================================================
// Helpers
// ================================================================

function removeCardFromHand(player: NonNullable<ReturnType<typeof findPlayer>>, card: GameCard, state: GameState): void {
  const idx = player.hand.findIndex(c => c.instanceId === card.instanceId);
  if (idx !== -1) {
    player.hand.splice(idx, 1);
  }
  state.discardPile.push(card);
}

function removeCardFromZone(
  player: NonNullable<ReturnType<typeof findPlayer>>,
  card: GameCard,
  state: GameState,
): void {
  // Check hand
  let idx = player.hand.findIndex(c => c.instanceId === card.instanceId);
  if (idx !== -1) { player.hand.splice(idx, 1); return; }

  // Check equipment
  for (const slot of ['weapon', 'armor', 'plusHorse', 'minusHorse'] as const) {
    if (player.equipment[slot]?.instanceId === card.instanceId) {
      player.equipment[slot] = null;
      return;
    }
  }

  // Check judgment area
  idx = player.judgmentArea.findIndex(c => c.instanceId === card.instanceId);
  if (idx !== -1) {
    player.judgmentArea.splice(idx, 1);
    return;
  }
}
