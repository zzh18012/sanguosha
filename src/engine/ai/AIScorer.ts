// ============================================================
// AI Action Scoring - evaluates action utility
// ============================================================

import type { GameState } from '../../types/game';
import type { GameAction } from '../../types/actions';
import type { GameCard } from '../../types/cards';
import { findPlayer } from '../core/GameState';
import { getKnownEnemies, getKnownAllies } from '../systems/IdentitySystem';

// Score weights for different actions
const WEIGHTS = {
  damageEnemy: 60,
  damageAlly: -80,
  healSelf: 40,
  healAlly: 50,
  drawCards: 35,
  discardEnemy: 30,
  equipCard: 18,
  stealFromEnemy: 45,
  chainEnemy: 15,
  killEnemyBonus: 200,
  avoidDeath: 500,
  playToolCard: 25,
  destroyEnemyEquipment: 35,
  dyingHeal: 300,
};

export function scoreAction(state: GameState, action: GameAction, playerId: string): number {
  switch (action.type) {
    case 'PLAY_CARD':
      return scorePlayCard(state, action, playerId);
    case 'EQUIP_CARD':
      return scoreEquipCard(state, action, playerId);
    case 'USE_SKILL':
      return scoreUseSkill(state, action, playerId);
    case 'END_PHASE':
      return -5;
    case 'END_TURN':
      return -3;
    case 'PASS_RESPONSE':
      return 0;
    case 'RESPOND':
      return 5;
    case 'USE_TAO_SELF':
      return scoreTaoSelf(state, action, playerId);
    case 'USE_TAO_OTHER':
      return scoreTaoOther(state, action, playerId);
    case 'DISCARD_CARD':
      return scoreDiscardCard(state, action, playerId);
    default:
      return 0;
  }
}

function scorePlayCard(state: GameState, action: Extract<GameAction, { type: 'PLAY_CARD' }>, playerId: string): number {
  const player = findPlayer(state, playerId);
  if (!player) return 0;

  const card = player.hand.find(c => c.instanceId === action.cardId);
  if (!card) return 0;

  let score = 0;

  switch (card.subtype) {
    case 'sha': {
      for (const targetId of action.targets) {
        const target = findPlayer(state, targetId);
        if (!target) continue;
        if (getKnownEnemies(state, playerId).includes(targetId)) {
          score += WEIGHTS.damageEnemy;
          // Bonus for killing blow
          if (target.hp <= 1) score += WEIGHTS.killEnemyBonus / 2;
        } else if (getKnownAllies(state, playerId).includes(targetId)) {
          score += WEIGHTS.damageAlly;
        } else {
          score += WEIGHTS.damageEnemy * 0.5;
        }
      }
      break;
    }
    case 'jiu':
      score += 15; // 酒 is useful
      break;
    default:
      // Tool cards handled generically
      if (card.category === 'tool') {
        score += WEIGHTS.playToolCard;
        // Bonus for targeting enemies
        for (const targetId of action.targets) {
          if (getKnownEnemies(state, playerId).includes(targetId)) {
            score += 20;
          }
        }
      }
      break;
  }

  return score;
}

function scoreEquipCard(state: GameState, action: Extract<GameAction, { type: 'EQUIP_CARD' }>, playerId: string): number {
  const player = findPlayer(state, playerId);
  if (!player) return 0;

  const card = player.hand.find(c => c.instanceId === action.cardId);
  if (!card) return 0;

  switch (card.equipSlot) {
    case 'weapon':
      return WEIGHTS.equipCard + (card.weaponRange || 1) * 3;
    case 'armor':
      return WEIGHTS.equipCard + 8;
    case 'plusHorse':
      return WEIGHTS.equipCard + 5;
    case 'minusHorse':
      return WEIGHTS.equipCard + 7;
    default:
      return WEIGHTS.equipCard;
  }
}

