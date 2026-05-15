// ============================================================
// RulesEngine - validates all game actions against the rules
// ============================================================

import type { GameState } from '../../types/game';
import type { GameAction } from '../../types/actions';
import type { SkillDefinition } from '../../types/characters';
import { findPlayer } from './GameState';
import { isInRange, getAttackDistance } from '../systems/DistanceSystem';
import { getCharacterRegistry, getSkill, playerHasSkill } from '../characters/SkillEngine';

// Main validation entry point - returns true if the action is legal
export function validateAction(state: GameState, action: GameAction): boolean {
  switch (action.type) {
    case 'PLAY_CARD':
      return validatePlayCard(state, action);
    case 'EQUIP_CARD':
      return validateEquipCard(state, action);
    case 'DISCARD_CARD':
      return validateDiscardCard(state, action);
    case 'USE_SKILL':
      return validateUseSkill(state, action);
    case 'END_PHASE':
      return validateEndPhase(state, action);
    case 'END_TURN':
      return validateEndTurn(state, action);
    case 'RESPOND':
      return validateRespond(state, action);
    case 'PASS_RESPONSE':
      return validatePassResponse(state, action);
    case 'PLAY_WUXIE':
      return validatePlayWuxie(state, action);
    case 'RECAST_CARD':
      return validateRecastCard(state, action);
    case 'PASS_SAVE_DYING':
      return validatePassSaveDying(state, action);
    case 'PASS_WUXIE':
      return true; // always valid
    case 'JUDGE_BAGUAZHEN':
      return validateJudgeBaguazhen(state, action);
    case 'SELECT_TARGET_CARD':
      return validateSelectTargetCard(state, action);
    case 'PICK_WUGU_CARD':
      return validatePickWuguCard(state, action);
    case 'JIEDAO_ATTACK':
      return validateJiedaoAttack(state, action);
    case 'JIEDAO_GIVE_WEAPON':
      return validateJiedaoGiveWeapon(state, action);
    case 'USE_TAO_SELF':
      return validateUseTaoSelf(state, action);
    case 'USE_TAO_OTHER':
      return validateUseTaoOther(state, action);
    case 'DISCARD_TO_MAX_HP':
      return validateDiscardToMaxHp(state, action);
    case 'DRAW_CARDS':
    case 'DRAW_CARDS_SPECIFIC':
    case 'DEAL_DAMAGE':
    case 'HEAL_HP':
    case 'ENTER_DYING':
    case 'PLAYER_DIED':
    case 'DISCARD_ALL_CARDS':
    case 'ENTER_JUDGMENT_PHASE':
    case 'RESOLVE_JUDGMENT':
    case 'PLACE_DELAYED_TOOL':
    case 'REMOVE_DELAYED_TOOL':
    case 'DESTROY_EQUIPMENT':
    case 'STEAL_CARD':
    case 'CHAIN_PLAYERS':
    case 'TURN_OVER':
    case 'PHASE_CHANGE':
    case 'TURN_START':
    case 'CHECK_VICTORY':
    case 'SELECT_CHARACTER':
    case 'START_GAME':
    case 'REQUEST_CHARACTER_SELECTION':
    case 'AI_THINK':
      return true; // system actions always valid
    default:
      return false;
  }
}

