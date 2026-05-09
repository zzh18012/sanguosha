// ============================================================
// Lifecycle system - HP, dying, death, card rewards/penalties
// ============================================================

import type { GameState } from '../../types/game';
import type { GameAction } from '../../types/actions';
import type { GameCard } from '../../types/cards';
import { findPlayer, cloneState } from '../core/GameState';

// Apply damage to a player
export function dealDamage(
  state: GameState,
  sourceId: string,
  targetId: string,
  amount: number,
  _element: 'fire' | 'thunder' | 'normal' = 'normal',
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const actions: GameAction[] = [];
  const target = findPlayer(next, targetId);
  const source = findPlayer(next, sourceId);

  if (!target || target.aliveStatus === 'dead') return { state: next, actions };

  // Apply damage
  let actualDamage = amount;

  target.hp -= actualDamage;

  // Trigger damage events (for skills like 刚烈, 遗计, etc.)
  if (source) {
    // Check identity for later death rewards
  }

  // Handle dying state
  if (target.hp <= 0) {
    target.hp = 0;
    return enterDying(next, targetId);
  }

  return { state: next, actions };
}

// Enter dying state - request 桃
export function enterDying(
  state: GameState,
  playerId: string,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const actions: GameAction[] = [];
  const player = findPlayer(next, playerId);

  if (!player || player.aliveStatus === 'dead') return { state: next, actions };

  const hpDeficit = Math.abs(player.hp); // How far below 0 they are
  player.aliveStatus = 'dying';

  // Set pending action for saving
  // Required tao count = 1 (standard) or more if negative beyond -1
  const requiredTaos = hpDeficit > 0 ? hpDeficit : 1;

  next.pendingAction = {
    type: 'use_tao_dying',
    playerId,
    timeoutAction: { type: 'PLAYER_DIED', playerId },
    extra: { requiredTaos },
  };

  return { state: next, actions };
}

// Resolve player death
export function playerDied(
  state: GameState,
  playerId: string,
  killerId?: string,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const actions: GameAction[] = [];
  const player = findPlayer(next, playerId);
  const killer = killerId ? findPlayer(next, killerId) : undefined;

  if (!player) return { state: next, actions };

  player.aliveStatus = 'dead';
  player.identityRevealed = true;

  // Collect all cards to discard
  const allCards: GameCard[] = [...player.hand];
  for (const slot of ['weapon', 'armor', 'plusHorse', 'minusHorse'] as const) {
    if (player.equipment[slot]) {
      allCards.push(player.equipment[slot]!);
    }
  }
  allCards.push(...player.judgmentArea);

  next.discardPile.push(...allCards);
  player.hand = [];
  player.equipment = { weapon: null, armor: null, plusHorse: null, minusHorse: null };
  player.judgmentArea = [];

  // Death rewards/penalties
  if (killer) {
    if (player.identity === 'rebel') {
      // Killing a rebel: draw 3 cards
      actions.push({ type: 'DRAW_CARDS', playerId: killer.id, count: 3 });
    }
    if (killer.identity === 'ruler' && player.identity === 'loyalist') {
      // Ruler kills loyalist: discard all cards
      actions.push({ type: 'DISCARD_ALL_CARDS', playerId: killer.id });
    }
  }

  // Check victory
  actions.push({ type: 'CHECK_VICTORY' });

  return { state: next, actions };
}

// Use 桃 to heal self (during own turn, or when at low HP)
export function healSelf(
  state: GameState,
  playerId: string,
  card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const actions: GameAction[] = [];
  const player = findPlayer(next, playerId);

  if (!player) return { state: next, actions };
  if (player.hp >= player.maxHp && player.aliveStatus !== 'dying') {
    return { state: next, actions }; // Can't heal above max unless dying
  }

  // Remove 桃 from hand
  const cardIdx = player.hand.findIndex(c => c.instanceId === card.instanceId);
  if (cardIdx !== -1) {
    player.hand.splice(cardIdx, 1);
  }
  next.discardPile.push(card);

  player.hp = Math.min(player.hp + 1, player.maxHp);
  if (player.aliveStatus === 'dying') {
    player.aliveStatus = 'alive';
  }

  return { state: next, actions };
}

// Use 桃 to save a dying player
export function saveDying(
  state: GameState,
  healerId: string,
  targetId: string,
  card: GameCard,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const actions: GameAction[] = [];
  const healer = findPlayer(next, healerId);
  const target = findPlayer(next, targetId);

  if (!healer || !target || target.aliveStatus !== 'dying') {
    return { state: next, actions };
  }

  // Remove 桃 from healer's hand
  const cardIdx = healer.hand.findIndex(c => c.instanceId === card.instanceId);
  if (cardIdx !== -1) {
    healer.hand.splice(cardIdx, 1);
  }
  next.discardPile.push(card);

  target.hp = Math.min(target.hp + 1, target.maxHp);
  if (target.hp > 0) {
    target.aliveStatus = 'alive';
    next.pendingAction = null; // Clear dying request
  }

  return { state: next, actions };
}

// Discard down to HP limit during discard phase
export function discardToMaxHp(
  state: GameState,
  playerId: string,
  selectedCards: string[],
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const player = findPlayer(next, playerId);
  if (!player) return { state: next, actions: [] };

  const discardCount = player.hand.length - player.hp;
  if (discardCount <= 0) return { state: next, actions: [] };

  const toDiscard = selectedCards.slice(0, discardCount);
  for (const cardId of toDiscard) {
    const idx = player.hand.findIndex(c => c.instanceId === cardId);
    if (idx !== -1) {
      const [card] = player.hand.splice(idx, 1);
      next.discardPile.push(card);
    }
  }

  return { state: next, actions: [] };
}

// Check if game should end and determine winner
export function checkAndResolveVictory(state: GameState): { state: GameState; winner: string | null } {
  const next = cloneState(state);
  const alive = next.players.filter(p => p.aliveStatus !== 'dead');

  const hasRuler = alive.some(p => p.identity === 'ruler');
  const hasRebel = alive.some(p => p.identity === 'rebel');
  const hasSpy = alive.some(p => p.identity === 'spy');
  const hasLoyalist = alive.some(p => p.identity === 'loyalist');

  // Ruler wins: all rebels and spies dead
  if (hasRuler && !hasRebel && !hasSpy) {
    next.winner = 'ruler';
    next.gamePhase = 'finished';
    return { state: next, winner: 'ruler' };
  }

  // Rebel wins: ruler dead (unless spy is last standing)
  if (!hasRuler) {
    if (alive.length === 1 && alive[0].identity === 'spy') {
      next.winner = 'spy';
      next.gamePhase = 'finished';
      return { state: next, winner: 'spy' };
    }
    next.winner = 'rebel';
    next.gamePhase = 'finished';
    return { state: next, winner: 'rebel' };
  }

  return { state: next, winner: null };
}
