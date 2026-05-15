// ============================================================
// Qun Kingdom (群) characters
// ============================================================

import type { CharacterDefinition, SkillDefinition } from '../../../types/characters';
import type { GameAction } from '../../../types/actions';
import { registerCharacterSkills } from '../SkillEngine';

// 华佗 (Hua Tuo)
const skill_jijiu: SkillDefinition = {
  id: 'jijiu',
  name: '急救',
  description: '你的回合外，你可以将一张红色牌当桃使用。',
  triggers: [{ kind: 'on_healed' }],
  execute: (ctx) => {
    // Card conversion handled in RulesEngine.getValidActions
    return { actions: [] };
  },
  isMandatory: false,
};

const skill_qingnang: SkillDefinition = {
  id: 'qingnang',
  name: '青囊',
  description: '出牌阶段限一次，你可以弃置一张手牌，令一名角色回复1点体力。',
  triggers: [{ kind: 'active', usableInPhase: 'play' }],
  execute: (ctx) => {
    // Heal self 1 HP (simplified: heal self if hurt)
    const player = ctx.gameState.players.find(p => p.id === ctx.sourcePlayerId);
    if (player && player.hp < player.maxHp) {
      return { actions: [{ type: 'HEAL_HP', playerId: ctx.sourcePlayerId, amount: 1, sourceId: ctx.sourcePlayerId }] };
    }
    return { actions: [] };
  },
  isMandatory: false,
};

export const huatuo: CharacterDefinition = {
  id: 'huatuo',
  name: '华佗',
  title: '神医',
  kingdom: 'qun',
  maxHp: 3,
  gender: 'male',
  skills: [skill_jijiu, skill_qingnang],
};

// 吕布 (Lyu Bu)
const skill_wushuang: SkillDefinition = {
  id: 'wushuang',
  name: '无双',
  description: '锁定技，当你使用杀指定一名目标后，该角色需要连续使用两张闪才能抵消。与你进行决斗的角色每次需要连续打出两张杀。',
  triggers: [{ kind: 'on_sha_played' }, { kind: 'passive' }],
  execute: (ctx) => {
    // Engine handles multi-response requirement in ActionResolver
    return { actions: [] };
  },
  isMandatory: true,
};

export const lvbu: CharacterDefinition = {
  id: 'lvbu',
  name: '吕布',
  title: '飞将',
  kingdom: 'qun',
  maxHp: 4,
  gender: 'male',
  skills: [skill_wushuang],
};

// 貂蝉 (Diao Chan)
const skill_lijian: SkillDefinition = {
  id: 'lijian',
  name: '离间',
  description: '出牌阶段限一次，你可以弃置一张牌，令两名男性角色决斗。',
  triggers: [{ kind: 'active', usableInPhase: 'play' }],
  execute: (ctx) => {
    // Deal 1 damage to a random other player (simplified: forces a duel)
    const others = ctx.gameState.players.filter(p => p.id !== ctx.sourcePlayerId && p.aliveStatus !== 'dead');
    if (others.length > 0) {
      const target = others[0];
      return { actions: [
        { type: 'DEAL_DAMAGE', sourceId: ctx.sourcePlayerId, targetId: target.id, amount: 1 },
        { type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 },
      ]};
    }
    return { actions: [] };
  },
  isMandatory: false,
};

const skill_biyue: SkillDefinition = {
  id: 'biyue',
  name: '闭月',
  description: '结束阶段，你可以摸一张牌。',
  triggers: [{ kind: 'on_turn_end' }],
  execute: (ctx) => {
    const actions: ReturnType<SkillDefinition['execute']> = { actions: [] };
    actions.actions.push({ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 });
    return actions;
  },
  isMandatory: false,
};

export const diaochan: CharacterDefinition = {
  id: 'diaochan',
  name: '貂蝉',
  title: '绝世的舞姬',
  kingdom: 'qun',
  maxHp: 3,
  gender: 'female',
  skills: [skill_lijian, skill_biyue],
};

