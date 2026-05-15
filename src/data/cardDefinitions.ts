// ============================================================
// Complete card definitions for standard + military expansion deck
// Total: 160 cards (标准版108 + 军争篇52)
// ============================================================

import type { CardDefinition, CardSuit, CardRankNumber } from '../types/cards';

// Helper to create card definitions efficiently
function c(
  id: string, name: string, category: 'basic' | 'tool' | 'equipment',
  subtype: string, suit: CardSuit, rank: CardRankNumber,
  opts?: { toolTiming?: 'immediate' | 'delayed'; equipSlot?: string; weaponRange?: number; fire?: boolean; thunder?: boolean }
): CardDefinition {
  const rankMap: Record<number, string> = { 1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K' };
  return {
    id,
    name,
    category,
    subtype: subtype as CardDefinition['subtype'],
    suit,
    rankNumber: rank,
    rankDisplay: rankMap[rank] || String(rank),
    toolTiming: (opts?.toolTiming as CardDefinition['toolTiming']) || null,
    equipSlot: (opts?.equipSlot as CardDefinition['equipSlot']) || null,
    weaponRange: opts?.weaponRange ?? null,
    isFireElement: opts?.fire ?? false,
    isThunderElement: opts?.thunder ?? false,
  };
}

export const CARD_DEFINITIONS: CardDefinition[] = [
  // ==========================================
  // 基本牌 - 杀 (30 cards in standard)
  // ==========================================
  // 黑桃杀 (8)
  c('sha_spade_7',  '杀', 'basic', 'sha', 'spade', 7),
  c('sha_spade_8',  '杀', 'basic', 'sha', 'spade', 8),
  c('sha_spade_8b', '杀', 'basic', 'sha', 'spade', 8),
  c('sha_spade_9',  '杀', 'basic', 'sha', 'spade', 9),
  c('sha_spade_9b', '杀', 'basic', 'sha', 'spade', 9),
  c('sha_spade_10', '杀', 'basic', 'sha', 'spade', 10),
  c('sha_spade_10b','杀', 'basic', 'sha', 'spade', 10),
  // 梅花杀 (14)
  c('sha_club_2',   '杀', 'basic', 'sha', 'club', 2),
  c('sha_club_3',   '杀', 'basic', 'sha', 'club', 3),
  c('sha_club_4',   '杀', 'basic', 'sha', 'club', 4),
  c('sha_club_5',   '杀', 'basic', 'sha', 'club', 5),
  c('sha_club_6',   '杀', 'basic', 'sha', 'club', 6),
  c('sha_club_7',   '杀', 'basic', 'sha', 'club', 7),
  c('sha_club_8',   '杀', 'basic', 'sha', 'club', 8),
  c('sha_club_8b',  '杀', 'basic', 'sha', 'club', 8),
  c('sha_club_9',   '杀', 'basic', 'sha', 'club', 9),
  c('sha_club_9b',  '杀', 'basic', 'sha', 'club', 9),
  c('sha_club_10',  '杀', 'basic', 'sha', 'club', 10),
  c('sha_club_10b', '杀', 'basic', 'sha', 'club', 10),
  c('sha_club_J',   '杀', 'basic', 'sha', 'club', 11),
  c('sha_club_Jb',  '杀', 'basic', 'sha', 'club', 11),
  // 红心杀 - 火杀 (3 in standard, 5 in expansion)
  c('sha_heart_10', '杀', 'basic', 'sha', 'heart', 10, { fire: true }),
  c('sha_heart_J',  '杀', 'basic', 'sha', 'heart', 11, { fire: true }),
  // 方片杀 - 火杀 (4 in standard, plus 2 in expansion)
  c('sha_diamond_6', '杀', 'basic', 'sha', 'diamond', 6, { fire: true }),
  c('sha_diamond_7', '杀', 'basic', 'sha', 'diamond', 7, { fire: true }),
  c('sha_diamond_8', '杀', 'basic', 'sha', 'diamond', 8, { fire: true }),
  c('sha_diamond_9', '杀', 'basic', 'sha', 'diamond', 9, { fire: true }),
  c('sha_diamond_10','杀', 'basic', 'sha', 'diamond', 10, { fire: true }),
  c('sha_diamond_K', '杀', 'basic', 'sha', 'diamond', 13, { fire: true }),
  // 军争: 雷杀 (9 cards)
  c('sha_spade_5',  '雷杀', 'basic', 'sha', 'spade', 5, { thunder: true }),
  c('sha_spade_6',  '雷杀', 'basic', 'sha', 'spade', 6, { thunder: true }),
  c('sha_spade_7b', '雷杀', 'basic', 'sha', 'spade', 7, { thunder: true }),
  c('sha_spade_8c', '雷杀', 'basic', 'sha', 'spade', 8, { thunder: true }),
  c('sha_club_t5',   '雷杀', 'basic', 'sha', 'club', 5, { thunder: true }),
  c('sha_club_t6',   '雷杀', 'basic', 'sha', 'club', 6, { thunder: true }),
  c('sha_club_t7',   '雷杀', 'basic', 'sha', 'club', 7, { thunder: true }),
  c('sha_club_t8',   '雷杀', 'basic', 'sha', 'club', 8, { thunder: true }),
  // 军争: 火杀 (5 cards)
  c('sha_heart_4',  '火杀', 'basic', 'sha', 'heart', 4, { fire: true }),
  c('sha_heart_7',  '火杀', 'basic', 'sha', 'heart', 7, { fire: true }),
  c('sha_heart_10b','火杀', 'basic', 'sha', 'heart', 10, { fire: true }),
  c('sha_diamond_4', '火杀', 'basic', 'sha', 'diamond', 4, { fire: true }),
  c('sha_diamond_5', '火杀', 'basic', 'sha', 'diamond', 5, { fire: true }),

  // ==========================================
  // 闪 (24 cards in standard)
  // ==========================================
  c('shan_heart_2',  '闪', 'basic', 'shan', 'heart', 2),
  c('shan_heart_2b', '闪', 'basic', 'shan', 'heart', 2),
  c('shan_heart_13', '闪', 'basic', 'shan', 'heart', 13),
  c('shan_diamond_2', '闪', 'basic', 'shan', 'diamond', 2),
  c('shan_diamond_2b','闪', 'basic', 'shan', 'diamond', 2),
  c('shan_diamond_3', '闪', 'basic', 'shan', 'diamond', 3),
  c('shan_diamond_4', '闪', 'basic', 'shan', 'diamond', 4),
  c('shan_diamond_5', '闪', 'basic', 'shan', 'diamond', 5),
  c('shan_diamond_6', '闪', 'basic', 'shan', 'diamond', 6),
  c('shan_diamond_7', '闪', 'basic', 'shan', 'diamond', 7),
  c('shan_diamond_8', '闪', 'basic', 'shan', 'diamond', 8),
  c('shan_diamond_9', '闪', 'basic', 'shan', 'diamond', 9),
  c('shan_diamond_10','闪', 'basic', 'shan', 'diamond', 10),
  c('shan_diamond_J', '闪', 'basic', 'shan', 'diamond', 11),
  c('shan_diamond_Jb','闪', 'basic', 'shan', 'diamond', 11),
  // 军争: 闪 (9 extra)
  c('shan_heart_8',  '闪', 'basic', 'shan', 'heart', 8),
  c('shan_heart_9',  '闪', 'basic', 'shan', 'heart', 9),
  c('shan_heart_J',  '闪', 'basic', 'shan', 'heart', 11),
  c('shan_heart_Q',  '闪', 'basic', 'shan', 'heart', 12),
  c('shan_heart_Qb', '闪', 'basic', 'shan', 'heart', 12),
  c('shan_diamond_3b','闪', 'basic', 'shan', 'diamond', 3),
  c('shan_diamond_6b','闪', 'basic', 'shan', 'diamond', 6),
  c('shan_diamond_7b','闪', 'basic', 'shan', 'diamond', 7),
  c('shan_diamond_8b','闪', 'basic', 'shan', 'diamond', 8),

  // ==========================================
  // 桃 (8 in standard + 4 in expansion = 12)
  // ==========================================
  c('tao_heart_3',   '桃', 'basic', 'tao', 'heart', 3),
  c('tao_heart_4',   '桃', 'basic', 'tao', 'heart', 4),
  c('tao_heart_5',   '桃', 'basic', 'tao', 'heart', 5),
  c('tao_heart_6',   '桃', 'basic', 'tao', 'heart', 6),
  c('tao_heart_7',   '桃', 'basic', 'tao', 'heart', 7),
  c('tao_heart_9',   '桃', 'basic', 'tao', 'heart', 9),
  c('tao_heart_Q',   '桃', 'basic', 'tao', 'heart', 12),
  c('tao_diamond_Q', '桃', 'basic', 'tao', 'diamond', 12),
  // 军争 extra 桃
  c('tao_heart_2',   '桃', 'basic', 'tao', 'heart', 2),
  c('tao_heart_3b',  '桃', 'basic', 'tao', 'heart', 3),
  c('tao_heart_8',   '桃', 'basic', 'tao', 'heart', 8),
  c('tao_heart_Qb',  '桃', 'basic', 'tao', 'heart', 12),

  // ==========================================
  // 酒 (5 cards, all in expansion)
  // ==========================================
  c('jiu_spade_3', '酒', 'basic', 'jiu', 'spade', 3),
  c('jiu_spade_9', '酒', 'basic', 'jiu', 'spade', 9),
  c('jiu_club_3',  '酒', 'basic', 'jiu', 'club', 3),
  c('jiu_club_9',  '酒', 'basic', 'jiu', 'club', 9),
  c('jiu_heart_4', '酒', 'basic', 'jiu', 'heart', 4),

  // ==========================================
  // 非延时锦囊牌
  // ==========================================
  // 过河拆桥 (6 cards)
  c('guohe_spade_3',   '过河拆桥', 'tool', 'guohe_chaiqiao', 'spade', 3, { toolTiming: 'immediate' }),
  c('guohe_spade_4',   '过河拆桥', 'tool', 'guohe_chaiqiao', 'spade', 4, { toolTiming: 'immediate' }),
  c('guohe_spade_Q',   '过河拆桥', 'tool', 'guohe_chaiqiao', 'spade', 12, { toolTiming: 'immediate' }),
  c('guohe_club_3',    '过河拆桥', 'tool', 'guohe_chaiqiao', 'club', 3, { toolTiming: 'immediate' }),
  c('guohe_club_4',    '过河拆桥', 'tool', 'guohe_chaiqiao', 'club', 4, { toolTiming: 'immediate' }),
  c('guohe_heart_Q',   '过河拆桥', 'tool', 'guohe_chaiqiao', 'heart', 12, { toolTiming: 'immediate' }),

  // 顺手牵羊 (5 cards)
  c('shunshou_spade_3',  '顺手牵羊', 'tool', 'shunshou_qianyang', 'spade', 3, { toolTiming: 'immediate' }),
  c('shunshou_spade_4',  '顺手牵羊', 'tool', 'shunshou_qianyang', 'spade', 4, { toolTiming: 'immediate' }),
  c('shunshou_spade_J',  '顺手牵羊', 'tool', 'shunshou_qianyang', 'spade', 11, { toolTiming: 'immediate' }),
  c('shunshou_diamond_3','顺手牵羊', 'tool', 'shunshou_qianyang', 'diamond', 3, { toolTiming: 'immediate' }),
  c('shunshou_diamond_4','顺手牵羊', 'tool', 'shunshou_qianyang', 'diamond', 4, { toolTiming: 'immediate' }),

  // 无中生有 (4 cards)
  c('wuzhong_heart_7', '无中生有', 'tool', 'wuzhong_shengyou', 'heart', 7, { toolTiming: 'immediate' }),
  c('wuzhong_heart_8', '无中生有', 'tool', 'wuzhong_shengyou', 'heart', 8, { toolTiming: 'immediate' }),
  c('wuzhong_heart_9', '无中生有', 'tool', 'wuzhong_shengyou', 'heart', 9, { toolTiming: 'immediate' }),
  c('wuzhong_heart_J', '无中生有', 'tool', 'wuzhong_shengyou', 'heart', 11, { toolTiming: 'immediate' }),

  // 无懈可击 (7 cards)
  c('wuxie_spade_J',   '无懈可击', 'tool', 'wuxie_keji', 'spade', 11, { toolTiming: 'immediate' }),
  c('wuxie_spade_K',   '无懈可击', 'tool', 'wuxie_keji', 'spade', 13, { toolTiming: 'immediate' }),
  c('wuxie_club_Q',    '无懈可击', 'tool', 'wuxie_keji', 'club', 12, { toolTiming: 'immediate' }),
  c('wuxie_club_K',    '无懈可击', 'tool', 'wuxie_keji', 'club', 13, { toolTiming: 'immediate' }),
  c('wuxie_heart_Q',   '无懈可击', 'tool', 'wuxie_keji', 'heart', 12, { toolTiming: 'immediate' }),
  c('wuxie_diamond_Q', '无懈可击', 'tool', 'wuxie_keji', 'diamond', 12, { toolTiming: 'immediate' }),
  c('wuxie_diamond_K',  '无懈可击', 'tool', 'wuxie_keji', 'diamond', 13, { toolTiming: 'immediate' }),

  // 决斗 (3 cards)
  c('juedou_spade_A',  '决斗', 'tool', 'juedou', 'spade', 1, { toolTiming: 'immediate' }),
  c('juedou_club_A',   '决斗', 'tool', 'juedou', 'club', 1, { toolTiming: 'immediate' }),
  c('juedou_diamond_A','决斗', 'tool', 'juedou', 'diamond', 1, { toolTiming: 'immediate' }),

  // 南蛮入侵 (3 cards)
  c('nanman_spade_7', '南蛮入侵', 'tool', 'nanman_ruqin', 'spade', 7, { toolTiming: 'immediate' }),
  c('nanman_spade_13','南蛮入侵', 'tool', 'nanman_ruqin', 'spade', 13, { toolTiming: 'immediate' }),
  c('nanman_club_7',  '南蛮入侵', 'tool', 'nanman_ruqin', 'club', 7, { toolTiming: 'immediate' }),

  // 万箭齐发 (1 card)
  c('wanjian_heart_A','万箭齐发', 'tool', 'wanjian_qifa', 'heart', 1, { toolTiming: 'immediate' }),

  // 桃园结义 (1 card)
  c('taoyuan_heart_A2','桃园结义', 'tool', 'taoyuan_jieyi', 'heart', 1, { toolTiming: 'immediate' }),

  // 五谷丰登 (2 cards)
  c('wugu_heart_3', '五谷丰登', 'tool', 'wugu_fengdeng', 'heart', 3, { toolTiming: 'immediate' }),
  c('wugu_heart_4', '五谷丰登', 'tool', 'wugu_fengdeng', 'heart', 4, { toolTiming: 'immediate' }),

  // 借刀杀人 (2 cards)
  c('jiedao_club_Q', '借刀杀人', 'tool', 'jiedao_sharen', 'club', 12, { toolTiming: 'immediate' }),
  c('jiedao_club_K', '借刀杀人', 'tool', 'jiedao_sharen', 'club', 13, { toolTiming: 'immediate' }),

  // 铁索连环 (6 cards)
  c('tiesuo_spade_Q', '铁索连环', 'tool', 'tiesuo_lianhuan', 'spade', 12, { toolTiming: 'immediate' }),
  c('tiesuo_spade_K', '铁索连环', 'tool', 'tiesuo_lianhuan', 'spade', 13, { toolTiming: 'immediate' }),
  c('tiesuo_club_Q',  '铁索连环', 'tool', 'tiesuo_lianhuan', 'club', 12, { toolTiming: 'immediate' }),
  c('tiesuo_club_K',  '铁索连环', 'tool', 'tiesuo_lianhuan', 'club', 13, { toolTiming: 'immediate' }),
  c('tiesuo_club_10', '铁索连环', 'tool', 'tiesuo_lianhuan', 'club', 10, { toolTiming: 'immediate' }),
  c('tiesuo_club_J',  '铁索连环', 'tool', 'tiesuo_lianhuan', 'club', 11, { toolTiming: 'immediate' }),

  // ==========================================
  // 延时锦囊牌
  // ==========================================
  // 乐不思蜀 (3 cards)
  c('lebu_heart_6',  '乐不思蜀', 'tool', 'lebu_sishu', 'heart', 6, { toolTiming: 'delayed' }),
  c('lebu_spade_6',  '乐不思蜀', 'tool', 'lebu_sishu', 'spade', 6, { toolTiming: 'delayed' }),
  c('lebu_club_6',   '乐不思蜀', 'tool', 'lebu_sishu', 'club', 6, { toolTiming: 'delayed' }),

  // 兵粮寸断 (2 cards)
  c('bingliang_spade_10','兵粮寸断', 'tool', 'bingliang_cunduan', 'spade', 10, { toolTiming: 'delayed' }),
  c('bingliang_club_4',  '兵粮寸断', 'tool', 'bingliang_cunduan', 'club', 4, { toolTiming: 'delayed' }),

  // 闪电 (2 cards)
  c('shandian_spade_A', '闪电', 'tool', 'shandian', 'spade', 1, { toolTiming: 'delayed' }),
  c('shandian_heart_Q', '闪电', 'tool', 'shandian', 'heart', 12, { toolTiming: 'delayed' }),

  // ==========================================
  // 装备牌 - 武器
  // ==========================================
  c('zhugeliannu_spade_A',   '诸葛连弩', 'equipment', 'zhugeliannu', 'spade', 1, { equipSlot: 'weapon', weaponRange: 1 }),
  c('zhugeliannu_club_A',    '诸葛连弩', 'equipment', 'zhugeliannu', 'club', 1, { equipSlot: 'weapon', weaponRange: 1 }),
  c('qinggangjian_spade_6',  '青釭剑',   'equipment', 'qinggangjian', 'spade', 6, { equipSlot: 'weapon', weaponRange: 2 }),
  c('zhangbashemao_spade_Q', '丈八蛇矛', 'equipment', 'zhangbashemao', 'spade', 12, { equipSlot: 'weapon', weaponRange: 3 }),
  c('guanshifu_diamond_5',    '贯石斧',   'equipment', 'guanshifu', 'diamond', 5, { equipSlot: 'weapon', weaponRange: 3 }),
  c('qinglong_spade_5',      '青龙偃月刀','equipment', 'qinglongyanyuedao', 'spade', 5, { equipSlot: 'weapon', weaponRange: 3 }),
  c('qilingong_spade_5b',     '麒麟弓',   'equipment', 'qilingong', 'spade', 5, { equipSlot: 'weapon', weaponRange: 5 }),
  c('hanbingjian_spade_2',    '寒冰剑',   'equipment', 'hanbingjian', 'spade', 2, { equipSlot: 'weapon', weaponRange: 2 }),
  c('gudingdao_spade_2b',     '古锭刀',   'equipment', 'gudingdao', 'spade', 2, { equipSlot: 'weapon', weaponRange: 2 }),

  // ==========================================
  // 装备牌 - 防具
  // ==========================================
  c('baguazhen_spade_2', '八卦阵', 'equipment', 'baguazhen', 'spade', 2, { equipSlot: 'armor' }),
  c('baguazhen_club_2',  '八卦阵', 'equipment', 'baguazhen', 'club', 2, { equipSlot: 'armor' }),
  c('renwangdun_club_2', '仁王盾', 'equipment', 'renwangdun', 'club', 2, { equipSlot: 'armor' }),
  c('tengjia_spade_2',   '藤甲',   'equipment', 'tengjia', 'spade', 2, { equipSlot: 'armor' }),
  c('tengjia_club_2',    '藤甲',   'equipment', 'tengjia', 'club', 2, { equipSlot: 'armor' }),

  // ==========================================
  // 装备牌 - +1 坐骑
  // ==========================================
  c('dilu_spade_5',         '的卢',     'equipment', 'dilu', 'spade', 5, { equipSlot: 'plusHorse' }),
  c('dilu_club_5',          '的卢',     'equipment', 'dilu', 'club', 5, { equipSlot: 'plusHorse' }),
  c('dawan_spade_13',       '大宛',     'equipment', 'dawan', 'spade', 13, { equipSlot: 'plusHorse' }),
  c('zhuahuangfeidian_heart_13', '爪黄飞电', 'equipment', 'zhuahuangfeidian', 'heart', 13, { equipSlot: 'plusHorse' }),

  // ==========================================
  // 装备牌 - -1 坐骑
  // ==========================================
  c('chitu_heart_5',      '赤兔',   'equipment', 'chitu', 'heart', 5, { equipSlot: 'minusHorse' }),
  c('jueying_spade_K',   '绝影',   'equipment', 'jueying', 'spade', 13, { equipSlot: 'minusHorse' }),
  c('diangongli_heart_13','点钢骊', 'equipment', 'diangongli', 'heart', 13, { equipSlot: 'minusHorse' }),
];

// Registry lookup
const registry = new Map<string, CardDefinition>();
for (const def of CARD_DEFINITIONS) {
  registry.set(def.id, def);
}

export function getCardDefinition(id: string): CardDefinition | undefined {
  return registry.get(id);
}

export function getCardsBySubtype(subtype: string): CardDefinition[] {
  return CARD_DEFINITIONS.filter(d => d.subtype === subtype);
}

export function getCardsByCategory(category: string): CardDefinition[] {
  return CARD_DEFINITIONS.filter(d => d.category === category);
}

// Standard deck composition (108 cards, base game)
export const STANDARD_DECK_IDS: string[] = CARD_DEFINITIONS
  .filter(d => !d.id.includes('_2b') && !d.id.includes('_3b')
    && !d.id.includes('_5b') && !d.id.includes('_6b')
    && !d.id.includes('_7b') && !d.id.includes('_8b')
    && !d.id.includes('_8c') && !d.id.includes('_9b')
    && !d.id.includes('_10b') && !d.id.includes('_Jb')
    && !d.id.includes('_Qb')
    // Exclude specific expansion-only cards
    && !['sha_spade_5', 'sha_spade_6', 'sha_club_t5', 'sha_club_t6',
        'sha_club_t7', 'sha_club_t8', 'sha_heart_4', 'sha_heart_7',
        'sha_diamond_4', 'sha_diamond_5',
        'jiu_spade_3', 'jiu_spade_9', 'jiu_club_3', 'jiu_club_9', 'jiu_heart_4',
        'bingliang_spade_10', 'bingliang_club_4',
        'gudingdao_spade_2b', 'hanbingjian_spade_2',
        'tengjia_spade_2', 'tengjia_club_2',
        'renwangdun_club_2',
       ].includes(d.id))
  .map(d => d.id);

// All cards (160 cards, standard + military expansion)
export const FULL_DECK_IDS: string[] = CARD_DEFINITIONS.map(d => d.id);
