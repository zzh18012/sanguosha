// ============================================================
// ActionResolver - applies validated actions to produce new state
// ============================================================

import type { GameState } from '../../types/game';
import { checkVictory } from '../../types/game';
import type { GameAction } from '../../types/actions';
import type { GameCard } from '../../types/cards';
import { cloneState, findPlayer } from './GameState';
import { drawCards, buildDeck, shuffleDeck } from './DeckFactory';
import { getCharacterInfo } from '../../data/characterDefinitions';
import { isInRange } from '../systems/DistanceSystem';
import { executeSkill, getSkill, playerHasSkill } from '../characters/SkillEngine';

// Main resolution entry point
export function resolveAction(state: GameState, action: GameAction): { state: GameState; newActions: GameAction[] } {
  const next = cloneState(state);
  const newActions: GameAction[] = [];

  switch (action.type) {
    case 'PLAY_CARD':
      return resolvePlayCard(next, action);
    case 'EQUIP_CARD':
      return resolveEquipCard(next, action);
    case 'DISCARD_CARD':
      return resolveDiscardCard(next, action);
    case 'END_PHASE':
      return resolveEndPhase(next, action);
    case 'END_TURN':
      return resolveEndTurn(next, action);
    case 'RESPOND':
      return resolveRespond(next, action);
    case 'PASS_RESPONSE':
      return resolvePassResponse(next, action);
    case 'PLAY_WUXIE':
      return resolvePlayWuxie(next, action);
    case 'PASS_WUXIE':
      return resolvePassWuxie(next, action);
    case 'USE_TAO_SELF':
      return resolveUseTaoSelf(next, action);
    case 'USE_TAO_OTHER':
      return resolveUseTaoOther(next, action);
    case 'DRAW_CARDS':
      return resolveDrawCards(next, action);
    case 'DEAL_DAMAGE':
      return resolveDealDamage(next, action);
    case 'HEAL_HP':
      return resolveHealHp(next, action);
    case 'ENTER_DYING':
      return resolveEnterDying(next, action);
    case 'PLAYER_DIED':
      return resolvePlayerDied(next, action);
    case 'DISCARD_TO_MAX_HP':
      return { state: next, newActions };
    case 'DISCARD_ALL_CARDS':
      return resolveDiscardAllCards(next, action);
    case 'DESTROY_EQUIPMENT':
      return resolveDestroyEquipment(next, action);
    case 'CHECK_VICTORY':
      return resolveCheckVictory(next);
    case 'SELECT_CHARACTER':
      return resolveSelectCharacter(next, action);
    case 'START_GAME':
      return resolveStartGame(next);
    case 'PHASE_CHANGE':
      return resolvePhaseChange(next, action);
    case 'JUDGE_BAGUAZHEN':
      return resolveJudgeBaguazhen(next, action);
    case 'SELECT_TARGET_CARD':
      return resolveSelectTargetCard(next, action);
    case 'PICK_WUGU_CARD':
      return resolvePickWuguCard(next, action);
    case 'JIEDAO_ATTACK':
      return resolveJiedaoAttack(next, action);
    case 'JIEDAO_GIVE_WEAPON':
      return resolveJiedaoGiveWeapon(next, action);
    case 'USE_SKILL':
      return resolveUseSkill(next, action);
    case 'RECAST_CARD':
      return resolveRecastCard(next, action);
    case 'PASS_SAVE_DYING':
      return resolvePassSaveDying(next, action);
    case 'TURN_START':
    case 'ENTER_JUDGMENT_PHASE':
    case 'RESOLVE_JUDGMENT':
    case 'PLACE_DELAYED_TOOL':
    case 'REMOVE_DELAYED_TOOL':
    case 'STEAL_CARD':
    case 'CHAIN_PLAYERS':
    case 'TURN_OVER':
    case 'DRAW_CARDS_SPECIFIC':
    case 'REQUEST_CHARACTER_SELECTION':
    case 'AI_THINK':
      return { state: next, newActions };
    default:
      return { state: next, newActions };
  }
}

