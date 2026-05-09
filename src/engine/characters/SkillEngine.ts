// ============================================================
// Skill engine - trigger evaluation, priority, and skill resolution
// ============================================================

import type { GameState } from '../../types/game';
import type { GameAction } from '../../types/actions';
import type { SkillDefinition, SkillTrigger, SkillContext, SkillExecutor, PendingChoice } from '../../types/characters';
import { findPlayer, cloneState } from '../core/GameState';
import type { GameCard } from '../../types/cards';

// Registry of all skills (populated by character definitions)
const skillRegistry = new Map<string, SkillDefinition>();

export function registerSkill(skill: SkillDefinition): void {
  skillRegistry.set(skill.id, skill);
}

export function getSkill(skillId: string): SkillDefinition | undefined {
  return skillRegistry.get(skillId);
}

// Check which skills trigger in response to an event/action
export function checkTriggers(
  state: GameState,
  action: GameAction,
): TriggeredSkill[] {
  const triggered: TriggeredSkill[] = [];

  for (const player of state.players) {
    if (player.aliveStatus === 'dead') continue;

    // Get the character's skills
    const charSkills = getCharacterSkills(player.characterId);

    for (const skill of charSkills) {
      if (doesTriggerMatch(skill, action, player.id, state)) {
        triggered.push({
          skill,
          playerId: player.id,
          action,
          priority: getTriggerPriority(skill),
        });
      }
    }
  }

  // Sort by priority (highest first)
  triggered.sort((a, b) => b.priority - a.priority);

  return triggered;
}

export interface TriggeredSkill {
  skill: SkillDefinition;
  playerId: string;
  action: GameAction;
  priority: number;
}

// Check if a skill trigger matches an action
function doesTriggerMatch(
  skill: SkillDefinition,
  action: GameAction,
  playerId: string,
  state: GameState,
): boolean {
  const player = findPlayer(state, playerId);
  if (!player) return false;

  // 主公技：只有身份为主公的角色才能触发
  if (skill.isRulerSkill && player.identity !== 'ruler') return false;

  for (const trigger of skill.triggers) {
    switch (trigger.kind) {
      case 'on_damage_received':
        if (action.type === 'DEAL_DAMAGE' && action.targetId === playerId) return true;
        break;

      case 'on_damage_dealt':
        if (action.type === 'DEAL_DAMAGE' && action.sourceId === playerId) return true;
        break;

      case 'on_healed':
        if (action.type === 'HEAL_HP' && action.playerId === playerId) return true;
        break;

      case 'on_card_played':
        if (action.type === 'PLAY_CARD' && action.playerId === playerId) return true;
        break;

      case 'on_turn_start':
        if (action.type === 'TURN_START' && action.playerId === playerId) return true;
        break;

      case 'on_turn_end':
        if (action.type === 'END_TURN' && action.playerId === playerId) return true;
        break;

      case 'on_death':
        if (action.type === 'PLAYER_DIED') {
          if (trigger.target === 'other' && action.playerId !== playerId) return true;
          if (trigger.target === 'self' && action.playerId === playerId) return true;
        }
        break;

      case 'on_sha_targeted':
        if (action.type === 'PLAY_CARD' && action.targets?.includes(playerId)) return true;
        break;

      case 'active':
        // Active skills can be used during the specified phase
        break;

      case 'passive':
        return true; // Passive skills are always active

      case 'on_play_phase_start':
        if (action.type === 'PHASE_CHANGE' && action.phase === 'play') return true;
        break;

      case 'on_draw_phase':
        if (action.type === 'PHASE_CHANGE' && action.phase === 'draw') return true;
        if (action.type === 'DRAW_CARDS' && action.playerId === playerId) return true;
        break;

      case 'on_discard_phase':
        if (action.type === 'PHASE_CHANGE' && action.phase === 'discard') return true;
        break;

      default:
        break;
    }
  }

  return false;
}

// Get trigger priority (higher = fires first)
function getTriggerPriority(skill: SkillDefinition): number {
  // Mandatory skills fire before optional ones
  // Character-specific:  locked skills fire first
  return skill.isMandatory ? 100 : 50;
}

// Execute a triggered skill
export function executeSkill(
  state: GameState,
  playerId: string,
  skillId: string,
  triggerAction: GameAction | null,
): { state: GameState; actions: GameAction[]; pendingChoice: PendingChoice | null } {
  const next = cloneState(state);
  const player = findPlayer(next, playerId);
  const skill = getSkill(skillId);

  if (!player || !skill) {
    return { state: next, actions: [], pendingChoice: null };
  }

  const ctx: SkillContext = {
    gameState: next,
    sourcePlayerId: playerId,
    triggerEvent: triggerAction,
    triggeredSkillId: skillId,
    pendingChoices: null,
  };

  const result = skill.execute(ctx);

  return {
    state: next,
    actions: result.actions,
    pendingChoice: ctx.pendingChoices,
  };
}

// Get character skills from the character's skill IDs
function getCharacterSkills(characterId: string): SkillDefinition[] {
  // This will be populated by the character registry
  const registry = getCharacterRegistry();
  const char = registry.get(characterId);
  if (!char) return [];
  return char.skills;
}

// Character registry (populated by character definition files)
const characterRegistry = new Map<string, { id: string; skills: SkillDefinition[] }>();

export function registerCharacterSkills(characterId: string, skills: SkillDefinition[]): void {
  characterRegistry.set(characterId, { id: characterId, skills });
  for (const skill of skills) {
    registerSkill(skill);
  }
}

export function getCharacterRegistry(): Map<string, { id: string; skills: SkillDefinition[] }> {
  return characterRegistry;
}

// Skill helper functions for use in skill executors
export function createSkillHelpers(state: GameState, playerId: string) {
  const player = findPlayer(state, playerId);

  return {
    // Draw N cards
    drawCards: (actions: GameAction[], count: number) => {
      actions.push({ type: 'DRAW_CARDS', playerId, count });
    },
    // Discard N cards (player chooses)
    discardCards: (actions: GameAction[], count: number) => {
      // Player must choose which cards to discard
    },
    // Deal damage
    dealDamage: (actions: GameAction[], targetId: string, amount: number, element?: 'fire' | 'thunder' | 'normal') => {
      actions.push({ type: 'DEAL_DAMAGE', sourceId: playerId, targetId, amount, element });
    },
    // Heal
    heal: (actions: GameAction[], targetId: string, amount: number) => {
      actions.push({ type: 'HEAL_HP', playerId: targetId, amount, sourceId: playerId });
    },
    // Steal card
    stealCard: (actions: GameAction[], targetId: string, cardId: string, zone: 'hand' | 'equipment' | 'judgment') => {
      actions.push({ type: 'STEAL_CARD', sourceId: playerId, targetId, cardId, zone });
    },
    // Destroy equipment
    destroyEquipment: (actions: GameAction[], targetId: string, slot: string) => {
      actions.push({ type: 'DESTROY_EQUIPMENT', playerId: targetId, slot });
    },
    // Check HP
    getHp: () => player?.hp ?? 0,
    getMaxHp: () => player?.maxHp ?? 0,
    getHandCount: () => player?.hand.length ?? 0,
    // Check if has card type
    hasCardInHand: (subtype: string) => player?.hand.some(c => c.subtype === subtype) ?? false,
  };
}
