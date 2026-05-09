// ============================================================
// GameState factory, clone, and initialization
// ============================================================

import type { GameState, GameConfig, PlayerState, GamePhase } from '../../types/game';
import { createPlayerState, type Identity } from '../../types/game';
import { buildDeck, shuffleDeck } from './DeckFactory';

let nextPlayerId = 0;

function generatePlayerId(): string {
  return `player_${nextPlayerId++}`;
}

// Assign identities based on player count
function assignIdentities(playerCount: number): Identity[] {
  // 2 players: ruler vs rebel
  // 3 players: ruler, loyalist, rebel
  // 4 players: ruler, loyalist, rebel, spy
  // 5+ players: ruler, loyalists, rebels, spy
  switch (playerCount) {
    case 2:
      return ['ruler', 'rebel'];
    case 3:
      return ['ruler', 'loyalist', 'rebel'];
    case 4:
      return ['ruler', 'loyalist', 'rebel', 'spy'];
    case 5:
      return ['ruler', 'loyalist', 'rebel', 'rebel', 'spy'];
    case 6:
      return ['ruler', 'loyalist', 'rebel', 'rebel', 'rebel', 'spy'];
    case 7:
      return ['ruler', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'spy'];
    case 8:
      return ['ruler', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'rebel', 'spy'];
    default:
      // For > 8 players, scale proportionally
      const count = playerCount;
      const rebels = Math.floor(count * 0.4);
      const loyalists = Math.max(1, Math.floor(count * 0.3));
      const result: Identity[] = ['ruler'];
      for (let i = 0; i < loyalists; i++) result.push('loyalist');
      for (let i = 0; i < rebels; i++) result.push('rebel');
      if (count > 3) result.push('spy');
      while (result.length < count) result.push('rebel');
      return result.slice(0, count);
  }
}

// Fisher-Yates shuffle (in-place, returns the array)
export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createInitialState(config: GameConfig): GameState {
  const playerCount = config.playerNames.length;
  const identities = shuffleArray(assignIdentities(playerCount));

  // Ruler is always the first player (seat 0)
  const rulerIndex = identities.indexOf('ruler');
  if (rulerIndex > 0) {
    // Swap ruler to position 0
    [identities[0], identities[rulerIndex]] = [identities[rulerIndex], identities[0]];
    // Also swap player names for consistency
    const names = [...config.playerNames];
    [names[0], names[rulerIndex]] = [names[rulerIndex], names[0]];
    config.playerNames = names;
    // Update AI indices after swap
    config.aiPlayerIndices = config.aiPlayerIndices.map(i => {
      if (i === 0) return rulerIndex;
      if (i === rulerIndex) return 0;
      return i;
    });
  }

  const players: PlayerState[] = [];
  const turnOrder: string[] = [];

  for (let i = 0; i < playerCount; i++) {
    const id = generatePlayerId();
    const isAI = config.aiPlayerIndices.includes(i);
    const player = createPlayerState(id, config.playerNames[i], isAI);
    player.identity = identities[i];
    if (i === 0) {
      player.identityRevealed = true; // ruler is always revealed
      player.maxHp = 5; // ruler gets +1 max HP
      player.hp = 5;
    }
    players.push(player);
    turnOrder.push(id);
  }

  return {
    gamePhase: 'character_select',
    mode: config.mode,
    config: { ...config },
    players,
    turnOrder,
    currentPlayerIndex: 0,
    currentTurnPhase: 'judge',
    turnNumber: 0,
    roundNumber: 0,
    deck: [],
    discardPile: [],
    pendingAction: null,
    actionHistory: [],
    eventQueue: [],
    winner: null,
  };
}

// Deep clone game state (for immutable updates)
export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
}

// Create a new state with a specific phase
export function setGamePhase(state: GameState, phase: GamePhase): GameState {
  const next = cloneState(state);
  next.gamePhase = phase;
  return next;
}

// Initialize the deck (called after character selection, before game starts)
export function initializeDeck(state: GameState): GameState {
  const next = cloneState(state);
  next.deck = shuffleDeck(buildDeck());
  next.discardPile = [];
  return next;
}

// Deal initial hands: 4 cards each
export function dealInitialHands(state: GameState): GameState {
  const next = cloneState(state);
  for (const player of next.players) {
    player.hand = next.deck.splice(0, 4);
  }
  return next;
}

// Find player by ID
export function findPlayer(state: GameState, playerId: string): PlayerState | undefined {
  return state.players.find(p => p.id === playerId);
}

// Find player index
export function findPlayerIndex(state: GameState, playerId: string): number {
  return state.players.findIndex(p => p.id === playerId);
}

// Check if a player can be targeted (alive and within range)
export function isTargetable(state: GameState, targetId: string): boolean {
  const player = findPlayer(state, targetId);
  return player !== undefined && player.aliveStatus !== 'dead';
}

// Get the next alive player in turn order from a given index
export function getNextAlivePlayerIndex(state: GameState, fromIndex: number): number {
  const count = state.turnOrder.length;
  for (let i = 1; i <= count; i++) {
    const idx = (fromIndex + i) % count;
    const playerId = state.turnOrder[idx];
    const player = findPlayer(state, playerId);
    if (player && player.aliveStatus !== 'dead') {
      return idx;
    }
  }
  return fromIndex; // should never happen if there's at least one alive player
}
