// ============================================================
// Identity system - role assignment, revelation, victory conditions
// ============================================================

import type { GameState, Identity } from '../../types/game';
import { cloneState } from '../core/GameState';

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
