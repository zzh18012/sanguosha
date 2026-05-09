// ============================================================
// AI Personas - identity-based strategy adjustments
// ============================================================

import type { Identity } from '../../types/game';

export interface AIPersona {
  identity: Identity;
  aggressionMultiplier: number;     // Damage-dealing aggressiveness
  teamPlayMultiplier: number;       // Helping/healing allies
  selfPreservationMultiplier: number; // Self-preservation
  cardControlMultiplier: number;     // Discarding/stealing from enemies
  riskTolerance: number;             // Willingness to take risks (0-1)
}

const PERSONAS: Record<Identity, AIPersona> = {
  ruler: {
    identity: 'ruler',
    aggressionMultiplier: 1.0,
    teamPlayMultiplier: 1.3,
    selfPreservationMultiplier: 1.5,
    cardControlMultiplier: 1.1,
    riskTolerance: 0.4,
  },
  loyalist: {
    identity: 'loyalist',
    aggressionMultiplier: 1.2,
    teamPlayMultiplier: 1.6,
    selfPreservationMultiplier: 1.1,
    cardControlMultiplier: 1.2,
    riskTolerance: 0.6,
  },
  rebel: {
    identity: 'rebel',
    aggressionMultiplier: 1.5,
    teamPlayMultiplier: 1.0,
    selfPreservationMultiplier: 0.9,
    cardControlMultiplier: 1.3,
    riskTolerance: 0.8,
  },
  spy: {
    identity: 'spy',
    aggressionMultiplier: 1.0,
    teamPlayMultiplier: 0.5,
    selfPreservationMultiplier: 1.8,
    cardControlMultiplier: 1.0,
    riskTolerance: 0.2,
  },
};

export function getPersona(identity: Identity): AIPersona {
  return PERSONAS[identity];
}

// Adjust score based on persona
export function applyPersona(baseScore: number, persona: AIPersona, actionCategory: string): number {
  switch (actionCategory) {
    case 'damage':
      return baseScore * persona.aggressionMultiplier;
    case 'team':
      return baseScore * persona.teamPlayMultiplier;
    case 'self':
      return baseScore * persona.selfPreservationMultiplier;
    case 'control':
      return baseScore * persona.cardControlMultiplier;
    default:
      return baseScore;
  }
}