function validatePlayCard(state: GameState, action: Extract<GameAction, { type: 'PLAY_CARD' }>): boolean {
  const player = findPlayer(state, action.playerId);
  if (!player || player.aliveStatus !== 'alive') return false;

  // Must be the player's turn during play phase
  const currentId = state.turnOrder[state.currentPlayerIndex];
  if (currentId !== action.playerId) return false;
  if (state.currentTurnPhase !== 'play') return false;

  // Check if player has this card in hand
  const cardInHand = player.hand.find(c => c.instanceId === action.cardId);
  if (!cardInHand) return false;

  // Basic card restrictions
  if (cardInHand.subtype === 'sha') {
    if (player.shaUsedThisTurn) {
      const hasZhugeLiannu = player.equipment.weapon?.subtype === 'zhugeliannu';
      const hasPaoxiao = playerHasSkill(state, action.playerId, 'paoxiao');
      if (!hasZhugeLiannu && !hasPaoxiao) return false;
    }
    if (action.targets.length !== 1) return false;
    // Check 空城: Zhuge Liang immune to sha when no hand cards
    if (playerHasSkill(state, action.targets[0], 'kongcheng')) {
      const targetPlayer = findPlayer(state, action.targets[0]);
      if (targetPlayer && targetPlayer.hand.length === 0) return false;
    }
    // Must be in weapon range
    if (!isInRange(state, action.playerId, action.targets[0])) return false;
  }

  if (cardInHand.subtype === 'tao') {
    if (action.targets.length > 1) return false;
  }

  if (cardInHand.subtype === 'jiu') {
    if (player.jiuUsedThisTurn) return false;
  }

  // Tool card target validation
  if (cardInHand.category === 'tool') {
    if (cardInHand.toolTiming === 'delayed') {
      // Delayed tools: placed in judgment area, not played directly
      // 谦逊 immune to 乐不思蜀
      if (cardInHand.subtype === 'lebu_sishu' && playerHasSkill(state, action.targets[0], 'qianxun')) return false;
      return action.targets.length === 1;
    }
    // Non-delayed tool cards
    switch (cardInHand.subtype) {
      case 'wuzhong_shengyou':
        // 无中生有 and 五谷丰登: no target needed (self/AOE)
        return action.targets.length === 0;
      case 'wugu_fengdeng':
        return action.targets.length === 0;
      case 'guohe_chaiqiao': {
        // 过河拆桥: target any non-self alive player with cards
        if (action.targets.length !== 1) return false;
        const t = findPlayer(state, action.targets[0]);
        return !!(t && t.id !== action.playerId && t.aliveStatus !== 'dead' &&
          (t.hand.length > 0 || Object.values(t.equipment).some(Boolean)));
      }
      case 'shunshou_qianyang': {
        // 顺手牵羊: target at distance ≤ 1 with cards
        if (action.targets.length !== 1) return false;
        // 谦逊 immune
        if (playerHasSkill(state, action.targets[0], 'qianxun')) return false;
        // 奇才: no distance limit on tool cards
        if (!playerHasSkill(state, action.playerId, 'qicai')) {
          if (getAttackDistance(state, action.playerId, action.targets[0]) > 1) return false;
        }
        const t = findPlayer(state, action.targets[0]);
        return !!(t && t.id !== action.playerId && t.aliveStatus !== 'dead' &&
          (t.hand.length > 0 || Object.values(t.equipment).some(Boolean)));
      }
      case 'juedou':
        // 决斗: target any non-self alive player
        if (action.targets.length !== 1) return false;
        // 空城 immune
        if (playerHasSkill(state, action.targets[0], 'kongcheng')) {
          const kongTarget = findPlayer(state, action.targets[0]);
          if (kongTarget && kongTarget.hand.length === 0) return false;
        }
        return action.targets[0] !== action.playerId;
      case 'nanman_ruqin':
      case 'wanjian_qifa':
      case 'taoyuan_jieyi':
        // AOE cards: no specific targets
        return action.targets.length === 0;
      case 'jiedao_sharen': {
        // 借刀杀人: target must have weapon AND have a valid attack target
        if (action.targets.length !== 1) return false;
        const t = findPlayer(state, action.targets[0]);
        if (!t || !t.equipment.weapon) return false;
        // Target must have someone in range to attack
        const others = state.players.filter(p =>
          p.aliveStatus !== 'dead' && p.id !== t.id);
        return others.some(p => isInRange(state, t.id, p.id));
      }
      case 'tiesuo_lianhuan': {
        // 铁索连环: target 1-2 players
        if (action.targets.length < 1 || action.targets.length > 2) return false;
        return action.targets.every(tid => {
          const t = findPlayer(state, tid);
          return !!(t && t.aliveStatus !== 'dead');
        });
      }
      case 'wuxie_keji':
        // 无懈可击: can only be played in response, not proactively
        return false;
      default:
        return action.targets.length <= 1;
    }
  }

  return true;
}