// Apply a deferred tool card effect after wuxie window passes without negation
function applyDeferredToolEffect(
  state: GameState,
  playerId: string,
  subtype: string,
  targets: string[],
  cardInstanceId?: string,
): { state: GameState; newActions: GameAction[] } {
  const newActions: GameAction[] = [];

  switch (subtype) {
    case 'wuzhong_shengyou': {
      newActions.push({ type: 'DRAW_CARDS', playerId, count: 2 });
      break;
    }
    case 'guohe_chaiqiao': {
      const target = findPlayer(state, targets[0])!;
      const availableCards: Array<{ cardId: string; cardName: string; zone: 'hand' | 'equipment' }> = [
        ...target.hand.map((c, i) => ({ cardId: c.instanceId, cardName: `手牌${i + 1}`, zone: 'hand' as const })),
        ...(Object.entries(target.equipment)
          .filter(([, v]) => v !== null)
          .map(([, v]) => ({ cardId: v!.instanceId, cardName: v!.name, zone: 'equipment' as const }))),
      ];
      if (availableCards.length === 0) break;
      state.pendingAction = {
        type: 'pick_card_to_discard',
        playerId,
        timeoutAction: { type: 'DISCARD_CARD', playerId, cardId: '' },
        extra: { targetId: target.id, availableCards },
      };
      break;
    }
    case 'shunshou_qianyang': {
      const target = findPlayer(state, targets[0])!;
      const availableCards: Array<{ cardId: string; cardName: string; zone: 'hand' | 'equipment' }> = [
        ...target.hand.map((c, i) => ({ cardId: c.instanceId, cardName: `手牌${i + 1}`, zone: 'hand' as const })),
        ...(Object.entries(target.equipment)
          .filter(([, v]) => v !== null)
          .map(([, v]) => ({ cardId: v!.instanceId, cardName: v!.name, zone: 'equipment' as const }))),
      ];
      if (availableCards.length === 0) break;
      state.pendingAction = {
        type: 'pick_card_to_steal',
        playerId,
        timeoutAction: { type: 'DISCARD_CARD', playerId, cardId: '' },
        extra: { targetId: target.id, availableCards },
      };
      break;
    }
    case 'juedou': {
      const target = findPlayer(state, targets[0])!;
      const isWushuang = playerHasSkill(state, target.id, 'wushuang');
      const validSha = getValidResponseCards(state, target.id, 'sha');
      const player = findPlayer(state, playerId);
      const jdDamage = 1 + (player?.luoyiBonus ?? 0);
      state.pendingAction = {
        type: 'respond_to_juedou',
        playerId: target.id,
        validResponseCards: validSha,
        timeoutAction: { type: 'DEAL_DAMAGE', sourceId: playerId, targetId: target.id, amount: jdDamage },
        extra: { juedouChain: true, lastResponderId: playerId, wushuangRequired: isWushuang, wushuangResponded: 0, jdSourceId: playerId },
      };
      break;
    }
    case 'nanman_ruqin': {
      const responders = state.players.filter(
        p => p.aliveStatus !== 'dead' && p.id !== playerId && p.equipment.armor?.subtype !== 'tengjia'
      );
      if (responders.length === 0) break;
      const first = responders[0];
      const validSha = getValidResponseCards(state, first.id, 'sha');
      state.pendingAction = {
        type: 'respond_to_nanman',
        playerId: first.id,
        validResponseCards: validSha,
        timeoutAction: { type: 'DEAL_DAMAGE', sourceId: playerId, targetId: first.id, amount: 1 },
        extra: { aoeType: 'nanman', sourceId: playerId, remainingResponderIds: responders.slice(1).map(p => p.id) },
      };
      break;
    }
    case 'wanjian_qifa': {
      const responders = state.players.filter(
        p => p.aliveStatus !== 'dead' && p.id !== playerId && p.equipment.armor?.subtype !== 'tengjia'
      );
      if (responders.length === 0) break;
      const first = responders[0];
      const validShan = getValidResponseCards(state, first.id, 'shan');
      state.pendingAction = {
        type: 'respond_to_wanjian',
        playerId: first.id,
        validResponseCards: validShan,
        timeoutAction: { type: 'DEAL_DAMAGE', sourceId: playerId, targetId: first.id, amount: 1 },
        extra: { aoeType: 'wanjian', sourceId: playerId, remainingResponderIds: responders.slice(1).map(p => p.id) },
      };
      break;
    }
    case 'taoyuan_jieyi': {
      for (const p of state.players) {
        if (p.aliveStatus === 'dead') continue;
        if (p.hp < p.maxHp) p.hp = Math.min(p.hp + 1, p.maxHp);
        if (p.aliveStatus === 'dying' && p.hp > 0) p.aliveStatus = 'alive';
      }
      break;
    }
    case 'wugu_fengdeng': {
      const alivePlayers = state.players.filter(p => p.aliveStatus !== 'dead');
      const aliveCount = alivePlayers.length;
      const { drawnCards, newDeck, newDiscardPile } = drawCards(state.deck, state.discardPile, aliveCount);
      state.deck = newDeck;
      state.discardPile = newDiscardPile;
      if (drawnCards.length === 0) break;
      const currentPlayerIdx = alivePlayers.findIndex(p => p.id === playerId);
      const pickOrder = [
        ...alivePlayers.slice(currentPlayerIdx).map(p => p.id),
        ...alivePlayers.slice(0, currentPlayerIdx).map(p => p.id),
      ];
      const firstPicker = pickOrder[0];
      state.pendingAction = {
        type: 'wugu_pick_card',
        playerId: firstPicker,
        timeoutAction: { type: 'DISCARD_CARD', playerId: firstPicker, cardId: '' },
        extra: { wuguCards: drawnCards, remainingPlayerIds: pickOrder.slice(1), sourceId: playerId },
      };
      break;
    }
    case 'jiedao_sharen': {
      const target = findPlayer(state, targets[0])!;
      const hasSha = target.hand.some(c => c.subtype === 'sha');
      const validTargets = state.players.filter(
        p => p.aliveStatus !== 'dead' && p.id !== target.id && isInRange(state, target.id, p.id)
      );
      state.pendingAction = {
        type: 'jiedao_sharen_choice',
        playerId: target.id,
        timeoutAction: { type: 'JIEDAO_GIVE_WEAPON', playerId: target.id },
        extra: { sourceId: playerId, validTargetIds: validTargets.map(p => p.id), hasSha: hasSha && validTargets.length > 0 },
      };
      break;
    }
    case 'tiesuo_lianhuan': {
      for (const targetId of targets) {
        const targetPlayer = findPlayer(state, targetId);
        if (targetPlayer && targetPlayer.aliveStatus !== 'dead') {
          targetPlayer.isChainLinked = !targetPlayer.isChainLinked;
        }
      }
      break;
    }
    case 'lebu_sishu':
    case 'bingliang_cunduan':
    case 'shandian': {
      // Move card from discard pile to target's judgment area
      const target = findPlayer(state, targets[0])!;
      if (cardInstanceId) {
        const dpIdx = state.discardPile.findIndex(c => c.instanceId === cardInstanceId);
        if (dpIdx !== -1) {
          const [toolCard] = state.discardPile.splice(dpIdx, 1);
          target.judgmentArea.push(toolCard);
        }
      }
      break;
    }
    default:
      break;
  }

  return { state, newActions };
}

// Get valid response cards accounting for card-conversion skills
function getValidResponseCards(state: GameState, playerId: string, neededType: 'sha' | 'shan'): string[] {
  const player = findPlayer(state, playerId);
  if (!player) return [];

  const validCards: string[] = [];

  for (const card of player.hand) {
    if (neededType === 'sha' && card.subtype === 'sha') {
      validCards.push(card.instanceId);
      continue;
    }
    if (neededType === 'shan' && card.subtype === 'shan') {
      validCards.push(card.instanceId);
      continue;
    }

    // 武圣 (Guan Yu): red cards can be used as 杀
    if (neededType === 'sha' && playerHasSkill(state, playerId, 'wusheng')) {
      if (card.suit === 'heart' || card.suit === 'diamond') {
        validCards.push(card.instanceId);
        continue;
      }
    }

    // 倾国 (Zhen Ji): black hand cards can be used as 闪
    if (neededType === 'shan' && playerHasSkill(state, playerId, 'qingguo')) {
      if (card.suit === 'spade' || card.suit === 'club') {
        validCards.push(card.instanceId);
        continue;
      }
    }

    // 龙胆 (Zhao Yun): 杀 ↔ 闪 interchange
    if (playerHasSkill(state, playerId, 'longdan')) {
      if (neededType === 'sha' && card.subtype === 'shan') {
        validCards.push(card.instanceId);
        continue;
      }
      if (neededType === 'shan' && card.subtype === 'sha') {
        validCards.push(card.instanceId);
        continue;
      }
    }
  }

  return validCards;
}

