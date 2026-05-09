// ============================================================
// AI Controller - main AI decision loop
// ============================================================

import type { GameState, PlayerState } from '../../types/game';
import type { GameAction } from '../../types/actions';
import { evaluateBestAction } from './AIEvaluator';
import { getCharacterInfo } from '../../data/characterDefinitions';

// AI selects a character
export function aiSelectCharacter(player: PlayerState): string {
  if (player.selectableCharacters && player.selectableCharacters.length > 0) {
    // Pick randomly from available (future: smarter selection based on identity)
    const idx = Math.floor(Math.random() * player.selectableCharacters.length);
    return player.selectableCharacters[idx];
  }

  // Fallback: pick any character
  const allChars = ['caocao', 'simayi', 'xiahoudun', 'zhangliao', 'xuchu', 'guojia', 'zhenji',
    'liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'machao', 'huangyueying',
    'sunquan', 'zhouyu', 'huanggai', 'lvmeng', 'luxun', 'daqiao', 'sunshangxiang',
    'huatuo', 'lvbu', 'diaochan', 'zhangjiao', 'yuanshao'];

  const info = getCharacterInfo(allChars[Math.floor(Math.random() * allChars.length)]);
  return info?.id || 'caocao';
}

// Main AI decision entry point - returns the next action
export function aiDecide(state: GameState, playerId: string): GameAction {
  const player = state.players.find(p => p.id === playerId);
  if (!player || player.aliveStatus !== 'alive') {
    return { type: 'END_TURN', playerId };
  }

  // Handle pending response
  if (state.pendingAction) {
    return handlePendingAction(state, playerId);
  }

  return evaluateBestAction(state, playerId);
}

function handlePendingAction(state: GameState, playerId: string): GameAction {
  const pending = state.pendingAction!;
  const player = state.players.find(p => p.id === playerId);
  if (!player) return { type: 'PASS_RESPONSE', playerId };

  if (pending.playerId !== playerId) {
    // Check if we should use 无懈可击 or 桃 on others
    if (pending.type === 'use_tao_dying') {
      const dyingPlayer = state.players.find(p => p.id === pending.playerId);
      if (dyingPlayer) {
        const allies = state.players.filter(p =>
          p.id !== playerId && p.identity === player.identity
        );
        const isAlly = allies.some(a => a.id === pending.playerId);
        if (isAlly || player.identity === 'ruler') {
          const tao = player.hand.find(c => c.subtype === 'tao');
          if (tao) {
            return { type: 'USE_TAO_OTHER', playerId, cardId: tao.instanceId, targetId: pending.playerId };
          }
        }
      }
    }
    return { type: 'PASS_RESPONSE', playerId };
  }

  switch (pending.type) {
    case 'respond_to_sha': {
      // Use 闪 if available, or try 八卦阵
      const shan = player.hand.find(c => c.subtype === 'shan');
      if (shan) return { type: 'RESPOND', playerId, cardIds: [shan.instanceId] };
      // AI uses 八卦阵 if available and no 闪
      if (player.equipment.armor?.subtype === 'baguazhen') {
        return { type: 'JUDGE_BAGUAZHEN', playerId };
      }
      return { type: 'PASS_RESPONSE', playerId };
    }
    case 'respond_to_nanman': {
      // Use 杀 if available and HP is low
      const sha = player.hand.find(c => c.subtype === 'sha');
      if (sha && player.hp <= 2) return { type: 'RESPOND', playerId, cardIds: [sha.instanceId] };
      if (sha && player.hp <= 3 && Math.random() < 0.6) return { type: 'RESPOND', playerId, cardIds: [sha.instanceId] };
      return { type: 'PASS_RESPONSE', playerId };
    }
    case 'respond_to_wanjian': {
      const shan = player.hand.find(c => c.subtype === 'shan');
      if (shan) return { type: 'RESPOND', playerId, cardIds: [shan.instanceId] };
      return { type: 'PASS_RESPONSE', playerId };
    }
    case 'respond_to_juedou': {
      const sha = player.hand.find(c => c.subtype === 'sha');
      if (sha) return { type: 'RESPOND', playerId, cardIds: [sha.instanceId] };
      return { type: 'PASS_RESPONSE', playerId };
    }
    case 'respond_to_wuxie_chain':
      return { type: 'PASS_WUXIE', playerId };
    case 'use_tao_dying':
      const tao = player.hand.find(c => c.subtype === 'tao');
      if (tao) return { type: 'USE_TAO_SELF', playerId, cardId: tao.instanceId };
      return { type: 'PASS_RESPONSE', playerId };
    case 'pick_card_to_discard':
    case 'pick_card_to_steal': {
      // AI picks a random card from available cards
      const available = (pending.extra?.availableCards as Array<{ cardId: string; cardName: string; zone: string }>) || [];
      const targetId = pending.extra?.targetId as string;
      if (available.length === 0) return { type: 'PASS_RESPONSE', playerId };
      // Prefer equipment over hand cards
      const equipCard = available.find(c => c.zone === 'equipment');
      const picked = equipCard || available[Math.floor(Math.random() * available.length)];
      return { type: 'SELECT_TARGET_CARD', playerId, cardId: picked.cardId, targetPlayerId: targetId };
    }
    case 'jiedao_sharen_choice': {
      // AI: 60% attack, 40% give weapon
      const extra = pending.extra || {};
      const validTargets = (extra.validTargetIds as string[]) || [];
      const hasSha = extra.hasSha as boolean;
      if (hasSha && validTargets.length > 0 && Math.random() < 0.6) {
        const target = validTargets[Math.floor(Math.random() * validTargets.length)];
        return { type: 'JIEDAO_ATTACK', playerId, targetId: target };
      }
      return { type: 'JIEDAO_GIVE_WEAPON', playerId };
    }
    case 'wugu_pick_card': {
      // AI picks a random card from 五谷丰登
      const wuguCards = (pending.extra?.wuguCards as Array<{ instanceId: string }>) || [];
      if (wuguCards.length === 0) return { type: 'PASS_RESPONSE', playerId };
      const picked = wuguCards[Math.floor(Math.random() * wuguCards.length)];
      return { type: 'PICK_WUGU_CARD', playerId, cardId: picked.instanceId };
    }
    default:
      return { type: 'PASS_RESPONSE', playerId };
  }
}

// Get all AI players
export function getAIPlayers(state: GameState): PlayerState[] {
  return state.players.filter(p => p.isAI && p.aliveStatus !== 'dead');
}

// Check if it's an AI player's turn to act
export function getCurrentAIPlayer(state: GameState): PlayerState | null {
  if (state.pendingAction) {
    const target = state.players.find(p => p.id === state.pendingAction!.playerId);
    if (target?.isAI) return target;
  }
  const currentId = state.turnOrder[state.currentPlayerIndex];
  const current = state.players.find(p => p.id === currentId);
  return current?.isAI ? current : null;
}
