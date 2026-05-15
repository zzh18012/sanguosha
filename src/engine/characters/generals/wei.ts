// ============================================================
// Wei Kingdom (魏) characters
// ============================================================

import type { CharacterDefinition, SkillDefinition } from '../../../types/characters';
import { registerCharacterSkills } from '../SkillEngine';

// 曹操 (Cao Cao) - 魏武帝
const skill_jianxiong: SkillDefinition = {
  id: 'jianxiong',
  name: '奸雄',
  description: '当你受到伤害后，你可以获得造成此伤害的牌。',
  triggers: [{ kind: 'on_damage_received' }],
  execute: (ctx) => {
    const actions: ReturnType<SkillDefinition['execute']> = { actions: [] };
    // Gain the card that caused damage (simplified: draw 1 card)
    actions.actions.push({ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 });
    return actions;
  },
  isMandatory: false,
};

const skill_hujia: SkillDefinition = {
  id: 'hujia',
  name: '护驾',
  description: '主公技，当你需要使用或打出闪时，你可以令其他魏势力角色打出一张闪（视为由你使用或打出）。',
  triggers: [{ kind: 'on_sha_targeted' }],
  execute: (ctx) => {
    // Simplified: draw 1 card when Wei allies are present
    const weiAllies = ctx.gameState.players.filter(
      p => p.aliveStatus !== 'dead' && p.id !== ctx.sourcePlayerId && p.kingdom === 'wei'
    );
    if (weiAllies.length > 0) {
      return { actions: [{ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 }] };
    }
    return { actions: [] };
  },
  isMandatory: false,
  isRulerSkill: true,
};

export const caocao: CharacterDefinition = {
  id: 'caocao',
  name: '曹操',
  title: '魏武帝',
  kingdom: 'wei',
  maxHp: 4,
  gender: 'male',
  skills: [skill_jianxiong, skill_hujia],
  isRulerOption: true,
};

// 司马懿 (Sima Yi)
const skill_fankui: SkillDefinition = {
  id: 'fankui',
  name: '反馈',
  description: '当你受到伤害后，你可以获得伤害来源的一张牌。',
  triggers: [{ kind: 'on_damage_received' }],
  execute: (ctx) => {
    const actions: ReturnType<SkillDefinition['execute']> = { actions: [] };
    // Steal a card from damage source (simplified: draw a card from deck)
    actions.actions.push({ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 });
    return actions;
  },
  isMandatory: false,
};

const skill_guicai: SkillDefinition = {
  id: 'guicai',
  name: '鬼才',
  description: '当一名角色的判定牌生效前，你可以打出一张手牌代替之。',
  triggers: [{ kind: 'on_judgment_start' }],
  execute: (ctx) => {
    // Simplified: draw 1 card when any judgment occurs (represents manipulating fate)
    return { actions: [{ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 }] };
  },
  isMandatory: false,
};

export const simayi: CharacterDefinition = {
  id: 'simayi',
  name: '司马懿',
  title: '狼顾之鬼',
  kingdom: 'wei',
  maxHp: 3,
  gender: 'male',
  skills: [skill_fankui, skill_guicai],
};

// 夏侯惇 (Xiahou Dun)
const skill_ganglie: SkillDefinition = {
  id: 'ganglie',
  name: '刚烈',
  description: '当你受到伤害后，你可以进行判定，若结果不为红桃，伤害来源选择弃置两张手牌或受到你造成的1点伤害。',
  triggers: [{ kind: 'on_damage_received' }],
  execute: (ctx) => {
    const state = ctx.gameState;
    if (state.deck.length === 0) return { actions: [] };
    const judgeCard = state.deck[state.deck.length - 1];
    if (judgeCard.suit !== 'heart') {
      // Damage source must discard 2 or take 1 damage
      return { actions: [{ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 }] };
    }
    return { actions: [] };
  },
  isMandatory: false,
};

export const xiahoudun: CharacterDefinition = {
  id: 'xiahoudun',
  name: '夏侯惇',
  title: '独眼的罗刹',
  kingdom: 'wei',
  maxHp: 4,
  gender: 'male',
  skills: [skill_ganglie],
};

// 张辽 (Zhang Liao)
const skill_tuxi: SkillDefinition = {
  id: 'tuxi',
  name: '突袭',
  description: '摸牌阶段，你可以少摸任意张牌，然后选择等量的手牌数不小于你的角色，获得这些角色的各一张手牌。',
  triggers: [{ kind: 'on_draw_phase' }],
  execute: (ctx) => {
    // Simplified: steal 1 card from another player with most hand cards
    const state = ctx.gameState;
    const player = state.players.find(p => p.id === ctx.sourcePlayerId);
    if (!player) return { actions: [] };

    const targets = state.players.filter(
      p => p.aliveStatus !== 'dead' && p.id !== ctx.sourcePlayerId && p.hand.length > 0
    );
    if (targets.length === 0) return { actions: [] };

    // Pick the target with the most hand cards
    targets.sort((a, b) => b.hand.length - a.hand.length);
    const target = targets[0];
    const stolenCard = target.hand[target.hand.length - 1];

    // Steal one card
    const idx = target.hand.findIndex(c => c.instanceId === stolenCard.instanceId);
    if (idx !== -1) {
      const [card] = target.hand.splice(idx, 1);
      player.hand.push(card);
    }

    return { actions: [] };
  },
  isMandatory: false,
};