function resolvePlayCard(state: GameState, action: Extract<GameAction, { type: 'PLAY_CARD' }>): { state: GameState; newActions: GameAction[] } {
  const player = findPlayer(state, action.playerId)!;
  const newActions: GameAction[] = [];

  // Find and remove card from hand
  const cardIdx = player.hand.findIndex(c => c.instanceId === action.cardId);
  if (cardIdx === -1) return { state, newActions };
  const [card] = player.hand.splice(cardIdx, 1);

  // Move to discard pile (delayed tools also go to discard first —
  // they'll be moved to judgment area after wuxie window passes)
  state.discardPile.push(card);

  // All tool cards (锦囊牌) except 无懈可击 itself create a wuxie opportunity
  if (card.category === 'tool' && card.subtype !== 'wuxie_keji') {
    state.pendingAction = {
      type: 'wuxie_opportunity',
      playerId: action.playerId,
      sourceCardId: card.instanceId,
      timeoutAction: { type: 'PASS_WUXIE', playerId: action.playerId },
      extra: {
        toolSubtype: card.subtype,
        toolTargets: action.targets,
        toolPlayerId: action.playerId,
        cardInstanceId: card.instanceId,
      },
    };
    return { state, newActions };
  }

  // Apply card effect based on subtype
  switch (card.subtype) {
    case 'sha': {
      player.shaUsedThisTurn = true;
      const targetId = action.targets[0];
      const target = findPlayer(state, targetId);
      if (!target) break;

      // 空城: immune to sha when no hand cards
      if (playerHasSkill(state, targetId, 'kongcheng') && target.hand.length === 0) break;

      // Calculate damage amount
      let damageAmount = 1;
      if (player.isIntoxicated) {
        damageAmount += 1;
        player.isIntoxicated = false;
      }
      // 裸衣 bonus
      if (player.luoyiBonus > 0) {
        damageAmount += player.luoyiBonus;
      }

      // 藤甲: immune to normal 杀, +1 from fire
      if (target.equipment.armor?.subtype === 'tengjia') {
        if (!card.isFireElement && !card.isThunderElement) break;
        if (card.isFireElement) damageAmount += 1;
      }

      // 仁王盾: immune to black 杀
      if (target.equipment.armor?.subtype === 'renwangdun') {
        if (card.suit === 'spade' || card.suit === 'club') break;
      }

      // 铁骑 (Ma Chao): judge; if red, sha is unblockable
      if (playerHasSkill(state, action.playerId, 'tieqi') && state.deck.length > 0) {
        const jc = state.deck.pop()!;
        state.discardPile.push(jc);
        if (jc.suit === 'heart' || jc.suit === 'diamond') {
          player.tieqiActive = true;
        }
      }
      if (player.tieqiActive) {
        player.tieqiActive = false;
        newActions.push({ type: 'DEAL_DAMAGE', sourceId: action.playerId, targetId, amount: damageAmount, element: card.isFireElement ? 'fire' : card.isThunderElement ? 'thunder' : 'normal' });
        break;
      }

      // 八卦阵: if target has it, they can judge instead of playing 闪
      const hasBaguazhen = target.equipment.armor?.subtype === 'baguazhen';

      // 无双 (Lyu Bu): target needs 2 闪 to dodge
      const isWushuang = playerHasSkill(state, action.playerId, 'wushuang');

      // Ask target to play 闪
      const validShan = getValidResponseCards(state, targetId, 'shan');
      state.pendingAction = {
        type: 'respond_to_sha',
        playerId: targetId,
        sourceCardId: card.instanceId,
        validResponseCards: validShan,
        timeoutAction: { type: 'DEAL_DAMAGE', sourceId: action.playerId, targetId, amount: damageAmount, element: card.isFireElement ? 'fire' : card.isThunderElement ? 'thunder' : 'normal' },
        extra: { hasBaguazhen, shaSourceId: action.playerId, wushuangRequired: isWushuang, wushuangResponded: 0 },
      };
      break;
    }
    case 'jiu': {
      player.jiuUsedThisTurn = true;
      player.isIntoxicated = true;
      break;
    }
    // Tool cards are intercepted above via wuxie_opportunity → applyDeferredToolEffect
    default:
      break;
  }

  return { state, newActions };
}

function resolveEquipCard(state: GameState, action: Extract<GameAction, { type: 'EQUIP_CARD' }>): { state: GameState; newActions: GameAction[] } {
  const player = findPlayer(state, action.playerId)!;
  const newActions: GameAction[] = [];

  const cardIdx = player.hand.findIndex(c => c.instanceId === action.cardId);
  if (cardIdx === -1) return { state, newActions };
  const [card] = player.hand.splice(cardIdx, 1);

  if (!card.equipSlot) return { state, newActions };

  // Unequip existing item from the same slot and return to hand
  const existing = player.equipment[card.equipSlot];
  if (existing) {
    player.hand.push(existing);
  }

  // Equip new item
  player.equipment[card.equipSlot] = card;

  return { state, newActions };
}

function resolveDiscardCard(state: GameState, action: Extract<GameAction, { type: 'DISCARD_CARD' }>): { state: GameState; newActions: GameAction[] } {
  const player = findPlayer(state, action.playerId)!;
  const newActions: GameAction[] = [];

  const cardIdx = player.hand.findIndex(c => c.instanceId === action.cardId);
  if (cardIdx === -1) return { state, newActions };
  const [card] = player.hand.splice(cardIdx, 1);
  state.discardPile.push(card);

  // Check if discard phase is complete (hand <= hp)
  if (state.currentTurnPhase === 'discard' && player.hand.length <= player.hp) {
    // Auto-end turn
    return resolveEndTurn(state, { type: 'END_TURN', playerId: action.playerId });
  }

  return { state, newActions };
}

function resolveEndPhase(state: GameState, action: Extract<GameAction, { type: 'END_PHASE' }>): { state: GameState; newActions: GameAction[] } {
  const newActions: GameAction[] = [];

  // Move from play phase to discard phase
  if (state.currentTurnPhase === 'play') {
    state.currentTurnPhase = 'discard';
    const player = findPlayer(state, action.playerId)!;
    if (player.hand.length > player.hp) {
      // Player needs to discard - don't auto-resolve, wait for player input
      // The UI will prompt the player to discard
    } else {
      // Auto-end turn since no discard needed
      return resolveEndTurn(state, { type: 'END_TURN', playerId: action.playerId });
    }
  }

  return { state, newActions };
}

