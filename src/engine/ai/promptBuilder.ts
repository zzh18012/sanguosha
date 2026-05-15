// ============================================================
// LLM Prompt Builder - serializes game state for LLM consumption
// ============================================================

import type { GameState, PlayerState } from '../../types/game';
import type { GameAction } from '../../types/actions';
import { getCharacterInfo } from '../../data/characterDefinitions';
import { getCardDefinition } from '../../data/cardDefinitions';
import { getIdentityName } from '../systems/IdentitySystem';
import { getPersona } from './AIPersonas';
import { getAlivePlayers } from '../../types/game';

const SYSTEM_PROMPT = `你是三国杀游戏的AI玩家，需要根据场上局势做出最优决策。

## 游戏规则摘要
- 体力(HP)归零进入濒死，濒死时需使用桃/酒自救或等待队友救援
- 每回合出牌阶段只能使用一张「杀」(除非技能允许)
- 「杀」造成1点伤害，需在攻击范围内；「闪」抵消杀
- 「桃」回复1点体力；「酒」本回合下一张杀伤害+1，或濒死自救
- 锦囊牌：过河拆桥(弃目标一张牌)、顺手牵羊(获得目标一张牌)、无中生有(摸2张)、决斗(双方轮流出杀)、南蛮入侵(AOE需出杀)、万箭齐发(AOE需出闪)、五谷丰登(全场选牌)、桃园结义(全体回复)、借刀杀人(借刀或出杀)、铁索连环(连环传导属性伤害)、无懈可击(抵消锦囊)
- 装备：武器(+攻击范围)、防具(如八卦阵替代闪判定)、+1马(防御距离+1)、-1马(进攻距离-1)
- 延时锦囊：乐不思蜀(判定非红桃跳过出牌)、兵粮寸断(判定非梅花跳过摸牌)、闪电(判定黑桃2-9造成3点雷伤)
- 铁索连环可重铸(弃置摸1张牌)

## 身份与胜利条件
- 主公(ruler)：身份公开，消灭所有反贼和内奸。HP上限+1。
- 忠臣(loyalist)：保护主公，消灭反贼和内奸。
- 反贼(rebel)：消灭主公即获胜。
- 内奸(spy)：消灭所有其他角色，且主公必须最后死亡。

## 策略原则
- 反贼优先集火主公；忠臣优先保护主公、攻击反贼
- 内奸前期低调，削弱双方实力，后期收割
- 濒死时最高优先级自救(桃/酒)
- 队友濒死时考虑出桃救援(但要判断是否真队友)
- AOE在敌多我少时使用，敌少我多时慎用
- 延时锦囊贴给敌人(乐不思蜀/兵粮寸断)
- 铁索连环连敌人再配合雷杀/火杀传导
- 装备武器可增加攻击范围
- 手牌数不是越多越好，弃牌阶段要舍得弃低价值牌

## 输出格式
你必须返回一个JSON对象，格式为：
{"reasoning":"一句话简述你的决策理由","choice":操作编号}

其中choice必须是你选择的操作的编号(整数)。`;

// Card suit symbols
const SUIT_SYMBOLS: Record<string, string> = {
  spade: '♠', heart: '♥', club: '♣', diamond: '♦',
};

function suitSymbol(suit: string): string {
  return SUIT_SYMBOLS[suit] || suit;
}

function describeCard(cardInstanceId: string, player: PlayerState): string {
  const card = player.hand.find(c => c.instanceId === cardInstanceId);
  if (!card) return cardInstanceId;
  const def = getCardDefinition(card.definitionId);
  const name = def?.name || card.name;
  const suit = suitSymbol(card.suit);
  return `${name}${suit}${card.rankDisplay}`;
}

function getPersonaStrategyHint(identity: string): string {
  const persona = getPersona(identity as any);
  switch (identity) {
    case 'ruler':
      return `主公应以自保为第一优先(自保权重${persona.selfPreservationMultiplier})，保护忠臣(团队权重${persona.teamPlayMultiplier})，慎重使用AOE避免误伤忠臣`;
    case 'loyalist':
      return `忠臣应全力保护主公(团队权重${persona.teamPlayMultiplier})，积极进攻反贼和内奸(攻击权重${persona.aggressionMultiplier})，必要时牺牲自己保护主公`;
    case 'rebel':
      return `反贼应集火主公(攻击权重${persona.aggressionMultiplier})，与队友配合速战速决，控制敌方手牌装备(控制权重${persona.cardControlMultiplier})`;
    case 'spy':
      return `内奸应极其注重自保(自保权重${persona.selfPreservationMultiplier})，低调行事不过早暴露，削弱双方实力最后收割，主公必须最后死亡`;
    default:
      return '根据身份选择最优策略';
  }
}