function validateEquipCard(state: GameState, action: Extract<GameAction, { type: 'EQUIP_CARD' }>): boolean {
  const player = findPlayer(state, action.playerId);
  if (!player || player.aliveStatus !== 'alive') return false;

  // Must be the player's turn during play phase
  const currentId = state.turnOrder[state.currentPlayerIndex];
  if (currentId !== action.playerId) return false;
  if (state.currentTurnPhase !== 'play') return false;

  const card = player.hand.find(c => c.instanceId === action.cardId);
  if (!card || card.category !== 'equipment') return false;

  return true;
}

function validateDiscardCard(state: GameState, action: Extract<GameAction, { type: 'DISCARD_CARD' }>): boolean {
  const player = findPlayer(state, action.playerId);
  if (!player) return false;

  // Must be the player's turn during discard phase
  const currentId = state.turnOrder[state.currentPlayerIndex];
  if (currentId !== action.playerId) return false;
  if (state.currentTurnPhase !== 'discard') return false;

  // Check if card is in player's hand
  const cardInHand = player.hand.find(c => c.instanceId === action.cardId);
  if (!cardInHand) return false;

  return true;
}

function validateUseSkill(state: GameState, action: Extract<GameAction, { type: 'USE_SKILL' }>): boolean {
  const player = findPlayer(state, action.playerId);
  if (!player || player.aliveStatus !== 'alive') return false;

  // 必须在出牌阶段且是当前玩家
  const currentId = state.turnOrder[state.currentPlayerIndex];
  if (currentId !== action.playerId) return false;
  if (state.currentTurnPhase !== 'play') return false;

  // 查找技能定义
  const skill = getSkill(action.skillId);
  if (!skill) return false;

  // 主公技只允许主公使用
  if (skill.isRulerSkill && player.identity !== 'ruler') return false;

  // 技能必须属于该玩家角色
  const charReg = getCharacterRegistry();
  const charEntry = charReg.get(player.characterId);
  if (!charEntry || !charEntry.skills.some(s => s.id === action.skillId)) return false;

  // 乱击: must have at least 2 cards of the same suit
  if (action.skillId === 'luanji') {
    const suits = ['spade', 'heart', 'club', 'diamond'] as const;
    const hasSameSuit = suits.some(s => player.hand.filter(c => c.suit === s).length >= 2);
    if (!hasSameSuit) return false;
  }

  return true;
}

function validateEndPhase(state: GameState, action: Extract<GameAction, { type: 'END_PHASE' }>): boolean {
  const currentId = state.turnOrder[state.currentPlayerIndex];
  return currentId === action.playerId && state.currentTurnPhase === 'play';
}

function validateEndTurn(state: GameState, action: Extract<GameAction, { type: 'END_TURN' }>): boolean {
  const currentId = state.turnOrder[state.currentPlayerIndex];
  return currentId === action.playerId;
}

function validateRespond(state: GameState, action: Extract<GameAction, { type: 'RESPOND' }>): boolean {
  if (!state.pendingAction) return false;
  if (state.pendingAction.playerId !== action.playerId) return false;

  // Check that all response cards are valid
  const player = findPlayer(state, action.playerId);
  if (!player) return false;

  for (const cardId of action.cardIds) {
    const card = player.hand.find(c => c.instanceId === cardId);
    if (!card) return false;
    if (state.pendingAction.validResponseCards &&
        !state.pendingAction.validResponseCards.includes(cardId)) {
      return false;
    }
  }

  return true;
}

function validatePassResponse(state: GameState, action: Extract<GameAction, { type: 'PASS_RESPONSE' }>): boolean {
  if (!state.pendingAction) return false;
  return state.pendingAction.playerId === action.playerId;
}

function validatePlayWuxie(state: GameState, action: Extract<GameAction, { type: 'PLAY_WUXIE' }>): boolean {
  const player = findPlayer(state, action.playerId);
  if (!player) return false;
  const card = player.hand.find(c => c.instanceId === action.cardId);
  if (!card || card.subtype !== 'wuxie_keji') return false;
  // 无懈可击 can be played at any time (during a pending chain)
  return true;
}