// 张角 (Zhang Jiao)
const skill_leiji: SkillDefinition = {
  id: 'leiji',
  name: '雷击',
  description: '当你使用或打出闪时，你可以令一名其他角色进行判定，若为黑桃，你对该角色造成2点雷电伤害。',
  triggers: [{ kind: 'on_sha_targeted' }],
  execute: (ctx) => {
    // When targeted by sha: judge; if spade, deal 2 thunder damage to source
    const state = ctx.gameState;
    if (state.deck.length === 0) return { actions: [] };

    const triggerAction = ctx.triggerEvent;
    if (!triggerAction || triggerAction.type !== 'PLAY_CARD') return { actions: [] };

    // Judge
    const judgeCard = state.deck[state.deck.length - 1];
    state.deck.pop();
    state.discardPile.push(judgeCard);

    // If spade, deal 2 thunder damage to sha source
    if (judgeCard.suit === 'spade') {
      return { actions: [{ type: 'DEAL_DAMAGE', sourceId: ctx.sourcePlayerId, targetId: triggerAction.playerId, amount: 2, element: 'thunder' }] };
    }

    return { actions: [] };
  },
  isMandatory: false,
};

const skill_guidao: SkillDefinition = {
  id: 'guidao',
  name: '鬼道',
  description: '当一名角色的判定牌生效前，你可以打出一张黑色牌替换之。',
  triggers: [{ kind: 'on_judgment_start' }],
  execute: (ctx) => {
    // Simplified: draw 1 card when any judgment occurs
    return { actions: [{ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 1 }] };
  },
  isMandatory: false,
};

const skill_huangtian: SkillDefinition = {
  id: 'huangtian',
  name: '黄天',
  description: '主公技，其他群势力角色可以在他们的出牌阶段给你一张闪或闪电。',
  triggers: [{ kind: 'active', usableInPhase: 'play' }],
  execute: (ctx) => {
    // Draw 1 card (simplified: Qun allies contribute resources)
    return { actions: [{ type: 'DRAW_CARDS', playerId: ctx.sourcePlayerId, count: 2 }] };
  },
  isMandatory: false,
  isRulerSkill: true,
};

export const zhangjiao: CharacterDefinition = {
  id: 'zhangjiao',
  name: '张角',
  title: '天公将军',
  kingdom: 'qun',
  maxHp: 3,
  gender: 'male',
  skills: [skill_leiji, skill_guidao, skill_huangtian],
  isRulerOption: true,
};

// 袁绍 (Yuan Shao)
const skill_luanji: SkillDefinition = {
  id: 'luanji',
  name: '乱击',
  description: '出牌阶段，你可以将两张同花色的手牌当万箭齐发使用。',
  triggers: [{ kind: 'active', usableInPhase: 'play' }],
  execute: (ctx) => {
    const actions: GameAction[] = [];
    const player = ctx.gameState.players.find(p => p.id === ctx.sourcePlayerId);
    if (!player) return { actions };

    // Find two cards of the same suit
    const suits = ['spade', 'heart', 'club', 'diamond'] as const;
    let cardsToDiscard: string[] = [];
    for (const suit of suits) {
      const sameSuit = player.hand.filter(c => c.suit === suit);
      if (sameSuit.length >= 2) {
        cardsToDiscard = sameSuit.slice(0, 2).map(c => c.instanceId);
        break;
      }
    }

    if (cardsToDiscard.length < 2) return { actions };

    // Discard the two cards
    for (const cardId of cardsToDiscard) {
      const idx = player.hand.findIndex(c => c.instanceId === cardId);
      if (idx !== -1) {
        const [card] = player.hand.splice(idx, 1);
        ctx.gameState.discardPile.push(card);
      }
    }

    // Deal 1 damage to all other players (万箭齐发 effect)
    const others = ctx.gameState.players.filter(p => p.id !== ctx.sourcePlayerId && p.aliveStatus !== 'dead');
    for (const p of others) {
      actions.push({ type: 'DEAL_DAMAGE', sourceId: ctx.sourcePlayerId, targetId: p.id, amount: 1 });
    }
    return { actions };
  },
  isMandatory: false,
};

export const yuanshao: CharacterDefinition = {
  id: 'yuanshao',
  name: '袁绍',
  title: '高贵的名门',
  kingdom: 'qun',
  maxHp: 4,
  gender: 'male',
  skills: [skill_luanji],
};

export const QUN_CHARACTERS = [huatuo, lvbu, diaochan, zhangjiao, yuanshao];

export function registerQunCharacters(): void {
  for (const char of QUN_CHARACTERS) {
    registerCharacterSkills(char.id, char.skills);
  }
}