function scoreUseSkill(state: GameState, action: Extract<GameAction, { type: 'USE_SKILL' }>, playerId: string): number {
  // Base value depends on the skill
  const skillValues: Record<string, number> = {
    'jianxiong': 25,
    'hujia': 30,
    'fankui': 25,
    'guicai': 20,
    'ganglie': 20,
    'tuxi': 35,
    'luoyi': 25,
    'tiandu': 15,
    'yiji': 25,
    'luoshen': 30,
    'qingguo': 20,
    'rende': 30,
    'jijiang': 25,
    'wusheng': 25,
    'paoxiao': 20,
    'guanxing': 25,
    'kongcheng': 20,
    'longdan': 20,
    'mashu': 10,
    'tieji': 25,
    'jizhi': 30,
    'qicai': 15,
    'zhiheng': 30,
    'jiuyuan': 20,
    'yingzi': 25,
    'fanjian': 30,
    'kurou': 25,
    'keji': 20,
    'qianxun': 15,
    'lianying': 25,
    'guose': 25,
    'liuli': 20,
    'jieyin': 30,
    'xiaoji': 25,
    'jijiu': 30,
    'qingnang': 30,
    'wushuang': 20,
    'lijian': 35,
    'biyue': 20,
    'leiji': 30,
  };

  return skillValues[action.skillId] || 15;
}

function scoreTaoSelf(state: GameState, action: Extract<GameAction, { type: 'USE_TAO_SELF' }>, playerId: string): number {
  const player = findPlayer(state, playerId);
  if (!player) return 0;

  if (player.aliveStatus === 'dying') return WEIGHTS.dyingHeal;
  return WEIGHTS.healSelf;
}

function scoreTaoOther(state: GameState, action: Extract<GameAction, { type: 'USE_TAO_OTHER' }>, playerId: string): number {
  if (getKnownAllies(state, playerId).includes(action.targetId)) {
    return WEIGHTS.dyingHeal;
  }
  // Still worth saving unknown players (might be allies)
  return WEIGHTS.dyingHeal * 0.7;
}

function scoreDiscardCard(state: GameState, action: Extract<GameAction, { type: 'DISCARD_CARD' }>, playerId: string): number {
  const player = findPlayer(state, playerId);
  if (!player) return 0;

  const card = player.hand.find(c => c.instanceId === action.cardId);
  if (!card) return 0;

  // Prefer discarding less useful cards
  const usefulness: Record<string, number> = {
    'sha': 5,
    'shan': 4,
    'tao': 10,
    'jiu': 6,
    'wuxie_keji': 7,
  };

  const cardUsefulness = usefulness[card.subtype] || 4;

  // Equipment is less useful to discard
  if (card.category === 'equipment') return -2;

  // We want to discard the LEAST useful card, but we express this as higher score = discard this
  return 10 - cardUsefulness;
}

// Evaluate how good a card is to keep
export function getCardKeepValue(card: GameCard): number {
  const baseValues: Record<string, number> = {
    'sha': 6,
    'shan': 7,
    'tao': 10,
    'jiu': 5,
    'wuxie_keji': 8,
    'guohe_chaiqiao': 7,
    'shunshou_qianyang': 8,
    'wuzhong_shengyou': 9,
    'juedou': 6,
    'nanman_ruqin': 7,
    'wanjian_qifa': 7,
    'taoyuan_jieyi': 6,
    'wugu_fengdeng': 5,
    'jiedao_sharen': 6,
    'zhugeliannu': 9,
    'qinggangjian': 8,
    'zhangbashemao': 7,
    'guandao': 7,
    'fangtianhuaji': 8,
    'qilinbow': 6,
    'baguazhen': 8,
    'renwangdun': 7,
    'tengjia': 7,
    'dilu': 6,
    'chitu': 6,
    'zhuahuangfeidian': 6,
    'jueying': 6,
  };

  return baseValues[card.subtype] || 5;
}