function validateUseTaoSelf(state: GameState, action: Extract<GameAction, { type: 'USE_TAO_SELF' }>): boolean {
  const player = findPlayer(state, action.playerId);
  if (!player) return false;
  if (player.hp >= player.maxHp && player.aliveStatus !== 'dying') return false;
  const card = player.hand.find(c => c.instanceId === action.cardId);
  // 桃 always valid for healing; 酒 also valid when dying (自救)
  return !!(card && (card.subtype === 'tao' || (card.subtype === 'jiu' && player.aliveStatus === 'dying')));
}

function validateUseTaoOther(state: GameState, action: Extract<GameAction, { type: 'USE_TAO_OTHER' }>): boolean {
  const target = findPlayer(state, action.targetId);
  if (!target || target.aliveStatus !== 'dying') return false;
  const player = findPlayer(state, action.playerId);
  if (!player) return false;
  const card = player.hand.find(c => c.instanceId === action.cardId);
  return !!(card && card.subtype === 'tao');
}

function validateDiscardToMaxHp(state: GameState, action: Extract<GameAction, { type: 'DISCARD_TO_MAX_HP' }>): boolean {
  const player = findPlayer(state, action.playerId);
  if (!player) return false;
  return player.hand.length > player.hp;
}

function validateJudgeBaguazhen(state: GameState, action: Extract<GameAction, { type: 'JUDGE_BAGUAZHEN' }>): boolean {
  if (!state.pendingAction) return false;
  if (state.pendingAction.type !== 'respond_to_sha') return false;
  if (state.pendingAction.playerId !== action.playerId) return false;
  const player = findPlayer(state, action.playerId);
  if (!player) return false;
  return player.equipment.armor?.subtype === 'baguazhen';
}

function validateSelectTargetCard(state: GameState, action: Extract<GameAction, { type: 'SELECT_TARGET_CARD' }>): boolean {
  if (!state.pendingAction) return false;
  const pending = state.pendingAction;
  if (pending.type !== 'pick_card_to_discard' && pending.type !== 'pick_card_to_steal') return false;
  if (pending.playerId !== action.playerId) return false;
  // Verify the selected card belongs to the target
  const target = findPlayer(state, action.targetPlayerId);
  if (!target) return false;
  const cardInHand = target.hand.some(c => c.instanceId === action.cardId);
  const cardInEquip = Object.values(target.equipment).some(e => e?.instanceId === action.cardId);
  return cardInHand || cardInEquip;
}

function validatePickWuguCard(state: GameState, action: Extract<GameAction, { type: 'PICK_WUGU_CARD' }>): boolean {
  if (!state.pendingAction) return false;
  if (state.pendingAction.type !== 'wugu_pick_card') return false;
  if (state.pendingAction.playerId !== action.playerId) return false;
  const wuguCards = (state.pendingAction.extra?.wuguCards as Array<{ instanceId: string }>) || [];
  return wuguCards.some(c => c.instanceId === action.cardId);
}

function validateJiedaoAttack(state: GameState, action: Extract<GameAction, { type: 'JIEDAO_ATTACK' }>): boolean {
  if (!state.pendingAction) return false;
  if (state.pendingAction.type !== 'jiedao_sharen_choice') return false;
  if (state.pendingAction.playerId !== action.playerId) return false;
  const validTargetIds = (state.pendingAction.extra?.validTargetIds as string[]) || [];
  return validTargetIds.includes(action.targetId);
}

function validateJiedaoGiveWeapon(state: GameState, action: Extract<GameAction, { type: 'JIEDAO_GIVE_WEAPON' }>): boolean {
  if (!state.pendingAction) return false;
  if (state.pendingAction.type !== 'jiedao_sharen_choice') return false;
  if (state.pendingAction.playerId !== action.playerId) return false;
  return true;
}

function validateRecastCard(state: GameState, action: Extract<GameAction, { type: 'RECAST_CARD' }>): boolean {
  const player = findPlayer(state, action.playerId);
  if (!player || player.aliveStatus !== 'alive') return false;
  const currentId = state.turnOrder[state.currentPlayerIndex];
  if (currentId !== action.playerId) return false;
  if (state.currentTurnPhase !== 'play') return false;
  const card = player.hand.find(c => c.instanceId === action.cardId);
  return !!(card && card.subtype === 'tiesuo_lianhuan');
}

