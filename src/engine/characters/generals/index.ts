export * from './wei';
export * from './shu';
export * from './wu';
export * from './qun';

import { registerWeiCharacters, WEI_CHARACTERS } from './wei';
import { registerShuCharacters, SHU_CHARACTERS } from './shu';
import { registerWuCharacters, WU_CHARACTERS } from './wu';
import { registerQunCharacters, QUN_CHARACTERS } from './qun';
import type { CharacterDefinition } from '../../../types/characters';

// All 26 standard characters
export const ALL_CHARACTERS: CharacterDefinition[] = [
  ...WEI_CHARACTERS,
  ...SHU_CHARACTERS,
  ...WU_CHARACTERS,
  ...QUN_CHARACTERS,
];

// Register all character skills with the skill engine
export function registerAllCharacters(): void {
  registerWeiCharacters();
  registerShuCharacters();
  registerWuCharacters();
  registerQunCharacters();
}

// Get random character selection for a non-ruler player (pick 1 from 3)
export function getRandomCharacterChoices(count: number = 3, excludeIds: string[] = []): CharacterDefinition[] {
  const available = ALL_CHARACTERS.filter(c => !excludeIds.includes(c.id));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Get ruler character choices (2 ruler-specific + 3 random normal)
export function getRulerCharacterChoices(): CharacterDefinition[] {
  const rulerOptions = ALL_CHARACTERS.filter(c => c.isRulerOption);
  const normalOptions = ALL_CHARACTERS.filter(c => !c.isRulerOption);
  const shuffledNormal = [...normalOptions].sort(() => Math.random() - 0.5);
  return [...rulerOptions, ...shuffledNormal.slice(0, 3)];
}

// Get character by ID
export function getCharacterById(id: string): CharacterDefinition | undefined {
  return ALL_CHARACTERS.find(c => c.id === id);
}
