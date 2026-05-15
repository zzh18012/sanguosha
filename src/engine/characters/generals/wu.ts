// ============================================================
// Wu Kingdom (吴) characters
// ============================================================

import type { CharacterDefinition, SkillDefinition } from '../../../types/characters';
import type { GameAction } from '../../../types/actions';
import { registerCharacterSkills } from '../SkillEngine';

// 孙权 (Sun Quan)
const skill_zhiheng: SkillDefinition = {
  id: 'zhiheng',
  name: '制衡',
  description: '出牌阶段限一次，你可以弃置任意张牌，然后摸等量的牌。',
  triggers: [{ kind: 'active', usableInPhase: 'play' }],
  execute: (ctx) => {
    const actions: GameAction[] = [];
    // Draw 1 card (simplified: always 1-for-1 without forcing a discard first)
    actions.push({ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 });
    return { actions };
  },
  isMandatory: false,
};

const skill_jiuyuan: SkillDefinition = {
  id: 'jiuyuan',
  name: '救援',
  description: '主公技，其他吴势力角色使用桃指定你为目标时，回复+1。',
  triggers: [{ kind: 'on_healed' }],
  execute: (ctx) => {
    // Handled in ActionResolver.resolveUseTaoOther
    return { actions: [] };
  },
  isMandatory: false,
  isRulerSkill: true,
};

export const sunquan: CharacterDefinition = {
  id: 'sunquan',
  name: '孙权',
  title: '年轻贤君',
  kingdom: 'wu',
  maxHp: 4,
  gender: 'male',
  skills: [skill_zhiheng, skill_jiuyuan],
  isRulerOption: true,
};

// 周瑜 (Zhou Yu)
const skill_yingzi: SkillDefinition = {
  id: 'yingzi',
  name: '英姿',
  description: '摸牌阶段，你可以多摸一张牌。',
  triggers: [{ kind: 'on_draw_phase' }],
  execute: (ctx) => {
    const actions: ReturnType<SkillDefinition['execute']> = { actions: [] };
    actions.actions.push({ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 });
    return actions;
  },
  isMandatory: false,
};

const skill_fanjian: SkillDefinition = {
  id: 'fanjian',
  name: '反间',
  description: '出牌阶段限一次，你可以令一名其他角色选择一种花色，然后获得你的一张手牌并展示，若此牌的花色与其选择的不同，则其受到1点伤害。',
  triggers: [{ kind: 'active', usableInPhase: 'play' }],
  execute: (ctx) => {
    const actions: GameAction[] = [];
    // Simplified: deal 1 damage to a random other alive player
    const enemies = ctx.gameState.players.filter(p => p.id !== ctx.sourcePlayerId && p.aliveStatus !== 'dead');
    if (enemies.length > 0) {
      actions.push({ type: 'DEAL_DAMAGE', sourceId: ctx.sourcePlayerId, targetId: enemies[0].id, amount: 1 });
      actions.push({ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 });
    }
    return { actions };
  },
  isMandatory: false,
};

export const zhouyu: CharacterDefinition = {
  id: 'zhouyu',
  name: '周瑜',
  title: '大都督',
  kingdom: 'wu',
  maxHp: 3,
  gender: 'male',
  skills: [skill_yingzi, skill_fanjian],
};

// 黄盖 (Huang Gai)
const skill_kurou: SkillDefinition = {
  id: 'kurou',
  name: '苦肉',
  description: '出牌阶段，你可以失去1点体力，然后摸三张牌。',
  triggers: [{ kind: 'active', usableInPhase: 'play' }],
  execute: (ctx) => {
    const actions: ReturnType<SkillDefinition['execute']> = { actions: [] };
    // Lose 1 HP, draw 3
    actions.actions.push({ type: 'DEAL_DAMAGE', sourceId: ctx.sourcePlayerId, targetId: ctx.sourcePlayerId, amount: 1 });
    actions.actions.push({ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 3 });
    return actions;
  },
  isMandatory: false,
};

export const huanggai: CharacterDefinition = {
  id: 'huanggai',
  name: '黄盖',
  title: '轻身为国',
  kingdom: 'wu',
  maxHp: 4,
  gender: 'male',
  skills: [skill_kurou],
};

// 吕蒙 (Lyu Meng)
const skill_keji: SkillDefinition = {
  id: 'keji',
  name: '克己',
  description: '若你于出牌阶段未使用或打出过任何一张杀，你可以跳过此回合的弃牌阶段。',
  triggers: [{ kind: 'on_discard_phase' }],
  execute: (ctx) => {
    const state = ctx.gameState;
    const player = state.players.find(p => p.id === ctx.sourcePlayerId);
    if (player && !player.shaUsedThisTurn) {
      // Skip discard phase
      return { actions: [{ type: 'END_TURN', playerId: ctx.sourcePlayerId }] };
    }
    return { actions: [] };
  },
  isMandatory: false,
};

export const lvmeng: CharacterDefinition = {
  id: 'lvmeng',
  name: '吕蒙',
  title: '白衣渡江',
  kingdom: 'wu',
  maxHp: 4,
  gender: 'male',
  skills: [skill_keji],
};

