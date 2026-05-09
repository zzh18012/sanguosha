// ============================================================
// Character / General type definitions
// ============================================================

import type { GameState } from './game';
import type { GameAction } from './actions';

export type Kingdom = 'wei' | 'shu' | 'wu' | 'qun';
export type Gender = 'male' | 'female';

// Skill trigger: when a skill can fire
export type SkillTrigger =
  | { kind: 'on_damage_dealt' }
  | { kind: 'on_damage_received' }
  | { kind: 'on_healed' }
  | { kind: 'on_card_played'; cardSubtype?: string }
  | { kind: 'on_turn_start' }
  | { kind: 'on_turn_end' }
  | { kind: 'on_phase_enter'; phase: string }
  | { kind: 'on_phase_exit'; phase: string }
  | { kind: 'on_death'; target: 'self' | 'other' }
  | { kind: 'on_judgment_start' }
  | { kind: 'on_before_damage'; source: 'self' | 'any' }
  | { kind: 'active'; usableInPhase: string }
  | { kind: 'passive' }
  | { kind: 'on_draw_phase' }
  | { kind: 'on_discard_phase' }
  | { kind: 'on_play_phase_start' }
  | { kind: 'on_sha_targeted' }     // when targeted by 杀
  | { kind: 'on_sha_played' }       // when playing 杀
  | { kind: 'on_juedou_targeted' }; // when targeted by 决斗

// Skill context - passed to skill executor functions
export interface SkillContext {
  gameState: GameState;
  sourcePlayerId: string;
  triggerEvent: GameAction | null;
  triggeredSkillId: string;
  // For channeling to UI for human choices
  pendingChoices: PendingChoice | null;
}

export interface PendingChoice {
  choiceType: 'choose_target' | 'choose_card' | 'choose_suit';
  playerId: string;
  skillId: string;
  validTargets?: string[];
  validCards?: string[];
  options?: string[];
}

// A skill executor returns additional actions to perform
export type SkillExecutor = (ctx: SkillContext) => {
  actions: GameAction[];
  modifiedState?: Partial<GameState>;
};

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  triggers: SkillTrigger[];
  execute: SkillExecutor;
  isMandatory: boolean;
  isRulerSkill?: boolean;   // ruler-only skills like 护驾, 激将, 救援
}

export interface CharacterDefinition {
  id: string;
  name: string;
  title: string;
  kingdom: Kingdom;
  maxHp: number;            // 3 or 4 (ruler gets +1)
  gender: Gender;
  skills: SkillDefinition[];
  isRulerOption?: boolean;  // can be selected as a ruler-specific character
}

// Known character IDs for easy reference
export const CHARACTER_IDS = {
  // Wei
  CAOCAO: 'caocao',
  SIMAYI: 'simayi',
  XIAHOUDUN: 'xiahoudun',
  ZHANGLIAO: 'zhangliao',
  XUCHU: 'xuchu',
  GUOJIA: 'guojia',
  ZHENJI: 'zhenji',
  // Shu
  LIUBEI: 'liubei',
  GUANYU: 'guanyu',
  ZHANGFEI: 'zhangfei',
  ZHUGELIANG: 'zhugeliang',
  ZHAOYUN: 'zhaoyun',
  MACHAO: 'machao',
  HUANGYUEYING: 'huangyueying',
  // Wu
  SUNQUAN: 'sunquan',
  ZHOUYU: 'zhouyu',
  HUANGGAI: 'huanggai',
  LVMENG: 'lvmeng',
  LUXUN: 'luxun',
  DAQIAO: 'daqiao',
  SUNSHANGXIANG: 'sunshangxiang',
  // Qun
  HUATUO: 'huatuo',
  LVBU: 'lvbu',
  DIAOCHAN: 'diaochan',
  ZHANGJIAO: 'zhangjiao',
  YUANSHAO: 'yuanshao',
} as const;
