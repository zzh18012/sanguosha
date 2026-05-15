// ============================================================
// Shu Kingdom (蜀) characters
// ============================================================

import type { CharacterDefinition, SkillDefinition } from '../../../types/characters';
import type { GameAction } from '../../../types/actions';
import { registerCharacterSkills } from '../SkillEngine';

// 刘备 (Liu Bei)
const skill_rende: SkillDefinition = {
  id: 'rende',
  name: '仁德',
  description: '出牌阶段，你可以将任意张手牌交给其他角色，若你给出的牌张数达到两张或更多时，你回复1点体力。',
  triggers: [{ kind: 'active', usableInPhase: 'play' }],
  execute: (ctx) => {
    const state = ctx.gameState;
    const player = state.players.find(p => p.id === ctx.sourcePlayerId);
    const actions: GameAction[] = [];
    if (player && player.hp < player.maxHp) {
      actions.push({ type: 'HEAL_HP', playerId: ctx.sourcePlayerId, amount: 1, sourceId: ctx.sourcePlayerId });
    }
    // Also draw 1 card as token of 仁德 (simplified)
    actions.push({ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 });
    return { actions };
  },
  isMandatory: false,
};

const skill_jiang: SkillDefinition = {
  id: 'jijiang',
  name: '激将',
  description: '主公技，当你需要使用或打出杀时，你可以令其他蜀势力角色打出一张杀（视为由你使用或打出）。',
  triggers: [{ kind: 'on_sha_played' }],
  execute: (ctx) => {
    // Simplified: draw 1 card when Shu allies are present
    const shuAllies = ctx.gameState.players.filter(
      p => p.aliveStatus !== 'dead' && p.id !== ctx.sourcePlayerId && p.kingdom === 'shu'
    );
    if (shuAllies.length > 0) {
      return { actions: [{ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 }] };
    }
    return { actions: [] };
  },
  isMandatory: false,
  isRulerSkill: true,
};

export const liubei: CharacterDefinition = {
  id: 'liubei',
  name: '刘备',
  title: '乱世的枭雄',
  kingdom: 'shu',
  maxHp: 4,
  gender: 'male',
  skills: [skill_rende, skill_jiang],
  isRulerOption: true,
};

// 关羽 (Guan Yu)
const skill_wusheng: SkillDefinition = {
  id: 'wusheng',
  name: '武圣',
  description: '你可以将一张红色牌当杀使用或打出。',
  triggers: [{ kind: 'on_sha_played' }],
  execute: (ctx) => {
    // Card conversion handled by engine (getValidResponseCards)
    return { actions: [] };
  },
  isMandatory: false,
};

export const guanyu: CharacterDefinition = {
  id: 'guanyu',
  name: '关羽',
  title: '美髯公',
  kingdom: 'shu',
  maxHp: 4,
  gender: 'male',
  skills: [skill_wusheng],
};

// 张飞 (Zhang Fei)
const skill_paoxiao: SkillDefinition = {
  id: 'paoxiao',
  name: '咆哮',
  description: '锁定技，你使用杀无次数限制。若你使用的杀被闪抵消，你可以摸一张牌。',
  triggers: [{ kind: 'passive' }],
  execute: (ctx) => {
    // Engine handles: unlimited sha (RulesEngine), draw on dodge (ActionResolver)
    return { actions: [] };
  },
  isMandatory: true,
};

export const zhangfei: CharacterDefinition = {
  id: 'zhangfei',
  name: '张飞',
  title: '万夫不当',
  kingdom: 'shu',
  maxHp: 4,
  gender: 'male',
  skills: [skill_paoxiao],
};

// 诸葛亮 (Zhuge Liang)
const skill_guanxing: SkillDefinition = {
  id: 'guanxing',
  name: '观星',
  description: '准备阶段，你可以观看牌堆顶的X张牌（X为存活角色数且至多为5），然后将这些牌以任意顺序放回牌堆顶或牌堆底。',
  triggers: [{ kind: 'on_turn_start' }],
  execute: (ctx) => {
    // Look at top X cards, rearrange
    const actions: ReturnType<SkillDefinition['execute']> = { actions: [] };
    actions.actions.push({ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 });
    return actions;
  },
  isMandatory: false,
};

