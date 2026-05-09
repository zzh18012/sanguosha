// ============================================================
// Card type definitions - the foundation of the entire game
// ============================================================

export type CardSuit = 'spade' | 'heart' | 'club' | 'diamond';

export type CardRankNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export type CardCategory = 'basic' | 'tool' | 'equipment';

export type EquipmentSlot = 'weapon' | 'armor' | 'plusHorse' | 'minusHorse';

export type ToolTiming = 'immediate' | 'delayed';

// All card subtypes in the standard deck
export type CardSubtype =
  // Basic cards
  | 'sha' | 'shan' | 'tao' | 'jiu'
  // Non-delayed tool cards
  | 'guohe_chaiqiao'   // 过河拆桥
  | 'shunshou_qianyang' // 顺手牵羊
  | 'wuzhong_shengyou'  // 无中生有
  | 'wuxie_keji'        // 无懈可击
  | 'juedou'            // 决斗
  | 'nanman_ruqin'      // 南蛮入侵
  | 'wanjian_qifa'      // 万箭齐发
  | 'taoyuan_jieyi'     // 桃园结义
  | 'wugu_fengdeng'     // 五谷丰登
  | 'jiedao_sharen'     // 借刀杀人
  | 'tiesuo_lianhuan'   // 铁索连环
  // Delayed tool cards
  | 'lebu_sishu'        // 乐不思蜀
  | 'bingliang_cunduan' // 兵粮寸断
  | 'shandian'          // 闪电
  // Weapon equipment
  | 'zhugeliannu'       // 诸葛连弩
  | 'qinggangjian'      // 青釭剑
  | 'zhangbashemao'     // 丈八蛇矛
  | 'guanshifu'         // 贯石斧
  | 'qinglongyanyuedao' // 青龙偃月刀
  | 'qilingong'         // 麒麟弓
  | 'hanbingjian'       // 寒冰剑
  | 'gudingdao'         // 古锭刀
  // Armor equipment
  | 'baguazhen'         // 八卦阵
  | 'renwangdun'        // 仁王盾
  | 'tengjia'           // 藤甲
  // +1 Horse mounts
  | 'dilu'              // 的卢
  | 'dawan'             // 大宛
  | 'zhuahuangfeidian'  // 爪黄飞电
  // -1 Horse mounts
  | 'chitu'             // 赤兔
  | 'jueying'           // 绝影
  | 'diangongli';        // 点钢骊 (renamed from dilu_minus)

export interface CardDefinition {
  id: string;               // unique definition id, e.g. "sha_spade_1"
  name: string;             // display name in Chinese
  category: CardCategory;
  subtype: CardSubtype;
  suit: CardSuit;
  rankNumber: CardRankNumber;
  rankDisplay: string;      // 'A','2'..'10','J','Q','K'
  // Tool-specific
  toolTiming: ToolTiming | null;
  // Equipment-specific
  equipSlot: EquipmentSlot | null;
  weaponRange: number | null;
  // Special flags
  isFireElement: boolean;
  isThunderElement: boolean;
}

// Instance of a card in the game (has a unique instance id)
export interface GameCard {
  instanceId: string;       // unique per card instance, e.g. "card_a1b2c3"
  definitionId: string;     // links to CardDefinition.id
  name: string;
  category: CardCategory;
  subtype: CardSubtype;
  suit: CardSuit;
  rankNumber: CardRankNumber;
  rankDisplay: string;
  toolTiming: ToolTiming | null;
  equipSlot: EquipmentSlot | null;
  weaponRange: number | null;
  isFireElement: boolean;
  isThunderElement: boolean;
}

// Create a GameCard instance from a CardDefinition
export function createCardInstance(def: CardDefinition): GameCard {
  return {
    instanceId: `card_${crypto.randomUUID().slice(0, 8)}`,
    definitionId: def.id,
    name: def.name,
    category: def.category,
    subtype: def.subtype,
    suit: def.suit,
    rankNumber: def.rankNumber,
    rankDisplay: def.rankDisplay,
    toolTiming: def.toolTiming,
    equipSlot: def.equipSlot,
    weaponRange: def.weaponRange,
    isFireElement: def.isFireElement,
    isThunderElement: def.isThunderElement,
  };
}

// Card display info (for UI)
export interface CardDisplayInfo {
  name: string;
  category: CardCategory;
  subtype: CardSubtype;
  suit: CardSuit;
  rankDisplay: string;
  description: string;
}