export function buildUserPrompt(
  state: GameState,
  playerId: string,
  validActions: GameAction[],
): string {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return '';

  const charInfo = getCharacterInfo(player.characterId);

  const lines: string[] = [];

  // --- Player identity ---
  const identityName = getIdentityName(player.identity);
  const revealed = player.identityRevealed ? '已公开' : '未公开';
  lines.push(`【你的身份】${identityName} (${revealed})`);
  lines.push(`【策略指引】${getPersonaStrategyHint(player.identity)}`);

  // --- Player character & stats ---
  const handDesc = player.hand.map(c => describeCard(c.instanceId, player)).join(', ');
  const charName = charInfo?.name || player.characterId;
  const skills = charInfo?.skillNames?.join('、') || '';
  lines.push(`【你的武将】${charName}  HP:${player.hp}/${player.maxHp}`);
  lines.push(`【手牌】${handDesc || '无'} ${skills ? `技能: ${skills}` : ''}`);

  // --- Equipment ---
  const eq = player.equipment;
  const weaponStr = eq.weapon ? `${eq.weapon.name}(范围${eq.weapon.weaponRange || 1})` : '无';
  const armorStr = eq.armor ? eq.armor.name : '无';
  const plusStr = eq.plusHorse ? eq.plusHorse.name : '无';
  const minusStr = eq.minusHorse ? eq.minusHorse.name : '无';
  lines.push(`【装备】武器:${weaponStr} 防具:${armorStr} +1马:${plusStr} -1马:${minusStr}`);

  if (player.isChainLinked) {
    lines.push(`⚠ 你处于铁索连环状态，会受到属性伤害传导`);
  }

  // --- Other players ---
  lines.push('');
  lines.push('【场上局势】');
  const alive = getAlivePlayers(state);
  let idx = 1;
  for (const p of alive) {
    const info = getCharacterInfo(p.characterId);
    const isMe = p.id === playerId;
    const marker = isMe ? ' ← 当前回合' : '';

    let nameStr = `${info?.name || p.characterId}`;
    if (p.identityRevealed && p.identity !== 'ruler') {
      nameStr += `(${getIdentityName(p.identity)})`;
    }
    if (p.identity === 'ruler') {
      nameStr += '(主公)';
    }

    const eqInfo: string[] = [];
    if (p.equipment.weapon) eqInfo.push(p.equipment.weapon.name);
    if (p.equipment.armor) eqInfo.push(p.equipment.armor.name);
    if (p.equipment.plusHorse) eqInfo.push('+1马');
    if (p.equipment.minusHorse) eqInfo.push('-1马');
    const eqStr = eqInfo.length > 0 ? eqInfo.join(' ') : '无';

    const chainTag = p.isChainLinked ? ' 🔗' : '';

    const handCount = p.hand.length;
    const isCurrent = state.turnOrder[state.currentPlayerIndex] === p.id;

    lines.push(`  ${idx}. ${isMe ? '你' : ''}${nameStr} HP:${p.hp}/${p.maxHp} 装备:[${eqStr}] 手牌数:${handCount}${chainTag}${marker}`);
    idx++;
  }

  // --- Judgement zone ---
  const judgeCards = player.judgmentArea || [];
  if (judgeCards.length > 0) {
    const judgeNames = judgeCards.map(c => c.name).join('、');
    lines.push(`【判定区】${judgeNames}`);
  }

  // --- Current phase ---
  lines.push('');
  const phaseNames: Record<string, string> = {
    draw: '摸牌阶段',
    play: '出牌阶段',
    discard: '弃牌阶段',
    end: '回合结束阶段',
    judgment: '判定阶段',
  };
  const phaseStr = phaseNames[state.currentTurnPhase] || state.currentTurnPhase;
  lines.push(`【当前阶段】${phaseStr}`);

  // --- Pending action ---
  if (state.pendingAction) {
    const pendingTypeNames: Record<string, string> = {
      respond_to_sha: '需要响应「杀」',
      respond_to_nanman: '需要响应「南蛮入侵」',
      respond_to_wanjian: '需要响应「万箭齐发」',
      respond_to_juedou: '需要响应「决斗」',
      respond_to_wuxie_chain: '无懈可击结算链',
      use_tao_dying: `${state.players.find(p => p.id === state.pendingAction?.playerId)?.name || '?'} 进入濒死状态，求桃中`,
      pick_card_to_discard: '过河拆桥 — 选择要弃置的牌',
      pick_card_to_steal: '顺手牵羊 — 选择要获得的牌',
      wugu_pick_card: '五谷丰登 — 选择一张牌',
      jiedao_sharen_choice: '借刀杀人 — 选择出杀或给武器',
    };
    const pendingDesc = pendingTypeNames[state.pendingAction.type] || state.pendingAction.type;
    lines.push(`【待响应】${pendingDesc}`);
  }

  // --- Valid actions ---
  lines.push('');
  lines.push(`【可选操作】共${validActions.length}项 (你必须选择编号，不能自己编造):`);

  for (let i = 0; i < validActions.length; i++) {
    const action = validActions[i];
    let desc = '';

    switch (action.type) {
      case 'PLAY_CARD': {
        const card = player.hand.find(c => c.instanceId === action.cardId);
        if (card) {
          const def = getCardDefinition(card.definitionId);
          const cn = def?.name || card.name;
          if (card.subtype === 'sha') {
            desc = `使用「${cn}」`;
          } else if (card.subtype === 'jiu') {
            desc = `使用「酒」(本回合下一张杀伤害+1)`;
          } else if (card.category === 'tool') {
            const toolDesc: Record<string, string> = {
              guohe_chaiqiao: '弃目标一张牌',
              shunshou_qianyang: '获得目标一张牌',
              wuzhong_shengyou: '摸2张牌',
              juedou: '与目标决斗',
              nanman_ruqin: '全场AOE需出杀',
              wanjian_qifa: '全场AOE需出闪',
              taoyuan_jieyi: '全场回复1点体力',
              wugu_fengdeng: '全场选牌',
              jiedao_sharen: '借刀杀人',
              tiesuo_lianhuan: '铁索连环(连环/重铸)',
              lebu_sishu: '乐不思蜀(跳过出牌阶段)',
              bingliang_cunduan: '兵粮寸断(跳过摸牌阶段)',
              shandian: '闪电(判定黑桃2-9=3点雷伤)',
            };
            desc = `使用「${cn}」${toolDesc[card.subtype] ? `(${toolDesc[card.subtype]})` : ''}`;
          } else {
            desc = `使用「${cn}」`;
          }
        } else {
          desc = `使用牌 ${action.cardId}`;
        }
        if (action.targets.length > 0) {
          desc += ` → 目标: ${action.targets.join(', ')}`;
        }
        break;
      }
      case 'EQUIP_CARD': {
        const card = player.hand.find(c => c.instanceId === action.cardId);
        if (card) {
          desc = `装备「${card.name}」`;
        } else {
          desc = `装备 ${action.cardId}`;
        }
        break;
      }
      case 'USE_SKILL':
        desc = `发动技能「${action.skillId}」`;
        if (action.targets.length > 0) {
          desc += ` → 目标: ${action.targets.join(', ')}`;
        }
        break;
      case 'USE_TAO_SELF':
        desc = `对自己使用桃(回复1点体力)`;
        break;
      case 'USE_TAO_OTHER':
        desc = `对 ${action.targetId} 使用桃(回复1点体力)`;
        break;
      case 'RESPOND': {
        const cardIds = action.cardIds || [];
        const cardNames = cardIds.map(cid => describeCard(cid, player)).join(', ');
        desc = `打出 ${cardNames} 响应`;
        break;
      }
      case 'PASS_RESPONSE':
        desc = '放弃响应(不出牌)';
        break;
      case 'PASS_SAVE_DYING':
        desc = '不救(放弃救援)';
        break;
      case 'PASS_WUXIE':
        desc = '不出无懈可击';
        break;
      case 'PLAY_WUXIE':
        desc = `打出无懈可击(${action.cardId})`;
        break;
      case 'END_PHASE':
        desc = '结束当前阶段';
        break;
      case 'END_TURN':
        desc = '结束回合';
        break;
      case 'JUDGE_BAGUAZHEN':
        desc = '发动八卦阵判定(替代出闪)';
        break;
      case 'SELECT_TARGET_CARD':
        desc = `选择目标的一张牌(${action.cardId})`;
        break;
      case 'PICK_WUGU_CARD':
        desc = `从五谷丰登中选取一张牌(${action.cardId})`;
        break;
      case 'JIEDAO_ATTACK':
        desc = `借刀杀人: 对 ${action.targetId} 出杀`;
        break;
      case 'JIEDAO_GIVE_WEAPON':
        desc = '借刀杀人: 交出武器';
        break;
      case 'RECAST_CARD':
        desc = `重铸「铁索连环」(弃置摸1张)`;
        break;
      case 'DISCARD_CARD':
        desc = `弃置 ${describeCard(action.cardId, player)}`;
        break;
      default:
        desc = `${action.type}`;
    }
    lines.push(`  ${i + 1}. ${desc}`);
  }

  return lines.join('\n');
}

export function getSystemPrompt(): string {
  return SYSTEM_PROMPT;
}
