// ============================================================
// Judgment system - delayed tool card resolution
// ============================================================

import type { GameState } from '../../types/game';
import type { GameAction } from '../../types/actions';
import type { GameCard } from '../../types/cards';
import { findPlayer, cloneState } from '../core/GameState';

// Resolve all delayed tool cards during judge phase
export function resolveJudgePhase(
  state: GameState,
  playerId: string,
): { state: GameState; actions: GameAction[] } {
  const next = cloneState(state);
  const actions: GameAction[] = [];
  const player = findPlayer(next, playerId);

  if (!player || player.judgmentArea.length === 0) {
    return { state: next, actions };
  }

  // Process judgment cards in order (FIFO)
  const remaining: GameCard[] = [];

  for (const card of player.judgmentArea) {
    if (card.subtype === 'lebu_sishu') {
      const result = resolveLebuSishu(next, playerId, card);
      if (result.pass) {
        // Failed judgment - skip play phase (handled by game flow)
        actions.push({ type: 'PHASE_CHANGE', phase: 'discard' });
        next.discardPile.push(card);
      } else {
        // Passed - remove the card
        next.discardPile.push(card);
      }
    } else if (card.subtype === 'bingliang_cunduan') {
      const result = resolveBingliangCunduan(next, playerId, card);
      if (result.pass) {
        // Failed - skip draw phase
        actions.push({ type: 'HEAL_HP', playerId, amount: 0 }); // placeholder
        next.discardPile.push(card);
      } else {
        next.discardPile.push(card);
      }
    } else if (card.subtype === 'shandian') {
      const result = resolveShandian(next, playerId, card);
      if (result.hit) {
        // Take 3 thunder damage!
        actions.push({
          type: 'DEAL_DAMAGE',
          sourceId: playerId,
          targetId: playerId,
          amount: 3,
          element: 'thunder',
        });
        next.discardPile.push(card);
      } else {
        // Pass to next player
        remaining.push(card);
      }
    } else {
      remaining.push(card);
    }
  }

  player.judgmentArea = remaining;

  return { state: next, actions };
}

// 乐不思蜀: judge, fail if NOT heart
export function resolveLebuSishu(
  state: GameState,
  _playerId: string,
  _card: GameCard,
): { pass: boolean; judgeCard: GameCard | null } {
  const next = cloneState(state);

  // Draw top card for judgment
  if (next.deck.length === 0) {
    // Reshuffle discard
    return { pass: false, judgeCard: null };
  }

  const judgeCard = next.deck.pop()!;
  next.discardPile.push(judgeCard);

  // Failed if NOT heart (effect triggers when NOT heart)
  const pass = judgeCard.suit !== 'heart';

  return { pass, judgeCard };
}

// 兵粮寸断: judge, fail if NOT club
export function resolveBingliangCunduan(
  state: GameState,
  _playerId: string,
  _card: GameCard,
): { pass: boolean; judgeCard: GameCard | null } {
  if (state.deck.length === 0) {
    return { pass: false, judgeCard: null };
  }

  const judgeCard = state.deck[state.deck.length - 1];

  // Failed if NOT club
  const pass = judgeCard.suit !== 'club';

  return { pass, judgeCard };
}

// 闪电: judge, hit if spade 2-9
export function resolveShandian(
  state: GameState,
  _playerId: string,
  _card: GameCard,
): { hit: boolean; judgeCard: GameCard | null } {
  if (state.deck.length === 0) {
    return { hit: false, judgeCard: null };
  }

  const judgeCard = state.deck[state.deck.length - 1];

  // Hit only if spade AND rank 2-9
  const hit = judgeCard.suit === 'spade' && judgeCard.rankNumber >= 2 && judgeCard.rankNumber <= 9;

  return { hit, judgeCard };
}

// Place a delayed tool card on a player's judgment area
export function placeDelayedTool(
  state: GameState,
  targetId: string,
  card: GameCard,
): GameState {
  const next = cloneState(state);
  const target = findPlayer(next, targetId);

  if (target) {
    // Can't have duplicate delayed tools on same player
    const existingSame = target.judgmentArea.find(c => c.subtype === card.subtype);
    if (!existingSame) {
      target.judgmentArea.push(card);
    }
  }

  return next;
}

// Remove a delayed tool from a player's judgment area (e.g., via 过河拆桥)
export function removeDelayedTool(
  state: GameState,
  targetId: string,
  cardId: string,
): GameState {
  const next = cloneState(state);
  const target = findPlayer(next, targetId);

  if (target) {
    const idx = target.judgmentArea.findIndex(c => c.instanceId === cardId);
    if (idx !== -1) {
      const [removed] = target.judgmentArea.splice(idx, 1);
      next.discardPile.push(removed);
    }
  }

  return next;
}