function resolveEndTurn(state: GameState, action: Extract<GameAction, { type: 'END_TURN' }>): { state: GameState; newActions: GameAction[] } {
  const newActions: GameAction[] = [];

  // Reset current player's turn flags
  const currentId = state.turnOrder[state.currentPlayerIndex];
  const player = findPlayer(state, currentId);
  if (player) {
    player.shaUsedThisTurn = false;
    player.jiuUsedThisTurn = false;
    player.isIntoxicated = false;
    player.luoyiBonus = 0;
    player.tieqiActive = false;
  }

  // Advance to next alive player
  const count = state.turnOrder.length;
  let nextIdx = (state.currentPlayerIndex + 1) % count;
  let found = false;
  for (let i = 0; i < count; i++) {
    const nextId = state.turnOrder[nextIdx];
    const nextPlayer = findPlayer(state, nextId);
    if (nextPlayer && nextPlayer.aliveStatus !== 'dead') {
      found = true;
      break;
    }
    nextIdx = (nextIdx + 1) % count;
  }

  if (!found) {
    // All other players are dead — check victory immediately
    const winner = checkVictory(state);
    if (winner) {
      state.winner = winner;
      state.gamePhase = 'finished';
    }
    return { state, newActions };
  }

  if (nextIdx <= state.currentPlayerIndex) {
    state.roundNumber++;
  }

  state.currentPlayerIndex = nextIdx;
  state.turnNumber++;
  state.currentTurnPhase = 'judge';

  const newPlayerId = state.turnOrder[nextIdx];
  const newPlayer = findPlayer(state, newPlayerId);
  newActions.push({ type: 'TURN_START', playerId: newPlayerId });

  // Judge phase: resolve delayed tools in judgment area
  if (newPlayer && newPlayer.judgmentArea.length > 0) {
    let skipDraw = false;
    let skipPlay = false;

    for (const tool of [...newPlayer.judgmentArea]) {
      // Flip top card for judgment
      if (state.deck.length === 0) {
        state.deck = shuffleDeck(state.discardPile);
        state.discardPile = [];
      }
      if (state.deck.length === 0) continue; // No cards to judge with

      const judgeCard = state.deck.pop()!;
      state.discardPile.push(judgeCard);
      const suit = judgeCard.suit;
      const rank = judgeCard.rankNumber;

      // Remove tool from judgment area (judged)
      const toolIdx = newPlayer.judgmentArea.findIndex(c => c.instanceId === tool.instanceId);
      if (toolIdx !== -1) {
        const [removed] = newPlayer.judgmentArea.splice(toolIdx, 1);
        state.discardPile.push(removed);
      }

      switch (tool.subtype) {
        case 'lebu_sishu':
          // 乐不思蜀: if judgment is NOT heart, skip play phase
          if (suit !== 'heart') {
            skipPlay = true;
          }
          break;
        case 'bingliang_cunduan':
          // 兵粮寸断: if judgment is NOT club, skip draw phase
          if (suit !== 'club') {
            skipDraw = true;
          }
          break;
        case 'shandian':
          // 闪电: if judgment is spade 2-9, take 3 thunder damage; otherwise move to next player
          if (suit === 'spade' && rank >= 2 && rank <= 9) {
            newActions.push({ type: 'DEAL_DAMAGE', sourceId: 'system', targetId: newPlayerId, amount: 3, element: 'thunder' });
          } else {
            // Move 闪电 to next player's judgment area
            const nextAliveIdx = (nextIdx + 1) % count;
            let moveTargetIdx = nextAliveIdx;
            for (let i = 0; i < count; i++) {
              const checkIdx = (nextIdx + 1 + i) % count;
              const checkPlayer = findPlayer(state, state.turnOrder[checkIdx]);
              if (checkPlayer && checkPlayer.aliveStatus !== 'dead') {
                moveTargetIdx = checkIdx;
                break;
              }
            }
            const moveTarget = findPlayer(state, state.turnOrder[moveTargetIdx]);
            if (moveTarget) {
              moveTarget.judgmentArea.push(tool);
              // Remove from discard (was added above)
              const dpIdx = state.discardPile.findIndex(c => c.instanceId === tool.instanceId);
              if (dpIdx !== -1) state.discardPile.splice(dpIdx, 1);
            }
          }
          break;
      }
    }

    if (skipPlay) {
      // Skip play phase entirely → go to discard phase
      state.currentTurnPhase = 'discard';
      if (!newPlayer || newPlayer.hand.length <= newPlayer.hp) {
        return resolveEndTurn(state, { type: 'END_TURN', playerId: newPlayerId });
      }
      return { state, newActions };
    }
    if (skipDraw && !skipPlay) {
      // Skip draw phase → go directly to play
      state.currentTurnPhase = 'play';
      return { state, newActions };
    }
  }

  // Draw phase: auto draw 2 cards (unless skipped by 兵粮寸断)
  newActions.push({ type: 'DRAW_CARDS', playerId: newPlayerId, count: 2 });

  // Auto-advance to play phase after drawing
  newActions.push({ type: 'PHASE_CHANGE', phase: 'play' });

  return { state, newActions };
}