function validatePassSaveDying(state: GameState, action: Extract<GameAction, { type: 'PASS_SAVE_DYING' }>): boolean {
  if (!state.pendingAction) return false;
  if (state.pendingAction.type !== 'use_tao_dying') return false;
  // Only the dying player can pass on saving themselves
  if (state.pendingAction.playerId !== action.playerId) return false;
  return true;
}

// Get all valid actions for a player in the current state
export function getValidActions(state: GameState, playerId: string): GameAction[] {
  const player = findPlayer(state, playerId);
  if (!player || player.aliveStatus !== 'alive') return [];

  const actions: GameAction[] = [];
  const isCurrentPlayer = state.turnOrder[state.currentPlayerIndex] === playerId;

  // If there's a pending action, only response actions are valid
  if (state.pendingAction) {
    if (state.pendingAction.playerId === playerId) {
      if (state.pendingAction.type === 'respond_to_sha' ||
          state.pendingAction.type === 'respond_to_nanman' ||
          state.pendingAction.type === 'respond_to_wanjian' ||
          state.pendingAction.type === 'respond_to_juedou') {
        // Can respond with each valid card individually, or pass
        actions.push({ type: 'PASS_RESPONSE', playerId });
        if (state.pendingAction.validResponseCards) {
          for (const cardId of state.pendingAction.validResponseCards) {
            actions.push({ type: 'RESPOND', playerId, cardIds: [cardId] });
          }
        }
        // 八卦阵: can judge instead of playing 闪
        if (state.pendingAction.extra?.hasBaguazhen && state.pendingAction.type === 'respond_to_sha') {
          actions.push({ type: 'JUDGE_BAGUAZHEN', playerId });
        }
      }
      if (state.pendingAction.type === 'pick_card_to_discard' || state.pendingAction.type === 'pick_card_to_steal') {
        const availableCards = (state.pendingAction.extra?.availableCards as Array<{ cardId: string; cardName: string; zone: string }>) || [];
        const targetId = state.pendingAction.extra?.targetId as string;
        for (const ac of availableCards) {
          actions.push({ type: 'SELECT_TARGET_CARD', playerId, cardId: ac.cardId, targetPlayerId: targetId });
        }
      }
      if (state.pendingAction.type === 'jiedao_sharen_choice') {
        const extra = state.pendingAction.extra || {};
        if (extra.hasSha) {
          const validTargetIds = (extra.validTargetIds as string[]) || [];
          for (const tid of validTargetIds) {
            actions.push({ type: 'JIEDAO_ATTACK', playerId, targetId: tid });
          }
        }
        actions.push({ type: 'JIEDAO_GIVE_WEAPON', playerId });
      }
      if (state.pendingAction.type === 'wugu_pick_card') {
        const wuguCards = (state.pendingAction.extra?.wuguCards as Array<{ instanceId: string }>) || [];
        for (const card of wuguCards) {
          actions.push({ type: 'PICK_WUGU_CARD', playerId, cardId: card.instanceId });
        }
      }
      if (state.pendingAction.type === 'respond_to_wuxie_chain' || state.pendingAction.type === 'wuxie_opportunity') {
        actions.push({ type: 'PASS_WUXIE', playerId });
        // Check if player has 无懈可击
        const wuxie = player.hand.filter(c => c.subtype === 'wuxie_keji');
        for (const card of wuxie) {
          actions.push({ type: 'PLAY_WUXIE', playerId, cardId: card.instanceId, againstActionType: 'any' });
        }
      }
      if (state.pendingAction.type === 'use_tao_dying') {
        // Dying player can use 桃/酒 on self, or pass (不救)
        const tao = player.hand.filter(c => c.subtype === 'tao');
        for (const card of tao) {
          actions.push({ type: 'USE_TAO_SELF', playerId, cardId: card.instanceId });
        }
        // 急救 (Hua Tuo): red cards can be used as 桃 outside own turn
        // Dying player can always use 急救 on themselves
        if (playerHasSkill(state, playerId, 'jijiu')) {
          const redCards = player.hand.filter(c => (c.suit === 'heart' || c.suit === 'diamond') && c.subtype !== 'tao');
          for (const card of redCards) {
            actions.push({ type: 'USE_TAO_SELF', playerId, cardId: card.instanceId });
          }
        }
        const jiu = player.hand.filter(c => c.subtype === 'jiu');
        for (const card of jiu) {
          actions.push({ type: 'USE_TAO_SELF', playerId, cardId: card.instanceId });
        }
        actions.push({ type: 'PASS_SAVE_DYING', playerId });
      }
    } else {
      // Other players might be able to play 无懈可击 or 桃
      if (state.pendingAction.type === 'use_tao_dying') {
        const tao = player.hand.filter(c => c.subtype === 'tao');
        for (const card of tao) {
          actions.push({ type: 'USE_TAO_OTHER', playerId, cardId: card.instanceId, targetId: state.pendingAction.playerId });
        }
        // 急救 (Hua Tuo): red cards as 桃 outside own turn
        const currentTurnPlayerId = state.turnOrder[state.currentPlayerIndex];
        if (playerHasSkill(state, playerId, 'jijiu') && playerId !== currentTurnPlayerId) {
          const redCards = player.hand.filter(c => (c.suit === 'heart' || c.suit === 'diamond') && c.subtype !== 'tao');
          for (const card of redCards) {
            actions.push({ type: 'USE_TAO_OTHER', playerId, cardId: card.instanceId, targetId: state.pendingAction.playerId });
          }
        }
      }
    }
    return actions;
  }

  // During own turn
  if (isCurrentPlayer) {
    switch (state.currentTurnPhase) {
      case 'play': {
        // Can play cards from hand
        for (const card of player.hand) {
          if (card.category === 'basic') {
            if (card.subtype === 'sha' && !player.shaUsedThisTurn) {
              // Add play card action (targets chosen in UI)
              actions.push({ type: 'PLAY_CARD', playerId, cardId: card.instanceId, targets: [] });
            } else if (card.subtype === 'tao') {
              if (player.hp < player.maxHp) {
                actions.push({ type: 'USE_TAO_SELF', playerId, cardId: card.instanceId });
              }
            } else if (card.subtype === 'jiu' && !player.jiuUsedThisTurn) {
              actions.push({ type: 'PLAY_CARD', playerId, cardId: card.instanceId, targets: [] });
            }
            // 闪 is reactive, not playable proactively
          } else if (card.category === 'equipment') {
            actions.push({ type: 'EQUIP_CARD', playerId, cardId: card.instanceId });
          } else if (card.category === 'tool') {
            actions.push({ type: 'PLAY_CARD', playerId, cardId: card.instanceId, targets: [] });
            // 铁索连环 can also be recast (重铸): discard to draw 1
            if (card.subtype === 'tiesuo_lianhuan') {
              actions.push({ type: 'RECAST_CARD', playerId, cardId: card.instanceId });
            }
          }
        }
        // Active skills usable during play phase
        const charReg = getCharacterRegistry();
        const charEntry = charReg.get(player.characterId);
        if (charEntry) {
          for (const skill of charEntry.skills) {
            const hasActiveTrigger = skill.triggers.some(t =>
              t.kind === 'active' || t.kind === 'on_play_phase_start'
            );
            if (hasActiveTrigger) {
              // 主公技只允许主公使用
              if (skill.isRulerSkill && player.identity !== 'ruler') continue;
              actions.push({ type: 'USE_SKILL', playerId, skillId: skill.id, targets: [] });
            }
          }
        }
        actions.push({ type: 'END_PHASE', playerId });
        break;
      }
      case 'discard': {
        // Discard cards down to HP
        if (player.hand.length > player.hp) {
          for (const card of player.hand) {
            actions.push({ type: 'DISCARD_CARD', playerId, cardId: card.instanceId });
          }
        } else {
          actions.push({ type: 'END_TURN', playerId });
        }
        break;
      }
    }
  }

  return actions;
}
