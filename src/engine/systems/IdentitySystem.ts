// ============================================================
// Identity system - role assignment, revelation, victory conditions
// ============================================================

import type { GameState, Identity } from '../../types/game';
import { cloneState, shuffleArray } from '../core/GameState';

// Identity distribution based on player count
const IDENTITY_TABLES: Record<number, Identity[]> = {
  2: ['ruler', 'rebel'],
  3: ['ruler', 'loyalist', 'rebel'],
  4: ['ruler', 'loyalist', 'rebel', 'spy'],
  5: ['ruler', 'loyalist', 'rebel', 'rebel', 'spy'],
  6: ['ruler', 'loyalist', 'rebel', 'rebel', 'rebel', 'spy'],
  7: ['ruler', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'spy'],
  8: ['ruler', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'rebel', 'spy'],
};

// Assign identities to players
export function assignIdentities(state: GameState): GameState {
  const next = cloneState(state);
  const playerCount = next.players.length;

  const table = IDENTITY_TABLES[playerCount];
  if (!table) {
    // Fallback for custom player counts
    const ids: Identity[] = ['ruler'];
    const remaining = playerCount - 1;
    const rebels = Math.floor(remaining * 0.5);
    const loyalists = remaining - rebels - (playerCount >= 4 ? 1 : 0);
    for (let i = 0; i < loyalists; i++) ids.push('loyalist');
    for (let i = 0; i < rebels; i++) ids.push('rebel');
    if (playerCount >= 4) ids.push('spy');
    while (ids.length < playerCount) ids.push('rebel');

    const shuffled = shuffleArray(ids.slice(0, playerCount));
    // Ensure ruler is at position 0
    const rulerIdx = shuffled.indexOf('ruler');
    if (rulerIdx > 0) {
      [shuffled[0], shuffled[rulerIdx]] = [shuffled[rulerIdx], shuffled[0]];
    }

    for (let i = 0; i < playerCount; i++) {
      next.players[i].identity = shuffled[i];
    }
  } else {
    // Use standard table, shuffle, put ruler first
    const shuffled = shuffleArray([...table]);
    const rulerIdx = shuffled.indexOf('ruler');
    if (rulerIdx > 0) {
      [shuffled[0], shuffled[rulerIdx]] = [shuffled[rulerIdx], shuffled[0]];
    }

    for (let i = 0; i < playerCount; i++) {
      next.players[i].identity = shuffled[i];
    }
  }

  // Ruler is always revealed, gets +1 HP
  for (const player of next.players) {
    if (player.identity === 'ruler') {
      player.identityRevealed = true;
      player.maxHp += 1;
      player.hp = player.maxHp;
    } else {
      player.identityRevealed = false;
    }
  }

  return next;
}

// Reveal a player's identity (on death or skill effect)
export function revealIdentity(state: GameState, playerId: string): GameState {
  const next = cloneState(state);
  const player = next.players.find(p => p.id === playerId);
  if (player) {
    player.identityRevealed = true;
  }
  return next;
}

// Get known enemies for a player (based on revealed info)
export function getKnownEnemies(state: GameState, playerId: string): string[] {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return [];

  const enemies: string[] = [];

  for (const other of state.players) {
    if (other.id === playerId || other.aliveStatus === 'dead') continue;

    if (other.identityRevealed) {
      // Known identity
      if (areEnemies(player.identity, other.identity)) {
        enemies.push(other.id);
      }
    } else {
      // Unknown identity - use heuristics
      // Behavior-based: if they've attacked the player, they're likely enemies
      // For now, assume hidden identities are neutral
    }
  }

  return enemies;
}

// Get known allies for a player
export function getKnownAllies(state: GameState, playerId: string): string[] {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return [];

  const allies: string[] = [];

  for (const other of state.players) {
    if (other.id === playerId || other.aliveStatus === 'dead') continue;

    if (other.identityRevealed) {
      if (areAllies(player.identity, other.identity)) {
        allies.push(other.id);
      }
    }
  }

  return allies;
}

// Determine if two identities are enemies
export function areEnemies(a: Identity, b: Identity): boolean {
  if (a === 'ruler') {
    return b === 'rebel' || b === 'spy';
  }
  if (a === 'loyalist') {
    return b === 'rebel' || b === 'spy';
  }
  if (a === 'rebel') {
    return b === 'ruler' || b === 'loyalist' || b === 'spy';
  }
  if (a === 'spy') {
    // Spy considers everyone as potential enemy
    return b !== 'spy';
  }
  return false;
}

// Determine if two identities are allies
export function areAllies(a: Identity, b: Identity): boolean {
  if (a === b) return true;
  if (a === 'ruler') return b === 'loyalist';
  if (a === 'loyalist') return b === 'ruler';
  return false;
}

// Get the identity name in Chinese
export function getIdentityName(identity: Identity): string {
  switch (identity) {
    case 'ruler': return '主公';
    case 'loyalist': return '忠臣';
    case 'rebel': return '反贼';
    case 'spy': return '内奸';
    default: return '未知';
  }
}

// Get the victory condition description
export function getVictoryCondition(identity: Identity): string {
  switch (identity) {
    case 'ruler': return '消灭所有反贼和内奸';
    case 'loyalist': return '保护主公，消灭所有反贼和内奸';
    case 'rebel': return '消灭主公';
    case 'spy': return '除掉所有其他角色，主公必须最后死';
    default: return '';
  }
}