function resolveRespond(state: GameState, action: Extract<GameAction, { type: 'RESPOND' }>): { state: GameState; newActions: GameAction[] } {
  const player = findPlayer(state, action.playerId)!;
  const newActions: GameAction[] = [];
  const pending = state.pendingAction;

  // Remove played cards from hand
  for (const cardId of action.cardIds) {
    const idx = player.hand.findIndex(c => c.instanceId === cardId);
    if (idx !== -1) {
      const [card] = player.hand.splice(idx, 1);
      state.discardPile.push(card);
    }
  }

  // 无双 (wushuang): target needs 2 responses
  if (pending?.extra?.wushuangRequired) {
    const responded = ((pending.extra.wushuangResponded as number) || 0) + 1;
    if (responded < 2) {
      const neededType = pending.type === 'respond_to_sha' ? 'shan' : 'sha';
      const nextValid = getValidResponseCards(state, action.playerId, neededType);
      state.pendingAction = {
        ...pending,
        validResponseCards: nextValid,
        extra: { ...pending.extra, wushuangResponded: responded },
      };
      return { state, newActions };
    }
  }

  // 咆哮 (paoxiao): when 张飞's 杀 is dodged, draw 1 card
  if (pending?.type === 'respond_to_sha' && pending.extra?.shaSourceId) {
    const shaSource = findPlayer(state, pending.extra.shaSourceId as string);
    if (shaSource && playerHasSkill(state, shaSource.id, 'paoxiao')) {
      newActions.push({ type: 'DRAW_CARDS', playerId: shaSource.id, count: 1 });
    }
  }

  // 决斗 chain: after responding with 杀, swap roles
  if (pending?.type === 'respond_to_juedou' && pending.extra?.juedouChain) {
    const otherPlayerId = pending.extra.lastResponderId as string;
    const otherPlayer = findPlayer(state, otherPlayerId);
    if (otherPlayer && otherPlayer.aliveStatus !== 'dead') {
      const isWushuang = playerHasSkill(state, otherPlayerId, 'wushuang');
      const otherSha = getValidResponseCards(state, otherPlayerId, 'sha');
      const jdSourceId = pending.extra.jdSourceId as string || pending.extra.lastResponderId as string;
      state.pendingAction = {
        type: 'respond_to_juedou',
        playerId: otherPlayerId,
        sourceCardId: pending.sourceCardId,
        validResponseCards: otherSha,
        timeoutAction: { type: 'DEAL_DAMAGE', sourceId: action.playerId, targetId: otherPlayerId, amount: 1 },
        extra: { juedouChain: true, lastResponderId: action.playerId, wushuangRequired: isWushuang, wushuangResponded: 0, jdSourceId },
      };
    } else {
      state.pendingAction = null;
    }
    return { state, newActions };
  }

  // AOE chain: move to next responder
  if (pending?.extra?.aoeType) {
    const remaining = (pending.extra.remainingResponderIds as string[]) || [];
    if (remaining.length > 0) {
      const nextId = remaining[0];
      const nextPlayer = findPlayer(state, nextId);
      if (nextPlayer && nextPlayer.aliveStatus !== 'dead') {
        const validCards = pending.type === 'respond_to_nanman'
          ? getValidResponseCards(state, nextId, 'sha')
          : getValidResponseCards(state, nextId, 'shan');
        state.pendingAction = {
          type: pending.type as 'respond_to_nanman' | 'respond_to_wanjian',
          playerId: nextId,
          sourceCardId: pending.sourceCardId,
          validResponseCards: validCards,
          timeoutAction: { type: 'DEAL_DAMAGE', sourceId: pending.extra!.sourceId as string, targetId: nextId, amount: 1 },
          extra: { aoeType: pending.extra.aoeType, sourceId: pending.extra.sourceId, remainingResponderIds: remaining.slice(1) },
        };
        return { state, newActions };
      }
    }
    state.pendingAction = null;
    return { state, newActions };
  }

  // Default: clear pending action
  state.pendingAction = null;
  return { state, newActions };
}

function resolvePassResponse(state: GameState, action: Extract<GameAction, { type: 'PASS_RESPONSE' }>): { state: GameState; newActions: GameAction[] } {
  const newActions: GameAction[] = [];
  const pending = state.pendingAction;
  if (!pending) return { state, newActions };

  // 无双 pass: if player responded to some but not all, still take damage
  if (pending.extra?.wushuangRequired) {
    const responded = (pending.extra.wushuangResponded as number) || 0;
    if (responded > 0) {
      newActions.push(pending.timeoutAction);
    }
    // Continue to handle juedou/aoe/default below
    if (pending.type !== 'respond_to_juedou' && !pending.extra?.aoeType) {
      state.pendingAction = null;
      return { state, newActions };
    }
  }

  // 决斗 pass: the passer takes damage from the last 杀 player
  if (pending.type === 'respond_to_juedou' && pending.extra?.juedouChain) {
    const sourceId = (pending.extra.lastResponderId as string) || (pending.timeoutAction as { sourceId: string }).sourceId;
    newActions.push({ type: 'DEAL_DAMAGE', sourceId, targetId: action.playerId, amount: 1 });
    state.pendingAction = null;
    return { state, newActions };
  }

  // AOE pass: take damage, then move to next responder
  if (pending.extra?.aoeType) {
    newActions.push(pending.timeoutAction);
    const remaining = (pending.extra.remainingResponderIds as string[]) || [];
    if (remaining.length > 0) {
      const nextId = remaining[0];
      const nextPlayer = findPlayer(state, nextId);
      if (nextPlayer && nextPlayer.aliveStatus !== 'dead') {
        const validCards = pending.type === 'respond_to_nanman'
          ? getValidResponseCards(state, nextId, 'sha')
          : getValidResponseCards(state, nextId, 'shan');
        state.pendingAction = {
          type: pending.type as 'respond_to_nanman' | 'respond_to_wanjian',
          playerId: nextId,
          sourceCardId: pending.sourceCardId,
          validResponseCards: validCards,
          timeoutAction: { type: 'DEAL_DAMAGE', sourceId: pending.extra!.sourceId as string, targetId: nextId, amount: 1 },
          extra: { aoeType: pending.extra.aoeType, sourceId: pending.extra.sourceId, remainingResponderIds: remaining.slice(1) },
        };
      } else {
        state.pendingAction = null;
      }
    } else {
      state.pendingAction = null;
    }
    return { state, newActions };
  }

  // Default: execute timeout action and clear pending
  newActions.push(pending.timeoutAction);
  state.pendingAction = null;
  return { state, newActions };
}

function resolvePlayWuxie(state: GameState, action: Extract<GameAction, { type: 'PLAY_WUXIE' }>): { state: GameState; newActions: GameAction[] } {
  const player = findPlayer(state, action.playerId)!;
  const newActions: GameAction[] = [];

  const cardIdx = player.hand.findIndex(c => c.instanceId === action.cardId);
  if (cardIdx === -1) return { state, newActions };
  const [card] = player.hand.splice(cardIdx, 1);
  state.discardPile.push(card);

  const pending = state.pendingAction;

  if (pending?.type === 'wuxie_opportunity') {
    // First wuxie played against the original tool — enter wuxie chain
    state.pendingAction = {
      type: 'respond_to_wuxie_chain',
      playerId: '',
      timeoutAction: { type: 'PASS_WUXIE', playerId: action.playerId },
      extra: {
        wuxieCancels: true,
        originalTool: pending.extra,
      },
    };
  } else if (pending?.type === 'respond_to_wuxie_chain') {
    // Counter-wuxie: toggle whether the tool gets cancelled
    const currentCancels = (pending.extra?.wuxieCancels as boolean) ?? true;
    state.pendingAction = {
      type: 'respond_to_wuxie_chain',
      playerId: '',
      timeoutAction: { type: 'PASS_WUXIE', playerId: action.playerId },
      extra: {
        wuxieCancels: !currentCancels,
        originalTool: pending.extra?.originalTool,
      },
    };
  }

  return { state, newActions };
}