export const zhangliao: CharacterDefinition = {
  id: 'zhangliao',
  name: '张辽',
  title: '前将军',
  kingdom: 'wei',
  maxHp: 4,
  gender: 'male',
  skills: [skill_tuxi],
};

// 许褚 (Xu Chu)
const skill_luoyi: SkillDefinition = {
  id: 'luoyi',
  name: '裸衣',
  description: '摸牌阶段，你可以少摸一张牌，本回合使用杀或决斗造成伤害时，此伤害+1。',
  triggers: [{ kind: 'on_draw_phase' }],
  execute: (ctx) => {
    // Trade 1 fewer draw (discard 1 from hand) for +1 damage this turn
    const state = ctx.gameState;
    const player = state.players.find(p => p.id === ctx.sourcePlayerId);
    if (!player || player.hand.length === 0) return { actions: [] };

    // Discard 1 card (cancel 1 of the 2 normal draws)
    const discardCard = player.hand[player.hand.length - 1];
    const idx = player.hand.findIndex(c => c.instanceId === discardCard.instanceId);
    if (idx !== -1) {
      const [card] = player.hand.splice(idx, 1);
      state.discardPile.push(card);
    }

    // +1 damage bonus for sha/juedou this turn
    player.luoyiBonus = 1;

    return { actions: [] };
  },
  isMandatory: false,
};

export const xuchu: CharacterDefinition = {
  id: 'xuchu',
  name: '许褚',
  title: '虎痴',
  kingdom: 'wei',
  maxHp: 4,
  gender: 'male',
  skills: [skill_luoyi],
};

// 郭嘉 (Guo Jia)
const skill_tiandu: SkillDefinition = {
  id: 'tiandu',
  name: '天妒',
  description: '当你的判定牌生效后，你可以获得此牌。',
  triggers: [{ kind: 'on_judgment_start' }],
  execute: (ctx) => {
    const actions: ReturnType<SkillDefinition['execute']> = { actions: [] };
    actions.actions.push({ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 });
    return actions;
  },
  isMandatory: false,
};

const skill_yiji: SkillDefinition = {
  id: 'yiji',
  name: '遗计',
  description: '当你受到1点伤害后，你可以摸两张牌，然后你可以将至多两张手牌交给任意角色。',
  triggers: [{ kind: 'on_damage_received' }],
  execute: (ctx) => {
    const actions: ReturnType<SkillDefinition['execute']> = { actions: [] };
    // Draw 2 cards when damaged
    actions.actions.push({ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 2 });
    return actions;
  },
  isMandatory: false,
};

export const guojia: CharacterDefinition = {
  id: 'guojia',
  name: '郭嘉',
  title: '早终的先知',
  kingdom: 'wei',
  maxHp: 3,
  gender: 'male',
  skills: [skill_tiandu, skill_yiji],
};

// 甄姬 (Zhen Ji)
const skill_luoshen: SkillDefinition = {
  id: 'luoshen',
  name: '洛神',
  description: '准备阶段，你可以进行判定，若结果为黑色，你获得此牌并重复此流程。',
  triggers: [{ kind: 'on_turn_start' }],
  execute: (ctx) => {
    const actions: ReturnType<SkillDefinition['execute']> = { actions: [] };
    const state = ctx.gameState;
    // Simplified: draw additional cards based on luck
    if (state.deck.length > 0) {
      const judgeCard = state.deck[state.deck.length - 1];
      if (judgeCard.suit === 'spade' || judgeCard.suit === 'club') {
        actions.actions.push({ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 });
      }
    }
    return actions;
  },
  isMandatory: false,
};

const skill_qingguo: SkillDefinition = {
  id: 'qingguo',
  name: '倾国',
  description: '你可以将一张黑色手牌当闪使用或打出。',
  triggers: [{ kind: 'on_sha_targeted' }],
  execute: (ctx) => {
    // Black cards can be used as 闪
    return { actions: [] };
  },
  isMandatory: false,
};

export const zhenji: CharacterDefinition = {
  id: 'zhenji',
  name: '甄姬',
  title: '薄幸的美人',
  kingdom: 'wei',
  maxHp: 3,
  gender: 'female',
  skills: [skill_luoshen, skill_qingguo],
};

// Register all Wei characters
export const WEI_CHARACTERS = [caocao, simayi, xiahoudun, zhangliao, xuchu, guojia, zhenji];

export function registerWeiCharacters(): void {
  for (const char of WEI_CHARACTERS) {
    registerCharacterSkills(char.id, char.skills);
  }
}
