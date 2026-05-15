// ============================================================
// Core game state type definitions
// ============================================================

import type { GameCard } from './cards';
import type { GameAction } from './actions';

export type Identity = 'ruler' | 'loyalist' | 'rebel' | 'spy';
export type TurnPhase = 'judge' | 'draw' | 'play' | 'discard' | 'end';
export type GamePhase = 'lobby' | 'character_select' | 'playing' | 'finished';
export type AliveStatus = 'alive' | 'dying' | 'dead';
export type GameMode = 'hotseat' | 'singleplayer' | 'online';

export interface EquipmentSlots {
  weapon: GameCard | null;
  armor: GameCard | null;
  plusHorse: GameCard | null;
  minusHorse: GameCard | null;
}

export interface PlayerState {
  id: string;
  name: string;
  identity: Identity;
  identityRevealed: boolean;
  characterId: string;
  characterName: string;
  kingdom: string;
  hp: number;
  maxHp: number;
  hand: GameCard[];
  equipment: EquipmentSlots;
  judgmentArea: GameCard[];
  aliveStatus: AliveStatus;
  isAI: boolean;
  // Turn tracking
  shaUsedThisTurn: boolean;
  jiuUsedThisTurn: boolean;
  // Status effects
  isChainLinked: boolean;
  isIntoxicated: boolean;     // 酒 effect: next 杀 does +1 damage
  isTurnedOver: boolean;
  // Skill state
  luoyiBonus: number;          // 裸衣: +damage this turn
  tieqiActive: boolean;        // 铁骑: next sha unblockable
  // Character selection
  selectableCharacters?: string[]; // character IDs available for selection
}

export interface GameConfig {
  mode: GameMode;
  playerNames: string[];
  aiPlayerIndices: number[];  // which players are AI
  deckMultiplier?: number;    // for future expansions
}

export interface PendingAction {
  type: 'respond_to_sha'
    | 'respond_to_juedou'
    | 'respond_to_nanman'
    | 'respond_to_wanjian'
    | 'respond_to_wuxie_chain'
    | 'wuxie_opportunity'
    | 'choose_target'
    | 'choose_card'
    | 'choose_suit'
    | 'use_tao_dying'
    | 'respond_to_shandian'
    | 'pick_card_to_discard'
    | 'pick_card_to_steal'
    | 'jiedao_sharen_choice'
    | 'wugu_pick_card';
  playerId: string;
  sourceCardId?: string;
  validResponseCards?: string[];  // card instance IDs that are valid responses
  timeoutAction: GameAction;      // what happens on pass
  extra?: Record<string, unknown>;
}

export interface ActionLogEntry {
  timestamp: number;
  playerId: string;
  playerName: string;
  action: GameAction;
  description: string;  // human-readable Chinese description
}

export interface GameState {
  gamePhase: GamePhase;
  mode: GameMode;
  config: GameConfig;
  players: PlayerState[];
  turnOrder: string[];          // player IDs in seat order
  currentPlayerIndex: number;
  currentTurnPhase: TurnPhase;
  turnNumber: number;
  roundNumber: number;
  deck: GameCard[];
  discardPile: GameCard[];
  pendingAction: PendingAction | null;
  actionHistory: ActionLogEntry[];
  eventQueue: GameAction[];     // actions waiting to be resolved (for chains)
  winner: Identity | null;
  // Character selection state
  rulerCharacterSelections?: string[]; // extra character options for ruler
  characterSelectionOrder?: string[];  // player IDs in selection order
}

// Create initial empty equipment slots
export function createEmptyEquipment(): EquipmentSlots {
  return { weapon: null, armor: null, plusHorse: null, minusHorse: null };
}

// Create a minimal player state
export function createPlayerState(
  id: string,
  name: string,
  isAI: boolean,
): PlayerState {
  return {
    id,
    name,
    identity: 'rebel', // placeholder, assigned later
    identityRevealed: false,
    characterId: '',
    characterName: '',
    kingdom: '',
    hp: 4,
    maxHp: 4,
    hand: [],
    equipment: createEmptyEquipment(),
    judgmentArea: [],
    aliveStatus: 'alive',
    isAI,
    shaUsedThisTurn: false,
    jiuUsedThisTurn: false,
    isChainLinked: false,
    isIntoxicated: false,
    isTurnedOver: false,
    luoyiBonus: 0,
    tieqiActive: false,
  };
}

// Get alive players
export function getAlivePlayers(state: GameState): PlayerState[] {
  return state.players.filter(p => p.aliveStatus !== 'dead');
}

// Get current player
export function getCurrentPlayer(state: GameState): PlayerState {
  const id = state.turnOrder[state.currentPlayerIndex];
  return state.players.find(p => p.id === id)!;
}

// Check victory conditions
export function checkVictory(state: GameState): Identity | null {
  const alive = getAlivePlayers(state);
  const ruler = alive.find(p => p.identity === 'ruler');
  const rebels = alive.filter(p => p.identity === 'rebel');
  const spies = alive.filter(p => p.identity === 'spy');

  // Ruler wins: all rebels and spies dead
  if (ruler && rebels.length === 0 && spies.length === 0) {
    return 'ruler';
  }
  // Rebel wins: ruler is dead
  if (!ruler) {
    // Spy only wins if they're the last one standing
    if (alive.length === 1 && alive[0].identity === 'spy') {
      return 'spy';
    }
    return 'rebel';
  }
  return null;
}