function resolvePassWuxie(state: GameState, _action: Extract<GameAction, { type: 'PASS_WUXIE' }>): { state: GameState; newActions: GameAction[] } {
  const newActions: GameAction[] = [];
  const pending = state.pendingAction;
  if (!pending) return { state, newActions };

  if (pending.type === 'wuxie_opportunity') {
    // No wuxie was played — execute the deferred tool effect
    const extra = pending.extra || {};
    const toolSubtype = extra.toolSubtype as string;
    const toolTargets = (extra.toolTargets as string[]) || [];
    const toolPlayerId = (extra.toolPlayerId as string) || _action.playerId;
    const cardInstanceId = extra.cardInstanceId as string | undefined;
    state.pendingAction = null;
    const result = applyDeferredToolEffect(state, toolPlayerId, toolSubtype, toolTargets, cardInstanceId);
    return { state: result.state, newActions: [...newActions, ...result.newActions] };
  }

  if (pending.type === 'respond_to_wuxie_chain') {
    const wuxieCancels = (pending.extra?.wuxieCancels as boolean) ?? true;
    if (wuxieCancels) {
      // Last wuxie stands — original tool is negated, just clear pending
      state.pendingAction = null;
    } else {
      // Last wuxie was countered — original tool proceeds
      const originalTool = pending.extra?.originalTool as Record<string, unknown> | undefined;
      if (originalTool) {
        const toolSubtype = originalTool.toolSubtype as string;
        const toolTargets = (originalTool.toolTargets as string[]) || [];
        const toolPlayerId = (originalTool.toolPlayerId as string) || _action.playerId;
        const cardInstanceId = originalTool.cardInstanceId as string | undefined;
        state.pendingAction = null;
        const result = applyDeferredToolEffect(state, toolPlayerId, toolSubtype, toolTargets, cardInstanceId);
        return { state: result.state, newActions: [...newActions, ...result.newActions] };
      }
      state.pendingAction = null;
    }
    return { state, newActions };
  }

  return { state, newActions };
}

function resolveUseTaoSelf(state: GameState, action: Extract<GameAction, { type: 'USE_TAO_SELF' }>): { state: GameState; newActions: GameAction[] } {
  const player = findPlayer(state, action.playerId)!;
  const newActions: GameAction[] = [];

  const cardIdx = player.hand.findIndex(c => c.instanceId === action.cardId);
  if (cardIdx === -1) return { state, newActions };
  const [card] = player.hand.splice(cardIdx, 1);
  state.discardPile.push(card);

  player.hp = Math.min(player.hp + 1, player.maxHp);
  if (player.aliveStatus === 'dying') {
    player.aliveStatus = 'alive';
  }

  return { state, newActions };
}

function resolveUseTaoOther(state: GameState, action: Extract<GameAction, { type: 'USE_TAO_OTHER' }>): { state: GameState; newActions: GameAction[] } {
  const player = findPlayer(state, action.playerId)!;
  const target = findPlayer(state, action.targetId)!;
  const newActions: GameAction[] = [];

  const cardIdx = player.hand.findIndex(c => c.instanceId === action.cardId);
  if (cardIdx === -1) return { state, newActions };
  const [card] = player.hand.splice(cardIdx, 1);
  state.discardPile.push(card);

  // 救援 (Sun Quan): Wu allies' 桃 on ruler heals +1 extra
  let healAmount = 1;
  if (playerHasSkill(state, target.id, 'jiuyuan') && target.identity === 'ruler' && player.kingdom === 'wu') {
    healAmount = 2;
  }

  target.hp = Math.min(target.hp + healAmount, target.maxHp);
  if (target.aliveStatus === 'dying') {
    target.aliveStatus = 'alive';
  }

  return { state, newActions };
}

function resolveJudgeBaguazhen(state: GameState, action: Extract<GameAction, { type: 'JUDGE_BAGUAZHEN' }>): { state: GameState; newActions: GameAction[] } {
  const newActions: GameAction[] = [];
  const pending = state.pendingAction;
  if (!pending || pending.type !== 'respond_to_sha') return { state, newActions };

  // Flip top card for judgment
  if (state.deck.length === 0) {
    state.deck = shuffleDeck(state.discardPile);
    state.discardPile = [];
  }
  if (state.deck.length === 0) return { state, newActions };

  const judgeCard = state.deck.pop()!;
  state.discardPile.push(judgeCard);

  // 八卦阵: red suit = success (treats as 闪)
  if (judgeCard.suit === 'heart' || judgeCard.suit === 'diamond') {
    state.pendingAction = null;
  } else {
    // Failed: player still needs to play 闪 or take damage
    if (pending.extra) {
      pending.extra.hasBaguazhen = false;
    }
  }

  return { state, newActions };
}

function resolveSelectTargetCard(state: GameState, action: Extract<GameAction, { type: 'SELECT_TARGET_CARD' }>): { state: GameState; newActions: GameAction[] } {
  const newActions: GameAction[] = [];
  const pending = state.pendingAction;
  if (!pending) return { state, newActions };

  const target = findPlayer(state, action.targetPlayerId);
  if (!target) return { state, newActions };

  // Find the selected card in target's hand or equipment
  let foundCard: GameCard | undefined;
  const handIdx = target.hand.findIndex(c => c.instanceId === action.cardId);
  if (handIdx !== -1) {
    const [card] = target.hand.splice(handIdx, 1);
    foundCard = card;
  } else {
    for (const slot of ['weapon', 'armor', 'plusHorse', 'minusHorse'] as const) {
      if (target.equipment[slot]?.instanceId === action.cardId) {
        foundCard = target.equipment[slot]!;
        target.equipment[slot] = null;
        break;
      }
    }
  }

  if (!foundCard) return { state, newActions };

  if (pending.type === 'pick_card_to_discard') {
    state.discardPile.push(foundCard);
  } else if (pending.type === 'pick_card_to_steal') {
    const player = findPlayer(state, action.playerId);
    if (player) player.hand.push(foundCard);
  }

  state.pendingAction = null;
  return { state, newActions };
}

