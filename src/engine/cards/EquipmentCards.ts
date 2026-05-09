// ============================================================
// Equipment card effect handlers
// ============================================================

import type { GameState, PlayerState } from '../../types/game';
import type { GameAction } from '../../types/actions';
import type { GameCard, EquipmentSlot } from '../../types/cards';
import { findPlayer, cloneState } from '../core/GameState';

// Equip a card from hand to the appropriate slot
export function equipCard(
  state: GameState, playerId: string, cardId: string,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const player = findPlayer(next, playerId);
  if (!player) return { state: next, actions: [] };

  const cardIdx = player.hand.findIndex(c => c.instanceId === cardId);
  if (cardIdx === -1) return { state: next, actions: [] };

  const card = player.hand[cardIdx];
  if (card.category !== 'equipment' || !card.equipSlot) {
    return { state: next, actions: [] };
  }

  // Remove from hand
  player.hand.splice(cardIdx, 1);

  // If there's an existing equipment in this slot, return it to hand
  const slot = card.equipSlot;
  const existing = player.equipment[slot];
  if (existing) {
    player.hand.push(existing);
  }

  // Equip the new card
  player.equipment[slot] = card;

  return { state: next, actions: [] };
}

// Unequip a card (return to hand or discard)
export function unequipCard(
  state: GameState, playerId: string, slot: EquipmentSlot, toHand: boolean = true,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const player = findPlayer(next, playerId);
  if (!player) return { state: next, actions: [] };

  const card = player.equipment[slot];
  if (!card) return { state: next, actions: [] };

  player.equipment[slot] = null;

  if (toHand) {
    player.hand.push(card);
  } else {
    next.discardPile.push(card);
  }

  return { state: next, actions: [] };
}

// Get weapon range for a player (1 if no weapon equipped)
export function getWeaponRange(player: PlayerState): number {
  if (player.equipment.weapon) {
    return player.equipment.weapon.weaponRange || 1;
  }
  return 1;
}

// Check weapon-specific effects

// 诸葛连弩: unlimited 杀 per turn
export function hasZhugeLiannu(player: PlayerState): boolean {
  return player.equipment.weapon?.subtype === 'zhugeliannu';
}

// 青釭剑: 杀 ignores armor
export function hasQinggangJian(player: PlayerState): boolean {
  return player.equipment.weapon?.subtype === 'qinggangjian';
}

// 丈八蛇矛: can discard 2 cards as 1 杀
export function hasZhangbaShemao(player: PlayerState): boolean {
  return player.equipment.weapon?.subtype === 'zhangbashemao';
}

// 贯石斧: can discard 2 cards to force 杀 damage through
export function hasGuanshifu(player: PlayerState): boolean {
  return player.equipment.weapon?.subtype === 'guanshifu';
}

// 青龙偃月刀: if 杀 is dodged, can play another 杀
export function hasQinglongYanyuedao(player: PlayerState): boolean {
  return player.equipment.weapon?.subtype === 'qinglongyanyuedao';
}

// 麒麟弓: when 杀 deals damage, can destroy target's horse
export function hasQilingong(player: PlayerState): boolean {
  return player.equipment.weapon?.subtype === 'qilingong';
}

// 寒冰剑: when 杀 causes damage, can prevent damage to discard 2 cards
export function hasHanbingjian(player: PlayerState): boolean {
  return player.equipment.weapon?.subtype === 'hanbingjian';
}

// 古锭刀: when 杀 targets a player with no hand, damage +1
export function hasGudingdao(player: PlayerState): boolean {
  return player.equipment.weapon?.subtype === 'gudingdao';
}

// Check armor effects

// 八卦阵: when targeted by 杀, can judge; if red, treated as 闪
export function hasBaguazhen(player: PlayerState): boolean {
  return player.equipment.armor?.subtype === 'baguazhen';
}

// 仁王盾: immune to black 杀
export function hasRenwangdun(player: PlayerState): boolean {
  return player.equipment.armor?.subtype === 'renwangdun';
}

// 藤甲: immune to 南蛮入侵, 万箭齐发, and normal 杀; fire damage +1
export function hasTengjia(player: PlayerState): boolean {
  return player.equipment.armor?.subtype === 'tengjia';
}

// Check if a card effect is blocked by armor
export function isImmuneToCard(player: PlayerState, card: GameCard): boolean {
  // 藤甲 immunity
  if (hasTengjia(player)) {
    if (card.subtype === 'nanman_ruqin') return true;
    if (card.subtype === 'wanjian_qifa') return true;
    if (card.subtype === 'sha' && !card.isFireElement && !card.isThunderElement) return true;
  }

  // 仁王盾 immunity to black 杀
  if (hasRenwangdun(player)) {
    if (card.subtype === 'sha' && (card.suit === 'spade' || card.suit === 'club')) return true;
  }

  return false;
}

// Get horse distance modifiers for a player
export function getHorseModifiers(player: PlayerState): { plusHorse: number; minusHorse: number } {
  return {
    plusHorse: player.equipment.plusHorse ? 1 : 0,
    minusHorse: player.equipment.minusHorse ? 1 : 0,
  };
}

// Process equipment-triggered effects when a 杀 is played
export function processShaEquipmentEffects(
  state: GameState, sourceId: string, targetId: string, card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const actions: GameAction[] = [];
  const source = findPlayer(next, sourceId);
  const target = findPlayer(next, targetId);

  if (!source || !target) return { state: next, actions };

  // 古锭刀: target has no hand → damage +1
  if (hasGudingdao(source) && target.hand.length === 0) {
    // Damage bonus handled in damage calculation
    actions.push({
      type: 'DEAL_DAMAGE', sourceId, targetId, amount: 2,
    });
    return { state: next, actions };
  }

  // 寒冰剑: prevent damage to discard 2 cards from target
  if (hasHanbingjian(source)) {
    // Discard 2 cards from target (randomly, simplified)
    for (let i = 0; i < 2 && target.hand.length > 0; i++) {
      const discard = target.hand.pop()!;
      next.discardPile.push(discard);
    }
    // No damage is dealt
    return { state: next, actions };
  }

  return { state: next, actions };
}