// 陆逊 (Lu Xun)
const skill_qianxun: SkillDefinition = {
  id: 'qianxun',
  name: '谦逊',
  description: '锁定技，你不能成为顺手牵羊和乐不思蜀的目标。',
  triggers: [{ kind: 'passive' }],
  execute: (ctx) => {
    // Engine handles targeting immunity in RulesEngine
    return { actions: [] };
  },
  isMandatory: true,
};

const skill_lianying: SkillDefinition = {
  id: 'lianying',
  name: '连营',
  description: '当你失去最后一张手牌时，你可以摸一张牌。',
  triggers: [{ kind: 'on_card_played' }],
  execute: (ctx) => {
    const state = ctx.gameState;
    const player = state.players.find(p => p.id === ctx.sourcePlayerId);
    if (player && player.hand.length === 0) {
      const actions: ReturnType<SkillDefinition['execute']> = { actions: [] };
      actions.actions.push({ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 });
      return actions;
    }
    return { actions: [] };
  },
  isMandatory: false,
};

export const luxun: CharacterDefinition = {
  id: 'luxun',
  name: '陆逊',
  title: '儒生雄才',
  kingdom: 'wu',
  maxHp: 3,
  gender: 'male',
  skills: [skill_qianxun, skill_lianying],
};

// 大乔 (Da Qiao)
const skill_guose: SkillDefinition = {
  id: 'guose',
  name: '国色',
  description: '你可以将一张方片牌当乐不思蜀使用。',
  triggers: [{ kind: 'active', usableInPhase: 'play' }],
  execute: (ctx) => {
    // Draw 1 card (simplified: Diamond cards act as extra resources)
    return { actions: [{ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 }] };
  },
  isMandatory: false,
};

const skill_liuli: SkillDefinition = {
  id: 'liuli',
  name: '流离',
  description: '当你成为杀的目标时，你可以弃置一张牌并将此杀转移给你攻击范围内的另一名角色。',
  triggers: [{ kind: 'on_sha_targeted' }],
  execute: (ctx) => {
    // Simplified: discard 1 card, redirect damage to another player
    const state = ctx.gameState;
    const player = state.players.find(p => p.id === ctx.sourcePlayerId);
    if (!player || player.hand.length === 0) return { actions: [] };

    const triggerAction = ctx.triggerEvent;
    if (!triggerAction || triggerAction.type !== 'PLAY_CARD') return { actions: [] };

    const shaSourceId = triggerAction.playerId;
    const others = state.players.filter(
      p => p.aliveStatus !== 'dead' && p.id !== ctx.sourcePlayerId && p.id !== shaSourceId
    );
    if (others.length === 0) return { actions: [] };

    // Discard 1 card as cost
    const discardCard = player.hand[player.hand.length - 1];
    const idx = player.hand.findIndex(c => c.instanceId === discardCard.instanceId);
    if (idx !== -1) {
      const [card] = player.hand.splice(idx, 1);
      state.discardPile.push(card);
    }

    // Deal 1 damage to new target (simulating redirected sha)
    return { actions: [{ type: 'DEAL_DAMAGE', sourceId: shaSourceId, targetId: others[0].id, amount: 1 }] };
  },
  isMandatory: false,
};

export const daqiao: CharacterDefinition = {
  id: 'daqiao',
  name: '大乔',
  title: '矜持之花',
  kingdom: 'wu',
  maxHp: 3,
  gender: 'female',
  skills: [skill_guose, skill_liuli],
};

// 孙尚香 (Sun Shangxiang)
const skill_jieyin: SkillDefinition = {
  id: 'jieyin',
  name: '结姻',
  description: '出牌阶段限一次，你可以弃置两张手牌，然后令一名已受伤的男性角色回复1点体力，然后你回复1点体力。',
  triggers: [{ kind: 'active', usableInPhase: 'play' }],
  execute: (ctx) => {
    const actions: GameAction[] = [];
    const player = ctx.gameState.players.find(p => p.id === ctx.sourcePlayerId);
    if (player) {
      actions.push({ type: 'HEAL_HP', playerId: ctx.sourcePlayerId, amount: 1, sourceId: ctx.sourcePlayerId });
    }
    return { actions };
  },
  isMandatory: false,
};

const skill_xiaoji: SkillDefinition = {
  id: 'xiaoji',
  name: '枭姬',
  description: '当你失去一张坐骑区或武器区的装备牌后，你可以摸两张牌。',
  triggers: [{ kind: 'on_card_played' }],
  execute: (ctx) => {
    const actions: ReturnType<SkillDefinition['execute']> = { actions: [] };
    actions.actions.push({ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 2 });
    return actions;
  },
  isMandatory: false,
};

export const sunshangxiang: CharacterDefinition = {
  id: 'sunshangxiang',
  name: '孙尚香',
  title: '弓腰姬',
  kingdom: 'wu',
  maxHp: 3,
  gender: 'female',
  skills: [skill_jieyin, skill_xiaoji],
};

export const WU_CHARACTERS = [sunquan, zhouyu, huanggai, lvmeng, luxun, daqiao, sunshangxiang];

export function registerWuCharacters(): void {
  for (const char of WU_CHARACTERS) {
    registerCharacterSkills(char.id, char.skills);
  }
}