function resolvePickWuguCard(state: GameState, action: Extract<GameAction, { type: 'PICK_WUGU_CARD' }>): { state: GameState; newActions: GameAction[] } {
  const newActions: GameAction[] = [];
  const pending = state.pendingAction;
  if (!pending || pending.type !== 'wugu_pick_card') return { state, newActions };

  const allWuguCards = (pending.extra?.wuguCards as GameCard[]) || [];
  const pickedCard = allWuguCards.find(c => c.instanceId === action.cardId);
  if (!pickedCard) return { state, newActions };

  const remainingCards = allWuguCards.filter(c => c.instanceId !== action.cardId);
  const player = findPlayer(state, action.playerId);
  if (player) player.hand.push(pickedCard);

  const remainingPlayerIds = (pending.extra?.remainingPlayerIds as string[]) || [];

  if (remainingPlayerIds.length > 0 && remainingCards.length > 0) {
    // Next player picks
    const nextPlayerId = remainingPlayerIds[0];
    state.pendingAction = {
      type: 'wugu_pick_card',
      playerId: nextPlayerId,
      timeoutAction: { type: 'DISCARD_CARD', playerId: nextPlayerId, cardId: '' },
      extra: {
        wuguCards: remainingCards,
        remainingPlayerIds: remainingPlayerIds.slice(1),
        sourceId: pending.extra?.sourceId,
      },
    };
  } else {
    // All picked or no more cards: discard any remaining
    if (remainingCards.length > 0) {
      state.discardPile.push(...remainingCards);
    }
    state.pendingAction = null;
  }

  return { state, newActions };
}

function resolveJiedaoAttack(state: GameState, action: Extract<GameAction, { type: 'JIEDAO_ATTACK' }>): { state: GameState; newActions: GameAction[] } {
  const newActions: GameAction[] = [];
  const pending = state.pendingAction;
  if (!pending || pending.type !== 'jiedao_sharen_choice') return { state, newActions };

  const player = findPlayer(state, action.playerId);
  if (!player) return { state, newActions };

  // Find and use a 杀 from target's hand
  const shaCard = player.hand.find(c => c.subtype === 'sha');
  if (!shaCard) return { state, newActions };

  const shaIdx = player.hand.findIndex(c => c.instanceId === shaCard.instanceId);
  player.hand.splice(shaIdx, 1);
  state.discardPile.push(shaCard);
  player.shaUsedThisTurn = true;

  const attackTarget = findPlayer(state, action.targetId);
  if (attackTarget && attackTarget.aliveStatus !== 'dead') {
    const validShan = getValidResponseCards(state, attackTarget.id, 'shan');
    state.pendingAction = {
      type: 'respond_to_sha',
      playerId: action.targetId,
      sourceCardId: shaCard.instanceId,
      validResponseCards: validShan,
      timeoutAction: { type: 'DEAL_DAMAGE', sourceId: action.playerId, targetId: action.targetId, amount: 1 },
      extra: { hasBaguazhen: attackTarget.equipment.armor?.subtype === 'baguazhen' },
    };
  } else {
    state.pendingAction = null;
  }

  return { state, newActions };
}

function resolveJiedaoGiveWeapon(state: GameState, action: Extract<GameAction, { type: 'JIEDAO_GIVE_WEAPON' }>): { state: GameState; newActions: GameAction[] } {
  const newActions: GameAction[] = [];
  const pending = state.pendingAction;
  if (!pending || pending.type !== 'jiedao_sharen_choice') return { state, newActions };

  const sourceId = pending.extra?.sourceId as string;
  const target = findPlayer(state, action.playerId);
  const source = sourceId ? findPlayer(state, sourceId) : null;

  if (target?.equipment.weapon && source) {
    source.hand.push(target.equipment.weapon);
    target.equipment.weapon = null;
  }

  state.pendingAction = null;
  return { state, newActions };
}

function resolveUseSkill(state: GameState, action: Extract<GameAction, { type: 'USE_SKILL' }>): { state: GameState; newActions: GameAction[] } {
  const skill = getSkill(action.skillId);
  if (!skill) return { state, newActions: [] };

  const result = executeSkill(state, action.playerId, action.skillId, null);
  return { state: result.state, newActions: result.actions };
}

function resolveDrawCards(state: GameState, action: Extract<GameAction, { type: 'DRAW_CARDS' }>): { state: GameState; newActions: GameAction[] } {
  const player = findPlayer(state, action.playerId)!;
  const newActions: GameAction[] = [];

  const { drawnCards, newDeck, newDiscardPile } = drawCards(
    state.deck, state.discardPile, action.count
  );

  state.deck = newDeck;
  state.discardPile = newDiscardPile;
  player.hand.push(...drawnCards);

  return { state, newActions };
}

function resolveDealDamage(state: GameState, action: Extract<GameAction, { type: 'DEAL_DAMAGE' }>): { state: GameState; newActions: GameAction[] } {
  const target = findPlayer(state, action.targetId)!;
  const newActions: GameAction[] = [];

  const applyDamage = (p: typeof target) => {
    p.hp -= action.amount;
    if (p.hp <= 0) {
      p.hp = 0;
      p.aliveStatus = 'dying';
      newActions.push({ type: 'ENTER_DYING', playerId: p.id });
    }
  };

  applyDamage(target);

  // 铁索连环: fire/thunder damage propagates to all chained players
  if (action.element === 'fire' || action.element === 'thunder') {
    const chainedPlayers = state.players.filter(
      p => p.aliveStatus !== 'dead' && p.isChainLinked && p.id !== action.targetId
    );
    for (const cp of chainedPlayers) {
      applyDamage(cp);
      cp.isChainLinked = false;
    }
    // Unchain original target
    target.isChainLinked = false;
  }

  return { state, newActions };
}

