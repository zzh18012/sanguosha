// ============================================================
// Game action types - discriminated union of all possible actions
// ============================================================

export type GameAction =
  // Playing / using cards
  | { type: 'PLAY_CARD'; playerId: string; cardId: string; targets: string[] }
  | { type: 'USE_SKILL'; playerId: string; skillId: string; targets: string[]; options?: Record<string, unknown> }
  | { type: 'EQUIP_CARD'; playerId: string; cardId: string }
  | { type: 'DISCARD_CARD'; playerId: string; cardId: string }
  | { type: 'USE_TAO_SELF'; playerId: string; cardId: string }
  | { type: 'USE_TAO_OTHER'; playerId: string; cardId: string; targetId: string }
  // Response actions
  | { type: 'RESPOND'; playerId: string; cardIds: string[] }
  | { type: 'PASS_RESPONSE'; playerId: string }
  | { type: 'PLAY_WUXIE'; playerId: string; cardId: string; againstActionType: string }
  | { type: 'PASS_WUXIE'; playerId: string }
  // Phase actions
  | { type: 'END_PHASE'; playerId: string }
  | { type: 'END_TURN'; playerId: string }
  // Game setup
  | { type: 'SELECT_CHARACTER'; playerId: string; characterId: string }
  | { type: 'START_GAME' }
  | { type: 'REQUEST_CHARACTER_SELECTION' }
  // System actions (engine-internal)
  | { type: 'DRAW_CARDS'; playerId: string; count: number }
  | { type: 'DRAW_CARDS_SPECIFIC'; playerId: string; cardIds: string[] }
  | { type: 'DEAL_DAMAGE'; sourceId: string; targetId: string; amount: number; element?: 'fire' | 'thunder' | 'normal' }
  | { type: 'HEAL_HP'; playerId: string; amount: number; sourceId?: string }
  | { type: 'ENTER_DYING'; playerId: string }
  | { type: 'PLAYER_DIED'; playerId: string; killerId?: string }
  | { type: 'DISCARD_ALL_CARDS'; playerId: string }
  | { type: 'DISCARD_TO_MAX_HP'; playerId: string }
  | { type: 'ENTER_JUDGMENT_PHASE'; playerId: string }
  | { type: 'RESOLVE_JUDGMENT'; playerId: string; cardId: string; result: boolean }
  | { type: 'PLACE_DELAYED_TOOL'; targetId: string; cardId: string }
  | { type: 'REMOVE_DELAYED_TOOL'; targetId: string; cardId: string }
  | { type: 'DESTROY_EQUIPMENT'; playerId: string; slot: string }
  | { type: 'STEAL_CARD'; sourceId: string; targetId: string; cardId: string; zone: 'hand' | 'equipment' | 'judgment' }
  | { type: 'CHAIN_PLAYERS'; targetIds: string[] }
  | { type: 'TURN_OVER'; playerId: string }
  | { type: 'PHASE_CHANGE'; phase: string }
  | { type: 'TURN_START'; playerId: string }
  | { type: 'CHECK_VICTORY' }
  | { type: 'AI_THINK'; playerId: string }
  // Equipment interactions
  | { type: 'JUDGE_BAGUAZHEN'; playerId: string }
  // Card picking (过河拆桥/顺手牵羊/五谷丰登)
  | { type: 'SELECT_TARGET_CARD'; playerId: string; cardId: string; targetPlayerId: string }
  | { type: 'PICK_WUGU_CARD'; playerId: string; cardId: string }
  // 借刀杀人 responses
  | { type: 'JIEDAO_ATTACK'; playerId: string; targetId: string }
  | { type: 'JIEDAO_GIVE_WEAPON'; playerId: string }
  // 铁索连环
  | { type: 'TOGGLE_CHAIN'; playerId: string; targetIds: string[] };

// Helper to describe an action in Chinese (for game log)
export function describeAction(action: GameAction): string {
  switch (action.type) {
    case 'PLAY_CARD': return `使用了牌`;
    case 'USE_SKILL': return `发动了技能`;
    case 'EQUIP_CARD': return `装备了牌`;
    case 'DISCARD_CARD': return `弃置了牌`;
    case 'USE_TAO_SELF': return `使用了桃回复体力`;
    case 'USE_TAO_OTHER': return `对其他人使用了桃`;
    case 'RESPOND': return `打出了响应牌`;
    case 'PASS_RESPONSE': return `放弃响应`;
    case 'PLAY_WUXIE': return `打出了无懈可击`;
    case 'PASS_WUXIE': return `放弃无懈可击`;
    case 'END_PHASE': return `结束了阶段`;
    case 'END_TURN': return `结束了回合`;
    case 'SELECT_CHARACTER': return `选择了武将`;
    case 'DEAL_DAMAGE': return `造成了伤害`;
    case 'HEAL_HP': return `恢复了体力`;
    case 'ENTER_DYING': return `进入濒死状态`;
    case 'PLAYER_DIED': return `死亡`;
    case 'DISCARD_TO_MAX_HP': return `弃牌至体力上限`;
    default: return `执行了操作`;
  }
}
