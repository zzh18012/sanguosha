// ============================================================
// Debug API — exposed on window.__gameDebug when URL has ?debug=1
// Allows full manipulation of game state for testing purposes
// ============================================================

import type { GameState, PlayerState } from '../types/game';
import type { GameAction } from '../types/actions';
import type { GameCard, CardSuit, CardSubtype, CardRankNumber } from '../types/cards';
import { createCardInstance } from '../types/cards';
import { CARD_DEFINITIONS } from '../data/cardDefinitions';
import { findPlayer } from '../engine/core/GameState';

let _state: GameState | null = null;
let _dispatch: ((action: GameAction) => void) | null = null;
let _validActions: GameAction[] = [];

export function setDebugState(state: GameState) { _state = state; }
export function setDebugDispatch(fn: (action: GameAction) => void) { _dispatch = fn; }
export function setDebugValidActions(actions: GameAction[]) { _validActions = actions; }

// Build a GameCard instance from a definition
function makeCard(subtype: CardSubtype, suit?: CardSuit, rank?: CardRankNumber): GameCard {
  const def = CARD_DEFINITIONS.find(d => d.subtype === subtype && (!suit || d.suit === suit));
  const source = def || CARD_DEFINITIONS[0];
  const card = createCardInstance(source);
  if (suit) card.suit = suit;
  if (rank) { card.rankNumber = rank; card.rankDisplay = rank > 10 ? ['J','Q','K'][rank-11] : String(rank); }
  return card;
}

// ============================================================
// Public API
// ============================================================

export const debugApi = {
  getState(): GameState | null { return _state; },
  getValidActions(): GameAction[] { return _validActions; },

  dispatch(action: GameAction) {
    if (!_dispatch) throw new Error('Debug not initialized');
    _dispatch(action);
  },

  // --- Player queries ---
  getPlayer(playerIdOrName: string): PlayerState | null {
    return _state ? findPlayer(_state, playerIdOrName) : null;
  },

  getCurrentPlayer(): PlayerState | null {
    if (!_state) return null;
    return _state.players.find(p => p.id === _state!.turnOrder[_state!.currentPlayerIndex]) || null;
  },

  getHumanPlayer(): PlayerState | null {
    return _state?.players.find(p => !p.isAI) || null;
  },

  // --- Hand manipulation ---
  setHand(playerId: string, cards: GameCard[]) {
    if (!_state) return;
    const player = findPlayer(_state, playerId);
    if (!player) return;
    player.hand = cards;
  },

  addCard(playerId: string, subtype: CardSubtype, suit?: CardSuit, rank?: CardRankNumber) {
    if (!_state) return;
    const player = findPlayer(_state, playerId);
    if (!player) return;
    player.hand.push(makeCard(subtype, suit, rank));
  },

  clearHand(playerId: string) {
    if (!_state) return;
    const player = findPlayer(_state, playerId);
    if (player) player.hand = [];
  },

  // Give a specific set of cards
  giveCards(playerId: string, subtypes: CardSubtype[]) {
    if (!_state) return;
    const player = findPlayer(_state, playerId);
    if (!player) return;
    player.hand = subtypes.map(s => makeCard(s));
  },

  // --- HP manipulation ---
  setHp(playerId: string, hp: number) {
    if (!_state) return;
    const player = findPlayer(_state, playerId);
    if (!player) return;
    player.hp = Math.min(hp, player.maxHp);
  },

  damage(playerId: string, amount: number) {
    if (!_state) return;
    const player = findPlayer(_state, playerId);
    if (!player) return;
    player.hp = Math.max(0, player.hp - amount);
  },

  // --- Equipment manipulation ---
  equip(playerId: string, subtype: CardSubtype) {
    if (!_state) return;
    const player = findPlayer(_state, playerId);
    if (!player) return;
    const card = makeCard(subtype);
    const slot = card.equipSlot;
    if (slot) player.equipment[slot] = card;
  },

  // --- State manipulation ---
  setPhase(phase: string) {
    if (!_state) return;
    (window as any).__gameDebug.dispatch({ type: 'PHASE_CHANGE', phase });
  },

  // Force trigger dying on a player
  triggerDying(playerId: string) {
    if (!_state || !_dispatch) return;
    _dispatch({ type: 'ENTER_DYING', playerId });
  },

  // --- Bulk actions ---
  endTurn() {
    if (!_dispatch) return;
    _dispatch({ type: 'END_PHASE', playerId: this.getCurrentPlayer()?.id || '' });
  },

  // For direct state mutation in tests (bypass dispatch)
  mutateState(fn: (state: GameState) => void) {
    if (_state) fn(_state);
  },

  // --- Card factory ---
  createCard(subtype: CardSubtype, suit?: CardSuit, rank?: CardRankNumber): GameCard {
    return makeCard(subtype, suit, rank);
  },

  // --- Bulk card types for testing ---
  ALL_BASIC: ['sha', 'shan', 'tao', 'jiu'] as CardSubtype[],
  ALL_TOOLS: ['guohe_chaiqiao', 'shunshou_qianyang', 'wuzhong_shengyou', 'wuxie_keji',
    'juedou', 'nanman_ruqin', 'wanjian_qifa', 'taoyuan_jieyi', 'wugu_fengdeng',
    'jiedao_sharen', 'tiesuo_lianhuan',
    'lebu_sishu', 'bingliang_cunduan', 'shandian'] as CardSubtype[],
  ALL_WEAPONS: ['zhugeliannu', 'qinggangjian', 'zhangbashemao', 'guanshifu',
    'qinglongyanyuedao', 'qilingong', 'hanbingjian', 'gudingdao'] as CardSubtype[],
  ALL_ARMOR: ['baguazhen', 'renwangdun', 'tengjia'] as CardSubtype[],
  ALL_PLUS_HORSES: ['dilu', 'dawan', 'zhuahuangfeidian'] as CardSubtype[],
  ALL_MINUS_HORSES: ['chitu', 'jueying', 'diangongli'] as CardSubtype[],
  ALL_EQUIPMENT: [] as CardSubtype[],
};

// Initialize equipment list
debugApi.ALL_EQUIPMENT = [
  ...debugApi.ALL_WEAPONS, ...debugApi.ALL_ARMOR,
  ...debugApi.ALL_PLUS_HORSES, ...debugApi.ALL_MINUS_HORSES,
];

// ============================================================
// Install on window
// ============================================================
if (typeof window !== 'undefined') {
  (window as any).__gameDebug = debugApi;
}