function resolveHealHp(state: GameState, action: Extract<GameAction, { type: 'HEAL_HP' }>): { state: GameState; newActions: GameAction[] } {
  const player = findPlayer(state, action.playerId)!;
  player.hp = Math.min(player.hp + action.amount, player.maxHp);
  if (player.aliveStatus === 'dying') {
    player.aliveStatus = 'alive';
  }
  return { state, newActions: [] };
}

function resolveEnterDying(state: GameState, action: Extract<GameAction, { type: 'ENTER_DYING' }>): { state: GameState; newActions: GameAction[] } {
  const player = findPlayer(state, action.playerId)!;
  const newActions: GameAction[] = [];

  player.aliveStatus = 'dying';
  // Set up pending action for saving (桃 can be played by anyone)
  state.pendingAction = {
    type: 'use_tao_dying',
    playerId: action.playerId,
    timeoutAction: { type: 'PLAYER_DIED', playerId: action.playerId },
  };

  return { state, newActions };
}

function resolvePlayerDied(state: GameState, action: Extract<GameAction, { type: 'PLAYER_DIED' }>): { state: GameState; newActions: GameAction[] } {
  const player = findPlayer(state, action.playerId)!;
  const newActions: GameAction[] = [];

  player.aliveStatus = 'dead';
  player.identityRevealed = true;

  // Discard all cards from hand, equipment, and judgment area
  const allCards = [
    ...player.hand,
    ...Object.values(player.equipment).filter(Boolean) as GameCard[],
    ...player.judgmentArea,
  ];
  state.discardPile.push(...allCards);

  player.hand = [];
  player.equipment = { weapon: null, armor: null, plusHorse: null, minusHorse: null };
  player.judgmentArea = [];

  // Death rewards:
  // If killed by a rebel, the killer draws 3 cards
  // If ruler kills a loyalist, ruler discards all cards

  newActions.push({ type: 'CHECK_VICTORY' });

  return { state, newActions };
}

function resolveDiscardAllCards(state: GameState, action: Extract<GameAction, { type: 'DISCARD_ALL_CARDS' }>): { state: GameState; newActions: GameAction[] } {
  const player = findPlayer(state, action.playerId)!;
  const allCards = [
    ...player.hand,
    ...Object.values(player.equipment).filter(Boolean) as GameCard[],
  ];
  state.discardPile.push(...allCards);
  player.hand = [];
  player.equipment = { weapon: null, armor: null, plusHorse: null, minusHorse: null };
  return { state, newActions: [] };
}

function resolveDestroyEquipment(state: GameState, action: Extract<GameAction, { type: 'DESTROY_EQUIPMENT' }>): { state: GameState; newActions: GameAction[] } {
  const player = findPlayer(state, action.playerId)!;
  const slot = action.slot as keyof typeof player.equipment;
  const equip = player.equipment[slot];
  if (equip) {
    state.discardPile.push(equip);
    player.equipment[slot] = null;
  }
  return { state, newActions: [] };
}

function resolvePhaseChange(state: GameState, action: Extract<GameAction, { type: 'PHASE_CHANGE' }>): { state: GameState; newActions: GameAction[] } {
  state.currentTurnPhase = action.phase as GameState['currentTurnPhase'];
  return { state, newActions: [] };
}

function resolveRecastCard(state: GameState, action: Extract<GameAction, { type: 'RECAST_CARD' }>): { state: GameState; newActions: GameAction[] } {
  const player = findPlayer(state, action.playerId)!;
  const newActions: GameAction[] = [];

  const cardIdx = player.hand.findIndex(c => c.instanceId === action.cardId);
  if (cardIdx === -1) return { state, newActions };
  const [card] = player.hand.splice(cardIdx, 1);
  state.discardPile.push(card);

  // Draw 1 card
  newActions.push({ type: 'DRAW_CARDS', playerId: action.playerId, count: 1 });

  return { state, newActions };
}

function resolvePassSaveDying(state: GameState, _action: Extract<GameAction, { type: 'PASS_SAVE_DYING' }>): { state: GameState; newActions: GameAction[] } {
  const pending = state.pendingAction;
  if (!pending || pending.type !== 'use_tao_dying') return { state, newActions: [] };

  // Dying player gave up — execute death
  state.pendingAction = null;
  const newActions: GameAction[] = [
    { type: 'PLAYER_DIED', playerId: pending.playerId },
  ];

  return { state, newActions };
}

function resolveCheckVictory(state: GameState): { state: GameState; newActions: GameAction[] } {
  const winner = checkVictory(state);
  if (winner) {
    state.winner = winner;
    state.gamePhase = 'finished';
  }
  return { state, newActions: [] };
}

function resolveSelectCharacter(state: GameState, action: Extract<GameAction, { type: 'SELECT_CHARACTER' }>): { state: GameState; newActions: GameAction[] } {
  const player = findPlayer(state, action.playerId);
  if (!player) return { state, newActions: [] };

  const charInfo = getCharacterInfo(action.characterId);
  if (!charInfo) return { state, newActions: [] };

  player.characterId = charInfo.id;
  player.characterName = charInfo.name;
  player.kingdom = charInfo.kingdom;
  player.maxHp = charInfo.maxHp + (player.identity === 'ruler' ? 1 : 0);
  player.hp = player.maxHp;

  // If ruler selected, also reveal identity
  if (player.identity === 'ruler') {
    player.identityRevealed = true;
  }

  // Check if all non-dead players have selected
  const alivePlayers = state.players.filter(p => p.aliveStatus !== 'dead');
  const allSelected = alivePlayers.every(p => p.characterId);

  if (allSelected) {
    return resolveStartGame(state);
  }

  return { state, newActions: [] };
}

function resolveStartGame(state: GameState): { state: GameState; newActions: GameAction[] } {
  state.gamePhase = 'playing';
  state.deck = shuffleDeck(buildDeck());
  state.discardPile = [];
  state.currentTurnPhase = 'judge';
  state.currentPlayerIndex = 0;
  state.turnNumber = 1;
  state.roundNumber = 1;

  // Deal initial hands: 4 cards each
  for (const player of state.players) {
    if (player.aliveStatus !== 'dead') {
      player.hand = state.deck.splice(0, Math.min(4, state.deck.length));
    }
  }

  // Kick off first turn: draw 2 then advance to play phase
  const firstPlayerId = state.turnOrder[0];
  return { state, newActions: [
    { type: 'DRAW_CARDS', playerId: firstPlayerId, count: 2 },
    { type: 'PHASE_CHANGE', phase: 'play' },
  ] };
}
