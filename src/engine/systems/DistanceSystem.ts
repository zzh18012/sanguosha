// ============================================================
// Distance system - calculates distances between players
// ============================================================

import type { GameState } from '../../types/game';
import { findPlayer } from '../core/GameState';
import { playerHasSkill } from '../characters/SkillEngine';

// Calculate the base distance between two players (seat distance, ignoring mounts)
// Dead players are excluded from the distance calculation — they don't take up seats.
export function getBaseDistance(state: GameState, sourceId: string, targetId: string): number {
  if (sourceId === targetId) return 0;

  // Build ordered list of alive players (preserving original seat order)
  const alivePlayers = state.players.filter(p => p.aliveStatus !== 'dead');
  const playerCount = alivePlayers.length;

  const sourceIdx = alivePlayers.findIndex(p => p.id === sourceId);
  const targetIdx = alivePlayers.findIndex(p => p.id === targetId);
  if (sourceIdx === -1 || targetIdx === -1) return Infinity;

  const clockwise = (targetIdx - sourceIdx + playerCount) % playerCount;
  const counterClockwise = (sourceIdx - targetIdx + playerCount) % playerCount;

  return Math.min(clockwise, counterClockwise);
}

// Calculate the effective distance for an attack from source to target
// Formula: distance = baseDistance + target.plusHorse - source.minusHorse
export function getAttackDistance(state: GameState, sourceId: string, targetId: string): number {
  const baseDist = getBaseDistance(state, sourceId, targetId);
  if (baseDist === Infinity) return Infinity;

  const source = findPlayer(state, sourceId);
  const target = findPlayer(state, targetId);
  if (!source || !target) return Infinity;

  let distance = baseDist;

  // Target's +1 horse increases distance
  if (target.equipment.plusHorse) {
    distance += 1;
  }

  // Source's -1 horse decreases distance
  if (source.equipment.minusHorse) {
    distance -= 1;
  }

  // 马术 (Ma Chao): permanent -1 attack distance
  if (playerHasSkill(state, sourceId, 'mashu')) {
    distance -= 1;
  }

  // Distance cannot be less than 1
  return Math.max(1, distance);
}

// Check if a target is within weapon range for an attack
export function isInRange(state: GameState, sourceId: string, targetId: string): boolean {
  if (sourceId === targetId) return false;

  const source = findPlayer(state, sourceId);
  if (!source) return false;

  const distance = getAttackDistance(state, sourceId, targetId);

  // Default range is 1 (no weapon)
  let range = 1;

  // Check weapon range
  if (source.equipment.weapon) {
    range = source.equipment.weapon.weaponRange || 1;
  }

  return distance <= range;
}

// Get list of players within attack range
export function getTargetsInRange(state: GameState, sourceId: string): string[] {
  const alive = state.players.filter(p => p.aliveStatus !== 'dead' && p.id !== sourceId);
  return alive.filter(p => isInRange(state, sourceId, p.id)).map(p => p.id);
}

// Check if two players are considered "adjacent" (distance = 1)
export function isAdjacent(state: GameState, sourceId: string, targetId: string): boolean {
  if (sourceId === targetId) return false;
  const dist = getAttackDistance(state, sourceId, targetId);
  return dist === 1;
}