const skill_kongcheng: SkillDefinition = {
  id: 'kongcheng',
  name: '空城',
  description: '锁定技，若你没有手牌，你不能成为杀或决斗的目标。',
  triggers: [{ kind: 'passive' }],
  execute: (ctx) => {
    // Engine handles target validation in RulesEngine + ActionResolver
    return { actions: [] };
  },
  isMandatory: true,
};

export const zhugeliang: CharacterDefinition = {
  id: 'zhugeliang',
  name: '诸葛亮',
  title: '卧龙',
  kingdom: 'shu',
  maxHp: 3,
  gender: 'male',
  skills: [skill_guanxing, skill_kongcheng],
};

// 赵云 (Zhao Yun)
const skill_longdan: SkillDefinition = {
  id: 'longdan',
  name: '龙胆',
  description: '你可以将一张杀当闪使用或打出，或将一张闪当杀使用或打出。',
  triggers: [{ kind: 'on_sha_targeted' }],
  execute: (ctx) => {
    // Card conversion handled by engine (getValidResponseCards)
    return { actions: [] };
  },
  isMandatory: false,
};

export const zhaoyun: CharacterDefinition = {
  id: 'zhaoyun',
  name: '赵云',
  title: '虎威将军',
  kingdom: 'shu',
  maxHp: 4,
  gender: 'male',
  skills: [skill_longdan],
};

// 马超 (Ma Chao)
const skill_mashu: SkillDefinition = {
  id: 'mashu',
  name: '马术',
  description: '锁定技，你计算与其他角色的距离时始终-1。',
  triggers: [{ kind: 'passive' }],
  execute: (ctx) => {
    // Engine handles distance calculation in DistanceSystem
    return { actions: [] };
  },
  isMandatory: true,
};

const skill_tieqi: SkillDefinition = {
  id: 'tieqi',
  name: '铁骑',
  description: '当你使用杀指定一名目标后，你可以进行判定，若结果为红色，该角色不能使用闪响应此杀。',
  triggers: [{ kind: 'on_sha_played' }],
  execute: (ctx) => {
    // Judgment + unblockable effect handled inline in ActionResolver.resolvePlayCard
    return { actions: [] };
  },
  isMandatory: false,
};

export const machao: CharacterDefinition = {
  id: 'machao',
  name: '马超',
  title: '锦马超',
  kingdom: 'shu',
  maxHp: 4,
  gender: 'male',
  skills: [skill_mashu, skill_tieqi],
};

// 黄月英 (Huang Yueying)
const skill_jizhi: SkillDefinition = {
  id: 'jizhi',
  name: '集智',
  description: '当你使用一张非延时锦囊牌时，你可以摸一张牌。',
  triggers: [{ kind: 'on_card_played' }],
  execute: (ctx) => {
    const actions: ReturnType<SkillDefinition['execute']> = { actions: [] };
    actions.actions.push({ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 });
    return actions;
  },
  isMandatory: false,
};

const skill_qicai: SkillDefinition = {
  id: 'qicai',
  name: '奇才',
  description: '锁定技，你使用锦囊牌无距离限制。',
  triggers: [{ kind: 'passive' }],
  execute: (ctx) => {
    // Engine handles distance check in RulesEngine
    return { actions: [] };
  },
  isMandatory: true,
};

export const huangyueying: CharacterDefinition = {
  id: 'huangyueying',
  name: '黄月英',
  title: '归隐的杰女',
  kingdom: 'shu',
  maxHp: 3,
  gender: 'female',
  skills: [skill_jizhi, skill_qicai],
};

export const SHU_CHARACTERS = [liubei, guanyu, zhangfei, zhugeliang, zhaoyun, machao, huangyueying];

export function registerShuCharacters(): void {
  for (const char of SHU_CHARACTERS) {
    registerCharacterSkills(char.id, char.skills);
  }
}
